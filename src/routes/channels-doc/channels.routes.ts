import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const ChannelSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  bodegas: z.array(z.string()),
  marcas: z.array(z.string()),
});

const BearerHeader = z.object({
  authorization: z.string().openapi({ default: "Bearer <token>" }),
});

export const getChannels = createRoute({
  method: "get",
  path: "/",
  tags: ["Channels"],
  summary: "Listar canales",
  description: "Retorna todos los canales configurados",
  responses: {
    200: getResponseSchema(z.array(ChannelSchema), "Lista de canales"),
  },
});

export const getChannelById = createRoute({
  method: "get",
  path: "/:id",
  tags: ["Channels"],
  summary: "Canal por ID",
  request: {
    params: z.object({ id: z.string().openapi({ description: "MongoDB ObjectId" }) }),
  },
  responses: {
    200: getResponseSchema(ChannelSchema, "Canal encontrado"),
    404: getResponseSchema(z.object({ error: z.string() }), "No encontrado"),
  },
});

export const createChannel = createRoute({
  method: "post",
  path: "/",
  tags: ["Channels"],
  summary: "Crear canal",
  request: {
    body: getRequestBodySchema(
      z.object({
        name: z.string().openapi({ example: "StarProfesional" }),
        slug: z.string().openapi({ example: "star-profesional" }),
        bodegas: z.array(z.string()).openapi({ example: ["01", "06"] }),
        marcas: z.array(z.string()).optional().openapi({ example: ["1", "10"] }),
      }),
    ),
  },
  responses: {
    201: getResponseSchema(ChannelSchema, "Canal creado"),
    400: getResponseSchema(z.object({ error: z.string() }), "Datos faltantes"),
    409: getResponseSchema(z.object({ error: z.string() }), "Slug duplicado"),
  },
});

export const patchChannel = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["Channels"],
  summary: "Actualizar canal",
  request: {
    params: z.object({ id: z.string() }),
    body: getRequestBodySchema(
      z.object({
        name: z.string().optional(),
        slug: z.string().optional(),
        bodegas: z.array(z.string()).optional(),
        marcas: z.array(z.string()).optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(ChannelSchema, "Canal actualizado"),
    404: getResponseSchema(z.object({ error: z.string() }), "No encontrado"),
  },
});

export const deleteChannel = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["Channels"],
  summary: "Eliminar canal",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: getResponseSchema(z.object({ ok: z.boolean() }), "Canal eliminado"),
    404: getResponseSchema(z.object({ error: z.string() }), "No encontrado"),
  },
});

export const getChannelMarcas = createRoute({
  method: "get",
  path: "/:id/marcas",
  tags: ["Channels"],
  summary: "Marcas del canal",
  description: "Retorna las marcas del canal con nombre (cruce con Sysplus /traemarcas)",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        RESP: z.array(z.object({ Codigo: z.string(), Nombre: z.string() })),
      }),
      "Marcas del canal",
    ),
    404: getResponseSchema(z.object({ error: z.string() }), "Canal no encontrado"),
  },
});
