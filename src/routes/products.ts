// routes/products.ts
import { Hono } from "hono";
import { Product } from "../models/Product.js";
import { Synonym } from "../models/Synonym.js";
import { connectDB } from "../config/index.js";
import {
  ES_COLLATION,
  toTokens,
  parseCadena,
  parseBoolish,
  expandWithSynonyms,
  buildOrRegex,
} from "../utils/search.js";
import { authMiddleware } from "../middleware/auth.js";

export const productsRoute = new Hono();

// routes/products.ts (sustituye el GET "/" por esta versión)
productsRoute.get("/", async (c) => {
  await connectDB();

  // -------- Helpers ----------
  const toBool = (v?: string) =>
    v != null &&
    ["true", "1", "s", "si", "sí", "y", "yes"].includes(
      String(v).toLowerCase()
    );
  const csv = (s?: string) =>
    s
      ? s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  const numOr = (s?: string, d?: number) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  };

  // -------- Query params de alto nivel ----------
  // -------- Query params de alto nivel ----------
  const rawPage = c.req.query("page");
  const rawSize = c.req.query("size");

  // page >= 1 (entero)
  const page = Math.max(1, Math.floor(numOr(rawPage, 1)!));

  // size entre 1 y 2000 (entero)
  const size = Math.max(1, Math.min(2000, Math.floor(numOr(rawSize, 50)!)));

  // Búsqueda flexible (alias buscar/q)
  const buscar = c.req.query("buscar") || "";
  const q = (c.req.query("q") || buscar || "").trim();

  // Jerarquía (A21 / A-2-1 o separados)
  const descripcion = c.req.query("descripcion");
  const codigo = c.req.query("codigo");
  const barras = c.req.query("barras");
  const codFami = c.req.query("codFami")?.toUpperCase();
  const codGrupo = c.req.query("codGrupo");
  const codSubgrupo = c.req.query("codSubgrupo");
  const cadena = c.req.query("cadena");

  // Flags del producto
  const desta = parseBoolish(c.req.query("desta"));
  const masve = parseBoolish(c.req.query("masve"));
  const nuevo = parseBoolish(c.req.query("nuevo"));
  const promo = parseBoolish(c.req.query("promo"));

  // Catálogo
  const promoCatalogo = c.req.query("promoCatalogo");
  const refCatalogo = c.req.query("refCatalogo");
  const hasPromoCatalogo = promoCatalogo != null;
  const hasRefCatalogo = refCatalogo != null;
  const promoCatalogoBool = toBool(promoCatalogo || "");
  const refCatalogoBool = toBool(refCatalogo || "");

  // ------ Filtros que antes hacía el front ------
  // Vista pública (antes applyExistenceFilter): exige stock > 0 en ciertas bodegas
  // stock=public | agotado | all  (default: all)
  const stock = (c.req.query("stock") || "all").toLowerCase(); // public/agotado/all
  // <= 12 unidades (antes menorOIgualA12)
  const maxExist = numOr(c.req.query("maxExist")); // p.ej. 12
  // sinDescripción/sinMedidas (antes sinDescripcion/sinMedidas)
  const sinDescripcion = toBool(c.req.query("sinDescripcion"));
  const sinMedidas = toBool(c.req.query("sinMedidas"));
  // fabricante específico (antes FabricanteFiltro)
  // ya lo cubrimos con ?fabricante= o ?marca= (cruzado)
  // excluir un Código concreto (antes ExcludedCodigo)
  const excludeCodigo = c.req.query("exclude");

  // stands/bodegas usados para stock y filtro
  const bodegas = csv(c.req.query("bodegas")).length
    ? csv(c.req.query("bodegas"))
    : ["01", "06"];
  const stands = csv(c.req.query("stands")); // ej: stands=3H,2B

  // --------- Construir $match base (campos directos) ----------
  const baseAnd: any[] = [];

  // Cadena A-2-1 / A21
  // Aplica los filtros SOLO si todos los valores están presentes
  // Aplica los filtros SOLO si todos los valores están presentes
  if (cadena) {
    const parsed = parseCadena(cadena);
    const jerarquia: any = {};
    if (parsed.CodFami) jerarquia.CodFami = parsed.CodFami;
    if (parsed.CodGrupo) jerarquia.CodGrupo = parsed.CodGrupo;
    if (parsed.CodSubgrupo) jerarquia.CodSubgrupo = parsed.CodSubgrupo;
    if (Object.keys(jerarquia).length) {
      baseAnd.push(jerarquia);
    }
    // Si no hay ninguno, no aplica filtro de jerarquía
  } else {
    const jerarquia: any = {};
    if (codFami) jerarquia.CodFami = codFami;
    if (codGrupo) jerarquia.CodGrupo = codGrupo;
    if (codSubgrupo) jerarquia.CodSubgrupo = codSubgrupo;
    if (Object.keys(jerarquia).length) {
      baseAnd.push(jerarquia);
    }
    // Si no hay ninguno, no aplica filtro de jerarquía
  }

  if (codigo) baseAnd.push({ Codigo: String(codigo) });
  if (barras) baseAnd.push({ Barras: String(barras) });

  // Marca/Fabricante cruzados (código y nombre)
  // --- Lee nuevos params ---
  const marcaId = c.req.query("marcaId");
  const fabricanteId = c.req.query("fabricanteId");

  // --- Helpers separados (ID vs Nombre) ---
  function byMarcaIdStrict(id: string) {
    return { Marca: id };
  }
  function byFabricanteIdStrict(id: string) {
    return { Fabricante: id };
  }

  // --- Aplica filtros (ID y Nombre por separado) ---
  if (marcaId) baseAnd.push(byMarcaIdStrict(String(marcaId).trim()));
  if (fabricanteId)
    baseAnd.push(byFabricanteIdStrict(String(fabricanteId).trim()));

  if (desta) baseAnd.push({ Desta: desta });
  if (masve) baseAnd.push({ Masve: masve });
  if (nuevo) baseAnd.push({ Nuevo: nuevo });
  if (promo) baseAnd.push({ Promo: promo });
  if (hasPromoCatalogo) {
    const promoValue = c.req.query("promo");
    if (typeof promoCatalogoBool === "boolean") {
      if (promoCatalogoBool) {
        // Solo los que tienen activo en true
        if (promoValue) {
          baseAnd.push({
            "PromoCatalogo.activo": true,
            "PromoCatalogo.promo": String(promoValue),
          });
        } else {
          baseAnd.push({ "PromoCatalogo.activo": true });
        }
      } else {
        // Los que no tienen activo o está en false
        if (promoValue) {
          baseAnd.push({
            $or: [
              {
                "PromoCatalogo.activo": false,
                "PromoCatalogo.promo": String(promoValue),
              },
              {
                PromoCatalogo: { $in: [null, false] },
                "PromoCatalogo.promo": String(promoValue),
              },
            ],
          });
        } else {
          baseAnd.push({
            $or: [
              { "PromoCatalogo.activo": false },
              { PromoCatalogo: { $in: [null, false] } },
            ],
          });
        }
      }
    }
  }
  if (hasRefCatalogo) baseAnd.push({ RefCatalogo: refCatalogoBool });

  if (descripcion)
    baseAnd.push({ Descripcion: { $regex: new RegExp(descripcion, "i") } });

  // Búsqueda flexible con sinónimos + exact match en Codigo/Barras
  if (q) {
    const tokens = toTokens(q);
    const expanded = await expandWithSynonyms(tokens, Synonym);
    const orRegex = buildOrRegex(
      ["Descripcion", "NomMarca", "Nomfabricante", "Codigo", "Barras"],
      expanded.length ? expanded : tokens
    );
    baseAnd.push({ $or: [{ Codigo: q }, { Barras: q }, ...orRegex.$or] });
  }

  if (excludeCodigo) baseAnd.push({ Codigo: { $ne: excludeCodigo } });

  // --------- Pipeline de agregación ----------
  const pipeline: any[] = [];

  if (baseAnd.length) pipeline.push({ $match: { $and: baseAnd } });

  // ⇒ Calculamos totalExist en las bodegas seleccionadas, y stands coincidentes
  pipeline.push(
    // filtra existencias a bodegas elegidas
    {
      $addFields: {
        ExistenciasFiltradas: {
          $filter: {
            input: { $ifNull: ["$Existencias", []] },
            as: "ex",
            cond: { $in: ["$$ex.Bodega", bodegas] },
          },
        },
      },
    },
    // suma de existencias numéricas
    {
      $addFields: {
        TotalExist: {
          $sum: {
            $map: {
              input: "$ExistenciasFiltradas",
              as: "ex",
              in: { $toDouble: { $ifNull: ["$$ex.Existencia", "0"] } },
            },
          },
        },
      },
    }
  );

  // Filtro por stands (opcional)
  if (stands.length) {
    pipeline.push({
      $match: {
        "ExistenciasFiltradas.Stand": { $in: stands },
      },
    });
  }

  // <= 12 unidades de EXISTENCIAS ya lo cubres con maxExist.
  // AHORA: filtro por CANTIDAD del producto (campo "Cantidad")
  const maxCantidad =
    numOr(c.req.query("maxCantidad")) ?? numOr(c.req.query("cantLe")); // alias cantLe

  // ... sigue tu construcción de baseAnd y pipeline ...

  // (después de calcular TotalExist y de los otros $match opcionales)
  if (Number.isFinite(maxCantidad)) {
    // Coincide cuando el campo "Cantidad" (string) <= maxCantidad
    pipeline.push({
      $match: {
        $expr: {
          $lte: [{ $toDouble: { $ifNull: ["$Cantidad", "0"] } }, maxCantidad],
        },
      },
    });
  }

  // Stock público/agotado/all y <= maxExist
  if (stock === "public") {
    pipeline.push({ $match: { $expr: { $gt: ["$TotalExist", 0] } } });
  } else if (stock === "agotado") {
    pipeline.push({ $match: { $expr: { $lte: ["$TotalExist", 0] } } });
  }
  if (Number.isFinite(maxExist)) {
    pipeline.push({ $match: { $expr: { $lte: ["$TotalExist", maxExist] } } });
  }

  // sinDescripcion / sinMedidas (string vacío, "0" o null)
  const isEmpty = (f: any) => ({
    $or: [{ [f]: null }, { [f]: "" }, { [f]: "0" }, { [f]: "0.00" }],
  });

  if (sinDescripcion) {
    pipeline.push({ $match: isEmpty("Adicional") });
  }

  if (sinMedidas) {
    pipeline.push({
      $match: {
        $or: [
          ...isEmpty("Ancho").$or,
          ...isEmpty("Alto").$or,
          ...isEmpty("Largo").$or,
        ],
      },
    });
  }

  // Orden alfabético SIEMPRE
  pipeline.push({ $sort: { Descripcion: 1 } });

  // Paginado con facet
  pipeline.push({
    $facet: {
      data: [{ $skip: (page - 1) * size }, { $limit: size }],
      meta: [{ $count: "totalDocs" }],
    },
  });

  // Ejecutar con collation ES
  const ES = ES_COLLATION;
  const agg = await Product.aggregate(pipeline).collation(ES);
  const data = agg[0]?.data || [];
  const totalDocs = agg[0]?.meta?.[0]?.totalDocs || 0;
  const totalPages = Math.ceil(totalDocs / size);

  return c.json({ page, size, totalDocs, totalPages, data });
});

