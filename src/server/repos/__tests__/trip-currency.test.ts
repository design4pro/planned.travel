/**
 * A trip's budget currency, changed through `updateTrip`.
 *
 * The rule: a different currency is applied only to a trip with nothing priced in it, in the same
 * single statement as the rest of the save, and refused - whole save included - on any trip that has
 * a price. Relabelling a priced trip would leave every figure with its number and a new code, so the
 * refusal is the point, and the tests are about every way the refusal could be missed: each kind of
 * price, a price that arrives between the read and the write, a sibling trip's prices, a stale tab.
 *
 * Runs on the real harness: the `NOT NULL` failure the stale-read case depends on is raised by the
 * database, not by a mock.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { days, trips } from '#/server/db/schema'
import { RepositoryError } from '../context'
import {
  CurrencyRefusalError,
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  requireTrip,
  tripsRepository,
  updateTrip,
  updateTripInput,
} from '../trips'
import { PRICED_KINDS } from './priced-rows'
import {
  captureError,
  constraintName,
  createHarness,
  subscribeTenant,
} from './harness'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

const LOCKED = 'shell.editTrip.currencyLocked'

/**
 * A scope whose database runs `beforeWrite` immediately before every `UPDATE` of `trips` - the
 * moment between the repository's read of the trip and its write, which is where a price can arrive
 * from another tab.
 */
function scopeWithRaceBeforeTripUpdate(
  scope: TenantScope,
  beforeWrite: () => void,
): TenantScope {
  const db: Database = new Proxy(scope.db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target)
      if (typeof value !== 'function') {
        return value
      }
      if (property === 'update') {
        return (table: unknown) => {
          if (table === trips) {
            beforeWrite()
          }
          return value.call(target, table)
        }
      }
      return value.bind(target)
    },
  })
  return { db, ctx: scope.ctx }
}

