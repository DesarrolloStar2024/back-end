import mongoose, { Schema, Document } from "mongoose";
const SuperAdminSchema = new Schema({
    Id: { type: String, required: true, unique: true, trim: true },
    Codigo: { type: String, required: true, trim: true },
}, { timestamps: true });
// Índices
SuperAdminSchema.index({ Id: 1 }, { unique: true });
SuperAdminSchema.index({ Codigo: 1 });
export const SuperAdmin = mongoose.model("SuperAdmin", SuperAdminSchema);
