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
  titulo: z.string().min(2).max(200),
  categoriaId: z.string().min(1),
});
const partialBody = bodySchema.partial();

const paramsFromUrl = (url: string) =>
  Object.fromEntries(new URL(url).searchParams);

export const catalogosRoute = new Hono();

// Listar
catalogosRoute.get("/", async (c) => {
  await connectDB();
  const { page, size, q } = qPagination.parse(paramsFromUrl(c.req.url));
  const $match = q
    ? {
        titulo: {
          $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        },
      }
    : {};

  const [data, totalDocs] = await Promise.all([
    CatalogoModel.find($match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(size)
      .populate("categoria", "nombre")
      .lean(),
    CatalogoModel.countDocuments($match),
  ]);

  return c.json({
    page,
    size,
    totalDocs,
    totalPages: Math.ceil(totalDocs / size),
    data,
  });
});

// Obtener uno
catalogosRoute.get("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const { id } = c.req.param();
  const doc = await CatalogoModel.findById(id)
    .populate("categoria", "nombre")
    .lean();
  if (!doc) return c.json({ ok: false, error: "No encontrado" }, 404);
  return c.json({ ok: true, data: doc });
});

// Crear
catalogosRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();
  const raw = await c.req.json();
  const { titulo, categoriaId } = bodySchema.parse(raw);

  // valida categoría
  const cat = await CategoriaModel.findById(categoriaId).lean();
  if (!cat) return c.json({ ok: false, error: "Categoría no existe" }, 400);

  // evita duplicado por título si quieres único
  const exist = await CatalogoModel.findOne({ titulo }).lean();
  if (exist) return c.json({ ok: false, error: "El catálogo ya existe" }, 409);

  const created = await CatalogoModel.create({
    titulo,
    categoria: categoriaId,
  });
  const populated = await CatalogoModel.findById(created._id)
    .populate("categoria", "nombre")
    .lean();
  return c.json({ ok: true, data: populated });
});

// Actualizar
catalogosRoute.patch("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const { id } = c.req.param();
  const raw = await c.req.json();
  const body = partialBody.parse(raw);

  if (body.categoriaId) {
    const cat = await CategoriaModel.findById(body.categoriaId).lean();
    if (!cat) return c.json({ ok: false, error: "Categoría no existe" }, 400);
  }

  const updated = await CatalogoModel.findByIdAndUpdate(
    id,
    {
      ...(body.titulo ? { titulo: body.titulo } : {}),
      ...(body.categoriaId ? { categoria: body.categoriaId } : {}),
    },
    { new: true, runValidators: true }
  )
    .populate("categoria", "nombre")
    .lean();

  if (!updated) return c.json({ ok: false, error: "No encontrado" }, 404);
  return c.json({ ok: true, data: updated });
});

// Eliminar
catalogosRoute.delete("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const { id } = c.req.param();
  const deleted = await CatalogoModel.findByIdAndDelete(id).lean();
  if (!deleted) return c.json({ ok: false, error: "No encontrado" }, 404);
  return c.json({ ok: true, data: deleted });
});
