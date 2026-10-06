/**
 * The classifier recognises errors by `name` rather than by `instanceof`, so that the module the
 * global middleware pulls in does not drag the auth and console graphs behind it.
 *
 * That trade has one cost: renaming a class would silently stop it being recognised, and the
 * failure would be invisible - a refusal quietly becoming a generic error and a Sentry issue. So
 * these tests construct the *real* classes rather than fixtures with the right `name`. A rename is
 * then a failing test rather than a regression nobody sees.
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { SHELL_STATE_KEYS } from '#/components/layout/session'
import { CURRENCY_REFUSAL_KEYS } from '#/lib/currency-refusals'
import { AuthRequirementError } from '#/server/auth/tenant'
import { QuotaExceededError as BillingQuotaExceededError } from '#/server/billing/types'
import {
  ConsoleActionError,
  ConsoleUnattributableError,
} from '#/server/fns/console/errors'
import {
  ForbiddenError,
  MissingTenantContextError,
  NotFoundError,
  QuotaExceededError,
  RepositoryError,
} from '#/server/repos/context'
import {
  CurrencyRefusalError,
  TripArchivedError,
  TripRoleError,
} from '#/server/repos/trips'

import { AUTHORED_ERROR_NAMES, classifyFailure } from '../public'

describe('the English refusal set is closed', () => {
  /**
   * Every authored name reaches a reader in any locale as an English sentence, which
   * `docs/SPEC.md` §9 rule 10 accepts for exactly these classes and no others. A new name failing
   * here is the point: a new refusal class travels as a message key, or stays a diagnostic.
   */
  it('names exactly the classes the localisation exception covers', () => {
    expect([...AUTHORED_ERROR_NAMES].sort()).toEqual([
      'AuthRequirementError',
      'ConsoleActionError',
      'ConsoleUnattributableError',
      'TripArchivedError',
      'TripRoleError',
    ])
  })
})

describe('the currency refusal keys are closed', () => {
  /**
   * A refusal that travels as a message key is let through by exact match on the key, so the set of
   * keys is what a reader can be told without redaction. A key added to the list fails here, and
   * the author has to look at the line that says what that means.
   */
  it('names exactly the keys a changed budget currency may be refused with', () => {
    expect([...CURRENCY_REFUSAL_KEYS]).toEqual([
      'shell.editTrip.currencyLocked',
    ])
  })

  it('is not an authored class: its name stays out of the English exception', () => {
    expect(AUTHORED_ERROR_NAMES.has('CurrencyRefusalError')).toBe(false)
  })

  it('lets each key through as a refusal that carries the key itself', () => {
    for (const key of CURRENCY_REFUSAL_KEYS) {
      expect(classifyFailure(new CurrencyRefusalError(key))).toEqual({
        kind: 'refusal',
        message: key,
      })
    }
  })

  it.each([
    ['a database diagnostic', 'NOT NULL constraint failed: trips.currency'],
    ['a key with a suffix', 'shell.editTrip.currencyLockedAgain'],
    ['a key with a prefix', 'x.shell.editTrip.currencyLocked'],
    ['a key with padding', ' shell.editTrip.currencyLocked '],
    ['a key of the same family', 'shell.editTrip.currency'],
    ['a key a later ticket adds', 'costs.refusal.tripCurrencyChanged'],
  ])('still redacts %s thrown as a repository error', (_name, message) => {
    expect(classifyFailure(new RepositoryError(message, 'ANY'))).toEqual({
      kind: 'unexpected',
    })
  })
})

describe('authored copy is shown as itself', () => {
  it('recognises an authorisation refusal', () => {
    const cause = new AuthRequirementError(
      'insufficient-role',
      'You may not act on another administrator.',
    )

    expect(classifyFailure(cause)).toEqual({
      kind: 'refusal',
      message: 'You may not act on another administrator.',
    })
  })

  it('recognises a console refusal about the target', () => {
    const cause = new ConsoleActionError(
      'target-banned',
      'This account is suspended.',
    )

    expect(classifyFailure(cause)).toEqual({
      kind: 'refusal',
      message: 'This account is suspended.',
    })
  })

  it('recognises the unattributable-action refusal, whose message is the only instruction', () => {
    const cause = new ConsoleUnattributableError('Try again in a moment.')

    expect(classifyFailure(cause)).toEqual({
      kind: 'refusal',
      message: 'Try again in a moment.',
    })
  })

  it('recognises the archived-trip refusal, so a stale tab is told why its write did not land', () => {
    expect(classifyFailure(new TripArchivedError())).toEqual({
      kind: 'refusal',
      message: 'This trip is archived. Restore it before making changes.',
    })
  })

  it('recognises a trip-role refusal, whose sentence is role vocabulary and nothing else', () => {
    const cause = new TripRoleError(['owner', 'editor'], 'viewer')

    expect(classifyFailure(cause)).toEqual({
      kind: 'refusal',
      message:
        'A viewer may not change this trip; requires one of: owner, editor.',
    })
  })

  it('recognises both shell states, so a blocked traveller keeps the screen written for them', () => {
    for (const key of SHELL_STATE_KEYS) {
      expect(classifyFailure(new Error(key))).toEqual({
        kind: 'refusal',
        message: key,
      })
    }
  })
})

