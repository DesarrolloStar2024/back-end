import mongoose, { Schema, Document } from "mongoose";

export interface ISynonym extends Document {
  term: string; // en minúsculas
  synonyms: string[]; // en minúsculas
}

const SynonymSchema = new Schema<ISynonym>({
  term: { type: String, required: true, unique: true }, // ya crea el índice único
  synonyms: { type: [String], default: [] },
});

// ❌ Eliminamos el índice duplicado (ya lo genera `unique: true`)

export const Synonym =
  mongoose.models.Synonym || mongoose.model<ISynonym>("Synonym", SynonymSchema);
