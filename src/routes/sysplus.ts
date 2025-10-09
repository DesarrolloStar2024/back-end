// src/routes/sysplus.ts
import { Hono } from "hono";
import { CotizacionLog } from "../models/CotizacionLog.js";
import { Product } from "../models/Product.js";
import { authMiddleware } from "../middleware/auth.js";

export const sysplusRoute = new Hono();

/**
 * POST /sysplus/cotizacion/log
 * Guarda el log y, si la cotización fue exitosa,
 * descuenta stock siguiendo prioridad:
 * 1️⃣ Bodega "01"
 * 2️⃣ Bodega "06"
 * 3️⃣ Primera bodega disponible
 */
sysplusRoute.post("/cotizacion/log", async (c) => {
  try {
    const { requestBody, sysplusResponse } = await c.req.json();

    if (!requestBody || !sysplusResponse) {
      return c.json(
        { ok: false, message: "Faltan datos para registrar log." },
        400
      );
    }

    // ✅ Validar si la respuesta es exitosa
    const isValid =
      sysplusResponse?.RESP &&
      Array.isArray(sysplusResponse.RESP) &&
      sysplusResponse.RESP[0]?.Encabezado &&
      sysplusResponse.RESP[0]?.ITEM;

    // ✅ Crear log en la base de datos
    const log = await CotizacionLog.create({
      vendedor: requestBody.VEND,
      cliente: requestBody.NIT,
      sucursal: requestBody.SUCU,
      observaciones: requestBody.OBS,
      items: requestBody.ITEMS,
      sysplusResponse,
      status: isValid ? "success" : "error",
      errorMsg: !isValid ? "Respuesta inválida o error en Sysplus" : undefined,
    });

    // 🔹 Almacenar movimientos aplicados
    const movimientos: {
      barras: string;
      bodega: string;
      anterior: number;
      nuevo: number;
      cantidad: number;
    }[] = [];

    // ✅ Si fue exitosa → descontar stock
    if (isValid && Array.isArray(requestBody.ITEMS)) {
      for (const item of requestBody.ITEMS) {
        const barras = item.BARRAS;
        const cantidad = Number(item.CANT || 0);

        if (!barras || isNaN(cantidad) || cantidad <= 0) continue;

        // Buscar producto
        const product = await Product.findOne({ Codigo: barras });
        if (!product) {
          console.warn(`⚠️ Producto con barras ${barras} no encontrado`);
          continue;
        }

        // Buscar bodegas en orden de prioridad
        const bodega01 = product.Existencias.find((e) => e.Bodega === "01");
        const bodega06 = product.Existencias.find((e) => e.Bodega === "06");
        const bodegaAlt = product.Existencias.find(
          (e) => e.Bodega !== "01" && e.Bodega !== "06"
        );

        let target = bodega01 || bodega06 || bodegaAlt;

        if (!target) {
          console.warn(`⚠️ Sin existencias válidas para ${barras}`);
          continue;
        }

        const actual = Number(target.Existencia || 0);
        const nuevo = actual - cantidad; // ❗ Permite negativo

        target.Existencia = nuevo;

        // Evitar error con documentos antiguos
        if (typeof product.PromoCatalogo === "boolean") {
          product.PromoCatalogo = { activo: false, promo: "" };
        }

        await product.save();

        console.log(
          `📦 Stock actualizado: ${barras} (${target.Bodega}) ${actual} → ${nuevo}`
        );

        movimientos.push({
          barras,
          bodega: target.Bodega,
          anterior: actual,
          nuevo,
          cantidad,
        });
      }
    }

    // ✅ Respuesta final
    return c.json({
      ok: true,
      logId: log._id,
      status: log.status,
      createdAt: log.createdAt,
      updatedStock: movimientos.length ? movimientos : false,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error registrando log de cotización:", errorMsg);
    return c.json({ ok: false, error: errorMsg }, 500);
  }
});

/**
 * GET /sysplus/cotizacion/logs
 * Lista los logs de cotizaciones con filtros opcionales
 */
sysplusRoute.get("/cotizacion/logs", authMiddleware(true), async (c) => {
  try {
    const url = new URL(c.req.url);
    const status = url.searchParams.get("status");
    const vendedor = url.searchParams.get("vendedor");
    const cliente = url.searchParams.get("cliente");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const filter: any = {};

    if (status && ["success", "error"].includes(status)) filter.status = status;
    if (vendedor) filter.vendedor = Number(vendedor);
    if (cliente) filter.cliente = { $regex: cliente, $options: "i" }; // búsqueda parcial

    const total = await CotizacionLog.countDocuments(filter);
    const logs = await CotizacionLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return c.json({
      ok: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error al listar logs:", errorMsg);
    return c.json({ ok: false, error: errorMsg }, 500);
  }
});
