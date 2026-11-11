import { fail } from "./http.js";

export function cleanStudio(body = {}) {
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const rate = Number(body.rate);
  const imageUrl = String(body.imageUrl || body.photo || "").trim();

  if (!title || title.length > 120) {
    throw fail(400, "Studio title is required (up to 120 characters).");
  }
  if (!category || category.length > 60) throw fail(400, "Choose a studio category.");
  if (!Number.isFinite(rate) || rate <= 0 || rate > 10000) {
    throw fail(400, "Enter a valid hourly rate.");
  }
  if (!/^https?:\/\//i.test(imageUrl)) throw fail(400, "Enter a valid studio image URL.");

  const deposit = Number(body.deposit);
  const capacity = Number(body.capacity);

  return {
    title,
    category,
    rate,
    imageUrl,
    deposit: Number.isFinite(deposit) ? Math.max(0, deposit) : 0,
    capacity: Number.isFinite(capacity) ? Math.max(1, capacity) : 1,
    location: String(body.location || "").trim().slice(0, 180),
    amenities: Array.isArray(body.amenities)
      ? body.amenities.map((item) => String(item).trim()).filter(Boolean).slice(0, 30)
      : [],
    description: String(body.description || "").trim().slice(0, 5000),
  };
}
