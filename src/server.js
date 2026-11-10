
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { randomBytes, timingSafeEqual } from "node:crypto";

// ========================================
// 1. Environment Configuration
// ========================================

const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
}

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const clientOrigins = process.env.CLIENT_ORIGIN
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const clientOrigin = clientOrigins[0];

// ========================================
// 2. Express App & MongoDB
// ========================================

const app = express();

// Render reverse proxy support
if (isProduction) {
  app.set("trust proxy", 1);
}

const client = new MongoClient(process.env.MONGODB_URI);

await client.connect();

const db = client.db(process.env.MONGODB_DB || "studiospace");

const users = db.collection("users");
const studios = db.collection("studios");
const bookings = db.collection("bookings");
const favorites = db.collection("favorites");

console.log("MongoDB connected successfully");

// ========================================
// 3. Cookie Configuration
// ========================================

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ========================================
// 4. MongoDB Indexes
// ========================================

await Promise.all([
  users.createIndex({ email: 1 }, { unique: true }),
  studios.createIndex({ ownerEmail: 1 }),
  studios.createIndex({ category: 1, createdAt: -1 }),
  studios.createIndex({
    title: "text",
    location: "text",
    category: "text",
  }),
  bookings.createIndex({ studioId: 1, date: 1, status: 1 }),
  bookings.createIndex({ userEmail: 1, createdAt: -1 }),
  favorites.createIndex(
    { userEmail: 1, studioId: 1 },
    { unique: true },
  ),
]);

// ========================================
// 5. Middleware
// ========================================

app.use(helmet());

const allowedOrigins = new Set(
  process.env.CLIENT_ORIGIN
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ========================================
// 6. Helper Functions
// ========================================

const fail = (status, message) =>
  Object.assign(new Error(message), { status });

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const publicUser = ({ _id, name, email, photo = "" }) => ({
  id: _id.toString(),
  name,
  email,
  photo,
});

const tokenFor = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );

const idFrom = (value) => {
  if (!ObjectId.isValid(value)) {
    throw fail(400, "Invalid resource id.");
  }

  return new ObjectId(value);
};

// ========================================
// 7. Authentication Middleware
// ========================================

const auth = asyncRoute(async (req, _res, next) => {
  const token = req.cookies.studiospace_token;

  if (!token) {
    throw fail(401, "Please sign in to continue.");
  }

  let claims;

  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw fail(401, "Your session has expired. Please sign in again.");
  }

  if (!ObjectId.isValid(claims.sub)) {
    throw fail(401, "Invalid session. Please sign in again.");
  }

  const user = await users.findOne({
    _id: new ObjectId(claims.sub),
  });

  if (!user) {
    throw fail(401, "Account not found. Please sign in again.");
  }

  req.user = publicUser(user);

  next();
});

// ========================================
// 8. Studio Validation
// ========================================

const cleanStudio = (body) => {
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const rate = Number(body.rate);
  const imageUrl = String(body.imageUrl || body.photo || "").trim();

  if (!title || title.length > 120) {
    throw fail(400, "Studio title is required (up to 120 characters).");
  }

  if (!category || category.length > 60) {
    throw fail(400, "Choose a studio category.");
  }

  if (!Number.isFinite(rate) || rate <= 0 || rate > 10000) {
    throw fail(400, "Enter a valid hourly rate.");
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw fail(400, "Enter a valid studio image URL.");
  }

  return {
    title,
    category,
    rate,
    imageUrl,
    deposit: Math.max(0, Number(body.deposit) || 0),
    capacity: Math.max(1, Number(body.capacity) || 1),

    location: String(body.location || "")
      .trim()
      .slice(0, 180),

    amenities: Array.isArray(body.amenities)
      ? body.amenities
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 30)
      : [],

    description: String(body.description || "")
      .trim()
      .slice(0, 5000),
  };
};

