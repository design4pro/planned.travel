import { Hono } from "hono";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createAuth } from "../lib/auth";
import { db as getDb } from "../lib/db";
import { dayItems, days, expenses, expenseSplits, places, tripMembers, trips } from "@planned/db";
import { equalSplit } from "@planned/shared";
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

  /** Idempotent: make sure the trip owner has a trip_member row (role owner). */
  async function ensureOwnerMember(tripId: string, ownerId: string) {
    const [existing] = await database
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, ownerId)))
      .limit(1);
    if (!existing) {
      await database.insert(tripMembers).values({ tripId, userId: ownerId, role: "owner" });
    }
  }

  type UserRow = { id: string; name: string | null; email: string };

  /** Fetch display info (name/email) for a set of better_auth user ids. */
  async function fetchUsers(userIds: string[]): Promise<Map<string, UserRow>> {
    const out = new Map<string, UserRow>();
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT id, name, email FROM "user" WHERE id IN (${placeholders})`,
    ).bind(...ids).all<UserRow>();
    for (const u of results ?? []) out.set(u.id, u);
    return out;
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
    await database.insert(tripMembers).values({ tripId: created.id, userId: user.id, role: "owner" });
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

  // ── Members (list / add-by-email) ──────────────────────────────────────────
  app.get("/api/trips/:id/members", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    await ensureOwnerMember(trip.id, trip.ownerId);

    const rows = await database
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, trip.id))
      .all();
    const users = await fetchUsers(rows.map((m) => m.userId));
    return c.json(
      rows.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: users.get(m.userId)?.name ?? null,
        email: users.get(m.userId)?.email ?? null,
      })),
    );
  });

  app.post("/api/trips/:id/members", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return c.json({ error: "email required" }, 400);

    const target = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (!target) return c.json({ error: "user not found" }, 404);

    // Don't double-insert the same member.
    const [existing] = await database
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, target.id)))
      .limit(1);
    if (existing) return c.json({ ok: true, already: true });

    const [member] = await database
      .insert(tripMembers)
      .values({ tripId: trip.id, userId: target.id, role: "editor" })
      .returning();
    return c.json({ userId: member.userId, role: member.role }, 201);
  });

  // ── Expenses (list / create / delete) ──────────────────────────────────────
  app.get("/api/trips/:id/expenses", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const expenseRows = await database
      .select()
      .from(expenses)
      .where(eq(expenses.tripId, trip.id))
      .orderBy(desc(expenses.createdAt))
      .all();
    const expenseIds = expenseRows.map((e) => e.id);
    const splitRows = expenseIds.length
      ? await database.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds)).all()
      : [];
    const splitsByExpense = new Map<string, typeof splitRows>();
    for (const s of splitRows) {
      const arr = splitsByExpense.get(s.expenseId) ?? [];
      arr.push(s);
      splitsByExpense.set(s.expenseId, arr);
    }
    return c.json(
      expenseRows.map((e) => ({
        ...e,
        splits: (splitsByExpense.get(e.id) ?? []).map((s) => ({
          userId: s.userId,
          shareCents: s.shareCents,
        })),
      })),
    );
  });

  app.post("/api/trips/:id/expenses", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    await ensureOwnerMember(trip.id, trip.ownerId);

    const body = await c.req.json().catch(() => ({}));
    const amountCents = Math.round(Number(body?.amountCents));
    const currency = typeof body?.currency === "string" ? body.currency.toUpperCase() : "";
    if (!Number.isInteger(amountCents) || amountCents < 0 || currency.length !== 3)
      return c.json({ error: "amountCents (int) and 3-letter currency required" }, 400);

    // Participant set: provided → all trip members. Equal split among them.
    const members = await database
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, trip.id))
      .all();
    const participantIds =
      Array.isArray(body?.participantIds) && body.participantIds.length
        ? ([...new Set(body.participantIds as string[])] as string[])
        : members.map((m) => m.userId);
    if (participantIds.length === 0) participantIds.push(user.id);
    const splits = equalSplit(amountCents, participantIds);

    const [expense] = await database
      .insert(expenses)
      .values({
        tripId: trip.id,
        paidByUserId: user.id,
        amountCents,
        currency,
        category: typeof body?.category === "string" ? body.category : null,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        date: Number.isInteger(body?.date) ? body.date : null,
      })
      .returning();
    if (splits.length) {
      await database
        .insert(expenseSplits)
        .values(splits.map((s) => ({ expenseId: expense.id, userId: s.userId, shareCents: s.shareCents })));
    }
    return c.json({ ...expense, splits }, 201);
  });

  app.delete("/api/expenses/:expenseId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const expenseId = c.req.param("expenseId");

    // Ownership check via the expense's trip.
    const [row] = await database
      .select({ tripId: expenses.tripId })
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);
    if (!row) return c.json({ error: "not found" }, 404);
    const trip = await getOwnedTrip(row.tripId, user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    await database.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await database.delete(expenses).where(eq(expenses.id, expenseId));
    return c.json({ ok: true });
  });

  return app;
}