describe('validation names what to change', () => {
  it('unwraps Zod issues into a sentence', () => {
    const schema = z.object({
      title: z.string().min(3, 'Give the trip a longer title.'),
    })
    let thrown: unknown
    try {
      schema.parse({ title: 'a' })
    } catch (cause) {
      thrown = cause
    }

    expect(classifyFailure(thrown)).toEqual({
      kind: 'validation',
      message: 'Give the trip a longer title.',
    })
  })

  it('says a repeated sentence once', () => {
    const schema = z.object({
      a: z.string('Required.'),
      b: z.string('Required.'),
    })
    let thrown: unknown
    try {
      schema.parse({})
    } catch (cause) {
      thrown = cause
    }

    expect(classifyFailure(thrown)).toEqual({
      kind: 'validation',
      message: 'Required.',
    })
  })
})

describe('everything else is a diagnostic', () => {
  it('withholds a driver error', () => {
    expect(
      classifyFailure(new Error('D1_ERROR: no such table: trips')),
    ).toEqual({
      kind: 'unexpected',
    })
  })

  it('withholds a plain throw, a TypeError and a non-error', () => {
    expect(
      classifyFailure(new TypeError('Cannot read properties of undefined')),
    ).toEqual({
      kind: 'unexpected',
    })
    expect(classifyFailure('something went wrong')).toEqual({
      kind: 'unexpected',
    })
    expect(classifyFailure(undefined)).toEqual({ kind: 'unexpected' })
  })

  /**
   * The negative half of the two additions above. Naming two `RepositoryError` subclasses authored
   * must not make the base class authored - these three are the siblings that would have come along
   * for free had the list grown by a base name, and each of them has a message written for a
   * maintainer: a row id, a role requirement, a tenant-context complaint.
   */
  it('withholds every repository error that was not named authored', () => {
    for (const cause of [
      new NotFoundError('trip', 'trip_01HZY3'),
      new ForbiddenError('archive this trip', ['owner']),
      new MissingTenantContextError('no organization on the session'),
    ]) {
      expect(classifyFailure(cause)).toEqual({ kind: 'unexpected' })
    }
  })

  it('does not trust a shape that merely looks like a refusal', () => {
    // A plain object claiming an authored name is not one of our classes, and an `issues` array of
    // the wrong shape is not a Zod failure.
    expect(
      classifyFailure({ name: 'ConsoleActionError', message: 'trust me' }),
    ).toEqual({
      kind: 'unexpected',
    })
    expect(classifyFailure({ issues: [{ code: 'custom' }] })).toEqual({
      kind: 'unexpected',
    })
    expect(classifyFailure({ issues: [] })).toEqual({ kind: 'unexpected' })
  })
})

describe('a quota refusal carries one constant code', () => {
  /**
   * Two classes are called `QuotaExceededError`: the repository's, which a place write throws, and
   * billing's. The classifier recognises the name, so both are constructed here - a rename of
   * either is a failing test rather than a quota hit going back to the generic fallback.
   */
  it.each([
    ['the repository class', () => new QuotaExceededError('places', 50, 50)],
    [
      'the billing class',
      () =>
        new BillingQuotaExceededError(
          {
            key: 'trips',
            planId: 'free',
            limit: 2,
            used: 2,
            requested: 1,
          },
          'The Free plan allows 2 trips and you are using 2. Upgrade to add more.',
        ),
    ],
  ])('classifies %s as unexpected with the quota code', (_label, build) => {
    expect(classifyFailure(build())).toEqual({
      kind: 'unexpected',
      code: 'QUOTA_EXCEEDED',
    })
  })

  it('does not widen the authored set: a quota refusal is still no sentence', () => {
    expect(AUTHORED_ERROR_NAMES.has('QuotaExceededError')).toBe(false)
  })

  it('never copies a repository error code to the browser', () => {
    // `RepositoryError.code` is the maintainer's vocabulary; only the quota literal is public.
    for (const cause of [
      new NotFoundError('trip', 'trip_01HZY3'),
      new ForbiddenError('archive this trip', ['owner']),
      new MissingTenantContextError('no organization on the session'),
      new RepositoryError('boom', 'QUOTA_EXCEEDED'),
    ]) {
      expect(classifyFailure(cause)).toEqual({ kind: 'unexpected' })
    }
  })
})
