import mongoose, { Schema, Document } from "mongoose";
const FabricanteSchema = new Schema({
    Id: { type: String, required: true, unique: true, trim: true },
    Nombre: { type: String, required: true, trim: true },
}, { timestamps: true });
// Índices
FabricanteSchema.index({ Id: 1 }, { unique: true });
FabricanteSchema.index({ Nombre: 1 });
export const Fabricante = mongoose.model("Fabricante", FabricanteSchema);
