/**
 * Tests for the Phase 1 Notifications foundation:
 *  (a) the pure `buildNotification` builder + zod schemas (shared),
 *  (b) the DB helpers (create → list → unreadCount → markRead → markAllRead;
 *      user-scoping — user A cannot read/mutate user B's notification;
 *      not-found returns null/0),
 *  (c) the 4 API routes (auth required, scoped, mark-read 404 on a foreign id).
 *
 * Harness notes:
 *  - The builder/schema tests are pure (no mocks).
 *  - The DB helper + API tests use a thin in-memory store for the `notification`
 *    table (design §12.2). Crucially, the fake evaluates the REAL drizzle
 *    `where` clauses the helpers emit (`eq` / `and` / `isNull` / `lt`) by walking
 *    drizzle's `SQL.queryChunks`, so user-scoping is actually exercised — a plain
 *    match-all fake would not catch scoping bugs. No miniflare/D1 or native
 *    SQLite dependency.
 *  - The API tests mock `../src/lib/auth` (controlled session user), the realtime
 *    bus, Stripe, and `../src/lib/db` (so the app's `database` IS our fake).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth factory so the HTTP router's `getUser` returns a controlled user
// for the API-route tests. Must be set before importing `createApp`.
const SESSION_USER: { id: string; name: string | null; email: string } = {
  id: "user_a",
  name: "Ada",
  email: "ada@example.com",
};
vi.mock("../src/lib/auth", () => ({
  createAuth: () => ({
    api: {
      // Better Auth's getSession: return a session wrapping SESSION_USER when
      // the `x-test-authed` header is "1"; null otherwise (→ 401).
      getSession: async ({ headers }: { headers: Headers }) =>
        headers.get("x-test-authed") === "1"
          ? { user: SESSION_USER, session: { id: "s_1" } }
          : null,
    },
    handler: () => new Response("ok"),
  }),
}));

// Stub Stripe so createApp doesn't try to construct a real client.
vi.mock("../src/lib/stripe", () => ({ createStripe: () => ({}) }));

// Stub the realtime bus so importing createApp doesn't pull in
// `cloudflare:workers` (a Worker-only module that vite can't resolve in node).
vi.mock("../src/server/trip-room", () => ({
  TripRoom: class {},
  broadcastTripChange: async () => {},
}));

// The app's `database = db(env)`. Route tests swap this per-test via routeSuite().
vi.mock("../src/lib/db", () => ({
  db: () => (globalThis as any).__NOTIF_FAKE_DB,
}));

import {
  buildNotification,
  notificationJobSchema,
  notificationPayloadSchemas,
  notificationRowSchema,
  notificationTypeSchema,
  type NotificationType,
} from "@planned/shared";
import { createApp } from "../src/server/app";
import {
  createNotification,
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "../src/lib/notifications";

/* ----------------------- In-memory DB (drizzle-like) --------------------- */
// Stores rows for the `notification` table in a JS array (camelCase keys, the
// shape real drizzle returns) and implements the chained query subset the
// helpers use. Where clauses are evaluated by compileWhere(), which walks the
// REAL drizzle SQL object the helpers build — so eq/and/isNull/lt actually
// filter, and user-scoping is genuinely tested.

type Row = {
  id: string;
  userId: string;
  type: string;
  payload: unknown;
  readAt: number | null;
  createdAt: number;
};

// drizzle column SQL name -> TS field name (the helpers' columns).
const COL_TO_FIELD: Record<string, keyof Row> = {
  id: "id",
  user_id: "userId",
  type: "type",
  payload: "payload",
  read_at: "readAt",
  created_at: "createdAt",
};

type ChunkKind = "string" | "column" | "param" | "sql";
function chunkKind(ch: any): ChunkKind {
  if (!ch || typeof ch !== "object") return "string";
  if (Array.isArray(ch.queryChunks)) return "sql";
  if ("columnType" in ch && "name" in ch) return "column";
  const ctor = ch.constructor?.name;
  if (ctor === "Param") return "param";
  if ("value" in ch && Array.isArray(ch.value)) return "string";
  return "string";
}

/**
 * Compile a drizzle where-clause (`eq`/`and`/`isNull`/`lt`, arbitrarily nested)
 * into a JS predicate over a camelCase row. Returns match-all for null/unknown.
 */
