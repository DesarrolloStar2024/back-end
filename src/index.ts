// src/index.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import "dotenv/config";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { apiReference } from "@scalar/hono-api-reference";
import { configureOpenAPI } from "./lib/open-api.js";

// --- Rutas documentadas (OpenAPIHono) ---
import auth from "./routes/auth/auth.index.js";
import health from "./routes/health-doc/health.index.js";
import channels from "./routes/channels-doc/channels.index.js";

// --- Rutas existentes (Hono clásico, compatibles con OpenAPIHono) ---
import { productsRoute } from "./routes/products.js";
import { fabricantesRoute } from "./routes/fabricantes.js";
import { synonymsRoute } from "./routes/synonym.js";
import { superAdminsRoute } from "./routes/superadmins.js";
import { syncRoute } from "./routes/sync.js";
import { sysplusRoute } from "./routes/sysplus.js";
import { catalogosRoute } from "./routes/catalogos.js";
import { categoriasRoute } from "./routes/categorias.js";
import { quotesRoute } from "./routes/quotes.js";
import { couponsRoute } from "./routes/coupons.js";
import { sitemapRoute } from "./routes/sitemap.js";
import { pricelistsRoute } from "./routes/pricelists.js";
import { comprasNacionalesRoute } from "./routes/comprasNacionales.js";

// --- Route definitions (solo para OpenAPI spec, no manejan requests) ---
import * as productsRoutes from "./routes/products-doc/products.routes.js";
import * as superadminsRoutes from "./routes/superadmins-doc/superadmins.routes.js";
import * as couponsRoutes from "./routes/coupons-doc/coupons.routes.js";
import * as synonymsRoutes from "./routes/synonyms-doc/synonyms.routes.js";
import * as fabricantesRoutes from "./routes/fabricantes-doc/fabricantes.routes.js";
import * as categoriasRoutes from "./routes/categorias-doc/categorias.routes.js";
import * as catalogosRoutes from "./routes/catalogos-doc/catalogos.routes.js";
import * as quotesRoutes from "./routes/quotes-doc/quotes.routes.js";
import * as syncRoutes from "./routes/sync-doc/sync.routes.js";
import * as sysplusRoutes from "./routes/sysplus-doc/sysplus.routes.js";
import * as sitemapRoutes from "./routes/sitemap-doc/sitemap.routes.js";

import { connectDB } from "./config/index.js";
import { seedChannels } from "./db/seed/channels.js";
import cron from "node-cron";
import { runFullSync } from "./routes/cron-full-sync.js";

const app = new OpenAPIHono({ strict: false });

