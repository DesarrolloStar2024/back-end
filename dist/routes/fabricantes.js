import { Hono } from "hono";
import { Fabricante } from "../models/Fabricante.js";
import { ES_COLLATION } from "../utils/search.js";
import { connectDB } from "../config/index.js";
import { authMiddleware } from "../middleware/auth.js";
export const fabricantesRoute = new Hono();
// GET /api/fabricantes -> listado con paginado, q (nombre o Id), ids=csv
fabricantesRoute.get("/", authMiddleware(true), async (c) => {
    await connectDB();
    const q = (c.req.query("q") || "").trim();
    const idsCsv = (c.req.query("ids") || "").trim(); // ids=F001,F002
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const size = Math.min(500, Math.max(1, parseInt(c.req.query("size") || "50", 10)));
    const skip = (page - 1) * size;
    const filter = { $and: [] };
    if (q) {
        const rx = new RegExp(q, "i");
        filter.$and.push({ $or: [{ Id: q }, { Nombre: rx }] });
    }
    if (idsCsv) {
        const ids = idsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (ids.length)
            filter.$and.push({ Id: { $in: ids } });
    }
    if (!filter.$and.length)
        delete filter.$and;
    const [items, totalDocs] = await Promise.all([
        Fabricante.find(filter)
            .collation(ES_COLLATION)
            .sort({ Nombre: 1 })
            .skip(skip)
            .limit(size)
            .lean(),
        Fabricante.countDocuments(filter),
    ]);
    return c.json({
        page,
        size,
        totalDocs,
        totalPages: Math.ceil(totalDocs / size),
        data: items,
    });
});
// GET /api/fabricantes/:id -> por Id
fabricantesRoute.get("/:id", authMiddleware(true), async (c) => {
    await connectDB();
    const id = c.req.param("id");
    const doc = await Fabricante.findOne({ Id: id }).lean();
    if (!doc)
        return c.json({ message: "No encontrado" }, 404);
    return c.json(doc);
});
// POST /api/fabricantes -> crear uno
fabricantesRoute.post("/", authMiddleware(true), async (c) => {
    await connectDB();
    const body = await c.req.json();
    if (!body?.Id || !body?.Nombre)
        return c.json({ message: "Id y Nombre son requeridos" }, 400);
    await Fabricante.create({
        Id: String(body.Id).trim(),
        Nombre: String(body.Nombre).trim(),
    });
    return c.json({ message: "OK" });
});
// PUT /api/fabricantes/:id -> actualizar por Id
fabricantesRoute.put("/:id", authMiddleware(true), async (c) => {
    await connectDB();
    const id = c.req.param("id");
    const body = await c.req.json();
    const upd = {};
    if (body?.Nombre)
        upd.Nombre = String(body.Nombre).trim();
    const r = await Fabricante.updateOne({ Id: id }, { $set: upd });
    if (!r.matchedCount)
        return c.json({ message: "No encontrado" }, 404);
    return c.json({ message: "OK" });
});
// DELETE /api/fabricantes/:id
fabricantesRoute.delete("/:id", authMiddleware(true), async (c) => {
    await connectDB();
    const id = c.req.param("id");
    const r = await Fabricante.deleteOne({ Id: id });
    if (!r.deletedCount)
        return c.json({ message: "No encontrado" }, 404);
    return c.json({ message: "OK" });
});
// POST /api/fabricantes/upsert (bulk)
fabricantesRoute.post("/upsert", authMiddleware(true), async (c) => {
    await connectDB();
    const arr = await c.req.json();
    if (!Array.isArray(arr) || !arr.length)
        return c.json({ message: "Lista vacía" }, 400);
    let upserts = 0;
    await Promise.all(arr.map(async (row) => {
        const Id = String(row.Id || "").trim();
        const Nombre = String(row.Nombre || "").trim();
        if (!Id || !Nombre)
            return;
        await Fabricante.updateOne({ Id }, { $set: { Id, Nombre } }, { upsert: true });
        upserts++;
    }));
    return c.json({ message: "OK", upserts });
});
