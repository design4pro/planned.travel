import { describe, expect, it } from 'vitest'
import { mergeMascotScheduled } from '#/server/repos/mascot-scheduled'
import { loadMascotCandidates } from '../dashboard-mascot'

describe('loadMascotCandidates', () => {
  it('preserves working families when another fails', async () => {
    const event = { id: 'event', tripId: 'trip', occurrence: '2026-01-08' }
    const result = await loadMascotCandidates({
      notifications: async () => {
        throw new Error('unavailable')
      },
      scheduled: async () => ({
        candidates: [{ ...event, source: 'event' }],
        partial: false,
      }),
    })
    expect(result).toEqual({
      candidates: [{ ...event, source: 'event' }],
      partial: true,
    })
  })
  it('reports a scheduled-family failure without dropping the other result', async () => {
    const event = { id: 'e', tripId: 't', occurrence: '2026-01-08' }
    const scheduled = await mergeMascotScheduled(
      async () => {
        throw new Error('unavailable')
      },
      async () => [event],
    )
    const result = await loadMascotCandidates({
      notifications: async () => [],
      scheduled: async () => ({
        ...scheduled,
        candidates: scheduled.candidates.flatMap((row) =>
          row.occurrence === null
            ? []
            : [{ ...row, occurrence: row.occurrence }],
        ),
      }),
    })
    expect(result).toEqual({
      candidates: [{ ...event, source: 'event' }],
      partial: true,
    })
  })
  it('bounds the merged scheduled candidates after ordering', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `r${String(i).padStart(2, '0')}`,
      tripId: 't',
      occurrence: '2026-01-09',
    }))
    const event = { id: 'e', tripId: 't', occurrence: '2026-01-08' }
    const result = await mergeMascotScheduled(
      async () => rows,
      async () => [event],
    )
    expect(result.candidates).toHaveLength(50)
    expect(result.candidates[0]).toEqual({ ...event, source: 'event' })
    expect(result.candidates.some((row) => row.id === 'r49')).toBe(false)
  })
  it('keeps each scheduled family when the other fails', async () => {
    const event = { id: 'e', tripId: 't', occurrence: '2026-01-08' }
    const booking = { id: 'r', tripId: 't', occurrence: '2026-01-08' }
    for (const failed of ['reservations', 'events'] as const) {
      const result = await mergeMascotScheduled(
        async () => {
          if (failed === 'reservations') throw new Error('unavailable')
          return [booking]
        },
        async () => {
          if (failed === 'events') throw new Error('unavailable')
          return [event]
        },
      )
      expect(result).toEqual({
        candidates: [
          failed === 'reservations'
            ? { ...event, source: 'event' }
            : { ...booking, source: 'reservation' },
        ],
        partial: true,
      })
    }
  })
})
