/**
 * The declaration layer for the three columns `00-S8` (issue #172) files.
 *
 * The wave-2 schema stage of `docs/plans/00-foundations.md` adds two columns to `reservations` and
 * one to `user_settings` for stages that land one to two waves later — `03-S4` writes the ledger
 * link and the import marker, `03-S6` reads the masking switch. Nothing reads or writes any of them
 * yet, so there is no behaviour to drive and the only failures worth catching are the ones a
 * declaration carries:
 *
 * 1. **A column that is declared but never migrated.** The repository harness generates its DDL from
 *    `schema.ts` through `drizzle-kit/api`, so a column added to that file is green everywhere the
 *    moment it is typed, whether or not `pnpm db:generate` was ever run. The replay below is the
 *    only thing in this repository that asks D1's own copy.
 * 2. **A missing index behind a read that has to scan.** `reservations_org_imported_at_idx` is what
 *    lets the desk find the rows a machine wrote and nobody has checked; `reservations_expense_idx`
 *    is what makes the back-link resolvable from the ledger side. Neither index can be added by the
 *    stage that needs it — `03-S4` owns no claim on `schema.ts` — so if they are not here they are
 *    nowhere.
 * 3. **A disposition that is declared and not deployed.** `expense_id` arrives by
 *    `ALTER TABLE … ADD COLUMN`, and the `ADD COLUMN` drizzle-kit writes carries the `REFERENCES`
 *    clause and no `ON DELETE` one. SQLite would accept one — `ADD COLUMN … REFERENCES a(id) ON
 *    DELETE SET NULL` is legal and `pragma_foreign_key_list` reports `SET NULL` after it — so this
 *    is the generator's limit, not the engine's, and `drizzle/` is generated and never hand-edited.
 *    The declared `set null` is therefore real on a database built from `schema.ts` and *absent*
 *    from the one D1 is running, exactly as for `transports.arrival_day_id` and
 *    `expenses.cost_category_id` before it (ADR 0044). The declaration is pinned below; the
 *    deployed `NO ACTION` is registered in `migrations-match-schema.test.ts`, and the code-side
 *    unlink that keeps the rule is tested on the migrated DDL in `fns/__tests__/reservations.test.ts`.
 *    No case here asserts an engine unlink: the database this file builds is the one nobody deploys.
 * 4. **A display preference with no answer.** `mask_confirmation_codes` is `NOT NULL DEFAULT 0` in
 *    the idiom of `reduce_motion` beside it, so an existing settings row reads as "not masking"
 *    rather than as "never asked".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newId, reservations, trips, userSettings } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { shippedMigrations, statementsOf } from './migration-files'
import {
  column,
  columnNames,
  foreignKeys,
  indexColumns,
  indexNames,
} from './table-config'
import type { Harness } from '#/server/repos/__tests__/harness'

describe('the reservation ledger link, import marker and masking switch', () => {
  describe('reservations', () => {
    it('carries the ledger link and the import marker', () => {
      expect(columnNames(reservations)).toContain('expense_id')
      expect(columnNames(reservations)).toContain('imported_at')
    })

    it('makes both nullable, because every row on disk today has neither', () => {
      expect(column(reservations, 'expense_id').notNull).toBe(false)
      expect(column(reservations, 'expense_id').hasDefault).toBe(false)
      expect(column(reservations, 'imported_at').notNull).toBe(false)
      expect(column(reservations, 'imported_at').hasDefault).toBe(false)
    })

    it('records the import as an instant, at the width the schema already uses', () => {
      // An instant, not a boolean: "a machine wrote this and nobody has checked it" *and* when.
      const marker = column(reservations, 'imported_at')
      expect(marker.columnType).toBe('SQLiteTimestamp')
      expect(marker.getSQLType()).toBe('integer')
    })

    it('declares the ledger link set null, which D1 does not enforce (ADR 0044)', () => {
      expect(foreignKeys(reservations)).toEqual([
        'assignment_id -> day_assignments.id (set null)',
        'day_id -> days.id (set null)',
        'end_day_id -> days.id (set null)',
        'expense_id -> expenses.id (set null)',
        'organization_id -> organization.id (cascade)',
        'place_id -> places.id (set null)',
        'transport_id -> transports.id (set null)',
        'trip_id -> trips.id (cascade)',
      ])
    })

    it('indexes the link, and the marker behind the tenant column', () => {
      expect(indexNames(reservations)).toContain('reservations_expense_idx')
      expect(indexColumns(reservations, 'reservations_expense_idx')).toEqual([
        'expense_id',
      ])
      // `tenantFilter()` puts `organization_id` in every WHERE clause, so it leads the composite
      // one, as this file's conventions require.
      expect(indexNames(reservations)).toContain(
        'reservations_org_imported_at_idx',
      )
      expect(
        indexColumns(reservations, 'reservations_org_imported_at_idx'),
      ).toEqual(['organization_id', 'imported_at'])
    })
  })

  describe('user_settings', () => {
    it('always has an answer for whether to mask a confirmation code', () => {
      const flag = column(userSettings, 'mask_confirmation_codes')
      expect(flag.columnType).toBe('SQLiteBoolean')
      expect(flag.notNull).toBe(true)
      expect(flag.hasDefault).toBe(true)
      expect(flag.default).toBe(false)
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

    /** One tenant with one trip on it — the least a booking needs to exist. */
    async function seedTrip(label: string) {
      const tenant = await harness.seedTenant(label)
      const tripId = newId()
      await harness.db.insert(trips).values({
        id: tripId,
        organizationId: tenant.organizationId,
        createdBy: tenant.ownerUserId,
        title: 'Kyoto',
        slug: 'kyoto',
      })
      return { tenant, tripId }
    }

    it('reads a booking nobody imported as typed by a person', async () => {
      const { tenant, tripId } = await seedTrip('marker')
      await harness.db.insert(reservations).values({
        organizationId: tenant.organizationId,
        tripId,
        title: 'Hotel',
      })

      const [row] = await harness.db.select().from(reservations)
      expect(row.importedAt).toBeNull()
      expect(row.expenseId).toBeNull()
    })

    it('defaults a reader who never chose to not masking', async () => {
      const tenant = await harness.seedTenant('settings')
      await harness.db.insert(userSettings).values({
        organizationId: tenant.organizationId,
        userId: tenant.ownerUserId,
      })

      const [row] = await harness.db.select().from(userSettings)
      expect(row.maskConfirmationCodes).toBe(false)
    })
  })

  describe('the shipped migrations', () => {
    // That the three columns and both indexes reached `drizzle/*.sql`, and that `expense_id` is
    // deployed as `NO ACTION` where `schema.ts` declares `set null`, is asked of every table at once
    // in `migrations-match-schema.test.ts` — the second of those on the register of references an
    // `ADD COLUMN` was deployed without a disposition for, with what the gap costs written out there
    // (#184, ADR 0044).
    // What is left here is the one question about this stage rather than about the schema.

    it('adds all three columns in one migration and rebuilds nothing', () => {
      const carriers = shippedMigrations().filter((migration) =>
        /ADD `?expense_id`?/i.test(migration.sql),
      )

      expect(carriers).toHaveLength(1)
      const [migration] = carriers
      expect(migration.sql).toMatch(/ADD `?imported_at`?/i)
      expect(migration.sql).toMatch(/ADD `?mask_confirmation_codes`?/i)
      expect(migration.sql).not.toMatch(/__new_/)
      expect(migration.sql).not.toMatch(/\bDROP\b/i)
      // Narrowed to the two tables this stage touches: one journal entry carries
      // whatever else the same generation produced, and a `CREATE TABLE` for a
      // table that did not exist is not a rebuild of either of these.
      expect(
        statementsOf(migration.sql)
          .filter((statement) => /reservations|user_settings/i.test(statement))
          .filter(
            (statement) => !/^(ALTER TABLE|CREATE INDEX)/i.test(statement),
          ),
      ).toEqual([])
    })
  })
})
