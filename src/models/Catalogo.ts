// src/models/Catalogo.ts
import mongoose, { type InferSchemaType } from "mongoose";

const CatalogoSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true, unique: true },
    categoria: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categoria",
      required: true,
    },
  },
  { timestamps: true }
);

CatalogoSchema.index(
  { titulo: 1 },
  { unique: true, name: "uniq_catalogo_titulo" }
);
CatalogoSchema.index({ categoria: 1 }, { name: "idx_catalogo_categoria" });

export type Catalogo = InferSchemaType<typeof CatalogoSchema>;

export const CatalogoModel =
  mongoose.models.Catalogo || mongoose.model("Catalogo", CatalogoSchema);
