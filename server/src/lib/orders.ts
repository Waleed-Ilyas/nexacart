import { Order } from "../models/Order";
import { Product } from "../models/Product";
import type { ShippingDetails } from "./services";

/**
 * Moves an order from pending to paid exactly once. Both the Stripe webhook and the success page call this,
 * and whichever arrives second finds the order already paid and changes nothing, so stock is never taken twice.
 */
export async function markPaid(orderId: string, via: "webhook" | "verify", shipping?: ShippingDetails) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending" },
    { $set: { status: "paid", paidAt: new Date(), paidVia: via, ...(shipping ? { shipping } : {}) } },
    { returnDocument: "after" },
  );
  if (!order) return Order.findById(orderId);
  // Stock never goes below zero, even if two shoppers bought the last unit at the same moment.
  await Product.bulkWrite(
    order.items.map((i) => ({
      updateOne: { filter: { _id: i.product }, update: [{ $set: { stock: { $max: [0, { $subtract: ["$stock", i.qty] }] } } }], updatePipeline: true },
    })),
  );
  return order;
}

export async function cancelPending(orderId: string) {
  return Order.findOneAndUpdate({ _id: orderId, status: "pending" }, { $set: { status: "cancelled" } }, { returnDocument: "after" });
}

/** Cancelling an order that was already paid puts its items back on the shelf. Refunds stay a manual step in Stripe. */
export async function restock(items: { product: unknown; qty: number }[]) {
  await Product.bulkWrite(items.map((i) => ({ updateOne: { filter: { _id: i.product as never }, update: { $inc: { stock: i.qty } } } })));
}
