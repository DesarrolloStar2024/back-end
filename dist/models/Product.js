import mongoose, { Schema, Document } from "mongoose";
const ExistenciaSchema = new Schema({
    Bodega: { type: String, required: false },
    Existencia: { type: String, required: false },
    Stand: { type: String, required: false },
}, { _id: false });
const ProductSchema = new Schema({
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
}, { timestamps: true });
// Índices recomendados (Codigo unique ya declarado en el field)
// ProductSchema.index({ Codigo: 1 }, { unique: true }); // duplicado — ya tiene unique:true en el schema
ProductSchema.index({ CodFami: 1, CodGrupo: 1, CodSubgrupo: 1 });
// Como tu BDD tiene Marca/Fabricante cruzados, indexa ambos pares
ProductSchema.index({ Marca: 1, NomMarca: 1 });
ProductSchema.index({ Fabricante: 1, Nomfabricante: 1 });
ProductSchema.index({ Descripcion: "text", NomMarca: "text", Nomfabricante: "text" }, {
    default_language: "spanish",
    weights: { Descripcion: 5, NomMarca: 2, Nomfabricante: 2 },
});
export const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
