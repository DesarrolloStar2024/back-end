import mongoose, { Schema, Document } from "mongoose";

export interface ISuperAdmin extends Document {
  Id: string; // identificador (único)
  Codigo: string; // código asociado
  createdAt?: Date;
  updatedAt?: Date;
}

const SuperAdminSchema = new Schema<ISuperAdmin>(
  {
    Id: { type: String, required: true, trim: true }, // índice ya creado
    Codigo: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Índices adicionales
SuperAdminSchema.index({ Codigo: 1 });

export const SuperAdmin =
  mongoose.models.SuperAdmin ||
  mongoose.model<ISuperAdmin>("SuperAdmin", SuperAdminSchema);
