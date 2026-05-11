// src/lib/open-api.ts
import type { OpenAPIHono, z } from "@hono/zod-openapi";

export function configureOpenAPI(app: OpenAPIHono) {
  app.doc("/open-api", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Star Professional API ⭐",
      description:
        "API de Star Professional — Distribuidor Mayorista de Belleza.\n\n" +
        "### Autenticación\n" +
        "1. Usa **POST /auth/login-hono** con tus credenciales de SuperAdmin\n" +
        "2. Copia el `token` de la respuesta\n" +
        "3. Haz click en **Authorize** y pega: `Bearer {tu-token}`",
    },
    servers: [
      { url: "http://localhost:4000", description: "Local" },
      {
        url: "https://trainingcenterstar.com",
        description: "Producción (Vercel)",
      },
    ],
  });
}

// @ts-expect-error Union of Zod schema types is not explicitly supported by TypeScript type inference
type ZodSchema = z.ZodUnion | z.AnyZodObject | z.ZodArray<z.AnyZodObject>;

export function getResponseSchema<T extends ZodSchema>(
  schema: T,
  description: string,
) {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
    description,
  };
}

export function getRequestBodySchema<T extends ZodSchema>(schema: T) {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
  };
}
