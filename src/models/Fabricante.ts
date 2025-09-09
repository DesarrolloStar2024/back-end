import mongoose, { Schema, Document } from "mongoose";

export interface IFabricante extends Document {
  Id: string; // código de fabricante (único)
  Nombre: string; // nombre legible
  createdAt?: Date;
  updatedAt?: Date;
}

const FabricanteSchema = new Schema<IFabricante>(
  {
    Id: { type: String, required: true, unique: true, trim: true },
    Nombre: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Índices
FabricanteSchema.index({ Id: 1 }, { unique: true });
FabricanteSchema.index({ Nombre: 1 });

export const Fabricante = mongoose.model<IFabricante>(
  "Fabricante",
  FabricanteSchema
);