function compileWhere(where: any): (row: Row) => boolean {
  if (where == null) return () => true;
  const chunks: any[] | undefined = where.queryChunks;
  if (!Array.isArray(chunks)) return () => true;

  const children: Array<(row: Row) => boolean> = [];
  let opText = "";
  let col: string | null = null;
  let param: unknown = undefined;
  let hasParam = false;

  for (const ch of chunks) {
    const kind = chunkKind(ch);
    if (kind === "sql") {
      children.push(compileWhere(ch));
    } else if (kind === "column") {
      col = ch.name;
    } else if (kind === "param") {
      param = ch.value;
      hasParam = true;
    } else {
      opText += Array.isArray(ch?.value) ? (ch.value as string[]).join("") : "";
    }
  }

  // Compound (and/or): recurse into the nested SQL children.
  if (children.length > 0) {
    return (row) => children.every((p) => p(row));
  }

  // Leaf: eq / lt / isNull on a single column.
  const field = col ? (COL_TO_FIELD[col] ?? col) : null;
  if (field == null) return () => true;
  if (opText.includes("is null")) return (row) => row[field] == null;
  if (opText.includes("<")) return (row) => hasParam && (row[field] as any) < (param as any);
  // default: equality (the helpers emit `=`; no `!=`/`<=` in the notification paths)
  return (row) => hasParam && row[field] === param;
}

class FakeDb {
  rows: Row[] = [];

  reset() {
    this.rows = [];
  }

  insert() {
    const self = this;
    return {
      values(row: any) {
        self.rows.push({ readAt: null, ...row });
        return Promise.resolve();
      },
    };
  }

  update() {
    const self = this;
    return {
      set(patch: Partial<Row>) {
        return {
          where(where: any) {
            return {
              returning(): Promise<Row[]> {
                const pred = compileWhere(where);
                const out: Row[] = [];
                for (const r of self.rows) {
                  if (pred(r)) {
                    Object.assign(r, patch);
                    out.push(r);
                  }
                }
                return Promise.resolve(out);
              },
            };
          },
        };
      },
    };
  }

  select(_cols?: any) {
    const self = this;
    return {
      from() {
        return {
          where(where: any) {
            const pred = compileWhere(where);
            const matched = () => self.rows.filter((r) => pred(r));
            return {
              orderBy() {
                return {
                  limit(n: number) {
                    return {
                      all(): Promise<Row[]> {
                        // The helpers only ever order by createdAt desc (newest first).
                        const sorted = [...matched()].sort((a, b) => b.createdAt - a.createdAt);
                        return Promise.resolve(sorted.slice(0, n));
                      },
                    };
                  },
                };
              },
              all(): Promise<Row[]> {
                return Promise.resolve(matched());
              },
            };
          },
        };
      },
    };
  }
}

function freshDb(): FakeDb {
  return new FakeDb();
}

/* ------------------------------ Test data -------------------------------- */

// A well-formed payload per type (design §1.2), for schema + builder tests.
const GOOD_PAYLOADS: Record<NotificationType, Record<string, unknown>> = {
  invite_sent: { tripId: "t_1", tripName: "Tokyo", inviteToken: "tok_abc", inviterName: "Ada" },
  invite_accepted: { tripId: "t_1", tripName: "Tokyo", accepterName: "Bob", role: "editor" },
  member_role_changed: { tripId: "t_1", tripName: "Tokyo", newRole: "viewer", changedByName: "Ada" },
  member_removed: { tripId: "t_1", tripName: "Tokyo", removedByName: "Ada" },
  reservation_added: { tripId: "t_1", tripName: "Tokyo", reservationId: "r_1", type: "hotel", title: "Park Hyatt", addedByName: "Ada" },
  reservation_confirmed: { tripId: "t_1", tripName: "Tokyo", reservationId: "r_1", type: "flight", title: "UA 878" },
  expense_added: { tripId: "t_1", tripName: "Tokyo", expenseId: "e_1", amountCents: 4200, currency: "USD", description: "Ramen", paidByName: "Ada" },
  expense_split_updated: { tripId: "t_1", tripName: "Tokyo", expenseId: "e_1", amountCents: 4200, currency: "USD" },
  subscription_activated: { plan: "pro", interval: "month", currentPeriodEnd: 1_700_000_000_000 },
  subscription_canceled: { plan: "pro", canceledAt: 1_700_000_000_000 },
  subscription_past_due: { plan: "pro" },
};