// ========================================
// 9. Health Check
// ========================================

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "studiospace-api",
  });
});

// ========================================
// 10. Register
// ========================================

app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const name = String(req.body.name || "").trim();

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");
    const photo = String(req.body.photo || "").trim();

    if (!name || name.length > 100) {
      throw fail(400, "Enter your name (up to 100 characters).");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw fail(400, "Enter a valid email address.");
    }

    if (photo && !/^https?:\/\//i.test(photo)) {
      throw fail(
        400,
        "Enter a valid photo URL or leave that field blank.",
      );
    }

    if (
      password.length < 6 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password)
    ) {
      throw fail(
        400,
        "Password must be at least 6 characters and include uppercase and lowercase letters.",
      );
    }

    if (await users.findOne({ email })) {
      throw fail(409, "An account with this email already exists.");
    }

    const user = {
      name,
      email,
      photo,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date(),
    };

    const { insertedId } = await users.insertOne(user);

    res.status(201).json({
      user: publicUser({
        ...user,
        _id: insertedId,
      }),
    });
  }),
);

// ========================================
// 11. Login
// ========================================

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const user = await users.findOne({ email });

    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(
        String(req.body.password || ""),
        user.passwordHash,
      ))
    ) {
      throw fail(401, "Email or password is incorrect.");
    }

    res
      .cookie("studiospace_token", tokenFor(user), cookieOptions)
      .json({
        user: publicUser(user),
      });
  }),
);

// ========================================
// 12. Google OAuth Start
// ========================================

app.get("/api/auth/google", (req, res, next) => {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  ) {
    return next(
      fail(503, "Google sign-in is not configured on this server."),
    );
  }

  const state = randomBytes(32).toString("hex");

  const requested = String(req.query.returnTo || "/");

  const returnTo =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/";

  res.cookie(
    "studiospace_oauth_state",
    `${state}.${Buffer.from(returnTo).toString("base64url")}`,
    {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    },
  );

  const google = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );

  google.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();

  res.redirect(google.toString());
});

// ========================================
// 13. Google OAuth Callback
// ========================================

app.get(
  "/api/auth/google/callback",
  asyncRoute(async (req, res) => {
    const stateCookie = req.cookies.studiospace_oauth_state || "";

    res.clearCookie("studiospace_oauth_state", {
      ...cookieOptions,
      maxAge: undefined,
    });

    try {
      if (!req.query.code || !req.query.state || !stateCookie) {
        throw new Error("Missing OAuth state or authorization code.");
      }

      const [expected, returnToken] = stateCookie.split(".");
      const actual = String(req.query.state);

      const expectedBytes = Buffer.from(expected || "");
      const actualBytes = Buffer.from(actual);

      if (
        expectedBytes.length !== actualBytes.length ||
        !timingSafeEqual(expectedBytes, actualBytes)
      ) {
        throw new Error("OAuth state verification failed.");
      }

      const returnTo = Buffer.from(
        returnToken || "",
        "base64url",
      ).toString("utf8");

      const safeReturnTo =
        returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/";

      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code: String(req.query.code),
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error("Google could not verify the sign-in response.");
      }

      const tokenData = await tokenResponse.json();

      const profileResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        },
      );

      if (!profileResponse.ok) {
        throw new Error("Google profile could not be loaded.");
      }

      const profile = await profileResponse.json();

      if (
        !profile.sub ||
        !profile.email ||
        profile.email_verified !== true
      ) {
        throw new Error("A verified Google email is required.");
      }

      const email = profile.email.toLowerCase();

      let user = await users.findOne({
        $or: [
          { googleId: profile.sub },
          { email },
        ],
      });

      if (user) {
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              googleId: profile.sub,
              name: profile.name || user.name,
              photo: profile.picture || user.photo || "",
            },
          },
        );

        user = await users.findOne({
          _id: user._id,
        });
      } else {
        const created = {
          googleId: profile.sub,
          name: profile.name || email.split("@")[0],
          email,
          photo: profile.picture || "",
          createdAt: new Date(),
        };

        const { insertedId } = await users.insertOne(created);

        user = {
          ...created,
          _id: insertedId,
        };
      }

      res
        .cookie("studiospace_token", tokenFor(user), cookieOptions)
        .redirect(`${clientOrigin}${safeReturnTo}`);
    } catch (error) {
      console.error("Google sign-in failed:", error.message);

      res.redirect(
        `${clientOrigin}/login?oauthError=google`,
      );
    }
  }),
);

