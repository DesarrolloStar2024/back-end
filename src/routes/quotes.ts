// src/routes/quotes.route.ts
import { Hono } from "hono";
import { z } from "zod";
import { connectDB } from "../config/index.js"; // tu helper existente
import { QuoteModel } from "../models/Quote.js";
import mongoose from "mongoose";

export const quotesRoute = new Hono();

/* ================== Schemas (Zod) ================== */
const itemSchema = z.object({
  barcode: z.string().optional().default(""),
  reference: z.string().min(1),

  images: z.array(z.string()).optional().default([]),

  brand: z.string().optional().default(""),
  descriptionEs: z.string().optional().default(""),
  material: z.string().optional().default(""),
  colors: z.string().optional().default(""),
  measure: z.string().optional().default(""),

  ctns: z.coerce.number().nonnegative().default(0),
  qtyPerCarton: z.coerce.number().nonnegative().default(0),
  unit: z.string().optional().default("Unidad"),
  unitPriceUSD: z.coerce.number().nonnegative().default(0),

  dimensionsCm: z.object({
    alto: z.coerce.number().nonnegative().default(0),
    ancho: z.coerce.number().nonnegative().default(0),
    largo: z.coerce.number().nonnegative().default(0),
  }),
});

const bodyCreate = z.object({
  code: z.string().optional(),
  supplier: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
  }),
  vigenciaDays: z.coerce.number().int().positive().optional(),
  incoterm: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

// Para PATCH aceptamos campos opcionales; si vienen items deben ser completos
const bodyUpdate = z.object({
  code: z.string().optional(),
  supplier: z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
    })
    .optional(),
  vigenciaDays: z.coerce.number().int().positive().optional(),
  incoterm: z.string().optional(),
  items: z.array(itemSchema).min(1).optional(),
});

const qPagination = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  size: z.coerce.number().int().min(1).max(2000).optional().default(50),
  q: z.string().optional().default(""),
});

/* ================== Helpers ================== */
type Item = z.infer<typeof itemSchema>;

function deriveFields(it: Item) {
  const totalQty = Number(it.ctns || 0) * Number(it.qtyPerCarton || 0);
  const cbm =
    (Number(it.dimensionsCm.alto || 0) *
      Number(it.dimensionsCm.ancho || 0) *
      Number(it.dimensionsCm.largo || 0)) /
    1_000_000;
  const totalCbm = Number(it.ctns || 0) * cbm;
  const sumUSD = totalQty * Number(it.unitPriceUSD || 0);
  return { ...it, totalQty, cbm, totalCbm, sumUSD };
}

function genCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const n = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `COT-${y}${m}-${n}`;
}

const paramsFromUrl = (url: string) =>
  Object.fromEntries(new URL(url).searchParams);

const isObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

/* ================== Crear ================== */
quotesRoute.post("/", async (c) => {
  await connectDB();
  try {
    const raw = await c.req.json();
    const v = bodyCreate.parse(raw);

    const items = v.items.map(deriveFields);
    const code = v.code && v.code.trim() ? v.code.trim() : genCode();

    const doc = await QuoteModel.create({
      code,
      supplier: v.supplier,
      vigenciaDays: v.vigenciaDays,
      incoterm: v.incoterm || "FOB",
      items,
    });

    return c.json({ ok: true, data: doc.toObject() });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});

/* ================== Listar ================== */
quotesRoute.get("/", async (c) => {
  await connectDB();
  try {
    const { page, size, q } = qPagination.parse(paramsFromUrl(c.req.url));

    const $match = q
      ? {
          $or: [
            { "supplier.name": { $regex: q, $options: "i" } },
            { "items.reference": { $regex: q, $options: "i" } },
            { "items.brand": { $regex: q, $options: "i" } },
            { code: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const [data, totalDocs] = await Promise.all([
      QuoteModel.find($match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * size)
        .limit(size)
        .lean(),
      QuoteModel.countDocuments($match),
    ]);

    return c.json({
      ok: true,
      page,
      size,
      totalDocs,
      totalPages: Math.ceil(totalDocs / size),
      data,
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});

/* ================== Obtener una ================== */
quotesRoute.get("/:id", async (c) => {
  await connectDB();
  try {
    const { id } = c.req.param();
    if (!isObjectId(id))
      return c.json({ ok: false, error: "ID inválido" }, 400);

    const doc = await QuoteModel.findById(id).lean();
    if (!doc) return c.json({ ok: false, error: "No encontrada" }, 404);
    return c.json({ ok: true, data: doc });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});

/* ================== Actualizar (PATCH) ================== */
quotesRoute.patch("/:id", async (c) => {
  await connectDB();
  try {
    const { id } = c.req.param();
    if (!isObjectId(id))
      return c.json({ ok: false, error: "ID inválido" }, 400);

    const raw = await c.req.json();
    const v = bodyUpdate.parse(raw);

    const patch: any = {};
    if (typeof v.code !== "undefined") patch.code = v.code?.trim() || undefined;
    if (typeof v.vigenciaDays !== "undefined")
      patch.vigenciaDays = v.vigenciaDays;
    if (typeof v.incoterm !== "undefined") patch.incoterm = v.incoterm;
    if (typeof v.supplier !== "undefined") patch.supplier = v.supplier;
    if (typeof v.items !== "undefined") patch.items = v.items.map(deriveFields);

    const updated = await QuoteModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return c.json({ ok: false, error: "No encontrada" }, 404);
    return c.json({ ok: true, data: updated });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});

/* ================== Eliminar (DELETE) ================== */
quotesRoute.delete("/:id", async (c) => {
  await connectDB();
  try {
    const { id } = c.req.param();
    if (!isObjectId(id))
      return c.json({ ok: false, error: "ID inválido" }, 400);

    const deleted = await QuoteModel.findByIdAndDelete(id).lean();
    if (!deleted) return c.json({ ok: false, error: "No encontrada" }, 404);

    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});
