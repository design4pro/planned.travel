/**
 * The declaration layer for the transport chain and the airport catalogue.
 *
 * `00-S7` (issue #168) is a schema-only stage: it adds one index, one tenant table and one global
 * table and no repository, validator or server function. So there is no behaviour to drive and the
 * only failures worth catching are the ones a declaration can carry, none of which any other test
 * in this repository can see:
 *
 * 1. **A column list that drifts from the plan's table.** `docs/plans/03-reservations-and-transport.md`
 *    §`03-S2` **Data and migration** fixes the columns of `transport_legs` by name and by type, and
 *    `03-S2` is written against exactly that list. A missing column typechecks everywhere until the
 *    stage that needs it, at which point the fix is a second migration rather than an edit.
 * 2. **A foreign key with the wrong disposition.** `ON DELETE cascade` and `ON DELETE set null` are
 *    the difference between deleting a day and deleting a journey, and nothing in TypeScript
 *    distinguishes them. The harness generates its DDL from this schema and `node:sqlite` enforces
 *    foreign keys, so the cases below delete real parents and read the survivors back.
 * 3. **A tenant column on a table that must not have one.** `airports` is platform content: an
 *    airport belongs to no workspace. A well-meaning `organizationId: orgRef()` added later would
 *    look exactly like every other table in the file and would be caught by nothing, because a
 *    tenant-isolation test only ever asserts the presence of the filter.
 * 4. **A unique index that refuses the rows the catalogue is made of.** Most airports in a
 *    public-domain dataset carry no IATA code. SQLite treats `NULL`s inside a `UNIQUE` index as
 *    distinct, which is what makes a plain unique index the right one here — and that is a property
 *    of the engine rather than of the declaration, so it is asserted against a real database.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  airports,
  days,
  newId,
  transportLegs,
  transports,
  trips,
} from '#/server/db/schema'
import {
  captureError,
  constraintName,
  createHarness,
} from '#/server/repos/__tests__/harness'
import {
  physicalColumns,
  physicalIndexNames,
  replayMigrations,
  shippedMigrations,
  statementsOf,
} from './migration-files'
import {
  checkNames,
  columnNames,
  foreignKeys,
  indexColumns,
  indexNames,
} from './table-config'
import type { Harness } from '#/server/repos/__tests__/harness'

describe('the transport chain and airport catalogue schema', () => {
  describe('transports', () => {
    it('indexes the arrival day behind the tenant column', () => {
      // `transports_org_arrival_day_idx` is what a tenant-scoped read of "what lands on this day"
      // needs: `tenantFilter()` puts `organization_id` in every WHERE clause, so the tenant column
      // leads, as the file's own conventions require of a composite index.
      expect(columnNames(transports)).toContain('arrival_day_id')
      expect(indexNames(transports)).toContain('transports_org_arrival_day_idx')
      expect(
        indexColumns(transports, 'transports_org_arrival_day_idx'),
      ).toEqual(['organization_id', 'arrival_day_id'])
    })
  })

  describe('transport_legs', () => {
    it('carries exactly the columns the plan filed, in order', () => {
      expect(columnNames(transportLegs)).toEqual([
        'id',
        'organization_id',
        'trip_id',
        'transport_id',
        'position',
        'from_name',
        'from_code',
        'from_lat',
        'from_lng',
        'from_timezone',
        'to_name',
        'to_code',
        'to_lat',
        'to_lng',
        'to_timezone',
        'service_number',
        'platform',
        'seat',
        'departure_day_id',
        'arrival_day_id',
        'departure_date',
        'arrival_date',
        'departure_time',
        'arrival_time',
        'sort_order',
        'created_at',
        'updated_at',
      ])
    })

    it('cascades from its parents and releases the days it names', () => {
      expect(foreignKeys(transportLegs)).toEqual([
        'arrival_day_id -> days.id (set null)',
        'departure_day_id -> days.id (set null)',
        'organization_id -> organization.id (cascade)',
        'transport_id -> transports.id (cascade)',
        'trip_id -> trips.id (cascade)',
      ])
    })

    it('indexes the tenant, the chain order and both day references', () => {
      expect(indexNames(transportLegs).sort()).toEqual([
        'transport_legs_arrival_day_idx',
        'transport_legs_departure_day_idx',
        'transport_legs_org_trip_idx',
        'transport_legs_transport_position_idx',
      ])
      expect(
        indexColumns(transportLegs, 'transport_legs_org_trip_idx'),
      ).toEqual(['organization_id', 'trip_id'])
      expect(
        indexColumns(transportLegs, 'transport_legs_transport_position_idx'),
      ).toEqual(['transport_id', 'position'])
    })

    it('constrains the chain index and both coordinate pairs', () => {
      expect(checkNames(transportLegs)).toEqual([
        'transport_legs_position_chk',
        'transport_legs_from_lat_chk',
        'transport_legs_from_lat_chk_lng',
        'transport_legs_to_lat_chk',
        'transport_legs_to_lat_chk_lng',
      ])
    })
  })

  describe('airports', () => {
    it('carries no tenant column', () => {
      // The single stated exception to the tenant-scoped repository rule: an airport belongs to no
      // workspace, so there is no `organization_id` for a filter to be forgotten on.
      expect(columnNames(airports)).not.toContain('organization_id')
      expect(foreignKeys(airports)).toEqual([])
    })

    it('carries the four facts a code resolves to, plus the pin', () => {
      expect(columnNames(airports)).toEqual([
        'id',
        'iata_code',
        'icao_code',
        'name',
        'city',
        'country_code',
        'timezone',
        'lat',
        'lng',
        'created_at',
        'updated_at',
      ])
    })

    it('holds one row per code and searches by name and city', () => {
      expect(indexNames(airports).sort()).toEqual([
        'airports_city_idx',
        'airports_iata_unq',
        'airports_icao_unq',
        'airports_name_idx',
      ])
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

    async function seedChain() {
      const tenant = await harness.seedTenant('legs')
      const tripId = newId()
      const dayId = newId()
      const transportId = newId()

      await harness.db.insert(trips).values({
        id: tripId,
        organizationId: tenant.organizationId,
        createdBy: tenant.ownerUserId,
        title: 'Tokyo',
        slug: 'tokyo',
      })
      await harness.db.insert(days).values({
        id: dayId,
        organizationId: tenant.organizationId,
        tripId,
        dayNumber: 1,
      })
      await harness.db.insert(transports).values({
        id: transportId,
        organizationId: tenant.organizationId,
        tripId,
        title: 'HND → KIX',
      })

      return {
        organizationId: tenant.organizationId,
        tripId,
        dayId,
        transportId,
      }
    }

    it('deletes a chain with the transport it hangs off', async () => {
      const { organizationId, tripId, transportId } = await seedChain()
      await harness.db.insert(transportLegs).values({
        organizationId,
        tripId,
        transportId,
        fromName: 'Haneda',
        toName: 'Kansai',
      })

      await harness.db.delete(transports).where(eq(transports.id, transportId))

      expect(await harness.db.select().from(transportLegs)).toEqual([])
    })

    it('releases a leg from a day that is deleted rather than deleting the leg', async () => {
      // The opposite disposition to the cascade above, and the reason the two are asserted
      // together: `transport_legs` is created by `CREATE TABLE`, so unlike
      // `transports.arrival_day_id` — added by an `ALTER` that carries no `ON DELETE` clause — the
      // deployed constraint is the declared one.
      const { organizationId, tripId, dayId, transportId } = await seedChain()
      await harness.db.insert(transportLegs).values({
        organizationId,
        tripId,
        transportId,
        departureDayId: dayId,
        arrivalDayId: dayId,
        fromName: 'Haneda',
        toName: 'Kansai',
      })

      await harness.db.delete(days).where(eq(days.id, dayId))

      const rows = await harness.db.select().from(transportLegs)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.departureDayId).toBeNull()
      expect(rows[0]?.arrivalDayId).toBeNull()
    })

    it('refuses a negative position in the chain', async () => {
      const { organizationId, tripId, transportId } = await seedChain()

      const error = await captureError(() =>
        harness.db.insert(transportLegs).values({
          organizationId,
          tripId,
          transportId,
          position: -1,
          fromName: 'Haneda',
          toName: 'Kansai',
        }),
      )

      expect(constraintName(error)).toMatch(/transport_legs_position_chk/)
    })

    it('accepts every airport without an IATA code and refuses a repeated one', async () => {
      await harness.db.insert(airports).values([
        { name: 'Bagdogra', icaoCode: 'VEBD' },
        { name: 'Kangra', icaoCode: 'VIGG' },
      ])

      // Two rows, both with a null `iata_code`, under a unique index on it.
      expect(await harness.db.select().from(airports)).toHaveLength(2)

      await harness.db
        .insert(airports)
        .values({ name: 'Haneda', iataCode: 'HND' })
      const error = await captureError(() =>
        harness.db
          .insert(airports)
          .values({ name: 'Not Haneda', iataCode: 'HND' }),
      )

      expect(constraintName(error)).toMatch(/airports\.iata_code/)
    })
  })

  describe('the shipped migrations', () => {
    // The one thing the harness above cannot see: it builds its DDL from `schema.ts` through
    // `drizzle-kit/api`, so every table and column added to that file appears there whether or not
    // `pnpm db:generate` was ever run — a whole green suite over a schema D1 has never been told
    // about. `replayMigrations()` applies `drizzle/*.sql` in journal order instead, and the cases
    // below ask that database what it ended up with.

    it('put both new tables and the arrival-day index on disk', () => {
      const sqlite = replayMigrations()
      try {
        const objects = sqlite
          .prepare('SELECT name, type FROM sqlite_master WHERE name = ?')
          .all('transport_legs')
        expect(objects.map((row) => String(row.type))).toContain('table')

        expect(physicalColumns(sqlite, 'transport_legs')).toEqual(
          columnNames(transportLegs),
        )
        expect(physicalColumns(sqlite, 'airports')).toEqual(
          columnNames(airports),
        )
        expect(physicalIndexNames(sqlite, 'transports')).toContain(
          'transports_org_arrival_day_idx',
        )
      } finally {
        sqlite.close()
      }
    })

    it('adds both tables in one migration and rebuilds nothing that exists', () => {
      // The whole compatibility answer for this stage: two `CREATE TABLE`s and one `CREATE INDEX`,
      // in a single journal entry. A `__new_*` copy-and-swap is what drizzle-kit answers a changed
      // constraint with, and on D1 it runs without the `PRAGMA foreign_keys=OFF` it emits.
      // Located by what it creates rather than by its ordinal, so a later schema stage's own
      // migration does not redden this.
      const creators = shippedMigrations().filter((migration) =>
        /CREATE TABLE `?transport_legs`?/i.test(migration.sql),
      )

      expect(creators).toHaveLength(1)
      const [migration] = creators
      expect(migration.sql).toMatch(/CREATE TABLE `?airports`?/i)
      expect(migration.sql).not.toMatch(/__new_/)
      expect(migration.sql).not.toMatch(/\bDROP\b/i)
      expect(
        statementsOf(migration.sql).filter((statement) =>
          /^ALTER TABLE/i.test(statement),
        ),
      ).toEqual([])
    })
  })
})
