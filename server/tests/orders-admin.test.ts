import { describe, expect, it } from "vitest";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/User";
import { api, bearer, makeProduct, signInAdmin, signUp, useTestApp } from "./helpers";

const t = useTestApp();

async function paidOrder(userId: string, over: Record<string, unknown> = {}, product?: { _id: unknown; name: string; price: number }, qty = 1) {
  const p = product ?? (await makeProduct({ price: 2500 }));
  return Order.create({
    user: userId,
    items: [{ product: p._id, name: p.name, price: p.price, qty, image: "" }],
    total: p.price * qty,
    status: "paid",
    paidAt: new Date(),
    paidVia: "webhook",
    ...over,
  });
}

describe("customer orders", () => {
  it("lists only my orders and hides unpaid checkout attempts", async () => {
    const me = await signUp(t.app, "me@example.com");
    const other = await signUp(t.app, "other@example.com");
    await paidOrder(me.user.id);
    await paidOrder(me.user.id, { status: "pending", paidAt: undefined });
    await paidOrder(other.user.id);
    const res = await api(t.app).get("/api/orders/mine").set(bearer(me.token));
    expect(res.body.orders).toHaveLength(1);
    expect((await api(t.app).get("/api/orders/mine")).status).toBe(401);
  });

  it("makes another customer's order look like it does not exist, but lets an admin read it", async () => {
    const me = await signUp(t.app, "me@example.com");
    const other = await signUp(t.app, "other@example.com");
    const order = await paidOrder(other.user.id);
    expect((await api(t.app).get(`/api/orders/${order._id}`).set(bearer(me.token))).status).toBe(404);
    expect((await api(t.app).get(`/api/orders/${order._id}`).set(bearer(other.token))).status).toBe(200);
    const admin = await signInAdmin(t.app);
    expect((await api(t.app).get(`/api/orders/${order._id}`).set(bearer(admin.token))).status).toBe(200);
    expect((await api(t.app).get("/api/orders/not-an-id").set(bearer(me.token))).status).toBe(404);
  });
});

describe("admin access control", () => {
  it("gives 401 without a token and 403 to a normal customer on every admin route", async () => {
    const me = await signUp(t.app);
    const routes: [string, string][] = [
      ["get", "/api/admin/stats"],
      ["get", "/api/admin/orders"],
      ["get", "/api/admin/products"],
      ["post", "/api/admin/products"],
      ["put", "/api/admin/products/x"],
      ["delete", "/api/admin/products/x"],
      ["post", "/api/admin/uploads"],
      ["patch", "/api/admin/orders/x"],
    ];
    for (const [method, url] of routes) {
      const anon = await (api(t.app) as never as Record<string, (u: string) => Promise<{ status: number }>>)[method]!(url);
      expect(anon.status, `${method} ${url} anonymous`).toBe(401);
      const user = await (api(t.app) as never as Record<string, (u: string) => { set: (h: object) => Promise<{ status: number }> }>)[method]!(url).set(
        bearer(me.token),
      );
      expect(user.status, `${method} ${url} customer`).toBe(403);
    }
  });

  it("does not trust a role claim that is not in the token signature", async () => {
    const me = await signUp(t.app);
    await User.updateOne({ _id: me.user.id }, { role: "admin" });
    // The old token still says "user", so promotion only takes effect at the next sign in.
    expect((await api(t.app).get("/api/admin/stats").set(bearer(me.token))).status).toBe(403);
  });
});

describe("admin dashboard", () => {
  it("summarises revenue, fills a 30 day series, ranks products and flags low stock", async () => {
    const admin = await signInAdmin(t.app);
    const buyer = await signUp(t.app, "buyer@example.com");
    const mug = await makeProduct({ name: "Mug", price: 2000, stock: 2 });
    const lamp = await makeProduct({ name: "Lamp", price: 5000, stock: 50 });
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    await paidOrder(buyer.user.id, { paidAt: daysAgo(0) }, mug, 3);
    await paidOrder(buyer.user.id, { paidAt: daysAgo(2) }, lamp, 1);
    await paidOrder(buyer.user.id, { paidAt: daysAgo(45), status: "delivered" }, lamp, 1); // outside the chart window, inside the totals
    await paidOrder(buyer.user.id, { status: "cancelled", paidAt: daysAgo(1) }, lamp, 9); // cancelled money never counts

    const res = await api(t.app).get("/api/admin/stats").set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ revenue: 6000 + 5000 + 5000, orders: 3, averageOrder: Math.round(16000 / 3), customers: 1 });
    expect(res.body.series).toHaveLength(30);
    expect(res.body.series.reduce((s: number, d: { revenue: number }) => s + d.revenue, 0)).toBe(11000);
    expect(res.body.series.every((d: { date: string }) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
    expect(res.body.topProducts[0]).toMatchObject({ name: "Mug", units: 3, revenue: 6000 });
    expect(res.body.lowStock.map((p: { name: string }) => p.name)).toEqual(["Mug"]);
  });

  it("works on an empty store", async () => {
    const admin = await signInAdmin(t.app);
    const res = await api(t.app).get("/api/admin/stats").set(bearer(admin.token));
    expect(res.body.totals).toEqual({ revenue: 0, orders: 0, averageOrder: 0, customers: 0 });
    expect(res.body.series).toHaveLength(30);
  });
});

