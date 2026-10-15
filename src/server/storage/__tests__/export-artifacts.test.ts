/**
 * The `exports/` key family, its listing and its prune — proved against the shared fake bucket.
 *
 * The fake lists in lexicographic key order, not by time, and answers a small page at a time. That
 * is R2's contract and it is what these tests lean on: a module that trusted the order a page
 * arrived in, or stopped at the first page, would pass against a fake that did neither.
 */
import { describe, expect, it } from 'vitest'

import {
  EXPORT_KEEP_COUNT,
  EXPORT_TTL_SECONDS,
  exportObjectKey,
  exportPointerKey,
  exportPrefix,
  isExpired,
  listExportArtifacts,
  listExportKeys,
  pruneExportArtifacts,
} from '../export-artifacts'
import { fakeBucket } from './fake-bucket'

import type { FakeObject } from './fake-bucket'

const NOW = Date.parse('2026-10-14T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

/** An object written `ageDays` before {@link NOW}. */
function aged(ageDays: number, body = 'x'): FakeObject {
  return { body, uploaded: new Date(NOW - ageDays * DAY_MS) }
}

/** The complete artifact `taskId` — the `.html`, and the `.pdf` when asked — written `ageDays` ago. */
function artifact(
  orgId: string,
  tripId: string,
  taskId: string,
  ageDays: number,
  options: { readonly pdf?: boolean } = {},
): Record<string, FakeObject> {
  return {
    [exportObjectKey(orgId, tripId, taskId, 'html')]: aged(ageDays, 'html!'),
    ...(options.pdf === true
      ? {
          [exportObjectKey(orgId, tripId, taskId, 'pdf')]: aged(
            ageDays,
            'pdf bytes',
          ),
        }
      : {}),
  }
}

describe('the export key family', () => {
  it('ends the prefix in a slash, so a trip whose id begins with the same characters is not matched', () => {
    expect(exportPrefix('org_1', 'trip_1')).toBe('exports/org_1/trip_1/')
    expect(
      'exports/org_1/trip_12/t.html'.startsWith(
        exportPrefix('org_1', 'trip_1'),
      ),
    ).toBe(false)
  })

  it('writes objects under the prefix and the pointer outside it', () => {
    expect(exportObjectKey('org_1', 'trip_1', 'task', 'pdf')).toBe(
      'exports/org_1/trip_1/task.pdf',
    )
    expect(exportPointerKey('task')).toBe('export:task')
  })

  it('keeps an export for seven days and at most five per trip', () => {
    expect(EXPORT_TTL_SECONDS).toBe(7 * 24 * 60 * 60)
    expect(EXPORT_KEEP_COUNT).toBe(5)
  })

  it('expires an artifact only once it is older than the seven days', () => {
    expect(isExpired(NOW - 7 * DAY_MS, NOW)).toBe(false)
    expect(isExpired(NOW - 7 * DAY_MS - 1, NOW)).toBe(true)
  })
})

describe('listExportArtifacts', () => {
  it('pages the whole prefix before it sorts by time, newest first', async () => {
    // Lexicographic order is the reverse of the order of age here, and a page size of two means
    // five artifacts cannot arrive in one call.
    const bucket = fakeBucket(
      {
        ...artifact('org_1', 'trip_1', 'a-old', 4),
        ...artifact('org_1', 'trip_1', 'b', 3),
        ...artifact('org_1', 'trip_1', 'c', 2),
        ...artifact('org_1', 'trip_1', 'd', 1),
        ...artifact('org_1', 'trip_1', 'e-new', 0.5),
      },
      { pageSize: 2 },
    )

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts.map((entry) => entry.taskId)).toEqual([
      'e-new',
      'd',
      'c',
      'b',
      'a-old',
    ])
    // Five objects at two a page is three calls, the last one not truncated.
    expect(bucket.listCalls).toHaveLength(3)
    expect(
      bucket.listCalls.every((call) => call.prefix === 'exports/org_1/trip_1/'),
    ).toBe(true)
  })

  it('lists an artifact only when its printable page exists', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'done', 1),
      // The PDF is written first: a lone one is a job still running.
      [exportObjectKey('org_1', 'trip_1', 'running', 'pdf')]: aged(0.1),
    })

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts.map((entry) => entry.taskId)).toEqual(['done'])
  })

  it('prefers the PDF, and takes its size and instant', async () => {
    const bucket = fakeBucket({
      [exportObjectKey('org_1', 'trip_1', 'both', 'html')]: aged(1, 'html'),
      [exportObjectKey('org_1', 'trip_1', 'both', 'pdf')]: aged(
        1.5,
        'a much longer pdf body',
      ),
      ...artifact('org_1', 'trip_1', 'plain', 2),
    })

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts).toEqual([
      {
        taskId: 'both',
        format: 'pdf',
        sizeBytes: 'a much longer pdf body'.length,
        createdAt: NOW - 1.5 * DAY_MS,
      },
      {
        taskId: 'plain',
        format: 'html',
        sizeBytes: 'html!'.length,
        createdAt: NOW - 2 * DAY_MS,
      },
    ])
  })

  it('omits an artifact past its seven days', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'fresh', 6.9),
      ...artifact('org_1', 'trip_1', 'stale', 7.1),
    })

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts.map((entry) => entry.taskId)).toEqual(['fresh'])
  })

  it('ignores a name it does not recognise', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'real', 1),
      'exports/org_1/trip_1/notes.txt': aged(1),
      'exports/org_1/trip_1/nested/deep.html': aged(1),
      'exports/org_1/trip_1/.html': aged(1),
    })

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts.map((entry) => entry.taskId)).toEqual(['real'])
  })

  it('never matches a trip whose id begins with the same characters', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'mine', 1),
      ...artifact('org_1', 'trip_12', 'theirs', 1),
    })

    const artifacts = await listExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(artifacts.map((entry) => entry.taskId)).toEqual(['mine'])
  })
})

