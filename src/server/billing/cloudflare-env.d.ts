/// <reference types="@cloudflare/workers-types" />

/**
 * Secrets the billing layer reads from the Worker environment.
 *
 * Bindings and `vars` come from `worker-configuration.d.ts` (`wrangler types`);
 * see the note in `../auth/cloudflare-env.d.ts` for why re-declaring one here
 * would weaken it instead of adding to it.
 *
 * All three are secrets rather than `vars`, including `POLAR_SERVER`: which
 * Polar deployment a Worker talks to is not something a public config file
 * should be able to flip.
 */
declare namespace Cloudflare {
  interface Env {
    /** Organization Access Token — `wrangler secret put POLAR_ACCESS_TOKEN`. */
    POLAR_ACCESS_TOKEN?: string
    /** Signing secret of the `/api/polar/webhook` endpoint. */
    POLAR_WEBHOOK_SECRET?: string
    /**
     * `sandbox` or `production` — selects the API origin. Deliberately typed
     * as a plain string: it arrives from an operator, and the code that reads
     * it has to handle a typo rather than be told one is impossible.
     */
    POLAR_SERVER?: string
  }
}
