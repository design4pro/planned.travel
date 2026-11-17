import { DatabaseSync } from 'node:sqlite'
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { resolve, join } from 'node:path'
import { expect, it } from 'vitest'
import {
  seedReleaseBrowserFixture,
  openLocalReleaseFixture,
} from './release-history-browser-fixture'

it('restores exact local rows and the immutable trigger, including rollback after cleanup failure', () => {
  const base = resolve('.wrangler/state')
  mkdirSync(base, { recursive: true })
  const directory = mkdtempSync(join(base, 'release-browser-test-'))
  const file = join(directory, 'fixture.sqlite')
  const db = new DatabaseSync(file)
  try {
    db.exec(readFileSync('drizzle/0030_release_content.sql', 'utf8'))
    db.prepare(
      'INSERT INTO content_entries(id,slug,created_at,updated_at) VALUES (?,?,1,1)',
    ).run('unrelated', 'unrelated')
    const trigger = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
      )
      .get()?.sql
    const fixture = seedReleaseBrowserFixture(directory)
    expect(
      db.prepare('SELECT count(*) AS n FROM content_versions').get()?.n,
    ).toBe(23)
    // Abort a deletion after trigger removal; the transaction must restore every row and trigger.
    db.exec(
      "CREATE TRIGGER fixture_cleanup_fault BEFORE DELETE ON content_versions BEGIN SELECT RAISE(ABORT,'fixture cleanup fault'); END",
    )
    expect(() => fixture.cleanup()).toThrow('fixture cleanup fault')
    expect(
      db.prepare('SELECT count(*) AS n FROM content_versions').get()?.n,
    ).toBe(23)
    expect(
      db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
        )
        .get()?.sql,
    ).toBe(trigger)
    db.exec('DROP TRIGGER fixture_cleanup_fault')
    db.prepare(
      'INSERT INTO content_translations(id,version_id,locale,body,created_at) VALUES (?,?,?,?,1)',
    ).run(
      'foreign-translation',
      fixture.ids[0],
      'de',
      JSON.stringify({
        title: 'Unrelated translation',
        summary: [],
        features: [],
        fixes: [],
      }),
    )
    expect(() => fixture.cleanup()).toThrow('foreign translations')
    expect(
      db
        .prepare('SELECT id FROM content_translations WHERE id=?')
        .get('foreign-translation')?.id,
    ).toBe('foreign-translation')
    expect(
      db.prepare('SELECT count(*) AS n FROM content_versions').get()?.n,
    ).toBe(23)
    expect(
      db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
        )
        .get()?.sql,
    ).toBe(trigger)
    db.prepare('DELETE FROM content_translations WHERE id=?').run(
      'foreign-translation',
    )
    fixture.cleanup()
    expect(db.prepare('SELECT id FROM content_entries').all()).toEqual([
      { id: 'unrelated' },
    ])
    for (const table of [
      'content_versions',
      'content_translations',
      'release_publications',
      'release_deployments',
      'release_deployment_entries',
      'release_production_state',
    ]) {
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0)
    }
    expect(
      db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
        )
        .get()?.sql,
    ).toBe(trigger)
    fixture.cleanup()
    const link = join(directory, 'symlink')
    symlinkSync(directory, link)
    expect(() => openLocalReleaseFixture(link)).toThrow()
    expect(() => openLocalReleaseFixture('/tmp')).toThrow()
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

it('validates bounded single-entry long-content fixtures before writing and restores them', () => {
  const base = resolve('.wrangler/state')
  mkdirSync(base, { recursive: true })
  const directory = mkdtempSync(join(base, 'release-browser-test-'))
  const db = new DatabaseSync(join(directory, 'fixture.sqlite'))
  try {
    db.exec(readFileSync('drizzle/0030_release_content.sql', 'utf8'))
    for (const visibleCount of [0, 23, 1.5])
      expect(() =>
        seedReleaseBrowserFixture(directory, { visibleCount }),
      ).toThrow()
    const body = {
      title: 'W'.repeat(240),
      summary: ['A long summary. '.repeat(100)],
      features: [],
      fixes: [],
    }
    expect(() =>
      seedReleaseBrowserFixture(directory, {
        body: { ...body, title: 'W'.repeat(241) },
      }),
    ).toThrow()
    expect(
      db.prepare('SELECT count(*) AS n FROM content_entries').get()?.n,
    ).toBe(0)
    const fixture = seedReleaseBrowserFixture(directory, {
      visibleCount: 1,
      body,
    })
    expect(
      db.prepare('SELECT count(*) AS n FROM release_publications').get()?.n,
    ).toBe(1)
    expect(
      JSON.parse(
        String(
          db
            .prepare('SELECT body FROM content_versions WHERE id=?')
            .get(fixture.ids[0])?.body,
        ),
      ),
    ).toEqual(body)
    fixture.cleanup()
    expect(
      db.prepare('SELECT count(*) AS n FROM content_entries').get()?.n,
    ).toBe(0)
    expect(
      db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
        )
        .get()?.sql,
    ).toBeTruthy()
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
