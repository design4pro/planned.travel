/**
 * The workspace sweep against a fake bucket: the three key families a workspace owns, the photo keys
 * the caller collected, and the isolation between two workspaces that share leading characters.
 */
import { describe, expect, it } from 'vitest'

import {
  sweepWorkspaceObjects,
  workspaceObjectPrefixes,
} from '../workspace-objects'
import { fakeBucket } from './fake-bucket'

describe('workspaceObjectPrefixes', () => {
  it('names the key families written today, each closed by a slash', () => {
    expect(workspaceObjectPrefixes('org-a')).toEqual([
      'trips/org-a/',
      'exports/org-a/',
      'avatars/org-a/',
    ])
  })

  it.each(['', ' ', 'a/b', '../x', 'a'.repeat(65)])(
    'refuses the id %j',
    (id) => {
      expect(() => workspaceObjectPrefixes(id)).toThrow(/organization id/)
    },
  )
})

describe('sweepWorkspaceObjects', () => {
  it('removes trips, exports, portraits and the supplied photo keys of one workspace', async () => {
    const bucket = fakeBucket([
      'trips/org-a/t1/file-1-map.pdf',
      'trips/org-a/t2/cover.jpg',
      'exports/org-a/t1/job.pdf',
      'exports/org-a/t1/job.html',
      'avatars/org-a/user-1',
      'journeys/org-a/j1/photo.jpg',
      'journeys/org-a/j1/photo.thumb.jpg',
    ])

    const removed = await sweepWorkspaceObjects(bucket, 'org-a', [
      'journeys/org-a/j1/photo.jpg',
      'journeys/org-a/j1/photo.thumb.jpg',
    ])

    expect(removed).toBe(7)
    expect(bucket.remaining.size).toBe(0)
  })

  it('leaves the files of another workspace alone, even one whose id starts the same way', async () => {
    const others = [
      'trips/org-b/t1/file-1-map.pdf',
      'trips/org-ab/t1/file-2-map.pdf',
      'exports/org-ab/t1/job.pdf',
      'avatars/org-ab/user-9',
      'journeys/org-b/j1/photo.jpg',
    ]
    const bucket = fakeBucket([
      'trips/org-a/t1/file-1-map.pdf',
      'exports/org-a/t1/job.pdf',
      'avatars/org-a/user-1',
      ...others,
    ])

    await sweepWorkspaceObjects(bucket, 'org-a')

    expect([...bucket.remaining].sort()).toEqual([...others].sort())
  })

  it('skips supplied foreign and legacy keys from every namespace', async () => {
    const retained = [
      'trips/org-b/t/file',
      'exports/org-ab/t/export',
      'avatars/org-ab/user',
      'journeys/org-ab/photo.jpg',
      'journeys/org-ab/thumb.jpg',
      'demo/journeys/shared.jpg',
      'journeys/org-a',
    ]
    const owned = 'journeys/org-a/photo.jpg'
    const bucket = fakeBucket([owned, ...retained])
    expect(
      await sweepWorkspaceObjects(bucket, 'org-a', [...retained, owned]),
    ).toBe(1)
    expect([...bucket.remaining].sort()).toEqual([...retained].sort())
    expect(bucket.calls.flat()).toEqual([owned])
  })

  it('is repeatable: a second run after a finished one succeeds and deletes nothing', async () => {
    const bucket = fakeBucket([
      'trips/org-a/t1/file-1',
      'exports/org-a/t1/job.pdf',
    ])

    expect(
      await sweepWorkspaceObjects(bucket, 'org-a', ['journeys/org-a/gone.jpg']),
    ).toBe(3)
    expect(
      await sweepWorkspaceObjects(bucket, 'org-a', ['journeys/org-a/gone.jpg']),
    ).toBe(1)
    expect(bucket.remaining.size).toBe(0)
  })

  it('finishes a run that stopped part-way when it is called again', async () => {
    const keys = Array.from(
      { length: 2_500 },
      (_, index) => `trips/org-a/t/${index}`,
    )
    const bucket = fakeBucket([...keys, 'exports/org-a/t/job.pdf'])
    const realDelete = bucket.delete
    let calls = 0
    const flaky: typeof bucket = {
      ...bucket,
      delete: async (batch) => {
        calls += 1
        if (calls === 2) throw new Error('R2 went away')
        return realDelete(batch)
      },
    }

    await expect(sweepWorkspaceObjects(flaky, 'org-a')).rejects.toThrow(
      'R2 went away',
    )
    expect(bucket.remaining.size).toBeGreaterThan(0)

    await sweepWorkspaceObjects(bucket, 'org-a')
    expect(bucket.remaining.size).toBe(0)
  })

  it('deletes at most 1 000 keys in one call', async () => {
    const keys = Array.from(
      { length: 2_200 },
      (_, index) => `trips/org-a/t/${index}`,
    )
    const bucket = fakeBucket(keys, { pageSize: 5_000 })
    const photoKeys = Array.from(
      { length: 1_500 },
      (_, index) => `journeys/org-a/${index}`,
    )

    await sweepWorkspaceObjects(bucket, 'org-a', photoKeys)

    expect(
      Math.max(...bucket.calls.map((call) => call.length)),
    ).toBeLessThanOrEqual(1_000)
    expect(bucket.remaining.size).toBe(0)
  })
})
