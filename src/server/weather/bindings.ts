/// <reference types="@cloudflare/workers-types" />

/**
 * The single binding seam of `src/server/weather/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/geo/bindings.ts` has and for the reason its header gives:
 * `cloudflare:workers` cannot be imported in the `server` Vitest project at all, so a module that
 * reaches for a binding itself cannot be driven with a fake one. Keeping the seam to one file is
 * what lets `./weather` and `./met-norway` be tested as themselves, against stores in memory and a
 * `fetch` the test wrote.
 *
 * Nothing here decides anything. It assembles ports; every rule about when a call is made, what it
 * may cost and what happens to the answer lives one module over in `./weather`, and the ceiling
 * itself comes from `src/server/billing/limits.ts` through the caller.
 */

import { env } from 'cloudflare:workers'

import { requestOutboundRuntime } from '#/server/metering/bindings'
import { createMetNorwayClient } from './met-norway'
import { createNasaPowerClient } from './nasa-power'

import type { Logger, LogFields } from '#/server/observability'
import type { WeatherRuntime } from './weather'

export interface WeatherRuntimeOptions {
  /** Whose allowance a call is spent against. The cache is not keyed on it - see `./weather`. */
  readonly organizationId: string
  /** `resolveLimits().rates.weather_lookups_per_month` for that workspace. */
  readonly ceiling: number
}

/**
 * The policy logs plain objects and does not import the Worker's logger; this is the one place
 * the two meet, so the narrowing from `unknown` to the logger's fields is written once.
 */
function policyLogger(logger: Logger): NonNullable<WeatherRuntime['logger']> {
  const fieldsOf = (fields: unknown): LogFields | undefined =>
    typeof fields === 'object' && fields !== null
      ? (fields as LogFields)
      : undefined
  return {
    warn: (message, fields) => {
      logger.warn(message, fieldsOf(fields))
    },
    info: (message, fields) => {
      logger.info(message, fieldsOf(fields))
    },
  }
}

/**
 * The weather policy's runtime, bound to this Worker.
 *
 * **One namespace, two roles, and they must not be confused**: the readings are keyed on a
 * coordinate alone and shared by every tenant, while the tallies are keyed per organization. No
 * credential is read, because the provider is keyless.
 */
export function weatherRuntime(options: WeatherRuntimeOptions): WeatherRuntime {
  const outbound = requestOutboundRuntime()
  return {
    cache: env.KV,
    counters: env.KV,
    outbound,
    logger: policyLogger(outbound.logger.child({ component: 'weather' })),
    organizationId: options.organizationId,
    ceiling: options.ceiling,
    now: () => new Date(),
    metNorway: createMetNorwayClient({ fetch }),
    nasaPower: createNasaPowerClient({ fetch }),
  }
}
