// models/Synonym.ts
import mongoose, { Schema, Document } from "mongoose";
const SynonymSchema = new Schema({
    term: { type: String, required: true, unique: true },
    synonyms: { type: [String], default: [] },
});
SynonymSchema.index({ term: 1 });
export const Synonym = mongoose.model("Synonym", SynonymSchema);
