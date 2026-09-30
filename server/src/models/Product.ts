import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const CATEGORIES = ["Home", "Tech", "Outdoor", "Apparel"] as const;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: 2000 },
    /** Integer cents. Never floats, so totals are exact. */
    price: { type: Number, required: true, min: 1, validate: Number.isInteger },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    images: { type: [{ url: { type: String, required: true }, publicId: { type: String, default: "" }, _id: false }], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    featured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
productSchema.index({ price: 1 });
productSchema.index({ name: "text", description: "text" });

export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: mongoose.Types.ObjectId };
export const Product = (mongoose.models.Product as mongoose.Model<InferSchemaType<typeof productSchema>>) || mongoose.model("Product", productSchema);
