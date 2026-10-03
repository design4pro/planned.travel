/// <reference types="@cloudflare/workers-types" />

/**
 * The single binding seam of `src/server/transit/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/ai/bindings.ts` and `src/server/metering/bindings.ts` have and
 * for the same reason their headers give: `cloudflare:workers` cannot be imported in the `server`
 * Vitest project at all, so a module that reaches for a binding itself cannot be driven with a
 * fake one. Keeping the seam to one file is what lets `./search` and `./here` be tested as
 * themselves, against a store in memory and a `fetch` the test wrote.
 *
 * It is also what keeps the vendor behind the proxy. `./here` states that nothing outside this
 * directory imports it, and this is the file that makes that true: a caller asks for a runtime and
 * gets one, and the module with a vendor's name on it stays replaceable without a search through
 * the server functions.
 *
 * Nothing here decides anything. It assembles ports; every rule about when a call is made, what it
 * may cost and what happens to the answer lives one module over in `./search` and, for the tally
 * three directories now share, in `#/server/metering/rate`; the ceiling itself comes from
 * `src/server/billing/limits.ts` through the caller.
 */

import { env } from 'cloudflare:workers'

import { createHereClient } from './here'

import type { TransitSearchRuntime } from './search'

export interface TransitRuntimeOptions {
  /** Whose allowance a miss is spent against, and the first half of every cache key. */
  readonly organizationId: string
  /** The member searching: the second half of every cache key. From the server-side scope. */
  readonly memberId: string
  /** `resolveLimits().rates.transit_searches_per_month` for that workspace. */
  readonly ceiling: number
}

/**
 * The transit proxy's runtime, bound to this Worker.
 *
 * **One namespace, two roles, and they must not be confused**: the answers are keyed per member
 * within a workspace (HERE's terms forbid one Request serving more than one End User), while the
 * tallies are keyed per organization.
 *
 * **A deployment with no credential gets no client, rather than one that throws when called.**
 * `createHereClient` refuses an empty key, and a refusal raised from inside `search` is raised
 * after `./search` has already spent a unit of the workspace's allowance on it. Handing over
 * `null` instead lets `./search` refuse one line earlier, before the meter — and it still consults
 * the cache first, so a deployment whose credential was removed serves what it already holds.
 */
export function transitRuntime(
  options: TransitRuntimeOptions,
): TransitSearchRuntime {
  return {
    cache: env.KV,
    counters: env.KV,
    client: hereClient(),
    organizationId: options.organizationId,
    memberId: options.memberId,
    ceiling: options.ceiling,
    now: () => new Date(),
  }
}

/**
 * This Worker's HERE client, or `null` when it holds no key for one.
 *
 * The key is read here and nowhere else, and whether it is usable is `createHereClient`'s own
 * judgement rather than a second copy of it in this file — which is why the refusal is caught
 * rather than pre-empted by an emptiness check that would have to stay in step with it.
 */
function hereClient(): TransitSearchRuntime['client'] {
  try {
    return createHereClient({ apiKey: env.HERE_API_KEY ?? '', fetch })
  } catch {
    return null
  }
}