// ========================================
// 14. Current User
// ========================================

app.get("/api/auth/me", auth, (req, res) => {
  res.json({
    user: req.user,
  });
});

// ========================================
// 15. Logout
// ========================================

app.post("/api/auth/logout", (_req, res) => {
  res
    .clearCookie("studiospace_token", {
      ...cookieOptions,
      maxAge: undefined,
    })
    .json({
      ok: true,
    });
});

// ========================================
// 16. Get All Studios
// ========================================

app.get(
  "/api/studios",
  asyncRoute(async (req, res) => {
    const filter = {};

    if (req.query.category) {
      filter.category = String(req.query.category);
    }

    if (req.query.q) {
      filter.$text = {
        $search: String(req.query.q).slice(0, 100),
      };
    }

    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(
      48,
      Math.max(1, Number(req.query.limit) || 24),
    );

    const [items, total] = await Promise.all([
      studios
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      studios.countDocuments(filter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
    });
  }),
);

// ========================================
// 17. Get Single Studio
// ========================================

app.get(
  "/api/studios/:id",
  asyncRoute(async (req, res) => {
    const item = await studios.findOne({
      _id: idFrom(req.params.id),
    });

    if (!item) {
      throw fail(404, "Studio not found.");
    }

    const host = await users.findOne(
      { email: item.ownerEmail },
      {
        projection: {
          name: 1,
          email: 1,
          photo: 1,
        },
      },
    );

    res.json({
      ...item,
      host: host ? publicUser(host) : null,
    });
  }),
);

// ========================================
// 18. Create Studio
// ========================================

app.post(
  "/api/studios",
  auth,
  asyncRoute(async (req, res) => {
    const item = {
      ...cleanStudio(req.body),
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { insertedId } = await studios.insertOne(item);

    res.status(201).json({
      ...item,
      _id: insertedId,
    });
  }),
);

// ========================================
// 19. My Studios
// ========================================

app.get(
  "/api/my/studios",
  auth,
  asyncRoute(async (req, res) => {
    const items = await studios
      .find({
        ownerEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  }),
);

// ========================================
// 20. Update Studio
// ========================================

app.patch(
  "/api/studios/:id",
  auth,
  asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);

    const result = await studios.updateOne(
      {
        _id,
        ownerEmail: req.user.email,
      },
      {
        $set: {
          ...cleanStudio(req.body),
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      throw fail(404, "Studio not found in your listings.");
    }

    res.json(await studios.findOne({ _id }));
  }),
);

// ========================================
// 21. Delete Studio
// ========================================

app.delete(
  "/api/studios/:id",
  auth,
  asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);

    const result = await studios.deleteOne({
      _id,
      ownerEmail: req.user.email,
    });

    if (!result.deletedCount) {
      throw fail(404, "Studio not found in your listings.");
    }

    await favorites.deleteMany({
      studioId: _id.toString(),
    });

    res.json({
      ok: true,
    });
  }),
);

// ========================================
// 22. Create Booking
// ========================================

