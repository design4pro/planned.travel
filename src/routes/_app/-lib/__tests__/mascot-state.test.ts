import { describe, expect, it } from 'vitest'
import {
  mascotBand,
  projectMascotReservations,
  selectReservationPrompt,
} from '../mascot-state'

describe('selectReservationPrompt', () => {
  const scope = { userId: 'u', workspaceId: 'a' }
  const trips = [
    { id: 'readable', isArchived: false },
    { id: 'archived', isArchived: true },
  ]
  const reservation = {
    id: 'r',
    tripId: 'readable',
    status: 'confirmed',
    startDate: '2026-11-04',
  }

  it('selects only confirmed reservations on a readable, non-archived trip within seven days', () => {
    expect(
      selectReservationPrompt({
        today: '2026-11-04',
        currentScope: scope,
        dismissedScope: scope,
        dismissed: [],
        nowMs: 0,
        trips,
        reservations: [
          { ...reservation, id: 'private', tripId: 'private' },
          { ...reservation, id: 'archived', tripId: 'archived' },
          { ...reservation, id: 'pending', status: 'pending' },
          { ...reservation, id: 'late', startDate: '2026-11-12' },
          { ...reservation, id: 'later', startDate: '2026-11-11' },
          reservation,
        ],
      }),
    ).toEqual({ id: 'r', tripId: 'readable', startDate: '2026-11-04' })
  })
  it('projects reservations without private details', () => {
    const row = {
      ...reservation,
      confirmationNumber: 'secret',
      notes: 'private',
      priceMinor: 100,
      url: 'https://example.test',
    }
    expect(projectMascotReservations([row])).toEqual([reservation])
  })

  it('omits a trip if any loaded copy says it was archived', () => {
    expect(
      selectReservationPrompt({
        today: '2026-11-04',
        currentScope: scope,
        dismissedScope: scope,
        nowMs: 0,
        dismissed: [],
        trips: [
          { id: 'readable', isArchived: false },
          { id: 'readable', isArchived: true },
        ],
        reservations: [reservation],
      }),
    ).toBeNull()
  })

  it('allows navigation for a readable non-member without granting a write', () => {
    const selection = selectReservationPrompt({
      today: '2026-11-04',
      currentScope: scope,
      dismissedScope: scope,
      nowMs: 0,
      dismissed: [],
      trips: [
        Object.assign({ id: 'readable', isArchived: false }, { role: null }),
      ],
      reservations: [reservation],
    })
    expect(selection).toEqual({
      id: 'r',
      tripId: 'readable',
      startDate: '2026-11-04',
    })
  })

  it('omits suppressed occurrences but allows the same reservation on a new date', () => {
    const select = (startDate: string) =>
      selectReservationPrompt({
        today: '2026-11-04',
        currentScope: scope,
        dismissedScope: scope,
        trips,
        reservations: [{ ...reservation, startDate }],
        dismissed: [
          {
            source: 'reservation',
            id: 'r',
            occurrence: '2026-11-04',
            expires: 2000,
          },
        ],
        nowMs: 1999,
      })
    expect(select('2026-11-04')).toBeNull()
    expect(select('2026-11-05')?.id).toBe('r')
  })

  it('does not apply another workspace suppression', () => {
    const selection = selectReservationPrompt({
      today: '2026-11-04',
      nowMs: 1000,
      currentScope: { userId: 'u', workspaceId: 'a' },
      dismissedScope: { userId: 'u', workspaceId: 'b' },
      dismissed: [
        {
          source: 'reservation',
          id: 'r',
          occurrence: '2026-11-04',
          expires: 2000,
        },
      ],
      trips,
      reservations: [reservation],
    })
    expect(selection?.id).toBe('r')
  })

  it('handles the inclusive window across leap day and rejects invalid dates', () => {
    const select = (startDate: string) =>
      selectReservationPrompt({
        today: '2024-02-26',
        currentScope: scope,
        dismissedScope: scope,
        dismissed: [],
        nowMs: 0,
        trips,
        reservations: [{ ...reservation, startDate }],
      })
    expect(select('2024-02-25')).toBeNull()
    expect(select('2024-02-29')?.startDate).toBe('2024-02-29')
    expect(select('2024-03-04')?.startDate).toBe('2024-03-04')
    expect(select('2024-03-05')).toBeNull()
    expect(select('2024-02-30')).toBeNull()
  })

  it('breaks ties by binary id regardless of input order', () => {
    const select = (reservations: (typeof reservation)[]) =>
      selectReservationPrompt({
        today: '2026-11-04',
        currentScope: scope,
        dismissedScope: scope,
        dismissed: [],
        nowMs: 0,
        trips,
        reservations,
      })
    const candidates = [
      { ...reservation, id: 'z' },
      { ...reservation, id: 'a' },
    ]
    expect(select(candidates)?.id).toBe('a')
    expect(select(candidates.reverse())?.id).toBe('a')
  })
})

describe('mascotBand', () => {
  it('uses the trip end inclusively and never counts down to zero', () => {
    const band = (
      today: string,
      startDate: string | null,
      endDate: string | null,
    ) => mascotBand({ today, startDate, endDate })
    expect(band('2026-01-01', '2026-02-01', '2026-02-05')).toEqual({
      band: 'settled',
      days: null,
    })
    expect(band('2026-01-02', '2026-02-01', '2026-02-05')).toEqual({
      band: 'eager',
      days: null,
    })
    expect(band('2026-01-25', '2026-02-01', '2026-02-05')).toEqual({
      band: 'countdown',
      days: 7,
    })
    expect(band('2026-02-01', '2026-02-01', '2026-02-05')).toEqual({
      band: 'travelling',
      days: null,
    })
    expect(band('2026-02-05', '2026-02-01', '2026-02-05')).toEqual({
      band: 'travelling',
      days: null,
    })
    expect(band('2026-02-06', '2026-02-01', '2026-02-05')).toEqual({
      band: 'drifting',
      days: null,
    })
    expect(band('2026-01-25', '2026-02-01', null)).toEqual({
      band: 'countdown',
      days: 7,
    })
    expect(band('2026-02-02', '2026-02-01', null)).toEqual({
      band: 'travelling',
      days: null,
    })
    expect(band('2026-02-01', null, null)).toEqual({
      band: 'drifting',
      days: null,
    })
  })
})
