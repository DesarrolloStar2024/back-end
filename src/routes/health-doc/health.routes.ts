import { createRoute, z } from "@hono/zod-openapi";
import { getResponseSchema } from "../../lib/open-api.js";

export const healthCheckRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "Health check",
  description: "Verifica el estado del servicio",
  responses: {
    200: getResponseSchema(
      z.object({ ok: z.boolean() }),
      "Servicio funcionando",
    ),
  },
});
