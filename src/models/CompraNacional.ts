import mongoose, { Schema, Document } from "mongoose";

export const COMPRA_ESTADOS = [
  "solicitado",
  "pedido",
  "entregado",
  "cancelado",
] as const;
export type CompraEstado = (typeof COMPRA_ESTADOS)[number];

/**
 * A partir del refactor, cada documento representa UN PRODUCTO pedido
 * (no una compra con varios items). Cada producto tiene su propio estado.
 */
export interface CompraNacional extends Document {
  code: string;
  codigo: string;
  referencia: string;
  descripcion: string;
  fabricante: string;
  marca: string;
  observacion: string;
  cantidad: number;
  precioUnd: number;
  precioTotal: number;
  channelId?: string;
  createdBy?: { code?: string; name?: string };
  status: CompraEstado;
  statusHistory: { status: CompraEstado; at: Date; by?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const CompraNacionalSchema = new Schema<CompraNacional>(
  {
    code: { type: String, required: true, unique: true },
    codigo: { type: String, default: "" },
    referencia: { type: String, default: "" },
    descripcion: { type: String, default: "" },
    fabricante: { type: String, default: "" },
    marca: { type: String, default: "" },
    observacion: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    precioUnd: { type: Number, default: 0 },
    precioTotal: { type: Number, default: 0 },
    channelId: { type: String, default: "" },
    createdBy: {
      code: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    status: { type: String, enum: COMPRA_ESTADOS, default: "solicitado" },
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
CompraNacionalSchema.index({ marca: 1 });
CompraNacionalSchema.index({ fabricante: 1 });

export const CompraNacionalModel =
  mongoose.models.CompraNacional ||
  mongoose.model<CompraNacional>("CompraNacional", CompraNacionalSchema);
