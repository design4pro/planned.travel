/**
 * The two column defaults the demo fixture supplies for itself: the primary key, and the instant a
 * row says it was written.
 *
 * ## Why the fixture cannot let the database fill them in
 *
 * `newId()` in `src/server/db/schema.ts` is a base-36 `Date.now()` followed by a `nanoid`, and
 * `created_at` / `updated_at` default to `new Date()`. All three move every run. That would be
 * invisible if an id were only ever a lookup key, but it is not. A trip with no photograph gets a
 * cover *drawn* from its id — `seedFrom()` in `src/routes/_app/-ui/cover-art.tsx` hashes the string
 * and the hash chooses the landform's centre, its lobe count, its phase and its stretch; the wash it
 * is tinted with comes from the same number; and `washesFor()` walks a grid in render order handing
 * out the first colour a tile's own seed has not already claimed, so one changed id can recolour
 * every tile after it. Journal covers on `/journey` read the same way. Seeding twice therefore
 * repainted `/dashboard` and `/trips` and reddened baselines that were still correct about the
 * product.
 *
 * The timestamps are quieter but not harmless: `listTrips` orders the library by
 * `desc(trips.updatedAt)` with nothing to break a tie, and a batch insert stamps several rows with
 * the same millisecond, which leaves the order to SQLite. A fixture that is a pure function of its
 * dataset has no ties it did not choose.
 *
 * So the fixture supplies both. Nothing about `newId()` changes for an application write: this
 * module hands {@link SuppliedRowDefaults} to {@link withSuppliedRowDefaults}, which is installed
 * for the length of the seed call and restored on the way out, and which nothing outside this
 * directory is allowed to reach — `__tests__/fixture-rows.test.ts` reads the tree off disk and fails
 * if a second caller appears.
 *
 * ## The shape, and why an id is not a bare hash
 *
 * `src/server/db/schema.ts` states that sorting by `id` is sorting by creation time, and the
 * repositories take it at its word — `listTrips` breaks a date tie on `asc(trips.id)`, and every
 * keyset cursor in `src/server/repos/base.ts` pages on the primary key. A flat hash would satisfy
 * "the same every run" and quietly shuffle those lists into an order that means nothing. So a
 * fixture id keeps the production shape: nine base-36 characters of instant, then sixteen more.
 *
 * That instant is measured from `SEED_ANCHOR_INSTANT`, one millisecond per row, and it is the same
 * instant the row's `created_at` carries. Ids and timestamps therefore ascend together in the order
 * the seed writes, exactly as wall-clock ones would, and every fixture row sorts before anything a
 * reader creates afterwards because the anchor is in the past.
 *
 * ## Sections, and what makes the sequence survive a re-seed
 *
 * A counter that simply ran from the first row to the last would be deterministic only on a virgin
 * database. Half the seed is upsert — categories, moods, the bucket list, the vacay plan — so a
 * second run creates fewer rows than the first, and a shared counter would shift every id after the
 * first skipped write, changing the covers of trips nobody touched.
 *
 * The run is therefore divided into **sections**, one per dataset entity that is torn down and
 * rebuilt (each trip, each journal, each collection) and one per phase that is not. Which sections
 * are opened, and in what order, is fixed by the dataset and does not depend on what is already in
 * the database: `applySeed` walks every trip on every run whether or not a stale one was there. A
 * row's values are a function of its section's position and its position within that section, so the
 * rebuilt entities are identical every time, and the upserted ones keep what their first run gave
 * them because a later run writes no new rows at all.
 *
 * The one thing that would break that is a *workspace-scoped* row created lazily from inside a trip,
 * because it exists on the second run and not the first. `applySeed` hoists the only one — the tag
 * vocabulary — into its own section ahead of the trips for exactly this reason.
 *
 * ## The rows a column default cannot reach
 *
 * The seam above answers `$defaultFn`, and that covers every row a repository inserts without naming
 * a date. Four do name one, all on the auth side: Better Auth's sign-up writes the owner's `user` and
 * `account` rows from its own clock, its organization plugin writes `organization`, and `addMember()`
 * passes an explicit `new Date()`. `./bootstrap.ts` stamps all four afterwards, and
 * {@link membershipInstants} is the one of those values that reaches a pixel.
 */

import { withSuppliedRowDefaults } from '#/server/db/schema'
import { SEED_ANCHOR_INSTANT } from './dataset/anchor'
import { stableId } from './stable-id'
import type { SuppliedRowDefaults } from '#/server/db/schema'

