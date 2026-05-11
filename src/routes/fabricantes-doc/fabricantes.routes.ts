import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const FabricanteSchema = z.object({ Id: z.string(), Nombre: z.string() });
const BearerHeader = z.object({ authorization: z.string().openapi({ default: "Bearer <token>" }) });

export const getFabricantes = createRoute({
  method: "get",
  path: "/",
  tags: ["Fabricantes"],
  summary: "Listar fabricantes",
  request: {
    headers: BearerHeader,
    query: z.object({
      q: z.string().optional(),
      ids: z.string().optional().openapi({ description: "CSV de IDs" }),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({ page: z.number(), size: z.number(), totalDocs: z.number(), totalPages: z.number(), data: z.array(FabricanteSchema) }),
      "Listado paginado",
    ),
  },
});

export const getFabricanteById = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Fabricantes"],
  summary: "Fabricante por Id",
  request: { headers: BearerHeader, params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(FabricanteSchema, "Encontrado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const createFabricante = createRoute({
  method: "post",
  path: "/",
  tags: ["Fabricantes"],
  summary: "Crear fabricante",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(z.object({ Id: z.string(), Nombre: z.string() })),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Creado"),
  },
});

export const updateFabricante = createRoute({
  method: "put",
  path: "/:id",
  tags: ["Fabricantes"],
  summary: "Actualizar fabricante",
  request: {
    headers: BearerHeader,
    params: z.object({ id: z.string() }),
    body: getRequestBodySchema(z.object({ Nombre: z.string().optional() })),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const deleteFabricante = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Fabricantes"],
  summary: "Eliminar fabricante",
  request: { headers: BearerHeader, params: z.object({ id: z.string() }) },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Eliminado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const upsertFabricantes = createRoute({
  method: "post",
  path: "/upsert",
  tags: ["Fabricantes"],
  summary: "Upsert masivo",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(z.array(FabricanteSchema)),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string(), upserts: z.number() }), "Resultado"),
  },
});
