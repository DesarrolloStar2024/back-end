import { createRoute, z } from "@hono/zod-openapi";
import { getRequestBodySchema, getResponseSchema } from "../../lib/open-api.js";

const CouponSchema = z.object({
  code: z.string(),
  discountPercentage: z.number(),
  isActive: z.boolean(),
});

const BearerHeader = z.object({
  authorization: z.string().openapi({ default: "Bearer <token>" }),
});

export const validateCoupon = createRoute({
  method: "post",
  path: "/validate",
  tags: ["Coupons"],
  summary: "Validar cupón (público)",
  description: "Verifica si un código de cupón es válido y activo",
  request: {
    body: getRequestBodySchema(
      z.object({ code: z.string().openapi({ example: "BDSTAR" }) }),
    ),
  },
  responses: {
    200: getResponseSchema(
      z.object({ valid: z.boolean(), code: z.string(), discountPercentage: z.number() }),
      "Cupón válido",
    ),
    400: getResponseSchema(z.object({ valid: z.boolean(), message: z.string() }), "Código requerido"),
    404: getResponseSchema(z.object({ valid: z.boolean(), message: z.string() }), "No válido"),
  },
});

export const getCoupons = createRoute({
  method: "get",
  path: "/",
  tags: ["Coupons"],
  summary: "Listar cupones (admin)",
  request: {
    headers: BearerHeader,
    query: z.object({
      q: z.string().optional(),
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
        data: z.array(CouponSchema),
      }),
      "Listado paginado",
    ),
  },
});

export const createCoupon = createRoute({
  method: "post",
  path: "/",
  tags: ["Coupons"],
  summary: "Crear cupón (admin)",
  request: {
    headers: BearerHeader,
    body: getRequestBodySchema(
      z.object({
        code: z.string().openapi({ example: "BDSTAR" }),
        discountPercentage: z.number().openapi({ example: 0.07, description: "Entre 0 y 1" }),
        isActive: z.boolean().openapi({ example: true }),
      }),
    ),
  },
  responses: {
    201: getResponseSchema(z.object({ message: z.string() }), "Creado"),
    409: getResponseSchema(z.object({ message: z.string() }), "Duplicado"),
  },
});

export const updateCoupon = createRoute({
  method: "put",
  path: "/:code",
  tags: ["Coupons"],
  summary: "Actualizar cupón (admin)",
  request: {
    headers: BearerHeader,
    params: z.object({ code: z.string() }),
    body: getRequestBodySchema(
      z.object({
        discountPercentage: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    ),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const toggleCoupon = createRoute({
  method: "patch",
  path: "/:code",
  tags: ["Coupons"],
  summary: "Toggle activo/inactivo (admin)",
  request: {
    headers: BearerHeader,
    params: z.object({ code: z.string() }),
    body: getRequestBodySchema(z.object({ isActive: z.boolean() })),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Actualizado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});

export const deleteCoupon = createRoute({
  method: "delete",
  path: "/:code",
  tags: ["Coupons"],
  summary: "Eliminar cupón (admin)",
  request: {
    headers: BearerHeader,
    params: z.object({ code: z.string() }),
  },
  responses: {
    200: getResponseSchema(z.object({ message: z.string() }), "Eliminado"),
    404: getResponseSchema(z.object({ message: z.string() }), "No encontrado"),
  },
});
