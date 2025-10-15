import mongoose, { Schema, Document } from "mongoose";

export interface ISuperAdmin extends Document {
  Id: string; // identificador (puede repetirse)
  Codigo: string; // código asociado (único)
  createdAt?: Date;
  updatedAt?: Date;
}

const SuperAdminSchema = new Schema<ISuperAdmin>(
  {
    Id: { type: String, required: true, trim: true }, // NO es único
    Codigo: { type: String, required: true, trim: true, unique: true }, // ÚNICO
  },
  { timestamps: true }
);

// Índice único para Codigo
SuperAdminSchema.index({ Codigo: 1 }, { unique: true });

export const SuperAdmin =
  mongoose.models.SuperAdmin ||
  mongoose.model<ISuperAdmin>("SuperAdmin", SuperAdminSchema);
