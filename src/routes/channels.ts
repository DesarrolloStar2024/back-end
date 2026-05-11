import { Hono } from "hono";
import axios from "axios";
import { Channel, type IChannel } from "../models/Channel.js";
import { connectDB } from "../config/index.js";

const MARCAS_URL = process.env.MARCAS_URL || "http://190.60.237.164/traemarcas";

export const channelsRoute = new Hono();

// GET /channels — listar todos los canales
channelsRoute.get("/", async (c) => {
  await connectDB();
  const data = await Channel.find().lean();
  return c.json(data);
});

// GET /channels/:id — canal por ID
channelsRoute.get("/:id", async (c) => {
  await connectDB();
  const id = c.req.param("id");

  let channel: IChannel | null;
  try {
    channel = (await Channel.findById(id).lean()) as IChannel | null;
  } catch {
    return c.json({ error: "ID de canal inválido" }, 400);
  }

  if (!channel) {
    return c.json({ error: "Canal no encontrado" }, 404);
  }

  return c.json(channel);
});

// POST /channels — crear canal nuevo
channelsRoute.post("/", async (c) => {
  await connectDB();
  const body = await c.req.json();

  if (!body.name || !body.slug || !body.bodegas?.length) {
    return c.json({ error: "name, slug y bodegas son requeridos" }, 400);
  }

  const exists = await Channel.findOne({ slug: body.slug });
  if (exists) {
    return c.json({ error: "Ya existe un canal con ese slug" }, 409);
  }

  const channel = await Channel.create({
    name: body.name,
    slug: body.slug,
    bodegas: body.bodegas,
    marcas: body.marcas || [],
  });

  return c.json(channel, 201);
});

// PATCH /channels/:id — actualizar nombre, slug o bodegas
channelsRoute.patch("/:id", async (c) => {
  await connectDB();
  const id = c.req.param("id");
  const { name, slug, bodegas, marcas } = await c.req.json();

  const update: Partial<IChannel> = {};
  if (name !== undefined) update.name = name;
  if (slug !== undefined) update.slug = slug;
  if (bodegas !== undefined) update.bodegas = bodegas;
  if (marcas !== undefined) update.marcas = marcas;

  let channel: IChannel | null;
  try {
    channel = (await Channel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean()) as IChannel | null;
  } catch {
    return c.json({ error: "ID inválido" }, 400);
  }

  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
  return c.json(channel);
});

// GET /channels/:id/marcas — marcas del canal con nombre (cruce con Sysplus)
channelsRoute.get("/:id/marcas", async (c) => {
  await connectDB();
  const id = c.req.param("id");

  let channel: IChannel | null;
  try {
    channel = (await Channel.findById(id).lean()) as IChannel | null;
  } catch {
    return c.json({ error: "ID de canal inválido" }, 400);
  }
  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);

  const codes = channel.marcas ?? [];
  if (!codes.length) return c.json({ RESP: [] });

  try {
    const { data } = await axios.get(MARCAS_URL);
    const all: { Codigo: string; Nombre: string }[] = data?.RESP || [];
    const set = new Set(codes);
    const filtered = all.filter((m) => set.has(m.Codigo));
    return c.json({ RESP: filtered });
  } catch {
    return c.json({ error: "Error consultando marcas de Sysplus" }, 502);
  }
});

// DELETE /channels/:id — eliminar canal
channelsRoute.delete("/:id", async (c) => {
  await connectDB();
  const id = c.req.param("id");

  try {
    const result = await Channel.findByIdAndDelete(id);
    if (!result) return c.json({ error: "Canal no encontrado" }, 404);
  } catch {
    return c.json({ error: "ID inválido" }, 400);
  }

  return c.json({ ok: true });
});
