import { afterEach, describe, expect, it, vi } from 'vitest'

import { trustedOrigins } from '../env'

vi.mock('cloudflare:workers', () => ({
  env: { APP_URL: 'https://planned.travel' },
}))

/**
 * The dev port wildcards reach the WebAuthn origin check as well as the CSRF one, so the only
 * thing between a production sign-in and "any loopback port" is this list. It is pinned here.
 */
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('trustedOrigins', () => {
  it('is the configured origin and nothing else outside development', () => {
    vi.stubEnv('DEV', false)

    expect(trustedOrigins()).toEqual(['https://planned.travel'])
  })

  it('adds the loopback port wildcards in development', () => {
    vi.stubEnv('DEV', true)

    expect(trustedOrigins()).toEqual([
      'https://planned.travel',
      'http://localhost:*',
      'http://127.0.0.1:*',
    ])
  })
})
