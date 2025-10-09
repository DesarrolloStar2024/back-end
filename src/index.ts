// src/index.ts
import { Hono } from "hono";
import "dotenv/config";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { productsRoute } from "./routes/products.js";
import { fabricantesRoute } from "./routes/fabricantes.js";
import { synonymsRoute } from "./routes/synonym.js";
import { superAdminsRoute } from "./routes/superadmins.js";
import { connectDB } from "./config/index.js";
import { syncRoute } from "./routes/sync.js";
import { authRoute } from "./routes/auth.js";
import { sysplusRoute } from "./routes/sysplus.js";

const app = new Hono();

// --- Middlewares globales ---
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (origin === "https://importadorastar.com") return origin;
      if (origin === "http://localhost:3000") return origin;
      return null;
    },
  })
);

// --- Conexión a la base de datos ---
app.use("*", async (_c, next) => {
  await connectDB();
  return next();
});

// --- Rutas principales ---
app.get("/", (c) => c.text("🚀 API de Star Profesional funcionando"));
app.route("/products", productsRoute);
app.route("/fabricantes", fabricantesRoute);
app.route("/synonyms", synonymsRoute);
app.route("/superadmins", superAdminsRoute);
app.route("/sync", syncRoute);
app.route("/auth", authRoute);
app.route("/sysplus", sysplusRoute);

// --- Ejecución local ---
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3003;
  serve({
    fetch: app.fetch,
    port: Number(PORT),
  });
  console.log(`🚀 Servidor local corriendo en http://localhost:${PORT}`);
}

// --- Export para Vercel ---
export default app;
//
