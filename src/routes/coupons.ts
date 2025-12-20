import { Hono } from "hono";
import { connectDB } from "../config/index.js";
import { Coupon } from "../models/Coupon.js";
import { authMiddleware } from "../middleware/auth.js";

export const couponsRoute = new Hono();

const normalizeCode = (v: unknown) =>
  String(v || "")
    .toUpperCase()
    .trim();

/**
 * PUBLIC
 * POST /api/coupons/validate
 * body: { code: "BDSTAR" }
 * resp: { valid: true, code: "BDSTAR", discountPercentage: 0.07 }
 */
couponsRoute.post("/validate", async (c) => {
  await connectDB();

  const b = await c.req.json().catch(() => ({}));
  const code = normalizeCode(b.code);

  if (!code) return c.json({ valid: false, message: "Código requerido" }, 400);

  const coupon = await Coupon.findOne(
    { code, isActive: true },
    { _id: 0, __v: 0 }
  ).lean();

  // Respuesta genérica para no filtrar si existe o no
  if (!coupon) return c.json({ valid: false, message: "Cupón no válido" }, 404);

  return c.json({
    valid: true,
    code: coupon.code,
    discountPercentage: coupon.discountPercentage,
  });
});

/**
 * ADMIN (superadmin)
 * GET /api/coupons?q=&page=&size=
 */
couponsRoute.get("/", authMiddleware(true), async (c) => {
  await connectDB();

  const q = (c.req.query("q") || "").toUpperCase().trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const size = Math.min(
    500,
    Math.max(1, parseInt(c.req.query("size") || "50", 10))
  );
  const skip = (page - 1) * size;

  const filter: any = {};
  if (q) filter.code = { $regex: new RegExp(`^${q}`) }; // empieza por

  const [items, totalDocs] = await Promise.all([
    Coupon.find(filter, { __v: 0 })
      .sort({ code: 1 })
      .skip(skip)
      .limit(size)
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return c.json({
    page,
    size,
    totalDocs,
    totalPages: Math.ceil(totalDocs / size),
    data: items,
  });
});

/**
 * ADMIN
 * GET /api/coupons/:code
 */
couponsRoute.get("/:code", authMiddleware(true), async (c) => {
  await connectDB();
  const code = normalizeCode(c.req.param("code"));

  const doc = await Coupon.findOne({ code }, { __v: 0 }).lean();
  if (!doc) return c.json({ message: "No encontrado" }, 404);

  return c.json(doc);
});

/**
 * ADMIN
 * POST /api/coupons
 * body: { code: "BDSTAR", discountPercentage: 0.07, isActive: true }
 */
couponsRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();

  const b = await c.req.json().catch(() => ({}));
  const code = normalizeCode(b.code);
  const discountPercentage = Number(b.discountPercentage);
  const isActive = Boolean(b.isActive);

  if (!code) return c.json({ message: "code requerido" }, 400);
  if (
    !Number.isFinite(discountPercentage) ||
    discountPercentage <= 0 ||
    discountPercentage > 1
  ) {
    return c.json(
      { message: "discountPercentage debe estar entre 0 y 1" },
      400
    );
  }

  try {
    await Coupon.create({ code, discountPercentage, isActive });
    return c.json({ message: "OK" }, 201);
  } catch (err: any) {
    // Duplicado
    if (err?.code === 11000) return c.json({ message: "Cupón ya existe" }, 409);
    return c.json({ message: "Error creando cupón" }, 500);
  }
});

/**
 * ADMIN
 * PUT /api/coupons/:code (reemplaza campos principales)
 * body: { discountPercentage: 0.1, isActive: true }
 */
couponsRoute.put("/:code", authMiddleware(true), async (c) => {
  await connectDB();

  const code = normalizeCode(c.req.param("code"));
  const b = await c.req.json().catch(() => ({}));

  const update: any = {};
  if (b.discountPercentage !== undefined) {
    const d = Number(b.discountPercentage);
    if (!Number.isFinite(d) || d <= 0 || d > 1) {
      return c.json(
        { message: "discountPercentage debe estar entre 0 y 1" },
        400
      );
    }
    update.discountPercentage = d;
  }
  if (b.isActive !== undefined) update.isActive = Boolean(b.isActive);

  const r = await Coupon.updateOne({ code }, { $set: update });
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);

  return c.json({ message: "OK" });
});

/**
 * ADMIN
 * PATCH /api/coupons/:code (togglear isActive rápido)
 * body: { isActive: false }
 */
couponsRoute.patch("/:code", authMiddleware(true), async (c) => {
  await connectDB();

  const code = normalizeCode(c.req.param("code"));
  const b = await c.req.json().catch(() => ({}));

  if (b.isActive === undefined)
    return c.json({ message: "Nada para actualizar" }, 400);

  const r = await Coupon.updateOne(
    { code },
    { $set: { isActive: Boolean(b.isActive) } }
  );
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);

  return c.json({ message: "OK" });
});

/**
 * ADMIN
 * DELETE /api/coupons/:code
 */
couponsRoute.delete("/:code", authMiddleware(true), async (c) => {
  await connectDB();

  const code = normalizeCode(c.req.param("code"));
  const r = await Coupon.deleteOne({ code });

  if (!r.deletedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});
