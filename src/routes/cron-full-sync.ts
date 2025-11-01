// src/lib/sync-core.ts
import axios from "axios";
import { Product } from "../models/Product.js";
import type { IProduct, IExistencia } from "../models/Product.js";

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

/** Normaliza retornos heterogéneos de la fuente */
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
  const query = params.join("&");
  const url = `${SOURCE_BASE}/existencias_listado${query ? "?" + query : ""}${
    unidad ? (query ? "&unidad" : "?unidad") : ""
  }`;
  const { data } = await axios.get(url, { timeout: 60_000 });
  const arr = extractArray(data);
  if (!arr.length && data?.Codigo) {
    return [{ Codigo: data.Codigo, Existencias: data.Existencias ?? [] }];
  }
  return arr;
}

// ====== WRITERS ======
async function writeProducts(
  products: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
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

    if (ops.length) {
      await Product.bulkWrite(ops, { ordered: false });
      onProgress?.(group.length);
    }
  }
}

async function writePrices(
  items: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
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
            upsert: false,
          },
        };
      })
      .filter(Boolean) as any[];

    if (ops.length) {
      await Product.bulkWrite(ops, { ordered: false });
      onProgress?.(group.length);
    }
  }
}

async function writeStocks(
  items: any[],
  batchSize: number,
  onProgress?: (delta: number) => void
) {
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

    if (ops.length) {
      await Product.bulkWrite(ops, { ordered: false });
      onProgress?.(group.length);
    }
  }
}

// ====== RUNNERS (para cron) ======
export async function runFullSync(opts: {
  size?: number;
  batchSize?: number;
  codes?: string[];
  onProgress?: (delta: number) => void;
}) {
  const {
    size = 3000,
    batchSize = 800,
    codes = [],
    onProgress = () => {},
  } = opts || {};
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
  await writeProducts(all, batchSize, onProgress);
  return { total, done: total };
}

export {
  // Por si quieres usarlos también en las rutas SSE:
  fetchArticulos,
  fetchPrecios,
  fetchExistencias,
  writeProducts,
  writePrices,
  writeStocks,
};
