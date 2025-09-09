import { Hono } from "hono";
import { connectDB } from "../config/db.js";
import { Synonym } from "../models/Synonym.js";
import { ES_COLLATION } from "../utils/search.js";

export const synonymsRoute = new Hono();

// GET /api/synonyms -> listado con paginado y búsqueda por term/synonyms
synonymsRoute.get("/", async (c) => {
  await connectDB();
  const q = (c.req.query("q") || "").toLowerCase().trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const size = Math.min(
    1000,
    Math.max(1, parseInt(c.req.query("size") || "50", 10))
  );
  const skip = (page - 1) * size;

  const filter: any = {};
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = [{ term: rx }, { synonyms: rx }];
  }

  const [items, totalDocs] = await Promise.all([
    Synonym.find(filter, { _id: 0, __v: 0 })
      .collation(ES_COLLATION)
      .sort({ term: 1 })
      .skip(skip)
      .limit(size)
      .lean(),
    Synonym.countDocuments(filter),
  ]);

  return c.json({
    page,
    size,
    totalDocs,
    totalPages: Math.ceil(totalDocs / size),
    data: items,
  });
});

// GET /api/synonyms/:term
synonymsRoute.get("/:term", async (c) => {
  await connectDB();
  const term = String(c.req.param("term")).toLowerCase().trim();
  const doc = await Synonym.findOne({ term }, { _id: 0, __v: 0 }).lean();
  if (!doc) return c.json({ message: "No encontrado" }, 404);
  return c.json(doc);
});

// POST /api/synonyms -> crear uno
// body: { term: "plancha", synonyms: ["pinza para cabello","alisadora"] }
synonymsRoute.post("/", async (c) => {
  await connectDB();
  const b = await c.req.json();
  const term = String(b.term || "")
    .toLowerCase()
    .trim();
  const synonyms = (b.synonyms || [])
    .map((s: string) => String(s).toLowerCase().trim())
    .filter(Boolean);
  if (!term) return c.json({ message: "term requerido" }, 400);
  await Synonym.create({ term, synonyms });
  return c.json({ message: "OK" });
});

// PUT /api/synonyms/:term -> reemplaza synonyms
synonymsRoute.put("/:term", async (c) => {
  await connectDB();
  const term = String(c.req.param("term")).toLowerCase().trim();
  const b = await c.req.json();
  const synonyms = (b.synonyms || [])
    .map((s: string) => String(s).toLowerCase().trim())
    .filter(Boolean);
  const r = await Synonym.updateOne({ term }, { $set: { synonyms } });
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// PATCH /api/synonyms/:term -> agrega/elimina
// body: { add: ["..."], remove: ["..."] }
synonymsRoute.patch("/:term", async (c) => {
  await connectDB();
  const term = String(c.req.param("term")).toLowerCase().trim();
  const b = await c.req.json();
  const add = (b.add || [])
    .map((s: string) => String(s).toLowerCase().trim())
    .filter(Boolean);
  const remove = (b.remove || [])
    .map((s: string) => String(s).toLowerCase().trim())
    .filter(Boolean);

  const ops: any = {};
  if (add.length) ops.$addToSet = { synonyms: { $each: add } };
  if (remove.length) ops.$pull = { synonyms: { $in: remove } };
  if (!Object.keys(ops).length)
    return c.json({ message: "Nada para actualizar" }, 400);

  const r = await Synonym.updateOne({ term }, ops);
  if (!r.matchedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// DELETE /api/synonyms/:term
synonymsRoute.delete("/:term", async (c) => {
  await connectDB();
  const term = String(c.req.param("term")).toLowerCase().trim();
  const r = await Synonym.deleteOne({ term });
  if (!r.deletedCount) return c.json({ message: "No encontrado" }, 404);
  return c.json({ message: "OK" });
});

// POST /api/synonyms/upsert (bulk)
// body: [{ term:"plancha", synonyms:["pinza para cabello","alisadora"] }, ...]
synonymsRoute.post("/upsert", async (c) => {
  await connectDB();
  const body = await c.req.json();
  if (!Array.isArray(body) || !body.length)
    return c.json({ message: "Lista vacía" }, 400);

  let upserts = 0;
  for (const row of body) {
    const term = String(row.term || "")
      .toLowerCase()
      .trim();
    const synonyms: string[] = (row.synonyms || [])
      .map((s: string) => s.toLowerCase().trim())
      .filter(Boolean);
    if (!term) continue;
    await Synonym.updateOne(
      { term },
      { $set: { term, synonyms } },
      { upsert: true }
    );
    upserts++;
  }
  return c.json({ message: "OK", upserts });
});
