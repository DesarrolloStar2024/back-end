// src/models/Categoria.ts
import mongoose, { type InferSchemaType } from "mongoose";

const CategoriaSchema = new mongoose.Schema(
  { nombre: { type: String, required: true, trim: true, unique: true } },
  { timestamps: true }
);

CategoriaSchema.index(
  { nombre: 1 },
  { unique: true, name: "uniq_categoria_nombre" }
);

export type Categoria = InferSchemaType<typeof CategoriaSchema>;
export const CategoriaModel =
  mongoose.models.Categoria || mongoose.model("Categoria", CategoriaSchema);
