/**
 * Migración: corregir bodegas de los canales existentes.
 *
 * Ejecutar UNA sola vez:
 *   npx tsx src/db/migrations/fix-channels.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Channel } from "../../models/Channel.js";

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no está definida en .env");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  // StarProfesional → bodegas 01 + 06
  const r1 = await Channel.updateOne(
    { slug: "star-profesional" },
    { $set: { bodegas: ["01", "06"] } }
  );
  console.log(`StarProfesional: ${r1.modifiedCount} documento(s) actualizado(s)`);

  // StarBoutique → solo bodega 03
  const r2 = await Channel.updateOne(
    { slug: "star-boutique" },
    { $set: { bodegas: ["03"] } }
  );
  console.log(`StarBoutique: ${r2.modifiedCount} documento(s) actualizado(s)`);

  await mongoose.disconnect();
  console.log("Migración completada.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
