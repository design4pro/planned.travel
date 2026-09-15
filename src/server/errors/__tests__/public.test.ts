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
import { AuthRequirementError } from '#/server/auth/tenant'
import {
  ConsoleActionError,
  ConsoleUnattributableError,
} from '#/server/fns/console/errors'
import {
  ForbiddenError,
  MissingTenantContextError,
  NotFoundError,
  QuotaExceededError,
} from '#/server/repos/context'
import { TripArchivedError, TripRoleError } from '#/server/repos/trips'

import { AUTHORED_ERROR_NAMES, classifyFailure } from '../public'

describe('the English refusal set is closed', () => {
  /**
   * Every authored name reaches a reader in any locale as an English sentence, which
   * `docs/SPEC.md` §9 rule 10 accepts for exactly these classes and no others. A new name failing
   * here is the point: a new refusal travels as a message key, or stays a diagnostic.
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

  it('keeps ForbiddenError out, so an organization-role refusal stays a diagnostic', () => {
    expect(
      AUTHORED_ERROR_NAMES.has(new ForbiddenError('x', ['owner']).name),
    ).toBe(false)
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
   * must not make the base class authored - these four are the siblings that would have come along
   * for free had the list grown by a base name, and each of them has a message written for a
   * maintainer: a row id, a quota reading, a tenant-context complaint.
   */
  it('withholds every repository error that was not named authored', () => {
    for (const cause of [
      new NotFoundError('trip', 'trip_01HZY3'),
      new ForbiddenError('archive this trip', ['owner']),
      new QuotaExceededError('trips', 10, 10),
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
