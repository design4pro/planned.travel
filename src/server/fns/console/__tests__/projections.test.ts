/**
 * What the console is allowed to learn, and what it must not carry out of this directory.
 *
 * The two omissions are the point and are asserted by name: a session's `token` is a live
 * credential and a console screen rendering it would put a usable session key into an HTML
 * document, and the audit view of an account has no password key at all — which is what makes
 * "the value is never in `changes`" a property of the shape rather than of every call site.
 */

import { describe, expect, it } from 'vitest'

import {
  auditUserState,
  platformSessionSchema,
  platformUserSchema,
  toConsoleSession,
  toConsoleUser,
} from '../projections'

const USER_ROW = {
  id: 'user_1',
  name: 'Mika',
  email: 'mika@planned.travel',
  emailVerified: true,
  image: null,
  role: 'curator',
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-02-03T04:05:06.000Z'),
}

const SESSION_ROW = {
  id: 'session_1',
  token: 'a-live-session-token',
  userId: 'user_1',
  ipAddress: '198.51.100.7',
  userAgent: 'Mozilla/5.0',
  impersonatedBy: null,
  expiresAt: new Date('2026-03-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-02T03:04:05.000Z'),
}

describe('platformUserSchema', () => {
  it('accepts a timestamp however Better Auth happens to hand it over', () => {
    // A `Date` from the Drizzle adapter, a string or a number from a KV blob that has been through
    // `JSON.stringify`. All three are the same instant and no caller should have to know which.
    for (const createdAt of [
      new Date('2026-01-02T03:04:05.000Z'),
      '2026-01-02T03:04:05.000Z',
      Date.parse('2026-01-02T03:04:05.000Z'),
    ]) {
      const parsed = platformUserSchema.parse({ ...USER_ROW, createdAt })
      expect(parsed.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z')
    }
  })

  it('refuses a row with no usable identity', () => {
    expect(() => platformUserSchema.parse({ ...USER_ROW, id: '' })).toThrow()
    expect(() =>
      platformUserSchema.parse({ ...USER_ROW, createdAt: 'never' }),
    ).toThrow()
  })

  it('drops keys the console has no business republishing', () => {
    const parsed = platformUserSchema.parse({
      ...USER_ROW,
      twoFactorEnabled: true,
      providerCustomerId: 'cus_leak',
    })
    expect(Object.keys(parsed)).not.toContain('twoFactorEnabled')
    expect(Object.keys(parsed)).not.toContain('providerCustomerId')
  })
})

describe('toConsoleUser', () => {
  it('answers ISO strings and never a Date across the boundary', () => {
    const user = toConsoleUser(platformUserSchema.parse(USER_ROW))
    expect(user).toEqual({
      id: 'user_1',
      name: 'Mika',
      email: 'mika@planned.travel',
      emailVerified: true,
      image: null,
      role: 'curator',
      banned: false,
      banReason: null,
      banExpiresAt: null,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-02-03T04:05:06.000Z',
    })
  })

  it('normalises an absent flag to false rather than to undefined', () => {
    const user = toConsoleUser(
      platformUserSchema.parse({
        ...USER_ROW,
        banned: undefined,
        emailVerified: undefined,
        role: undefined,
      }),
    )
    expect(user).toMatchObject({
      banned: false,
      emailVerified: false,
      role: null,
    })
  })
})

describe('auditUserState', () => {
  it('has no password key, on either side of any change', () => {
    const state = auditUserState(platformUserSchema.parse(USER_ROW))
    expect(Object.keys(state).sort()).toEqual([
      'banExpiresAt',
      'banReason',
      'banned',
      'email',
      'emailVerified',
      'name',
      'role',
    ])
  })

  it('produces the same key set whatever the row carries, so a diff is readable', () => {
    const before = auditUserState(platformUserSchema.parse(USER_ROW))
    const after = auditUserState(
      platformUserSchema.parse({
        ...USER_ROW,
        banned: true,
        banReason: 'abuse',
        banExpires: new Date('2026-04-01T00:00:00.000Z'),
      }),
    )
    expect(Object.keys(before).sort()).toEqual(Object.keys(after).sort())
    expect(after).toMatchObject({
      banned: true,
      banReason: 'abuse',
      banExpiresAt: '2026-04-01T00:00:00.000Z',
    })
  })
})

describe('toConsoleSession', () => {
  it('drops the token', () => {
    const session = toConsoleSession(platformSessionSchema.parse(SESSION_ROW))
    expect(JSON.stringify(session)).not.toContain('a-live-session-token')
    expect(session).toEqual({
      id: 'session_1',
      ipAddress: '198.51.100.7',
      userAgent: 'Mozilla/5.0',
      impersonatedBy: null,
      expiresAt: '2026-03-01T00:00:00.000Z',
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
    })
  })

  it('keeps the token on the parsed row, which is what the server revokes by', () => {
    expect(platformSessionSchema.parse(SESSION_ROW).token).toBe(
      'a-live-session-token',
    )
  })
})
