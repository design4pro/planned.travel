/**
 * The rows the fixture writes, and the two properties they exist to hold.
 *
 * 1. **The same rows every run.** A trip's cover is drawn from its id — `seedFrom()` in
 *    `src/routes/_app/-ui/cover-art.tsx` hashes the string into a landform, and the wash it is
 *    tinted with comes from the same number — so an id that moves repaints `/dashboard` and
 *    `/trips` and fails a baseline that is still correct about the product. `../fixture-rows`
 *    derives ids and row stamps instead of drawing them, and this file states that two runs agree.
 * 2. **`newId()` is unchanged for everything else.** The seam is a module-scoped override in
 *    `src/server/db/schema.ts`, and it is worth exactly as much as the promise that no application
 *    write installs one. That promise is checked here against the tree on disk rather than asserted
 *    in a comment, because a comment does not fail a build — and so is the promise that the override
 *    is put back however the seed ends.
 *
 * The shape assertions are not decoration. `src/server/db/schema.ts` documents that sorting by `id`
 * is sorting by creation time, and the repositories take it at its word: `listTrips` breaks a date
 * tie on `asc(trips.id)` and every keyset cursor pages on the primary key. A fixture id that was
 * merely reproducible, and not also ascending, would shuffle those lists into an order that means
 * nothing and move far more pixels than the covers do.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { newId } from '#/server/db/schema'
import { SEED_ANCHOR_INSTANT } from '../dataset/anchor'
import { fixtureRows, membershipInstants } from '../fixture-rows'

const REPO_ROOT = join(import.meta.dirname, '../../../../../..')
const SRC_ROOT = join(REPO_ROOT, 'src')

/** Length of an id `newId()` mints: nine base-36 characters of instant, then sixteen more. */
const ID_TIME_LENGTH = 9
const ID_LENGTH = 25

/** Mints `count` ids in a section, the way the seed does. */
async function mint(section: string, count: number): Promise<ReadonlyArray<string>> {
  const fixture = fixtureRows()
  return await fixture.run(async () => {
    fixture.section(section)
    return await Promise.resolve(Array.from({ length: count }, () => newId()))
  })
}

/** Every TypeScript module under `src/`, tests excluded, as `[repo-relative path, source]`. */
function sources(): ReadonlyArray<readonly [string, string]> {
  const walk = (directory: string): Array<string> =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : walk(path)
      }
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  return walk(SRC_ROOT).map(
    (path) => [relative(REPO_ROOT, path), readFileSync(path, 'utf8')] as const,
  )
}

describe('the fixture identifier seam', () => {
  it('is opened by the demo seed and by nothing else in the tree', () => {
    const callers = sources()
      .filter(([, source]) => source.includes('withSuppliedRowDefaults'))
      .map(([path]) => path)

    // The declaration, and the one module allowed to reach for it.
    expect([...callers].sort()).toEqual([
      'src/routes/api/dev/-seed/fixture-rows.ts',
      'src/server/db/schema.ts',
    ])
  })

  it('leaves newId() drawing from a random source outside a fixture run', () => {
    const drawn = new Set(Array.from({ length: 64 }, () => newId()))
    expect(drawn.size).toBe(64)
  })

  it('restores the random source once the fixture run has finished, and after it throws', async () => {
    await mint('trip/lisbon-long-weekend', 4)
    expect(newId()).not.toBe(newId())

    const fixture = fixtureRows()
    await expect(
      fixture.run(() => Promise.reject(new Error('the seed failed half way'))),
    ).rejects.toThrow('the seed failed half way')
    expect(newId()).not.toBe(newId())
  })

  it('refuses to install a second source inside the first', async () => {
    const outer = fixtureRows()
    const inner = fixtureRows()
    await expect(outer.run(() => inner.run(() => Promise.resolve(1)))).rejects.toThrow(
      /do not nest/,
    )
    expect(newId()).not.toBe(newId())
  })
})

describe('the values the fixture writes', () => {
  it('agrees with itself across runs, section by section', async () => {
    const first = await mint('trip/tokyo-and-kyoto', 32)
    const second = await mint('trip/tokyo-and-kyoto', 32)
    expect(second).toEqual(first)
  })

  it('gives two sections two different sets, so one trip cannot wear another trip cover', async () => {
    const tokyo = await mint('trip/tokyo-and-kyoto', 8)
    const lisbon = await mint('trip/lisbon-long-weekend', 8)
    expect(new Set([...tokyo, ...lisbon]).size).toBe(16)
  })

  it('keeps the shape newId() promises: 25 characters, base-36 instant first', async () => {
    const ids = await mint('atlas', 8)
    for (const id of ids) {
      expect(id).toHaveLength(ID_LENGTH)
      expect(id).toMatch(/^[0-9a-z]{9}[0-9a-f]{16}$/)
    }
  })

  it('ascends in the order the seed writes, within a section and across sections', async () => {
    const fixture = fixtureRows()
    const ids = await fixture.run(async () => {
      const written: Array<string> = []
      for (const section of ['workspace', 'trip/lisbon-long-weekend', 'atlas']) {
        fixture.section(section)
        written.push(newId(), newId(), newId())
      }
      return await Promise.resolve(written)
    })

    expect(ids).toEqual([...ids].sort())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('anchors the instant a row is written at, and advances it one row at a time', async () => {
    const ids = await mint('trip/tokyo-and-kyoto', 6)
    // The prefix is the instant, and the row's `created_at` reads the same counter — which is why
    // `desc(updatedAt)` has no ties to leave to SQLite.
    const instants = ids.map((id) => Number.parseInt(id.slice(0, ID_TIME_LENGTH), 36))
    const anchor = SEED_ANCHOR_INSTANT.getTime()
    expect(instants.map((at) => at - (instants[0] ?? 0))).toEqual([0, 1, 2, 3, 4, 5])
    expect(instants[0]).toBeGreaterThan(anchor)
    // Inside the hour after the anchor, so every fixture id keeps the same nine-character prefix.
    expect(instants.at(-1)).toBeLessThan(anchor + 3_600_000)
  })

  it('joins the workspace on the anchor, in dataset order, with no two people tied', () => {
    const roster = ['rafal', 'mika', 'jonas', 'priya']
    const joined = membershipInstants(roster)

    expect(joined.map((row) => row.userId)).toEqual(roster)
    // `/settings` prints the owner's as "Member since": on the anchor, every run, on every clone.
    expect(joined.map((row) => row.joinedAt.getTime() - SEED_ANCHOR_INSTANT.getTime())).toEqual([
      0, 1, 2, 3,
    ])
    // `listMemberProfiles` orders the roster by this column alone, so a shared instant would hand
    // the order of the members table to SQLite.
    expect(new Set(joined.map((row) => row.joinedAt.getTime())).size).toBe(roster.length)
  })

  it('sorts every fixture row before anything created after the seed', async () => {
    const [fixtureRow] = await mint('usage', 1)
    // The anchor is a fixed day in the past, so a row a reader adds later always sorts after it.
    expect(SEED_ANCHOR_INSTANT.getTime()).toBeLessThan(Date.now())
    expect(fixtureRow < newId(), 'a fixture id must sort before a freshly minted one').toBe(true)
  })
})
