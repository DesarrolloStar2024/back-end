import { OpenAPIHono } from "@hono/zod-openapi";
import axios from "axios";
import { Channel, type IChannel } from "../../models/Channel.js";
import { connectDB } from "../../config/index.js";
import * as routes from "./channels.routes.js";

const MARCAS_URL = process.env.MARCAS_URL || "http://190.60.237.164/traemarcas";

const channels = new OpenAPIHono();

channels.openapi(routes.getChannels, async (c) => {
  await connectDB();
  const data = await Channel.find().lean();
  return c.json(data as any, 200);
});

channels.openapi(routes.getChannelById, async (c) => {
  await connectDB();
  const { id } = c.req.valid("param");
  try {
    const channel = await Channel.findById(id).lean();
    if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
    return c.json(channel as any, 200);
  } catch {
    return c.json({ error: "ID de canal inválido" }, 404);
  }
});

channels.openapi(routes.createChannel, async (c) => {
  await connectDB();
  const body = c.req.valid("json");

  if (!body.name || !body.slug || !body.bodegas?.length) {
    return c.json({ error: "name, slug y bodegas son requeridos" }, 400);
  }

  const exists = await Channel.findOne({ slug: body.slug });
  if (exists) return c.json({ error: "Ya existe un canal con ese slug" }, 409);

  const channel = await Channel.create({
    name: body.name,
    slug: body.slug,
    bodegas: body.bodegas,
    marcas: body.marcas || [],
  });
  return c.json(channel.toObject() as any, 201);
});

channels.openapi(routes.patchChannel, async (c) => {
  await connectDB();
  const { id } = c.req.valid("param");
  const { name, slug, bodegas, marcas } = c.req.valid("json");

  const update: Partial<IChannel> = {};
  if (name !== undefined) update.name = name;
  if (slug !== undefined) update.slug = slug;
  if (bodegas !== undefined) update.bodegas = bodegas;
  if (marcas !== undefined) update.marcas = marcas;

  try {
    const channel = await Channel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!channel) return c.json({ error: "Canal no encontrado" }, 404);
    return c.json(channel as any, 200);
  } catch {
    return c.json({ error: "ID inválido" }, 404);
  }
});

channels.openapi(routes.deleteChannel, async (c) => {
  await connectDB();
  const { id } = c.req.valid("param");
  try {
    const result = await Channel.findByIdAndDelete(id);
    if (!result) return c.json({ error: "Canal no encontrado" }, 404);
  } catch {
    return c.json({ error: "ID inválido" }, 404);
  }
  return c.json({ ok: true }, 200);
});

channels.openapi(routes.getChannelMarcas, async (c): Promise<any> => {
  await connectDB();
  const { id } = c.req.valid("param");

  let channel: IChannel | null;
  try {
    channel = (await Channel.findById(id).lean()) as IChannel | null;
  } catch {
    return c.json({ error: "ID de canal inválido" }, 404);
  }
  if (!channel) return c.json({ error: "Canal no encontrado" }, 404);

  const codes = channel.marcas ?? [];
  if (!codes.length) return c.json({ RESP: [] }, 200);

  try {
    const { data } = await axios.get(MARCAS_URL);
    const all: { Codigo: string; Nombre: string }[] = data?.RESP || [];
    const set = new Set(codes);
    const filtered = all.filter((m) => set.has(m.Codigo));
    return c.json({ RESP: filtered }, 200);
  } catch {
    return c.json({ error: "Error consultando marcas de Sysplus" } as any, 502);
  }
});

export default channels;
