import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const SynonymSchema = z.object({
  term: z.string(),
  synonyms: z.array(z.string()),
});

const BearerHeader = z.object({
  authorization: z.string().openapi({ default: "Bearer <token>" }),
});

export const getSynonyms = createRoute({
  method: "get",
  path: "/",
  tags: ["Synonyms"],
  summary: "Listar sinónimos",
  request: {
    query: z.object({
      q: z.string().optional().openapi({ description: "Buscar por term o sinónimos" }),
      page: z.string().optional().openapi({ example: "1" }),
      size: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        page: z.number(),
        size: z.number(),
        totalDocs: z.number(),
        totalPages: z.number(),
        data: z.array(SynonymSchema),
      }),
      "Listado paginado",
    ),
  },
});

export const getSynonymByTerm = createRoute({
  method: "get",
  path: "/:term",
  tags: ["Synonyms"],
  summary: "Sinónimo por term",
  request: {
    params: z.object({ term: z.string() }),
  },
  responses: {
    200: getResponseSchema(SynonymSchema, "Sinónimo encontrado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const createSynonym = createRoute({
  method: "post",
  path: "/",
  tags: ["Synonyms"],
  summary: "Crear sinónimo",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        term: z.string().openapi({ example: "plancha" }),
        synonyms: z.array(z.string()).openapi({ example: ["pinza para cabello", "alisadora"] }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Creado"),
  },
});

export const replaceSynonym = createRoute({
  method: "put",
  path: "/:term",
  tags: ["Synonyms"],
  summary: "Reemplazar sinónimos de un term",
  request: {
    headers: BearerHeader,
    params: z.object({ term: z.string() }),
    body: getRequestBodySchema(z.object({ synonyms: z.array(z.string()) })),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const patchSynonym = createRoute({
  method: "patch",
  path: "/:term",
  tags: ["Synonyms"],
  summary: "Agregar/eliminar sinónimos",
  request: {
    headers: BearerHeader,
    params: z.object({ term: z.string() }),
    body: getRequestBodySchema(
      z.object({
        add: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const deleteSynonym = createRoute({
  method: "delete",
  path: "/:term",
  tags: ["Synonyms"],
  summary: "Eliminar sinónimo",
  request: {
    headers: BearerHeader,
    params: z.object({ term: z.string() }),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Eliminado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const upsertSynonyms = createRoute({
  method: "post",
  path: "/upsert",
  tags: ["Synonyms"],
  summary: "Upsert masivo",
  request: {
    body: getRequestBodySchema(z.array(SynonymSchema)),
  },
  responses: {
    200: getResponseSchema(
      z.object({ message: z.string(), upserts: z.number() }),
      "Resultado del upsert",
    ),
  },
});
