// src/routes/docs.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { SuperAdmin } from "../models/SuperAdmin.js";
import { sign } from "hono/jwt";
import { connectDB } from "../config/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "TU_SUPER_SECRETO";

// ──────────── Schemas reutilizables ────────────

const ErrorSchema = z.object({
  message: z.string(),
}).openapi("Error");

const PaginationQuery = {
  page: z.string().optional().openapi({ example: "1", description: "Número de página" }),
  size: z.string().optional().openapi({ example: "50", description: "Elementos por página" }),
  q: z.string().optional().openapi({ description: "Búsqueda por texto" }),
};

const PaginatedResponse = (itemSchema: z.ZodTypeAny, name: string) =>
  z.object({
    page: z.number(),
    size: z.number(),
    totalDocs: z.number(),
    totalPages: z.number(),
    data: z.array(itemSchema),
  }).openapi(`Paginated${name}`);

// ──── Item Schemas ────

const ProductSchema = z.object({
  Codigo: z.string(),
  Descripcion: z.string(),
  CodFami: z.string().optional(),
  NomFami: z.string().optional(),
  CodGrupo: z.string().optional(),
  NomGrupo: z.string().optional(),
  Fabricante: z.string().optional(),
  Nomfabricante: z.string().optional(),
  Marca: z.string().optional(),
  NomMarca: z.string().optional(),
  Precio: z.string().optional(),
  Promo: z.string().optional(),
  Nuevo: z.string().optional(),
  Desta: z.string().optional(),
  Barras: z.string().optional(),
  Existencias: z.array(z.object({
    Bodega: z.string(),
    Existencia: z.string(),
    Stand: z.string().optional(),
  })).optional(),
}).openapi("Product");

const ChannelSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  bodegas: z.array(z.string()),
  marcas: z.array(z.string()),
}).openapi("Channel");

const SuperAdminSchema = z.object({
  Id: z.string(),
  Codigo: z.string(),
}).openapi("SuperAdmin");

const CouponSchema = z.object({
  code: z.string(),
  discountPercentage: z.number(),
  isActive: z.boolean(),
}).openapi("Coupon");

const SynonymSchema = z.object({
  term: z.string(),
  synonyms: z.array(z.string()),
}).openapi("Synonym");

const FabricanteSchema = z.object({
  Id: z.string(),
  Nombre: z.string(),
}).openapi("Fabricante");

const CategoriaSchema = z.object({
  _id: z.string(),
  nombre: z.string(),
}).openapi("Categoria");

const CatalogoSchema = z.object({
  _id: z.string(),
  titulo: z.string(),
  categoria: z.any(),
}).openapi("Catalogo");

const QuoteItemSchema = z.object({
  reference: z.string(),
  brand: z.string().optional(),
  descriptionEs: z.string().optional(),
  ctns: z.number().optional(),
  qtyPerCarton: z.number().optional(),
  unitPriceUSD: z.number().optional(),
}).openapi("QuoteItem");

const QuoteSchema = z.object({
  _id: z.string(),
  code: z.string().optional(),
  supplier: z.object({ name: z.string(), phone: z.string().optional() }),
  items: z.array(QuoteItemSchema),
  status: z.string().optional(),
}).openapi("Quote");

// ──────────── App OpenAPI ────────────

export const docsApp = new OpenAPIHono();

// ════════════════════════════════════
//  AUTH — Login SuperAdmin
// ════════════════════════════════════

