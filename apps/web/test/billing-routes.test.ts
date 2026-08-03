import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server/app";
import type { CloudflareEnv } from "../src/lib/env";

const getSession = vi.fn(async () => ({ user: { id: "user-1", email: "user@example.com", name: "User" } }));

vi.mock("../src/lib/auth", () => ({
  createAuth: () => ({
    api: { getSession, handler: () => new Response(null, { status: 404 }) },
    handler: () => new Response(null, { status: 404 }),
  }),
}));

vi.mock("../src/lib/db", () => ({ db: () => ({}) }));
vi.mock("../src/server/trip-room", () => ({ broadcastTripChange: vi.fn() }));

const env = (overrides: Partial<CloudflareEnv> = {}): CloudflareEnv =>
  ({
    APP_URL: "https://planned.test",
    STRIPE_PRICE_PRO_MONTHLY: "price_month",
    STRIPE_PRICE_PRO_ANNUAL: "price_year",
    DB: {},
    ...overrides,
  }) as CloudflareEnv;

afterEach(() => {
  getSession.mockClear();
});

describe("billing HTTP contract", () => {
  it.each([
    ["/api/billing/checkout", "POST", { interval: "month" }],
    ["/api/billing/portal", "POST", undefined],
  ])("returns billing_not_configured for %s without Stripe", async (path, method, body) => {
    const request = new Request(`https://planned.test${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "content-type": "application/json" } : undefined,
    });

    const response = await createApp(env()).fetch(request);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "billing_not_configured" });
  });

  it("returns billing_not_configured for a webhook when Stripe cannot verify events", async () => {
    const response = await createApp(env({ STRIPE_WEBHOOK_SECRET: "whsec_test" })).fetch(
      new Request("https://planned.test/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=test" },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "billing_not_configured" });
  });
});