const ALL_TYPES = Object.keys(notificationPayloadSchemas) as NotificationType[];

/* ============================ TESTS ====================================== */

describe("notification schemas (shared)", () => {
  it("notificationTypeSchema accepts all 11 types, rejects unknown", () => {
    for (const t of ALL_TYPES) {
      expect(notificationTypeSchema.safeParse(t).success).toBe(true);
    }
    expect(notificationTypeSchema.safeParse("not_a_type").success).toBe(false);
    expect(notificationTypeSchema.safeParse("").success).toBe(false);
  });

  it("each payload schema accepts a well-formed payload, rejects a malformed one", () => {
    for (const t of ALL_TYPES) {
      const schema = notificationPayloadSchemas[t];
      expect(schema.safeParse(GOOD_PAYLOADS[t]).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false); // every payload has required fields
    }
  });

  it("payload schemas enforce field-level correctness", () => {
    expect(
      notificationPayloadSchemas.expense_added.safeParse({ ...GOOD_PAYLOADS.expense_added, amountCents: 1.5 }).success,
    ).toBe(false); // amountCents must be an int
    expect(
      notificationPayloadSchemas.expense_added.safeParse({ ...GOOD_PAYLOADS.expense_added, currency: "DOLLAR" }).success,
    ).toBe(false); // currency must be 3 chars
    expect(
      notificationPayloadSchemas.invite_accepted.safeParse({ ...GOOD_PAYLOADS.invite_accepted, role: "owner" }).success,
    ).toBe(false); // role enum
    expect(
      notificationPayloadSchemas.reservation_added.safeParse({ ...GOOD_PAYLOADS.reservation_added, type: "spaceship" }).success,
    ).toBe(false); // reservation type enum
  });
});

describe("notificationJobSchema", () => {
  it("accepts a job with and without the email block", () => {
    const base = { userId: "u_1", type: "invite_sent", payload: { tripId: "t_1" } };
    expect(notificationJobSchema.safeParse(base).success).toBe(true);
    expect(
      notificationJobSchema.safeParse({ ...base, email: { to: "a@b.co", template: "invite_sent", locale: "en" } }).success,
    ).toBe(true);
  });

  it("rejects a bad type or a non-record payload", () => {
    expect(notificationJobSchema.safeParse({ userId: "u_1", type: "nope", payload: {} }).success).toBe(false);
    expect(
      notificationJobSchema.safeParse({ userId: "u_1", type: "invite_sent", payload: "not-an-object" }).success,
    ).toBe(false);
  });
});

describe("buildNotification (pure)", () => {
  it("returns a well-formed row with a uuid id + epoch-ms createdAt, readAt null", () => {
    const row = buildNotification({ userId: "u_1", type: "invite_sent", payload: GOOD_PAYLOADS.invite_sent });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(row.userId).toBe("u_1");
    expect(row.type).toBe("invite_sent");
    expect(row.readAt).toBeNull();
    expect(typeof row.createdAt).toBe("number");
    expect(row.payload).toEqual(GOOD_PAYLOADS.invite_sent);
    expect(notificationRowSchema.safeParse(row).success).toBe(true);
  });

  it("throws when the payload doesn't match the type's schema", () => {
    expect(() => buildNotification({ userId: "u_1", type: "invite_sent", payload: {} })).toThrow();
  });

  it("generates a unique id per call", () => {
    const a = buildNotification({ userId: "u_1", type: "subscription_past_due", payload: GOOD_PAYLOADS.subscription_past_due });
    const b = buildNotification({ userId: "u_1", type: "subscription_past_due", payload: GOOD_PAYLOADS.subscription_past_due });
    expect(a.id).not.toBe(b.id);
  });
});

/* ----------------------------- DB helpers -------------------------------- */

let db: FakeDb;

