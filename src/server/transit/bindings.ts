/// <reference types="@cloudflare/workers-types" />

/**
 * The single binding seam of `src/server/transit/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/ai/bindings.ts` and `src/server/metering/bindings.ts` have and
 * for the same reason their headers give: `cloudflare:workers` cannot be imported in the `server`
 * Vitest project at all, so a module that reaches for a binding itself cannot be driven with a
 * fake one. Keeping the seam to one file is what lets `./search`, `./meter` and `./here` be tested
 * as themselves, against a store in memory and a `fetch` the test wrote.
 *
 * It is also what keeps the vendor behind the proxy. `./here` states that nothing outside this
 * directory imports it, and this is the file that makes that true: a caller asks for a runtime and
 * gets one, and the module with a vendor's name on it stays replaceable without a search through
 * the server functions.
 *
 * Nothing here decides anything. It assembles ports; every rule about when a call is made, what it
 * may cost and what happens to the answer lives one module over in `./search` and `./meter`, and
 * the ceiling itself comes from `src/server/billing/limits.ts` through the caller.
 */

import { env } from 'cloudflare:workers'

import { createHereClient } from './here'

import type { TransitSearchRuntime } from './search'

export interface TransitRuntimeOptions {
  /** Whose allowance a miss is spent against. The cache is not keyed on it — see `./search`. */
  readonly organizationId: string
  /** `resolveLimits().rates.transit_searches_per_month` for that workspace. */
  readonly ceiling: number
}

/**
 * The transit proxy's runtime, bound to this Worker.
 *
 * **One namespace, two roles, and they must not be confused**: the answers are keyed on the query
 * alone and shared by every tenant, while the tallies are keyed per organization.
 *
 * **The provider client is built when a call is actually made**, not when this runtime is
 * assembled: `createHereClient` refuses an empty key, so building it eagerly would refuse the whole
 * search before the cache was consulted — and a deployment whose credential was removed must still
 * serve what it already holds.
 */
export function transitRuntime(
  options: TransitRuntimeOptions,
): TransitSearchRuntime {
  return {
    cache: env.KV,
    counters: env.KV,
    client: {
      search: (query) =>
        createHereClient({ apiKey: env.HERE_API_KEY ?? '', fetch }).search(
          query,
        ),
    },
    organizationId: options.organizationId,
    ceiling: options.ceiling,
    now: () => new Date(),
  }
}
