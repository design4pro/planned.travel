/**
 * `docs/DEPLOY.md` §12's register of non-additive migrations, held to the files in `drizzle/`.
 *
 * §5 says the register is the list: a migration absent from it is additive, and a non-additive one
 * absent from it is a defect. The prose alone let that drift twice (#452) — `0002_locale_normalisation`
 * and `0010_basemap_default` are table recreates that shipped without a row, and a renumbering left
 * the register naming `0002_calm_daredevil`, a file that no longer exists. Both directions are
 * mechanical, so both are asserted here: every migration carrying a non-additive idiom has a row,
 * and every row names a migration the journal ships.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { journalTags, shippedMigrations } from './migration-files'

/**
 * The statements §5 and §12 classify as departures: drizzle-kit's `__new_<table>` recreate, a
 * rename, and a drop. Deliberately broad — a false positive costs one register row, a miss is the
 * defect this file exists for.
 */
const NON_ADDITIVE = /__new_\w+|RENAME\s+COLUMN|DROP\s+COLUMN|DROP\s+TABLE/i

/** The migration tags §12's register table names, one per row. */
function registeredTags(): Array<string> {
  const deploy = readFileSync(join(process.cwd(), 'docs', 'DEPLOY.md'), 'utf8')
  const start = deploy.indexOf('### Register of non-additive migrations')
  if (start === -1) throw new Error('docs/DEPLOY.md has no §12 register')
  const section = deploy.slice(start, deploy.indexOf('\n## ', start))
  return [...section.matchAll(/^\| `(\d{4}_\w+)`/gm)].map((match) => match[1])
}

describe('the §12 register of non-additive migrations', () => {
  it('has a row for every migration that recreates, renames or drops', () => {
    const nonAdditive = shippedMigrations()
      .filter((migration) => NON_ADDITIVE.test(migration.sql))
      .map((migration) => migration.tag)

    expect(registeredTags()).toEqual(expect.arrayContaining(nonAdditive))
  })

  it('names only migrations the journal ships', () => {
    expect(journalTags()).toEqual(expect.arrayContaining(registeredTags()))
  })
})
