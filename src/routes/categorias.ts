import { Hono } from "hono";
import { z } from "zod";
import { connectDB } from "../config/index.js";
import { CategoriaModel } from "../models/Categoria.js";
import { authMiddleware } from "../middleware/auth.js";
import { CatalogoModel } from "../models/Catalogo.js";

const qPagination = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  size: z.coerce.number().int().min(1).max(2000).optional().default(50),
  q: z.string().optional().default(""),
});
const bodySchema = z.object({
  nombre: z.string().min(2).max(200),
});

const paramsFromUrl = (url: string) =>
  Object.fromEntries(new URL(url).searchParams);

export const categoriasRoute = new Hono();

// Listar
categoriasRoute.get("/", async (c) => {
  await connectDB();
  const { page, size, q } = qPagination.parse(paramsFromUrl(c.req.url));
  const $match = q
    ? {
        nombre: {
          $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        },
      }
    : {};

  const [data, totalDocs] = await Promise.all([
    CategoriaModel.find($match)
      .sort({ nombre: 1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    CategoriaModel.countDocuments($match),
  ]);

  return c.json({
    page,
    size,
    totalDocs,
    totalPages: Math.ceil(totalDocs / size),
    data,
  });
});

// Obtener una
categoriasRoute.get("/:id", async (c) => {
  await connectDB();
  const { id } = c.req.param();
  const doc = await CategoriaModel.findById(id).lean();
  if (!doc) return c.json({ ok: false, error: "No encontrada" }, 404);
  return c.json({ ok: true, data: doc });
});

// Crear
categoriasRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();
  const raw = await c.req.json();
  const { nombre } = bodySchema.parse(raw);

  const exist = await CategoriaModel.findOne({ nombre }).lean();
  if (exist) return c.json({ ok: false, error: "La categoría ya existe" }, 409);

  const created = await CategoriaModel.create({ nombre });
  return c.json({ ok: true, data: created.toObject() });
});

// Actualizar
categoriasRoute.patch("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const { id } = c.req.param();
  const raw = await c.req.json();
  const { nombre } = bodySchema.parse(raw);

  const updated = await CategoriaModel.findByIdAndUpdate(
    id,
    { nombre },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) return c.json({ ok: false, error: "No encontrada" }, 404);
  return c.json({ ok: true, data: updated });
});

// Eliminar (si no está en uso)
categoriasRoute.delete("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const { id } = c.req.param();

  const inUse = await CatalogoModel.countDocuments({ categoria: id });
  if (inUse > 0) {
    return c.json(
      { ok: false, error: "No se puede eliminar: está usada por catálogos" },
      409
    );
  }

  const deleted = await CategoriaModel.findByIdAndDelete(id).lean();
  if (!deleted) return c.json({ ok: false, error: "No encontrada" }, 404);
  return c.json({ ok: true, data: deleted });
});
