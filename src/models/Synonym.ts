// models/Synonym.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISynonym extends Document {
  term: string; // en minúsculas
  synonyms: string[]; // en minúsculas
}

const SynonymSchema = new Schema<ISynonym>({
  term: { type: String, required: true, unique: true },
  synonyms: { type: [String], default: [] },
});

SynonymSchema.index({ term: 1 });

export const Synonym = mongoose.model<ISynonym>("Synonym", SynonymSchema);