// --- SUGERENCIAS (~10) BASADAS EN UN PRODUCTO ---
// GET /products/:codigo/suggest?limit=10&stock=public|agotado|all&bodegas=01,06&stands=3H,2B
productsRoute.get("/:codigo/suggest", async (c) => {
  await connectDB();

  const codigo = c.req.param("codigo");
  const limit = Math.max(1, Math.min(50, Number(c.req.query("limit") ?? 10)));

  // Filtros opcionales (reutilizando tu semántica)
  const stock = (c.req.query("stock") || "all").toLowerCase(); // public/agotado/all
  const csv = (s?: string) =>
    s
      ? s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  const bodegas = csv(c.req.query("bodegas")).length
    ? csv(c.req.query("bodegas"))
    : ["01", "06"];
  const stands = csv(c.req.query("stands"));

  // 1) Traer el producto base
  const base = await Product.findOne({ Codigo: codigo }).lean();
  if (!base) return c.json({ message: "No encontrado" }, 404);

  // 2) Preparar señales para "parecido"
  //    - tokens de la descripción (con sinónimos)
  //    - datos de jerarquía / marca / fabricante / precio
  const baseDesc = String(base.Descripcion || "");
  const baseTokens = toTokens(baseDesc);
  const expanded = await expandWithSynonyms(baseTokens, Synonym);
  const searchTerms = expanded.length ? expanded : baseTokens;

  // Pequeño OR-regex para coincidencias en texto (usa util existente)
  const orRegex = buildOrRegex(
    ["Descripcion", "NomMarca", "Nomfabricante"],
    searchTerms
  );

  const baseFami = base.CodFami ?? null;
  const baseGrupo = base.CodGrupo ?? null;
  const baseSub = base.CodSubgrupo ?? null;
  const baseMarca = base.Marca ?? null;
  const baseFab = base.Fabricante ?? null;

  // Precio base para proximidad (usa PVP, o Precio si no hay)
  const basePrice = Number(base?.Precio ?? 0) || 0;

  // 3) Pipeline de candidatos
  const pipeline: any[] = [];

  // Candidatos amplios: excluir el mismo Código y que compartan
  // al menos algo (jerarquía/marca/fabricante/regex de texto)
  const broadOr: any[] = [];
  if (baseFami) broadOr.push({ CodFami: baseFami });
  if (baseGrupo) broadOr.push({ CodGrupo: baseGrupo });
  if (baseSub) broadOr.push({ CodSubgrupo: baseSub });
  if (baseMarca) broadOr.push({ Marca: baseMarca });
  if (baseFab) broadOr.push({ Fabricante: baseFab });
  if (orRegex?.$or?.length) broadOr.push(...orRegex.$or);

  pipeline.push({
    $match: {
      Codigo: { $ne: codigo },
      ...(broadOr.length ? { $or: broadOr } : {}),
    },
  });

  // 4) Calcular existencias filtradas y TotalExist (igual que en tu listado)
  pipeline.push(
    {
      $addFields: {
        ExistenciasFiltradas: {
          $filter: {
            input: { $ifNull: ["$Existencias", []] },
            as: "ex",
            cond: { $in: ["$$ex.Bodega", bodegas] },
          },
        },
      },
    },
    {
      $addFields: {
        TotalExist: {
          $sum: {
            $map: {
              input: "$ExistenciasFiltradas",
              as: "ex",
              in: { $toDouble: { $ifNull: ["$$ex.Existencia", "0"] } },
            },
          },
        },
      },
    }
  );

  if (stands.length) {
    pipeline.push({
      $match: { "ExistenciasFiltradas.Stand": { $in: stands } },
    });
  }

  if (stock === "public") {
    pipeline.push({ $match: { $expr: { $gt: ["$TotalExist", 0] } } });
  } else if (stock === "agotado") {
    pipeline.push({ $match: { $expr: { $lte: ["$TotalExist", 0] } } });
  }

  // 5) Scoring de similaridad
  //    - Jerarquía: Subgrupo +3, Grupo +2, Familia +1
  //    - Marca +2, Fabricante +1
  //    - Texto (regex) +1 si coincide
  //    - Proximidad de precio: calculamos diff% y lo usamos para ordenar (no suma a score)
  const priceExpr = {
    $toDouble: {
      $ifNull: ["$PVP", { $ifNull: ["$Precio", { $ifNull: ["$Pvp", 0] }] }],
    },
  };

  // Coincidencia de texto con OR de términos
  const regexOr = searchTerms.length
    ? {
        $regexMatch: {
          input: { $ifNull: ["$Descripcion", ""] },
          regex: new RegExp(searchTerms.join("|"), "i"),
        },
      }
    : false;

  pipeline.push(
    {
      $addFields: {
        __score: {
          $add: [
            { $cond: [{ $eq: ["$CodSubgrupo", baseSub] }, 3, 0] },
            { $cond: [{ $eq: ["$CodGrupo", baseGrupo] }, 2, 0] },
            { $cond: [{ $eq: ["$CodFami", baseFami] }, 1, 0] },
            { $cond: [{ $eq: ["$Marca", baseMarca] }, 2, 0] },
            { $cond: [{ $eq: ["$Fabricante", baseFab] }, 1, 0] },
            { $cond: [regexOr || false, 1, 0] },
          ],
        },
        __priceDiffPct: {
          $cond: [
            { $gt: [basePrice, 0] },
            {
              $abs: {
                $divide: [{ $subtract: [priceExpr, basePrice] }, basePrice],
              },
            },
            1, // si no hay precio base, deja 1 (neutral)
          ],
        },
      },
    },
    // Seguridad: si TODO dio 0, aún así deja candidatos (pero los ordena al final)
    {
      $sort: {
        __score: -1,
        __priceDiffPct: 1,
        TotalExist: -1,
        Masve: -1,
        Desta: -1,
        Nuevo: -1,
        Descripcion: 1,
      },
    },
    { $limit: limit }
  );

  // 6) Ejecutar con collation ES
  const ES = ES_COLLATION;
  const suggestions = await Product.aggregate(pipeline).collation(ES);

  return c.json({
    base: {
      Codigo: base.Codigo,
      Descripcion: base.Descripcion,
      CodFami: baseFami,
      CodGrupo: baseGrupo,
      CodSubgrupo: baseSub,
      Marca: baseMarca,
      Fabricante: baseFab,
      Precio: basePrice,
    },
    total: suggestions.length,
    data: suggestions,
  });
});

