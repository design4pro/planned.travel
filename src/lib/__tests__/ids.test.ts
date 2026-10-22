import { afterEach, describe, expect, it, vi } from 'vitest'

import { ID_RANDOM_LENGTH, ID_TIME_LENGTH, mintId } from '../ids'

describe('the time-sortable id generator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a 9-character base-36 time prefix and 16 URL-safe random characters', () => {
    const id = mintId()

    expect(id).toHaveLength(ID_TIME_LENGTH + ID_RANDOM_LENGTH)
    expect(id).toMatch(/^[0-9a-z]{9}[A-Za-z0-9_-]{16}$/)
  })

  it('exports the two lengths the shape is built from', () => {
    expect(ID_TIME_LENGTH).toBe(9)
    expect(ID_RANDOM_LENGTH).toBe(16)
  })

  it('prefixes the id with the current millisecond in base 36', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'))

    expect(mintId().slice(0, ID_TIME_LENGTH)).toBe(
      Date.now().toString(36).padStart(ID_TIME_LENGTH, '0'),
    )
  })

  it('sorts ids minted in increasing milliseconds in creation order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'))
    const minted: Array<string> = []
    for (let i = 0; i < 20; i += 1) {
      minted.push(mintId())
      vi.advanceTimersByTime(1)
    }

    expect([...minted].sort()).toEqual(minted)
  })

  it('pads the time prefix to nine characters for an early instant', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1))

    expect(mintId().slice(0, ID_TIME_LENGTH)).toBe('000000001')
  })
})
