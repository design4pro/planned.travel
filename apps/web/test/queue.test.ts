/**
 * Tests for the queue delivery layer (design §12.2 + §12.4):
 *  - deliverNotification: writes exactly one in-app row; does NOT call the
 *    sender when the job has no email block; does NOT call it when
 *    EMAIL_ENABLED !== "true"; sends when enabled + requested; ignores bad jobs.
 *  - enqueueNotification: uses env.JOBS.send when the binding is present (no
 *    inline delivery); falls back to direct delivery when absent; never throws.
 *
 * Harness: @planned/db is mocked so createDb returns a tiny in-memory fake that
 * records inserts (createNotification is exercised for real against it). The
 * email factory is mocked so the sender's send() is observable. renderNotificationEmail
 * and the consumer run for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared state accessible inside the hoisted mock factories.
const { fakeRows, sendMock, lastSend } = vi.hoisted(() => {
  const lastSend: { value: Record<string, unknown> | null } = { value: null };
  const sendMock = vi.fn(async (input: Record<string, unknown>) => {
    lastSend.value = input;
    return { id: "sent" };
  });
  return { fakeRows: [] as Array<Record<string, unknown>>, sendMock, lastSend };
});

vi.mock("@planned/db", () => {
  const makeFakeDb = () => ({
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        fakeRows.push({ readAt: null, ...row });
        return Promise.resolve();
      },
    }),
  });
  return { createDb: () => makeFakeDb(), notifications: { __token: "notification" } };
});

vi.mock("../src/lib/email", () => ({
  createEmailSender: vi.fn(() => ({ send: sendMock })),
}));

import type { NotificationJob } from "@planned/shared";
import { enqueueNotification } from "../src/lib/notifications";
import { deliverNotification } from "../src/server/notifications-consumer";

const JOB_NO_EMAIL: NotificationJob = {
  userId: "u_1",
  type: "invite_sent",
  payload: { tripId: "t_1", tripName: "Tokyo", inviteToken: "tok", inviterName: "Ada" },
};
const JOB_WITH_EMAIL: NotificationJob = {
  ...JOB_NO_EMAIL,
  email: { to: "a@b.co", template: "invite_sent", locale: "en" },
};

function env(over: Record<string, unknown> = {}): any {
  return { APP_URL: "https://app.example", ...over };
}

beforeEach(() => {
  fakeRows.length = 0;
  sendMock.mockClear();
  lastSend.value = null;
});

describe("deliverNotification", () => {
  it("writes exactly one in-app row", async () => {
    await deliverNotification(env(), JOB_NO_EMAIL);
    expect(fakeRows).toHaveLength(1);
    expect(fakeRows[0]).toMatchObject({ userId: "u_1", type: "invite_sent" });
  });

  it("does not send email when the job has no email block (even if enabled)", async () => {
    await deliverNotification(env({ EMAIL_ENABLED: "true", RESEND_API_KEY: "k" }), JOB_NO_EMAIL);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not send email when EMAIL_ENABLED !== 'true'", async () => {
    await deliverNotification(env({ EMAIL_ENABLED: "false" }), JOB_WITH_EMAIL);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends a rendered email when enabled AND requested", async () => {
    await deliverNotification(env({ EMAIL_ENABLED: "true", RESEND_API_KEY: "k" }), JOB_WITH_EMAIL);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(lastSend.value!.to).toBe("a@b.co");
    expect(String(lastSend.value!.subject)).toContain("Tokyo");
  });

  it("ignores a malformed job (no row, no throw)", async () => {
    await expect(deliverNotification(env(), { type: "nope" })).resolves.toBeUndefined();
    expect(fakeRows).toHaveLength(0);
  });
});

describe("enqueueNotification", () => {
  it("uses env.JOBS.send when present and does NOT deliver inline", async () => {
    let sent: unknown = null;
    const send = vi.fn(async (job: unknown) => {
      sent = job;
    });
    await enqueueNotification(env({ JOBS: { send } }), JOB_NO_EMAIL);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(JOB_NO_EMAIL);
    expect(fakeRows).toHaveLength(0); // consumer did not run inline
  });

  it("falls back to direct delivery when JOBS is absent", async () => {
    await enqueueNotification(env(), JOB_NO_EMAIL);
    expect(fakeRows).toHaveLength(1); // deliverNotification ran inline
  });

  it("never throws (wraps producer errors)", async () => {
    const send = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(enqueueNotification(env({ JOBS: { send } }), JOB_NO_EMAIL)).resolves.toBeUndefined();
  });
});
