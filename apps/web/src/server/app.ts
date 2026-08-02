import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { createAuth } from "../lib/auth";
import { db as getDb } from "../lib/db";
import {
  enqueueNotification,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "../lib/notifications";
import { createStripe } from "../lib/stripe";
import { dayItems, days, documents, expenses, expenseSplits, places, reservations, tripInvitations, tripMembers, trips } from "@planned/db";
import {
  canEdit,
  createInvitationSchema,
  createReservationSchema,
  equalSplit,
  isAllowedUploadType,
  isInvitationOpen,
  invitationStatus,
  linkDocumentSchema,
  MAX_DOCUMENT_BYTES,
  sortReservations,
  summarizeByCurrency,
  updateReservationSchema,
} from "@planned/shared";
import { buildTripHtml, renderTripPdf } from "./trip-pdf";
import {
  FREE_TRIP_LIMIT,
  getOrCreateSubscription,
  isActivePro,
  priceIntervalFromEnv,
  syncSubscriptionFromStripe,
  upsertCustomerId,
} from "./billing";
import { broadcastTripChange } from "./trip-room";
import {
  buildExpenseAddedJobs,
  buildInviteAcceptedJobs,
  buildInviteSentJobs,
  buildMemberRemovedJobs,
  buildReservationAddedJobs,
  buildReservationConfirmedJobs,
  buildRoleChangedJobs,
  buildSubscriptionJobs,
} from "./notifications-triggers";
import type { NotificationJob } from "@planned/shared";
import type { CloudflareEnv } from "../lib/env";
import { appRouter, createContext } from "@planned/server";

type TripRole = "owner" | "editor" | "viewer";

/**
 * Per-request Hono app. Mounted from the Astro catch-all at /api/*
 * (src/pages/api/[...path].ts). Better Auth is delegated under /api/auth/*,
 * app routes live alongside. Everything reads bindings off `env`.
 */
export function createApp(env: CloudflareEnv) {
  const app = new Hono();
  const auth = createAuth(env);
  const database = getDb(env);
  const stripe = createStripe(env);

  async function getUser(req: Request) {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user ?? null;
  }

  /** All trip-member userIds (the owner is a trip_member via ensureOwnerMember). */
  async function getTripMemberUserIds(tripId: string): Promise<string[]> {
    const rows = await database
      .select({ userId: tripMembers.userId })
      .from(tripMembers)
      .where(eq(tripMembers.tripId, tripId))
      .all();
    return rows.map((r) => r.userId);
  }

  /**
   * Enqueue a batch of notification jobs — best-effort, never throws.
   *
   * Enriches each job with an `email` block by resolving recipients' emails from
   * the Better Auth `user` table, so EVERY notification type can email when
   * EMAIL_ENABLED flips on — not just invite_sent (which already carries the
   * invite email). Locale defaults to "en" until a per-user preference column
   * lands (account.astro already stubs a preferences UI); the consumer +
   * templates already honor locale. Jobs with an existing email block keep it;
   * jobs whose recipient can't be resolved stay in-app only.
   */
  async function notifyAll(jobs: NotificationJob[]): Promise<void> {
    if (jobs.length === 0) return;
    const users = await fetchUsers(jobs.map((j) => j.userId)).catch(
      () => new Map<string, UserRow>(),
    );
    await Promise.all(
      jobs.map((j) => {
        if (!j.email) {
          const u = users.get(j.userId);
          if (u?.email) {
            j.email = { to: u.email, template: j.type, locale: "en" };
          }
        }
        return enqueueNotification(env, j);
      }),
    );
  }

  async function getOwnedTrip(id: string, userId: string) {
    const [trip] = await database
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), eq(trips.ownerId, userId)))
      .limit(1);
    return trip ?? null;
  }

  /**
   * Resolve a trip a user can SEE: owner, or an explicit trip_member row
   * (editor/viewer). Returns the trip + the effective role, or null. Replaces
   * the old owner-only reads so collaborators can actually open shared trips.
   */
  async function getAccessibleTrip(id: string, userId: string) {
    const [tripRow, memberRow] = await Promise.all([
      database.select().from(trips).where(eq(trips.id, id)).limit(1),
      database
        .select({ role: tripMembers.role })
        .from(tripMembers)
        .where(and(eq(tripMembers.tripId, id), eq(tripMembers.userId, userId)))
        .limit(1),
    ]);
    const trip = tripRow[0];
    if (!trip) return null;
    const role: TripRole | null =
      trip.ownerId === userId ? "owner" : (memberRow[0]?.role as TripRole | undefined) ?? null;
    if (!role) return null;
    return { trip, role };
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

  // ── tRPC transport ─────────────────────────────────────────────────────────
  // The router and context live in @planned/server; this route is only the
  // request-scoped Cloudflare/Auth adapter. REST remains available during the
  // incremental migration.
  app.all("/api/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: () =>
        createContext({
          request: c.req.raw,
          env,
          resolveUser: async (headers) => {
            const session = await auth.api.getSession({ headers });
            return session?.user ?? null;
          },
          broadcastChange: (tripId, resource, by) => broadcastTripChange(env, tripId, resource, by),
          onReservationChange: async (event) => {
            const memberUserIds = await getTripMemberUserIds(event.tripId);
            await notifyAll(
              event.kind === "added"
                ? buildReservationAddedJobs({
                    tripId: event.tripId,
                    tripName: event.tripName,
                    reservationId: event.reservationId,
                    type: event.type,
                    title: event.title,
                    addedByName: event.actorName ?? null,
                    memberUserIds,
                    actorUserId: event.actorUserId ?? "",
                  })
                : buildReservationConfirmedJobs({
                    tripId: event.tripId,
                    tripName: event.tripName,
                    reservationId: event.reservationId,
                    type: event.type,
                    title: event.title,
                    memberUserIds,
                  }),
            );
          },
        }),
    }),
  );

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
    const [owned, memberRows] = await Promise.all([
      database
        .select()
        .from(trips)
        .where(eq(trips.ownerId, user.id))
        .orderBy(desc(trips.updatedAt))
        .all(),
      database
        .select({ trip: trips, role: tripMembers.role })
        .from(tripMembers)
        .innerJoin(trips, eq(trips.id, tripMembers.tripId))
        .where(eq(tripMembers.userId, user.id))
        .all(),
    ]);
    const out = [
      ...owned.map((t) => ({ ...t, role: "owner" as const })),
      // Skip rows where the user is also the owner (avoid dupes).
      ...memberRows
        .filter((r) => r.trip.ownerId !== user.id)
        .map((r) => ({ ...r.trip, role: r.role as TripRole })),
    ];
    return c.json(out);
  });

  app.post("/api/trips", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);

    // Free-tier quota: max FREE_TRIP_LIMIT trips unless on an active Pro plan.
    const sub = await getOrCreateSubscription(database, user.id);
    if (!isActivePro(sub)) {
      const ownedCount = (await database.select().from(trips).where(eq(trips.ownerId, user.id)).all()).length;
      if (ownedCount >= FREE_TRIP_LIMIT)
        return c.json({ error: "plan_limit", limit: FREE_TRIP_LIMIT }, 402);
    }

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
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    const { trip } = access;

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
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;

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
    await broadcastTripChange(env, trip.id, "places", user.id);
    return c.json(place, 201);
  });

  // ── Days (create) ──────────────────────────────────────────────────────────
  app.post("/api/trips/:id/days", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;

    const existing = await database
      .select()
      .from(days)
      .where(eq(days.tripId, trip.id))
      .orderBy(desc(days.dateIndex))
      .all();
    const nextIndex = (existing[0]?.dateIndex ?? -1) + 1;
    const [day] = await database.insert(days).values({ tripId: trip.id, dateIndex: nextIndex }).returning();
    await broadcastTripChange(env, trip.id, "plan", user.id);
    return c.json(day, 201);
  });

  // ── Day items (create) ─────────────────────────────────────────────────────
  app.post("/api/trips/:id/items", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;

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
    await broadcastTripChange(env, trip.id, "plan", user.id);
    return c.json(item, 201);
  });

  // ── Members (list / add / role / remove) ───────────────────────────────────
  app.get("/api/trips/:id/members", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    await ensureOwnerMember(access.trip.id, access.trip.ownerId);

    const rows = await database
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, access.trip.id))
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
    const role: "editor" | "viewer" | null =
      body?.role === "viewer" ? "viewer" : body?.role === "editor" || body?.role == null ? "editor" : null;
    if (!email) return c.json({ error: "email required" }, 400);
    if (!role) return c.json({ error: "role must be editor or viewer" }, 400);

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
      .values({ tripId: trip.id, userId: target.id, role })
      .returning();
    await broadcastTripChange(env, trip.id, "members", user.id);
    await notifyAll(
      buildInviteSentJobs({
        tripId: trip.id,
        tripName: trip.title,
        targetUserId: member.userId,
        inviterName: user.name ?? null,
        inviteEmail: email,
      }),
    );
    return c.json({ userId: member.userId, role: member.role }, 201);
  });

  /** Owner changes a member's role (editor ↔ viewer). Owners are immutable. */
  app.patch("/api/trips/:id/members/:userId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    const targetUserId = c.req.param("userId");
    if (targetUserId === trip.ownerId) return c.json({ error: "cannot_change_owner" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const role: TripRole | null =
      body?.role === "editor" ? "editor" : body?.role === "viewer" ? "viewer" : null;
    if (!role) return c.json({ error: "role required (editor|viewer)" }, 400);

    const [updated] = await database
      .update(tripMembers)
      .set({ role })
      .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, targetUserId)))
      .returning();
    if (!updated) return c.json({ error: "not found" }, 404);
    await broadcastTripChange(env, trip.id, "members", user.id);
    await notifyAll(
      buildRoleChangedJobs({
        tripId: trip.id,
        tripName: trip.title,
        targetUserId: targetUserId,
        newRole: role as "editor" | "viewer",
        changedByName: user.name ?? null,
      }),
    );
    return c.json({ userId: updated.userId, role: updated.role });
  });

  /** Owner removes a member (cannot remove the owner / themselves as owner). */
  app.delete("/api/trips/:id/members/:userId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    const targetUserId = c.req.param("userId");
    if (targetUserId === trip.ownerId) return c.json({ error: "cannot_remove_owner" }, 400);

    await database
      .delete(tripMembers)
      .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, targetUserId)));
    await broadcastTripChange(env, trip.id, "members", user.id);
    await notifyAll(
      buildMemberRemovedJobs({
        tripId: trip.id,
        tripName: trip.title,
        targetUserId: targetUserId,
        removedByName: user.name ?? null,
      }),
    );
    return c.json({ ok: true });
  });

  // ── Invitations (owner: create / list / revoke; anyone authed: accept) ────
  app.post("/api/trips/:id/invitations", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = createInvitationSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.flatten() }, 400);

    const token = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = parsed.data.expiresInDays
      ? now + parsed.data.expiresInDays * 24 * 60 * 60 * 1000
      : null;
    const [inv] = await database
      .insert(tripInvitations)
      .values({
        tripId: trip.id,
        token,
        role: parsed.data.role,
        createdBy: user.id,
        expiresAt,
        maxUses: parsed.data.maxUses ?? null,
      })
      .returning();
    return c.json(
      {
        id: inv.id,
        token: inv.token,
        url: `${env.APP_URL}/invite/${inv.token}`,
        role: inv.role,
        expiresAt: inv.expiresAt,
        maxUses: inv.maxUses,
      },
      201,
    );
  });

  app.get("/api/trips/:id/invitations", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const trip = await getOwnedTrip(c.req.param("id"), user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    const rows = await database
      .select()
      .from(tripInvitations)
      .where(eq(tripInvitations.tripId, trip.id))
      .orderBy(desc(tripInvitations.createdAt))
      .all();
    const now = Date.now();
    return c.json(
      rows.map((i) => ({
        id: i.id,
        token: i.token,
        url: `${env.APP_URL}/invite/${i.token}`,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        maxUses: i.maxUses,
        useCount: i.useCount,
        revokedAt: i.revokedAt,
        open: isInvitationOpen({
          revokedAt: i.revokedAt,
          expiresAt: i.expiresAt,
          maxUses: i.maxUses,
          useCount: i.useCount,
          now,
        }),
        status: invitationStatus({
          revokedAt: i.revokedAt,
          expiresAt: i.expiresAt,
          maxUses: i.maxUses,
          useCount: i.useCount,
          now,
        }),
      })),
    );
  });

  /** Revoke an invitation (owner only). */
  app.delete("/api/invitations/:invId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const invId = c.req.param("invId");
    const [inv] = await database
      .select({ tripId: tripInvitations.tripId })
      .from(tripInvitations)
      .where(eq(tripInvitations.id, invId))
      .limit(1);
    if (!inv) return c.json({ error: "not found" }, 404);
    const trip = await getOwnedTrip(inv.tripId, user.id);
    if (!trip) return c.json({ error: "not found" }, 404);
    await database
      .update(tripInvitations)
      .set({ revokedAt: Date.now() })
      .where(eq(tripInvitations.id, invId));
    return c.json({ ok: true });
  });

  /** Accept an invitation (authenticated). Adds/upgrades the caller's membership. */
  app.post("/api/invitations/:token/accept", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const token = c.req.param("token");
    const [inv] = await database
      .select()
      .from(tripInvitations)
      .where(eq(tripInvitations.token, token))
      .limit(1);
    if (!inv || inv.revokedAt != null) return c.json({ error: "invalid_or_revoked" }, 410);
    const now = Date.now();
    if (inv.expiresAt != null && inv.expiresAt <= now) return c.json({ error: "expired" }, 410);
    if (inv.maxUses != null && inv.useCount >= inv.maxUses)
      return c.json({ error: "exhausted" }, 410);

    // Don't demote an owner; otherwise add or upgrade to the invitation's role.
    const [tripRow] = await database
      .select({ ownerId: trips.ownerId })
      .from(trips)
      .where(eq(trips.id, inv.tripId))
      .limit(1);
    if (!tripRow) return c.json({ error: "not found" }, 404);

    // Claim a use atomically before changing membership. The initial read above
    // is only an inexpensive error fast-path; this conditional update prevents
    // concurrent accepts from exceeding a finite maxUses cap.
    const claim = await env.DB
      .prepare(
        `UPDATE trip_invitation
         SET use_count = use_count + 1
         WHERE id = ?
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)
           AND (max_uses IS NULL OR use_count < max_uses)`,
      )
      .bind(inv.id, now)
      .run();
    if ((claim.meta.changes ?? 0) !== 1) {
      const [latest] = await database
        .select()
        .from(tripInvitations)
        .where(eq(tripInvitations.id, inv.id))
        .limit(1);
      const status = latest
        ? invitationStatus({
            revokedAt: latest.revokedAt,
            expiresAt: latest.expiresAt,
            maxUses: latest.maxUses,
            useCount: latest.useCount,
            now: Date.now(),
          })
        : "revoked";
      return c.json({ error: status === "open" ? "invalid" : status }, 410);
    }

    if (tripRow.ownerId !== user.id) {
      const [existing] = await database
        .select()
        .from(tripMembers)
        .where(and(eq(tripMembers.tripId, inv.tripId), eq(tripMembers.userId, user.id)))
        .limit(1);
      // editor outranks viewer: only upgrade, never downgrade an existing role.
      const role: TripRole =
        existing && existing.role === "editor" ? "editor" : (inv.role as TripRole);
      if (existing) {
        await database
          .update(tripMembers)
          .set({ role })
          .where(eq(tripMembers.id, existing.id));
      } else {
        await database
          .insert(tripMembers)
          .values({ tripId: inv.tripId, userId: user.id, role });
      }
    }
    await broadcastTripChange(env, inv.tripId, "members", user.id);
    if (tripRow.ownerId !== user.id) {
      const [t] = await database
        .select({ title: trips.title })
        .from(trips)
        .where(eq(trips.id, inv.tripId))
        .limit(1);
      await notifyAll(
        buildInviteAcceptedJobs({
          tripId: inv.tripId,
          tripName: t?.title ?? "",
          ownerId: tripRow.ownerId,
          accepterName: user.name ?? null,
          role: inv.role as "editor" | "viewer",
        }),
      );
    }
    return c.json({ tripId: inv.tripId, role: inv.role });
  });

  /** Preview an invitation (public — the token is the secret). */
  app.get("/api/invitations/:token", async (c) => {
    const token = c.req.param("token");
    const [inv] = await database
      .select()
      .from(tripInvitations)
      .where(eq(tripInvitations.token, token))
      .limit(1);
    if (!inv) return c.json({ valid: false, reason: "invalid" }, 404);
    const now = Date.now();
    const status = invitationStatus({
      revokedAt: inv.revokedAt,
      expiresAt: inv.expiresAt,
      maxUses: inv.maxUses,
      useCount: inv.useCount,
      now,
    });
    if (status !== "open") {
      return c.json({ valid: false, reason: status });
    }
    const [tripRow] = await database
      .select({ title: trips.title })
      .from(trips)
      .where(eq(trips.id, inv.tripId))
      .limit(1);
    return c.json({ valid: true, tripId: inv.tripId, tripTitle: tripRow?.title ?? null, role: inv.role });
  });

  // ── Realtime: WebSocket upgrade for a trip room ───────────────────────────
  // Browser opens `new WebSocket('/api/trips/:id/sync')`. Same-origin cookies
  // authenticate the handshake; access is resolved the same way as reads. The
  // resolved presence is forwarded to the DO via x-trip-user.
  app.get("/api/trips/:id/sync", async (c) => {
    const upgrade = c.req.header("upgrade") ?? "";
    if (!upgrade.toLowerCase().includes("websocket"))
      return c.json({ error: "ws_required" }, 400);
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!env.TRIP_ROOM) return c.json({ error: "realtime_unavailable" }, 503);

    const headers = new Headers(c.req.raw.headers);
    headers.set(
      "x-trip-user",
      JSON.stringify({ userId: user.id, name: user.name ?? null, role: access.role }),
    );
    const id = env.TRIP_ROOM.idFromName(access.trip.id);
    return env.TRIP_ROOM.get(id).fetch(new Request(c.req.raw.url, { headers }));
  });

  // ── Expenses (list / create / delete) ──────────────────────────────────────
  app.get("/api/trips/:id/expenses", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    const { trip } = access;

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
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;
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
    await broadcastTripChange(env, trip.id, "expenses", user.id);
    await notifyAll(
      buildExpenseAddedJobs({
        tripId: trip.id,
        tripName: trip.title,
        expenseId: expense.id,
        amountCents,
        currency,
        description: expense.description,
        paidByName: user.name ?? null,
        participantIds,
        actorUserId: user.id,
      }),
    );
    return c.json({ ...expense, splits }, 201);
  });

  app.delete("/api/expenses/:expenseId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const expenseId = c.req.param("expenseId");

    // Access check via the expense's trip (editor+ may delete).
    const [row] = await database
      .select({ tripId: expenses.tripId })
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);
    if (!row) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(row.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);

    await database.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await database.delete(expenses).where(eq(expenses.id, expenseId));
    await broadcastTripChange(env, access.trip.id, "expenses", user.id);
    return c.json({ ok: true });
  });

  // ── Reservations (list / create / update / delete) ─────────────────────────
  app.get("/api/trips/:id/reservations", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    const rows = await database.select().from(reservations).where(eq(reservations.tripId, access.trip.id)).all();
    return c.json(sortReservations(rows));
  });

  app.post("/api/trips/:id/reservations", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;

    const body = await c.req.json().catch(() => ({}));
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.flatten() }, 400);
    const { startsAt, endsAt } = parsed.data;
    if (startsAt != null && endsAt != null && endsAt < startsAt)
      return c.json({ error: "ends_before_starts" }, 400);

    const [created] = await database
      .insert(reservations)
      .values({ tripId: trip.id, ...parsed.data })
      .returning();
    await broadcastTripChange(env, trip.id, "reservations", user.id);
    const memberIds = await getTripMemberUserIds(trip.id);
    await notifyAll(
      buildReservationAddedJobs({
        tripId: trip.id,
        tripName: trip.title,
        reservationId: created.id,
        type: created.type,
        title: created.title,
        addedByName: user.name ?? null,
        memberUserIds: memberIds,
        actorUserId: user.id,
      }),
    );
    return c.json(created, 201);
  });

  app.patch("/api/reservations/:resId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const resId = c.req.param("resId");
    const [row] = await database.select({ tripId: reservations.tripId }).from(reservations).where(eq(reservations.id, resId)).limit(1);
    if (!row) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(row.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateReservationSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.flatten() }, 400);
    const { startsAt, endsAt } = parsed.data;
    if (startsAt != null && endsAt != null && endsAt < startsAt)
      return c.json({ error: "ends_before_starts" }, 400);

    const [updated] = await database
      .update(reservations)
      .set(parsed.data)
      .where(eq(reservations.id, resId))
      .returning();
    await broadcastTripChange(env, access.trip.id, "reservations", user.id);
    if (parsed.data.status === "confirmed") {
      const memberIds = await getTripMemberUserIds(access.trip.id);
      await notifyAll(
        buildReservationConfirmedJobs({
          tripId: access.trip.id,
          tripName: access.trip.title,
          reservationId: updated.id,
          type: updated.type,
          title: updated.title,
          memberUserIds: memberIds,
        }),
      );
    }
    return c.json(updated);
  });

  app.delete("/api/reservations/:resId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const resId = c.req.param("resId");
    const [row] = await database.select({ tripId: reservations.tripId }).from(reservations).where(eq(reservations.id, resId)).limit(1);
    if (!row) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(row.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);

    // Null out any linked documents first (document.reservation_id FK → reservation).
    await database.update(documents).set({ reservationId: null }).where(eq(documents.reservationId, resId));
    await database.delete(reservations).where(eq(reservations.id, resId));
    await broadcastTripChange(env, access.trip.id, "reservations", user.id);
    return c.json({ ok: true });
  });

  // ── Documents (list / upload / link / download / delete) ───────────────────
  app.get("/api/trips/:id/documents", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    const rows = await database
      .select()
      .from(documents)
      .where(eq(documents.tripId, access.trip.id))
      .orderBy(desc(documents.createdAt))
      .all();
    return c.json(rows);
  });

  app.post("/api/trips/:id/documents", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);
    const { trip } = access;

    const form = await c.req.raw.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
    if (file.size === 0) return c.json({ error: "empty_file" }, 400);
    if (file.size > MAX_DOCUMENT_BYTES)
      return c.json({ error: "file_too_large", limit: MAX_DOCUMENT_BYTES }, 413);
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedUploadType(mimeType)) return c.json({ error: "unsupported_type" }, 415);

    const reservationIdRaw = form.get("reservationId");
    const reservationId =
      typeof reservationIdRaw === "string" && reservationIdRaw ? reservationIdRaw : null;
    if (reservationId) {
      const [r] = await database
        .select({ id: reservations.id })
        .from(reservations)
        .where(and(eq(reservations.id, reservationId), eq(reservations.tripId, trip.id)))
        .limit(1);
      if (!r) return c.json({ error: "reservation not found" }, 404);
    }

    const docId = crypto.randomUUID();
    const r2Key = `trips/${trip.id}/docs/${docId}`;
    // Pass the File (Blob) directly — it carries a known length. A bare
    // ReadableStream (file.stream()) is rejected by R2 as "unknown length".
    await env.MEDIA.put(r2Key, file, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { name: file.name, tripId: trip.id, uploadedBy: user.id },
    });

    const [doc] = await database
      .insert(documents)
      .values({
        id: docId,
        tripId: trip.id,
        reservationId,
        uploadedByUserId: user.id,
        r2Key,
        name: file.name || "document",
        mimeType,
        sizeBytes: file.size,
      })
      .returning();
    await broadcastTripChange(env, trip.id, "documents", user.id);
    return c.json(doc, 201);
  });

  /** Link/unlink a document to a reservation (both must belong to the trip). */
  app.patch("/api/documents/:docId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const docId = c.req.param("docId");
    const [doc] = await database.select({ tripId: documents.tripId }).from(documents).where(eq(documents.id, docId)).limit(1);
    if (!doc) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(doc.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);

    const body = await c.req.json().catch(() => ({}));
    const parsed = linkDocumentSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid", issues: parsed.error.flatten() }, 400);
    if (parsed.data.reservationId) {
      const [r] = await database
        .select({ id: reservations.id })
        .from(reservations)
        .where(and(eq(reservations.id, parsed.data.reservationId), eq(reservations.tripId, access.trip.id)))
        .limit(1);
      if (!r) return c.json({ error: "reservation not found" }, 404);
    }

    const [updated] = await database
      .update(documents)
      .set({ reservationId: parsed.data.reservationId })
      .where(eq(documents.id, docId))
      .returning();
    await broadcastTripChange(env, access.trip.id, "documents", user.id);
    return c.json(updated);
  });

  app.get("/api/documents/:docId/download", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const [doc] = await database.select().from(documents).where(eq(documents.id, c.req.param("docId"))).limit(1);
    if (!doc) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(doc.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);

    const obj = await env.MEDIA.get(doc.r2Key);
    if (!obj) return c.json({ error: "not found" }, 404);

    // Set headers from the DB row rather than obj.writeHttpMetadata — the latter
    // crosses the platformProxy/miniflare bridge in dev and trips a devalue
    // serialization error on the Headers object. doc.mimeType/sizeBytes are
    // always available and keep this portable across dev + prod.
    const headers = new Headers();
    headers.set("content-type", doc.mimeType);
    headers.set("content-disposition", `attachment; filename="${encodeURIComponent(doc.name)}"`);
    headers.set("content-length", String(doc.sizeBytes));
    return new Response(obj.body, { headers });
  });

  app.delete("/api/documents/:docId", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const docId = c.req.param("docId");
    const [doc] = await database.select({ tripId: documents.tripId, r2Key: documents.r2Key }).from(documents).where(eq(documents.id, docId)).limit(1);
    if (!doc) return c.json({ error: "not found" }, 404);
    const access = await getAccessibleTrip(doc.tripId, user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    if (!canEdit(access.role)) return c.json({ error: "forbidden" }, 403);

    await env.MEDIA.delete(doc.r2Key);
    await database.delete(documents).where(eq(documents.id, docId));
    await broadcastTripChange(env, access.trip.id, "documents", user.id);
    return c.json({ ok: true });
  });

  // ── PDF export (Browser Rendering; Pro-gated) ──────────────────────────────
  app.get("/api/trips/:id/export.pdf", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const access = await getAccessibleTrip(c.req.param("id"), user.id);
    if (!access) return c.json({ error: "not found" }, 404);
    const { trip } = access;

    // Exports are a Pro feature (monetization decision: quota gates exports).
    const sub = await getOrCreateSubscription(database, user.id);
    if (!isActivePro(sub)) return c.json({ error: "plan_required", plan: "pro" }, 402);
    if (!env.BROWSER) return c.json({ error: "export_unavailable" }, 503);

    const [dayRows, placeRows, resRows, memberRows, expenseRows] = await Promise.all([
      database.select().from(days).where(eq(days.tripId, trip.id)).orderBy(asc(days.dateIndex)).all(),
      database.select().from(places).where(eq(places.tripId, trip.id)).all(),
      database.select().from(reservations).where(eq(reservations.tripId, trip.id)).all(),
      database.select().from(tripMembers).where(eq(tripMembers.tripId, trip.id)).all(),
      database.select().from(expenses).where(eq(expenses.tripId, trip.id)).all(),
    ]);
    const dayIds = dayRows.map((d) => d.id);
    const itemRows = dayIds.length
      ? await database.select().from(dayItems).where(inArray(dayItems.dayId, dayIds)).orderBy(asc(dayItems.orderIndex)).all()
      : [];
    const expenseIds = expenseRows.map((e) => e.id);
    const splitRows = expenseIds.length
      ? await database.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds)).all()
      : [];

    const summaries = summarizeByCurrency(
      memberRows.map((m) => ({ userId: m.userId })),
      expenseRows.map((e) => ({
        id: e.id,
        paidByUserId: e.paidByUserId,
        amountCents: e.amountCents,
        currency: e.currency,
        splits: splitRows
          .filter((s) => s.expenseId === e.id)
          .map((s) => ({ userId: s.userId, shareCents: s.shareCents })),
      })),
    );

    const userIds = [...new Set([trip.ownerId, ...memberRows.map((m) => m.userId)])];
    const users = await fetchUsers(userIds);
    const userNames = new Map<string, string>();
    for (const [id, u] of users) userNames.set(id, u.name ?? u.email ?? id.slice(0, 6));

    const html = buildTripHtml({
      trip: {
        title: trip.title,
        startAt: trip.startAt,
        endAt: trip.endAt,
        description: trip.description,
      },
      days: dayRows.map((d) => ({ id: d.id, dateIndex: d.dateIndex })),
      items: itemRows.map((it) => ({
        dayId: it.dayId,
        type: it.type,
        note: it.type === "place" ? it.placeId : it.note,
      })),
      places: new Map(placeRows.map((p) => [p.id, { name: p.name }])),
      reservations: resRows.map((r) => ({
        type: r.type,
        status: r.status,
        title: r.title,
        confirmationCode: r.confirmationCode,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      })),
      summaries: summaries.map((s) => ({
        currency: s.currency,
        totalCents: s.totalCents,
        settlements: s.settlements.map((st) => ({
          fromUserId: st.fromUserId,
          toUserId: st.toUserId,
          amountCents: st.amountCents,
        })),
      })),
      userNames,
      currentUserId: user.id,
    });

    // Browser Rendering can't run in local dev/miniflare (and may hit session
    // limits in prod) — degrade to a graceful 503 instead of a 500.
    let pdf: Uint8Array;
    try {
      pdf = await renderTripPdf(env.BROWSER, html);
    } catch (err) {
      console.error("PDF export failed", err);
      return c.json({ error: "export_unavailable" }, 503);
    }
    const filename = `${trip.title.replace(/[^\w-]+/g, "_").slice(0, 60) || "trip"}.pdf`;
    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  });

  // ── Billing (plan / checkout / portal) ─────────────────────────────────────
  app.get("/api/billing/plan", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const row = await getOrCreateSubscription(database, user.id);
    const tripCount = (
      await database.select().from(trips).where(eq(trips.ownerId, user.id)).all()
    ).length;
    const pro = isActivePro(row);
    return c.json({
      plan: row.plan,
      status: row.status,
      interval: row.interval,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodEnd: row.currentPeriodEnd,
      stripeCustomerId: row.stripeCustomerId,
      tripCount,
      tripLimit: pro ? null : FREE_TRIP_LIMIT,
    });
  });

  app.post("/api/billing/checkout", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => ({}));
    const interval = body?.interval === "year" ? "year" : "month";
    const priceId = interval === "year" ? env.STRIPE_PRICE_PRO_ANNUAL : env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId || !priceId.startsWith("price_"))
      return c.json({ error: "billing_not_configured" }, 500);

    const row = await getOrCreateSubscription(database, user.id);
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      // No payment_method_types — Stripe uses dynamic payment methods.
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/app/account?checkout=success`,
      cancel_url: `${env.APP_URL}/pricing?checkout=cancel`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
    };
    if (row.stripeCustomerId) params.customer = row.stripeCustomerId;
    else params.customer_email = user.email;

    const session = await stripe.checkout.sessions.create(params);
    return c.json({ url: session.url });
  });

  app.post("/api/billing/portal", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const row = await getOrCreateSubscription(database, user.id);
    if (!row.stripeCustomerId) return c.json({ error: "no_customer" }, 400);
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${env.APP_URL}/app/account`,
    });
    return c.json({ url: session.url });
  });

  // ── Notifications (list / unread-count / mark-read / mark-all-read) ─────────
  // All session-auth-gated and scoped to the caller — no cross-user access.
  app.get("/api/notifications", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const limitRaw = Number(c.req.query("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    const beforeRaw = Number(c.req.query("before"));
    const beforeCreatedAt = Number.isFinite(beforeRaw) && beforeRaw > 0 ? beforeRaw : undefined;
    const rows = await listNotifications(database, user.id, { limit, beforeCreatedAt });
    return c.json(rows);
  });

  app.get("/api/notifications/unread-count", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const count = await unreadCount(database, user.id);
    return c.json({ count });
  });

  // POST routes from React islands send a same-origin Origin header in prod
  // (same pattern as the collab POST routes above), so the Astro CSRF/Origin
  // check passes. Localhost is exempt.
  app.post("/api/notifications/:id/read", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const id = c.req.param("id");
    const updated = await markRead(database, id, user.id);
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  app.post("/api/notifications/read-all", async (c) => {
    const user = await getUser(c.req.raw);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    await markAllRead(database, user.id);
    return c.json({ ok: true });
  });

  // ── Stripe webhook (public — no session) ──────────────────────────────────
  app.post("/api/webhooks/stripe", async (c) => {
    const sig = c.req.header("stripe-signature");
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) return c.json({ error: "missing" }, 400);
    const rawBody = await c.req.raw.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return c.json({ error: "invalid_signature" }, 400);
    }

    // Idempotency: Stripe may redeliver. Dedup on event.id via KV (30-day TTL).
    const dedupKey = `stripe_evt:${event.id}`;
    if (await env.KV.get(dedupKey)) return c.json({ received: true, duplicate: true });
    await env.KV.put(dedupKey, "1", { expirationTtl: 60 * 60 * 24 * 30 });

    const priceToInterval = priceIntervalFromEnv(env);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
        if (userId && typeof session.customer === "string") {
          await upsertCustomerId(database, userId, session.customer);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const transition = await syncSubscriptionFromStripe(database, sub, priceToInterval);
        if (transition) {
          await notifyAll(
            buildSubscriptionJobs({ ...transition, eventType: event.type, now: Date.now() }),
          );
        }
        break;
      }
      default:
        break;
    }
    return c.json({ received: true });
  });

  return app;
}
