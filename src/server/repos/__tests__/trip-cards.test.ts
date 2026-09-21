/**
 * The trip-card read model — the four per-reader facts a trip tile carries beyond its row, read for
 * a whole page through one function.
 *
 * One file for the three questions that reader has to answer at once: are the figures right, does a
 * trip the reader may not read (another organization's, or a private one they are not on) get no
 * facts at all, and does every statement stay within D1's bound-parameter ceiling however long the
 * page is — the harness runs on node:sqlite, which does not enforce that ceiling, so the statements
 * are counted here instead.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPlace } from '../places'
import { readTripCardFacts } from '../trip-cards'
import { setFavourite } from '../trip-favourites'
import { createTripGuest } from '../trip-guests'
import {
  addTripMember,
  createTrip,
  MAX_BOUND_PARAMETERS,
  updateTrip,
} from '../trips'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

/** Bound parameters in one prepared statement, counted off its placeholders. */
function boundParameters(statement: string): number {
  return statement.split('?').length - 1
}

describe('trip card facts', () => {
  let harness: Harness
  let alpha: SeededTenant
  let beta: SeededTenant
  /** In alpha's organization, on none of its trips. */
  let stranger: TenantScope
  /** Private, with one place, the owner and one guest, starred by the owner. */
  let privateTripId: string
  /** Visible to the whole organization, with nothing on it but its owner. */
  let sharedTripId: string
  let foreignTripId: string

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    beta = await harness.seedTenant('beta')
    await subscribeTenant(alpha.scope, 'crew')
    stranger = alpha.scopeFor(await alpha.addUser('Alpha the second'))

    const privateTrip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      currency: 'EUR',
    })
    await createPlace(alpha.scope, {
      tripId: privateTrip.id,
      name: 'Miradouro da Senhora do Monte',
    })
    await createTripGuest(alpha.scope, {
      tripId: privateTrip.id,
      displayName: 'Anna',
    })
    await setFavourite(alpha.scope, privateTrip.id, true)
    privateTripId = privateTrip.id

    const sharedTrip = await createTrip(alpha.scope, {
      title: 'Porto for the weekend',
      currency: 'EUR',
    })
    await updateTrip(alpha.scope, sharedTrip.id, {
      visibility: 'organization',
    })
    sharedTripId = sharedTrip.id

    foreignTripId = (
      await createTrip(beta.scope, { title: 'Beta abroad', currency: 'EUR' })
    ).id
    await setFavourite(beta.scope, foreignTripId, true)
  })

  it('answers the place count, people count, role and star of each readable trip', async () => {
    const facts = await readTripCardFacts(alpha.scope, [
      privateTripId,
      sharedTripId,
    ])

    expect(facts.get(privateTripId)).toEqual({
      placeCount: 1,
      peopleCount: 2,
      role: 'owner',
      isFavourite: true,
    })
    expect(facts.get(sharedTripId)).toEqual({
      placeCount: 0,
      peopleCount: 1,
      role: 'owner',
      isFavourite: false,
    })
  })

  it('answers an empty map for no ids without a statement', async () => {
    harness.statements.length = 0

    expect(await readTripCardFacts(alpha.scope, [])).toEqual(new Map())
    expect(harness.statements).toEqual([])
  })

  describe('member isolation', () => {
    it('gives a private trip the reader is not on no entry for any fact', async () => {
      const facts = await readTripCardFacts(stranger, [
        privateTripId,
        sharedTripId,
      ])

      expect([...facts.keys()]).toEqual([sharedTripId])
      expect(facts.get(sharedTripId)).toEqual({
        placeCount: 0,
        peopleCount: 1,
        role: null,
        isFavourite: false,
      })
    })

    it('shows a collaborator their own role and their own star, not the owner’s', async () => {
      const editorId = await alpha.addUser('Alpha the editor')
      await addTripMember(alpha.scope, {
        tripId: privateTripId,
        userId: editorId,
        role: 'editor',
      })
      const editor = alpha.scopeFor(editorId)

      const facts = await readTripCardFacts(editor, [privateTripId])

      expect(facts.get(privateTripId)).toEqual({
        placeCount: 1,
        peopleCount: 3,
        role: 'editor',
        isFavourite: false,
      })
    })
  })

  describe('tenant isolation', () => {
    it('gives another organization’s trip no entry, starred or not', async () => {
      const facts = await readTripCardFacts(alpha.scope, [
        privateTripId,
        foreignTripId,
      ])

      expect([...facts.keys()]).toEqual([privateTripId])
      expect(await readTripCardFacts(alpha.scope, [foreignTripId])).toEqual(
        new Map(),
      )
    })
  })

  describe('D1’s bound-parameter ceiling', () => {
    it.each([100, 181])(
      'keeps every statement within it for a page of %i trip ids',
      async (pageSize) => {
        const page = [
          privateTripId,
          ...Array.from(
            { length: pageSize - 2 },
            (_, index) => `missing-trip-${index}`,
          ),
          sharedTripId,
        ]
        harness.statements.length = 0

        const facts = await readTripCardFacts(alpha.scope, page)

        expect([...facts.keys()].sort()).toEqual(
          [privateTripId, sharedTripId].sort(),
        )
        expect(facts.get(sharedTripId)?.peopleCount).toBe(1)
        expect(harness.statements.length).toBeGreaterThan(0)
        for (const statement of harness.statements) {
          expect(boundParameters(statement)).toBeLessThanOrEqual(
            MAX_BOUND_PARAMETERS,
          )
        }
      },
    )

    it('binds the page’s ids in every statement, so the star is not read for every starred trip', async () => {
      const unlisted = await createTrip(alpha.scope, {
        title: 'Starred but off this page',
        currency: 'EUR',
      })
      await setFavourite(alpha.scope, unlisted.id, true)
      harness.statements.length = 0

      const facts = await readTripCardFacts(alpha.scope, [sharedTripId])

      expect([...facts.keys()]).toEqual([sharedTripId])
      expect(
        harness.statements.some((statement) =>
          statement.includes('trip_favourites'),
        ),
      ).toBe(true)
      for (const statement of harness.statements) {
        expect(statement).toMatch(/ in \(\?\)/)
      }
    })
  })
})
