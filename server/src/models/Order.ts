import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // Name, price and image are copied at purchase time so an order never changes when the product is edited later.
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], required: true },
    /** Integer cents, the sum of price * qty computed on the server. */
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    stripeSessionId: { type: String, index: true, sparse: true },
    paidAt: { type: Date },
    /** Which path confirmed the payment, so the webhook can be told apart from the success-page check. */
    paidVia: { type: String, enum: ["webhook", "verify", "seed"] },
    shipping: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    seeded: { type: Boolean, default: false },
  },
  { timestamps: true },
);
orderSchema.index({ createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema> & { _id: mongoose.Types.ObjectId };
export const Order = (mongoose.models.Order as mongoose.Model<InferSchemaType<typeof orderSchema>>) || mongoose.model("Order", orderSchema);
