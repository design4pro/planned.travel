import { describe, expect, it } from 'vitest'
import { readPendingExport, writePendingExport } from '../export-pending'

describe('pending export persistence', () => {
  it('restores only the trip and only inside the polling window', () => {
    const entries = new Map<string, string>()
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value)
      },
      removeItem: (key: string) => {
        entries.delete(key)
      },
    }
    writePendingExport(storage, 'trip-a', { taskId: 'task-1', queuedAt: 1000 })
    expect(readPendingExport(storage, 'trip-a', 90_999)).toEqual({
      taskId: 'task-1',
      queuedAt: 1000,
    })
    expect(readPendingExport(storage, 'trip-b', 2000)).toBeNull()
    expect(readPendingExport(storage, 'trip-a', 91_000)).toBeNull()
    expect(readPendingExport(storage, 'trip-a', 1001)).toBeNull()
  })
  it('tolerates unavailable storage and damaged or future entries', () => {
    for (const value of [
      '{',
      '{}',
      '{"taskId":"../x","queuedAt":0}',
      '{"taskId":"task","queuedAt":9999}',
    ]) {
      const storage = { getItem: () => value, removeItem: () => {} }
      expect(readPendingExport(storage, 'trip', 1000)).toBeNull()
    }
    const storage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(readPendingExport(storage, 'trip', 0)).toBeNull()
    expect(() => writePendingExport(storage, 'trip', null)).not.toThrow()
  })
})
