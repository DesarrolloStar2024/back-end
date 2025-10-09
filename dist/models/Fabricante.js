import mongoose, { Schema, Document } from "mongoose";
const FabricanteSchema = new Schema({
    Id: { type: String, required: true, unique: true, trim: true }, // índice ya creado
    Nombre: { type: String, required: true, trim: true },
}, { timestamps: true });
// Índices adicionales
FabricanteSchema.index({ Nombre: 1 });
export const Fabricante = mongoose.models.Fabricante ||
    mongoose.model("Fabricante", FabricanteSchema);
