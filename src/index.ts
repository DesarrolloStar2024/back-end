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
import { catalogosRoute } from "./routes/catalogos.js";
import { categoriasRoute } from "./routes/categorias.js";
import { quotesRoute } from "./routes/quotes.js";
import { couponsRoute } from "./routes/coupons.js";

const app = new Hono();

// --- Middlewares globales ---
// --- Middlewares globales ---
const allowedOrigins = new Set<string>([
  "https://starprofessional.com.co",
  "https://www.starprofessional.com.co",
  "https://beta.starprofessional.com.co",
  "https://pruebas.starprofessional.com.co",
  "http://localhost:5173",
]);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      return allowedOrigins.has(origin) ? origin : undefined;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    maxAge: 86400,
  })
);

// responder preflight siempre (recomendado)
app.options("*", () => new Response(null, { status: 204 }));


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
app.route("/catalogos", catalogosRoute);
app.route("/categorias", categoriasRoute);
app.get("/health", (c) => c.json({ ok: true }));
app.route("/quotes", quotesRoute);
app.route("/coupons", couponsRoute);

// --- Ejecución local ---
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000;
  serve({
    fetch: app.fetch,
    port: Number(PORT),
  });
  console.log(`🚀 Servidor local corriendo en http://localhost:${PORT}`);
}

// --- Export para Vercel ---
export default app;
//
