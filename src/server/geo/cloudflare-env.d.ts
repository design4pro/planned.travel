/// <reference types="@cloudflare/workers-types" />

/**
 * The one secret the geocoding proxy reads.
 *
 * A `wrangler secret`, not a binding, word for word the arrangement
 * `../transit/cloudflare-env.d.ts` documents and for the same reasons: `wrangler.jsonc` is a shared
 * path this stage does not touch, a public config file should not be able to point a metered, billed
 * call at a different account, and it is never a value a **tenant** supplies — one deployment serves
 * every workspace, so a per-tenant third-party credential is a cross-tenant leak rather than a
 * feature.
 *
 * Declared here rather than in `worker-configuration.d.ts` because that file is generated and
 * authoritative for bindings and `vars`, and re-declaring one of its members would *override* rather
 * than extend it. A secret is not one of its members, so adding one is the safe half of that rule.
 *
 * **Optional.** A deployment with no key is a deployment where geocoding is off, and that is a state
 * the product renders rather than crashes on: `./bindings` hands the proxy a `null` provider, cached
 * answers are still served, and a miss refuses with `unconfigured` having spent nothing.
 */
declare namespace Cloudflare {
  interface Env {
    /** Geoapify API key — `wrangler secret put GEOAPIFY_API_KEY`. */
    GEOAPIFY_API_KEY?: string
  }
}
