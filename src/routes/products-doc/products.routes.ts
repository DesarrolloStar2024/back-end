import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const ExistenciaSchema = z.object({
  Bodega: z.string(),
  Existencia: z.string(),
  Stand: z.string(),
});

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
  Existencias: z.array(ExistenciaSchema).optional(),
  TotalExist: z.number().optional(),
});

export const getProducts = createRoute({
  method: "get",
  path: "/",
  tags: ["Products"],
  summary: "Buscar productos",
  description:
    "Búsqueda avanzada con paginación, sinónimos, filtros por canal, " +
    "jerarquía (familia/grupo/subgrupo), marcas, flags (desta/nuevo/promo), stock y más.",
  request: {
    query: z.object({
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
      q: z.string().optional().openapi({ description: "Búsqueda general" }),
      buscar: z.string().optional().openapi({ description: "Alias de q" }),
      title: z.string().optional().openapi({ description: "Búsqueda por título/código/barras" }),
      codFami: z.string().optional().openapi({ description: "Código de familia" }),
      codGrupo: z.string().optional().openapi({ description: "Código de grupo" }),
      codSubgrupo: z.string().optional().openapi({ description: "Código de subgrupo" }),
      cadena: z.string().optional().openapi({ description: "Jerarquía como A-2-1" }),
      channelId: z.string().optional().openapi({ description: "ID del canal" }),
      bodegas: z.string().optional().openapi({ description: "CSV de bodegas (01,06)" }),
      stands: z.string().optional().openapi({ description: "CSV de stands (3H,2B)" }),
      stock: z.string().optional().openapi({ description: "public|agotado|all" }),
      desta: z.string().optional(),
      nuevo: z.string().optional(),
      promo: z.string().optional(),
      masve: z.string().optional(),
      marcaId: z.string().optional(),
      fabricanteId: z.string().optional(),
      order: z.string().optional().openapi({ description: "alpha|total" }),
      dir: z.string().optional().openapi({ description: "asc|desc" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        page: z.number(),
        size: z.number(),
        totalDocs: z.number(),
        totalPages: z.number(),
        data: z.array(ProductSchema),
      }),
      "Listado paginado de productos",
    ),
  },
});

export const getProductByCode = createRoute({
  method: "get",
  path: "/:codigo",
  tags: ["Products"],
  summary: "Producto por código",
  request: {
    params: z.object({ codigo: z.string() }),
    query: z.object({
      channelId: z.string().optional().openapi({ description: "Calcula TotalExist para el canal" }),
    }),
  },
  responses: {
    200: getResponseSchema(ProductSchema, "Producto encontrado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const getSuggestions = createRoute({
  method: "get",
  path: "/:codigo/suggest",
  tags: ["Products"],
  summary: "Sugerencias de productos similares",
  description: "Retorna productos similares basados en jerarquía, marca, precio y texto",
  request: {
    params: z.object({ codigo: z.string() }),
    query: z.object({
      limit: z.string().optional().openapi({ example: "10" }),
      stock: z.string().optional(),
      bodegas: z.string().optional(),
      channelId: z.string().optional(),
      stands: z.string().optional(),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        base: ProductSchema.nullable(),
        total: z.number(),
        data: z.array(ProductSchema),
      }),
      "Sugerencias de productos",
    ),
    404: getResponseSchema(z.object({ message: z.string() }), "Producto base no encontrado"),
  },
});

export const upsertProducts = createRoute({
  method: "post",
  path: "/upsert",
  tags: ["Products"],
  summary: "Upsert masivo de productos",
  description: "Crea o actualiza productos en lote por Codigo",
  request: {
    body: getRequestBodySchema(z.array(ProductSchema.partial())),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        ok: z.boolean(),
        received: z.number(),
        attempted: z.number(),
        matched: z.number(),
        modified: z.number(),
        upserted: z.number(),
      }),
      "Resultado del upsert",
    ),
  },
});

export const patchRefCatalogo = createRoute({
  method: "patch",
  path: "/:codigo/ref-catalogo",
  tags: ["Products"],
  summary: "Actualizar RefCatalogo de un producto",
  request: {
    headers: z.object({
      authorization: z.string().openapi({ default: "Bearer <token>" }),
    }),
    params: z.object({ codigo: z.string() }),
    body: getRequestBodySchema(z.object({ value: z.boolean() })),
  },
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean(), codigo: z.string(), value: z.boolean() }),
      "RefCatalogo actualizado",
    ),
  },
});

export const bulkRefCatalogo = createRoute({
  method: "post",
  path: "/ref-catalogo/bulk",
  tags: ["Products"],
  summary: "RefCatalogo en lote",
  request: {
    headers: z.object({
      authorization: z.string().openapi({ default: "Bearer <token>" }),
    }),
    body: getRequestBodySchema(
      z.object({
        codes: z.union([z.array(z.string()), z.string()]),
        value: z.boolean(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean(), requested: z.number(), matched: z.number(), modified: z.number() }),
      "Resultado bulk",
    ),
  },
});

export const patchPromoCatalogo = createRoute({
  method: "patch",
  path: "/:codigo/promo-catalogo",
  tags: ["Products"],
  summary: "Actualizar PromoCatalogo de un producto",
  request: {
    headers: z.object({
      authorization: z.string().openapi({ default: "Bearer <token>" }),
    }),
    params: z.object({ codigo: z.string() }),
    body: getRequestBodySchema(
      z.object({
        activo: z.boolean().optional(),
        promo: z.string().optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean(), codigo: z.string() }),
      "PromoCatalogo actualizado",
    ),
  },
});

export const bulkPromoCatalogo = createRoute({
  method: "post",
  path: "/promo-catalogo/bulk",
  tags: ["Products"],
  summary: "PromoCatalogo en lote",
  request: {
    headers: z.object({
      authorization: z.string().openapi({ default: "Bearer <token>" }),
    }),
    body: getRequestBodySchema(
      z.object({
        items: z.array(
          z.object({
            codigo: z.string(),
            promo: z.string(),
            activo: z.boolean().optional(),
          }),
        ).optional(),
        text: z.string().optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean(), requested: z.number(), matched: z.number(), modified: z.number() }),
      "Resultado bulk",
    ),
  },
});

export const getCatalogo = createRoute({
  method: "get",
  path: "/catalogo/:codFami",
  tags: ["Products"],
  summary: "Productos para catálogo por familia",
  description: "Retorna productos con stock filtrados por familia, separando RefCatalogo",
  request: {
    params: z.object({ codFami: z.string() }),
    query: z.object({
      channelId: z.string().optional(),
      codGrupo: z.string().optional(),
      codSubGrupo: z.string().optional(),
      cadenas: z.string().optional(),
      cadena: z.string().optional(),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        ok: z.boolean(),
        codFami: z.string(),
        total: z.number(),
        finalData: z.array(ProductSchema),
        dataRef: z.array(ProductSchema),
      }),
      "Productos del catálogo",
    ),
  },
});
