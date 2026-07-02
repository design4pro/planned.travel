/**
 * Tests for the pure notification trigger builders (notifications-triggers.ts).
 * Each builder maps an event to its NotificationJob[]; these tests assert the
 * right recipients, type, and payload — and that every produced payload parses
 * against its per-type schema (catches "trigger forgot a field" regressions).
 */
import { describe, expect, it } from "vitest";
import { notificationPayloadSchemas } from "@planned/shared";
import {
  buildExpenseAddedJobs,
  buildInviteAcceptedJobs,
  buildInviteSentJobs,
  buildMemberRemovedJobs,
  buildReservationAddedJobs,
  buildReservationConfirmedJobs,
  buildRoleChangedJobs,
  buildSubscriptionJobs,
} from "../src/server/notifications-triggers";
import type { NotificationJob } from "@planned/shared";

/** Every produced job's payload must satisfy its per-type schema. */
function expectValid(jobs: NotificationJob[]) {
  for (const j of jobs) {
    expect(notificationPayloadSchemas[j.type].safeParse(j.payload).success).toBe(true);
  }
}

describe("collaboration builders", () => {
  it("buildInviteSentJobs: one job to the added user, with email block only when email provided", () => {
    const withMail = buildInviteSentJobs({
      tripId: "t1",
      tripName: "Tokyo",
      targetUserId: "u2",
      inviterName: "Ada",
      inviteEmail: "u2@example.com",
    });
    expect(withMail).toHaveLength(1);
    expect(withMail[0]).toMatchObject({ userId: "u2", type: "invite_sent" });
    expect(withMail[0].email).toEqual({ to: "u2@example.com", template: "invite_sent", locale: "en" });
    expectValid(withMail);

    const noMail = buildInviteSentJobs({ tripId: "t1", tripName: "Tokyo", targetUserId: "u2", inviterName: null });
    expect(noMail[0].email).toBeUndefined();
    expectValid(noMail);
  });

  it("buildInviteAcceptedJobs: one job to the owner", () => {
    const jobs = buildInviteAcceptedJobs({ tripId: "t1", tripName: "Tokyo", ownerId: "owner1", accepterName: "Bob", role: "editor" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ userId: "owner1", type: "invite_accepted" });
    expectValid(jobs);
  });

  it("buildRoleChangedJobs: one job to the targeted member", () => {
    const jobs = buildRoleChangedJobs({ tripId: "t1", tripName: "Tokyo", targetUserId: "u2", newRole: "viewer", changedByName: "Ada" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ userId: "u2", type: "member_role_changed" });
    expectValid(jobs);
  });

  it("buildMemberRemovedJobs: one job to the removed member", () => {
    const jobs = buildMemberRemovedJobs({ tripId: "t1", tripName: "Tokyo", targetUserId: "u2", removedByName: "Ada" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ userId: "u2", type: "member_removed" });
    expectValid(jobs);
  });
});

describe("reservation builders", () => {
  it("buildReservationAddedJobs: fans out to every member EXCEPT the actor", () => {
    const jobs = buildReservationAddedJobs({
      tripId: "t1", tripName: "Tokyo", reservationId: "r1", type: "hotel", title: "Park Hyatt",
      addedByName: "Ada", memberUserIds: ["owner", "u2", "u3"], actorUserId: "owner",
    });
    expect(jobs.map((j) => j.userId).sort()).toEqual(["u2", "u3"]);
    expect(jobs.every((j) => j.type === "reservation_added")).toBe(true);
    expectValid(jobs);
  });

  it("buildReservationConfirmedJobs: fans out to ALL members (incl. actor)", () => {
    const jobs = buildReservationConfirmedJobs({
      tripId: "t1", tripName: "Tokyo", reservationId: "r1", type: "flight", title: "UA 878",
      memberUserIds: ["owner", "u2", "u3"],
    });
    expect(jobs.map((j) => j.userId).sort()).toEqual(["owner", "u2", "u3"]);
    expect(jobs.every((j) => j.type === "reservation_confirmed")).toBe(true);
    expectValid(jobs);
  });
});

describe("expense builder", () => {
  it("buildExpenseAddedJobs: fans out to participants EXCEPT the actor, dedupes", () => {
    const jobs = buildExpenseAddedJobs({
      tripId: "t1", tripName: "Tokyo", expenseId: "e1", amountCents: 4200, currency: "USD",
      description: "Ramen", paidByName: "Ada", participantIds: ["u2", "u2", "u3", "ada"], actorUserId: "ada",
    });
    expect(jobs.map((j) => j.userId).sort()).toEqual(["u2", "u3"]);
    expectValid(jobs);
  });
});

describe("subscription builder", () => {
  const base = { userId: "sub1", interval: "month" as const, currentPeriodEnd: 1700000000000, now: 1700000000000 };

  it("deleted → subscription_canceled", () => {
    const jobs = buildSubscriptionJobs({ ...base, prevStatus: "active", newStatus: "canceled", eventType: "customer.subscription.deleted" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("subscription_canceled");
    expectValid(jobs);
  });

  it("newStatus past_due → subscription_past_due", () => {
    const jobs = buildSubscriptionJobs({ ...base, prevStatus: "active", newStatus: "past_due", eventType: "customer.subscription.updated" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("subscription_past_due");
    expectValid(jobs);
  });

  it("newly active (from non-live) → subscription_activated", () => {
    const jobs = buildSubscriptionJobs({ ...base, prevStatus: "incomplete", newStatus: "active", eventType: "customer.subscription.updated" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("subscription_activated");
    expectValid(jobs);
  });

  it("active→active is a no-op (no notification)", () => {
    const jobs = buildSubscriptionJobs({ ...base, prevStatus: "active", newStatus: "active", eventType: "customer.subscription.updated" });
    expect(jobs).toEqual([]);
  });

  it("trialing→active stays a no-op (both already live)", () => {
    const jobs = buildSubscriptionJobs({ ...base, prevStatus: "trialing", newStatus: "active", eventType: "customer.subscription.updated" });
    expect(jobs).toEqual([]);
  });
});