// Re-seed using the real helper (createNotification) so the helper owns the row
// shape; the createdAt override emulates older rows for ordering / cursor tests.
async function seedViaHelper(userId: string, type: NotificationType, createdAt?: number) {
  const row = await createNotification(db as any, { userId, type, payload: GOOD_PAYLOADS[type] });
  if (createdAt != null) db.rows[db.rows.length - 1].createdAt = createdAt;
  return row;
}

describe("DB helpers", () => {
  beforeEach(() => {
    db = freshDb();
  });

  it("createNotification writes one row with the right shape", async () => {
    const row = await createNotification(db as any, {
      userId: "u_1",
      type: "invite_sent",
      payload: GOOD_PAYLOADS.invite_sent,
    });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ id: row.id, userId: "u_1", type: "invite_sent", readAt: null });
    expect(db.rows[0].payload).toEqual(GOOD_PAYLOADS.invite_sent);
  });

  it("listNotifications returns the user's rows, newest first", async () => {
    await seedViaHelper("u_1", "invite_sent", 100);
    await seedViaHelper("u_1", "expense_added", 300);
    await seedViaHelper("u_1", "member_removed", 200);
    await seedViaHelper("u_2", "invite_sent", 400); // must not leak into u_1

    const rows = await listNotifications(db as any, "u_1");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.createdAt)).toEqual([300, 200, 100]);
  });

  it("listNotifications honors limit + beforeCreatedAt cursor", async () => {
    for (let i = 0; i < 5; i++) await seedViaHelper("u_1", "invite_sent", 100 + i * 10); // 100..140
    const page1 = await listNotifications(db as any, "u_1", { limit: 2 });
    expect(page1).toHaveLength(2);
    expect(page1.map((r) => r.createdAt)).toEqual([140, 130]);
    const page2 = await listNotifications(db as any, "u_1", {
      limit: 2,
      beforeCreatedAt: page1[page1.length - 1].createdAt,
    });
    expect(page2.map((r) => r.createdAt)).toEqual([120, 110]);
  });

  it("unreadCount counts only the user's unread rows", async () => {
    await seedViaHelper("u_1", "invite_sent", 100);
    await seedViaHelper("u_1", "expense_added", 200);
    await seedViaHelper("u_2", "invite_sent", 300);
    expect(await unreadCount(db as any, "u_1")).toBe(2);
    expect(await unreadCount(db as any, "u_2")).toBe(1);
    expect(await unreadCount(db as any, "u_3")).toBe(0);
  });

  it("markRead sets readAt only on the owning user's row, returns null otherwise", async () => {
    const row = await seedViaHelper("u_1", "invite_sent", 100);
    expect(await markRead(db as any, row.id, "u_2")).toBeNull(); // foreign user
    expect(db.rows[0].readAt).toBeNull();
    const updated = await markRead(db as any, row.id, "u_1"); // owner
    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(row.id);
    expect(typeof db.rows[0].readAt).toBe("number");
    expect(await markRead(db as any, "does-not-exist", "u_1")).toBeNull();
  });

  it("markAllRead sets readAt on all of the user's unread rows, skips others", async () => {
    await seedViaHelper("u_1", "invite_sent", 100);
    await seedViaHelper("u_1", "expense_added", 200);
    await seedViaHelper("u_2", "invite_sent", 300);
    const n = await markAllRead(db as any, "u_1");
    expect(n).toBe(2);
    expect(db.rows.filter((r) => r.userId === "u_1").every((r) => r.readAt != null)).toBe(true);
    expect(db.rows.find((r) => r.userId === "u_2")!.readAt).toBeNull();
  });

  it("markAllRead is idempotent (second call updates zero rows)", async () => {
    await seedViaHelper("u_1", "invite_sent", 100);
    expect(await markAllRead(db as any, "u_1")).toBe(1);
    expect(await markAllRead(db as any, "u_1")).toBe(0);
  });
});

/* ------------------------------ API routes ------------------------------- */
// The HTTP router is built via the real createApp(env) with a stub env; auth is
// mocked at the top of this file. `x-test-authed: 1` → SESSION_USER (user_a).