const loginRoute = createRoute({
  method: "post",
  path: "/auth/login-hono",
  tags: ["Auth"],
  summary: "Login SuperAdmin",
  description: "Autentica un SuperAdmin por usuario/código o vendedor. Retorna un JWT.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            usuario: z.string().optional().openapi({ example: "ADMIN01", description: "Código del SuperAdmin" }),
            vend: z.union([z.string(), z.number()]).optional().openapi({ example: "1", description: "ID del vendedor" }),
            expireAt: z.number().optional().openapi({ description: "Unix timestamp de expiración (opcional)" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login exitoso",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            token: z.string(),
            user: z.object({
              usuario: z.string().optional(),
              vend: z.any().optional(),
              isSuperAdmin: z.boolean(),
            }),
            isSuperAdmin: z.boolean(),
          }),
        },
      },
    },
    400: { description: "Datos insuficientes", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "No autorizado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(loginRoute, async (c) => {
  await connectDB();
  const { usuario, vend, expireAt } = c.req.valid("json");

  if (!usuario && !vend) {
    return c.json({ message: "Datos insuficientes" }, 400);
  }

  const superAdmin = await SuperAdmin.findOne({
    $or: [{ Codigo: usuario }, { Id: vend?.toString() }],
  });

  if (!superAdmin) {
    return c.json({ message: "Usuario no autorizado como SuperAdmin", isSuperAdmin: false }, 403);
  }

  const payload = {
    iss: "STAR_BACK",
    user: { usuario, vend, isSuperAdmin: true },
    iat: Math.floor(Date.now() / 1000),
    exp: expireAt || Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };

  const honoToken = await sign(payload, JWT_SECRET);

  return c.json({
    message: "SuperAdmin autenticado ✅",
    token: honoToken,
    user: payload.user,
    isSuperAdmin: true,
  });
});

// ════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════

const getProductsRoute = createRoute({
  method: "get",
  path: "/products",
  tags: ["Products"],
  summary: "Listar productos",
  description: "Búsqueda avanzada de productos con filtros, paginación, stock por canal y más.",
  request: {
    query: z.object({
      ...PaginationQuery,
      buscar: z.string().optional().openapi({ description: "Búsqueda full-text acento-insensible" }),
      title: z.string().optional().openapi({ description: "Filtrar por título/código" }),
      codigo: z.string().optional().openapi({ description: "Código exacto del producto" }),
      codFami: z.string().optional().openapi({ description: "Código de familia" }),
      codGrupo: z.string().optional().openapi({ description: "Código de grupo" }),
      codSubgrupo: z.string().optional().openapi({ description: "Código de subgrupo" }),
      stock: z.enum(["public", "agotado", "all"]).optional().openapi({ example: "public", description: "Filtro de stock: public (con existencia), agotado, all" }),
      channelId: z.string().optional().openapi({ description: "ID del canal (filtra bodegas y marcas)" }),
      bodegas: z.string().optional().openapi({ example: "01,06", description: "Bodegas separadas por coma" }),
      desta: z.string().optional().openapi({ description: "Productos destacados (true/false)" }),
      nuevo: z.string().optional().openapi({ description: "Productos nuevos (true/false)" }),
      promo: z.string().optional().openapi({ description: "Productos en promoción (true/false)" }),
      cadena: z.string().optional().openapi({ description: "Filtrar por cadena" }),
    }),
  },
  responses: {
    200: {
      description: "Lista paginada de productos",
      content: { "application/json": { schema: PaginatedResponse(ProductSchema, "Products") } },
    },
  },
});

docsApp.openapi(getProductsRoute, async (c) => {
  return c.json({ message: "Usa la ruta /products directamente" } as any);
});

