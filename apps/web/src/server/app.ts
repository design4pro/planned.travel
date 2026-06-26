import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createAuth } from "../lib/auth";
import { db as getDb } from "../lib/db";
import { trips } from "@planned/db";
import type { CloudflareEnv } from "../lib/env";

type Auth = ReturnType<typeof createAuth>;

/**
 * Per-request Hono app. Mounted from the Astro catch-all at /api/*
 * (see src/pages/api/[...path].ts). Better Auth is delegated under /api/auth/*,
 * app routes live alongside. Everything reads bindings off `env`.
 */
export function createApp(env: CloudflareEnv) {
  const app = new Hono();
  const auth = createAuth(env);
  const database = getDb(env);

  /** Resolve the authenticated user (or null) from the request cookie/bearer. */
  async function getUser(req: Request) {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user ?? null;
  }

  // ── Better Auth: hand the full raw request through under /api/auth/* ────────
  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "planned-travel-web",
      bindings: {
        db: Boolean(env.DB),
        ai: Boolean(env.AI),
        vectorize: Boolean(env.VECTORIZE),
      },
    })
  );

  // ── Trips ──────────────────────────────────────────────────────────────────
  app.get("/api/trips", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const owned = await database
      .select()
      .from(trips)
      .where(eq(trips.ownerId, user.id))
      .all();
    return c.json(owned);
  });

  app.post("/api/trips", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);

    const [created] = await database
      .insert(trips)
      .values({ ownerId: user.id, title })
      .returning();
    return c.json(created, 201);
  });

  return app;
}
