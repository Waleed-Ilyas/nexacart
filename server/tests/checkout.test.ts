import { describe, expect, it } from "vitest";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { api, bearer, makeProduct, signUp, useTestApp } from "./helpers";

const t = useTestApp();

const checkout = (token: string, items: unknown) => api(t.app).post("/api/checkout").set(bearer(token)).send({ items });
const webhook = (event: unknown, signature = "valid-signature") =>
  api(t.app).post("/api/webhooks/stripe").set("stripe-signature", signature).set("content-type", "application/json").send(JSON.stringify(event));
const completed = (orderId: string, sessionId = "cs_test_1") => ({
  type: "checkout.session.completed",
  data: { object: { id: sessionId, payment_status: "paid", metadata: { orderId } } },
});

describe("POST /api/checkout", () => {
  it("requires sign in", async () => {
    const p = await makeProduct();
    expect(
      (
        await api(t.app)
          .post("/api/checkout")
          .send({ items: [{ productId: String(p._id), qty: 1 }] })
      ).status,
    ).toBe(401);
  });

  it("prices the order from the database and ignores any price the browser sends", async () => {
    const { token } = await signUp(t.app);
    const a = await makeProduct({ price: 1999 });
    const b = await makeProduct({ price: 500 });
    const res = await checkout(token, [
      { productId: String(a._id), qty: 2, price: 1 },
      { productId: String(b._id), qty: 3, price: 1 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^https:\/\/checkout\.test\//);
    const order = await Order.findById(res.body.orderId);
    expect(order!.total).toBe(1999 * 2 + 500 * 3);
    expect(order!.status).toBe("pending");
    const sent = [...t.payments.sessions.values()][0]!;
    expect(sent.items.map((i) => i.price).sort((a, b) => a - b)).toEqual([500, 1999]);
    expect(order!.stripeSessionId).toBe("cs_test_1");
  });

  it("merges repeated products into one line", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct({ price: 700 });
    const res = await checkout(token, [
      { productId: String(p._id), qty: 2 },
      { productId: String(p._id), qty: 3 },
    ]);
    const order = await Order.findById(res.body.orderId);
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0]!.qty).toBe(5);
  });

  it("refuses quantities above the stock, and sold-out items", async () => {
    const { token } = await signUp(t.app);
    const low = await makeProduct({ name: "Low", stock: 2 });
    const none = await makeProduct({ name: "None", stock: 0 });
    const over = await checkout(token, [{ productId: String(low._id), qty: 3 }]);
    expect(over.status).toBe(409);
    expect(over.body.error).toBe("Only 2 of Low left.");
    const soldOut = await checkout(token, [{ productId: String(none._id), qty: 1 }]);
    expect(soldOut.status).toBe(409);
    expect(soldOut.body.error).toBe("None is sold out.");
    expect(await Order.countDocuments()).toBe(0);
  });

  it("rejects unknown products, an empty cart and bad quantities", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct();
    expect((await checkout(token, [{ productId: "64b7f0f0f0f0f0f0f0f0f0f0", qty: 1 }])).status).toBe(400);
    expect((await checkout(token, [])).status).toBe(400);
    expect((await checkout(token, [{ productId: String(p._id), qty: 0 }])).status).toBe(400);
    expect((await checkout(token, [{ productId: String(p._id), qty: 11 }])).status).toBe(400);
    expect((await checkout(token, [{ productId: String(p._id), qty: 1.5 }])).status).toBe(400);
    expect((await checkout(token, [{ productId: { $ne: null }, qty: 1 }])).status).toBe(400);
  });

  it("leaves no pending order behind when the payment provider fails", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct();
    t.payments.fail = true;
    const res = await checkout(token, [{ productId: String(p._id), qty: 1 }]);
    expect(res.status).toBe(502);
    expect(await Order.countDocuments()).toBe(0);
  });
});

