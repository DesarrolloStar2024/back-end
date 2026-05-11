import { OpenAPIHono } from "@hono/zod-openapi";
import { healthCheckRoute } from "./health.routes.js";

const health = new OpenAPIHono();

health.openapi(healthCheckRoute, (c) => {
  return c.json({ ok: true }, 200);
});

export default health;
