import { act, render, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  defineKeyedPreference,
  definePreference,
  useKeyedPreference,
  useLocalPreference,
} from '../local-preference'

/** A guard of the shape every caller writes: unknown in, `undefined` on refusal. */
function parseColour(raw: string): 'red' | 'blue' | undefined {
  const value: unknown = JSON.parse(raw)
  return value === 'red' || value === 'blue' ? value : undefined
}

/**
 * `window` here is typed against the Worker global scope this repository also
 * declares, whose event map has no `storage` — so the event name is compared as
 * the string it is rather than through the overload's union.
 */
function storageListener(call: ReadonlyArray<unknown>): boolean {
  return String(call[0]) === 'storage'
}

function colourPreference(area: 'local' | 'session' = 'local') {
  return definePreference<'red' | 'blue'>({
    key: 'planned.test-colour',
    area,
    fallback: 'red',
    parse: parseColour,
  })
}

function keyedColourPreference(limit = 2, area: 'local' | 'session' = 'local') {
  return defineKeyedPreference<'red' | 'blue'>({
    key: 'planned.test-keyed-colour',
    area,
    limit,
    fallback: 'red',
    parse: parseColour,
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('definePreference', () => {
  it('reads the fallback when nothing is stored', () => {
    expect(colourPreference().read()).toBe('red')
  })

  it('round-trips a written value', () => {
    const pref = colourPreference()
    pref.write('blue')
    expect(pref.read()).toBe('blue')
    // A second instance of the same declaration sees the same store: the value
    // lives in the browser, not in the closure.
    expect(colourPreference().read()).toBe('blue')
  })

  it('reads the fallback when the stored value fails the caller guard', () => {
    window.localStorage.setItem('planned.test-colour', JSON.stringify('green'))
    expect(colourPreference().read()).toBe('red')
  })

  it('reads the fallback when the stored value is not JSON at all', () => {
    window.localStorage.setItem('planned.test-colour', 'not json{')
    expect(colourPreference().read()).toBe('red')
  })

  it('returns the fallback rather than rethrowing when getItem throws', () => {
    const pref = colourPreference()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is unavailable')
    })
    expect(() => pref.read()).not.toThrow()
    expect(pref.read()).toBe('red')
  })

  it('swallows a setItem that throws', () => {
    const pref = colourPreference()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => pref.write('blue')).not.toThrow()
  })

  it('notifies its own subscribers on write, and stops on unsubscribe', () => {
    const pref = colourPreference()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    pref.write('blue')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    pref.write('red')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('the storage area', () => {
  it('writes a local preference to localStorage and to nothing else', () => {
    const pref = colourPreference('local')
    pref.write('blue')

    expect(window.localStorage.getItem('planned.test-colour')).not.toBeNull()
    expect(window.sessionStorage.getItem('planned.test-colour')).toBeNull()

    window.sessionStorage.clear()
    expect(pref.read()).toBe('blue')
  })

  it('writes a session preference to sessionStorage and leaves localStorage untouched', () => {
    const pref = colourPreference('session')
    pref.write('blue')

    expect(window.sessionStorage.getItem('planned.test-colour')).not.toBeNull()
    expect(window.localStorage.getItem('planned.test-colour')).toBeNull()
    expect(pref.read()).toBe('blue')
  })

  it('updates a local subscriber when another tab writes the watched key', () => {
    const pref = colourPreference('local')
    const listener = vi.fn()
    pref.subscribe(listener)

    window.localStorage.setItem('planned.test-colour', JSON.stringify('blue'))
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'planned.test-colour',
        newValue: JSON.stringify('blue'),
        storageArea: window.localStorage,
      }),
    )

    expect(listener).toHaveBeenCalledTimes(1)
    expect(pref.read()).toBe('blue')
  })

  it('ignores a storage event for another key', () => {
    const pref = colourPreference('local')
    const listener = vi.fn()
    pref.subscribe(listener)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'planned.something-else',
        newValue: 'x',
        storageArea: window.localStorage,
      }),
    )

    expect(listener).not.toHaveBeenCalled()
  })

  it('attaches no storage listener for a session preference', () => {
    const added = vi.spyOn(window, 'addEventListener')

    const session = colourPreference('session')
    const stopSession = session.subscribe(() => {})
    expect(
      added.mock.calls.filter((call) => storageListener(call)),
    ).toHaveLength(0)
    stopSession()

    const local = colourPreference('local')
    const stopLocal = local.subscribe(() => {})
    expect(
      added.mock.calls.filter((call) => storageListener(call)),
    ).toHaveLength(1)
    stopLocal()
  })

  it('attaches one storage listener however many subscribers a local preference has', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const pref = colourPreference('local')

    const first = pref.subscribe(() => {})
    const second = pref.subscribe(() => {})
    expect(
      added.mock.calls.filter((call) => storageListener(call)),
    ).toHaveLength(1)

    first()
    expect(
      removed.mock.calls.filter((call) => storageListener(call)),
    ).toHaveLength(0)
    second()
    expect(
      removed.mock.calls.filter((call) => storageListener(call)),
    ).toHaveLength(1)
  })
})