// --- GET by Codigo ---
productsRoute.get("/:codigo", async (c) => {
  await connectDB();
  const codigo = c.req.param("codigo");
  const p = await Product.findOne({ Codigo: codigo }).lean();
  if (!p) return c.json({ message: "No encontrado" }, 404);
  return c.json(p);
});

// --- UPSERT MASIVO DE PRODUCTOS ---
productsRoute.post("/upsert", async (c) => {
  await connectDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const items: any[] = Array.isArray(body) ? body : [body];
  if (!items.length)
    return c.json({ error: "Se esperaba un array u objeto" }, 400);

  const ops: any[] = [];
  const errors: Array<{ index: number; reason: string }> = [];

  items.forEach((raw, i) => {
    const codigo = raw?.Codigo ? String(raw.Codigo).trim() : null;
    if (!codigo) {
      errors.push({ index: i, reason: "Falta 'Codigo'" });
      return;
    }

    // Documento final = tal cual llegó + defaults en flags si faltan
    const finalDoc: any = {
      ...raw,
      PromoCatalogo: Object.prototype.hasOwnProperty.call(raw, "PromoCatalogo")
        ? raw.PromoCatalogo
        : false,
      RefCatalogo: Object.prototype.hasOwnProperty.call(raw, "RefCatalogo")
        ? raw.RefCatalogo
        : false,
    };

    // Evitar problemas si llega _id
    delete finalDoc._id;

    ops.push({
      replaceOne: {
        filter: { Codigo: codigo },
        replacement: finalDoc,
        upsert: true,
      },
    });
  });

  if (!ops.length)
    return c.json({ error: "No hay operaciones válidas", errors }, 400);

  // Ejecuta en lotes grandes sin bloquear
  const CHUNK = 1000;
  let matched = 0,
    modified = 0,
    upserted = 0;

  for (let i = 0; i < ops.length; i += CHUNK) {
    const res = await Product.bulkWrite(ops.slice(i, i + CHUNK), {
      ordered: false,
    });
    matched += res.matchedCount ?? 0;
    modified += res.modifiedCount ?? 0;
    upserted +=
      res.upsertedCount ??
      (res.upsertedIds ? Object.keys(res.upsertedIds).length : 0);
  }

  return c.json({
    ok: true,
    received: items.length,
    attempted: ops.length,
    matched,
    modified,
    upserted,
    errors,
  });
});

