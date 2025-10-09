// src/config/index.ts
import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return; // evita reconectar en cada request

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("❌ No se encontró la variable MONGODB_URI.");
      return;
    }

    const conn = await mongoose.connect(uri, {
      dbName: "starprofesional",
      serverSelectionTimeoutMS: 10000,
    });

    isConnected = conn.connections[0].readyState === 1;

    console.log("✅ MongoDB conectado correctamente");
    console.log("   📡 Host:", conn.connection.host);
    console.log("   🧩 Base:", conn.connection.name);
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB:", error);
  }
};
