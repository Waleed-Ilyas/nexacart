import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { Config } from "../config";
import { AppError } from "../lib/errors";
import { restock } from "../lib/orders";
import { adminProductJson, orderJson } from "../lib/serialize";
import type { Deps } from "../lib/services";
import { isObjectId, slugify } from "../lib/util";
import { demoAdminGuard, requireAuth, requireRole } from "../middleware/auth";
import { Order, type OrderStatus } from "../models/Order";
import { CATEGORIES, Product } from "../models/Product";
import { User } from "../models/User";

const PAID = ["paid", "shipped", "delivered"];
const LOW_STOCK = 5;

const ProductBody = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(120),
  description: z.string().trim().min(10, "Write at least 10 characters.").max(2000),
  price: z.number().int("Price must be a whole number of cents.").min(1, "Price must be above zero.").max(10_000_000),
  category: z.enum(CATEGORIES),
  stock: z.number().int().min(0, "Stock cannot be negative.").max(100_000),
  featured: z.boolean().default(false),
  images: z
    .array(
      z.object({ url: z.string().refine((u) => /^https:\/\/\S+$/.test(u), "Image links must start with https://"), publicId: z.string().max(200).default("") }),
    )
    .max(5, "Up to 5 images.")
    .default([]),
});

const TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ["cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|avif)$/.test(file.mimetype)),
});

async function uniqueSlug(name: string, ignoreId?: string) {
  const base = slugify(name);
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await Product.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) });
    if (!clash) return slug;
  }
  return `${base}-${Date.now()}`;
}

export function adminRouter(config: Config, deps: Deps) {
  const router = Router();
  router.use(requireAuth(config), requireRole("admin"));
  const productWrites = demoAdminGuard(config);

  // ---------- dashboard ----------
  router.get("/stats", async (_req, res) => {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);

    const [daily, totals, top, statuses, customers, lowStock] = await Promise.all([
      Order.aggregate<{ _id: string; revenue: number; orders: number }>([
        { $match: { status: { $in: PAID }, paidAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate<{ revenue: number; orders: number }>([
        { $match: { status: { $in: PAID } } },
        { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate<{ _id: string; units: number; revenue: number }>([
        { $match: { status: { $in: PAID } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", units: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } } } },
        { $sort: { units: -1, _id: 1 } },
        { $limit: 5 },
      ]),
      Order.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      User.countDocuments({ role: "user" }),
      Product.find({ stock: { $lte: LOW_STOCK } })
        .sort({ stock: 1, name: 1 })
        .limit(6),
    ]);

    const byDay = new Map(daily.map((d) => [d._id, d]));
    const series = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      return { date: key, revenue: byDay.get(key)?.revenue ?? 0, orders: byDay.get(key)?.orders ?? 0 };
    });
    const revenue = totals[0]?.revenue ?? 0;
    const orders = totals[0]?.orders ?? 0;
    res.json({
      totals: { revenue, orders, averageOrder: orders ? Math.round(revenue / orders) : 0, customers },
      series,
      topProducts: top.map((t) => ({ name: t._id, units: t.units, revenue: t.revenue })),
      statuses: statuses.map((s) => ({ status: s._id, count: s.count })),
      lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, stock: p.stock })),
    });
  });

  // ---------- orders ----------
  router.get("/orders", async (req, res) => {
    const q = z
      .object({
        status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]).optional(),
        page: z.coerce.number().int().min(1).max(500).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(15),
      })
      .parse(req.query);
    const filter = q.status ? { status: q.status } : { status: { $ne: "pending" as const } };
    const [total, docs] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate<{ user: { name: string; email: string } | null }>("user", "name email"),
    ]);
    res.json({
      orders: docs.map((o) => ({ ...orderJson(o), customer: o.user ? { name: o.user.name, email: o.user.email } : null })),
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / q.limit)),
    });
  });

  router.patch("/orders/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!isObjectId(id)) throw new AppError(404, "Order not found.");
    const { status } = z.object({ status: z.enum(["shipped", "delivered", "cancelled"]) }).parse(req.body);
    const order = await Order.findById(id);
    if (!order) throw new AppError(404, "Order not found.");
    if (!TRANSITIONS[order.status]?.includes(status)) throw new AppError(409, `A ${order.status} order cannot be marked ${status}.`, "bad_transition");
    const wasPaid = PAID.includes(order.status);
    order.status = status;
    await order.save();
    if (status === "cancelled" && wasPaid) await restock(order.items);
    res.json({ order: orderJson(order) });
  });

  // ---------- products ----------
  router.get("/products", async (_req, res) => {
    const docs = await Product.find().sort({ createdAt: -1, _id: -1 }).limit(200);
    res.json({ products: docs.map(adminProductJson) });
  });

  router.post("/products", productWrites, async (req, res) => {
    const body = ProductBody.parse(req.body);
    const product = await Product.create({ ...body, slug: await uniqueSlug(body.name) });
    res.status(201).json({ product: adminProductJson(product) });
  });

  router.put("/products/:id", productWrites, async (req, res) => {
    const id = String(req.params.id);
    if (!isObjectId(id)) throw new AppError(404, "Product not found.");
    const body = ProductBody.parse(req.body);
    const existing = await Product.findById(id);
    if (!existing) throw new AppError(404, "Product not found.");
    const slug = existing.name === body.name ? existing.slug : await uniqueSlug(body.name, id);
    existing.set({ ...body, slug });
    await existing.save();
    res.json({ product: adminProductJson(existing) });
  });

  router.delete("/products/:id", productWrites, async (req, res) => {
    const id = String(req.params.id);
    if (!isObjectId(id)) throw new AppError(404, "Product not found.");
    const product = await Product.findByIdAndDelete(id);
    if (!product) throw new AppError(404, "Product not found.");
    // Best effort: a failed image cleanup must not turn a successful delete into an error.
    await Promise.allSettled(product.images.map((i) => (i.publicId ? deps.images.remove(i.publicId) : Promise.resolve())));
    res.json({ ok: true });
  });

  router.post("/uploads", productWrites, upload.single("image"), async (req, res) => {
    if (!req.file) throw new AppError(400, "Choose a PNG, JPG, WebP or AVIF image.");
    res.status(201).json(await deps.images.upload(req.file.buffer, "nexacart/products"));
  });

  return router;
}
