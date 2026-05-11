import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const CatalogoSchema = z.object({
  _id: z.string(),
  titulo: z.string(),
  categoria: z.object({ _id: z.string(), nombre: z.string() }).optional(),
});

const BearerHeader = z.object({ authorization: z.string().openapi({ default: "Bearer <token>" }) });

export const getCatalogos = createRoute({
  method: "get",
  path: "/",
  tags: ["Catalogos"],
  summary: "Listar catálogos",
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({ page: z.number(), size: z.number(), totalDocs: z.number(), totalPages: z.number(), data: z.array(CatalogoSchema) }),
      "Listado paginado",
    ),
  },
});

export const getCatalogoById = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Catalogos"],
  summary: "Catálogo por ID",
  request: { headers: BearerHeader, params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CatalogoSchema }), "Encontrado"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrado"),
  },
});

export const createCatalogo = createRoute({
  method: "post",
  path: "/",
  tags: ["Catalogos"],
  summary: "Crear catálogo",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        titulo: z.string().min(2).max(200),
        categoriaId: z.string().min(1),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CatalogoSchema }), "Creado"),
    409: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "Ya existe"),
  },
});

export const patchCatalogo = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["Catalogos"],
  summary: "Actualizar catálogo",
  request: {
    headers: BearerHeader,
    params: z.object({ id: z.string() }),
    body: getRequestBodySchema(
      z.object({ titulo: z.string().optional(), categoriaId: z.string().optional() }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CatalogoSchema }), "Actualizado"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrado"),
  },
});

export const deleteCatalogo = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Catalogos"],
  summary: "Eliminar catálogo",
  request: { headers: BearerHeader, params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CatalogoSchema }), "Eliminado"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrado"),
  },
});
