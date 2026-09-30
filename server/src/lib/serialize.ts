import type { HydratedDocument } from "mongoose";
import type { InferSchemaType } from "mongoose";

type P = {
  _id: unknown;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  images: { url: string; publicId?: string | null }[];
  stock: number;
  featured?: boolean | null;
};

export const productJson = (p: P) => ({
  id: String(p._id),
  name: p.name,
  slug: p.slug,
  description: p.description,
  price: p.price,
  category: p.category,
  images: p.images.map((i) => ({ url: i.url })),
  stock: p.stock,
  featured: Boolean(p.featured),
});

/** Admin view includes the Cloudinary public id, which the storefront never needs. */
export const adminProductJson = (p: P) => ({ ...productJson(p), images: p.images.map((i) => ({ url: i.url, publicId: i.publicId ?? "" })) });

type O = {
  _id: unknown;
  user?: unknown;
  items: { product: unknown; name: string; price: number; qty: number; image?: string | null }[];
  total: number;
  status: string;
  paidAt?: Date | null;
  paidVia?: string | null;
  shipping?: Record<string, string | null | undefined> | null;
  createdAt?: Date;
  seeded?: boolean | null;
};

export const orderJson = (o: O) => ({
  id: String(o._id),
  items: o.items.map((i) => ({ productId: String(i.product), name: i.name, price: i.price, qty: i.qty, image: i.image ?? "" })),
  total: o.total,
  status: o.status,
  paidAt: o.paidAt ?? null,
  paidVia: o.paidVia ?? null,
  shipping: o.shipping && Object.values(o.shipping).some(Boolean) ? o.shipping : null,
  createdAt: o.createdAt ?? null,
});

export type UserLike = { _id: unknown; name: string; email: string; role: string };
export const userJson = (u: UserLike) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

export type { HydratedDocument, InferSchemaType };