describe("confirming a payment from the success page", () => {
  it("marks the order paid, saves the shipping address and takes stock, once", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct({ stock: 5, price: 1000 });
    const { body } = await checkout(token, [{ productId: String(p._id), qty: 2 }]);
    t.payments.pay("cs_test_1", { name: "Ada", line1: "1 Main St", city: "Lahore", country: "PK" });

    const first = await api(t.app).post("/api/checkout/confirm").set(bearer(token)).send({ orderId: body.orderId });
    expect(first.body.order).toMatchObject({ status: "paid", paidVia: "verify", total: 2000 });
    expect(first.body.order.shipping).toMatchObject({ name: "Ada", city: "Lahore" });
    expect((await Product.findById(p._id))!.stock).toBe(3);

    await api(t.app).post("/api/checkout/confirm").set(bearer(token)).send({ orderId: body.orderId });
    expect((await Product.findById(p._id))!.stock).toBe(3); // a second confirmation must not take stock again
  });

  it("stays pending while Stripe reports the session as unpaid", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct();
    const { body } = await checkout(token, [{ productId: String(p._id), qty: 1 }]);
    const res = await api(t.app).post("/api/checkout/confirm").set(bearer(token)).send({ orderId: body.orderId });
    expect(res.body.order.status).toBe("pending");
  });

  it("does not let someone confirm another customer's order", async () => {
    const owner = await signUp(t.app, "owner@example.com");
    const other = await signUp(t.app, "other@example.com");
    const p = await makeProduct();
    const { body } = await checkout(owner.token, [{ productId: String(p._id), qty: 1 }]);
    expect((await api(t.app).post("/api/checkout/confirm").set(bearer(other.token)).send({ orderId: body.orderId })).status).toBe(404);
  });
});

describe("Stripe webhook", () => {
  it("rejects a missing or invalid signature and changes nothing", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct();
    const { body } = await checkout(token, [{ productId: String(p._id), qty: 1 }]);
    expect((await webhook(completed(body.orderId), "forged")).status).toBe(400);
    expect((await api(t.app).post("/api/webhooks/stripe").set("content-type", "application/json").send("{}")).status).toBe(400);
    expect((await Order.findById(body.orderId))!.status).toBe("pending");
  });

  it("marks the order paid through the webhook and is safe to deliver twice", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct({ stock: 4 });
    const { body } = await checkout(token, [{ productId: String(p._id), qty: 3 }]);
    expect((await webhook(completed(body.orderId))).status).toBe(200);
    expect((await webhook(completed(body.orderId))).status).toBe(200);
    const order = await Order.findById(body.orderId);
    expect(order).toMatchObject({ status: "paid", paidVia: "webhook" });
    expect((await Product.findById(p._id))!.stock).toBe(1);
  });

  it("never takes stock below zero when two orders race for the last units", async () => {
    const a = await signUp(t.app, "a@example.com");
    const b = await signUp(t.app, "b@example.com");
    const p = await makeProduct({ stock: 3 });
    const first = await checkout(a.token, [{ productId: String(p._id), qty: 3 }]);
    const second = await checkout(b.token, [{ productId: String(p._id), qty: 3 }]);
    await webhook(completed(first.body.orderId, "cs_test_1"));
    await webhook(completed(second.body.orderId, "cs_test_2"));
    expect((await Product.findById(p._id))!.stock).toBe(0);
  });

  it("cancels a pending order when the session expires, and ignores unrelated events", async () => {
    const { token } = await signUp(t.app);
    const p = await makeProduct();
    const { body } = await checkout(token, [{ productId: String(p._id), qty: 1 }]);
    expect((await webhook({ type: "customer.created", data: { object: { id: "x", metadata: { orderId: body.orderId } } } })).status).toBe(200);
    expect((await Order.findById(body.orderId))!.status).toBe("pending");
    await webhook({ type: "checkout.session.expired", data: { object: { id: "cs_test_1", metadata: { orderId: body.orderId } } } });
    expect((await Order.findById(body.orderId))!.status).toBe("cancelled");
  });
});