app.post(
  "/api/bookings",
  auth,
  asyncRoute(async (req, res) => {
    const studioId = idFrom(req.body.studioId);

    const date = String(req.body.date || "");
    const start = String(req.body.start || "");
    const end = String(req.body.end || "");

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(start) ||
      !/^\d{2}:\d{2}$/.test(end) ||
      end <= start
    ) {
      throw fail(400, "Choose a valid date and time range.");
    }

    if (date < new Date().toISOString().slice(0, 10)) {
      throw fail(400, "Choose a date that has not passed.");
    }

    const studio = await studios.findOne({
      _id: studioId,
    });

    if (!studio) {
      throw fail(404, "Studio not found.");
    }

    const collision = await bookings.findOne({
      studioId,
      date,
      status: "Confirmed",
      start: { $lt: end },
      end: { $gt: start },
    });

    if (collision) {
      throw fail(
        409,
        "That time overlaps a confirmed booking. Choose another time.",
      );
    }

    const item = {
      studioId,
      studioTitle: studio.title,
      userEmail: req.user.email,
      userName: req.user.name,
      date,
      start,
      end,
      status: "Pending",
      hourlyRate: studio.rate,
      createdAt: new Date(),
    };

    const { insertedId } = await bookings.insertOne(item);

    res.status(201).json({
      ...item,
      _id: insertedId,
    });
  }),
);

// ========================================
// 23. My Bookings
// ========================================

app.get(
  "/api/my/bookings",
  auth,
  asyncRoute(async (req, res) => {
    const items = await bookings
      .find({
        userEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(items);
  }),
);

// ========================================
// 24. Cancel Booking
// ========================================

app.patch(
  "/api/bookings/:id/cancel",
  auth,
  asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);

    const result = await bookings.updateOne(
      {
        _id,
        userEmail: req.user.email,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          updatedAt: new Date(),
        },
      },
    );

    if (!result.modifiedCount) {
      throw fail(409, "Only pending bookings can be cancelled.");
    }

    res.json({
      ok: true,
    });
  }),
);

// ========================================
// 25. Get Favorites
// ========================================

app.get(
  "/api/my/favorites",
  auth,
  asyncRoute(async (req, res) => {
    const docs = await favorites
      .find({
        userEmail: req.user.email,
      })
      .toArray();

    res.json(
      docs.map((doc) => doc.studioId),
    );
  }),
);

// ========================================
// 26. Add Favorite
// ========================================

app.put(
  "/api/my/favorites/:studioId",
  auth,
  asyncRoute(async (req, res) => {
    const id = idFrom(req.params.studioId);

    const studio = await studios.findOne(
      { _id: id },
      { projection: { _id: 1 } },
    );

    if (!studio) {
      throw fail(404, "Studio not found.");
    }

    await favorites.updateOne(
      {
        userEmail: req.user.email,
        studioId: id.toString(),
      },
      {
        $setOnInsert: {
          userEmail: req.user.email,
          studioId: id.toString(),
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    res.status(204).end();
  }),
);

// ========================================
// 27. Remove Favorite
// ========================================

app.delete(
  "/api/my/favorites/:studioId",
  auth,
  asyncRoute(async (req, res) => {
    await favorites.deleteOne({
      userEmail: req.user.email,
      studioId: idFrom(req.params.studioId).toString(),
    });

    res.status(204).end();
  }),
);

// ========================================
// 28. 404 Handler
// ========================================

app.use((req, _res, next) => {
  next(
    fail(404, `No route for ${req.method} ${req.path}`),
  );
});

// ========================================
// 29. Global Error Handler
// ========================================

app.use((error, _req, res, _next) => {
  if (error?.code === 11000) {
    return res.status(409).json({
      error: "An account with this email already exists.",
    });
  }

  const status = Number(error.status) || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error:
      status >= 500
        ? "Something went wrong. Please try again."
        : error.message,
  });
});

// ========================================
// 30. Start Server
// ========================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`StudioSpace API listening on ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});

// ========================================
// 31. Graceful Shutdown
// ========================================

let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log("Shutting down StudioSpace API...");

  server.close(async () => {
    try {
      await client.close();
      console.log("MongoDB connection closed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
