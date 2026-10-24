/**
 * The planner's reverse lookup: a point on the trip's map, as an address.
 *
 * A dropped pin opens the place form with its coordinates and, when the geocoding proxy has one,
 * an address. The lookup exists only to feed that place write, so it is refused on exactly the
 * trips the write would be refused on — and it authorises **before** it spends: the subscription
 * row, the cache and the meter are reached only for a caller who may add a place here. A metered
 * call spent on a request about to be rejected is the failure the ordering prevents.
 *
 * The proxy's own refusals are a result, not an error. A missing credential, a spent allowance or
 * a blocked provider all leave the reader with the same form and an empty address field, so the
 * drop never needs to know why there is none — and an error crossing the wire would be one more
 * thing a client could render as an apology. An unauthorised trip is not a degraded lookup, so
 * that still throws.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { resolveLimitsFromRow } from '#/server/billing/limits'
import { geocodeRuntime } from '#/server/geo/bindings'
import {
  GeoProviderError,
  reverseGeocode,
  reverseQuerySchema,
} from '#/server/geo/geocode'
import { ProviderBlockedError } from '#/server/metering/errors'
import { RateCeilingError } from '#/server/metering/rate'
import {
  TRIP_WRITE_ROLES,
  assertTripRole,
  getSubscription,
  requireWritableTrip,
} from '#/server/repos'
import { appScope } from '../../../-server/context'

import type { GeocodeRuntimeOptions } from '#/server/geo/bindings'
import type { GeocodeRuntime } from '#/server/geo/geocode'
import type { TenantScope } from '#/server/repos'

const id = z.string().trim().min(1).max(64)

export const reverseLookupInputSchema = z.strictObject({
  tripId: id,
  ...reverseQuerySchema.shape,
})

export type ReverseLookupInput = z.infer<typeof reverseLookupInputSchema>

export interface ReverseLookup {
  /** The first candidate's address, trimmed; `null` when there is none or the proxy refused. */
  readonly address: string | null
}

export interface ReverseLookupPorts {
  /** The runtime the lookup is made through. */
  readonly geocoding: (options: GeocodeRuntimeOptions) => GeocodeRuntime
}

/**
 * The address at a point on a trip the caller may add places to.
 *
 * @throws {NotFoundError} for a trip the caller cannot see.
 * @throws {TripArchivedError} for an archived trip.
 * @throws {TripRoleError} for a trip the caller may only view.
 */
export async function reverseLookup(
  scope: TenantScope,
  input: ReverseLookupInput,
  ports: ReverseLookupPorts,
): Promise<ReverseLookup> {
  const trip = await requireWritableTrip(scope, input.tripId)
  await assertTripRole(scope, trip.id, TRIP_WRITE_ROLES)

  const ceiling = resolveLimitsFromRow(await getSubscription(scope)).rates
    .geocode_lookups_per_month

  try {
    const result = await reverseGeocode(
      ports.geocoding({ organizationId: scope.ctx.organizationId, ceiling }),
      { lat: input.lat, lng: input.lng, language: input.language },
    )
    const address = result.candidates.at(0)?.address?.trim() ?? ''
    return { address: address.length === 0 ? null : address }
  } catch (cause) {
    if (
      cause instanceof GeoProviderError ||
      cause instanceof RateCeilingError ||
      cause instanceof ProviderBlockedError
    ) {
      return { address: null }
    }
    throw cause
  }
}

export const reverseGeocodeFn = createServerFn({ method: 'POST' })
  .validator(reverseLookupInputSchema)
  .handler(async ({ data }): Promise<ReverseLookup> =>
    reverseLookup(await appScope(), data, { geocoding: geocodeRuntime }),
  )
