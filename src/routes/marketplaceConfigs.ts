// routes/marketplaceConfigs.ts
import { Hono } from "hono";
import { MarketplacePublicationConfig } from "../models/MarketplacePublicationConfig.js";
import { Product } from "../models/Product.js";
import { connectDB } from "../config/index.js";
import { authMiddleware } from "../middleware/auth.js";

export const marketplaceConfigsRoute = new Hono();

// --- Helpers ---
function parseCodesList(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[\n,;\t]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

const VALID_TARGETS = ["meli", "rappi"] as const;
function sanitizeTargets(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => (VALID_TARGETS as readonly string[]).includes(x));
}

// GET /marketplace-configs — admin: lista todas
marketplaceConfigsRoute.get("/", authMiddleware(true), async (c) => {
  await connectDB();
  const configs = await MarketplacePublicationConfig.find({})
    .sort({ createdAt: -1 })
    .lean();
  return c.json(configs);
});

// POST /marketplace-configs/match — admin
// Body: { codes: ["314BP","001"] | "314BP,001" }
// Devuelve los productos encontrados (campos mínimos) y los códigos no encontrados.
marketplaceConfigsRoute.post("/match", authMiddleware(true), async (c) => {
  await connectDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const codes = parseCodesList(body?.codes);
  if (!codes.length) return c.json({ error: "Debe enviar 'codes'." }, 400);

  const found = await Product.find(
    { Codigo: { $in: codes } },
    {
      Codigo: 1,
      Descripcion: 1,
      NomMarca: 1,
      Precios: 1,
      Existencias: 1,
      Foto: 1,
      _id: 0,
    }
  ).lean();

  const foundCodes = new Set(found.map((p: any) => String(p.Codigo)));
  const missing = codes.filter((cdg) => !foundCodes.has(cdg));

  return c.json({
    ok: true,
    requested: codes.length,
    matched: found.length,
    products: found,
    missing,
  });
});

// GET /marketplace-configs/:id — admin
marketplaceConfigsRoute.get("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const cfg = await MarketplacePublicationConfig.findById(id).lean();
  if (!cfg) return c.json({ error: "Configuración no encontrada" }, 404);
  return c.json(cfg);
});

// POST /marketplace-configs — admin
// Body: { name, slug?, description?, targets?, priceField?, priceListId?, bodegaIds?, productCodes? }
marketplaceConfigsRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const name = String(body?.name ?? "").trim();
  if (!name) return c.json({ error: "name es requerido" }, 400);

  const slug = body?.slug ? slugify(String(body.slug)) : slugify(name);
  if (!slug) return c.json({ error: "slug inválido" }, 400);

  try {
    const cfg = new MarketplacePublicationConfig({
      name,
      slug,
      description: body?.description ?? "",
      targets: sanitizeTargets(body?.targets),
      priceField: body?.priceField ?? null,
      priceListId: body?.priceListId ?? null,
      bodegaIds: Array.isArray(body?.bodegaIds)
        ? body.bodegaIds.map(String)
        : [],
      productCodes: parseCodesList(body?.productCodes),
      isActive: body?.isActive ?? true,
    });
    await cfg.save();
    return c.json(cfg, 201);
  } catch (err: any) {
    if (err.code === 11000) return c.json({ error: "El slug ya existe" }, 409);
    return c.json({ error: "Error al crear la configuración" }, 500);
  }
});

// PATCH /marketplace-configs/:id — admin
marketplaceConfigsRoute.patch("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  // Solo permite cambiar campos conocidos
  const set: Record<string, any> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.slug === "string") set.slug = slugify(body.slug);
  if (typeof body.description === "string") set.description = body.description;
  if (body.targets !== undefined) set.targets = sanitizeTargets(body.targets);
  if (body.priceField !== undefined) set.priceField = body.priceField ?? null;
  if (body.priceListId !== undefined) set.priceListId = body.priceListId ?? null;
  if (Array.isArray(body.bodegaIds)) set.bodegaIds = body.bodegaIds.map(String);
  if (body.productCodes !== undefined)
    set.productCodes = parseCodesList(body.productCodes);
  if (body.isActive !== undefined) set.isActive = !!body.isActive;

  if (!Object.keys(set).length)
    return c.json({ error: "No hay campos válidos para actualizar" }, 400);

  try {
    const updated = await MarketplacePublicationConfig.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return c.json({ error: "Configuración no encontrada" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err.code === 11000) return c.json({ error: "El slug ya existe" }, 409);
    return c.json({ error: "Error al actualizar la configuración" }, 500);
  }
});

// POST /marketplace-configs/:id/add-products — admin
// Body: { codes: [...] } → anexa referencias sin duplicar
marketplaceConfigsRoute.post("/:id/add-products", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const codes = parseCodesList(body?.codes);
  if (!codes.length) return c.json({ error: "Debe enviar 'codes'." }, 400);

  const updated = await MarketplacePublicationConfig.findByIdAndUpdate(
    id,
    { $addToSet: { productCodes: { $each: codes } } },
    { new: true }
  ).lean();
  if (!updated) return c.json({ error: "Configuración no encontrada" }, 404);

  return c.json({
    ok: true,
    added: codes.length,
    total: (updated as any).productCodes?.length ?? 0,
    config: updated,
  });
});

// POST /marketplace-configs/:id/remove-products — admin
// Body: { codes: [...] } → quita referencias
marketplaceConfigsRoute.post("/:id/remove-products", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const codes = parseCodesList(body?.codes);
  if (!codes.length) return c.json({ error: "Debe enviar 'codes'." }, 400);

  const updated = await MarketplacePublicationConfig.findByIdAndUpdate(
    id,
    { $pull: { productCodes: { $in: codes } } },
    { new: true }
  ).lean();
  if (!updated) return c.json({ error: "Configuración no encontrada" }, 404);

  return c.json({
    ok: true,
    removed: codes.length,
    total: (updated as any).productCodes?.length ?? 0,
    config: updated,
  });
});

// DELETE /marketplace-configs/:id — admin
marketplaceConfigsRoute.delete("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const deleted = await MarketplacePublicationConfig.findByIdAndDelete(id).lean();
  if (!deleted) return c.json({ error: "Configuración no encontrada" }, 404);
  return c.json({ ok: true, message: "Configuración eliminada" });
});
