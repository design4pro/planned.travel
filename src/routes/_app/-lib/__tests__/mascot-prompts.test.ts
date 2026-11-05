import { describe, expect, it } from 'vitest'
import { selectMascotPrompt } from '#/lib/mascot-prompts'

describe('selectMascotPrompt', () => {
  const nowMs = Date.parse('2024-12-31T12:00:00Z')
  const input = { today: '2024-12-31', nowMs, dismissed: [] }
  it('prioritizes today, then actions, then future schedules and other notifications', () => {
    const candidates = [
      {
        source: 'notification' as const,
        id: 'n',
        occurrence: '2024-12-31T10:00:00Z',
        action: false,
      },
      {
        source: 'reservation' as const,
        id: 'r',
        tripId: 't',
        occurrence: '2025-01-01',
      },
      {
        source: 'notification' as const,
        id: 'a',
        occurrence: '2024-12-31T11:00:00Z',
        action: true,
      },
      {
        source: 'event' as const,
        id: 'e',
        tripId: 't',
        occurrence: '2024-12-31',
      },
    ]
    expect(selectMascotPrompt({ ...input, candidates })?.id).toBe('e')
    expect(
      selectMascotPrompt({ ...input, candidates: candidates.slice(0, 3) })?.id,
    ).toBe('a')
    expect(
      selectMascotPrompt({ ...input, candidates: candidates.slice(0, 2) })?.id,
    ).toBe('r')
  })
  it('enforces exact notification boundaries and deterministic ties', () => {
    const candidates = [
      {
        source: 'notification' as const,
        id: 'b',
        occurrence: '2024-12-24T12:00:00Z',
        action: false,
      },
      {
        source: 'notification' as const,
        id: 'a',
        occurrence: '2024-12-24T12:00:00Z',
        action: false,
      },
      {
        source: 'notification' as const,
        id: 'old',
        occurrence: '2024-12-24T11:59:59Z',
        action: true,
      },
      {
        source: 'notification' as const,
        id: 'future',
        occurrence: '2024-12-31T12:00:01Z',
        action: true,
      },
    ]
    expect(selectMascotPrompt({ ...input, candidates })?.id).toBe('a')
  })
  it('uses local days for explicit instants and rejects expired instants', () => {
    const candidates = [
      {
        source: 'event' as const,
        id: 'expired',
        tripId: 't',
        occurrence: '2024-12-31',
        instant: '2024-12-31T11:59:59Z',
        zone: 'America/New_York',
      },
      {
        source: 'event' as const,
        id: 'valid',
        tripId: 't',
        occurrence: '2025-01-01',
        instant: '2025-01-01T04:00:00Z',
        zone: 'America/New_York',
      },
    ]
    expect(selectMascotPrompt({ ...input, candidates })?.id).toBe('valid')
  })
})

it('handles leap days, exact now, DST transitions and zone fallback', () => {
  const candidate = {
    source: 'event' as const,
    id: 'e',
    tripId: 't',
    occurrence: '2024-02-29',
  }
  const base = {
    today: '2024-02-22',
    nowMs: Date.parse('2024-02-22T00:00:00Z'),
    dismissed: [],
  }
  expect(selectMascotPrompt({ ...base, candidates: [candidate] })).toEqual(
    candidate,
  )
  expect(
    selectMascotPrompt({
      ...base,
      candidates: [{ ...candidate, occurrence: '2024-03-01' }],
    }),
  ).toBeNull()
  const nowMs = Date.parse('2024-03-10T07:00:00Z')
  const spring = {
    ...candidate,
    occurrence: '2024-03-10',
    instant: '2024-03-10T07:00:00Z',
    zone: 'America/New_York',
  }
  expect(
    selectMascotPrompt({
      today: '2024-03-10',
      nowMs,
      dismissed: [],
      candidates: [spring],
    }),
  ).toEqual(spring)
  const fold = {
    ...spring,
    occurrence: '2024-11-03',
    instant: '2024-11-03T06:30:00Z',
  }
  expect(
    selectMascotPrompt({
      today: '2024-11-03',
      nowMs: Date.parse('2024-11-03T05:45:00Z'),
      dismissed: [],
      candidates: [fold],
    }),
  ).toEqual(fold)
  const fallback = {
    ...spring,
    instant: '2024-03-10T01:00:00',
    zone: 'not/a-zone',
  }
  expect(
    selectMascotPrompt({
      today: '2024-03-10',
      nowMs,
      dismissed: [],
      candidates: [fallback],
    }),
  ).toEqual(fallback)
})
