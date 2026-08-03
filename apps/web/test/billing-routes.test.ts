import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server/app";
import type { CloudflareEnv } from "../src/lib/env";

const getSession = vi.fn(async () => ({ user: { id: "user-1", email: "user@example.com", name: "User" } }));
const checkoutCreate = vi.fn(async () => ({ url: "https://checkout.stripe.test/session" }));
const portalCreate = vi.fn(async () => ({ url: "https://billing.stripe.test/portal" }));
const constructEventAsync = vi.fn();

const subscription = (): {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  plan: "free" | "pro";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  interval: "month" | "year" | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
} => ({
  userId: "user-1",
  stripeCustomerId: "cus_test",
  stripeSubscriptionId: "sub_test",
  priceId: "price_month",
  plan: "pro",
  status: "active",
  interval: "month",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
});

let currentSubscription: ReturnType<typeof subscription> | null = subscription();
let claimedWebhookEvents = new Set<string>();
let selectCalls = 0;
let databaseMode: "subscription" | "trip" = "subscription";

const database = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          selectCalls += 1;
          if (databaseMode === "subscription") return currentSubscription ? [currentSubscription] : [];
          if (selectCalls <= 1) return [{ id: "trip-1", ownerId: "user-1", title: "Test trip", startAt: null, endAt: null, description: null }];
          if (selectCalls === 2) return [{ userId: "user-1", role: "owner" }];
          return currentSubscription ? [currentSubscription] : [];
        },
      }),
    }),
  }),
  insert: () => ({
    values: (value: { eventId?: string }) => ({
      onConflictDoNothing: () => ({
        returning: async () => {
          if (!value.eventId) return currentSubscription ? [currentSubscription] : [];
          if (claimedWebhookEvents.has(value.eventId)) return [];
          claimedWebhookEvents.add(value.eventId);
          return [{ eventId: value.eventId }];
        },
      }),
      returning: async () => (currentSubscription ? [currentSubscription] : []),
    }),
  }),
};

vi.mock("../src/lib/auth", () => ({
  createAuth: () => ({
    api: { getSession, handler: () => new Response(null, { status: 404 }) },
    handler: () => new Response(null, { status: 404 }),
  }),
}));

vi.mock("../src/lib/db", () => ({ db: () => database }));
vi.mock("../src/server/trip-room", () => ({ broadcastTripChange: vi.fn() }));
vi.mock("../src/lib/stripe", () => ({
  createStripe: () => ({
    checkout: { sessions: { create: checkoutCreate } },
    billingPortal: { sessions: { create: portalCreate } },
    webhooks: { constructEventAsync },
  }),
}));

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
  checkoutCreate.mockClear();
  portalCreate.mockClear();
  constructEventAsync.mockReset();
  currentSubscription = subscription();
  claimedWebhookEvents = new Set();
  selectCalls = 0;
  databaseMode = "subscription";
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

  it.each([
    ["month", "price_month"],
    ["year", "price_year"],
  ] as const)("creates a %s Checkout session with the matching price", async (interval, price) => {
    const response = await createApp(env({ STRIPE_SECRET_KEY: "sk_test" })).fetch(
      new Request("https://planned.test/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ interval }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/session" });
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer: "cus_test",
    }));
  });

  it("creates a Customer Portal session for an existing customer", async () => {
    const response = await createApp(env({ STRIPE_SECRET_KEY: "sk_test" })).fetch(
      new Request("https://planned.test/api/billing/portal", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://billing.stripe.test/portal" });
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_test",
      return_url: "https://planned.test/app/account",
    });
  });

  it("returns no_customer when the user has not completed Checkout", async () => {
    currentSubscription = { ...subscription(), stripeCustomerId: null };

    const response = await createApp(env({ STRIPE_SECRET_KEY: "sk_test" })).fetch(
      new Request("https://planned.test/api/billing/portal", { method: "POST" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "no_customer" });
    expect(portalCreate).not.toHaveBeenCalled();
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

  it("rejects a webhook with an invalid signature", async () => {
    constructEventAsync.mockRejectedValueOnce(new Error("bad signature"));

    const response = await createApp(env({ STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test" })).fetch(
      new Request("https://planned.test/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "t=1,v1=bad" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_signature" });
  });

  it("claims a Stripe event once and treats a duplicate delivery as successful", async () => {
    constructEventAsync.mockResolvedValue({ id: "evt_duplicate", type: "product.created", data: { object: {} } });
    const app = createApp(env({ STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test" }));
    const request = () => app.fetch(new Request("https://planned.test/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=valid" },
    }));

    const first = await request();
    const duplicate = await request();

    expect(await first.json()).toEqual({ received: true });
    expect(await duplicate.json()).toEqual({ received: true, duplicate: true });
    expect(claimedWebhookEvents).toEqual(new Set(["evt_duplicate"]));
  });

  it("blocks PDF export for Free users", async () => {
    databaseMode = "trip";
    currentSubscription = { ...subscription(), plan: "free", status: "active" };

    const response = await createApp(env({ BROWSER: {} as Fetcher })).fetch(
      new Request("https://planned.test/api/trips/trip-1/export.pdf"),
    );

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "plan_required", plan: "pro" });
  });

  it("returns the export_unavailable contract when Browser Rendering is absent", async () => {
    databaseMode = "trip";
    const response = await createApp(env()).fetch(
      new Request("https://planned.test/api/trips/trip-1/export.pdf"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "export_unavailable" });
  });
});