/** Matches `newId()`: nine base-36 characters of instant, then sixteen more. */
const ID_TIME_LENGTH = 9
const ID_SUFFIX_LENGTH = 16

/**
 * Milliseconds of the fixture's timeline reserved for one section.
 *
 * A minute per section is four orders of magnitude more than the largest section needs (the flagship
 * trip writes a few hundred rows) and keeps the whole fixture inside the hour after the anchor, so
 * every id still has the same nine-character prefix. The mint refuses to overrun it rather than
 * letting one section's rows walk into the next section's range, where they would silently sort out
 * of order.
 */
const SECTION_STRIDE_MS = 60_000

/** Namespace for the derived half, so these never agree with a user id or a share token. */
const SUFFIX_NAMESPACE = 'demo-row'

/** The section in force before the first {@link FixtureRows.section} call. */
const FIRST_SECTION = 'bootstrap'

const ANCHOR_MS = SEED_ANCHOR_INSTANT.getTime()

export interface FixtureRows {
  /**
   * Runs `write` with every generated id and every unstamped timestamp inside it coming from the
   * fixture.
   *
   * One call wraps the whole seed. Sections are opened inside it.
   */
  run: <T>(write: () => Promise<T>) => Promise<T>
  /**
   * Starts a new section, named for the thing about to be written — `trip/tokyo-and-kyoto`,
   * `journey/dolomites-hut-to-hut`, `atlas`.
   *
   * The name seeds the derived half of every id the section mints, so renaming a section is a
   * fixture change that re-records the baselines it appears in.
   */
  section: (name: string) => void
}

/**
 * A fresh source of row defaults for one seed run.
 *
 * Two calls to this function, given the same sequence of sections and the same number of writes in
 * each, produce the same rows — which is the whole property the visual gate rests on.
 */
export function fixtureRows(): FixtureRows {
  let opened = 0
  let base = ANCHOR_MS
  let section = FIRST_SECTION
  let offset = 0

  /** The instant this row occupies. Advances once per row, so nothing is ever tied. */
  const instant = (): number => {
    if (offset >= SECTION_STRIDE_MS) {
      throw new RangeError(
        `fixture rows: section "${section}" wrote more than ${String(SECTION_STRIDE_MS)} rows and ` +
          `would overrun the next section's range. Split it, or widen SECTION_STRIDE_MS and ` +
          `re-record every authenticated baseline.`,
      )
    }
    return base + offset
  }

  const defaults: SuppliedRowDefaults = {
    id: () => {
      const at = instant().toString(36).padStart(ID_TIME_LENGTH, '0')
      const derived = stableId(
        SUFFIX_NAMESPACE,
        `${section}/${String(offset)}`,
        ID_SUFFIX_LENGTH,
      )
      offset += 1
      return `${at}${derived}`
    },
    // Deliberately does not advance the counter: only an identifier claims a new instant. A row is
    // stamped with the instant its own id has just moved past, and a row that has no id of its own —
    // a junction table — shares the instant of the row it was written beside. Both are functions of
    // the dataset alone, which is all determinism asks for.
    now: () => new Date(instant()),
  }

  return {
    run: (write) => withSuppliedRowDefaults(defaults, write),
    section: (name) => {
      opened += 1
      base = ANCHOR_MS + opened * SECTION_STRIDE_MS
      section = name
      offset = 0
    },
  }
}

/** One membership, and the instant `./bootstrap.ts` stamps it with. */
export interface MembershipInstant {
  readonly userId: string
  readonly joinedAt: Date
}

/**
 * When each person joined the demo workspace: the anchor, one millisecond apart, in dataset order.
 *
 * This is the one auth-side stamp a screen prints — `/settings` shows the owner's as "Member since",
 * and left on Better Auth's clock it read the day the workspace happened to be provisioned, which is
 * a different day on every clone and a fresh failure for the baseline that photographs it.
 *
 * A millisecond apart rather than all on the anchor, because `listMemberProfiles()` in
 * `src/server/repos/members.ts` orders the roster by `created_at` and nothing else. Four rows sharing
 * one instant would leave that order to SQLite — a tie the fixture would have introduced itself, in
 * the one place that exists to remove them.
 */
export function membershipInstants(
  userIds: ReadonlyArray<string>,
): ReadonlyArray<MembershipInstant> {
  return userIds.map((userId, index) => ({
    userId,
    joinedAt: new Date(ANCHOR_MS + index),
  }))
}
