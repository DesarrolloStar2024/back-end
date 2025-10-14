// src/routes/sync.ts
import { Hono } from "hono";
import axios from "axios";
import { Product } from "../models/Product.js";
import type { IProduct, IExistencia } from "../models/Product.js";
import { streamSSE } from "hono/streaming";
import { authMiddleware } from "../middleware/auth.js";

export const syncRoute = new Hono();

// ====== CONFIG FUENTE REMOTA ======
const SOURCE_BASE = process.env.SOURCE_BASE;

// ====== HELPERS ======
const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const toStr = (v: any) => (v == null ? "" : String(v));
const toNumStr = (v: any) => (v == null ? "" : String(v));

/** Los endpoints remotos devuelven en distintos formatos.
 * - /articulos y /articulosSinc → { RESP: [...] }
 * - /existencias_listado (por código) → { Codigo, Existencias: [...] }
 * - Cuando es "todos", puede venir como array. */
const extractArray = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.RESP)) return data.RESP;
  if (data.Codigo) return [data];
  return [];
};

// ====== NORMALIZADORES A TU MODELO ======
function normalizeProduct(remote: any): Partial<IProduct> {
  return {
    Codigo: toStr(remote.Codigo ?? remote.codigo),
    Descripcion: toStr(remote.Descripcion ?? remote.descripcion),
    CodFami: toStr(remote.CodFami),
    NomFami: toStr(remote.NomFami),
    CodGrupo: toStr(remote.CodGrupo),
    NomGrupo: toStr(remote.NomGrupo),
    CodSubgrupo: toStr(remote.CodSubgrupo),
    NomSubgrupo: toStr(remote.NomSubgrupo),
    Fabricante: toStr(remote.Fabricante),
    Nomfabricante: toStr(remote.Nomfabricante),
    Marca: toStr(remote.Marca),
    NomMarca: toStr(remote.NomMarca),
    Unidad: toStr(remote.Unidad),
    Cantidad: toNumStr(remote.Cantidad),
    Iva: toNumStr(remote.Iva),
    Precio: toNumStr(remote.Precio),
    Promo: toStr(remote.Promo),
    Desta: toStr(remote.Desta),
    Masve: toStr(remote.Masve),
    Nuevo: toStr(remote.Nuevo),
    Barras: toStr(remote.Barras),
    CUM: toStr(remote.CUM),
    Peso: toNumStr(remote.Peso),
    Ancho: toNumStr(remote.Ancho),
    Alto: toNumStr(remote.Alto),
    Largo: toNumStr(remote.Largo),
    Adicional: toStr(remote.Adicional),
    Precio2: toNumStr(remote.Precio2),
    Cant2: toNumStr(remote.Cant2),
    Precio3: toNumStr(remote.Precio3),
    Cant3: toNumStr(remote.Cant3),
    Precio4: toNumStr(remote.Precio4),
    Cant4: toNumStr(remote.Cant4),
    Precio5: toNumStr(remote.Precio5),
    Cant5: toNumStr(remote.Cant5),
    Precio6: toNumStr(remote.Precio6),
    Cant6: toNumStr(remote.Cant6),
    Foto: toStr(remote.Foto),
    // Si tu fuente ya trae Existencias en /articulos, respétalas
    Existencias: Array.isArray(remote.Existencias)
      ? normalizeExistencias(remote.Existencias)
      : undefined,
    Reg: Number(remote.Reg ?? remote.reg ?? 0),
  };
}

function normalizeExistencias(remote: any[]): IExistencia[] {
  return (remote ?? []).map((e) => ({
    Bodega: toStr(e.Bodega ?? e.bodega),
    Existencia: toNumStr(e.Existencia ?? e.existencia),
    Stand: toStr(e.Stand ?? e.stand),
  }));
}

// ====== FETCHERS REMOTOS ======
async function fetchArticulos(size?: number, buscar?: string) {
  const params: string[] = [];
  if (size != null) params.push(`size=${size}`);
  if (buscar) params.push(`buscar=${encodeURIComponent(buscar)}`);
  const url = `${SOURCE_BASE}/articulos${
    params.length ? "?" + params.join("&") : ""
  }`;
  const { data } = await axios.get(url, { timeout: 60_000 });
  return extractArray(data);
}

async function fetchPrecios(buscar?: string) {
  const url = `${SOURCE_BASE}/articulosSinc${
    buscar ? `?buscar=${encodeURIComponent(buscar)}` : ""
  }`;
  const { data } = await axios.get(url, { timeout: 60_000 });
  return extractArray(data);
}

