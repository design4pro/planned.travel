/**
 * The session whitelist and the denial vocabulary.
 *
 * `normaliseSession` is a *closed* whitelist rather than a spread, and that is the whole of its
 * value: a field Better Auth adds, a plugin adds, or an attacker persuades the adapter to return
 * cannot reach React unless it is named here. The cost of the design is that a field the product
 * needs is silently `undefined` until it is added — `undefined` being a perfectly valid value for
 * an optional field, no type error marks the omission. So both halves are asserted: the five
 * platform fields survive, and an unlisted key still does not.
 */

import { describe, expect, it } from 'vitest'
import {
  AuthRequirementError,
  isAuthRequirementError,
  normaliseSession,
  requireOrgFrom,
} from '#/server/auth/tenant'
import type { AuthFailureReason } from '#/server/auth/tenant'

const EXPIRES_AT = new Date('2026-09-01T10:00:00.000Z')
const BAN_EXPIRES = new Date('2026-09-08T10:00:00.000Z')

/** A raw session in the shape Better Auth hands back once the `admin` plugin is registered. */
function rawSession() {
  return {
    user: {
      id: 'usr_1',
      email: 'ops@planned.travel',
      name: 'Ops',
      emailVerified: true,
      image: null,
      twoFactorEnabled: true,
      role: 'admin',
      banned: true,
      banReason: 'Spam',
      banExpires: BAN_EXPIRES,
      // Not whitelisted. Better Auth returns the credential hash on some adapter paths, and a
      // spread would put it in the SSR payload.
      password: 'scrypt$never-ships',
    },
    session: {
      id: 'ses_1',
      token: 'tok_1',
      userId: 'usr_1',
      activeOrganizationId: 'org_1',
      expiresAt: EXPIRES_AT,
      impersonatedBy: 'usr_admin',
      // An impersonated session is only usable inside its first 900 seconds (docs/ACCESS.md §6.2).
      createdAt: new Date(),
      ipAddress: '203.0.113.7',
    },
  }
}

describe('normaliseSession', () => {
  it('carries all five platform fields through', () => {
    const normalised = normaliseSession(rawSession())

    expect(normalised?.user.role).toBe('admin')
    expect(normalised?.user.banned).toBe(true)
    expect(normalised?.user.banReason).toBe('Spam')
    expect(normalised?.user.banExpires).toEqual(BAN_EXPIRES)
    expect(normalised?.session.impersonatedBy).toBe('usr_admin')
  })

  it('still drops every key it does not name', () => {
    const normalised = normaliseSession(rawSession())

    expect(Object.keys(normalised?.user ?? {})).toEqual([
      'id',
      'email',
      'name',
      'emailVerified',
      'image',
      'twoFactorEnabled',
      'role',
      'banned',
      'banReason',
      'banExpires',
    ])
    expect(Object.keys(normalised?.session ?? {})).toEqual([
      'id',
      'token',
      'userId',
      'activeOrganizationId',
      'expiresAt',
      'impersonatedBy',
    ])
  })

  it('resolves an ordinary session to a null role and an unbanned, unimpersonated state', () => {
    const normalised = normaliseSession({
      user: { id: 'usr_2', email: 'traveller@planned.travel', name: 'Traveller' },
      session: { id: 'ses_2', token: 'tok_2', userId: 'usr_2', expiresAt: EXPIRES_AT },
    })

    expect(normalised?.user.role).toBeNull()
    expect(normalised?.user.banned).toBe(false)
    expect(normalised?.user.banReason).toBeNull()
    expect(normalised?.user.banExpires).toBeNull()
    expect(normalised?.session.impersonatedBy).toBeNull()
  })

  it('reads banned as true only for the boolean, never for a truthy value', () => {
    const raw = rawSession()
    const normalised = normaliseSession({ ...raw, user: { ...raw.user, banned: 'yes' } })

    expect(normalised?.user.banned).toBe(false)
  })

  it('accepts an epoch-millisecond ban expiry, which is how D1 stores it', () => {
    const raw = rawSession()
    const normalised = normaliseSession({
      ...raw,
      user: { ...raw.user, banExpires: BAN_EXPIRES.getTime() },
    })

    expect(normalised?.user.banExpires).toEqual(BAN_EXPIRES)
  })
})

describe('AuthRequirementError', () => {
  it('maps the three platform denials to 403', () => {
    const platformReasons: ReadonlyArray<AuthFailureReason> = [
      'banned',
      'insufficient-platform-permission',
      'impersonated',
    ]

    for (const reason of platformReasons) {
      const error = new AuthRequirementError(reason, 'Denied.')
      expect(error.status).toBe(403)
      expect(error.reason).toBe(reason)
      expect(isAuthRequirementError(error)).toBe(true)
    }
  })

  it('keeps 401 for the one reason that means "sign in"', () => {
    expect(new AuthRequirementError('unauthenticated', 'Sign in.').status).toBe(401)
    expect(new AuthRequirementError('insufficient-role', 'No.').status).toBe(403)
  })
})

describe('requireOrgFrom after a workspace switch', () => {
  // A switch writes `session.activeOrganizationId`; whether the new workspace is one the reader may
  // touch is decided by the membership row read for *that* id, never by the id itself.
  function sessionActiveIn(organizationId: string | null) {
    const normalised = normaliseSession({
      user: { id: 'usr_1', email: 'kasia@planned.travel', name: 'Kasia' },
      session: {
        id: 'ses_1',
        token: 'tok_1',
        userId: 'usr_1',
        activeOrganizationId: organizationId,
        expiresAt: EXPIRES_AT,
      },
    })
    if (!normalised) throw new Error('the fixture session did not normalise')
    return normalised
  }

  it('refuses an active workspace the reader holds no membership in', () => {
    const attempt = () => requireOrgFrom(sessionActiveIn('org_b'), null)

    expect(attempt).toThrow(AuthRequirementError)
    expect(attempt).toThrow(
      expect.objectContaining({ reason: 'not-a-member', status: 403 }),
    )
  })

  it('hands back a tenant context for the new workspace once the membership is there', () => {
    expect(requireOrgFrom(sessionActiveIn('org_b'), 'member')).toEqual({
      organizationId: 'org_b',
      userId: 'usr_1',
      role: 'member',
    })
  })
})
