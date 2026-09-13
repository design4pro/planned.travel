/**
 * `trip_guests` is the wave-3 shared-file schema stage `01-S6b` stands on (#288).
 *
 * The table ships with no reader: the guest repository, the participant read model and the
 * guest-into-member merge are all `01-S6b` (#119) and arrive after it. That is what makes this file
 * worth writing rather than deferring — until #119 lands there is no behavioural test anywhere that
 * would notice the table losing a column, and `trip_guests_trip_name_unq` in particular is the
 * whole point of the stage: the duplicate-name refusal `01-S6b` owes its reader is enforceable
 * because the index exists, not because a repository remembers to check.
 *
 * Both halves are asserted, declaration and shipped SQL, for the reason
 * `trip-favourites-schema.test.ts:21-24` gives: the repository harness builds its DDL from
 * `schema.ts` through `drizzle-kit/api`, so `schema.ts` alone is green whether or not
 * `pnpm db:generate` was ever run, and the replay is the only thing here that asks what D1 is
 * actually running.
 */

import { describe, expect, it } from 'vitest'
import { tripGuests } from '#/server/db/schema'
import { isUniqueConstraintViolation } from '#/server/repos/context'
import {
  physicalColumns,
  physicalForeignKey,
  physicalIndexNames,
  replayMigrations,
} from './migration-files'
import {
  checkNames,
  columnNames,
  foreignKeys,
  indexColumns,
  indexNames,
} from './table-config'

/** Whose workspace, which trip, who the guest is, and the bookkeeping every domain table carries. */
const COLUMNS = [
  'id',
  'organization_id',
  'trip_id',
  'display_name',
  'colour',
  'created_by',
  'created_at',
  'updated_at',
]

/** The three rows the replay needs before a guest has a trip to sit on. */
function seedTrip(sqlite: ReturnType<typeof replayMigrations>, id: string) {
  sqlite.exec(
    `INSERT INTO trips (id, organization_id, created_by, title, slug, created_at, updated_at)` +
      ` VALUES ('${id}', 'org', 'usr', 'Lisbon', '${id}', 0, 0)`,
  )
}

