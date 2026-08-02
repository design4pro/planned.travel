import { describe, expect, it } from "vitest";
import {
  billingErrorSchema,
  billingPlanResponseSchema,
  checkoutInputSchema,
} from "../src";

describe("billing contracts", () => {
  it("accepts the free plan response and keeps the free quota explicit", () => {
    expect(
      billingPlanResponseSchema.parse({
        plan: "free",
        status: "active",
        interval: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        stripeCustomerId: null,
        tripCount: 3,
        tripLimit: 3,
      }),
    ).toMatchObject({ plan: "free", tripLimit: 3 });
  });

  it("rejects unknown plan states instead of widening the API contract", () => {
    expect(
      billingPlanResponseSchema.safeParse({
        plan: "enterprise",
        status: "active",
        interval: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        stripeCustomerId: null,
        tripCount: 0,
        tripLimit: 3,
      }).success,
    ).toBe(false);
  });

  it("defaults checkout to monthly and only accepts the supported intervals", () => {
    expect(checkoutInputSchema.parse({})).toEqual({ interval: "month" });
    expect(checkoutInputSchema.safeParse({ interval: "weekly" }).success).toBe(false);
  });

  it("models only the documented billing/export failures", () => {
    expect(billingErrorSchema.safeParse({ error: "no_customer" }).success).toBe(true);
    expect(billingErrorSchema.safeParse({ error: "database_down" }).success).toBe(false);
  });
});
