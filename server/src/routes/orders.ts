import { Router } from "express";
import type { Config } from "../config";
import { AppError } from "../lib/errors";
import { orderJson } from "../lib/serialize";
import { isObjectId } from "../lib/util";
import { requireAuth } from "../middleware/auth";
import { Order } from "../models/Order";

export function ordersRouter(config: Config) {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/mine", async (req, res) => {
    // Pending orders are unpaid checkout attempts, so they stay out of the customer's history.
    const orders = await Order.find({ user: req.auth!.id, status: { $ne: "pending" } })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ orders: orders.map(orderJson) });
  });

  router.get("/:id", async (req, res) => {
    const id = String(req.params.id);
    if (!isObjectId(id)) throw new AppError(404, "Order not found.");
    const order = await Order.findById(id);
    // Someone else's order looks exactly like a missing one, so ids cannot be probed.
    if (!order || (String(order.user) !== req.auth!.id && req.auth!.role !== "admin")) throw new AppError(404, "Order not found.");
    res.json({ order: orderJson(order) });
  });

  return router;
}
