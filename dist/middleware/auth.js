// src/middleware/auth.ts
import { verify } from "hono/jwt";
const JWT_SECRET = process.env.JWT_SECRET || "TU_SUPER_SECRETO";
/**
 * Middleware que valida el token de autenticación.
 * Opcionalmente puede requerir permisos de superadmin.
 */
export const authMiddleware = (requireSuperAdmin = false) => {
    return async (c, next) => {
        const auth = c.req.header("Authorization");
        if (!auth?.startsWith("Bearer ")) {
            return c.json({ message: "Token requerido" }, 401);
        }
        const token = auth.split(" ")[1];
        try {
            const payload = await verify(token, JWT_SECRET);
            const user = payload.user || {};
            // Si requiere superadmin y no lo es → 403
            if (requireSuperAdmin && !user.isSuperAdmin) {
                return c.json({ message: "No autorizado (solo SuperAdmins)" }, 403);
            }
            // Guardar usuario en el contexto para uso posterior
            c.set("user", user);
            await next();
        }
        catch (err) {
            console.error("Auth middleware error:", err);
            return c.json({ message: "Token inválido o expirado" }, 401);
        }
    };
};
