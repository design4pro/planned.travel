import { afterEach, describe, expect, it, vi } from 'vitest'

import * as viewMode from '../view-mode'
import {
  DEFAULT_TRIP_VIEW,
  TRIPS_VIEW_PREFERENCE,
  elapsedFraction,
  withRememberedView,
} from '../view-mode'

/**
 * A browser with one stored value, for a module that runs in Node here. `local-preference.ts`
 * reaches storage only through `window`, so a stubbed `window` is the whole browser it needs.
 */
function storing(raw: string | null): void {
  const store = new Map<string, string>()
  if (raw !== null) {
    store.set(TRIPS_VIEW_PREFERENCE.key, raw)
  }
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the trips-view preference', () => {
  it('names the local area, so the mode outlives the session as TRP-01 asks', () => {
    expect(TRIPS_VIEW_PREFERENCE.key).toBe('planned.trips-view')
    expect(TRIPS_VIEW_PREFERENCE.area).toBe('local')
  })

  it('is the only preference the module declares, so the switch, the skeleton and the seed read one key', () => {
    const declarations = Object.values(viewMode).filter(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        'key' in value &&
        'area' in value,
    )
    expect(declarations).toEqual([TRIPS_VIEW_PREFERENCE])
  })

  it('reads an unknown stored mode as the grid rather than crashing', () => {
    storing(JSON.stringify({ mode: 'mosaic', archiveOpen: true }))
    expect(TRIPS_VIEW_PREFERENCE.read()).toEqual({
      mode: 'grid',
      archiveOpen: true,
    })
  })

  it('reads a record that is not an object, or not JSON, as the fallback', () => {
    storing('"list"')
    expect(TRIPS_VIEW_PREFERENCE.read()).toEqual({
      mode: DEFAULT_TRIP_VIEW,
      archiveOpen: false,
    })
    storing('{not json')
    expect(TRIPS_VIEW_PREFERENCE.read().mode).toBe(DEFAULT_TRIP_VIEW)
  })

  it('reads back what the switch wrote', () => {
    storing(null)
    TRIPS_VIEW_PREFERENCE.write({ mode: 'list', archiveOpen: false })
    expect(TRIPS_VIEW_PREFERENCE.read().mode).toBe('list')
  })
})

describe('withRememberedView', () => {
  it('returns a URL that already carries the mode unchanged, whatever is remembered', () => {
    const search = { view: 'grid' as const, q: 'lisbon' }
    expect(withRememberedView(search, 'list')).toBe(search)
  })

  it('adds the remembered mode to a URL that carries none', () => {
    expect(withRememberedView({ q: 'lisbon' }, 'list')).toEqual({
      q: 'lisbon',
      view: 'list',
    })
  })

  it('leaves a URL alone when the remembered mode is the default it already means', () => {
    const search = { q: 'lisbon' }
    expect(withRememberedView(search, 'grid')).toBe(search)
  })
})

describe('elapsedFraction', () => {
  it('is zero before the start', () => {
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-01')).toBe(0)
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-09')).toBe(0)
  })

  it('is one after the end, and one on the last day', () => {
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-09-01')).toBe(1)
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-19')).toBe(1)
  })

  it('counts day k of an n-day trip as k/n in between', () => {
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-10')).toBe(0.1)
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-14')).toBe(0.5)
  })

  it('is null without both dates, or with an end before the start', () => {
    expect(elapsedFraction(null, '2026-08-19', '2026-08-14')).toBeNull()
    expect(elapsedFraction('2026-08-10', null, '2026-08-14')).toBeNull()
    expect(elapsedFraction('2026-08-19', '2026-08-10', '2026-08-14')).toBeNull()
  })

  it('takes today as an argument and reads no clock', () => {
    expect(elapsedFraction).toHaveLength(3)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    expect(elapsedFraction('2026-08-10', '2026-08-19', '2026-08-14')).toBe(0.5)
  })
})