describe('trip_guests', () => {
  describe('as declared', () => {
    it('carries the eight columns a guest is', () => {
      expect(columnNames(tripGuests)).toEqual(COLUMNS)
    })

    it('gives a guest no identity beyond a name it cannot be missing', () => {
      expect(tripGuests.displayName.notNull).toBe(true)
      // Nullable, matching `trip_members.colour`: a guest entered in a hurry has no colour yet.
      expect(tripGuests.colour.notNull).toBe(false)
      // `userRef()`, so nullable too: the creator is provenance, not a dependency.
      expect(tripGuests.createdBy.notNull).toBe(false)
    })

    it('declares the composite read index leading on the tenant', () => {
      // `tenantFilter()` puts `organization_id` in every WHERE clause, so it leads, as every
      // composite index in this schema does.
      expect(indexColumns(tripGuests, 'trip_guests_org_trip_idx')).toEqual([
        'organization_id',
        'trip_id',
      ])
    })

    it('declares the unique index the duplicate-name refusal rests on', () => {
      expect(indexNames(tripGuests)).toEqual([
        'trip_guests_org_trip_idx',
        'trip_guests_trip_name_unq',
      ])
      expect(indexColumns(tripGuests, 'trip_guests_trip_name_unq')).toEqual([
        'trip_id',
        'display_name',
      ])
    })

    it('loses the guest with the workspace or the trip, and keys nothing to the user table', () => {
      // Two foreign keys, not three: `created_by` is a `userRef()`, which carries no Drizzle key by
      // design (`schema.ts:147-151`), so a guest survives the account that entered it.
      expect(foreignKeys(tripGuests)).toEqual([
        'organization_id -> organization.id (cascade)',
        'trip_id -> trips.id (cascade)',
      ])
    })

    it('declares no check constraint, because it has no enum column', () => {
      expect(checkNames(tripGuests)).toEqual([])
    })
  })

  describe('as shipped', () => {
    it('puts those columns and both indexes on disk', () => {
      const sqlite = replayMigrations()
      try {
        // Sorted on both sides, as `trip-favourites-schema.test.ts` sorts: the physical order is
        // whatever the migration wrote, the declared order is whatever reads best in `schema.ts`.
        // Copied before sorting, because `COLUMNS` is shared with the declaration assertion above.
        expect(physicalColumns(sqlite, 'trip_guests').sort()).toEqual(
          [...COLUMNS].sort(),
        )
        expect(physicalIndexNames(sqlite, 'trip_guests')).toEqual(
          expect.arrayContaining([
            'trip_guests_org_trip_idx',
            'trip_guests_trip_name_unq',
          ]),
        )
      } finally {
        sqlite.close()
      }
    })

    it('cascades from the workspace and from the trip on disk too', () => {
      const sqlite = replayMigrations()
      try {
        // The declared disposition and the deployed one can differ — a column added by
        // `ALTER TABLE … ADD COLUMN` ships as `NO ACTION` whatever `schema.ts` says — so both
        // halves are pinned.
        expect(
          physicalForeignKey(sqlite, 'trip_guests', 'organization_id'),
        ).toEqual({ table: 'organization', onDelete: 'CASCADE' })
        expect(physicalForeignKey(sqlite, 'trip_guests', 'trip_id')).toEqual({
          table: 'trips',
          onDelete: 'CASCADE',
        })
        expect(
          physicalForeignKey(sqlite, 'trip_guests', 'created_by'),
        ).toBeUndefined()
      } finally {
        sqlite.close()
      }
    })

    it('refuses a second guest under a byte-identical name on the same trip', () => {
      const sqlite = replayMigrations()
      try {
        // Straight at the engine, past a repository that does not exist yet: this is the backstop
        // `01-S6b`'s duplicate-name rule is written against, answering on its own.
        sqlite.exec(
          "INSERT INTO organization (id, name, slug, created_at) VALUES ('org', 'Org', 'org', 0)",
        )
        sqlite.exec(
          'INSERT INTO user (id, name, email, email_verified, created_at, updated_at)' +
            " VALUES ('usr', 'Ada', 'ada@example.com', 0, 0, 0)",
        )
        seedTrip(sqlite, 'trp')
        const insert = (id: string, tripId: string) =>
          'INSERT INTO trip_guests' +
          ' (id, organization_id, trip_id, display_name, created_at, updated_at)' +
          ` VALUES ('${id}', 'org', '${tripId}', 'Mia', 0, 0)`

        sqlite.exec(insert('gst1', 'trp'))

        let refusal: unknown
        try {
          sqlite.exec(insert('gst2', 'trp'))
        } catch (cause) {
          refusal = cause
        }
        expect(refusal).toBeDefined()
        // Through the predicate the repositories swallow uniqueness races with, not through a
        // message match: a test that only asserts "it threw" passes on a typo in the insert.
        expect(isUniqueConstraintViolation(refusal)).toBe(true)

        // The index is per trip, not per workspace: the same person can be a guest on two trips.
        seedTrip(sqlite, 'trp2')
        expect(() => {
          sqlite.exec(insert('gst3', 'trp2'))
        }).not.toThrow()
      } finally {
        sqlite.close()
      }
    })

    it('leaves the case-insensitive half of the rule to the repository', () => {
      const sqlite = replayMigrations()
      try {
        // `display_name` carries SQLite's default BINARY collation, so the engine reads 'Anna' and
        // 'anna' as two guests. The plan's rule refuses the second one — case-insensitively, after
        // trimming — and `01-S6b` owes that in the repository (`docs/plans/01-trips-core.md:2850`).
        // Pinned rather than assumed: this is what makes it visible that the index is a backstop,
        // so nobody reads the green suite as proof the database is already casefolding.
        sqlite.exec(
          "INSERT INTO organization (id, name, slug, created_at) VALUES ('org', 'Org', 'org', 0)",
        )
        sqlite.exec(
          'INSERT INTO user (id, name, email, email_verified, created_at, updated_at)' +
            " VALUES ('usr', 'Ada', 'ada@example.com', 0, 0, 0)",
        )
        seedTrip(sqlite, 'trp')
        const insert = (id: string, displayName: string) =>
          'INSERT INTO trip_guests' +
          ' (id, organization_id, trip_id, display_name, created_at, updated_at)' +
          ` VALUES ('${id}', 'org', 'trp', '${displayName}', 0, 0)`

        sqlite.exec(insert('gst1', 'Anna'))

        expect(() => {
          sqlite.exec(insert('gst2', 'anna'))
        }).not.toThrow()
        expect(() => {
          sqlite.exec(insert('gst3', ' Anna'))
        }).not.toThrow()
      } finally {
        sqlite.close()
      }
    })
  })
})
