import mongoose, { Schema, type Model } from "mongoose";

export interface CouponListDiscount {
  listSlug: string; // slug del listado de precios (ej. "6" = PVP)
  discountPercentage: number; // 0.10 = 10% (0..1)
}

export interface Coupon {
  code: string; // en MAYÚSCULAS
  // Descuento por listado de precios. El % aplicado depende de la lista del usuario.
  discountsByList: CouponListDiscount[];
  // Legado: % único anterior (se mantiene por compatibilidad, no se usa para aplicar)
  discountPercentage?: number;
  isActive: boolean;
  channelIds: string[]; // IDs de canal donde aplica (explícito). Vacío = no aplica a ningún canal
  createdAt: Date;
  updatedAt: Date;
}

const ListDiscountSchema = new Schema<CouponListDiscount>(
  {
    listSlug: { type: String, required: true, trim: true },
    discountPercentage: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

const CouponSchema = new Schema<Coupon>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    discountsByList: { type: [ListDiscountSchema], default: [] },
    discountPercentage: { type: Number, min: 0, max: 1 },
    isActive: { type: Boolean, default: false },
    channelIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Normaliza siempre a MAYÚSCULAS
CouponSchema.pre("save", function (next) {
  if (this.code) this.code = String(this.code).toUpperCase().trim();
  next();
});

// 👇 clave: casteo de mongoose.models para conservar el tipo
export const CouponModel: Model<Coupon> =
  (mongoose.models.Coupon as Model<Coupon>) ||
  mongoose.model<Coupon>("Coupon", CouponSchema);
