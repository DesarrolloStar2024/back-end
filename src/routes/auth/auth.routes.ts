import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

export const loginRoute = createRoute({
  method: "post",
  path: "/login-hono",
  tags: ["Auth"],
  summary: "Login de SuperAdmin",
  description:
    "Autentica un SuperAdmin y retorna un JWT. " +
    "Busca por Codigo = usuario o Id = vend.",
  request: {
    body: getRequestBodySchema(
      z.object({
        usuario: z.string().optional().openapi({ example: "ADMIN01" }),
        vend: z.union([z.string(), z.number()]).optional().openapi({ example: "1" }),
        expireAt: z.number().optional().openapi({
          description: "Unix timestamp de expiración (default 12h)",
        }),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        message: z.string(),
        token: z.string(),
        user: z.object({
          usuario: z.string().optional(),
          vend: z.union([z.string(), z.number()]).optional(),
          isSuperAdmin: z.boolean(),
        }),
        isSuperAdmin: z.boolean(),
      }),
      "SuperAdmin autenticado",
    ),
    400: getResponseSchema(
      z.object({ message: z.string() }),
      "Datos insuficientes",
    ),
    403: getResponseSchema(
      z.object({ message: z.string(), isSuperAdmin: z.boolean() }),
      "No autorizado",
    ),
  },
});
