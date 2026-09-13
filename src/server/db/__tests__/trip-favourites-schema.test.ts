/**
 * `trip_favourites` is keyed by the pair that identifies a favourite, and by nothing else (#182).
 *
 * The table shipped in `0009` with a surrogate `id` and the real key re-imposed beside it as
 * `trip_favourites_trip_user_unq`. Two things follow from undoing that, and neither has a test
 * anywhere else:
 *
 * 1. **The key is the identity.** A second row for the same `(trip_id, user_id)` is not a second
 *    favourite, it is the same one, so the engine refuses it as a primary-key collision rather than
 *    as a unique-index one. `trip-lifecycle.test.ts` covers the behaviour that rests on that refusal
 *    — one row however many times it is set, and the double-click race — and stays the witness for
 *    it; what it cannot see is *which* constraint answered, because both answer identically. That
 *    is the seam checked below, through `isUniqueConstraintViolation` itself: the sub-code moved
 *    from `SQLITE_CONSTRAINT_UNIQUE` to `SQLITE_CONSTRAINT_PRIMARYKEY`, and `setFavourite` swallows
 *    the race only for as long as that predicate keeps recognising it.
 * 2. **The shape decides the access flavour.** `src/server/repos/base.ts` splits `KeyedTenantTable`
 *    from the keyless class at the type level, so an `id` column reappearing here would not fail a
 *    behavioural test — it would quietly put `createTenantRepository` back within reach and take
 *    `trip-favourites.ts` with it, which is the regression this file exists to catch.
 *
 * The second case runs against the replayed migrations rather than the harness, for the reason
 * `migrations-match-schema.test.ts` states in full: the harness builds its DDL from `schema.ts`, so
 * it is green whether or not `pnpm db:generate` was ever run, and only the replay says what D1 is
 * actually enforcing — which is the whole point when the question is which constraint refused.
 */

import { describe, expect, it } from 'vitest'
import { tripFavourites } from '#/server/db/schema'
import { isUniqueConstraintViolation } from '#/server/repos/context'
import { replayMigrations } from './migration-files'
import {
  columnNames,
  foreignKeys,
  indexColumns,
  indexNames,
  primaryKeyColumns,
} from './table-config'

/** The four columns a favourite is: whose workspace, which trip, which person, and when. */
const COLUMNS = ['organization_id', 'trip_id', 'user_id', 'created_at']

describe('trip_favourites', () => {
  describe('as declared', () => {
    it('carries no surrogate key, only the four columns a favourite is', () => {
      expect(columnNames(tripFavourites)).toEqual(COLUMNS)
      expect(columnNames(tripFavourites)).not.toContain('id')
    })

    it('is keyed by the pair that identifies the favourite', () => {
      expect(primaryKeyColumns(tripFavourites)).toEqual(['trip_id', 'user_id'])
    })

    it('does not re-impose that pair as a unique index beside the key', () => {
      expect(indexNames(tripFavourites)).toEqual([
        'trip_favourites_org_user_idx',
      ])
    })

    it('keeps the read index the trips index counts through', () => {
      // `tenantFilter()` puts `organization_id` in every WHERE clause, so it leads the composite one.
      expect(
        indexColumns(tripFavourites, 'trip_favourites_org_user_idx'),
      ).toEqual(['organization_id', 'user_id'])
    })

    it('still loses the row with the workspace or the trip', () => {
      // The recreate copies the foreign keys; a favourite outliving its trip would be a leak.
      expect(foreignKeys(tripFavourites)).toEqual([
        'organization_id -> organization.id (cascade)',
        'trip_id -> trips.id (cascade)',
      ])
    })
  })

  describe('as shipped', () => {
    // That the recreate left exactly the declared columns on disk, and dropped
    // `trip_favourites_trip_user_unq` with the surrogate key rather than keeping it beside the new
    // one, is asked of every table at once in `migrations-match-schema.test.ts`: the deployed index
    // inventory has to equal the declared one, name by name and column by column (#184). What that
    // diff cannot see is which constraint answers a duplicate, which is the case below.

    it('refuses a second row for the same trip and person', () => {
      const sqlite = replayMigrations()
      try {
        // Straight at the engine, past every repository: the key is what refuses the duplicate now,
        // and `isUniqueConstraintViolation` has to keep recognising the refusal it words.
        sqlite.exec(
          "INSERT INTO organization (id, name, slug, created_at) VALUES ('org', 'Org', 'org', 0)",
        )
        sqlite.exec(
          'INSERT INTO user (id, name, email, email_verified, created_at, updated_at)' +
            " VALUES ('usr', 'Ada', 'ada@example.com', 0, 0, 0)",
        )
        sqlite.exec(
          'INSERT INTO trips (id, organization_id, created_by, title, slug, created_at, updated_at)' +
            " VALUES ('trp', 'org', 'usr', 'Lisbon', 'lisbon', 0, 0)",
        )
        const insert =
          'INSERT INTO trip_favourites (organization_id, trip_id, user_id, created_at)' +
          " VALUES ('org', 'trp', 'usr', 0)"

        sqlite.exec(insert)

        // Through the predicate `setFavourite` actually swallows the refusal with, not through a
        // regex that happens to look like it: the key now raises SQLITE_CONSTRAINT_PRIMARYKEY where
        // the dropped index raised SQLITE_CONSTRAINT_UNIQUE, and the double-click race survives only
        // because `isUniqueConstraintViolation` recognises both.
        let refusal: unknown
        try {
          sqlite.exec(insert)
        } catch (cause) {
          refusal = cause
        }
        expect(refusal).toBeDefined()
        expect(isUniqueConstraintViolation(refusal)).toBe(true)
      } finally {
        sqlite.close()
      }
    })
  })
})
