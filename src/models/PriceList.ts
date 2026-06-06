import mongoose, { Schema, Document } from "mongoose";

export interface ITier {
  priceField: string; // nombre en product.Precios: "PVP", "UNIDAD", "DISTRIBUIDOR"…
  label?: string; // etiqueta visual de la escala (ej. "6", "caja x6"); vacío = "{cant} {Unidad}"
}

export interface IPriceList extends Document {
  name: string;
  slug: string;
  description?: string;
  tiers: ITier[];
  isActive: boolean;
  isDefault: boolean;
  order: number;
  beforePriceField?: string | null;
  channelIds: string[]; // IDs de canal donde aplica (explícito). Vacío = no aplica a ningún canal
  createdAt?: Date;
}

const TierSchema = new Schema<ITier>(
  {
    priceField: { type: String, required: true },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const PriceListSchema = new Schema<IPriceList>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    tiers: { type: [TierSchema], default: [] },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    beforePriceField: { type: String, default: null },
    channelIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const PriceList =
  mongoose.models.PriceList ||
  mongoose.model<IPriceList>("PriceList", PriceListSchema);
