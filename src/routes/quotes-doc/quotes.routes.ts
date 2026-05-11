import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const ItemSchema = z.object({
  barcode: z.string().optional(),
  reference: z.string(),
  images: z.array(z.string()).optional(),
  brand: z.string().optional(),
  descriptionEs: z.string().optional(),
  material: z.string().optional(),
  colors: z.string().optional(),
  measure: z.string().optional(),
  itemNote: z.string().optional(),
  ctns: z.number().optional(),
  qtyPerCarton: z.number().optional(),
  unit: z.string().optional(),
  unitPriceUSD: z.number().optional(),
  dimensionsCm: z.object({
    alto: z.number(),
    ancho: z.number(),
    largo: z.number(),
  }).optional(),
});

const QuoteSchema = z.object({
  _id: z.string(),
  code: z.string(),
  supplier: z.object({ name: z.string(), phone: z.string().optional() }),
  observations: z.string().optional(),
  vigenciaDays: z.number().optional(),
  incoterm: z.string().optional(),
  items: z.array(ItemSchema),
});

export const createQuote = createRoute({
  method: "post",
  path: "/",
  tags: ["Quotes"],
  summary: "Crear cotización de importación",
  request: {
    body: getRequestBodySchema(
      z.object({
        code: z.string().optional(),
        supplier: z.object({ name: z.string(), phone: z.string().optional() }),
        observations: z.string().optional(),
        vigenciaDays: z.number().optional(),
        incoterm: z.string().optional(),
        items: z.array(ItemSchema).min(1),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: QuoteSchema }), "Creada"),
    400: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "Error"),
  },
});

export const getQuotes = createRoute({
  method: "get",
  path: "/",
  tags: ["Quotes"],
  summary: "Listar cotizaciones",
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        ok: z.boolean(),
        page: z.number(),
        size: z.number(),
        totalDocs: z.number(),
        totalPages: z.number(),
        data: z.array(QuoteSchema),
      }),
      "Listado paginado",
    ),
  },
});

export const getQuoteById = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Quotes"],
  summary: "Cotización por ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: QuoteSchema }), "Encontrada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
  },
});

export const patchQuote = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["Quotes"],
  summary: "Actualizar cotización",
  request: {
    params: z.object({ id: z.string() }),
    body: getRequestBodySchema(
      z.object({
        code: z.string().optional(),
        supplier: z.object({ name: z.string(), phone: z.string().optional() }).optional(),
        observations: z.string().optional(),
        vigenciaDays: z.number().optional(),
        incoterm: z.string().optional(),
        items: z.array(ItemSchema).optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: QuoteSchema }), "Actualizada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
  },
});

export const deleteQuote = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Quotes"],
  summary: "Eliminar cotización",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean() }), "Eliminada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
  },
});
