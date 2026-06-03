import { Hono } from "hono";
import { PriceList } from "../models/PriceList.js";
import { authMiddleware } from "../middleware/auth.js";

export const pricelistsRoute = new Hono();

// GET /pricelists
// ?all=true      → admin: devuelve todas sin filtro de canal ni estado
// ?channelId=xxx → ecommerce: devuelve activas que listan explícitamente ese canal
pricelistsRoute.get("/", async (c) => {
  try {
    const all = c.req.query("all") === "true";
    const channelId = c.req.query("channelId");

    let filter: Record<string, any> = {};

    if (all) {
      // admin — sin filtros
    } else if (channelId) {
      // ecommerce: solo listas activas que listan explícitamente este canal
      filter = { isActive: true, channelIds: channelId };
    } else {
      // sin canal: no filtra por canal
      filter = { isActive: true };
    }

    const lists = await PriceList.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    return c.json(lists);
  } catch (err) {
    return c.json({ error: "Error al obtener listas de precios" }, 500);
  }
});

// GET /pricelists/default — público, devuelve la lista marcada como isDefault
pricelistsRoute.get("/default", async (c) => {
  try {
    const def = await PriceList.findOne({ isDefault: true, isActive: true }).lean();
    if (!def) return c.json({ error: "No hay lista de precios por defecto configurada" }, 404);
    return c.json(def);
  } catch (err) {
    return c.json({ error: "Error al obtener lista por defecto" }, 500);
  }
});

// GET /pricelists/:slug — público
pricelistsRoute.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug").toLowerCase().trim();
    const list = await PriceList.findOne({ slug }).lean();
    if (!list) return c.json({ error: "Lista no encontrada" }, 404);
    return c.json(list);
  } catch (err) {
    return c.json({ error: "Error al obtener lista" }, 500);
  }
});

// POST /pricelists — superadmin
pricelistsRoute.post("/", authMiddleware(true), async (c) => {
  try {
    const body = await c.req.json();
    const { name, slug, description, tiers, isActive, isDefault, channelIds, beforePriceField } = body;

    if (!name || !slug) return c.json({ error: "name y slug son requeridos" }, 400);

    // Si se marca como default, quitar el flag de los demás
    if (isDefault) {
      await PriceList.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const list = new PriceList({
      name,
      slug,
      description,
      tiers: tiers ?? [],
      isActive: isActive ?? true,
      isDefault: isDefault ?? false,
      channelIds: Array.isArray(channelIds) ? channelIds.map(String) : [],
      beforePriceField: beforePriceField ?? null,
    });
    await list.save();
    return c.json(list, 201);
  } catch (err: any) {
    if (err.code === 11000) return c.json({ error: "El slug ya existe" }, 409);
    return c.json({ error: "Error al crear lista" }, 500);
  }
});

// PATCH /pricelists/:id — superadmin
pricelistsRoute.patch("/:id", authMiddleware(true), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    // Si se marca como default, quitar el flag de los demás
    if (body.isDefault === true) {
      await PriceList.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const updated = await PriceList.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return c.json({ error: "Lista no encontrada" }, 404);
    return c.json(updated);
  } catch (err: any) {
    if (err.code === 11000) return c.json({ error: "El slug ya existe" }, 409);
    return c.json({ error: "Error al actualizar lista" }, 500);
  }
});

// POST /pricelists/reorder — superadmin — body: [{ id, order }]
pricelistsRoute.post("/reorder", authMiddleware(true), async (c) => {
  try {
    const items: { id: string; order: number }[] = await c.req.json();
    await Promise.all(
      items.map(({ id, order }) =>
        PriceList.findByIdAndUpdate(id, { $set: { order } })
      )
    );
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: "Error al reordenar" }, 500);
  }
});

// DELETE /pricelists/:id — superadmin
pricelistsRoute.delete("/:id", authMiddleware(true), async (c) => {
  try {
    const id = c.req.param("id");
    const deleted = await PriceList.findByIdAndDelete(id).lean();
    if (!deleted) return c.json({ error: "Lista no encontrada" }, 404);
    return c.json({ message: "Lista eliminada" });
  } catch (err) {
    return c.json({ error: "Error al eliminar lista" }, 500);
  }
});
