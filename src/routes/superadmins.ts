import { Hono } from "hono";
import { connectDB } from "../config/index.js";
import { ES_COLLATION } from "../utils/search.js";
import { SuperAdmin } from "../models/SuperAdmin.js";
import { authMiddleware } from "../middleware/auth.js";

export const superAdminsRoute = new Hono();

// GET /api/superadmins -> listado con paginado, q (Id/Codigo), ids=csv
superAdminsRoute.get("/", async (c) => {
  await connectDB();
  const q = (c.req.query("q") || "").trim();
  const idsCsv = (c.req.query("ids") || "").trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const size = Math.min(
    500,
    Math.max(1, parseInt(c.req.query("size") || "50", 10))
  );
  const skip = (page - 1) * size;

  const filter: any = { $and: [] };
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$and.push({ $or: [{ Id: rx }, { Codigo: rx }] });
  }
  if (idsCsv) {
    const ids = idsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) filter.$and.push({ Id: { $in: ids } });
  }
  if (!filter.$and.length) delete filter.$and;

  const [items, totalDocs] = await Promise.all([
    SuperAdmin.find(filter)
      .collation(ES_COLLATION)
      .sort({ Id: 1 })
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

// GET /api/superadmins/:id
superAdminsRoute.get("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const doc = await SuperAdmin.findOne({ Id: id }).lean();
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

// PUT /api/superadmins/:id
superAdminsRoute.put("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const body = await c.req.json();
  const upd: any = {};
  if (body?.Codigo) upd.Codigo = String(body.Codigo).trim();
  const r = await SuperAdmin.updateOne({ Id: id }, { $set: upd });
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// DELETE /api/superadmins/:id
superAdminsRoute.delete("/:id", authMiddleware(true), async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const r = await SuperAdmin.deleteOne({ Id: id });
  if (!r.deletedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// POST /api/superadmins/upsert (bulk)
superAdminsRoute.post("/upsert", async (c) => {
  await connectDB();
  const arr = await c.req.json();
  if (!Array.isArray(arr) || !arr.length)
    return c.json({ message: "Lista vacía" }, 400);
  let upserts = 0;
  await Promise.all(
    arr.map(async (row: any) => {
      const Id = String(row.Id || "").trim();
      const Codigo = String(row.Codigo || "").trim();
      if (!Id || !Codigo) return;
      await SuperAdmin.updateOne(
        { Id },
        { $set: { Id, Codigo } },
        { upsert: true }
      );
      upserts++;
    })
  );
  return c.json({ message: "OK", upserts });
});
