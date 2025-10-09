import mongoose, { Schema, Document } from "mongoose";
const SuperAdminSchema = new Schema({
    Id: { type: String, required: true, unique: true, trim: true }, // índice ya creado
    Codigo: { type: String, required: true, trim: true },
}, { timestamps: true });
// Índices adicionales
SuperAdminSchema.index({ Codigo: 1 });
export const SuperAdmin = mongoose.models.SuperAdmin ||
    mongoose.model("SuperAdmin", SuperAdminSchema);
