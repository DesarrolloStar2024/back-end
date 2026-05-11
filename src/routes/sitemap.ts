// src/routes/sitemap.ts
import { Hono } from "hono";
import { connectDB } from "../config/index.js";
import { Product } from "../models/Product.js";
import { Fabricante } from "../models/Fabricante.js";

const SITE_URL = "https://www.starprofessional.com.co";

export const sitemapRoute = new Hono();

sitemapRoute.get("/", async (c) => {
  await connectDB();

  const today = new Date().toISOString().split("T")[0];

  const [productos, familias, marcas, fabricantes] = await Promise.all([
    Product.find({}, { Codigo: 1, _id: 0 }).lean(),
    Product.aggregate<{ _id: string; NomFami: string }>([
      {
        $match: {
          CodFami: { $exists: true, $ne: "" },
          NomFami: { $exists: true, $ne: "" },
        },
      },
      { $group: { _id: "$CodFami", NomFami: { $first: "$NomFami" } } },
      { $sort: { _id: 1 } },
    ]),
    Product.aggregate<{ _id: string; NomMarca: string }>([
      {
        $match: {
          Marca: { $exists: true, $ne: "" },
          NomMarca: { $exists: true, $ne: "" },
        },
      },
      { $group: { _id: "$Marca", NomMarca: { $first: "$NomMarca" } } },
      { $sort: { _id: 1 } },
    ]),
    Fabricante.find({}, { Id: 1, Nombre: 1, _id: 0 }).lean(),
  ]);

  const entry = (loc: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const urls: string[] = [
    // Páginas estáticas
    entry(`${SITE_URL}/`, "daily", "1.0"),
    entry(`${SITE_URL}/allProduct`, "daily", "0.9"),
    entry(`${SITE_URL}/distribuidores`, "monthly", "0.8"),
    entry(`${SITE_URL}/Faq`, "monthly", "0.7"),
    entry(`${SITE_URL}/Work`, "monthly", "0.6"),
    entry(`${SITE_URL}/questions`, "monthly", "0.6"),
    entry(`${SITE_URL}/formPqrs`, "monthly", "0.5"),
    entry(`${SITE_URL}/terminos`, "yearly", "0.4"),
    entry(`${SITE_URL}/dataProcessing`, "yearly", "0.4"),

    // Familias / Categorías
    ...familias.map((f) =>
      entry(
        `${SITE_URL}/Family/${encodeURIComponent(f._id)}/${encodeURIComponent(f.NomFami)}`,
        "weekly",
        "0.8"
      )
    ),

    // Marcas
    ...marcas.map((m) =>
      entry(
        `${SITE_URL}/Marcas/${encodeURIComponent(m.NomMarca)}/${encodeURIComponent(m._id)}`,
        "weekly",
        "0.7"
      )
    ),

    // Fabricantes
    ...fabricantes.map((f) =>
      entry(
        `${SITE_URL}/Fabricante/${encodeURIComponent(f.Nombre)}/${encodeURIComponent(f.Id)}`,
        "weekly",
        "0.7"
      )
    ),

    // Productos individuales
    ...productos.map((p) =>
      entry(
        `${SITE_URL}/productsDetail/${encodeURIComponent(p.Codigo)}`,
        "weekly",
        "0.6"
      )
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