const getProductByCodeRoute = createRoute({
  method: "get",
  path: "/products/{codigo}",
  tags: ["Products"],
  summary: "Producto por código",
  description: "Obtiene un producto específico con sus existencias y sugeridos.",
  request: {
    params: z.object({ codigo: z.string().openapi({ example: "KT-G06" }) }),
  },
  responses: {
    200: { description: "Producto encontrado", content: { "application/json": { schema: ProductSchema } } },
    404: { description: "No encontrado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(getProductByCodeRoute, async (c) => {
  return c.json({ message: "Usa la ruta /products/:codigo directamente" } as any);
});

// ════════════════════════════════════
//  CHANNELS
// ════════════════════════════════════

const getChannelsRoute = createRoute({
  method: "get",
  path: "/channels",
  tags: ["Channels"],
  summary: "Listar canales",
  description: "Retorna todos los canales de venta con sus bodegas y marcas asignadas.",
  responses: {
    200: { description: "Lista de canales", content: { "application/json": { schema: z.array(ChannelSchema) } } },
  },
});

docsApp.openapi(getChannelsRoute, async (c) => {
  return c.json({ message: "Usa /channels directamente" } as any);
});

const createChannelRoute = createRoute({
  method: "post",
  path: "/channels",
  tags: ["Channels"],
  summary: "Crear canal",
  description: "Crea un nuevo canal de venta con nombre, slug, bodegas y marcas.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().openapi({ example: "Star Boutique" }),
            slug: z.string().openapi({ example: "star-boutique" }),
            bodegas: z.array(z.string()).openapi({ example: ["03"] }),
            marcas: z.array(z.string()).optional().openapi({ example: ["1", "10"] }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Canal creado", content: { "application/json": { schema: ChannelSchema } } },
    400: { description: "Datos faltantes", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Slug duplicado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(createChannelRoute, async (c) => {
  return c.json({ message: "Usa POST /channels directamente" } as any);
});

const patchChannelRoute = createRoute({
  method: "patch",
  path: "/channels/{id}",
  tags: ["Channels"],
  summary: "Actualizar canal",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            slug: z.string().optional(),
            bodegas: z.array(z.string()).optional(),
            marcas: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Canal actualizado", content: { "application/json": { schema: ChannelSchema } } },
    404: { description: "No encontrado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(patchChannelRoute, async (c) => {
  return c.json({ message: "Usa PATCH /channels/:id directamente" } as any);
});

const deleteChannelRoute = createRoute({
  method: "delete",
  path: "/channels/{id}",
  tags: ["Channels"],
  summary: "Eliminar canal",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Eliminado", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    404: { description: "No encontrado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(deleteChannelRoute, async (c) => {
  return c.json({ message: "Usa DELETE /channels/:id directamente" } as any);
});

// ════════════════════════════════════
//  SUPERADMINS
// ════════════════════════════════════

const getSuperAdminsRoute = createRoute({
  method: "get",
  path: "/superadmins",
  tags: ["SuperAdmins"],
  summary: "Listar SuperAdmins",
  security: [{ Bearer: [] }],
  request: { query: z.object({ ...PaginationQuery, codigos: z.string().optional() }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(SuperAdminSchema, "SuperAdmins") } } },
  },
});

docsApp.openapi(getSuperAdminsRoute, async (c) => {
  return c.json({ message: "Usa /superadmins directamente" } as any);
});

const createSuperAdminRoute = createRoute({
  method: "post",
  path: "/superadmins",
  tags: ["SuperAdmins"],
  summary: "Crear SuperAdmin",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            Id: z.string().openapi({ example: "1" }),
            Codigo: z.string().openapi({ example: "ADMIN01" }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Creado", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    400: { description: "Datos faltantes", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(createSuperAdminRoute, async (c) => {
  return c.json({ message: "Usa POST /superadmins directamente" } as any);
});

// ════════════════════════════════════
//  COUPONS
// ════════════════════════════════════

const validateCouponRoute = createRoute({
  method: "post",
  path: "/coupons/validate",
  tags: ["Coupons"],
  summary: "Validar cupón",
  description: "Valida si un código de cupón es activo y retorna el porcentaje de descuento.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ code: z.string().openapi({ example: "BDSTAR" }) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Cupón válido",
      content: {
        "application/json": {
          schema: z.object({ valid: z.boolean(), code: z.string(), discountPercentage: z.number() }),
        },
      },
    },
    404: { description: "Cupón no válido", content: { "application/json": { schema: z.object({ valid: z.boolean(), message: z.string() }) } } },
  },
});

docsApp.openapi(validateCouponRoute, async (c) => {
  return c.json({ message: "Usa POST /coupons/validate directamente" } as any);
});

const getCouponsRoute = createRoute({
  method: "get",
  path: "/coupons",
  tags: ["Coupons"],
  summary: "Listar cupones (admin)",
  security: [{ Bearer: [] }],
  request: { query: z.object({ ...PaginationQuery }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(CouponSchema, "Coupons") } } },
  },
});

docsApp.openapi(getCouponsRoute, async (c) => {
  return c.json({ message: "Usa /coupons directamente" } as any);
});

const createCouponRoute = createRoute({
  method: "post",
  path: "/coupons",
  tags: ["Coupons"],
  summary: "Crear cupón (admin)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.string().openapi({ example: "DESCUENTO10" }),
            discountPercentage: z.number().openapi({ example: 0.1, description: "Entre 0 y 1" }),
            isActive: z.boolean().openapi({ example: true }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Creado", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    409: { description: "Duplicado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

docsApp.openapi(createCouponRoute, async (c) => {
  return c.json({ message: "Usa POST /coupons directamente" } as any);
});

// ════════════════════════════════════
//  SYNONYMS
// ════════════════════════════════════

const getSynonymsRoute = createRoute({
  method: "get",
  path: "/synonyms",
  tags: ["Synonyms"],
  summary: "Listar sinónimos",
  request: { query: z.object({ ...PaginationQuery }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(SynonymSchema, "Synonyms") } } },
  },
});

docsApp.openapi(getSynonymsRoute, async (c) => {
  return c.json({ message: "Usa /synonyms directamente" } as any);
});

const createSynonymRoute = createRoute({
  method: "post",
  path: "/synonyms",
  tags: ["Synonyms"],
  summary: "Crear sinónimo (admin)",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            term: z.string().openapi({ example: "plancha" }),
            synonyms: z.array(z.string()).openapi({ example: ["pinza para cabello", "alisadora"] }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Creado", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
  },
});

docsApp.openapi(createSynonymRoute, async (c) => {
  return c.json({ message: "Usa POST /synonyms directamente" } as any);
});

// ════════════════════════════════════
//  FABRICANTES
// ════════════════════════════════════

const getFabricantesRoute = createRoute({
  method: "get",
  path: "/fabricantes",
  tags: ["Fabricantes"],
  summary: "Listar fabricantes (admin)",
  security: [{ Bearer: [] }],
  request: { query: z.object({ ...PaginationQuery, ids: z.string().optional() }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(FabricanteSchema, "Fabricantes") } } },
  },
});

docsApp.openapi(getFabricantesRoute, async (c) => {
  return c.json({ message: "Usa /fabricantes directamente" } as any);
});

// ════════════════════════════════════
//  CATEGORIAS
// ════════════════════════════════════

const getCategoriasRoute = createRoute({
  method: "get",
  path: "/categorias",
  tags: ["Categorías"],
  summary: "Listar categorías",
  request: { query: z.object({ ...PaginationQuery }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(CategoriaSchema, "Categorias") } } },
  },
});

docsApp.openapi(getCategoriasRoute, async (c) => {
  return c.json({ message: "Usa /categorias directamente" } as any);
});

// ════════════════════════════════════
//  CATALOGOS
// ════════════════════════════════════

const getCatalogosRoute = createRoute({
  method: "get",
  path: "/catalogos",
  tags: ["Catálogos"],
  summary: "Listar catálogos",
  request: { query: z.object({ ...PaginationQuery }) },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(CatalogoSchema, "Catalogos") } } },
  },
});

