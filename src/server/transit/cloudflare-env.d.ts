/// <reference types="@cloudflare/workers-types" />

/**
 * The one secret the transit proxy reads.
 *
 * A `wrangler secret`, not a binding: `wrangler.jsonc` is a shared path this stage does not touch,
 * and a provider credential is not configuration anyway — a public config file should not be able
 * to point a metered, billed call at a different account. It is also never a value a **tenant**
 * supplies: one deployment serves every workspace, so a per-tenant third-party credential is a
 * cross-tenant leak rather than a feature, which is the same argument that keeps confirmation
 * extraction on our own binding (ADR 0012).
 *
 * Declared here rather than in `worker-configuration.d.ts` for the reason
 * `../auth/cloudflare-env.d.ts` gives: that file is generated and authoritative for bindings and
 * `vars`, and re-declaring one of its members would *override* rather than extend it. A secret is
 * not one of its members, so adding one is the safe half of that rule — the shape every sibling
 * augmentation in this repository already uses.
 *
 * **Optional, unlike the `AI` binding beside it.** A deployment with no key is a deployment where
 * connection search is off, and that is a state the product renders rather than crashes on:
 * `createHereClient` refuses with `unconfigured` and the dialog says so in its own words. Typing it
 * as guaranteed would be a promise `wrangler.jsonc` does not make.
 */
declare namespace Cloudflare {
  interface Env {
    /** HERE Transit API key — `wrangler secret put HERE_API_KEY`. */
    HERE_API_KEY?: string
  }
}
