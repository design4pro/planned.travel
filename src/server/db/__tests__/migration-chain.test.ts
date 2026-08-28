/**
 * The `prevId` links inside `drizzle/meta/*_snapshot.json`, which nothing else reads.
 *
 * `src/server/billing/__tests__/migrations.test.ts` replays the `.sql` files and checks
 * them against `_journal.json`. That is the deployed surface — `wrangler d1 migrations
 * apply` reads the `.sql` files and its own bookkeeping table, and never opens a
 * snapshot. So a broken snapshot chain breaks nothing that ships, and it broke here
 * without a single test noticing: `0003` and `0002` both claimed `0001` as their parent
 * and `0005` claimed a parent that was on no snapshot at all.
 *
 * What it does break is authoring the next migration. drizzle-kit's
 * `prepareMigrationFolder` buckets every snapshot by its `prevId` and exits before it
 * looks at `schema.ts` if any bucket holds two, so `pnpm db:generate` refuses to run at
 * all while the history is a tree rather than a line. The orphan is quieter — the
 * validator asks whether a parent is claimed twice, never whether it exists — but it is
 * the same break in the same chain, so this test rejects both.
 *
 * It refuses with exit code 0: the collision is a line on stdout and nothing else, so
 * `pnpm db:generate` looks successful to any shell that checks `$?`, and the generator
 * writes no file to notice missing either. That is why the guard is this test and not
 * an exit-code step in the ladder.
 *
 * The checks live in `chainViolations`, a pure function over the links, so every way
 * the chain can break can be put to it directly as a fixture. A guard on a file that is
 * correct at rest proves nothing unless it is shown to fire.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const META_DIR = join(process.cwd(), 'drizzle', 'meta')

/** The parent drizzle-kit stamps on the first snapshot, which has none. */
const ROOT_PREV_ID = '00000000-0000-0000-0000-000000000000'

interface ChainLink {
  /** Name as it appears in `drizzle/meta/`, for readable failures. */
  readonly file: string
  readonly id: string
  readonly prevId: string
}

/**
 * Every way the chain can stop being a single line, in journal order.
 *
 * Returns one message per defect rather than throwing on the first, so a fixture with
 * two problems reports two and the real chain reports everything left to repair.
 */
function chainViolations(links: ReadonlyArray<ChainLink>): Array<string> {
  const violations: Array<string> = []
  const ids = new Set(links.map((link) => link.id))
  const parentToFiles = new Map<string, Array<string>>()

  links.forEach((link, index) => {
    const previous = index === 0 ? null : links[index - 1]
    const expected = previous?.id ?? ROOT_PREV_ID
    if (link.prevId !== expected) {
      const predecessor = previous ? previous.file : 'the all-zero root'
      violations.push(
        `${link.file} has prevId ${link.prevId}, expected ${expected} from ${predecessor}`,
      )
    }
    if (link.prevId !== ROOT_PREV_ID && !ids.has(link.prevId)) {
      violations.push(
        `${link.file} has prevId ${link.prevId}, which is no snapshot's id`,
      )
    }
    const claimants = parentToFiles.get(link.prevId)
    if (claimants) {
      claimants.push(link.file)
    } else {
      parentToFiles.set(link.prevId, [link.file])
    }
  })

  for (const [parent, files] of parentToFiles) {
    if (files.length > 1) {
      violations.push(`${files.join(', ')} all claim parent ${parent}`)
    }
  }

  return violations
}

interface JournalEntry {
  readonly idx: number
}

/** `_journal.json`'s `idx` values, ascending — the order the snapshots must chain in. */
function journalIndices(): Array<number> {
  const raw: unknown = JSON.parse(
    readFileSync(join(META_DIR, '_journal.json'), 'utf8'),
  )
  const entries =
    typeof raw === 'object' && raw !== null && 'entries' in raw
      ? raw.entries
      : null
  if (!Array.isArray(entries)) {
    throw new Error('drizzle/meta/_journal.json has no entries array')
  }
  return (entries as Array<JournalEntry>)
    .map((entry) => entry.idx)
    .sort((a, b) => a - b)
}

/** The name drizzle-kit gives the snapshot for journal entry `idx`. */
function snapshotFileName(idx: number): string {
  return `${String(idx).padStart(4, '0')}_snapshot.json`
}

function linkFor(file: string): ChainLink {
  const raw: unknown = JSON.parse(readFileSync(join(META_DIR, file), 'utf8'))
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('id' in raw) ||
    !('prevId' in raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.prevId !== 'string'
  ) {
    throw new Error(`drizzle/meta/${file} has no id/prevId pair`)
  }
  return { file, id: raw.id, prevId: raw.prevId }
}

function snapshotFilesOnDisk(): Array<string> {
  return readdirSync(META_DIR)
    .filter((name) => name.endsWith('_snapshot.json'))
    .sort()
}

/** Three links chained correctly, to be bent one way per fixture. */
const FIXTURE: ReadonlyArray<ChainLink> = [
  { file: 'a', id: 'id-a', prevId: ROOT_PREV_ID },
  { file: 'b', id: 'id-b', prevId: 'id-a' },
  { file: 'c', id: 'id-c', prevId: 'id-b' },
]

describe('the migration snapshot chain', () => {
  it('has one snapshot per journal entry', () => {
    expect(snapshotFilesOnDisk()).toEqual(
      journalIndices().map(snapshotFileName),
    )
  })

  it('is a single line from the all-zero root', () => {
    const links = journalIndices().map((idx) => linkFor(snapshotFileName(idx)))

    expect(chainViolations(links)).toEqual([])
  })
})

describe('chainViolations', () => {
  it('accepts a chain that is already a single line', () => {
    expect(chainViolations(FIXTURE)).toEqual([])
  })

  it('rejects a fork — two snapshots claiming the same parent', () => {
    const forked = FIXTURE.map((link) =>
      link.file === 'c' ? { ...link, prevId: 'id-a' } : link,
    )

    expect(chainViolations(forked)).toEqual([
      'c has prevId id-a, expected id-b from b',
      'b, c all claim parent id-a',
    ])
  })

  it('rejects an orphan — a prevId that is no snapshot id', () => {
    const orphaned = FIXTURE.map((link) =>
      link.file === 'c' ? { ...link, prevId: 'id-gone' } : link,
    )

    expect(chainViolations(orphaned)).toEqual([
      'c has prevId id-gone, expected id-b from b',
      "c has prevId id-gone, which is no snapshot's id",
    ])
  })

  it('rejects a line whose order is not the journal order', () => {
    // A perfectly connected chain — a → c → b — read in journal order a, b, c.
    const reordered: Array<ChainLink> = [
      { file: 'a', id: 'id-a', prevId: ROOT_PREV_ID },
      { file: 'b', id: 'id-b', prevId: 'id-c' },
      { file: 'c', id: 'id-c', prevId: 'id-a' },
    ]

    expect(chainViolations(reordered)).toEqual([
      'b has prevId id-c, expected id-a from a',
      'c has prevId id-a, expected id-b from b',
    ])
  })

  it('rejects a first snapshot that is not rooted at the all-zero parent', () => {
    const unrooted = FIXTURE.map((link) =>
      link.file === 'a' ? { ...link, prevId: 'id-c' } : link,
    )

    expect(chainViolations(unrooted)).toEqual([
      'a has prevId id-c, expected 00000000-0000-0000-0000-000000000000 from the all-zero root',
    ])
  })
})
