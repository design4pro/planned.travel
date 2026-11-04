import { describe, expect, it } from 'vitest'
import {
  dismissOccurrence,
  isDismissed,
  readSuppression,
  clearAllSuppression,
  writeSuppression,
} from '#/lib/mascot-suppression'

describe('dashboard prompt suppression', () => {
  it('expires exactly after 24 hours and treats a changed date as a new occurrence', () => {
    const entries = dismissOccurrence(
      [],
      'reservation',
      'r',
      '2026-11-04',
      1000,
    )
    expect(
      isDismissed(
        entries,
        'reservation',
        'r',
        '2026-11-04',
        1000 + 86_400_000 - 1,
      ),
    ).toBe(true)
    expect(
      isDismissed(entries, 'reservation', 'r', '2026-11-04', 1000 + 86_400_000),
    ).toBe(false)
    expect(isDismissed(entries, 'reservation', 'r', '2026-11-05', 1001)).toBe(
      false,
    )
  })

  it('retains at most fifty occurrences', () => {
    let entries: ReturnType<typeof dismissOccurrence> = []
    for (let i = 0; i < 51; i++)
      entries = dismissOccurrence(
        entries,
        'reservation',
        String(i),
        '2026-11-04',
        i,
      )
    expect(entries).toHaveLength(50)
    expect(isDismissed(entries, 'reservation', '0', '2026-11-04', 51)).toBe(
      false,
    )
  })
  it('isolates scopes and tolerates corrupt or blocked storage', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
      removeItem: (key: string) => {
        data.delete(key)
      },
    }
    const entries = dismissOccurrence(
      [],
      'reservation',
      'r',
      '2026-11-04',
      1000,
    )
    writeSuppression(storage, 'user-a', 'workspace-a', entries)
    expect(readSuppression(storage, 'user-a', 'workspace-a', 1001)).toEqual(
      entries,
    )
    expect(readSuppression(storage, 'user-a', 'workspace-b', 1001)).toEqual([])
    expect(readSuppression(storage, 'user-b', 'workspace-a', 1001)).toEqual([])
    for (const key of data.keys()) data.set(key, '{')
    expect(readSuppression(storage, 'user-a', 'workspace-a', 1001)).toEqual([])
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readSuppression(blocked, 'user-a', 'workspace-a', 1001)).toEqual([])
    expect(() =>
      writeSuppression(blocked, 'user-a', 'workspace-a', entries),
    ).not.toThrow()
  })
  it('clears all workspace scopes on sign out without touching other session data', () => {
    const store = new Map<string, string>()
    const storage = {
      get length() {
        return store.size
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    }
    const entries = dismissOccurrence(
      [],
      'reservation',
      'r',
      '2026-11-04',
      1000,
    )
    writeSuppression(storage, 'user', 'a', entries)
    writeSuppression(storage, 'user', 'b', entries)
    storage.setItem('unrelated', 'keep')
    clearAllSuppression(storage)
    expect([...store.keys()]).toEqual(['unrelated'])
  })
})