// --- Helpers ---
const toBoolish = (v: any) =>
  typeof v === "boolean"
    ? v
    : ["true", "1", "s", "si", "sí", "y", "yes"].includes(
        String(v).toLowerCase()
      );

function parseCodesList(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    // CSV / líneas / tabs / ;
    return input
      .split(/[\n,;\t]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

type PromoRow = {
  codigo?: string;
  code?: string;
  promo?: string;
  activo?: boolean | string;
};

function parsePromoItems(
  body: any
): Array<{ Codigo: string; promo: string; activo: boolean }> {
  const out: Array<{ Codigo: string; promo: string; activo: boolean }> = [];

  if (Array.isArray(body?.items)) {
    for (const r of body.items as PromoRow[]) {
      const Codigo = String(r.codigo ?? r.code ?? "").trim();
      const promo = String(r.promo ?? "").trim();
      const activo = toBoolish(r.activo ?? true);
      if (Codigo && promo) out.push({ Codigo, promo, activo });
    }
  } else if (typeof body?.text === "string") {
    // cada línea: CODIGO, PROMO [, ACTIVO]
    const lines = body.text
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      const [c, p, a] = line.split(/[,\t;]+/);
      const Codigo = String(c ?? "").trim();
      const promo = String(p ?? "").trim();
      const activo = toBoolish(a ?? true);
      if (Codigo && promo) out.push({ Codigo, promo, activo });
    }
  }
  return out;
}

// Actualiza RefCatalogo de un producto por Codigo
// Body: { "value": true | false }
productsRoute.patch(
  "/:codigo/ref-catalogo",
  authMiddleware(true),
  async (c) => {
    await connectDB();
    const codigo = c.req.param("codigo");

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }
    if (body?.value === undefined)
      return c.json({ error: "Falta 'value' (boolean)" }, 400);

    const value = toBoolish(body.value);
    const res = await Product.updateOne(
      { Codigo: codigo },
      { $set: { RefCatalogo: value } }
    );

    return c.json({
      ok: true,
      codigo,
      value,
      matched: res.matchedCount ?? 0,
      modified: res.modifiedCount ?? 0,
    });
  }
);

