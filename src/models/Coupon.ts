import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string; // en MAYÚSCULAS
  discountPercentage: number; // 0.10 = 10%
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    discountPercentage: { type: Number, required: true, min: 0, max: 1 },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Normaliza siempre a MAYÚSCULAS
CouponSchema.pre("save", function (next) {
  if (this.code) this.code = String(this.code).toUpperCase().trim();
  next();
});

export const Coupon =
  mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema);
