import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const CategoriaSchema = z.object({ _id: z.string(), nombre: z.string() });
const BearerHeader = z.object({ authorization: z.string().openapi({ default: "Bearer <token>" }) });

export const getCategorias = createRoute({
  method: "get",
  path: "/",
  tags: ["Categorias"],
  summary: "Listar categorías",
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({ page: z.number(), size: z.number(), totalDocs: z.number(), totalPages: z.number(), data: z.array(CategoriaSchema) }),
      "Listado paginado",
    ),
  },
});

export const getCategoriaById = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Categorias"],
  summary: "Categoría por ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CategoriaSchema }), "Encontrada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
  },
});

export const createCategoria = createRoute({
  method: "post",
  path: "/",
  tags: ["Categorias"],
  summary: "Crear categoría",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(z.object({ nombre: z.string().min(2).max(200) })),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CategoriaSchema }), "Creada"),
    409: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "Ya existe"),
  },
});

export const patchCategoria = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["Categorias"],
  summary: "Actualizar categoría",
  request: {
    headers: BearerHeader,
    params: z.object({ id: z.string() }),
    body: getRequestBodySchema(z.object({ nombre: z.string().min(2).max(200) })),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CategoriaSchema }), "Actualizada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
  },
});

export const deleteCategoria = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Categorias"],
  summary: "Eliminar categoría",
  description: "Solo si no está en uso por catálogos",
  request: { headers: BearerHeader, params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean(), data: CategoriaSchema }), "Eliminada"),
    404: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "No encontrada"),
    409: getResponseSchema(z.object({ ok: z.boolean(), error: z.string() }), "En uso"),
  },
});