// Actualiza RefCatalogo en lote por Codigos
// Body: { "codes": ["314BP","001"] | "314BP,001\nXYZ", "value": true | false }
productsRoute.post("/ref-catalogo/bulk", authMiddleware(true), async (c) => {
  await connectDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const codes = parseCodesList(body?.codes);
  if (!codes.length) return c.json({ error: "Debe enviar 'codes'." }, 400);
  if (body?.value === undefined)
    return c.json({ error: "Falta 'value' (boolean)" }, 400);

  const value = toBoolish(body.value);
  const res = await Product.updateMany(
    { Codigo: { $in: codes } },
    { $set: { RefCatalogo: value } }
  );

  return c.json({
    ok: true,
    requested: codes.length,
    value,
    matched: res.matchedCount ?? 0,
    modified: res.modifiedCount ?? 0,
  });
});

// PATCH /products/:codigo/promo-catalogo
productsRoute.patch(
  "/:codigo/promo-catalogo",
  authMiddleware(true),
  async (c) => {
    await connectDB();
    const codigo = c.req.param("codigo");
    console.log("PATCH /products/:codigo/promo-catalogo", codigo);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON inválido" }, 400);
    }

    const hasActivo = body?.activo !== undefined;
    const hasPromo = typeof body?.promo === "string";

    if (!hasActivo && !hasPromo) {
      return c.json(
        { error: "No hay campos válidos (use 'activo' y/o 'promo')." },
        400
      );
    }

    // Traer el actual para mergear si es objeto
    const doc = await Product.findOne(
      { Codigo: codigo },
      { PromoCatalogo: 1 }
    ).lean();

    // Normalizar base
    let base: any = { activo: false, promo: "" };
    if (
      doc &&
      doc.PromoCatalogo &&
      typeof doc.PromoCatalogo === "object" &&
      !Array.isArray(doc.PromoCatalogo)
    ) {
      base = {
        activo: !!doc.PromoCatalogo.activo,
        promo: String(doc.PromoCatalogo.promo || ""),
      };
    }

    // Aplicar cambios
    const nuevo = {
      activo: hasActivo ? !!body.activo : base.activo,
      promo: hasPromo ? String(body.promo) : base.promo,
    };

    // Escribir el objeto completo (evita el error de subcampo sobre boolean)
    const res = await Product.updateOne(
      { Codigo: codigo },
      { $set: { PromoCatalogo: nuevo } }
    );

    return c.json({
      ok: true,
      codigo,
      set: { PromoCatalogo: nuevo },
      matched: (res as any).matchedCount ?? 0,
      modified: (res as any).modifiedCount ?? 0,
    });
  }
);

