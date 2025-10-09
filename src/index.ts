// src/index.ts
import { Hono } from "hono";
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

app.use("*", cors());
app.use("*", async (_c, next) => {
  await connectDB();
  return next();
});

app.get("/", (c) => c.text("API de Star Profesional funcionando 🚀"));
app.route("/products", productsRoute);
app.route("/fabricantes", fabricantesRoute);
app.route("/synonyms", synonymsRoute);
app.route("/superadmins", superAdminsRoute);
app.route("/sync", syncRoute);
app.route("/auth", authRoute);
app.route("/sysplus", sysplusRoute);

// Solo para local
serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("🚀 Servidor Hono corriendo en http://localhost:3000");
