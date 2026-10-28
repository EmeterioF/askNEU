import { createMiddleware } from "hono/factory";
import { auth } from "../db/auth.js";

export type AuthEnv = {
  Variables: {
    session: typeof auth.$Infer.Session | null;
  };
};

// runs before a handler, lets everyone through
export const withSession = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("session", session);
  await next();
});

// runs before a handler, stops anyone without a session
export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session);
  await next();
});