async function fetchExistencias(
  buscar?: string,
  fecha?: string,
  unidad = true
) {
  const params: string[] = [];
  if (buscar) params.push(`buscar=${encodeURIComponent(buscar)}`);
  if (fecha) params.push(`fecha=${encodeURIComponent(fecha)}`);
  // `unidad` se pasa sin valor (flag)
  const query = params.join("&");
  const url = `${SOURCE_BASE}/existencias_listado${query ? "?" + query : ""}${
    unidad ? (query ? "&unidad" : "?unidad") : ""
  }`;
  const { data } = await axios.get(url, { timeout: 60_000 });
  const arr = extractArray(data);
  // Si vino como objeto único { Codigo, Existencias }, conviértelo a array uniforme
  if (!arr.length && data?.Codigo) {
    return [{ Codigo: data.Codigo, Existencias: data.Existencias ?? [] }];
  }
  return arr;
}

// ====== CORE WRITERS ======
async function writeProducts(
  products: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
  let done = 0;
  for (const group of chunk(products, batchSize)) {
    const ops = group
      .map((r) => {
        const p = normalizeProduct(r);
        if (!p.Codigo) return null;
        return {
          updateOne: {
            filter: { Codigo: p.Codigo },
            update: { $set: p },
            upsert: true,
          },
        };
      })
      .filter(Boolean) as any[];

    if (!ops.length) continue;
    await Product.bulkWrite(ops, { ordered: false });
    done += group.length;
    onProgress?.(group.length);
  }
  return done;
}

async function writePrices(
  items: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
  let done = 0;
  for (const group of chunk(items, batchSize)) {
    const ops = group
      .map((r) => {
        const Codigo = toStr(r.Codigo ?? r.codigo);
        if (!Codigo) return null;
        const pricePatch: Partial<IProduct> = {
          Precio: toNumStr(r.Precio),
          Precio2: toNumStr(r.Precio2),
          Cant2: toNumStr(r.Cant2),
          Precio3: toNumStr(r.Precio3),
          Cant3: toNumStr(r.Cant3),
          Precio4: toNumStr(r.Precio4),
          Cant4: toNumStr(r.Cant4),
          Precio5: toNumStr(r.Precio5),
          Cant5: toNumStr(r.Cant5),
          Precio6: toNumStr(r.Precio6),
          Cant6: toNumStr(r.Cant6),
        };
        return {
          updateOne: {
            filter: { Codigo },
            update: { $set: pricePatch },
            upsert: false, // no crear si no existe
          },
        };
      })
      .filter(Boolean) as any[];

    if (!ops.length) continue;
    await Product.bulkWrite(ops, { ordered: false });
    done += group.length;
    onProgress?.(group.length);
  }
  return done;
}

async function writeStocks(
  items: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
  // items: [{ Codigo, Existencias: [...] }, ...]
  let done = 0;
  for (const group of chunk(items, batchSize)) {
    const ops = group
      .map((row) => {
        const Codigo = toStr(row.Codigo ?? row.codigo);
        if (!Codigo) return null;
        const Existencias = normalizeExistencias(
          row.Existencias ?? row.existencias ?? []
        );
        return {
          updateOne: {
            filter: { Codigo },
            update: { $set: { Existencias } },
            upsert: false,
          },
        };
      })
      .filter(Boolean) as any[];

    if (!ops.length) continue;
    await Product.bulkWrite(ops, { ordered: false });
    done += group.length;
    onProgress?.(group.length);
  }
  return done;
}

// ====== ENDPOINTS SIN STREAM (POST) ======
// Full: todo el body. Opcional: codes[], size, batchSize
syncRoute.post("/full", authMiddleware(true), async (c) => {
  const {
    codes,
    size = 3000,
    batchSize = 800,
  } = await c.req.json().catch(() => ({}));
  let total = 0;

  if (Array.isArray(codes) && codes.length) {
    let acc: any[] = [];
    for (const code of codes) {
      const arr = await fetchArticulos(size, code);
      total += arr.length;
      acc = acc.concat(arr);
    }
    const done = await writeProducts(acc, batchSize);
    return c.json({ ok: true, scope: "full", total, done });
  } else {
    const arr = await fetchArticulos(size); // todos
    total = arr.length;
    const done = await writeProducts(arr, batchSize);
    return c.json({ ok: true, scope: "full", total, done });
  }
});

// Solo precios. Opcional: codes[], batchSize
syncRoute.post("/prices", authMiddleware(true), async (c) => {
  const { codes, batchSize = 1000 } = await c.req.json().catch(() => ({}));
  let total = 0;
  let acc: any[] = [];

  if (Array.isArray(codes) && codes.length) {
    for (const code of codes) {
      const arr = await fetchPrecios(code);
      total += arr.length;
      acc = acc.concat(arr);
    }
  } else {
    const arr = await fetchPrecios(); // todos
    total = arr.length;
    acc = arr;
  }

  const done = await writePrices(acc, batchSize);
  return c.json({ ok: true, scope: "prices", total, done });
});

