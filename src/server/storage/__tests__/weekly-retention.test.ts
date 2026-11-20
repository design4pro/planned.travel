import { describe, expect, it, vi } from 'vitest'
import { EXPORT_TTL_SECONDS } from '../export-artifacts'
import { pruneWeeklyObjects } from '../weekly-retention'

const now = Date.UTC(2026, 10, 20)
const boundary = now - EXPORT_TTL_SECONDS * 1000

function fixture(entries: Array<[string, number]>) {
  const objects = new Map(entries)
  const positions = new Map<string, string>()
  const bucket = {
    list: vi.fn(
      async ({
        prefix,
        startAfter = '',
        limit,
      }: {
        prefix: string
        startAfter?: string
        limit: number
      }) => {
        const keys = [...objects.keys()]
          .sort()
          .filter((key) => key.startsWith(prefix) && key > startAfter)
        return {
          truncated: keys.length > limit,
          objects: keys.slice(0, limit).map((key) => ({
            key,
            size: 1,
            uploaded: new Date(objects.get(key)!),
          })),
        }
      },
    ),
    delete: vi.fn(async (keys: string | Array<string>) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key)
    }),
  }
  const checkpoints = {
    get: vi.fn(async (key: string) => positions.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      positions.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      positions.delete(key)
    }),
  }
  const ownership = {
    organizationExists: vi.fn(async (org: string) => org === 'org'),
    hasUploadReference: vi.fn(
      async (_org: string, trip: string, key: string) =>
        trip === 'live-trip' || key.endsWith('/live-file'),
    ),
  }
  const logger = { info: vi.fn() }
  return { objects, positions, bucket, checkpoints, ownership, logger, now }
}

describe('weekly object retention', () => {
  it('prunes only expired, well-formed export objects of existing organizations', async () => {
    const state = fixture([
      ['exports/org/trip/incomplete.pdf', boundary - 1],
      ['exports/org/trip/exact.html', boundary],
      ['exports/org/trip/fresh.pdf', boundary + 1],
      ['exports/org-lookalike/trip/foreign.html', boundary - 1],
      ['exports/org/trip/nested/invalid.html', boundary - 1],
      ['exports/org/trip/.pdf', boundary - 1],
      ['exports/org/ trip/invalid.pdf', boundary - 1],
      ['exports/org /trip/invalid.pdf', boundary - 1],
      ['trips/org/trip/upload', boundary - 1],
    ])
    expect(await pruneWeeklyObjects('exports', state)).toEqual({
      inspected: 8,
      skipped: 7,
      deleted: 1,
      remaining: false,
    })
    expect(state.bucket.delete).toHaveBeenCalledWith([
      'exports/org/trip/incomplete.pdf',
    ])
  })

  it('checks upload references and ownership again before deleting an old orphan', async () => {
    const state = fixture([
      ['trips/org/gone/old', boundary],
      ['trips/org/gone/live-file', boundary - 1],
      ['trips/org/live-trip/copied-cover', boundary - 1],
      ['trips/org/gone/fresh', boundary + 1],
      ['trips/missing/gone/old', boundary - 1],
      ['trips/org/gone/raced', boundary - 1],
    ])
    let raced = false
    state.ownership.hasUploadReference.mockImplementation(
      async (_org, trip, key) => {
        if (key.endsWith('/raced')) {
          const found = raced
          raced = true
          return found
        }
        return trip === 'live-trip' || key.endsWith('/live-file')
      },
    )
    await pruneWeeklyObjects('trips', state)
    expect(state.bucket.delete).toHaveBeenCalledExactlyOnceWith([
      'trips/org/gone/old',
    ])
    expect(
      state.ownership.hasUploadReference.mock.calls.filter(([, , key]) =>
        key.endsWith('/old'),
      ),
    ).toHaveLength(2)
  })

  it('resumes beyond retained pages and retries a page after a deletion failure', async () => {
    const retained = Array.from(
      { length: 100 },
      (_, index): [string, number] => [
        `exports/org/trip/a${String(index).padStart(3, '0')}.html`,
        now,
      ],
    )
    const state = fixture([
      ...retained,
      ['exports/org/trip/z.pdf', boundary - 1],
    ])
    expect((await pruneWeeklyObjects('exports', state)).remaining).toBe(true)
    expect(state.bucket.list).toHaveBeenCalledTimes(10)
    const checkpoint = [...state.positions.values()]
    state.bucket.delete.mockRejectedValueOnce(new Error('delete unavailable'))
    await expect(pruneWeeklyObjects('exports', state)).rejects.toThrow(
      'delete unavailable',
    )
    expect([...state.positions.values()]).toEqual(checkpoint)
    expect((await pruneWeeklyObjects('exports', state)).remaining).toBe(false)
    expect(state.positions.size).toBe(0)
    expect(state.objects.size).toBe(retained.length)
  })

  it('fails closed if the final database check fails', async () => {
    const state = fixture([['trips/org/gone/old', boundary - 1]])
    state.ownership.hasUploadReference
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('D1 unavailable'))
    await expect(pruneWeeklyObjects('trips', state)).rejects.toThrow(
      'D1 unavailable',
    )
    expect(state.bucket.delete).not.toHaveBeenCalled()
    expect(state.positions.size).toBe(0)
  })
})
