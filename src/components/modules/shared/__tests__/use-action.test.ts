/**
 * What a reader is told when a write fails.
 *
 * `messageOf` is the client half of the redaction boundary `src/server/errors/middleware.ts` opens:
 * every server-function failure crosses the wire as an envelope, never as the thrown value, so a
 * caller that reads `error.message` directly renders `planned-travel/failure/1 {…}` at the reader.
 * That is the regression these cases exist to catch — three screens now depend on this function
 * being the only thing between an envelope and an `Alert`.
 */

import { describe, expect, it } from 'vitest'

import { encodePublicFailure } from '#/lib/errors'
import { messageOf } from '../use-action'

const FALLBACK = 'Try again in a moment.'

describe('messageOf', () => {
  it('shows authored copy a refusal carries', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'refusal',
        message: 'This account is suspended.',
      }),
    )

    expect(messageOf(cause, FALLBACK)).toBe('This account is suspended.')
  })

  it('shows the sentence a validation failure names the field with', () => {
    const cause = new Error(
      encodePublicFailure({
        kind: 'validation',
        message: 'The return date cannot be before the departure date.',
      }),
    )

    expect(messageOf(cause, FALLBACK)).toBe(
      'The return date cannot be before the departure date.',
    )
  })

  it('withholds a diagnostic, and never renders the envelope carrying it', () => {
    const cause = new Error(
      encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
    )

    expect(messageOf(cause, FALLBACK)).toBe(FALLBACK)
    expect(messageOf(cause, FALLBACK)).not.toContain('planned-travel/failure')
  })

  it('keeps a client-side throw, which never crossed the boundary', () => {
    expect(messageOf(new Error('Pick a date first.'), FALLBACK)).toBe(
      'Pick a date first.',
    )
    expect(messageOf('Pick a date first.', FALLBACK)).toBe('Pick a date first.')
  })

  it('falls back on anything with nothing to say', () => {
    expect(messageOf(new Error(''), FALLBACK)).toBe(FALLBACK)
    expect(messageOf('', FALLBACK)).toBe(FALLBACK)
    expect(messageOf(undefined, FALLBACK)).toBe(FALLBACK)
    expect(messageOf({ message: 'not an Error' }, FALLBACK)).toBe(FALLBACK)
  })
})
