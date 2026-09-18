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
 * 3. **A workspace reference on a table that must not have one.** `airports` is platform content:
 *    an airport belongs to no workspace, so it points at nothing a workspace owns. The matching
 *    rule about `organization_id` is asked of every declared table at once in
 *    `tenant-columns.test.ts`, which names this one as an exemption.
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
import { shippedMigrations, statementsOf } from './migration-files'
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

    it('indexes the departure day behind the tenant and the trip', () => {
      // The same need on the other day reference, with `trip_id` carried between the two: a read
      // of one day names its trip as well, and three equality columns beat `transports_org_trip_idx`
      // outright rather than tying with it — a tie SQLite breaks for the trip, because nothing here
      // runs `ANALYZE`, and the day's read then walks every transport of the trip.
      expect(indexNames(transports)).toContain('transports_org_trip_day_idx')
      expect(indexColumns(transports, 'transports_org_trip_day_idx')).toEqual([
        'organization_id',
        'trip_id',
        'day_id',
      ])
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
        'transport_legs_org_transport_idx',
        'transport_legs_org_trip_departure_day_idx',
        'transport_legs_org_trip_idx',
        'transport_legs_transport_position_idx',
      ])
      expect(
        indexColumns(transportLegs, 'transport_legs_org_trip_idx'),
      ).toEqual(['organization_id', 'trip_id'])
      expect(
        indexColumns(transportLegs, 'transport_legs_transport_position_idx'),
      ).toEqual(['transport_id', 'position'])
      // The tenant column leads both of these, because `tenantFilter()` puts it in the WHERE
      // clause of every statement and SQLite will not pick an index that cannot match it — which
      // is what left the bare `departure_day_id` and `transport_id` forms above unused by the
      // repository, and one day's read walking the whole trip.
      expect(
        indexColumns(
          transportLegs,
          'transport_legs_org_trip_departure_day_idx',
        ),
      ).toEqual(['organization_id', 'trip_id', 'departure_day_id'])
      expect(
        indexColumns(transportLegs, 'transport_legs_org_transport_idx'),
      ).toEqual(['organization_id', 'transport_id'])
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
    it('points at nothing, because it belongs to nothing', () => {
      // The other half of being platform content: no foreign key, so no row of any workspace can
      // take an airport with it. That it carries no `organization_id` either is asserted for every
      // table at once in `tenant-columns.test.ts`, where `airports` is one of the named exemptions.
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
        'airports_iata_prefix_idx',
        'airports_iata_unq',
        'airports_icao_prefix_idx',
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
    // That both tables and the new index reached `drizzle/*.sql` at all is asked of every table at
    // once by `migrations-match-schema.test.ts` (#184). What is left here is the one question that
    // is about this stage rather than about the schema: the shape of the migration it generated.

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
      // Narrowed to the two tables this stage creates: one journal entry carries
      // whatever else the same generation produced, and an `ALTER TABLE` adding
      // a column to some other table says nothing about these two.
      expect(
        statementsOf(migration.sql)
          .filter((statement) => /transport_legs|airports/i.test(statement))
          .filter((statement) => /^ALTER TABLE/i.test(statement)),
      ).toEqual([])
    })
  })
})
