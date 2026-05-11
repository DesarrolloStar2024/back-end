import { createRoute, z } from "@hono/zod-openapi";
import { getResponseSchema } from "../../lib/open-api.js";

export const getSitemap = createRoute({
  method: "get",
  path: "/",
  tags: ["SEO"],
  summary: "Sitemap XML dinámico",
  description: "Genera un sitemap.xml con productos, familias, marcas y fabricantes",
  responses: {
    200: {
      description: "Sitemap XML",
      content: {
        "application/xml": {
          schema: z.string(),
        },
      },
    },
  },
});
