import mongoose, { Schema, Document } from "mongoose";

export interface ISuperAdmin extends Document {
  Id: string; // identificador (NO único)
  Codigo: string; // ahora es la clave única
  createdAt?: Date;
  updatedAt?: Date;
}

const SuperAdminSchema = new Schema<ISuperAdmin>(
  {
    Id: { type: String, required: true, trim: true, index: true }, // sin unique
    Codigo: { type: String, required: true, trim: true, unique: true }, // único
  },
  { timestamps: true }
);

// Índices adicionales (opcional: ya hay unique sobre Codigo; dejamos índice normal en Id)
SuperAdminSchema.index({ Id: 1 });

export const SuperAdmin =
  mongoose.models.SuperAdmin ||
  mongoose.model<ISuperAdmin>("SuperAdmin", SuperAdminSchema);