describe('changing a trip’s budget currency', () => {
  let harness: Harness
  let tenant: SeededTenant
  let colleagueId: string
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('currency')
    await subscribeTenant(tenant.scope, 'crew')
    colleagueId = await tenant.addUser('Colleague')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    tripId = trip.id
  })

  describe('on a trip with something priced in it', () => {
    it.each(PRICED_KINDS.map((kind) => [kind.name, kind] as const))(
      'refuses the whole save when the trip holds %s',
      async (_name, kind) => {
        await kind.seed(tenant.scope, tripId, colleagueId)
        const before = await requireTrip(tenant.scope, tripId)

        const refusal = await captureError(() =>
          updateTrip(tenant.scope, tripId, {
            title: 'Renamed in the same save',
            currency: 'JPY',
          }),
        )

        expect(refusal).toBeInstanceOf(CurrencyRefusalError)
        expect(refusal.message).toBe(LOCKED)
        expect(await requireTrip(tenant.scope, tripId)).toEqual(before)
      },
    )

    it('is refused with a message key, not a sentence, and never as another class of error', async () => {
      await PRICED_KINDS[0].seed(tenant.scope, tripId, colleagueId)

      const refusal = await captureError(() =>
        updateTrip(tenant.scope, tripId, { currency: 'USD' }),
      )

      expect(refusal).toBeInstanceOf(RepositoryError)
      expect(refusal.name).toBe('CurrencyRefusalError')
      expect(refusal.message).toBe(LOCKED)
    })

    it('does not move the day run when the refused save also moved the dates', async () => {
      await PRICED_KINDS[0].seed(tenant.scope, tripId, colleagueId)
      const runBefore = await harness.db
        .select()
        .from(days)
        .where(eq(days.tripId, tripId))

      await captureError(() =>
        updateTrip(tenant.scope, tripId, {
          currency: 'JPY',
          startDate: '2026-04-09',
          endDate: '2026-04-20',
        }),
      )

      expect(
        await harness.db.select().from(days).where(eq(days.tripId, tripId)),
      ).toEqual(runBefore)
    })

    it('saves the other fields when the currency is the one already stored', async () => {
      await PRICED_KINDS[0].seed(tenant.scope, tripId, colleagueId)

      const saved = await updateTrip(tenant.scope, tripId, {
        title: 'Lisbon, renamed',
        currency: 'EUR',
      })

      expect(saved.title).toBe('Lisbon, renamed')
      expect(saved.currency).toBe('EUR')
    })
  })

  describe('on a trip with nothing priced in it', () => {
    it('applies the new currency together with the other fields in one save', async () => {
      const saved = await updateTrip(tenant.scope, tripId, {
        title: 'Tokyo instead',
        currency: 'JPY',
      })

      expect(saved.currency).toBe('JPY')
      expect(saved.title).toBe('Tokyo instead')
      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    })

    it('accepts a budget target and a new currency in the same save', async () => {
      const saved = await updateTrip(tenant.scope, tripId, {
        currency: 'JPY',
        budgetTargetMinor: 300_000,
      })

      expect(saved.currency).toBe('JPY')
      expect(saved.budgetTargetMinor).toBe(300_000)
    })

    it('writes the currency in one statement that carries the whole priced-rows test', async () => {
      harness.statements.length = 0

      await updateTrip(tenant.scope, tripId, { currency: 'JPY' })

      const writes = harness.statements.filter((sql) =>
        /^update "trips"/i.test(sql),
      )
      expect(writes).toHaveLength(1)
      // Every subquery of the test names the tenant and the trip, so a sibling trip's prices, or
      // another workspace's, cannot reach it.
      for (const table of [
        'expenses',
        'expense_shares',
        'settlements',
        'budget_items',
        'places',
        'reservations',
        'transports',
        'day_accommodations',
      ]) {
        expect(writes[0]).toContain(`"${table}"."organization_id" = ?`)
        expect(writes[0]).toContain(`"${table}"."trip_id" = ?`)
      }
      expect(writes[0]).toMatch(/\bupdate "trips" set .*"currency" = case/is)
      expect(writes[0]).not.toMatch(/or replace/i)
    })

    it('keeps the input schema accepting the field, for a tab on the previous bundle', () => {
      expect(
        updateTripInput.safeParse({ title: 'Lisbon', currency: 'EUR' }).success,
      ).toBe(true)
    })
  })

  describe('a price that arrives between the read and the write', () => {
    it('fails the statement with nothing applied and the day run untouched', async () => {
      const runBefore = await harness.db
        .select()
        .from(days)
        .where(eq(days.tripId, tripId))
      const before = await requireTrip(tenant.scope, tripId)
      const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
        harness.sqlite.exec(
          `INSERT INTO budget_items (id, organization_id, trip_id, name, planned_amount_minor, currency, created_at, updated_at)
           VALUES ('raced-item', '${tenant.organizationId}', '${tripId}', 'Late', 100, 'EUR', 0, 0)`,
        )
      })

      const failure = await captureError(() =>
        updateTrip(racing, tripId, {
          title: 'Moved while a price arrived',
          currency: 'JPY',
          startDate: '2026-04-09',
          endDate: '2026-04-20',
        }),
      )

      // The database refused the statement (`NOT NULL constraint failed: trips.currency`) and the
      // repository named that refusal; a failure it did not recognise would arrive as itself.
      expect(failure).toBeInstanceOf(CurrencyRefusalError)
      expect(await requireTrip(tenant.scope, tripId)).toEqual(before)
      expect(
        await harness.db.select().from(days).where(eq(days.tripId, tripId)),
      ).toEqual(runBefore)
    })

    it('answers the traveller with the refusal key, not with the database’s sentence', async () => {
      const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
        harness.sqlite.exec(
          `UPDATE trips SET budget_target_minor = 0 WHERE id = '${tripId}'`,
        )
      })

      const refusal = await captureError(() =>
        updateTrip(racing, tripId, { currency: 'JPY' }),
      )

      expect(refusal).toBeInstanceOf(CurrencyRefusalError)
      expect(refusal.message).toBe(LOCKED)
    })

    it('rethrows any other database failure untouched', async () => {
      const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
        harness.sqlite.exec(
          `CREATE TRIGGER refuse_trip_write BEFORE UPDATE ON trips BEGIN SELECT RAISE(ABORT, 'some other failure'); END`,
        )
      })

      const failure = await captureError(() =>
        updateTrip(racing, tripId, { currency: 'JPY' }),
      )

      expect(failure).not.toBeInstanceOf(CurrencyRefusalError)
      expect(constraintName(failure)).toContain('some other failure')
    })
  })

  describe('a tab that sends the currency on every save', () => {
    it('does not put back a currency that changed between the read and the write', async () => {
      // The save sends EUR, the value the trip had when it was read; the stored value moves on before the write.
      const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
        harness.sqlite.exec(
          `UPDATE trips SET currency = 'USD' WHERE id = '${tripId}'`,
        )
      })

      await updateTrip(racing, tripId, { title: 'Renamed', currency: 'EUR' })

      const stored = await requireTrip(tenant.scope, tripId)
      expect(stored.title).toBe('Renamed')
      expect(stored.currency).toBe('USD')
    })

    it('still lets an unchanged currency through on a priced trip', async () => {
      await PRICED_KINDS[3].seed(tenant.scope, tripId, colleagueId)

      await expect(
        updateTrip(tenant.scope, tripId, { currency: 'EUR' }),
      ).resolves.toMatchObject({ currency: 'EUR' })
    })
  })

  describe('an archived trip', () => {
    beforeEach(async () => {
      await archiveTrip(tenant.scope, tripId)
    })

    it('refuses a currency change as archived, even though nothing is priced', async () => {
      const failure = await captureError(() =>
        updateTrip(tenant.scope, tripId, { title: 'Nope', currency: 'JPY' }),
      )

      expect(failure).toBeInstanceOf(TripArchivedError)
      const stored = await requireTrip(tenant.scope, tripId)
      expect(stored.currency).toBe('EUR')
      expect(stored.title).toBe('Lisbon in spring')
    })

    // Inverted on purpose (#1040): an archived trip used to save every field but the currency.
    it('refuses its other fields too, and keeps the title', async () => {
      const failure = await captureError(() =>
        updateTrip(tenant.scope, tripId, {
          title: 'Not editable',
          currency: 'EUR',
        }),
      )

      expect(failure).toBeInstanceOf(TripArchivedError)
      expect((await requireTrip(tenant.scope, tripId)).title).toBe(
        'Lisbon in spring',
      )
    })
  })

  describe('who may change it', () => {
    it('refuses an editor and a viewer before anything is read about prices', async () => {
      const editorId = colleagueId
      const viewerId = await tenant.addUser('Viewer')
      await addTripMember(tenant.scope, {
        tripId,
        userId: editorId,
        role: 'editor',
      })
      await addTripMember(tenant.scope, {
        tripId,
        userId: viewerId,
        role: 'viewer',
      })

      for (const userId of [editorId, viewerId]) {
        const refusal = await captureError(() =>
          updateTrip(tenant.scopeFor(userId), tripId, { currency: 'JPY' }),
        )
        expect(refusal).toBeInstanceOf(TripRoleError)
      }
      expect(
        (await tripsRepository.requireById(tenant.scope, tripId)).currency,
      ).toBe('EUR')
    })
  })
})
