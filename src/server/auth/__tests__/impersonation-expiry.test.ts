import { describe, expect, it } from 'vitest'
import { IMPERSONATION_SESSION_SECONDS } from '../admin-options'
import {
  clampSessionExpiry,
  isImpersonationExpired,
} from '../impersonation-expiry'
import { normaliseSession } from '../tenant'

const IMPERSONATION_MS = IMPERSONATION_SESSION_SECONDS * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const createdAt = new Date('2026-10-17T10:00:00.000Z')

describe('clampSessionExpiry', () => {
  const impersonated = {
    impersonatedBy: 'operator',
    createdAt,
    expiresAt: new Date(createdAt.getTime() + IMPERSONATION_MS),
  }

  it('keeps an impersonated session at its stored expiry when the patch tries to extend it', () => {
    const patch = { expiresAt: new Date(createdAt.getTime() + THIRTY_DAYS_MS) }

    expect(clampSessionExpiry(patch, impersonated)).toEqual({
      expiresAt: impersonated.expiresAt,
    })
  })

  it('pulls an already extended row back to createdAt plus the impersonation duration', () => {
    const extended = {
      ...impersonated,
      expiresAt: new Date(createdAt.getTime() + THIRTY_DAYS_MS),
    }

    expect(clampSessionExpiry({ expiresAt: new Date() }, extended)).toEqual({
      expiresAt: new Date(createdAt.getTime() + IMPERSONATION_MS),
    })
  })

  it('leaves a patch that does not touch expiresAt alone', () => {
    expect(
      clampSessionExpiry({ activeOrganizationId: 'org' }, impersonated),
    ).toBeUndefined()
    expect(
      clampSessionExpiry({ activeOrganizationId: 'org' }, null),
    ).toBeUndefined()
  })

  it('leaves an ordinary session alone', () => {
    const ordinary = { ...impersonated, impersonatedBy: null }

    expect(
      clampSessionExpiry({ expiresAt: new Date() }, ordinary),
    ).toBeUndefined()
  })

  it('fails closed when the session being updated cannot be resolved', () => {
    expect(clampSessionExpiry({ expiresAt: new Date() }, null)).toEqual({
      expiresAt: undefined,
    })
  })

  it('fails closed when an impersonated session has no usable dates', () => {
    expect(
      clampSessionExpiry(
        { expiresAt: new Date() },
        { impersonatedBy: 'operator', createdAt: 'garbage', expiresAt: 'x' },
      ),
    ).toEqual({ expiresAt: undefined })
  })
})

describe('isImpersonationExpired', () => {
  const at = (offsetMs: number) => new Date(createdAt.getTime() + offsetMs)

  it('accepts an impersonated session inside the duration', () => {
    expect(
      isImpersonationExpired(
        { impersonatedBy: 'operator', createdAt },
        at(IMPERSONATION_MS - 1),
      ),
    ).toBe(false)
  })

  it('refuses an impersonated session at and past the duration', () => {
    const session = { impersonatedBy: 'operator', createdAt }

    expect(isImpersonationExpired(session, at(IMPERSONATION_MS))).toBe(true)
    expect(isImpersonationExpired(session, at(THIRTY_DAYS_MS))).toBe(true)
  })

  it('never judges an ordinary session', () => {
    expect(
      isImpersonationExpired(
        { impersonatedBy: null, createdAt },
        at(THIRTY_DAYS_MS),
      ),
    ).toBe(false)
  })

  it('refuses an impersonated session whose age cannot be established', () => {
    expect(
      isImpersonationExpired({ impersonatedBy: 'operator', createdAt: null }),
    ).toBe(true)
  })
})

describe('normaliseSession and the impersonation bound', () => {
  const user = { id: 'u', email: 'u@planned.travel' }
  const session = (impersonatedBy: string | null) => ({
    id: 's',
    token: 't',
    expiresAt: new Date(createdAt.getTime() + THIRTY_DAYS_MS),
    createdAt,
    impersonatedBy,
  })

  it('signs out an impersonated session older than 900 seconds even though its row says 30 days', () => {
    const now = new Date(createdAt.getTime() + IMPERSONATION_MS + 1)

    expect(
      normaliseSession({ user, session: session('operator') }, now),
    ).toBeNull()
  })

  it('keeps an impersonated session inside the duration and an ordinary session of any age', () => {
    const early = new Date(createdAt.getTime() + 1000)
    const late = new Date(createdAt.getTime() + THIRTY_DAYS_MS / 2)

    expect(
      normaliseSession({ user, session: session('operator') }, early)?.session
        .impersonatedBy,
    ).toBe('operator')
    expect(
      normaliseSession({ user, session: session(null) }, late),
    ).not.toBeNull()
  })
})