describe("admin orders", () => {
  it("lists paid orders with the customer and filters by status", async () => {
    const admin = await signInAdmin(t.app);
    const buyer = await signUp(t.app, "buyer@example.com", "Buyer");
    await paidOrder(buyer.user.id);
    await paidOrder(buyer.user.id, { status: "shipped" });
    await paidOrder(buyer.user.id, { status: "pending" });
    const all = await api(t.app).get("/api/admin/orders").set(bearer(admin.token));
    expect(all.body.total).toBe(2); // pending checkouts are hidden by default
    expect(all.body.orders[0].customer).toEqual({ name: "Buyer", email: "buyer@example.com" });
    const shipped = await api(t.app).get("/api/admin/orders?status=shipped").set(bearer(admin.token));
    expect(shipped.body.total).toBe(1);
  });

  it("follows the allowed status flow and rejects the rest", async () => {
    const admin = await signInAdmin(t.app);
    const buyer = await signUp(t.app, "buyer@example.com");
    const order = await paidOrder(buyer.user.id);
    const patch = (status: string) => api(t.app).patch(`/api/admin/orders/${order._id}`).set(bearer(admin.token)).send({ status });
    expect((await patch("delivered")).status).toBe(409); // cannot skip shipping
    expect((await patch("shipped")).body.order.status).toBe("shipped");
    expect((await patch("cancelled")).status).toBe(409); // shipped orders cannot be cancelled
    expect((await patch("delivered")).body.order.status).toBe("delivered");
    expect((await patch("shipped")).status).toBe(409);
    expect((await patch("paid")).status).toBe(400); // not a status admins can set
  });

  it("puts items back in stock when a paid order is cancelled", async () => {
    const admin = await signInAdmin(t.app);
    const buyer = await signUp(t.app, "buyer@example.com");
    const p = await makeProduct({ stock: 1, price: 900 });
    const order = await paidOrder(buyer.user.id, {}, p, 4);
    await api(t.app).patch(`/api/admin/orders/${order._id}`).set(bearer(admin.token)).send({ status: "cancelled" });
    expect((await Product.findById(p._id))!.stock).toBe(5);
  });
});

describe("admin products", () => {
  const body = {
    name: "Ceramic Mug",
    description: "A stoneware mug for daily coffee.",
    price: 1800,
    category: "Home",
    stock: 10,
    featured: false,
    images: [{ url: "https://images.test/a.png", publicId: "a" }],
  };

  it("creates, edits and deletes a product, with unique slugs", async () => {
    const admin = await signInAdmin(t.app);
    const h = bearer(admin.token);
    const created = await api(t.app).post("/api/admin/products").set(h).send(body);
    expect(created.status).toBe(201);
    expect(created.body.product.slug).toBe("ceramic-mug");
    const twin = await api(t.app).post("/api/admin/products").set(h).send(body);
    expect(twin.body.product.slug).toBe("ceramic-mug-2");

    const id = created.body.product.id;
    const edited = await api(t.app)
      .put(`/api/admin/products/${id}`)
      .set(h)
      .send({ ...body, name: "Large Ceramic Mug", price: 2100 });
    expect(edited.body.product).toMatchObject({ name: "Large Ceramic Mug", slug: "large-ceramic-mug", price: 2100 });

    expect((await api(t.app).delete(`/api/admin/products/${id}`).set(h)).status).toBe(200);
    expect(t.images.removed).toEqual(["a"]);
    expect((await api(t.app).delete(`/api/admin/products/${id}`).set(h)).status).toBe(404);
  });

  it("validates input, including prices that are not whole cents", async () => {
    const admin = await signInAdmin(t.app);
    const h = bearer(admin.token);
    for (const bad of [
      { price: 19.99 },
      { price: 0 },
      { price: -5 },
      { stock: -1 },
      { category: "Toys" },
      { name: "" },
      { images: [{ url: "http://insecure.test/a.png" }] },
      { description: "short" },
    ]) {
      const res = await api(t.app)
        .post("/api/admin/products")
        .set(h)
        .send({ ...body, ...bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(await Product.countDocuments()).toBe(0);
  });

  it("uploads an image through the image store and rejects other file types", async () => {
    const admin = await signInAdmin(t.app);
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const ok = await api(t.app).post("/api/admin/uploads").set(bearer(admin.token)).attach("image", png, { filename: "a.png", contentType: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ url: "https://images.test/p1.png", publicId: "nexacart/products/p1" });
    const bad = await api(t.app)
      .post("/api/admin/uploads")
      .set(bearer(admin.token))
      .attach("image", Buffer.from("<svg/>"), { filename: "a.svg", contentType: "image/svg+xml" });
    expect(bad.status).toBe(400);
    expect(t.images.uploaded).toHaveLength(1);
  });
});
