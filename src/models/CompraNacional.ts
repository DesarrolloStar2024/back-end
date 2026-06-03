import mongoose, { Schema, Document } from "mongoose";

export const COMPRA_ESTADOS = [
  "solicitado",
  "pedido",
  "entregado",
  "cancelado",
] as const;
export type CompraEstado = (typeof COMPRA_ESTADOS)[number];

export interface CompraItem {
  codigo: string;
  referencia: string;
  descripcion: string;
  fabricante: string;
  marca: string;
  observacion: string;
  cantidad: number;
  precioUnd: number;
  precioTotal: number;
}

export interface CompraNacional extends Document {
  code: string;
  channelId?: string;
  createdBy?: { code?: string; name?: string };
  observations?: string;
  status: CompraEstado;
  items: CompraItem[];
  total: number;
  statusHistory: { status: CompraEstado; at: Date; by?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<CompraItem>(
  {
    codigo: { type: String, default: "" },
    referencia: { type: String, default: "" },
    descripcion: { type: String, default: "" },
    fabricante: { type: String, default: "" },
    marca: { type: String, default: "" },
    observacion: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    precioUnd: { type: Number, default: 0 },
    precioTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const CompraNacionalSchema = new Schema<CompraNacional>(
  {
    code: { type: String, required: true, unique: true },
    channelId: { type: String, default: "" },
    createdBy: {
      code: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    observations: { type: String, default: "" },
    status: { type: String, enum: COMPRA_ESTADOS, default: "solicitado" },
    items: { type: [ItemSchema], default: [] },
    total: { type: Number, default: 0 },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, enum: COMPRA_ESTADOS },
            at: { type: Date, default: Date.now },
            by: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

CompraNacionalSchema.index({ createdAt: -1 });
CompraNacionalSchema.index({ status: 1 });
CompraNacionalSchema.index({ channelId: 1 });

export const CompraNacionalModel =
  mongoose.models.CompraNacional ||
  mongoose.model<CompraNacional>("CompraNacional", CompraNacionalSchema);
