import mongoose, { Schema, Document } from "mongoose";

export interface QuoteItem {
  barcode?: string;
  reference: string;
  images?: string[];
  brand?: string;
  descriptionEs?: string;
  material?: string;
  colors?: string;
  measure?: string;
  itemNote?: string;

  ctns: number;
  qtyPerCarton: number;
  totalQty: number;

  unit?: string;
  unitPriceUSD: number;
  sumUSD: number;

  dimensionsCm: { alto: number; ancho: number; largo: number };
  cbm: number;
  totalCbm: number;
}

export interface Quote extends Document {
  code?: string;
  supplier: { name: string; phone?: string };
  vigenciaDays?: number;
  incoterm?: string;
  observations?: string;
  items: QuoteItem[];
  createdAt: Date;
}

const ItemSchema = new Schema<QuoteItem>(
  {
    barcode: { type: String, default: "" },
    reference: { type: String, required: true },
    images: [{ type: String }],
    brand: { type: String, default: "" },
    descriptionEs: { type: String, default: "" },
    material: { type: String, default: "" },
    colors: { type: String, default: "" },
    measure: { type: String, default: "" },
    itemNote: { type: String, default: "" },

    ctns: { type: Number, required: true, default: 0 },
    qtyPerCarton: { type: Number, required: true, default: 0 },
    totalQty: { type: Number, required: true, default: 0 },

    unit: { type: String, default: "Unidad" },
    unitPriceUSD: { type: Number, required: true, default: 0 },
    sumUSD: { type: Number, required: true, default: 0 },

    dimensionsCm: {
      alto: { type: Number, required: true, default: 0 },
      ancho: { type: Number, required: true, default: 0 },
      largo: { type: Number, required: true, default: 0 },
    },
    cbm: { type: Number, required: true, default: 0 },
    totalCbm: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const QuoteSchema = new Schema<Quote>(
  {
    code: { type: String },
    supplier: {
      name: { type: String, required: true },
      phone: { type: String, default: "" },
    },
    vigenciaDays: { type: Number },
    incoterm: { type: String, default: "FOB" },
    observations: { type: String, default: "" },
    items: { type: [ItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

QuoteSchema.index({ createdAt: -1 });
QuoteSchema.index({ code: 1 });
QuoteSchema.index({ "supplier.name": 1 });
QuoteSchema.index({ "items.reference": 1 });

export const QuoteModel =
  mongoose.models.Quote || mongoose.model<Quote>("Quote", QuoteSchema);
