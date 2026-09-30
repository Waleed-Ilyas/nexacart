import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { productJson } from "../lib/serialize";
import { escapeRegex } from "../lib/util";
import { CATEGORIES, Product } from "../models/Product";

const ListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  featured: z.enum(["true"]).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  "price-asc": { price: 1, _id: 1 },
  "price-desc": { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
} as const;

export function productsRouter() {
  const router = Router();

  router.get("/", async (req, res) => {
    const q = ListQuery.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (q.category) filter.category = q.category;
    if (q.featured) filter.featured = true;
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      filter.price = { ...(q.minPrice !== undefined && { $gte: q.minPrice }), ...(q.maxPrice !== undefined && { $lte: q.maxPrice }) };
    }
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), "i");
      filter.$or = [{ name: rx }, { description: rx }];
    }
    const [total, docs] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort(SORTS[q.sort])
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
    ]);
    res.json({ items: docs.map(productJson), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) });
  });

  // Categories with counts and the price range, used to build the filter controls.
  router.get("/meta", async (_req, res) => {
    const [cats, range] = await Promise.all([
      Product.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Product.aggregate<{ min: number; max: number }>([{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }]),
    ]);
    res.json({ categories: cats.map((c) => ({ name: c._id, count: c.count })), priceRange: { min: range[0]?.min ?? 0, max: range[0]?.max ?? 0 } });
  });

  router.get("/:slug", async (req, res) => {
    const p = await Product.findOne({ slug: String(req.params.slug).toLowerCase() });
    if (!p) throw new AppError(404, "We could not find that product.");
    res.json({ product: productJson(p) });
  });

  return router;
}