// --- Middlewares globales ---
const allowedOrigins = new Set<string>([
  "https://starprofessional.com.co",
  "https://www.starprofessional.com.co",
  "https://beta.starprofessional.com.co",
  "https://pruebas.starprofessional.com.co",
  "https://starboutique.com.co",
  "https://www.starboutique.com.co",
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

app.options("*", () => new Response(null, { status: 204 }));

// --- Rutas documentadas (OpenAPIHono con .openapi()) ---
app.route("/auth", auth);
app.route("/health", health);
app.route("/channels", channels);

// --- Rutas existentes (Hono clásico — funcionan igual en OpenAPIHono) ---
app.get("/", (c) => c.text("🚀 API de Star Profesional funcionando"));
app.route("/products", productsRoute);
app.route("/fabricantes", fabricantesRoute);
app.route("/synonyms", synonymsRoute);
app.route("/superadmins", superAdminsRoute);
app.route("/sync", syncRoute);
app.route("/sysplus", sysplusRoute);
app.route("/catalogos", catalogosRoute);
app.route("/categorias", categoriasRoute);
app.route("/quotes", quotesRoute);
app.route("/coupons", couponsRoute);
app.route("/sitemap.xml", sitemapRoute);
app.route("/pricelists", pricelistsRoute);
app.route("/compras-nacionales", comprasNacionalesRoute);

// --- Registrar route definitions en el spec OpenAPI ---
// Estas rutas NO manejan requests (los handlers existentes de arriba lo hacen),
// solo agregan la documentación al spec. Usamos un handler stub que nunca se ejecuta
// porque las rutas reales ya están montadas con mayor prioridad.
const stub = (c: any) => c.json({});
const docRoutes = new OpenAPIHono({ strict: false });

// Products
docRoutes.openapi(productsRoutes.getProducts, stub);
docRoutes.openapi(productsRoutes.getProductByCode, stub);
docRoutes.openapi(productsRoutes.getSuggestions, stub);
docRoutes.openapi(productsRoutes.upsertProducts, stub);
docRoutes.openapi(productsRoutes.patchRefCatalogo, stub);
docRoutes.openapi(productsRoutes.bulkRefCatalogo, stub);
docRoutes.openapi(productsRoutes.patchPromoCatalogo, stub);
docRoutes.openapi(productsRoutes.bulkPromoCatalogo, stub);
docRoutes.openapi(productsRoutes.getCatalogo, stub);
app.route("/products", docRoutes);

// SuperAdmins
const saDoc = new OpenAPIHono({ strict: false });
saDoc.openapi(superadminsRoutes.getSuperAdmins, stub);
saDoc.openapi(superadminsRoutes.getSuperAdminByCodigo, stub);
saDoc.openapi(superadminsRoutes.createSuperAdmin, stub);
saDoc.openapi(superadminsRoutes.updateSuperAdmin, stub);
saDoc.openapi(superadminsRoutes.deleteSuperAdmin, stub);
saDoc.openapi(superadminsRoutes.upsertSuperAdmins, stub);
app.route("/superadmins", saDoc);

// Coupons
const couDoc = new OpenAPIHono({ strict: false });
couDoc.openapi(couponsRoutes.validateCoupon, stub);
couDoc.openapi(couponsRoutes.getCoupons, stub);
couDoc.openapi(couponsRoutes.createCoupon, stub);
couDoc.openapi(couponsRoutes.updateCoupon, stub);
couDoc.openapi(couponsRoutes.toggleCoupon, stub);
couDoc.openapi(couponsRoutes.deleteCoupon, stub);
app.route("/coupons", couDoc);

// Synonyms
const synDoc = new OpenAPIHono({ strict: false });
synDoc.openapi(synonymsRoutes.getSynonyms, stub);
synDoc.openapi(synonymsRoutes.getSynonymByTerm, stub);
synDoc.openapi(synonymsRoutes.createSynonym, stub);
synDoc.openapi(synonymsRoutes.replaceSynonym, stub);
synDoc.openapi(synonymsRoutes.patchSynonym, stub);
synDoc.openapi(synonymsRoutes.deleteSynonym, stub);
synDoc.openapi(synonymsRoutes.upsertSynonyms, stub);
app.route("/synonyms", synDoc);

// Fabricantes
const fabDoc = new OpenAPIHono({ strict: false });
fabDoc.openapi(fabricantesRoutes.getFabricantes, stub);
fabDoc.openapi(fabricantesRoutes.getFabricanteById, stub);
fabDoc.openapi(fabricantesRoutes.createFabricante, stub);
fabDoc.openapi(fabricantesRoutes.updateFabricante, stub);
fabDoc.openapi(fabricantesRoutes.deleteFabricante, stub);
fabDoc.openapi(fabricantesRoutes.upsertFabricantes, stub);
app.route("/fabricantes", fabDoc);

// Categorías
const catDoc = new OpenAPIHono({ strict: false });
catDoc.openapi(categoriasRoutes.getCategorias, stub);
catDoc.openapi(categoriasRoutes.getCategoriaById, stub);
catDoc.openapi(categoriasRoutes.createCategoria, stub);
catDoc.openapi(categoriasRoutes.patchCategoria, stub);
catDoc.openapi(categoriasRoutes.deleteCategoria, stub);
app.route("/categorias", catDoc);

// Catálogos
const ctlDoc = new OpenAPIHono({ strict: false });
ctlDoc.openapi(catalogosRoutes.getCatalogos, stub);
ctlDoc.openapi(catalogosRoutes.getCatalogoById, stub);
ctlDoc.openapi(catalogosRoutes.createCatalogo, stub);
ctlDoc.openapi(catalogosRoutes.patchCatalogo, stub);
ctlDoc.openapi(catalogosRoutes.deleteCatalogo, stub);
app.route("/catalogos", ctlDoc);

// Quotes
const quoDoc = new OpenAPIHono({ strict: false });
quoDoc.openapi(quotesRoutes.createQuote, stub);
quoDoc.openapi(quotesRoutes.getQuotes, stub);
quoDoc.openapi(quotesRoutes.getQuoteById, stub);
quoDoc.openapi(quotesRoutes.patchQuote, stub);
quoDoc.openapi(quotesRoutes.deleteQuote, stub);
app.route("/quotes", quoDoc);

// Sync
const sncDoc = new OpenAPIHono({ strict: false });
sncDoc.openapi(syncRoutes.syncFull, stub);
sncDoc.openapi(syncRoutes.syncPrices, stub);
sncDoc.openapi(syncRoutes.syncStock, stub);
sncDoc.openapi(syncRoutes.syncFullStream, stub);
sncDoc.openapi(syncRoutes.syncPricesStream, stub);
sncDoc.openapi(syncRoutes.syncStockStream, stub);
app.route("/sync", sncDoc);

// Sysplus
const sysDoc = new OpenAPIHono({ strict: false });
sysDoc.openapi(sysplusRoutes.postCotizacionLog, stub);
sysDoc.openapi(sysplusRoutes.getCotizacionLogs, stub);
app.route("/sysplus", sysDoc);

// Sitemap
const sitDoc = new OpenAPIHono({ strict: false });
sitDoc.openapi(sitemapRoutes.getSitemap, stub);
app.route("/sitemap.xml", sitDoc);

// --- OpenAPI spec + Scalar UI ---
configureOpenAPI(app);

app.get(
  "/docs",
  apiReference({
    url: "/open-api",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  }),
);

// --- Arranque: conectar a DB una sola vez, luego seed y servidor ---
async function bootstrap() {
  try {
    await connectDB();
  } catch (err) {
    console.error("⚠️  No se pudo conectar a MongoDB al arrancar. Se reintentará en las requests.");
  }
  try { await seedChannels(); } catch (e) { console.error("Seed error:", e); }
}

bootstrap();

// --- Cron: sincronización full de productos (solo entorno no-Vercel) ---
// Configurable por env. Default: 4 veces al día (5am, 11am, 5pm, 11pm Bogotá).
// IMPORTANTE: el sync NO toca RefCatalogo ni PromoCatalogo (writeProducts usa
// $set solo con los campos de la fuente), así que esos flags quedan intactos.
if (!process.env.VERCEL) {
  const FULL_SYNC_CRON = process.env.FULL_SYNC_CRON || "0 5,11,17,23 * * *";
  let isSyncing = false;

  cron.schedule(
    FULL_SYNC_CRON,
    async () => {
      if (isSyncing) {
        console.warn("[cron] Sync anterior aún en curso — se omite esta corrida.");
        return;
      }
      isSyncing = true;
      const startedAt = Date.now();
      console.log("[cron] Iniciando sincronización full de productos...");
      try {
        await connectDB();
        const { total, done } = await runFullSync({ size: 5000, batchSize: 800 });
        const secs = Math.round((Date.now() - startedAt) / 1000);
        console.log(`[cron] Sync completado: ${done}/${total} productos en ${secs}s`);
      } catch (err) {
        console.error("[cron] Error en sincronización:", err);
      } finally {
        isSyncing = false;
      }
    },
    { timezone: "America/Bogota" }
  );
  console.log(`[cron] Sync full programado: "${FULL_SYNC_CRON}" (America/Bogota)`);
}

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
