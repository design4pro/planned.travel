/// <reference types="@cloudflare/workers-types" />

/**
 * The single binding seam of `src/server/geo/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/transit/bindings.ts` and `src/server/metering/bindings.ts` have
 * and for the reason their headers give: `cloudflare:workers` cannot be imported in the `server`
 * Vitest project at all, so a module that reaches for a binding itself cannot be driven with a fake
 * one. Keeping the seam to one file is what lets `./geocode` and `./geoapify` be tested as
 * themselves, against stores in memory and a `fetch` the test wrote.
 *
 * It is also what keeps the vendor behind the proxy. `./geoapify` states that nothing outside this
 * directory imports it, and this is the file that makes that true.
 *
 * **This module ships with no caller, and that is deliberate rather than an oversight.** It is what
 * "one proxy, minted once" means: the first caller is the place form's own server module, and the
 * alternative is that the stage which needs it re-derives the seam — and this module's testability
 * with it. `__tests__/seam.test.ts` asserts the emptiness rather than leaving it to be noticed.
 *
 * Nothing here decides anything. It assembles ports; every rule about when a call is made, what it
 * may cost and what happens to the answer lives one module over in `./geocode`, and the ceiling
 * itself comes from `src/server/billing/limits.ts` through the caller.
 */

import { env } from 'cloudflare:workers'

import { requestOutboundRuntime } from '#/server/metering/bindings'
import { createGeoapifyClient, geoapifyVendor } from './geoapify'

import type { GeocodeRuntime } from './geocode'

export interface GeocodeRuntimeOptions {
  /** Whose allowance a miss is spent against. The cache is not keyed on it — see `./geocode`. */
  readonly organizationId: string
  /** `resolveLimits().rates.geocode_lookups_per_month` for that workspace. */
  readonly ceiling: number
}

/**
 * The geocoding proxy's runtime, bound to this Worker.
 *
 * **One namespace, two roles, and they must not be confused**: the answers are keyed on the question
 * alone and shared by every tenant, while the tallies are keyed per organization.
 *
 * **The vendor is handed over unconditionally and the client is not.** `vendor` carries the slug the
 * cache key is built from and the credits an answer must be rendered with, and neither of those
 * depends on holding a credential — so a deployment whose key was removed still serves what it
 * already cached, with its attribution intact.
 */
export function geocodeRuntime(options: GeocodeRuntimeOptions): GeocodeRuntime {
  return {
    cache: env.KV,
    counters: env.KV,
    vendor: geoapifyVendor,
    provider: geoapifyClient(),
    outbound: requestOutboundRuntime(),
    organizationId: options.organizationId,
    ceiling: options.ceiling,
    now: () => new Date(),
  }
}

/**
 * This Worker's Geoapify client, or `null` when it holds no key for one.
 *
 * The key is read here and nowhere else, and whether it is usable is `createGeoapifyClient`'s own
 * judgement rather than a second copy of it in this file — which is why the refusal is caught rather
 * than pre-empted by an emptiness check that would have to stay in step with it. Handing `null` to
 * the proxy is what lets it refuse one line *before* the meter, rather than after a workspace has
 * already been charged for a call that never left the Worker.
 */
function geoapifyClient(): GeocodeRuntime['provider'] {
  try {
    return createGeoapifyClient({ apiKey: env.GEOAPIFY_API_KEY ?? '', fetch })
  } catch {
    return null
  }
}
