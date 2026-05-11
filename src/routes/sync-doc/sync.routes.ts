import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const BearerHeader = z.object({ authorization: z.string().openapi({ default: "Bearer <token>" }) });

const SyncResult = z.object({ ok: z.boolean(), scope: z.string(), total: z.number(), done: z.number() });

export const syncFull = createRoute({
  method: "post",
  path: "/full",
  tags: ["Sync"],
  summary: "Sincronización completa de productos",
  description: "Descarga todos los productos de Sysplus y los upsertea. Limpia descontinuados.",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        codes: z.array(z.string()).optional().openapi({ description: "Códigos específicos" }),
        size: z.number().optional().openapi({ example: 5000 }),
        batchSize: z.number().optional().openapi({ example: 800 }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(SyncResult, "Resultado de la sincronización"),
  },
});

export const syncPrices = createRoute({
  method: "post",
  path: "/prices",
  tags: ["Sync"],
  summary: "Sincronizar solo precios",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        codes: z.array(z.string()).optional(),
        batchSize: z.number().optional().openapi({ example: 1000 }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(SyncResult, "Resultado"),
  },
});

export const syncStock = createRoute({
  method: "post",
  path: "/stock",
  tags: ["Sync"],
  summary: "Sincronizar solo stock/existencias",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        codes: z.array(z.string()).optional(),
        fecha: z.string().optional().openapi({ description: "Fecha formato dd/mm/yy" }),
        batchSize: z.number().optional().openapi({ example: 1000 }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(SyncResult, "Resultado"),
  },
});

export const syncFullStream = createRoute({
  method: "get",
  path: "/full/stream",
  tags: ["Sync"],
  summary: "Sincronización completa con progreso SSE",
  description: "EventSource. Emite eventos: status, start, progress, done",
  request: {
    headers: BearerHeader,
    query: z.object({
      size: z.string().optional().openapi({ example: "15000" }),
      batchSize: z.string().optional().openapi({ example: "800" }),
      codes: z.string().optional().openapi({ description: "CSV de códigos" }),
    }),
  },
  responses: {
    200: getResponseSchema(z.object({ event: z.string(), data: z.string() }), "SSE stream"),
  },
});

export const syncPricesStream = createRoute({
  method: "get",
  path: "/prices/stream",
  tags: ["Sync"],
  summary: "Sincronizar precios con progreso SSE",
  request: {
    headers: BearerHeader,
    query: z.object({
      batchSize: z.string().optional(),
      codes: z.string().optional(),
    }),
  },
  responses: {
    200: getResponseSchema(z.object({ event: z.string(), data: z.string() }), "SSE stream"),
  },
});

export const syncStockStream = createRoute({
  method: "get",
  path: "/stock/stream",
  tags: ["Sync"],
  summary: "Sincronizar stock con progreso SSE",
  request: {
    headers: BearerHeader,
    query: z.object({
      fecha: z.string().optional(),
      batchSize: z.string().optional(),
      codes: z.string().optional(),
    }),
  },
  responses: {
    200: getResponseSchema(z.object({ event: z.string(), data: z.string() }), "SSE stream"),
  },
});
