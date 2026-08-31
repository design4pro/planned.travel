/**
 * The declaration layer for the one column `00-S9` (issue #177) files.
 *
 * The wave-5 schema stage of `docs/plans/00-foundations.md` adds `reservation_id` to
 * `day_accommodations` for `03-S8`, which lands a wave later and writes it. Nothing reads or writes
 * it yet, so there is no behaviour to drive and the only failures worth catching are the ones a
 * declaration carries — the same three `reservation-schema.test.ts` catches for `00-S8`, plus one
 * that is specific to this link:
 *
 * 1. **A column that is declared but never migrated.** The repository harness generates its DDL
 *    from `schema.ts` through `drizzle-kit/api`, so a column added to that file is green everywhere
 *    the moment it is typed, whether or not `pnpm db:generate` was ever run. The replay below is
 *    the only thing in this repository that asks D1's own copy.
 * 2. **A missing index behind a read that has to scan.** Every other foreign key on this table is
 *    indexed (`start_day_id`, `end_day_id`, `place_id`), and this one is what answers "which stay
 *    did this booking create". `03-S8` owns no claim on `schema.ts`, so if the index is not here it
 *    is nowhere.
 * 3. **A disposition that is declared and not deployed.** `reservation_id` arrives by
 *    `ALTER TABLE … ADD COLUMN`, and the `ADD COLUMN` drizzle-kit writes carries the `REFERENCES`
 *    clause and no `ON DELETE` one — the generator's limit, not the engine's, measured in
 *    `reservation-schema.test.ts` for `expense_id` before it. Both halves are pinned below, because
 *    here the gap does more than mis-dispose: `NO ACTION` makes deleting a linked booking *fail*
 *    rather than release the stay, and the stage that first deletes one has to null the column
 *    itself.
 * 4. **A cascade nobody asked for.** This is the one rule the ticket states twice: deleting the
 *    booking must not delete the nights. A stay is a record of where somebody slept and outlives
 *    the confirmation that reserved it, so the declared disposition is `set null` and a case below
 *    deletes a booking and counts the stay that is left.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  dayAccommodations,
  days,
  newId,
  reservations,
  trips,
} from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  physicalColumns,
  physicalForeignKey,
  physicalIndexNames,
  replayMigrations,
  shippedMigrations,
  statementsOf,
} from './migration-files'
import {
  column,
  columnNames,
  foreignKeys,
  indexColumns,
  indexNames,
} from './table-config'
import type { Harness } from '#/server/repos/__tests__/harness'

describe("the stay's reservation link", () => {
  describe('day_accommodations', () => {
    it('carries the booking the stay was made under', () => {
      expect(columnNames(dayAccommodations)).toContain('reservation_id')
    })

    it('makes it nullable, because a stay may be typed with no booking behind it', () => {
      // Every row on disk today has none, and a stay entered by hand never will.
      expect(column(dayAccommodations, 'reservation_id').notNull).toBe(false)
      expect(column(dayAccommodations, 'reservation_id').hasDefault).toBe(false)
    })

    it('releases the stay when the booking is deleted, and never takes it along', () => {
      expect(foreignKeys(dayAccommodations)).toEqual([
        'end_day_id -> days.id (cascade)',
        'organization_id -> organization.id (cascade)',
        'place_id -> places.id (set null)',
        'reservation_id -> reservations.id (set null)',
        'start_day_id -> days.id (cascade)',
        'trip_id -> trips.id (cascade)',
      ])
    })

    it('indexes the link, as every other reference on this table is indexed', () => {
      expect(indexNames(dayAccommodations)).toContain(
        'day_accommodations_reservation_idx',
      )
      expect(
        indexColumns(dayAccommodations, 'day_accommodations_reservation_idx'),
      ).toEqual(['reservation_id'])
    })
  })

  describe('against a real database', () => {
    let harness: Harness

    beforeEach(async () => {
      harness = await createHarness()
    })

    afterEach(() => {
      harness.close()
    })

    /** One tenant, one trip and the two days a stay is anchored between. */
    async function seedStayable(label: string) {
      const tenant = await harness.seedTenant(label)
      const tripId = newId()
      await harness.db.insert(trips).values({
        id: tripId,
        organizationId: tenant.organizationId,
        createdBy: tenant.ownerUserId,
        title: 'Kyoto',
        slug: `kyoto-${label}`,
      })
      const startDayId = newId()
      const endDayId = newId()
      await harness.db.insert(days).values([
        {
          id: startDayId,
          organizationId: tenant.organizationId,
          tripId,
          dayNumber: 1,
        },
        {
          id: endDayId,
          organizationId: tenant.organizationId,
          tripId,
          dayNumber: 2,
        },
      ])
      return { tenant, tripId, startDayId, endDayId }
    }

    it('keeps the nights when the booking that reserved them is deleted', async () => {
      const { tenant, tripId, startDayId, endDayId } =
        await seedStayable('link')
      const reservationId = newId()

      await harness.db.insert(reservations).values({
        id: reservationId,
        organizationId: tenant.organizationId,
        tripId,
        title: 'Ryokan',
      })
      await harness.db.insert(dayAccommodations).values({
        organizationId: tenant.organizationId,
        tripId,
        startDayId,
        endDayId,
        name: 'Ryokan',
        reservationId,
      })

      await harness.db
        .delete(reservations)
        .where(eq(reservations.id, reservationId))

      const rows = await harness.db.select().from(dayAccommodations)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.reservationId).toBeNull()
    })

    it('reads a stay nobody booked as a stay with no booking', async () => {
      const { tenant, tripId, startDayId, endDayId } =
        await seedStayable('unlinked')
      await harness.db.insert(dayAccommodations).values({
        organizationId: tenant.organizationId,
        tripId,
        startDayId,
        endDayId,
        name: 'A friend’s spare room',
      })

      const [row] = await harness.db.select().from(dayAccommodations)
      expect(row.reservationId).toBeNull()
    })
  })

  describe('the shipped migrations', () => {
    it('puts the column and its index on disk', () => {
      const sqlite = replayMigrations()
      try {
        // Sorted on both sides: `ADD COLUMN` appends to the physical table while `schema.ts`
        // declares each column where it reads best, so the two orders cannot agree and only the
        // set is meaningful. What must hold is that D1 has every column the module declares.
        expect(physicalColumns(sqlite, 'day_accommodations').sort()).toEqual(
          columnNames(dayAccommodations).sort(),
        )
        expect(physicalIndexNames(sqlite, 'day_accommodations')).toContain(
          'day_accommodations_reservation_idx',
        )
      } finally {
        sqlite.close()
      }
    })

    it('deploys the link with no ON DELETE clause, and says what that costs', () => {
      // The declared `set null` above is what a database built from `schema.ts` enforces. This is
      // what D1 enforces, and they differ: drizzle-kit's `ADD COLUMN` emits the `REFERENCES` clause
      // without an `ON DELETE` one, so the deployed rule is `NO ACTION`. On the deployed database,
      // deleting a booking a stay points at therefore *fails* with a constraint error instead of
      // releasing the stay — the same debt `reservations.expense_id`, `transports.arrival_day_id`
      // and `expenses.cost_category_id` already carry, and the reason `03-S8a` has to null this
      // column itself before it deletes a reservation. Pinned rather than fixed: closing it means
      // either a hand-edited migration, which `drizzle/` forbids as a generated directory, or a
      // table rebuild, which this additive stage forbids.
      const sqlite = replayMigrations()
      try {
        expect(
          physicalForeignKey(sqlite, 'day_accommodations', 'reservation_id'),
        ).toEqual({ table: 'reservations', onDelete: 'NO ACTION' })
      } finally {
        sqlite.close()
      }
    })

    it('adds the column in one migration and rebuilds nothing', () => {
      const carriers = shippedMigrations().filter((migration) =>
        /ALTER TABLE `?day_accommodations`? ADD `?reservation_id`?/i.test(
          migration.sql,
        ),
      )

      expect(carriers).toHaveLength(1)
      const [migration] = carriers
      expect(migration.sql).not.toMatch(/__new_/)
      expect(migration.sql).not.toMatch(/\bDROP\b/i)
      expect(
        statementsOf(migration.sql).filter(
          (statement) => !/^(ALTER TABLE|CREATE INDEX)/i.test(statement),
        ),
      ).toEqual([])
    })
  })
})
