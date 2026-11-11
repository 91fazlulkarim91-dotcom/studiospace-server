import { Router } from "express";
import { asyncRoute, fail, idFrom } from "../utils/http.js";

export function createFavoritesRouter({ favorites, studios, requireAuth }) {
  const router = Router();

  router.get("/", requireAuth, asyncRoute(async (req, res) => {
    const docs = await favorites.find({ userEmail: req.user.email }).toArray();
    res.json(docs.map((doc) => doc.studioId));
  }));

  router.put("/:studioId", requireAuth, asyncRoute(async (req, res) => {
    const id = idFrom(req.params.studioId);
    const studio = await studios.findOne({ _id: id }, { projection: { _id: 1 } });
    if (!studio) throw fail(404, "Studio not found.");

    await favorites.updateOne(
      { userEmail: req.user.email, studioId: id.toString() },
      { $setOnInsert: { userEmail: req.user.email, studioId: id.toString(), createdAt: new Date() } },
      { upsert: true },
    );
    res.status(204).end();
  }));

  router.delete("/:studioId", requireAuth, asyncRoute(async (req, res) => {
    await favorites.deleteOne({ userEmail: req.user.email, studioId: idFrom(req.params.studioId).toString() });
    res.status(204).end();
  }));

  return router;
}
