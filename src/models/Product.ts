import mongoose, { Schema, Document } from "mongoose";

export interface IExistencia {
  Bodega: string;
  Existencia: string;
  Stand: string;
}

export interface IProduct extends Document {
  Codigo: string;
  Descripcion: string;
  CodFami: string;
  NomFami: string;
  CodGrupo: string;
  NomGrupo: string;
  CodSubgrupo: string;
  NomSubgrupo: string;
  Fabricante: string; // ⚠️ En tu BDD está cruzado con Marca (ver rutas)
  Nomfabricante: string; // idem
  Marca: string; // ⚠️ Cruce con Fabricante (ver rutas)
  NomMarca: string;
  Unidad: string;
  Cantidad: string;
  Iva: string;
  Precio: string;
  Promo: string;
  Desta: string;
  Masve: string;
  Nuevo: string;
  Barras: string;
  CUM: string;
  Peso: string;
  Ancho: string;
  Alto: string;
  Largo: string;
  Adicional: string;
  Precio2: string;
  Cant2: string;
  Precio3: string;
  Cant3: string;
  Precio4: string;
  Cant4: string;
  Precio5: string;
  Cant5: string;
  Precio6: string;
  Cant6: string;
  Foto: string;
  Existencias: IExistencia[];
  Reg: number;

  // NUEVOS FLAGS
  PromoCatalogo?: { activo: boolean; promo: string };
  RefCatalogo?: boolean;
}

const ExistenciaSchema = new Schema<IExistencia>(
  {
    Bodega: { type: String, required: true },
    Existencia: { type: String, required: true },
    Stand: { type: String, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    Codigo: { type: String, required: true, unique: true },
    Descripcion: { type: String, required: true },
    CodFami: String,
    NomFami: String,
    CodGrupo: String,
    NomGrupo: String,
    CodSubgrupo: String,
    NomSubgrupo: String,
    Fabricante: String,
    Nomfabricante: String,
    Marca: String,
    NomMarca: String,
    Unidad: String,
    Cantidad: String,
    Iva: String,
    Precio: String,
    Promo: String,
    Desta: String,
    Masve: String,
    Nuevo: String,
    Barras: String,
    CUM: String,
    Peso: String,
    Ancho: String,
    Alto: String,
    Largo: String,
    Adicional: String,
    Precio2: String,
    Cant2: String,
    Precio3: String,
    Cant3: String,
    Precio4: String,
    Cant4: String,
    Precio5: String,
    Cant5: String,
    Precio6: String,
    Cant6: String,
    Foto: String,
    Existencias: [ExistenciaSchema],
    Reg: Number,

    // NUEVOS
    PromoCatalogo: {
      activo: { type: Boolean, default: false },
      promo: { type: String, default: "" },
    },
    RefCatalogo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Índices recomendados
ProductSchema.index({ Codigo: 1 }, { unique: true });
ProductSchema.index({ CodFami: 1, CodGrupo: 1, CodSubgrupo: 1 });
// Como tu BDD tiene Marca/Fabricante cruzados, indexa ambos pares
ProductSchema.index({ Marca: 1, NomMarca: 1 });
ProductSchema.index({ Fabricante: 1, Nomfabricante: 1 });
ProductSchema.index(
  { Descripcion: "text", NomMarca: "text", Nomfabricante: "text" },
  {
    default_language: "spanish",
    weights: { Descripcion: 5, NomMarca: 2, Nomfabricante: 2 },
  }
);

export const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);
