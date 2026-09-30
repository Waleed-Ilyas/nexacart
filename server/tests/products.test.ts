import { describe, expect, it } from "vitest";
import { api, makeProduct, useTestApp } from "./helpers";

const t = useTestApp();

async function seed() {
  await makeProduct({
    name: "Ceramic Mug",
    slug: "ceramic-mug",
    category: "Home",
    price: 1800,
    description: "A stoneware mug (12 oz) for coffee.",
    featured: true,
    createdAt: new Date("2026-01-01"),
  });
  await makeProduct({
    name: "Desk Lamp",
    slug: "desk-lamp",
    category: "Home",
    price: 5400,
    description: "Warm light for the desk.",
    createdAt: new Date("2026-01-02"),
  });
  await makeProduct({
    name: "Studio Headphones",
    slug: "studio-headphones",
    category: "Tech",
    price: 12900,
    description: "Closed back, 40mm drivers.",
    featured: true,
    createdAt: new Date("2026-01-03"),
  });
  await makeProduct({
    name: "Trail Backpack",
    slug: "trail-backpack",
    category: "Outdoor",
    price: 8900,
    description: "24 litre daypack.",
    createdAt: new Date("2026-01-04"),
  });
}

describe("GET /api/products", () => {
  it("lists newest first with paging info", async () => {
    await seed();
    const res = await api(t.app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.items.map((p: { slug: string }) => p.slug)).toEqual(["trail-backpack", "studio-headphones", "desk-lamp", "ceramic-mug"]);
    expect(res.body).toMatchObject({ total: 4, page: 1, pages: 1 });
    expect(res.body.items[0].price).toBe(8900);
    expect(res.body.items[0].images[0].publicId).toBeUndefined(); // storefront never sees storage ids
  });

  it("filters by category, price range and search text", async () => {
    await seed();
    const home = await api(t.app).get("/api/products?category=Home");
    expect(home.body.total).toBe(2);
    const range = await api(t.app).get("/api/products?minPrice=5000&maxPrice=9000");
    expect(range.body.items.map((p: { slug: string }) => p.slug).sort()).toEqual(["desk-lamp", "trail-backpack"]);
    const q = await api(t.app).get("/api/products?q=MUG");
    expect(q.body.items.map((p: { slug: string }) => p.slug)).toEqual(["ceramic-mug"]);
    const inDescription = await api(t.app).get("/api/products?q=daypack");
    expect(inDescription.body.total).toBe(1);
    expect((await api(t.app).get("/api/products?featured=true")).body.total).toBe(2);
  });

  it("sorts by price and name", async () => {
    await seed();
    const asc = await api(t.app).get("/api/products?sort=price-asc");
    expect(asc.body.items.map((p: { price: number }) => p.price)).toEqual([1800, 5400, 8900, 12900]);
    const desc = await api(t.app).get("/api/products?sort=price-desc");
    expect(desc.body.items[0].price).toBe(12900);
    const name = await api(t.app).get("/api/products?sort=name");
    expect(name.body.items[0].name).toBe("Ceramic Mug");
  });

  it("paginates", async () => {
    await seed();
    const p1 = await api(t.app).get("/api/products?limit=3&page=1&sort=price-asc");
    const p2 = await api(t.app).get("/api/products?limit=3&page=2&sort=price-asc");
    expect(p1.body.items).toHaveLength(3);
    expect(p2.body.items).toHaveLength(1);
    expect(p1.body.pages).toBe(2);
  });

  it("treats regex characters in search as plain text and never crashes", async () => {
    await seed();
    for (const q of ["(", "[", ".*", "\\", "mug)(", "$"]) {
      const res = await api(t.app).get("/api/products").query({ q });
      expect(res.status).toBe(200);
    }
    expect((await api(t.app).get("/api/products").query({ q: ".*" })).body.total).toBe(0);
  });

  it("rejects bad query values instead of ignoring them", async () => {
    expect((await api(t.app).get("/api/products?limit=1000")).status).toBe(400);
    expect((await api(t.app).get("/api/products?category=Nope")).status).toBe(400);
    expect((await api(t.app).get("/api/products?sort=random")).status).toBe(400);
    expect((await api(t.app).get("/api/products?minPrice=-5")).status).toBe(400);
  });
});

describe("meta and detail", () => {
  it("returns category counts and the price range", async () => {
    await seed();
    const res = await api(t.app).get("/api/products/meta");
    expect(res.body.categories).toEqual([
      { name: "Home", count: 2 },
      { name: "Outdoor", count: 1 },
      { name: "Tech", count: 1 },
    ]);
    expect(res.body.priceRange).toEqual({ min: 1800, max: 12900 });
  });

  it("handles an empty catalogue", async () => {
    const res = await api(t.app).get("/api/products/meta");
    expect(res.body.priceRange).toEqual({ min: 0, max: 0 });
    expect((await api(t.app).get("/api/products")).body.items).toEqual([]);
  });

  it("returns one product by slug and 404 for an unknown slug", async () => {
    await seed();
    expect((await api(t.app).get("/api/products/desk-lamp")).body.product.name).toBe("Desk Lamp");
    expect((await api(t.app).get("/api/products/nope")).status).toBe(404);
  });
});
