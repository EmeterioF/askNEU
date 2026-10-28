import { Hono } from "hono";
import { sql } from "./db/index.js";
import { auth } from "./db/auth.js";
import { requireSession, type AuthEnv } from "./middleware/sessionMiddleware.js";

const app = new Hono<AuthEnv>();

app.all('/api/auth/*', (c) => auth.handler(c.req.raw))

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

app.get("/api/health/db", async (c) => {
  try {
    await sql`SELECT 1`;

    return c.json({
      ok: true,
      database: "ok",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return c.json(
      {
        ok: false,
        database: "error",
      },
      503,
    );
  }
});

app.get("/api/me", requireSession, (c) => {
  return c.json(c.get("session"));
});

export default app;