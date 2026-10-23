import { isNotFound } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { ABSENT, requireFound } from '../absence'

describe('requireFound', () => {
  it('throws the router not-found for an absent result', () => {
    let thrown: unknown
    try {
      requireFound(ABSENT)
    } catch (cause) {
      thrown = cause
    }
    expect(isNotFound(thrown)).toBe(true)
  })

  it('hands back a found payload untouched', () => {
    const payload = { found: true, title: 'Kyoto' } as const
    expect(requireFound(payload)).toBe(payload)
  })

  it('lets a payload from a server that predates the flag through', () => {
    const legacy: { found: boolean } = JSON.parse('{"title":"Kyoto"}')
    expect(() => requireFound(legacy)).not.toThrow()
  })
})
