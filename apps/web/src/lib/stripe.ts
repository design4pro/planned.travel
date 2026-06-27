import Stripe from "stripe";
import type { CloudflareEnv } from "./env";

/**
 * Per-request Stripe client for Cloudflare Workers.
 *
 * - Uses the fetch-based HTTP client (`Stripe.createFetchHttpClient()`) so it
 *   never touches Node's `http`/`https` modules (unavailable on the edge).
 * - Reads `STRIPE_SECRET_KEY` from env — never hardcode a key.
 * - Uses the SDK's pinned API version (no explicit `apiVersion` to avoid
 *   version-skew type errors); Stripe accepts requests at the account version.
 *
 * Instantiate inside a handler (`createStripe(env)`), mirroring `createAuth`
 * and `db` — bindings are runtime-only.
 */
export function createStripe(env: CloudflareEnv) {
  return new Stripe(env.STRIPE_SECRET_KEY!, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
}

export type StripeClient = ReturnType<typeof createStripe>;
