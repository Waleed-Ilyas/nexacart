// Seeds the store: demo accounts, 12 products with generated artwork uploaded to Cloudinary, and generated demo orders
// so the admin dashboard has something to show. Safe to re-run: products and users are upserted, demo orders are
// replaced. Real orders (anything that went through Stripe) are never touched.
//
//   pnpm seed                        first run: also uploads the artwork
//   SEED_SKIP_IMAGES=1 pnpm seed     reset stock and demo orders quickly, keeping uploaded images
import path from "node:path";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { loadConfig } from "../src/config";
import { connectDb, disconnectDb } from "../src/db";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/User";
import { art } from "./product-art";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const config = loadConfig();

export const DEMO_CUSTOMER = { name: "Demo Shopper", email: "demo@waleed.dev", password: "Demo@1234" };
export const DEMO_ADMIN = { name: "Demo Admin", email: "admin@waleed.dev", password: "Admin@1234" };

const PRODUCTS = [
  {
    kind: "lamp",
    name: "Table Lamp",
    category: "Home",
    price: 5400,
    stock: 24,
    featured: true,
    description: "A warm, dimmable desk lamp with a fabric shade and a weighted base that stays put on a cluttered desk.",
  },
  {
    kind: "mug",
    name: "Stoneware Mug",
    category: "Home",
    price: 1800,
    stock: 60,
    featured: true,
    description: "A hand-glazed stoneware mug that holds a generous cup of coffee and stays warm to the last sip.",
  },
  {
    kind: "planter",
    name: "Ribbed Planter",
    category: "Home",
    price: 3200,
    stock: 3,
    featured: false,
    description: "A ribbed ceramic planter with a drainage hole and a matching saucer, sized for a small indoor plant.",
  },
  {
    kind: "headphones",
    name: "Studio Headphones",
    category: "Tech",
    price: 12900,
    stock: 18,
    featured: true,
    description: "Closed-back over-ear headphones with a folding headband, tuned for long listening sessions.",
  },
  {
    kind: "speaker",
    name: "Pocket Speaker",
    category: "Tech",
    price: 7900,
    stock: 35,
    featured: false,
    description: "A compact Bluetooth speaker with a fabric grille and a strap, built to be carried from room to room.",
  },
  {
    kind: "keyboard",
    name: "Mechanical Keyboard",
    category: "Tech",
    price: 9900,
    stock: 12,
    featured: false,
    description: "A compact mechanical keyboard with hot-swappable switches and a detachable cable.",
  },
  {
    kind: "backpack",
    name: "Trail Backpack",
    category: "Outdoor",
    price: 8900,
    stock: 20,
    featured: true,
    description: "A 24 litre daypack with a padded back panel, a hydration sleeve and a water-resistant shell.",
  },
  {
    kind: "bottle",
    name: "Steel Bottle",
    category: "Outdoor",
    price: 2800,
    stock: 4,
    featured: false,
    description: "An insulated stainless steel bottle that keeps drinks cold for a day and hot for half of one.",
  },
  {
    kind: "lantern",
    name: "Camp Lantern",
    category: "Outdoor",
    price: 4200,
    stock: 2,
    featured: false,
    description: "A rechargeable lantern with a warm glow and a hook, for the tent or the back porch.",
  },
  {
    kind: "cap",
    name: "Field Cap",
    category: "Apparel",
    price: 2600,
    stock: 40,
    featured: false,
    description: "A six-panel cotton cap with an adjustable strap and a curved brim.",
  },
  {
    kind: "tote",
    name: "Canvas Tote",
    category: "Apparel",
    price: 2400,
    stock: 55,
    featured: false,
    description: "A sturdy canvas tote with reinforced handles and an inside pocket for keys.",
  },
  {
    kind: "sunglasses",
    name: "Round Sunglasses",
    category: "Apparel",
    price: 4800,
    stock: 0,
    featured: false,
    description: "Round frames with UV-filtering lenses. Currently sold out, so the store shows how that state looks.",
  },
] as const;

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function uploadArt(kind: string, slug: string) {
  const png = await sharp(Buffer.from(art(kind)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: `nexacart/products/${slug}`, overwrite: true, invalidate: true, resource_type: "image" },
      (err, res) => (err || !res ? reject(err ?? new Error("upload failed")) : resolve({ url: res.secure_url, publicId: res.public_id })),
    );
    stream.end(png);
  });
}