docsApp.openapi(getCatalogosRoute, async (c) => {
  return c.json({ message: "Usa /catalogos directamente" } as any);
});

// ════════════════════════════════════
//  QUOTES (Cotizaciones)
// ════════════════════════════════════

const getQuotesRoute = createRoute({
  method: "get",
  path: "/quotes",
  tags: ["Quotes"],
  summary: "Listar cotizaciones",
  request: {
    query: z.object({
      ...PaginationQuery,
      status: z.enum(["draft", "sent", "approved", "rejected"]).optional(),
    }),
  },
  responses: {
    200: { description: "Lista paginada", content: { "application/json": { schema: PaginatedResponse(QuoteSchema, "Quotes") } } },
  },
});

docsApp.openapi(getQuotesRoute, async (c) => {
  return c.json({ message: "Usa /quotes directamente" } as any);
});

// ════════════════════════════════════
//  SYNC (Sincronización Sysplus)
// ════════════════════════════════════

const syncFullRoute = createRoute({
  method: "post",
  path: "/sync/full",
  tags: ["Sync"],
  summary: "Sincronización completa de productos",
  description: "Descarga todos los productos de Sysplus y los sincroniza con MongoDB. Requiere SuperAdmin.",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            codes: z.array(z.string()).optional().openapi({ description: "Códigos específicos a sincronizar" }),
            size: z.number().optional().openapi({ example: 5000 }),
            batchSize: z.number().optional().openapi({ example: 800 }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sincronización completada",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean(), scope: z.string(), total: z.number(), done: z.number() }),
        },
      },
    },
  },
});

docsApp.openapi(syncFullRoute, async (c) => {
  return c.json({ message: "Usa POST /sync/full directamente" } as any);
});

