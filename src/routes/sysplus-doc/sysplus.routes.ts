import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const BearerHeader = z.object({ authorization: z.string().openapi({ default: "Bearer <token>" }) });

export const postCotizacionLog = createRoute({
  method: "post",
  path: "/cotizacion/log",
  tags: ["Sysplus"],
  summary: "Registrar log de cotización",
  description: "Guarda el log y descuenta stock si la cotización fue exitosa (prioridad: 01 > 06 > otra)",
  request: {
    body: getRequestBodySchema(
      z.object({
        requestBody: z.object({
          VEND: z.number(),
          NIT: z.string(),
          SUCU: z.string(),
          OBS: z.string().optional(),
          ITEMS: z.array(z.object({ BARRAS: z.string(), CANT: z.number() })),
        }),
        sysplusResponse: z.any(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({
        ok: z.boolean(),
        logId: z.string(),
        status: z.string(),
        createdAt: z.string(),
        updatedStock: z.any(),
      }),
      "Log registrado",
    ),
    400: getResponseSchema(z.object({ ok: z.boolean(), message: z.string() }), "Datos faltantes"),
  },
});

export const getCotizacionLogs = createRoute({
  method: "get",
  path: "/cotizacion/logs",
  tags: ["Sysplus"],
  summary: "Listar logs de cotizaciones",
  request: {
    headers: BearerHeader,
    query: z.object({
      status: z.string().optional().openapi({ description: "success|error" }),
      vendedor: z.string().optional(),
      cliente: z.string().optional(),
      page: z.string().optional().openapi({ example: "1" }),
      limit: z.string().optional().openapi({ example: "50" }),
    }),
  },
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean(), total: z.number(), page: z.number(), pages: z.number(), data: z.array(z.any()) }),
      "Listado de logs",
    ),
  },
});
