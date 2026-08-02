import { z } from "zod";

export const billingIntervalSchema = z.enum(["month", "year"]);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const billingPlanSchema = z.enum(["free", "pro"]);
export type BillingPlan = z.infer<typeof billingPlanSchema>;

export const billingStatusSchema = z.enum(["active", "trialing", "past_due", "canceled", "incomplete"]);
export type BillingStatus = z.infer<typeof billingStatusSchema>;

/** Stable response returned by GET /api/billing/plan. */
export const billingPlanResponseSchema = z.object({
  plan: billingPlanSchema,
  status: billingStatusSchema,
  interval: billingIntervalSchema.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.number().int().nullable(),
  stripeCustomerId: z.string().nullable(),
  tripCount: z.number().int().nonnegative(),
  tripLimit: z.number().int().positive().nullable(),
});
export type BillingPlanResponse = z.infer<typeof billingPlanResponseSchema>;

export const billingErrorSchema = z.object({
  error: z.enum(["billing_not_configured", "no_customer", "invalid_interval", "plan_required", "export_unavailable"]),
});
export type BillingError = z.infer<typeof billingErrorSchema>;

export const checkoutInputSchema = z.object({
  interval: billingIntervalSchema.default("month"),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
