/**
 * Notification DB helpers — user-scoped reads + mutations over the existing
 * `notification` table (`packages/db/src/schema/index.ts`).
 *
 * Every helper enforces user-scoping: a user can only see / touch their own
 * rows. Mutations that miss (wrong id, wrong user) return `null` / `0` rather
 * than throwing, so callers can map to a 404 without try/catch.
 *
 * All timestamps are epoch-ms (Postgres-portable). `readAt` is null until the
 * recipient marks the row read.
 */
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { Database } from "@planned/db";
import { notifications } from "@planned/db";
import {
  buildNotification,
  type NotificationJob,
  type NotificationRow,
  type NotificationType,
} from "@planned/shared";
import type { CloudflareEnv } from "./env";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  payload: unknown;
}

/**
 * Validate the payload against the per-type schema, then insert a row.
 * Returns the inserted row (shape matches `NotificationRow`). Throws if the
 * payload is invalid — callers should validate upstream.
 */
export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const row = buildNotification(input);
  await db.insert(notifications).values({
    id: row.id,
    userId: row.userId,
    type: row.type,
    payload: row.payload,
    createdAt: row.createdAt,
  });
  return row;
}

export interface ListNotificationsOptions {
  limit?: number;
  /** Cursor: only rows with `createdAt < beforeCreatedAt` (newest-first paging). */
  beforeCreatedAt?: number;
}

/**
 * List a user's notifications, newest first. Capped at `limit` (default 50,
 * max 200) for a page; pass the oldest row's `createdAt` as `beforeCreatedAt`
 * for the next page.
 */
export async function listNotifications(
  db: Database,
  userId: string,
  opts: ListNotificationsOptions = {},
): Promise<NotificationRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const conds = [eq(notifications.userId, userId)];
  if (opts.beforeCreatedAt != null) {
    conds.push(lt(notifications.createdAt, opts.beforeCreatedAt));
  }
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
  return rows as NotificationRow[];
}

/**
 * Mark a single notification read. User-scoped: returns the updated row only if
 * `id` belongs to `userId`, else `null` (→ caller maps to 404). Idempotent:
 * re-marking an already-read row is a no-op that still returns the row.
 */
export async function markRead(
  db: Database,
  id: string,
  userId: string,
): Promise<NotificationRow | null> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return (updated as NotificationRow | undefined) ?? null;
}

/**
 * Mark all of a user's unread notifications read. Returns the number of rows
 * updated. Only touches rows where `readAt` is null (no pointless writes).
 */
export async function markAllRead(db: Database, userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: Date.now() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning();
  return updated.length;
}

/**
 * Count a user's unread notifications (`readAt` is null). Cheap: counts rows
 * rather than fetching them.
 */
export async function unreadCount(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .all();
  return rows.length;
}

/* ------------------------------ Producer --------------------------------- */
// `enqueueNotification` is what every trigger site calls. It uses the JOBS queue
// when provisioned; otherwise it runs the consumer inline (local dev / preview
// without the queue binding). Never throws — notifications are best-effort and
// must not break the caller (the primary mutation already succeeded).
//
// The dynamic import of the consumer avoids a load-time circular dependency
// (consumer.ts -> this module's createNotification); it only resolves when the
// fallback actually runs.

export async function enqueueNotification(env: CloudflareEnv, job: NotificationJob): Promise<void> {
  try {
    if (env.JOBS) {
      await env.JOBS.send(job);
      return;
    }
    // Fallback: deliver directly (in-process).
    const { deliverNotification } = await import("../server/notifications-consumer");
    await deliverNotification(env, job);
  } catch (err) {
    console.error("[notifications] enqueue failed", err);
  }
}
