import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const SuperAdminSchema = z.object({
  Id: z.string(),
  Codigo: z.string(),
});

const BearerHeader = z.object({
  authorization: z.string().openapi({ default: "Bearer <token>" }),
});

const PaginatedSA = z.object({
  page: z.number(),
  size: z.number(),
  totalDocs: z.number(),
  totalPages: z.number(),
  data: z.array(SuperAdminSchema),
});

export const getSuperAdmins = createRoute({
  method: "get",
  path: "/",
  tags: ["SuperAdmins"],
  summary: "Listar SuperAdmins",
  request: {
    query: z.object({
      q: z.string().optional().openapi({ description: "Buscar por Id o Codigo" }),
      codigos: z.string().optional().openapi({ description: "CSV de códigos" }),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(PaginatedSA, "Listado paginado"),
  },
});

export const getSuperAdminByCodigo = createRoute({
  method: "get",
  path: "/:codigo",
  tags: ["SuperAdmins"],
  summary: "SuperAdmin por Codigo",
  request: {
    headers: BearerHeader,
    params: z.object({ codigo: z.string() }),
  },
  responses: {
    200: getResponseSchema(SuperAdminSchema, "SuperAdmin encontrado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const createSuperAdmin = createRoute({
  method: "post",
  path: "/",
  tags: ["SuperAdmins"],
  summary: "Crear SuperAdmin",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        Id: z.string().openapi({ example: "1" }),
        Codigo: z.string().openapi({ example: "ADMIN01" }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Creado"),
    400: getResponseSchema(z.object({ message: z.string() }), "Datos faltantes"),
  },
});

export const updateSuperAdmin = createRoute({
  method: "put",
  path: "/:codigo",
  tags: ["SuperAdmins"],
  summary: "Actualizar SuperAdmin",
  request: {
    headers: BearerHeader,
    params: z.object({ codigo: z.string() }),
    body: getRequestBodySchema(
      z.object({
        Id: z.string().optional(),
        Codigo: z.string().optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const deleteSuperAdmin = createRoute({
  method: "delete",
  path: "/:codigo",
  tags: ["SuperAdmins"],
  summary: "Eliminar SuperAdmin",
  request: {
    headers: BearerHeader,
    params: z.object({ codigo: z.string() }),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Eliminado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const upsertSuperAdmins = createRoute({
  method: "post",
  path: "/upsert",
  tags: ["SuperAdmins"],
  summary: "Upsert masivo",
  request: {
    body: getRequestBodySchema(z.array(SuperAdminSchema)),
  },
  responses: {
    200: getResponseSchema(
      z.object({ message: z.string(), upserts: z.number() }),
      "Resultado del upsert",
    ),
  },
});
