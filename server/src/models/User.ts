import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Only a SHA-256 of each refresh token is stored, so a database leak does not leak usable sessions.
    refreshTokens: {
      type: [{ hash: { type: String, required: true }, expiresAt: { type: Date, required: true }, _id: false }],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = (mongoose.models.User as mongoose.Model<InferSchemaType<typeof userSchema>>) || mongoose.model("User", userSchema);
