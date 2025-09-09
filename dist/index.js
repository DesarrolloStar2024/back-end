import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { connectDB } from "./config/db.js";
import { productsRoute } from "./routes/products.js";
import { cors } from "hono/cors";
import { fabricantesRoute } from "./routes/fabricantes.js";
import { synonymsRoute } from "./routes/synonym.js";
import { superAdminsRoute } from "./routes/superadmins.js";
config();
const app = new Hono();
const port = process.env.PORT || 3001;
// Conexión a MongoDB
connectDB();
// habilitar CORS para todo
app.use("*", cors({
    origin: "*", // o restringe a tu dominio: "https://tu-frontend.com"
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
}));
// Ruta base
app.get("/", (c) => c.text("API de Star Profesional funcionando 🚀"));
// Rutas de productos
app.route("/products", productsRoute);
serve({
    fetch: app.fetch,
    port: Number(port),
});
console.log(`Servidor corriendo en http://localhost:${port}`);
