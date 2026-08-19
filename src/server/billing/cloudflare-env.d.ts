/// <reference types="@cloudflare/workers-types" />

/**
 * Secrets the billing layer reads from the Worker environment.
 *
 * Bindings and `vars` come from `worker-configuration.d.ts` (`wrangler types`);
 * see the note in `../auth/cloudflare-env.d.ts` for why re-declaring one here
 * would weaken it instead of adding to it.
 */
declare namespace Cloudflare {
  interface Env {
    /** `sk_…` — set with `wrangler secret put STRIPE_SECRET_KEY`. */
    STRIPE_SECRET_KEY?: string
    /** `whsec_…` — signing secret of the `/api/stripe/webhook` endpoint. */
    STRIPE_WEBHOOK_SECRET?: string
  }
}