describe('defineKeyedPreference', () => {
  it('reads the fallback for an owner it has never seen', () => {
    expect(keyedColourPreference().read('trip-1')).toBe('red')
  })

  it('keeps one value per owner under one key', () => {
    const pref = keyedColourPreference()
    pref.write('trip-1', 'blue')
    pref.write('trip-2', 'red')

    expect(pref.read('trip-1')).toBe('blue')
    expect(pref.read('trip-2')).toBe('red')
    expect(window.localStorage.length).toBe(1)
  })

  it('discards the whole record when the version stamp is not the current one', () => {
    window.localStorage.setItem(
      'planned.test-keyed-colour',
      JSON.stringify({ v: 99, entries: [['trip-1', 'blue']] }),
    )
    expect(keyedColourPreference().read('trip-1')).toBe('red')
  })

  it('discards a record that is not the shape it wrote', () => {
    window.localStorage.setItem(
      'planned.test-keyed-colour',
      JSON.stringify(['trip-1', 'blue']),
    )
    expect(keyedColourPreference().read('trip-1')).toBe('red')
  })

  it('drops the least-recently-touched entry past the limit, never the one just written', () => {
    const pref = keyedColourPreference(2)
    pref.write('trip-1', 'blue')
    pref.write('trip-2', 'blue')
    pref.write('trip-3', 'blue')

    expect(pref.read('trip-3')).toBe('blue')
    expect(pref.read('trip-2')).toBe('blue')
    // `trip-1` was the least recently touched, so it is the one that went.
    expect(pref.read('trip-1')).toBe('red')
  })

  it('reorders an existing owner without growing the record', () => {
    const pref = keyedColourPreference(2)
    pref.write('trip-1', 'blue')
    pref.write('trip-2', 'blue')
    pref.write('trip-1', 'red')
    pref.write('trip-3', 'blue')

    // `trip-1` was touched last of the two, so `trip-2` is what the limit drops.
    expect(pref.read('trip-1')).toBe('red')
    expect(pref.read('trip-3')).toBe('blue')
    expect(pref.read('trip-2')).toBe('red')
  })

  it('reads the fallback for an owner whose value fails the caller guard', () => {
    window.localStorage.setItem(
      'planned.test-keyed-colour',
      JSON.stringify({ v: 1, entries: [['trip-1', 'green']] }),
    )
    expect(keyedColourPreference().read('trip-1')).toBe('red')
  })

  it('returns the fallback rather than rethrowing when getItem throws', () => {
    const pref = keyedColourPreference()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is unavailable')
    })
    expect(pref.read('trip-1')).toBe('red')
  })

  it('notifies its own subscribers on write', () => {
    const pref = keyedColourPreference()
    const listener = vi.fn()
    const unsubscribe = pref.subscribe(listener)

    pref.write('trip-1', 'blue')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    pref.write('trip-1', 'red')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('useLocalPreference', () => {
  it('renders the stored value and re-renders on a write', () => {
    const pref = colourPreference('local')
    pref.write('blue')

    const { result } = renderHook(() => useLocalPreference(pref))
    expect(result.current[0]).toBe('blue')

    act(() => {
      result.current[1]('red')
    })
    expect(result.current[0]).toBe('red')
    expect(pref.read()).toBe('red')
  })

  it('re-renders when another tab writes the key', () => {
    const pref = colourPreference('local')
    const { result } = renderHook(() => useLocalPreference(pref))
    expect(result.current[0]).toBe('red')

    act(() => {
      window.localStorage.setItem('planned.test-colour', JSON.stringify('blue'))
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'planned.test-colour',
          newValue: JSON.stringify('blue'),
          storageArea: window.localStorage,
        }),
      )
    })
    expect(result.current[0]).toBe('blue')
  })

  it('renders the fallback on the server however full the store is', () => {
    const pref = colourPreference('local')
    pref.write('blue')

    function Probe() {
      const [colour] = useLocalPreference(pref)
      return createElement('output', null, colour)
    }

    expect(renderToString(createElement(Probe))).toContain('red')
  })
})

describe('useKeyedPreference', () => {
  it('renders one owner and re-renders that owner alone on a write', () => {
    const pref = keyedColourPreference(4)
    pref.write('trip-1', 'blue')

    const { result } = renderHook(() => useKeyedPreference(pref, 'trip-1'))
    expect(result.current[0]).toBe('blue')

    act(() => {
      result.current[1]('red')
    })
    expect(result.current[0]).toBe('red')
    expect(pref.read('trip-1')).toBe('red')
  })

  it('follows the owner id it is given', () => {
    const pref = keyedColourPreference(4)
    pref.write('trip-1', 'blue')

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useKeyedPreference(pref, id),
      { initialProps: { id: 'trip-1' } },
    )
    expect(result.current[0]).toBe('blue')

    rerender({ id: 'trip-2' })
    expect(result.current[0]).toBe('red')
  })

  it('renders the fallback on the server however full the store is', () => {
    const pref = keyedColourPreference(4)
    pref.write('trip-1', 'blue')

    function Probe() {
      const [colour] = useKeyedPreference(pref, 'trip-1')
      return createElement('output', null, colour)
    }

    expect(renderToString(createElement(Probe))).toContain('red')
  })

  it('leaves the store alone until something is written', () => {
    const pref = keyedColourPreference(4)
    render(createElement(KeyedProbe, { pref }))
    expect(window.localStorage.getItem('planned.test-keyed-colour')).toBeNull()
  })
})

function KeyedProbe({
  pref,
}: {
  pref: ReturnType<typeof keyedColourPreference>
}) {
  const [colour] = useKeyedPreference(pref, 'trip-1')
  return createElement('output', null, colour)
}
