import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config/env.js";
import { asyncRoute, fail, publicUser } from "../utils/http.js";
import { authRateLimit } from "../middleware/rateLimit.js";

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const tokenFor = (user) => jwt.sign(
  { sub: user._id.toString(), email: user.email },
  config.jwtSecret,
  { expiresIn: config.jwtExpiresIn },
);

export function createAuthRouter({ users, requireAuth }) {
  const router = Router();

  router.post("/register", authRateLimit, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const photo = String(body.photo || "").trim();

    if (!name || name.length > 100) throw fail(400, "Enter your name (up to 100 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Enter a valid email address.");
    if (photo && !/^https?:\/\//i.test(photo)) throw fail(400, "Enter a valid photo URL or leave that field blank.");
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      throw fail(400, "Password must be at least 6 characters and include uppercase and lowercase letters.");
    }
    if (await users.findOne({ email })) throw fail(409, "An account with this email already exists.");

    const user = { name, email, photo, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() };
    const { insertedId } = await users.insertOne(user);
    res.status(201).json({ user: publicUser({ ...user, _id: insertedId }) });
  }));

  router.post("/login", authRateLimit, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const user = await users.findOne({ email });
    if (!user?.passwordHash || !(await bcrypt.compare(String(body.password || ""), user.passwordHash))) {
      throw fail(401, "Email or password is incorrect.");
    }
    res.cookie("studiospace_token", tokenFor(user), cookieOptions).json({ user: publicUser(user) });
  }));

  router.get("/google", authRateLimit, (req, res, next) => {
    if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
      return next(fail(503, "Google sign-in is not configured on this server."));
    }
    const state = randomBytes(32).toString("hex");
    const requested = String(req.query.returnTo || "/");
    const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

    res.cookie("studiospace_oauth_state", `${state}.${Buffer.from(returnTo).toString("base64url")}`, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    });

    const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    google.search = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: config.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();
    res.redirect(google.toString());
  });

  router.get("/google/callback", asyncRoute(async (req, res) => {
    const stateCookie = req.cookies?.studiospace_oauth_state || "";
    res.clearCookie("studiospace_oauth_state", { ...cookieOptions, maxAge: undefined });

    try {
      if (!req.query.code || !req.query.state || !stateCookie) throw new Error("Missing OAuth state or authorization code.");
      const [expected, returnToken] = stateCookie.split(".");
      const actual = String(req.query.state);
      const expectedBytes = Buffer.from(expected || "");
      const actualBytes = Buffer.from(actual);
      if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
        throw new Error("OAuth state verification failed.");
      }

      const returnTo = Buffer.from(returnToken || "", "base64url").toString("utf8");
      const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: config.googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenResponse.ok) throw new Error("Google could not verify the sign-in response.");

      const tokenData = await tokenResponse.json();
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileResponse.ok) throw new Error("Google profile could not be loaded.");

      const profile = await profileResponse.json();
      if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error("A verified Google email is required.");
      const email = profile.email.toLowerCase();
      let user = await users.findOne({ $or: [{ googleId: profile.sub }, { email }] });

      if (user) {
        await users.updateOne({ _id: user._id }, { $set: {
          googleId: profile.sub,
          name: profile.name || user.name,
          photo: profile.picture || user.photo || "",
        } });
        user = await users.findOne({ _id: user._id });
      } else {
        const created = {
          googleId: profile.sub,
          name: profile.name || email.split("@")[0],
          email,
          photo: profile.picture || "",
          createdAt: new Date(),
        };
        const { insertedId } = await users.insertOne(created);
        user = { ...created, _id: insertedId };
      }

      res.cookie("studiospace_token", tokenFor(user), cookieOptions).redirect(`${config.clientOrigin}${safeReturnTo}`);
    } catch (error) {
      console.error("Google sign-in failed:", error.message);
      res.redirect(`${config.clientOrigin}/login?oauthError=google`);
    }
  }));

  router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
  router.post("/logout", (_req, res) => {
    res.clearCookie("studiospace_token", { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });

  return router;
}
