/**
 * Notifications domain — typed payloads, the notification-type enum, a
 * discriminated payload union, and a pure `buildNotification` row builder.
 *
 * Platform-agnostic (no DOM/Worker/Node imports) so the contract is shared by
 * the API handlers, queue consumer, React components, and future Expo app.
 *
 * The existing `notification` table (`packages/db/src/schema/index.ts`) is the
 * source of truth for columns: `{ id, userId, type, payload(json), readAt,
 * createdAt }`. This module types the free-form `type` + `payload` columns.
 */
import { z } from "zod";

/* --------------------------- Notification type --------------------------- */

/**
 * The 11 notification types (design §1.1). Stored as free-form text in the
 * `notification.type` column; this enum is the app-wide source of truth.
 */
export const notificationTypeSchema = z.enum([
  // collaboration
  "invite_sent",
  "invite_accepted",
  "member_role_changed",
  "member_removed",
  // reservations
  "reservation_added",
  "reservation_confirmed",
  // costs
  "expense_added",
  "expense_split_updated",
  // billing
  "subscription_activated",
  "subscription_canceled",
  "subscription_past_due",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/* --------------------------- Payload schemas ----------------------------- */
// One zod schema per type (design §1.2). Each payload is a JSON object stored
// in `notification.payload`. Every row is scoped to exactly one recipient
// (`userId`); multi-recipient fan-out happens at enqueue time.

const tripRef = {
  tripId: z.string(),
  tripName: z.string(),
};

const reservationTypeEnum = z.enum([
  "flight",
  "hotel",
  "restaurant",
  "rental",
  "transport",
  "other",
]);

export const notificationPayloadSchemas = {
  invite_sent: z.object({
    ...tripRef,
    // inviteToken is set for link-based invites; null for a direct add-by-email
    // (the recipient is already a member — the notification links to the trip).
    inviteToken: z.string().nullable(),
    inviterName: z.string().nullable(),
  }),
  invite_accepted: z.object({
    ...tripRef,
    accepterName: z.string().nullable(),
    role: z.enum(["editor", "viewer"]),
  }),
  member_role_changed: z.object({
    ...tripRef,
    newRole: z.enum(["editor", "viewer"]),
    changedByName: z.string().nullable(),
  }),
  member_removed: z.object({
    ...tripRef,
    removedByName: z.string().nullable(),
  }),
  reservation_added: z.object({
    ...tripRef,
    reservationId: z.string(),
    type: reservationTypeEnum,
    title: z.string().nullable(),
    addedByName: z.string().nullable(),
  }),
  reservation_confirmed: z.object({
    ...tripRef,
    reservationId: z.string(),
    type: reservationTypeEnum,
    title: z.string().nullable(),
  }),
  expense_added: z.object({
    ...tripRef,
    expenseId: z.string(),
    amountCents: z.number().int(),
    currency: z.string().length(3),
    description: z.string().nullable(),
    paidByName: z.string().nullable(),
  }),
  expense_split_updated: z.object({
    ...tripRef,
    expenseId: z.string(),
    amountCents: z.number().int(),
    currency: z.string().length(3),
  }),
  subscription_activated: z.object({
    plan: z.enum(["pro"]),
    interval: z.enum(["month", "year"]).nullable(),
    currentPeriodEnd: z.number().int().nullable(),
  }),
  subscription_canceled: z.object({
    plan: z.enum(["pro"]),
    canceledAt: z.number().int(),
  }),
  subscription_past_due: z.object({
    plan: z.enum(["pro"]),
  }),
} as const;

/* --------------------- Discriminated payload union ----------------------- */
// A `{ type, payload }` discriminated union the UI renders from. Built by
// zod's discriminatedUnion over one object per type.

// NOTE: `Object.entries` widens each key to the full `NotificationType` union,
// so `z.literal(type)` is statically typed as the whole union rather than a
// distinct literal per option — zod's discriminated-union option tuple then
// fails to typecheck. Runtime is correct (each entry's `type` value IS a single
// string literal, so `z.literal(type)` produces a valid distinct literal
// schema); we cast the options array to zod's expected parameter type only to
// satisfy the compiler.
const payloadEntries = Object.entries(notificationPayloadSchemas) as [
  NotificationType,
  z.ZodTypeAny,
][];

export const typedNotificationSchema = z.discriminatedUnion(
  "type",
  payloadEntries.map(([type, payload]) =>
    z.object({ type: z.literal(type), payload }),
  ) as unknown as [
    z.ZodDiscriminatedUnionOption<"type">,
    ...z.ZodDiscriminatedUnionOption<"type">[],
  ],
);
export type TypedNotification = z.infer<typeof typedNotificationSchema>;

/* ----------------------------- Job schema -------------------------------- */
// A `NotificationJob` is enqueued per recipient (design §3). The `email` block
// is optional: when absent, only the in-app row is written (no email).

export const notificationJobSchema = z.object({
  userId: z.string(), // recipient
  type: notificationTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  email: z
    .object({
      to: z.string(),
      template: notificationTypeSchema,
      locale: z.enum(["en", "pl"]),
    })
    .optional(),
});
export type NotificationJob = z.infer<typeof notificationJobSchema>;

/* --------------------------- Row schema + builder ------------------------ */
// Mirror of the `notification` table row (design §1). Postgres-portable: text
// PK + epoch-ms integer timestamps (no SQLite-only types).

export const notificationRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: notificationTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  readAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type NotificationRow = z.infer<typeof notificationRowSchema>;

/** Inputs and output for the client-facing notification center contract. */
export const notificationListInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.number().int().positive().optional(),
});
export type NotificationListInput = z.infer<typeof notificationListInputSchema>;

export const notificationPageSchema = z.object({
  items: z.array(notificationRowSchema),
  nextCursor: z.number().int().positive().nullable(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/**
 * Input to the pure `buildNotification` helper — typed payload + recipient.
 * The payload is validated against the per-type schema before insertion.
 */
export interface BuildNotificationInput {
  userId: string;
  type: NotificationType;
  payload: unknown;
}

/**
 * Build a notification row (ready for DB insert) from a typed input.
 *
 * Pure: produces `{ id, userId, type, payload, readAt: null, createdAt }` using
 * `crypto.randomUUID()` + `Date.now()`. Throws if the payload doesn't match the
 * schema for the given `type` — callers should validate upstream (the queue
 * consumer re-validates via `notificationJobSchema`). `readAt` starts null.
 */
export function buildNotification(input: BuildNotificationInput): NotificationRow {
  const payloadSchema = notificationPayloadSchemas[input.type];
  const parsed = payloadSchema.parse(input.payload);
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    type: input.type,
    payload: parsed,
    readAt: null,
    createdAt: Date.now(),
  };
}
