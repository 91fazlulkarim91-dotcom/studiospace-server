import { Router } from "express";
import { asyncRoute, fail, idFrom } from "../utils/http.js";

export function createBookingsRouter({ bookings, studios, requireAuth }) {
  const router = Router();

  router.post("/", requireAuth, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const studioId = idFrom(body.studioId);
    const date = String(body.date || "");
    const start = String(body.start || "");
    const end = String(body.end || "");

    const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTime(start) || !validTime(end) || end <= start) {
      throw fail(400, "Choose a valid date and time range.");
    }
    if (date < new Date().toISOString().slice(0, 10)) throw fail(400, "Choose a date that has not passed.");

    const studio = await studios.findOne({ _id: studioId });
    if (!studio) throw fail(404, "Studio not found.");

    // Pending and Confirmed reservations both block overlapping time slots.
    const collision = await bookings.findOne({
      studioId,
      date,
      status: { $in: ["Pending", "Confirmed"] },
      start: { $lt: end },
      end: { $gt: start },
    });
    if (collision) throw fail(409, "That time overlaps an existing booking. Choose another time.");

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
    res.status(201).json({ ...item, _id: insertedId });
  }));

  router.patch("/:id/cancel", requireAuth, asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);
    const result = await bookings.updateOne(
      { _id, userEmail: req.user.email, status: "Pending" },
      { $set: { status: "Cancelled", updatedAt: new Date() } },
    );
    if (!result.modifiedCount) throw fail(409, "Only pending bookings can be cancelled.");
    res.json({ ok: true });
  }));

  return router;
}