// POST /products/promo-catalogo/bulk
productsRoute.post("/promo-catalogo/bulk", authMiddleware(true), async (c) => {
  await connectDB();

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const items = parsePromoItems(body);
  if (!items.length) {
    return c.json(
      { error: "Debe enviar 'items' o 'text' con código y promo." },
      400
    );
  }

  const ops = items.map((it) => ({
    updateOne: {
      filter: { Codigo: it.Codigo },
      update: {
        // reemplaza completamente el campo (si era boolean, ahora queda objeto)
        $set: {
          PromoCatalogo: {
            activo: !!it.activo,
            promo: String(it.promo || ""),
          },
        },
      },
      upsert: false,
    },
  }));

  const res = await Product.bulkWrite(ops, { ordered: false });

  return c.json({
    ok: true,
    requested: items.length,
    matched: (res as any).matchedCount ?? 0,
    modified: (res as any).modifiedCount ?? 0,
  });
});

productsRoute.get("/catalogo/:codFami", async (c) => {
  try {
    const codFami = c.req.param("codFami");
    const onlyAvailable = c.req.query("onlyAvailable") === "true";

    if (!codFami) {
      return c.json({ ok: false, error: "Falta parámetro codFami" }, 400);
    }

    // 🔹 Buscar productos de la familia
    let products = await Product.find({ CodFami: codFami })
      .sort({ Descripcion: 1 })
      .lean();

    // 🔹 Si se pide solo los disponibles, filtramos por existencias > 0
    if (onlyAvailable) {
      interface Existencia {
        Bodega?: string;
        Stand?: string;
        Existencia?: number | string | null;
      }

      interface ProductDoc {
        Existencias?: Existencia[];
        RefCatalogo?: boolean;
        [key: string]: any;
      }

      products = products.filter((p: ProductDoc) =>
        (p.Existencias as Existencia[] | undefined)?.some(
          (e: Existencia) => Number(e.Existencia ?? 0) > 0
        )
      );
    }

    // 🔹 Separar según RefCatalogo
    const dataRef = products.filter((p) => p.RefCatalogo === true);
    const finalData = products.filter((p) => !p.RefCatalogo);

    return c.json({
      ok: true,
      codFami,
      total: products.length,
      finalData,
      dataRef,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error en /products/catalogo:", msg);
    return c.json({ ok: false, error: msg }, 500);
  }
});
