import mongoose, { Schema, Document } from "mongoose";
const SynonymSchema = new Schema({
    term: { type: String, required: true, unique: true }, // ya crea el índice único
    synonyms: { type: [String], default: [] },
});
// ❌ Eliminamos el índice duplicado (ya lo genera `unique: true`)
export const Synonym = mongoose.models.Synonym || mongoose.model("Synonym", SynonymSchema);
