// routes/products.ts
import { Hono } from "hono";
import { Product } from "../models/Product.js";
import { Synonym } from "../models/Synonym.js";
import { connectDB } from "../config/db.js";
import {
  ES_COLLATION,
  toTokens,
  parseCadena,
  parseBoolish,
  expandWithSynonyms,
  buildOrRegex,
} from "../utils/search.js";

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
  const page = Math.max(1, numOr(c.req.query("page"), 1));
  const size = Math.min(5000, Math.max(1, numOr(c.req.query("size"), 5000)));

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

  if (hasPromoCatalogo) baseAnd.push({ PromoCatalogo: promoCatalogoBool });
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
/* productsRoute.get("/:codigo/suggest", async (c) => {
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
  const basePrice = Number(base?.PVP ?? base?.Precio ?? base?.Pvp ?? 0) || 0;

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
});*/
