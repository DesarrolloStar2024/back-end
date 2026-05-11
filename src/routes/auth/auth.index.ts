import { OpenAPIHono } from "@hono/zod-openapi";
import { sign } from "hono/jwt";
import { SuperAdmin } from "../../models/SuperAdmin.js";
import { connectDB } from "../../config/index.js";
import { loginRoute } from "./auth.routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "TU_SUPER_SECRETO";

const auth = new OpenAPIHono();

auth.openapi(loginRoute, async (c): Promise<any> => {
  try {
    await connectDB();
    const { usuario, vend, expireAt } = c.req.valid("json");

    if (!usuario && !vend) {
      return c.json({ message: "Datos insuficientes" }, 400);
    }

    const superAdmin = await SuperAdmin.findOne({
      $or: [{ Codigo: usuario }, { Id: vend?.toString() }],
    });

    if (!superAdmin) {
      return c.json(
        { message: "Usuario no autorizado como SuperAdmin", isSuperAdmin: false },
        403,
      );
    }

    const payload = {
      iss: "STAR_BACK",
      user: { usuario, vend, isSuperAdmin: true },
      iat: Math.floor(Date.now() / 1000),
      exp: expireAt || Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    };

    const honoToken = await sign(payload, JWT_SECRET);

    return c.json({
      message: "SuperAdmin autenticado",
      token: honoToken,
      user: payload.user,
      isSuperAdmin: true,
    }, 200);
  } catch (err: any) {
    console.error("Error en /login-hono:", err.message);
    return c.json({ message: "Error interno en login-hono" }, 500);
  }
});

export default auth;
