// routes/auth.ts
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { SuperAdmin } from "../models/SuperAdmin.js";
export const authRoute = new Hono();
const JWT_SECRET = process.env.JWT_SECRET || "TU_SUPER_SECRETO";
authRoute.post("/login-hono", async (c) => {
    try {
        const { usuario, vend, expireAt } = await c.req.json();
        if (!usuario && !vend) {
            return c.json({ message: "Datos insuficientes" }, 400);
        }
        // ✅ CORRECCIÓN: buscar por Código = usuario o Id = vend
        const superAdmin = await SuperAdmin.findOne({
            $or: [{ Codigo: usuario }, { Id: vend?.toString() }],
        });
        if (!superAdmin) {
            return c.json({
                message: "Usuario no autorizado como SuperAdmin",
                isSuperAdmin: false,
            }, 403);
        }
        const payload = {
            iss: "STAR_BACK",
            user: {
                usuario,
                vend,
                isSuperAdmin: true,
            },
            iat: Math.floor(Date.now() / 1000),
            exp: expireAt || Math.floor(Date.now() / 1000) + 60 * 60 * 12,
        };
        const honoToken = await sign(payload, JWT_SECRET);
        return c.json({
            message: "SuperAdmin autenticado ✅",
            token: honoToken,
            user: payload.user,
            isSuperAdmin: true,
        });
    }
    catch (err) {
        console.error("Error en /login-hono:", err.message);
        return c.json({ message: "Error interno en login-hono" }, 500);
    }
});
