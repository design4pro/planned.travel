/**
 * The seeder shelves the archived demo trip last (#1026).
 *
 * An archived trip refuses the booking, stay and plan writers, so a trip created already archived
 * could not receive its own children. `applyTrip` creates it open, writes every child through the
 * ordinary guards, and archives it as its final step - no bypass in any guard.
 */

import { describe, expect, it } from 'vitest'

import { createHarness } from '#/server/repos/__tests__/harness'
import { getTripBySlug } from '#/server/repos/trips'
import { listTripReservations } from '#/server/repos/reservations'
import { marrakechTrip } from '../dataset/trips'
import { applyTrip } from '../apply-trip'

describe('applyTrip on an archived dataset trip', () => {
  it('writes the children, then leaves the trip archived', async () => {
    const harness = await createHarness()
    try {
      const tenant = await harness.seedTenant('seed-archived')
      // The dataset's owner is the workspace owner; the editor needs a user of their own, or the
      // trip would have one member written twice.
      const editorId = await tenant.addUser('Mika')

      expect(marrakechTrip.isArchived).toBe(true)
      const counts = await applyTrip(
        {
          owner: tenant.scope,
          scopes: new Map([
            ['rafal', tenant.scope],
            ['mika', tenant.scopeFor(editorId)],
          ]),
          categoryIds: new Map(),
          colours: new Map(),
        },
        marrakechTrip,
      )

      const trip = await getTripBySlug(tenant.scope, marrakechTrip.slug)
      expect(trip?.id).toBe(counts.tripId)
      expect(trip?.isArchived).toBe(true)
      expect(counts.reservations).toBeGreaterThan(0)
      const reservations = await listTripReservations(tenant.scope, {
        tripId: counts.tripId,
      })
      expect(reservations).toHaveLength(counts.reservations)
    } finally {
      harness.close()
    }
  })
})
