/**
 * The `BANNED_USER` refusal, after localisation changed what this module can even return.
 *
 * The plugin throws `BANNED_USER` out of `session.create.before`, so this is the one refusal a
 * person meets *instead of* being signed in — the account never reaches a screen where a nicer
 * message could be shown later. The original version of this file guarded against
 * `describeFailure` falling through to `failure.message` and rendering Better Auth's own developer
 * copy: "You have been banned from this application. Please contact support…", which names an
 * application nobody calls us and a support desk we do not have.
 *
 * That leak is now impossible by construction rather than by table entry. `describeFailure` returns
 * `MessageKey`s and never a sentence, so no string the server sent can reach a screen through it —
 * which is the same guarantee, made structural. What the test asserts is therefore the structure.
 *
 * **The gap this file also records.** `BANNED_USER` has no entry in `BY_CODE`, so a suspended
 * account currently lands on `error.unexpected` and reads "Something went wrong" in its own
 * language: true, localised, and less useful than it should be. Closing it needs
 * `error.banned.title` and `error.banned.detail` in the English namespace *and* in all twenty-two
 * translations, because `docs/SPEC.md` §8.2's parity gate admits no key that exists in one
 * language only. That is a piece of work, not a merge resolution, which is why it is written down
 * here instead of being half-done.
 *
 * The file sits beside `errors.ts` rather than in `__tests__/` because that is the path this work
 * item owns; `vitest.config.ts` collects `src/routes/**\/*.test.ts` either way.
 */

import { describe, expect, it } from 'vitest'
import { BANNED_USER_MESSAGE } from '#/server/auth/admin-options'
import { describeFailure } from './errors'

/** Better Auth's fallback, `dist/plugins/admin/admin.mjs:16`. */
const UPSTREAM_DEFAULT =
  'You have been banned from this application. Please contact support if you believe this is an error.'

describe('describeFailure for a banned account', () => {
  const failure = {
    code: 'BANNED_USER',
    status: 403,
    message: UPSTREAM_DEFAULT,
  }

  it('never returns the sentence the server sent, for any code', () => {
    const message = describeFailure(failure)
    expect(Object.values(message)).not.toContain(UPSTREAM_DEFAULT)
    // Keys, not copy: every field that names text is a dotted message key, so a server-authored
    // sentence has no route onto the screen even when the code is one nothing maps.
    expect(message.titleKey).toMatch(/^[a-z][\w.]*\.[\w.]+$/)
  })

  it('falls through to the unexpected-error keys while no banned copy exists', () => {
    // Deliberate, and documented in the header: an unmapped code lands on `error.unexpected`
    // rather than on whatever the endpoint happened to say.
    expect(describeFailure(failure)).toEqual(
      describeFailure({ code: 'NOTHING_MAPS_THIS', status: 403, message: '' }),
    )
  })

  it('still prefers the rate-limit message on a 429, as every other code does', () => {
    const throttled = describeFailure({ ...failure, status: 429 })
    expect(throttled).not.toEqual(describeFailure(failure))
  })
})

describe('the message Better Auth is configured to throw', () => {
  it('is repo copy rather than the upstream default', () => {
    // This one string cannot be a message key: the plugin throws it before any request has
    // negotiated a language. It never reaches a screen — `describeFailure` maps the code instead —
    // but it does reach logs and any client that reads the raw error, so it is still ours.
    expect(BANNED_USER_MESSAGE).not.toBe(UPSTREAM_DEFAULT)
    expect(BANNED_USER_MESSAGE).not.toContain('banned from this application')
    expect(BANNED_USER_MESSAGE).toContain('planned.travel')
  })
})
