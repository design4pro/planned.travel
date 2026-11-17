/** Local browser fixture only. Never imported by a Worker, route or production seed. */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, realpathSync, lstatSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { releaseBodySchema } from '../../content/collections'
import type { ReleaseBody } from '../../content/collections'

/** Fixed worktree-local D1 discovery; no URL, remote flag, request input or credential. */
export function openLocalReleaseFixture(
  directory = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
) {
  const allowed = resolve('.wrangler/state')
  const root = resolve(directory)
  if (!root.startsWith(allowed + sep) || realpathSync(root) !== root)
    throw new Error('Only real worktree-local fixture paths are allowed')
  const candidates = readdirSync(root).filter((file) =>
    file.endsWith('.sqlite'),
  )
  for (const file of candidates) {
    const path = join(root, file)
    if (lstatSync(path).isSymbolicLink() || realpathSync(path) !== path)
      throw new Error('Fixture database symlinks are forbidden')
    const db = new DatabaseSync(path)
    db.exec('PRAGMA busy_timeout = 10000; PRAGMA foreign_keys = ON;')
    if (
      db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='release_publications'",
        )
        .get()
    )
      return db
    db.close()
  }
  throw new Error('Migrated local release fixture database is missing')
}

export function seedReleaseBrowserFixture(
  directory?: string,
  options: { visibleCount?: number; body?: ReleaseBody } = {},
) {
  const visibleCount = options.visibleCount ?? 22
  if (!Number.isInteger(visibleCount) || visibleCount < 1 || visibleCount > 22)
    throw new Error('Fixture visible count must be between 1 and 22')
  const body = releaseBodySchema.parse(
    options.body ?? {
      title: 'More time for the journey',
      summary: ['Plan together with clearer details and fewer interruptions.'],
      features: ['Keep your group’s plans in one place.'],
      fixes: ['Enjoy more reliable trip updates.'],
    },
  )
  const db = openLocalReleaseFixture(directory)
  const prefix = `browser-release-${randomUUID()}`
  const ids: string[] = []
  const translationIds = new Set<string>()
  const major = 800000 + Math.floor(Math.random() * 100000)
  const hash = 'a'.repeat(64)
  const sha = 'b'.repeat(40)
  const trigger = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='content_versions_no_delete'",
    )
    .get()?.sql
  if (typeof trigger !== 'string') {
    db.close()
    throw new Error('Immutable release trigger missing')
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    for (let i = 0; i < 23; i++) {
      const id = `${prefix}-${i}`
      ids.push(id)
      const version = `${major}.0.${i}`
      const shipped = Date.UTC(2026, 10, 15) - i * 86400000
      db.prepare(
        'INSERT INTO content_entries (id,slug,status,created_at,updated_at) VALUES (?,?,?,?,?)',
      ).run(id, version, 'draft', shipped, shipped)
      db.prepare(
        'INSERT INTO content_versions (id,entry_id,revision,body,source_commit,source_hash,cutoff_sha,created_at) VALUES (?,?,1,?,?,?,?,?)',
      ).run(id, id, JSON.stringify(body), sha, hash, sha, shipped)
      if (i >= visibleCount) continue
      db.prepare(
        "UPDATE content_entries SET status='published',published_version_id=? WHERE id=?",
      ).run(id, id)
      db.prepare(
        "INSERT INTO release_publications (id,release_version,entry_id,heading_date,cutoff_sha,current_version_id,approved_version_id,approved_hash,review_audit_id,reviewed_at,visible_version_id,visible_hash,visible_reviewed_at,first_shipped_at,content_updated_at,operation_id,claim_id,created_at,updated_at) VALUES (?,?,?,'2026-11-15',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        version,
        id,
        sha,
        id,
        id,
        hash,
        id,
        shipped,
        id,
        hash,
        shipped,
        shipped,
        i === 0 ? shipped + 1000 : null,
        id,
        id,
        shipped,
        shipped,
      )
      db.prepare(
        "INSERT INTO release_deployments (id,provider_id,run_id,attempt,main_commit,tree_sha,target,activated_at,receipt_digest,created_at) VALUES (?,?,?,1,?,?,'production',?,?,?)",
      ).run(id, id, id, sha, sha, shipped, hash, shipped)
      db.prepare(
        'INSERT INTO release_deployment_entries (deployment_id,publication_id,version_id) VALUES (?,?,?)',
      ).run(id, id, id)
      if (i === 0) {
        for (const [locale, title, summary] of [
          [
            'pl',
            'Więcej czasu na podróż',
            'Planujcie razem z czytelniejszymi szczegółami i bez zbędnych przerw.',
          ],
          [
            'ar',
            'مزيد من الوقت للرحلة',
            'خططوا معًا بتفاصيل أوضح ومقاطعات أقل.',
          ],
        ]) {
          translationIds.add(`${id}-${locale}`)
          db.prepare(
            'INSERT INTO content_translations (id,version_id,locale,body,review_audit_id,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?)',
          ).run(
            `${id}-${locale}`,
            id,
            locale,
            JSON.stringify({
              title,
              summary: [summary],
              features: [],
              fixes: [],
            }),
            id,
            shipped,
            shipped,
          )
        }
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    db.close()
    throw error
  }
  let cleaned = false
  return {
    major,
    ids: [...ids],
    cleanup() {
      if (cleaned) return
      db.exec('BEGIN IMMEDIATE')
      try {
        for (const id of ids) {
          const owned = db
            .prepare(
              'SELECT 1 FROM content_entries e JOIN content_versions v ON v.entry_id=e.id WHERE e.id=? AND v.id=?',
            )
            .get(id, id)
          if (!owned)
            throw new Error('Fixture ownership changed; refusing cleanup')
          const translations = db
            .prepare('SELECT id FROM content_translations WHERE version_id=?')
            .all(id)
          if (
            translations.some(
              (row) =>
                typeof row.id !== 'string' || !translationIds.has(row.id),
            )
          )
            throw new Error(
              'Fixture has foreign translations; refusing cleanup',
            )
          const foreignProof = db
            .prepare(
              'SELECT 1 FROM release_deployment_entries WHERE (publication_id=? OR version_id=? OR deployment_id=?) AND NOT (publication_id=? AND version_id=? AND deployment_id=?)',
            )
            .get(id, id, id, id, id, id)
          if (foreignProof)
            throw new Error('Fixture has foreign references; refusing cleanup')
        }
        if (
          db
            .prepare(
              "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
            )
            .get()?.sql !== trigger
        )
          throw new Error('Immutable trigger changed; refusing cleanup')
        // Fixture-only rollback. Restore the exact immutable trigger in this same transaction.
        db.exec('DROP TRIGGER content_versions_no_delete')
        for (const id of ids) {
          for (const translationId of translationIds)
            db.prepare(
              'DELETE FROM content_translations WHERE id=? AND version_id=?',
            ).run(translationId, id)
          db.prepare(
            'DELETE FROM release_deployment_entries WHERE publication_id=?',
          ).run(id)
          db.prepare('DELETE FROM release_publications WHERE id=?').run(id)
          db.prepare('DELETE FROM release_deployments WHERE id=?').run(id)
          db.prepare(
            'UPDATE content_entries SET published_version_id=NULL WHERE id=?',
          ).run(id)
          db.prepare('DELETE FROM content_versions WHERE id=?').run(id)
          db.prepare('DELETE FROM content_entries WHERE id=?').run(id)
        }
        db.exec(trigger)
        if (
          db
            .prepare(
              "SELECT sql FROM sqlite_master WHERE name='content_versions_no_delete'",
            )
            .get()?.sql !== trigger
        )
          throw new Error('Immutable trigger restoration failed')
        db.exec('COMMIT')
        cleaned = true
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      } finally {
        if (cleaned) db.close()
      }
    },
  }
}