// A small deterministic random generator, so the demo orders are the same on every run.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

async function upsertUser(u: { name: string; email: string; password?: string }, role: "user" | "admin") {
  const passwordHash = await bcrypt.hash(u.password ?? `seed-${Math.random()}-${Date.now()}`, 10);
  return User.findOneAndUpdate(
    { email: u.email },
    { $set: { name: u.name, passwordHash, role } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDb(config.MONGODB_URI);
  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true });

  console.log("Products and artwork");
  const products = [];
  for (const p of PRODUCTS) {
    const slug = slugOf(p.name);
    // SEED_SKIP_IMAGES=1 reuses the images already on Cloudinary, which makes re-seeding (to reset stock and demo orders) fast.
    const existing = process.env.SEED_SKIP_IMAGES ? await Product.findOne({ slug }) : null;
    const kept = existing?.images[0];
    const image = kept ? { url: kept.url, publicId: kept.publicId ?? "" } : await uploadArt(p.kind, slug);
    const doc = await Product.findOneAndUpdate(
      { slug },
      { $set: { name: p.name, slug, description: p.description, price: p.price, category: p.category, stock: p.stock, featured: p.featured, images: [image] } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    products.push(doc);
    console.log(`  ${p.name.padEnd(22)} ${image.url}`);
  }

  console.log("Users");
  await upsertUser(DEMO_CUSTOMER, "user");
  await upsertUser(DEMO_ADMIN, "admin");
  const names = ["Amelia Chen", "Noah Patel", "Sara Khan", "Liam Novak", "Zoe Martin", "Omar Farouk", "Hana Sato", "Ben Carter"];
  const customers = [];
  for (const [i, name] of names.entries()) customers.push(await upsertUser({ name, email: `customer${i + 1}@example.com` }, "user"));
  const demo = await User.findOne({ email: DEMO_CUSTOMER.email });
  customers.push(demo!);

  console.log("Demo orders");
  await Order.deleteMany({ seeded: true });
  const rand = rng(20260930);
  const inStock = products.filter((p) => p.stock > 0);
  const orders = [];
  for (let i = 0; i < 72; i++) {
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 30); // busier towards today
    const paidAt = new Date(Date.now() - daysAgo * 86_400_000 - Math.floor(rand() * 20) * 3_600_000);
    const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => inStock[Math.floor(rand() * inStock.length)]!);
    const items = [...new Set(lines)].map((p) => ({
      product: p._id,
      name: p.name,
      price: p.price,
      qty: 1 + Math.floor(rand() * 2),
      image: p.images[0]?.url ?? "",
    }));
    const roll = rand();
    const status =
      daysAgo > 6
        ? roll < 0.08
          ? "cancelled"
          : "delivered"
        : daysAgo > 2
          ? roll < 0.05
            ? "cancelled"
            : roll < 0.6
              ? "delivered"
              : "shipped"
          : roll < 0.7
            ? "paid"
            : "shipped";
    orders.push({
      user: customers[Math.floor(rand() * customers.length)]!._id,
      items,
      total: items.reduce((s, it) => s + it.price * it.qty, 0),
      status,
      paidAt,
      paidVia: "seed" as const,
      seeded: true,
      createdAt: paidAt,
      updatedAt: paidAt,
    });
  }
  await Order.insertMany(orders);
  console.log(`  ${orders.length} demo orders (flagged seeded: true)`);

  console.log("\nDone.");
  console.log(`  Customer  ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`);
  console.log(`  Admin     ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
