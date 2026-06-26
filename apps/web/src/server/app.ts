import { Hono } from "hono";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createAuth } from "../lib/auth";
import { db as getDb } from "../lib/db";
import { dayItems, days, places, trips } from "@planned/db";
import type { CloudflareEnv } from "../lib/env";

type Database = ReturnType<typeof getDb>;

/**
 * Per-request Hono app. Mounted from the Astro catch-all at /api/*
 * (src/pages/api/[...path].ts). Better Auth is delegated under /api/auth/*,
 * app routes live alongside. Everything reads bindings off `env`.
 */
export function createApp(env: CloudflareEnv) {
  const app = new Hono();
  const auth = createAuth(env);
  const database = getDb(env);

  async function getUser(req: Request) {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user ?? null;
  }

  async function getOwnedTrip(id: string, userId: string) {
    const [trip] = await database
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), eq(trips.ownerId, userId)))
      .limit(1);
    return trip ?? null;
  }

  // ── Better Auth ────────────────────────────────────────────────────────────
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

  // ── Trips (list/create) ────────────────────────────────────────────────────
  app.get("/api/trips", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const owned = await database
      .select()
      .from(trips)
      .where(eq(trips.ownerId, user.id))
      .orderBy(desc(trips.updatedAt))
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

  // ── Trip plan (read) ───────────────────────────────────────────────────────
  app.get("/api/trips/:id", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const [dayRows, placeRows] = await Promise.all([
      database.select().from(days).where(eq(days.tripId, trip.id)).orderBy(asc(days.dateIndex)).all(),
      database.select().from(places).where(eq(places.tripId, trip.id)).all(),
    ]);
    const dayIds = dayRows.map((d) => d.id);
    const itemRows = dayIds.length
      ? await database
          .select()
          .from(dayItems)
          .where(inArray(dayItems.dayId, dayIds))
          .orderBy(asc(dayItems.orderIndex))
          .all()
      : [];

    return c.json({ trip, days: dayRows, places: placeRows, items: itemRows });
  });

  // ── Places (create) ────────────────────────────────────────────────────────
  app.post("/api/trips/:id/places", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!name || Number.isNaN(lat) || Number.isNaN(lng))
      return c.json({ error: "name, lat, lng required" }, 400);

    const [place] = await database
      .insert(places)
      .values({ tripId: trip.id, name, lat, lng, category: body?.category, address: body?.address })
      .returning();
    return c.json(place, 201);
  });

  // ── Days (create) ──────────────────────────────────────────────────────────
  app.post("/api/trips/:id/days", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const existing = await database
      .select()
      .from(days)
      .where(eq(days.tripId, trip.id))
      .orderBy(desc(days.dateIndex))
      .all();
    const nextIndex = (existing[0]?.dateIndex ?? -1) + 1;
    const [day] = await database.insert(days).values({ tripId: trip.id, dateIndex: nextIndex }).returning();
    return c.json(day, 201);
  });

  // ── Day items (create) ─────────────────────────────────────────────────────
  app.post("/api/trips/:id/items", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const placeId: string | null = typeof body?.placeId === "string" ? body.placeId : null;
    const note: string | null = typeof body?.note === "string" ? body.note : null;
    const dayIdIn: string | null = typeof body?.dayId === "string" ? body.dayId : null;
    if (!placeId && !note) return c.json({ error: "placeId or note required" }, 400);

    // Resolve a target day: provided (must belong to trip) → first day → create day 0.
    let dayRow = null as { id: string } | null;
    if (dayIdIn) {
      const [d] = await database
        .select()
        .from(days)
        .where(and(eq(days.id, dayIdIn), eq(days.tripId, trip.id)))
        .limit(1);
      dayRow = d ?? null;
    }
    if (!dayRow) {
      const first = await database
        .select()
        .from(days)
        .where(eq(days.tripId, trip.id))
        .orderBy(asc(days.dateIndex))
        .all();
      dayRow = first[0] ?? null;
    }
    if (!dayRow) {
      const [created] = await database.insert(days).values({ tripId: trip.id, dateIndex: 0 }).returning();
      dayRow = created;
    }

    const count = (
      await database.select().from(dayItems).where(eq(dayItems.dayId, dayRow.id)).all()
    ).length;
    const [item] = await database
      .insert(dayItems)
      .values({ dayId: dayRow.id, placeId, note, orderIndex: count })
      .returning();
    return c.json(item, 201);
  });

  return app;
}
