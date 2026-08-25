/**
 * The `BANNED_USER` copy, and the two ways it could quietly revert to Better Auth's.
 *
 * The plugin throws `BANNED_USER` out of `session.create.before`, so this is the one refusal a
 * person meets *instead of* being signed in — the account never reaches a screen where a nicer
 * message could be shown later. If the code were missing from the table, `describeFailure` would
 * fall through to `failure.message`, which is whatever string the server sent, and the sign-in page
 * would render "You have been banned from this application. Please contact support…" — developer
 * copy naming an application nobody calls us and a support desk we do not have.
 *
 * The file sits beside `errors.ts` rather than in `__tests__/` because that is the path this work
 * item owns; `vitest.config.ts` collects `src/routes/**\/*.test.ts` either way.
 */

import { describe, expect, it } from 'vitest'
import { BANNED_USER_MESSAGE, describeFailure } from './errors'

/** Better Auth's fallback, `dist/plugins/admin/admin.mjs:16`. */
const UPSTREAM_DEFAULT =
  'You have been banned from this application. Please contact support if you believe this is an error.'

describe('describeFailure for a banned account', () => {
  const failure = {
    code: 'BANNED_USER',
    status: 403,
    message: UPSTREAM_DEFAULT,
  }

  it('returns repo copy and never the message the server sent', () => {
    const message = describeFailure(failure)
    expect(message.title).toBe('This account is suspended')
    expect(message.detail).toBe(BANNED_USER_MESSAGE)
    expect(message.tone).toBe('danger')
    expect(message.detail).not.toBe(UPSTREAM_DEFAULT)
    expect(message.detail).not.toContain('banned from this application')
  })

  it('says what happened and what to do about it', () => {
    // The bar the fallthrough fails: an unmapped code renders the server's own sentence as a
    // title with an empty detail, which is a headline and no next step.
    expect(BANNED_USER_MESSAGE.length).toBeGreaterThan(40)
    expect(BANNED_USER_MESSAGE).toContain('planned.travel')
    expect(describeFailure(failure).detail).not.toBe('')
  })

  it('still prefers the rate-limit message on a 429, as every other code does', () => {
    const throttled = describeFailure({ ...failure, status: 429 })
    expect(throttled.title).toBe('Too many attempts')
  })

  it('would have leaked the server string if the code were unmapped (control)', () => {
    const unmapped = describeFailure({
      code: 'BANNED_USERS',
      status: 403,
      message: UPSTREAM_DEFAULT,
    })
    expect(unmapped.title).toBe(UPSTREAM_DEFAULT)
    expect(unmapped.detail).toBe('')
  })
})
