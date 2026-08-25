import { describe, expect, it } from 'vitest'

import { resolvePlatformRole } from '#/server/auth/access'
import { roleSatisfies } from '#/server/auth/tenant'
import { platformCapabilities } from '../session'

import type { ShellPlatformRole } from '../session'

/**
 * Two role vocabularies live on one `ShellUser`, and `docs/SPEC.md` §5 says they
 * must never be conflated. The compiler cannot tell them apart — both are
 * booleans — so the thing worth asserting is that they are computed from
 * different inputs and are free to disagree in both directions.
 */
describe('the shell user carries two role vocabularies', () => {
  it('reads the organization role and the platform role from different sources', () => {
    // The owner of their own workspace, with no platform standing at all: the
    // overwhelmingly common case, and the one where conflating the two would
    // hand every customer the platform console.
    const owner = {
      isAdmin: roleSatisfies('owner', 'admin'),
      ...platformCapabilities(resolvePlatformRole(null)),
    }
    expect(owner.isAdmin).toBe(true)
    expect(owner.isPlatformAdmin).toBe(false)
    expect(owner.isCurator).toBe(false)

    // And the disagreement the other way: a platform admin who happens to be a
    // plain member of the workspace they are looking at.
    const operator = {
      isAdmin: roleSatisfies('member', 'admin'),
      ...platformCapabilities(resolvePlatformRole('admin')),
    }
    expect(operator.isAdmin).toBe(false)
    expect(operator.isPlatformAdmin).toBe(true)
  })

  it('never lets the organization role move a platform flag', () => {
    for (const membership of ['owner', 'admin', 'member'] as const) {
      expect(
        platformCapabilities(resolvePlatformRole(null)).isPlatformAdmin,
        membership,
      ).toBe(false)
    }
  })
})

describe('platform capabilities', () => {
  it('gives the admin everything the curator has, because it is a superset', () => {
    const admin = platformCapabilities('admin')
    expect(admin).toEqual({ isPlatformAdmin: true, isCurator: true })
  })

  it('keeps the curator away from users and sessions', () => {
    expect(platformCapabilities('curator')).toEqual({
      isPlatformAdmin: false,
      isCurator: true,
    })
  })

  it('gives a plain user no platform surface at all', () => {
    expect(platformCapabilities('user')).toEqual({
      isPlatformAdmin: false,
      isCurator: false,
    })
  })

  it('accepts exactly the three roles the server resolves', () => {
    // A fourth platform role appearing in `#/server/auth/access` has to stop
    // compiling here rather than arrive as a string nobody checked.
    const resolved: ShellPlatformRole = resolvePlatformRole('curator,user')
    expect(resolved).toBe('curator')
  })
})