function makeEnv(): any {
  return {
    DB: {},
    KV: {},
    MEDIA: {},
    VECTORIZE: {},
    AI: {},
    IMAGES: {},
    ASSETS: {},
    APP_URL: "https://example.test",
    BETTER_AUTH_SECRET: "test-secret",
    STRIPE_PRICE_PRO_MONTHLY: "price_test_m",
    STRIPE_PRICE_PRO_ANNUAL: "price_test_a",
  };
}

function routeSuite() {
  db = freshDb();
  (globalThis as any).__NOTIF_FAKE_DB = db;
  const app = createApp(makeEnv());
  return { app };
}

function seedForRoutes(userId: string, type: NotificationType, createdAt?: number) {
  const row = buildNotification({ userId, type, payload: GOOD_PAYLOADS[type] });
  if (createdAt != null) row.createdAt = createdAt;
  db.rows.push(row);
  return row;
}

describe("API routes — /api/notifications", () => {
  it("GET requires auth (401 without session)", async () => {
    const { app } = routeSuite();
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("GET lists the session user's notifications, newest first, scoped", async () => {
    const { app } = routeSuite();
    seedForRoutes("user_a", "invite_sent", 100);
    seedForRoutes("user_a", "expense_added", 300);
    seedForRoutes("user_b", "invite_sent", 500); // must NOT appear

    const res = await app.request("/api/notifications", { headers: { "x-test-authed": "1" } });
    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.createdAt)).toEqual([300, 100]);
  });

  it("GET honors ?limit and ?before for pagination", async () => {
    const { app } = routeSuite();
    for (let i = 0; i < 4; i++) seedForRoutes("user_a", "invite_sent", 100 + i * 10);
    const res1 = await app.request("/api/notifications?limit=2", { headers: { "x-test-authed": "1" } });
    const page1 = (await res1.json()) as any[];
    expect(page1).toHaveLength(2);
    expect(page1.map((r: any) => r.createdAt)).toEqual([130, 120]);
    const res2 = await app.request(`/api/notifications?limit=2&before=${page1[page1.length - 1].createdAt}`, {
      headers: { "x-test-authed": "1" },
    });
    const page2 = (await res2.json()) as any[];
    expect(page2.map((r: any) => r.createdAt)).toEqual([110, 100]);
  });

  it("GET /unread-count returns { count } for the session user", async () => {
    const { app } = routeSuite();
    seedForRoutes("user_a", "invite_sent", 100);
    seedForRoutes("user_a", "expense_added", 200);
    seedForRoutes("user_b", "invite_sent", 300);
    const res = await app.request("/api/notifications/unread-count", { headers: { "x-test-authed": "1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 2 });
  });

  it("POST /:id/read marks the session user's notification read", async () => {
    const { app } = routeSuite();
    const row = seedForRoutes("user_a", "invite_sent", 100);
    const res = await app.request(`/api/notifications/${row.id}/read`, {
      method: "POST",
      headers: { "x-test-authed": "1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.rows[0].readAt).not.toBeNull();
  });

  it("POST /:id/read returns 404 for someone else's notification", async () => {
    const { app } = routeSuite();
    const row = seedForRoutes("user_b", "invite_sent", 100);
    const res = await app.request(`/api/notifications/${row.id}/read`, {
      method: "POST",
      headers: { "x-test-authed": "1" }, // user_a
    });
    expect(res.status).toBe(404);
    expect(db.rows[0].readAt).toBeNull(); // untouched
  });

  it("POST /read-all marks all of the session user's notifications read", async () => {
    const { app } = routeSuite();
    seedForRoutes("user_a", "invite_sent", 100);
    seedForRoutes("user_a", "expense_added", 200);
    seedForRoutes("user_b", "invite_sent", 300);
    const res = await app.request("/api/notifications/read-all", { method: "POST", headers: { "x-test-authed": "1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.rows.filter((r) => r.userId === "user_a").every((r) => r.readAt != null)).toBe(true);
    expect(db.rows.find((r) => r.userId === "user_b")!.readAt).toBeNull();
  });

  it("POST routes require auth (401 without session)", async () => {
    const { app } = routeSuite();
    const row = seedForRoutes("user_a", "invite_sent", 100);
    const a = await app.request(`/api/notifications/${row.id}/read`, { method: "POST" });
    const b = await app.request("/api/notifications/read-all", { method: "POST" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
  });
});
