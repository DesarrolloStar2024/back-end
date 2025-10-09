import mongoose from "mongoose";
const ItemSchema = new mongoose.Schema({
    BARRAS: String,
    CANT: Number,
    UNI: String,
    REF: String,
    PRUNIT: Number,
    DTOP: Number,
}, { _id: false } // 🔥 evita que mongoose cree un _id en cada ítem
);
const CotizacionLogSchema = new mongoose.Schema({
    vendedor: Number,
    cliente: String,
    sucursal: String,
    observaciones: String,
    items: [ItemSchema], // usa el schema definido
    sysplusResponse: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ["success", "error"], default: "success" },
    errorMsg: String,
}, { timestamps: true });
export const CotizacionLog = mongoose.model("CotizacionLog", CotizacionLogSchema);
