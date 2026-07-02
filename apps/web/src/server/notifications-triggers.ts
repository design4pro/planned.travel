/**
 * Notification trigger routing — PURE builders that decide which notification
 * jobs to emit for a given event. No DB, no env, no I/O: hand them the resolved
 * facts (recipient ids, trip name, actor name, …) and they return the
 * `NotificationJob[]` to enqueue. This isolates the routing logic so it is
 * unit-testable without spinning up the Hono app.
 *
 * Phase 1 policy: jobs are in-app only by default (no `email` block), EXCEPT
 * `invite_sent` (direct add-by-email), where the recipient's email is in hand —
 * that one carries an `email` block so the flagship invite flow sends mail when
 * `EMAIL_ENABLED` flips on. Adding email blocks to the other triggers is a
 * documented follow-up (needs recipient-email + per-user locale resolution);
 * the consumer + templates already support it.
 */
import type { NotificationJob, NotificationType } from "@planned/shared";

function job(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
  email?: { to: string; template: NotificationType; locale: "en" | "pl" },
): NotificationJob {
  return { userId, type, payload, ...(email ? { email } : {}) };
}

export interface TripRef {
  tripId: string;
  tripName: string;
}

/* ------------------------------ Collaboration ---------------------------- */

export function buildInviteSentJobs(
  p: TripRef & { targetUserId: string; inviterName: string | null; inviteEmail?: string },
): NotificationJob[] {
  return [
    job(
      p.targetUserId,
      "invite_sent",
      { tripId: p.tripId, tripName: p.tripName, inviteToken: null, inviterName: p.inviterName },
      p.inviteEmail ? { to: p.inviteEmail, template: "invite_sent", locale: "en" } : undefined,
    ),
  ];
}

export function buildInviteAcceptedJobs(
  p: TripRef & { ownerId: string; accepterName: string | null; role: "editor" | "viewer" },
): NotificationJob[] {
  return [
    job(p.ownerId, "invite_accepted", {
      tripId: p.tripId,
      tripName: p.tripName,
      accepterName: p.accepterName,
      role: p.role,
    }),
  ];
}

export function buildRoleChangedJobs(
  p: TripRef & { targetUserId: string; newRole: "editor" | "viewer"; changedByName: string | null },
): NotificationJob[] {
  return [
    job(p.targetUserId, "member_role_changed", {
      tripId: p.tripId,
      tripName: p.tripName,
      newRole: p.newRole,
      changedByName: p.changedByName,
    }),
  ];
}

export function buildMemberRemovedJobs(
  p: TripRef & { targetUserId: string; removedByName: string | null },
): NotificationJob[] {
  return [
    job(p.targetUserId, "member_removed", {
      tripId: p.tripId,
      tripName: p.tripName,
      removedByName: p.removedByName,
    }),
  ];
}

/* ------------------------------- Reservations ---------------------------- */

export function buildReservationAddedJobs(
  p: TripRef & {
    reservationId: string;
    type: string;
    title: string | null;
    addedByName: string | null;
    memberUserIds: string[];
    actorUserId: string;
  },
): NotificationJob[] {
  return recipients(p.memberUserIds, p.actorUserId).map((userId) =>
    job(userId, "reservation_added", {
      tripId: p.tripId,
      tripName: p.tripName,
      reservationId: p.reservationId,
      type: p.type as ReservationType,
      title: p.title,
      addedByName: p.addedByName,
    }),
  );
}

export function buildReservationConfirmedJobs(
  p: TripRef & {
    reservationId: string;
    type: string;
    title: string | null;
    memberUserIds: string[];
  },
): NotificationJob[] {
  return p.memberUserIds.map((userId) =>
    job(userId, "reservation_confirmed", {
      tripId: p.tripId,
      tripName: p.tripName,
      reservationId: p.reservationId,
      type: p.type as ReservationType,
      title: p.title,
    }),
  );
}

/* --------------------------------- Costs --------------------------------- */

export function buildExpenseAddedJobs(
  p: TripRef & {
    expenseId: string;
    amountCents: number;
    currency: string;
    description: string | null;
    paidByName: string | null;
    participantIds: string[];
    actorUserId: string;
  },
): NotificationJob[] {
  return recipients(p.participantIds, p.actorUserId).map((userId) =>
    job(userId, "expense_added", {
      tripId: p.tripId,
      tripName: p.tripName,
      expenseId: p.expenseId,
      amountCents: p.amountCents,
      currency: p.currency,
      description: p.description,
      paidByName: p.paidByName,
    }),
  );
}

/* --------------------------------- Billing ------------------------------- */

export interface SubscriptionTransition {
  userId: string;
  prevStatus: string | null;
  newStatus: string;
  eventType: string;
  interval: "month" | "year" | null;
  currentPeriodEnd: number | null;
  now: number;
}

/**
 * Map a Stripe subscription transition to 0..1 notification job(s):
 *  - deleted / canceled → subscription_canceled
 *  - newStatus past_due → subscription_past_due
 *  - newly active|trialing (from a non-live status) → subscription_activated
 *  - otherwise → [] (no-op update)
 *
 * `plan` is always "pro" — these notifications describe the Pro subscription.
 */
export function buildSubscriptionJobs(p: SubscriptionTransition): NotificationJob[] {
  const live = (s: string) => s === "active" || s === "trialing";
  if (p.eventType === "customer.subscription.deleted" || p.newStatus === "canceled") {
    return [job(p.userId, "subscription_canceled", { plan: "pro", canceledAt: p.now })];
  }
  if (p.newStatus === "past_due") {
    return [job(p.userId, "subscription_past_due", { plan: "pro" })];
  }
  if (live(p.newStatus) && !live(p.prevStatus ?? "")) {
    return [
      job(p.userId, "subscription_activated", {
        plan: "pro",
        interval: p.interval,
        currentPeriodEnd: p.currentPeriodEnd,
      }),
    ];
  }
  return [];
}

/* -------------------------------- Helpers -------------------------------- */

type ReservationType = "flight" | "hotel" | "restaurant" | "rental" | "transport" | "other";

/** Recipients = the given user ids minus the actor (never notify yourself). */
function recipients(userIds: string[], actorUserId: string): string[] {
  return [...new Set(userIds)].filter((id) => id !== actorUserId);
}
