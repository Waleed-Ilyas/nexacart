import express, { Router } from "express";
import { z } from "zod";
import type { Config } from "../config";
import { AppError } from "../lib/errors";
import { cancelPending, markPaid } from "../lib/orders";
import { orderJson } from "../lib/serialize";
import { pickShipping, type Deps } from "../lib/services";
import { isObjectId } from "../lib/util";
import { requireAuth } from "../middleware/auth";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { User } from "../models/User";

const Body = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().refine(isObjectId, "Invalid product."),
        qty: z.number().int().min(1, "Quantity must be at least 1.").max(10, "You can buy up to 10 of one item."),
      }),
    )
    .min(1, "Your cart is empty.")
    .max(20, "Too many different items in one order."),
});

export function checkoutRouter(config: Config, deps: Deps) {
  const router = Router();
  const auth = requireAuth(config);

  // The browser sends only product ids and quantities. Names and prices are read from the database here,
  // so the total can never be changed from the client.
  router.post("/", auth, async (req, res) => {
    const { items } = Body.parse(req.body);
    const merged = new Map<string, number>();
    for (const i of items) merged.set(i.productId, Math.min(10, (merged.get(i.productId) ?? 0) + i.qty));

    const products = await Product.find({ _id: { $in: [...merged.keys()] } });
    if (products.length !== merged.size) throw new AppError(400, "Some items in your cart are no longer available.", "unavailable");
    const lines = products.map((p) => ({ p, qty: merged.get(String(p._id)) ?? 0 }));
    for (const { p, qty } of lines) {
      if (p.stock < qty) throw new AppError(409, p.stock === 0 ? `${p.name} is sold out.` : `Only ${p.stock} of ${p.name} left.`, "stock");
    }

    const user = await User.findById(req.auth!.id);
    if (!user) throw new AppError(401, "Please sign in to continue.", "unauthenticated");

    const orderItems = lines.map(({ p, qty }) => ({ product: p._id, name: p.name, price: p.price, qty, image: p.images[0]?.url ?? "" }));
    const total = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = await Order.create({ user: user._id, items: orderItems, total, status: "pending" });

    try {
      const session = await deps.payments.createCheckoutSession({
        orderId: String(order._id),
        items: orderItems.map((i) => ({ name: i.name, price: i.price, qty: i.qty, image: i.image })),
        customerEmail: user.email,
        successUrl: `${config.clientOrigin}/checkout/success?order=${order._id}`,
        cancelUrl: `${config.clientOrigin}/cart`,
      });
      order.stripeSessionId = session.id;
      await order.save();
      res.status(201).json({ url: session.url, orderId: String(order._id) });
    } catch (e) {
      await Order.deleteOne({ _id: order._id });
      throw e instanceof AppError ? e : new AppError(502, "Payments are unavailable right now. Please try again in a moment.");
    }
  });

  // Called by the success page. Webhooks can arrive a moment late, so this asks Stripe directly whether the session was paid.
  router.post("/confirm", auth, async (req, res) => {
    const { orderId } = z.object({ orderId: z.string().refine(isObjectId) }).parse(req.body);
    const order = await Order.findById(orderId);
    if (!order || String(order.user) !== req.auth!.id) throw new AppError(404, "Order not found.");
    if (order.status === "pending" && order.stripeSessionId) {
      const session = await deps.payments.retrieveSession(order.stripeSessionId);
      if (session.paid) return void res.json({ order: orderJson((await markPaid(orderId, "verify", session.shipping))!) });
    }
    res.json({ order: orderJson(order) });
  });

  return router;
}

/** Mounted before express.json(): Stripe signs the exact raw bytes, so the body must not be parsed first. */
export function webhookRouter(deps: Deps) {
  const router = Router();
  router.post("/stripe", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) throw new AppError(400, "Missing signature.");
    let event: ReturnType<typeof deps.payments.constructEvent>;
    try {
      event = deps.payments.constructEvent(req.body, signature);
    } catch {
      throw new AppError(400, "Invalid signature.");
    }
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId && isObjectId(orderId)) {
      if (event.type === "checkout.session.completed" && session.payment_status === "paid") await markPaid(orderId, "webhook", pickShipping(session as never));
      if (event.type === "checkout.session.expired") await cancelPending(orderId);
    }
    res.json({ received: true });
  });
  return router;
}