const syncPricesRoute = createRoute({
  method: "post",
  path: "/sync/prices",
  tags: ["Sync"],
  summary: "Sincronizar solo precios",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            codes: z.array(z.string()).optional(),
            batchSize: z.number().optional().openapi({ example: 1000 }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Precios sincronizados",
      content: { "application/json": { schema: z.object({ ok: z.boolean(), scope: z.string(), total: z.number(), done: z.number() }) } },
    },
  },
});

docsApp.openapi(syncPricesRoute, async (c) => {
  return c.json({ message: "Usa POST /sync/prices directamente" } as any);
});

const syncStockRoute = createRoute({
  method: "post",
  path: "/sync/stock",
  tags: ["Sync"],
  summary: "Sincronizar solo stock/existencias",
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            codes: z.array(z.string()).optional(),
            fecha: z.string().optional().openapi({ example: "12/09/25" }),
            batchSize: z.number().optional().openapi({ example: 1000 }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Stock sincronizado",
      content: { "application/json": { schema: z.object({ ok: z.boolean(), scope: z.string(), total: z.number(), done: z.number() }) } },
    },
  },
});

docsApp.openapi(syncStockRoute, async (c) => {
  return c.json({ message: "Usa POST /sync/stock directamente" } as any);
});

// ════════════════════════════════════
//  SYSPLUS (Logs de cotización)
// ════════════════════════════════════

const postCotizacionLogRoute = createRoute({
  method: "post",
  path: "/sysplus/cotizacion/log",
  tags: ["Sysplus"],
  summary: "Registrar log de cotización",
  description: "Guarda log de cotización y descuenta stock si fue exitosa.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            requestBody: z.object({
              VEND: z.number(),
              NIT: z.string(),
              SUCU: z.string().optional(),
              OBS: z.string().optional(),
              ITEMS: z.array(z.object({ BARRAS: z.string(), CANT: z.number() })),
            }),
            sysplusResponse: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Log registrado",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.boolean(),
            logId: z.string(),
            status: z.string(),
            updatedStock: z.any(),
          }),
        },
      },
    },
  },
});

docsApp.openapi(postCotizacionLogRoute, async (c) => {
  return c.json({ message: "Usa POST /sysplus/cotizacion/log directamente" } as any);
});

// ════════════════════════════════════
//  SITEMAP
// ════════════════════════════════════

const sitemapRoute = createRoute({
  method: "get",
  path: "/sitemap.xml",
  tags: ["SEO"],
  summary: "Sitemap XML dinámico",
  description: "Genera un sitemap XML con todos los productos, familias, marcas y páginas estáticas.",
  responses: {
    200: { description: "XML del sitemap" },
  },
});

docsApp.openapi(sitemapRoute, async (c) => {
  return c.json({ message: "Usa /sitemap.xml directamente" } as any);
});

// ════════════════════════════════════
//  OpenAPI Doc + Swagger UI
// ════════════════════════════════════

docsApp.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "Star Professional API",
    version: "1.0.0",
    description: `
## API de Star Professional — Distribuidor Mayorista de Belleza

### Autenticación
La mayoría de endpoints admin requieren un token JWT.
1. Usa **POST /auth/login-hono** con tus credenciales de SuperAdmin
2. Copia el \`token\` de la respuesta
3. Haz click en **Authorize** y pega: \`Bearer {tu-token}\`

### Módulos
- **Products** — Catálogo de productos con búsqueda avanzada y filtros por canal
- **Channels** — Canales de venta (multi-tienda) con bodegas y marcas
- **Sync** — Sincronización con Sysplus (productos, precios, stock)
- **Coupons** — Gestión de cupones de descuento
- **Quotes** — Cotizaciones de importación
- **SuperAdmins** — Administradores del sistema
- **Fabricantes** — Marcas/fabricantes
- **Synonyms** — Sinónimos de búsqueda
- **Categorías / Catálogos** — Organización del contenido
    `,
  },
  servers: [
    { url: "http://localhost:4000", description: "Local" },
    { url: "https://back-end-git-main-sistemas-projects-205af3b3.vercel.app", description: "Producción (Vercel)" },
  ],
  security: [{ Bearer: [] }],
});

docsApp.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Token JWT obtenido de POST /auth/login-hono",
});

docsApp.get("/", swaggerUI({ url: "/docs/doc" }));
