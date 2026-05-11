import mongoose, { Schema, Document } from "mongoose";
const SuperAdminSchema = new Schema({
    Id: { type: String, required: true, trim: true, index: true }, // sin unique
    Codigo: { type: String, required: true, trim: true, unique: true }, // único
}, { timestamps: true });
// Índices adicionales (opcional: ya hay unique sobre Codigo; dejamos índice normal en Id)
SuperAdminSchema.index({ Id: 1 });
export const SuperAdmin = mongoose.models.SuperAdmin ||
    mongoose.model("SuperAdmin", SuperAdminSchema);
