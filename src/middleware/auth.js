import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { config } from "../config/env.js";
import { asyncRoute, fail, publicUser } from "../utils/http.js";

export const requireAuth = ({ users }) => asyncRoute(async (req, _res, next) => {
  const token = req.cookies?.studiospace_token;
  if (!token) throw fail(401, "Please sign in to continue.");

  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret);
  } catch {
    throw fail(401, "Your session has expired. Please sign in again.");
  }

  if (!ObjectId.isValid(claims.sub)) throw fail(401, "Invalid session. Please sign in again.");
  const user = await users.findOne({ _id: new ObjectId(claims.sub) });
  if (!user) throw fail(401, "Account not found. Please sign in again.");

  req.user = publicUser(user);
  next();
});