describe('listExportKeys', () => {
  it('returns both objects of an artifact, and nothing of a neighbouring trip', async () => {
    const bucket = fakeBucket(
      {
        ...artifact('org_1', 'trip_1', 'one', 1, { pdf: true }),
        ...artifact('org_1', 'trip_1', 'two', 2),
        ...artifact('org_1', 'trip_12', 'other', 1),
      },
      { pageSize: 2 },
    )

    const keys = await listExportKeys(bucket, 'org_1', 'trip_1')

    expect([...keys].sort()).toEqual([
      'exports/org_1/trip_1/one.html',
      'exports/org_1/trip_1/one.pdf',
      'exports/org_1/trip_1/two.html',
    ])
  })

  it('returns an unparseable name too: the purge removes everything under the prefix', async () => {
    const bucket = fakeBucket({ 'exports/org_1/trip_1/readme.txt': aged(1) })

    expect(await listExportKeys(bucket, 'org_1', 'trip_1')).toEqual([
      'exports/org_1/trip_1/readme.txt',
    ])
  })
})

describe('pruneExportArtifacts', () => {
  it('deletes nothing under the thresholds', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'a', 1),
      ...artifact('org_1', 'trip_1', 'b', 2),
      ...artifact('org_1', 'trip_1', 'c', 3),
      ...artifact('org_1', 'trip_1', 'd', 4),
      ...artifact('org_1', 'trip_1', 'e', 5, { pdf: true }),
    })

    const pruned = await pruneExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(pruned).toBe(0)
    expect(bucket.calls).toEqual([])
  })

  it('deletes every object of every artifact past seven days', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'fresh', 1, { pdf: true }),
      ...artifact('org_1', 'trip_1', 'stale', 8, { pdf: true }),
    })

    const pruned = await pruneExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(pruned).toBe(2)
    expect([...bucket.remaining].sort()).toEqual([
      'exports/org_1/trip_1/fresh.html',
      'exports/org_1/trip_1/fresh.pdf',
    ])
  })

  it('keeps the newest five of the rest, whatever order they were listed in', async () => {
    const bucket = fakeBucket(
      {
        // Lexicographic order puts the oldest first, and the page size splits them.
        ...artifact('org_1', 'trip_1', 'a', 6, { pdf: true }),
        ...artifact('org_1', 'trip_1', 'b', 5),
        ...artifact('org_1', 'trip_1', 'c', 4),
        ...artifact('org_1', 'trip_1', 'd', 3),
        ...artifact('org_1', 'trip_1', 'e', 2),
        ...artifact('org_1', 'trip_1', 'f', 1),
      },
      { pageSize: 2 },
    )

    const pruned = await pruneExportArtifacts(bucket, 'org_1', 'trip_1', {
      now: NOW,
    })

    expect(pruned).toBe(2)
    expect([...bucket.remaining].sort()).toEqual(
      ['b', 'c', 'd', 'e', 'f'].map((id) => `exports/org_1/trip_1/${id}.html`),
    )
  })

  it('deletes a lone PDF whose page never arrived once it is older than the TTL, and not before', async () => {
    const bucket = fakeBucket({
      [exportObjectKey('org_1', 'trip_1', 'orphan', 'pdf')]: aged(8),
      [exportObjectKey('org_1', 'trip_1', 'running', 'pdf')]: aged(0.1),
    })

    await pruneExportArtifacts(bucket, 'org_1', 'trip_1', { now: NOW })

    expect([...bucket.remaining]).toEqual(['exports/org_1/trip_1/running.pdf'])
  })

  it('does not count a running job against the five, nor delete it', async () => {
    const bucket = fakeBucket({
      ...artifact('org_1', 'trip_1', 'a', 5),
      ...artifact('org_1', 'trip_1', 'b', 4),
      ...artifact('org_1', 'trip_1', 'c', 3),
      ...artifact('org_1', 'trip_1', 'd', 2),
      ...artifact('org_1', 'trip_1', 'e', 1),
      [exportObjectKey('org_1', 'trip_1', 'running', 'pdf')]: aged(0.01),
    })

    expect(
      await pruneExportArtifacts(bucket, 'org_1', 'trip_1', { now: NOW }),
    ).toBe(0)
  })

  it('neither lists nor deletes a name that does not parse', async () => {
    const bucket = fakeBucket({
      'exports/org_1/trip_1/readme.txt': aged(30),
      ...artifact('org_1', 'trip_1', 'stale', 30),
    })

    await pruneExportArtifacts(bucket, 'org_1', 'trip_1', { now: NOW })

    expect([...bucket.remaining]).toEqual(['exports/org_1/trip_1/readme.txt'])
  })

  it('touches nothing outside the one organization-and-trip prefix', async () => {
    const stale = { ...artifact('org_1', 'trip_1', 'stale', 30, { pdf: true }) }
    const neighbours = {
      // The same trip id in another organization, a trip whose id merely starts the same, and the
      // same task id one directory over.
      ...artifact('org_2', 'trip_1', 'stale', 30, { pdf: true }),
      ...artifact('org_1', 'trip_12', 'stale', 30),
      ...artifact('org_1', 'trip_2', 'stale', 30),
    }
    const bucket = fakeBucket({ ...stale, ...neighbours }, { pageSize: 2 })

    await pruneExportArtifacts(bucket, 'org_1', 'trip_1', { now: NOW })

    expect([...bucket.remaining].sort()).toEqual(Object.keys(neighbours).sort())
    expect(await listExportKeys(bucket, 'org_2', 'trip_1')).toHaveLength(2)
  })
})
