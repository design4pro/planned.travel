import { describe, expect, it } from "vitest";
import { isActivePro, priceIntervalFromEnv } from "../src/server/billing";

describe("billing state", () => {
  it.each([
    [{ plan: "pro", status: "active" }, true],
    [{ plan: "pro", status: "trialing" }, true],
    [{ plan: "pro", status: "past_due" }, false],
    [{ plan: "free", status: "active" }, false],
    [null, false],
  ])("gates Pro features by plan and live status", (row, expected) => {
    expect(isActivePro(row as { plan: string; status: string } | null)).toBe(expected);
  });

  it("maps configured Stripe prices to their billing intervals", () => {
    expect(priceIntervalFromEnv({ STRIPE_PRICE_PRO_MONTHLY: "price_month", STRIPE_PRICE_PRO_ANNUAL: "price_year" } as any)).toEqual({
      price_month: "month",
      price_year: "year",
    });
  });
});
