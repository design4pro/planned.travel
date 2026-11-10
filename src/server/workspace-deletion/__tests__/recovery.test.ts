import { expect, it } from 'vitest'
import { recoverWorkspaceDeletions } from '../recovery'

it('recovers five stale deletions directly without a queue and isolates a failed row', async () => {
  const now = new Date('2026-11-09T00:00:00Z')
  const advanced: Array<string> = []
  const stuck: Array<string> = []
  const rows = Array.from({ length: 8 }, (_, index) => ({
    id: `deletion-${index}`,
    state: 'requested' as const,
    requestedAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-08T23:44:59Z'),
  }))
  const results = await recoverWorkspaceDeletions({
    now: () => now,
    listStale: async () => rows,
    advance: async (id) => {
      advanced.push(id)
      if (id === 'deletion-0') throw new Error('provider unavailable')
    },
    stuck: (id) => {
      stuck.push(id)
    },
  })
  expect(advanced).toEqual([
    'deletion-0',
    'deletion-1',
    'deletion-2',
    'deletion-3',
    'deletion-4',
  ])
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(4)
  expect(stuck).toEqual(advanced)
})

it('leaves terminal rows and the exact fifteen-minute boundary untouched', async () => {
  const now = new Date('2026-11-09T00:00:00Z')
  const touched: Array<string> = []
  const fields = {
    requestedAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-08T23:45:00Z'),
  }
  await recoverWorkspaceDeletions({
    now: () => now,
    listStale: async () => [
      { ...fields, id: 'recent', state: 'requested' },
      { ...fields, updatedAt: fields.requestedAt, id: 'done', state: 'done' },
      {
        ...fields,
        updatedAt: fields.requestedAt,
        id: 'refused',
        state: 'refused',
      },
    ],
    advance: async (id) => {
      touched.push(id)
    },
    stuck: (id) => {
      touched.push(id)
    },
  })
  expect(touched).toEqual([])
})
