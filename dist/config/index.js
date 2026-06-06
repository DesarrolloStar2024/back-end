// src/config/index.ts
import mongoose from "mongoose";
let connectionPromise = null;
let eventsRegistered = false;
function registerMongoEvents() {
    if (eventsRegistered)
        return;
    eventsRegistered = true;
    mongoose.connection.on("disconnected", () => {
        console.warn("⚠️  MongoDB desconectado. Mongoose intentará reconectar automáticamente.");
        connectionPromise = null; // permite que connectDB() reintente si se llama
    });
    mongoose.connection.on("reconnected", () => {
        console.log("✅ MongoDB reconectado correctamente");
    });
    mongoose.connection.on("error", (err) => {
        console.error("❌ Error de conexión MongoDB:", err.message);
    });
}
export const connectDB = async () => {
    // Si mongoose ya está conectado, no hacer nada
    if (mongoose.connection.readyState === 1)
        return;
    // Si ya hay una conexión en curso, esperar esa misma promesa (evita race conditions)
    if (connectionPromise)
        return connectionPromise;
    registerMongoEvents();
    connectionPromise = (async () => {
        try {
            const uri = process.env.MONGODB_URI;
            if (!uri) {
                console.error("❌ No se encontró la variable MONGODB_URI.");
                return;
            }
            // DB_NAME sobreescribe todo; si no se define, usa la base del URI (ej: /staging)
            const dbName = process.env.DB_NAME || undefined;
            await mongoose.connect(uri, {
                ...(dbName ? { dbName } : {}),
                serverSelectionTimeoutMS: 10000,
            });
            console.log("✅ MongoDB conectado correctamente");
            console.log(`   📡 Host: ${mongoose.connection.host}`);
            console.log(`   🧩 Base: ${mongoose.connection.name}`);
        }
        catch (error) {
            console.error("❌ Error al conectar a MongoDB:", error);
            // Limpiar la promesa para permitir un retry futuro
            connectionPromise = null;
            throw error;
        }
    })();
    return connectionPromise;
};
