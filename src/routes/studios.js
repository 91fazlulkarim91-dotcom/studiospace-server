import { Router } from "express";
import { asyncRoute, fail, idFrom, publicUser } from "../utils/http.js";
import { cleanStudio } from "../utils/studioValidation.js";

export function createStudiosRouter({ studios, users, requireAuth, favorites }) {
  const router = Router();

  router.get("/", asyncRoute(async (req, res) => {
    const filter = {};
    if (req.query.category) filter.category = String(req.query.category);
    if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 24));
    const [items, total] = await Promise.all([
      studios.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      studios.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }));

  router.get("/:id", asyncRoute(async (req, res) => {
    const item = await studios.findOne({ _id: idFrom(req.params.id) });
    if (!item) throw fail(404, "Studio not found.");
    const host = await users.findOne({ email: item.ownerEmail }, { projection: { name: 1, email: 1, photo: 1 } });
    res.json({ ...item, host: host ? publicUser(host) : null });
  }));

  router.post("/", requireAuth, asyncRoute(async (req, res) => {
    const item = {
      ...cleanStudio(req.body),
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await studios.insertOne(item);
    res.status(201).json({ ...item, _id: insertedId });
  }));

  router.patch("/:id", requireAuth, asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);
    const result = await studios.updateOne(
      { _id, ownerEmail: req.user.email },
      { $set: { ...cleanStudio(req.body), updatedAt: new Date() } },
    );
    if (!result.matchedCount) throw fail(404, "Studio not found in your listings.");
    res.json(await studios.findOne({ _id }));
  }));

  router.delete("/:id", requireAuth, asyncRoute(async (req, res) => {
    const _id = idFrom(req.params.id);
    const result = await studios.deleteOne({ _id, ownerEmail: req.user.email });
    if (!result.deletedCount) throw fail(404, "Studio not found in your listings.");
    await favorites.deleteMany({ studioId: _id.toString() });
    res.json({ ok: true });
  }));

  return router;
}