// Solo stock. Opcional: codes[], fecha, batchSize
syncRoute.post("/stock", authMiddleware(true), async (c) => {
  const {
    codes,
    fecha,
    batchSize = 1000,
  } = await c.req.json().catch(() => ({}));
  let acc: any[] = [];

  if (Array.isArray(codes) && codes.length) {
    for (const code of codes) {
      const arr = await fetchExistencias(code, fecha, true);
      acc = acc.concat(arr);
    }
  } else {
    const arr = await fetchExistencias(undefined, fecha, true); // todos
    acc = arr;
  }

  const total = acc.length;
  const done = await writeStocks(acc, batchSize);
  return c.json({ ok: true, scope: "stock", total, done });
});

// ====== ENDPOINTS CON PROGRESO SSE (GET) ======
// Frontend: EventSource('/sync/full/stream?size=3000&codes=314BP,ABC&batchSize=800')
// /sync/full/stream
syncRoute.get("/full/stream", authMiddleware(true), (c) => {
  const size = Number(c.req.query("size") ?? "15000");
  const batchSize = Number(c.req.query("batchSize") ?? "800");
  const codes = (c.req.query("codes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return streamSSE(c, async (stream) => {
    try {
      // 1) avisar al front de inmediato
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "fetch",
          message: "Extrayendo datos de Sysplus…",
        }),
      });

      // 2) descargar (ahora dentro del stream)
      let all: any[] = [];
      if (codes.length) {
        for (const code of codes) {
          const arr = await fetchArticulos(size, code);
          all = all.concat(arr);
        }
      } else {
        all = await fetchArticulos(size);
      }
      const total = all.length;

      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "counted",
          message: `Descarga completa. ${total} registros.`,
        }),
      });

      // 3) anunciar el total y procesar
      await stream.writeSSE({
        event: "start",
        data: JSON.stringify({ total }),
      });
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "write",
          message: "Procesando y guardando en base de datos…",
        }),
      });

      let done = 0;
      await writeProducts(all, batchSize, async (delta) => {
        done += delta;
        const percent = total ? Math.round((done / total) * 100) : 100;
        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify({ done, total, percent }),
        });
      });

      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "finish",
          message: "Sincronización completada.",
        }),
      });
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ done, total, percent: 100 }),
      });
    } catch (err: any) {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "error",
          message: `Error en sincronización: ${err?.message || "desconocido"}`,
        }),
      });
    }
  });
});

// Frontend: EventSource('/sync/prices/stream?codes=001,314BP&batchSize=1000')
// /sync/prices/stream
syncRoute.get("/prices/stream", authMiddleware(true), (c) => {
  const batchSize = Number(c.req.query("batchSize") ?? "1000");
  const codes = (c.req.query("codes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "fetch",
          message: "Extrayendo precios de Sysplus…",
        }),
      });

      let all: any[] = [];
      if (codes.length) {
        for (const code of codes) {
          const arr = await fetchPrecios(code);
          all = all.concat(arr);
        }
      } else {
        all = await fetchPrecios();
      }
      const total = all.length;

      await stream.writeSSE({
        event: "start",
        data: JSON.stringify({ total }),
      });
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "write",
          message: "Procesando y guardando precios…",
        }),
      });

      let done = 0;
      await writePrices(all, batchSize, async (delta) => {
        done += delta;
        const percent = total ? Math.round((done / total) * 100) : 100;
        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify({ done, total, percent }),
        });
      });

      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "finish",
          message: "Sincronización de precios completada.",
        }),
      });
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ done, total, percent: 100 }),
      });
    } catch (err: any) {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "error",
          message: `Error en precios: ${err?.message || "desconocido"}`,
        }),
      });
    }
  });
});

// Frontend: EventSource('/sync/stock/stream?fecha=12/09/25&codes=001,314BP&batchSize=1000')
// /sync/stock/stream
syncRoute.get("/stock/stream", authMiddleware(true), (c) => {
  const fecha = c.req.query("fecha") || undefined;
  const batchSize = Number(c.req.query("batchSize") ?? "1000");
  const codes = (c.req.query("codes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "fetch",
          message: "Extrayendo stock de Sysplus…",
        }),
      });

      let all: any[] = [];
      if (codes.length) {
        for (const code of codes) {
          const arr = await fetchExistencias(code, fecha, true);
          all = all.concat(arr);
        }
      } else {
        all = await fetchExistencias(undefined, fecha, true);
      }
      const total = all.length;

      await stream.writeSSE({
        event: "start",
        data: JSON.stringify({ total }),
      });
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "write",
          message: "Procesando y guardando stock…",
        }),
      });

      let done = 0;
      await writeStocks(all, batchSize, async (delta) => {
        done += delta;
        const percent = total ? Math.round((done / total) * 100) : 100;
        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify({ done, total, percent }),
        });
      });

      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "finish",
          message: "Sincronización de stock completada.",
        }),
      });
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ done, total, percent: 100 }),
      });
    } catch (err: any) {
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          phase: "error",
          message: `Error en stock: ${err?.message || "desconocido"}`,
        }),
      });
    }
  });
});
