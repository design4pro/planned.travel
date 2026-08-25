import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { CONSOLE_ACTION_FALLBACK, readConsoleFailure } from '../failure'

/**
 * The regression test for a console dialog printing `ZodError`'s serialized issue array at an
 * operator. It was measured on the "Set a password" panel before this existed: a short password
 * produced `[ { "origin": "string", "code": "too_small", "minimum": 10, … } ]` where the sentence
 * "Use at least 10 characters." was already sitting inside the payload.
 */
describe('readConsoleFailure', () => {
  it('unwraps a real ZodError into the sentences it already carries', () => {
    const schema = z.object({
      newPassword: z.string().min(10, 'Use at least 10 characters.'),
    })
    const parsed = schema.safeParse({ newPassword: 'short' })
    expect(parsed.success).toBe(false)
    if (parsed.success) {
      return
    }
    // The boundary hands the client an `Error` whose message is exactly this string.
    const asServerFunctionThrowsIt = new Error(parsed.error.message)
    expect(readConsoleFailure(asServerFunctionThrowsIt)).toBe(
      'Use at least 10 characters.',
    )
  })

  it('joins several issues rather than showing only the first', () => {
    const issues = JSON.stringify([
      { code: 'too_small', message: 'Use at least 10 characters.' },
      { code: 'invalid_type', message: 'An email address is required.' },
    ])
    expect(readConsoleFailure(new Error(issues))).toBe(
      'Use at least 10 characters. An email address is required.',
    )
  })

  it('does not repeat the same sentence once per field', () => {
    const issues = JSON.stringify([
      { message: 'This field is required.' },
      { message: 'This field is required.' },
    ])
    expect(readConsoleFailure(new Error(issues))).toBe(
      'This field is required.',
    )
  })

  it('passes a console refusal through untouched', () => {
    // `ConsoleActionError`'s copy is written for exactly this moment and must not be reshaped.
    const refusal = new Error(
      'That account is banned. Lift the ban before impersonating it.',
    )
    expect(readConsoleFailure(refusal)).toBe(
      'That account is banned. Lift the ban before impersonating it.',
    )
  })

  it('leaves anything it does not recognise exactly as it found it', () => {
    expect(readConsoleFailure(new Error('[not json'))).toBe('[not json')
    expect(readConsoleFailure(new Error('[1,2,3]'))).toBe('[1,2,3]')
    expect(readConsoleFailure(new Error('[]'))).toBe('[]')
    expect(readConsoleFailure(new Error('[{"code":"custom"}]'))).toBe(
      '[{"code":"custom"}]',
    )
  })

  it('falls back to a sentence when there is nothing readable at all', () => {
    expect(readConsoleFailure(new Error(''))).toBe(CONSOLE_ACTION_FALLBACK)
    expect(readConsoleFailure(null)).toBe(CONSOLE_ACTION_FALLBACK)
    expect(readConsoleFailure(undefined)).toBe(CONSOLE_ACTION_FALLBACK)
    expect(readConsoleFailure({ nope: true })).toBe(CONSOLE_ACTION_FALLBACK)
  })

  it('accepts a bare string, which is what a rejected promise can carry', () => {
    expect(readConsoleFailure('That session has already ended.')).toBe(
      'That session has already ended.',
    )
  })
})
