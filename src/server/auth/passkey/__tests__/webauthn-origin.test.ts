import { describe, expect, it } from 'vitest'
import { WebAuthnError, assertClientData } from '../webauthn'

/**
 * The origin check of a ceremony. `trustedOrigins()` (`src/server/auth/env.ts`) writes the dev
 * loopback origins as `scheme://host:*`, because `vite dev` moves to the next free port; the
 * check has to read that form, or every passkey ceremony on a port other than `APP_URL`'s fails.
 */
const CHALLENGE = 'challenge-value'

function check(origin: string, origins: ReadonlyArray<string>): void {
  assertClientData(
    {
      type: 'webauthn.create',
      challenge: CHALLENGE,
      origin,
      crossOrigin: false,
    },
    { type: 'webauthn.create', challenge: CHALLENGE, origins },
  )
}

describe('assertClientData origin', () => {
  it('accepts an exact entry and nothing else of the same host', () => {
    expect(() =>
      check('https://planned.travel', ['https://planned.travel']),
    ).not.toThrow()
    expect(() =>
      check('https://planned.travel:8443', ['https://planned.travel']),
    ).toThrow(WebAuthnError)
  })

  it('lets a port wildcard match the same scheme and host on any port', () => {
    const dev = ['http://localhost:3000', 'http://localhost:*']
    expect(() => check('http://localhost:3030', dev)).not.toThrow()
    expect(() =>
      check('http://localhost:5173', ['http://localhost:*']),
    ).not.toThrow()
  })

  it('does not let a wildcard match another host', () => {
    expect(() =>
      check('http://127.0.0.1:3030', ['http://localhost:*']),
    ).toThrow(WebAuthnError)
    expect(() =>
      check('http://example.com:3030', ['http://localhost:*']),
    ).toThrow(WebAuthnError)
  })

  it('does not let a wildcard match a host that only starts with the same name', () => {
    expect(() =>
      check('http://localhost.evil.com:3030', ['http://localhost:*']),
    ).toThrow(WebAuthnError)
    expect(() =>
      check('http://localhost:3030@evil.com', ['http://localhost:*']),
    ).toThrow(WebAuthnError)
  })

  it('does not let a wildcard match another scheme', () => {
    expect(() =>
      check('https://localhost:3030', ['http://localhost:*']),
    ).toThrow(WebAuthnError)
  })

  it('rejects a client origin that is not a URL', () => {
    expect(() => check('not an origin', ['http://localhost:*'])).toThrow(
      WebAuthnError,
    )
  })

  it('treats a wildcard anywhere but the port as a literal string', () => {
    expect(() => check('http://localhost:3030', ['http://*:3030'])).toThrow(
      WebAuthnError,
    )
  })
})
