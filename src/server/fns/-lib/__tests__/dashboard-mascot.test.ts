import { describe, expect, it } from 'vitest'
import { loadMascotCandidates } from '../dashboard-mascot'

describe('loadMascotCandidates', () => {
  it('preserves working families when another fails', async () => {
    const result = await loadMascotCandidates({
      notifications: async () => {
        throw new Error('unavailable')
      },
      scheduled: async () => [
        {
          source: 'event',
          id: 'event',
          tripId: 'trip',
          occurrence: '2026-01-08',
        },
      ],
    })
    expect(result).toEqual({
      candidates: [
        {
          source: 'event',
          id: 'event',
          tripId: 'trip',
          occurrence: '2026-01-08',
        },
      ],
      partial: true,
    })
  })
})
