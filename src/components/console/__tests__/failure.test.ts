import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { encodePublicFailure } from '#/lib/errors'
import {
  CONSOLE_ACTION_FALLBACK,
  readConsoleFailure,
  readConsoleFailureDetail,
} from '../failure'

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

/**
 * Which of the three things `readConsoleFailure` returns a reader is looking at. Only a sentence the
 * server wrote is English whatever the locale (SPEC §9 rule 10), so only that one may be marked
 * `lang="en"`; the translated fallback and a raw client-thrown message may not.
 */
describe('readConsoleFailureDetail', () => {
  const envelope = (failure: Parameters<typeof encodePublicFailure>[0]) =>
    new Error(encodePublicFailure(failure))

  it('marks an envelope refusal as authored', () => {
    expect(
      readConsoleFailureDetail(
        envelope({ kind: 'refusal', message: 'That account is banned.' }),
      ),
    ).toEqual({ message: 'That account is banned.', authored: true })
  })

  it('marks an envelope validation message as authored', () => {
    expect(
      readConsoleFailureDetail(
        envelope({
          kind: 'validation',
          message: 'Use at least 10 characters.',
        }),
      ),
    ).toEqual({ message: 'Use at least 10 characters.', authored: true })
  })

  it("returns the caller's fallback, not authored, for an unexpected envelope", () => {
    expect(
      readConsoleFailureDetail(
        envelope({ kind: 'unexpected', reference: 'ref-1' }),
        'Translated fallback.',
      ),
    ).toEqual({ message: 'Translated fallback.', authored: false })
  })

  it.each([
    encodePublicFailure({ kind: 'unexpected' }),
    encodePublicFailure({
      kind: 'unexpected',
      message: 'SELECT secret FROM internal',
    }),
    'planned-travel/failure/1 {broken',
    'planned-travel/failure/2 {"kind":"refusal","message":"Unknown format"}',
  ])(
    'withholds an unreadable or unexpected envelope without a reference: %s',
    (raw) => {
      expect(
        readConsoleFailureDetail(new Error(raw), 'Translated fallback.'),
      ).toEqual({
        message: 'Translated fallback.',
        authored: false,
      })
    },
  )

  it('does not attribute a raw client-thrown message to the server', () => {
    expect(
      readConsoleFailureDetail(new Error('Network request failed')),
    ).toEqual({ message: 'Network request failed', authored: false })
    expect(readConsoleFailureDetail('That session has already ended.')).toEqual(
      {
        message: 'That session has already ended.',
        authored: false,
      },
    )
  })

  it('does not attribute a repaired client-side validation array either', () => {
    const issues = JSON.stringify([{ message: 'Use at least 10 characters.' }])
    expect(readConsoleFailureDetail(new Error(issues))).toEqual({
      message: 'Use at least 10 characters.',
      authored: false,
    })
  })

  it('falls back, not authored, when there is nothing readable', () => {
    expect(readConsoleFailureDetail(null)).toEqual({
      message: CONSOLE_ACTION_FALLBACK,
      authored: false,
    })
  })

  it('is what readConsoleFailure returns, message for message', () => {
    for (const cause of [
      envelope({ kind: 'refusal', message: 'Nope.' }),
      envelope({ kind: 'unexpected' }),
      new Error('[{"message":"A."},{"message":"B."}]'),
      new Error('raw'),
      null,
    ]) {
      expect(readConsoleFailure(cause, 'F')).toBe(
        readConsoleFailureDetail(cause, 'F').message,
      )
    }
  })
})
