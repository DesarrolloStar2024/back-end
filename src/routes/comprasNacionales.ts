import { Hono } from "hono";
import { connectDB } from "../config/index.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  CompraNacionalModel,
  COMPRA_ESTADOS,
  type CompraEstado,
} from "../models/CompraNacional.js";

export const comprasNacionalesRoute = new Hono();

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapItem = (it: any) => {
  const cantidad = toNum(it?.cantidad);
  const precioUnd = toNum(it?.precioUnd);
  return {
    codigo: String(it?.codigo ?? ""),
    referencia: String(it?.referencia ?? ""),
    descripcion: String(it?.descripcion ?? ""),
    fabricante: String(it?.fabricante ?? ""),
    marca: String(it?.marca ?? ""),
    observacion: String(it?.observacion ?? ""),
    cantidad,
    precioUnd,
    precioTotal: toNum(it?.precioTotal) || precioUnd * cantidad,
  };
};

// POST / — crear compra nacional (super admin)
comprasNacionalesRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();
  const body = await c.req.json().catch(() => ({}));

  const items = Array.isArray(body.items) ? body.items.map(mapItem) : [];
  if (!items.length) {
    return c.json({ error: "La compra no tiene productos" }, 400);
  }

  const total =
    toNum(body.total) ||
    items.reduce((acc: number, it: any) => acc + it.precioTotal, 0);

  const user = (c as any).get("user") as
    | { Codigo?: string; nombre?: string }
    | undefined;
  const code = `CN-${Date.now()}`;

  const compra = await CompraNacionalModel.create({
    code,
    channelId: body.channelId ? String(body.channelId) : "",
    createdBy: {
      code: String(user?.Codigo ?? body?.createdBy?.code ?? ""),
      name: String(user?.nombre ?? body?.createdBy?.name ?? ""),
    },
    observations: String(body.observations ?? ""),
    status: "solicitado",
    items,
    total,
    statusHistory: [{ status: "solicitado", at: new Date(), by: code }],
  });

  return c.json(compra, 201);
});

// GET / — listar (super admin) con filtros y paginación
comprasNacionalesRoute.get("/", authMiddleware(true), async (c) => {
  await connectDB();

  const status = c.req.query("status");
  const channelId = c.req.query("channelId");
  const q = (c.req.query("q") || "").trim();
  const page = Math.max(1, Number.parseInt(c.req.query("page") || "1", 10));
  const size = Math.min(
    200,
    Math.max(1, Number.parseInt(c.req.query("size") || "50", 10))
  );

  const filter: Record<string, any> = {};
  if (status && COMPRA_ESTADOS.includes(status as CompraEstado))
    filter.status = status;
  if (channelId) filter.channelId = channelId;
  if (q) filter.code = { $regex: new RegExp(q, "i") };

  const [items, totalDocs] = await Promise.all([
    CompraNacionalModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    CompraNacionalModel.countDocuments(filter),
  ]);

  return c.json({ page, size, totalDocs, items });
});

// GET /:id — detalle
comprasNacionalesRoute.get("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  try {
    const compra = await CompraNacionalModel.findById(c.req.param("id")).lean();
    if (!compra) return c.json({ error: "Compra no encontrada" }, 404);
    return c.json(compra);
  } catch {
    return c.json({ error: "ID inválido" }, 400);
  }
});

// PATCH /:id/status — cambiar estado (super admin)
comprasNacionalesRoute.patch("/:id/status", authMiddleware(true), async (c) => {
  await connectDB();
  const body = await c.req.json().catch(() => ({}));
  const status = body.status as CompraEstado;

  if (!COMPRA_ESTADOS.includes(status)) {
    return c.json({ error: "Estado inválido" }, 400);
  }

  const user = (c as any).get("user") as { Codigo?: string } | undefined;

  try {
    const compra = await CompraNacionalModel.findByIdAndUpdate(
      c.req.param("id"),
      {
        $set: { status },
        $push: {
          statusHistory: {
            status,
            at: new Date(),
            by: String(user?.Codigo ?? ""),
          },
        },
      },
      { new: true }
    ).lean();
    if (!compra) return c.json({ error: "Compra no encontrada" }, 404);
    return c.json(compra);
  } catch {
    return c.json({ error: "ID inválido" }, 400);
  }
});

// DELETE /:id — eliminar (super admin)
comprasNacionalesRoute.delete("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  try {
    const res = await CompraNacionalModel.findByIdAndDelete(c.req.param("id"));
    if (!res) return c.json({ error: "Compra no encontrada" }, 404);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "ID inválido" }, 400);
  }
});
