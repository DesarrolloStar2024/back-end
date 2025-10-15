import { Hono } from "hono";
import { connectDB } from "../config/index.js";
import { ES_COLLATION } from "../utils/search.js";
import { SuperAdmin } from "../models/SuperAdmin.js";
import { authMiddleware } from "../middleware/auth.js";

export const superAdminsRoute = new Hono();

// GET /api/superadmins -> listado con paginado, q (Id/Codigo), codigos=csv
superAdminsRoute.get("/", async (c) => {
  await connectDB();
  const q = (c.req.query("q") || "").trim();
  const codigosCsv = (c.req.query("codigos") || "").trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const size = Math.min(
    500,
    Math.max(1, parseInt(c.req.query("size") || "50", 10))
  );
  const skip = (page - 1) * size;

  const filter: any = { $and: [] };
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$and.push({ $or: [{ Codigo: rx }, { Id: rx }] });
  }
  if (codigosCsv) {
    const codigos = codigosCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (codigos.length) filter.$and.push({ Codigo: { $in: codigos } });
  }
  if (!filter.$and.length) delete filter.$and;

  const [items, totalDocs] = await Promise.all([
    SuperAdmin.find(filter)
      .collation(ES_COLLATION)
      .sort({ Codigo: 1 }) // orden por Codigo
      .skip(skip)
      .limit(size)
      .lean(),
    SuperAdmin.countDocuments(filter),
  ]);

  return c.json({
    page,
    size,
    totalDocs,
    totalPages: Math.ceil(totalDocs / size),
    data: items,
  });
});

// GET /api/superadmins/:codigo
superAdminsRoute.get("/:codigo", authMiddleware(true), async (c) => {
  await connectDB();
  const codigo = c.req.param("codigo");
  const doc = await SuperAdmin.findOne({ Codigo: codigo }).lean();
  if (!doc) return c.json({ message: "No encontrado" }, 404);
  return c.json(doc);
});

// POST /api/superadmins
superAdminsRoute.post("/", authMiddleware(true), async (c) => {
  await connectDB();
  const body = await c.req.json();
  if (!body?.Id || !body?.Codigo)
    return c.json({ message: "Id y Codigo son requeridos" }, 400);

  await SuperAdmin.create({
    Id: String(body.Id).trim(),
    Codigo: String(body.Codigo).trim(),
  });
  return c.json({ message: "OK" });
});

// PUT /api/superadmins/:codigo  -> permite cambiar campos (p.ej. Id)
// (si quieres permitir cambiar el propio Codigo, también lo aceptamos)
superAdminsRoute.put("/:codigo", authMiddleware(true), async (c) => {
  await connectDB();
  const codigo = c.req.param("codigo");
  const body = await c.req.json();
  const upd: any = {};
  if (body?.Id !== undefined) upd.Id = String(body.Id).trim();
  if (body?.Codigo !== undefined) upd.Codigo = String(body.Codigo).trim(); // opcional: cambiar clave

  const r = await SuperAdmin.updateOne({ Codigo: codigo }, { $set: upd });
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// DELETE /api/superadmins/:codigo
superAdminsRoute.delete("/:codigo", authMiddleware(true), async (c) => {
  await connectDB();
  const codigo = c.req.param("codigo");
  const r = await SuperAdmin.deleteOne({ Codigo: codigo });
  if (!r.deletedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// POST /api/superadmins/upsert (bulk) -> clave en Codigo
superAdminsRoute.post("/upsert", async (c) => {
  await connectDB();
  const arr = await c.req.json();
  if (!Array.isArray(arr) || !arr.length)
    return c.json({ message: "Lista vacía" }, 400);

  let upserts = 0;
  await Promise.all(
    arr.map(async (row: any) => {
      const Codigo = String(row.Codigo || "").trim();
      const Id = String(row.Id || "").trim();
      if (!Codigo || !Id) return;
      await SuperAdmin.updateOne(
        { Codigo },
        { $set: { Codigo, Id } },
        { upsert: true }
      );
      upserts++;
    })
  );
  return c.json({ message: "OK", upserts });
});
