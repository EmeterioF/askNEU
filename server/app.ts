import { Hono } from "hono";
import { sql } from "./db/index.js";

const app = new Hono();

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

export default app;