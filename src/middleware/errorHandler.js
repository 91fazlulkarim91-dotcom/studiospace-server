import { fail } from "../utils/http.js";

export function notFoundHandler(req, _res, next) {
  next(fail(404, `No route for ${req.method} ${req.path}`));
}

export function errorHandler(error, _req, res, _next) {
  if (error?.code === 11000) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "Something went wrong. Please try again." : error.message,
  });
}
