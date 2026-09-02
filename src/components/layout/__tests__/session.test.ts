import { describe, expect, it } from 'vitest'

import shell from '#/lib/i18n/messages/en/shell'
import {
  SHELL_STATE_KEYS,
  shellStateOf,
  platformCapabilities,
} from '../session'
import { resolvePlatformRole } from '#/server/auth/access'
import { roleSatisfies } from '#/server/auth/tenant'

import type { ShellPlatformRole } from '../session'

/**
 * The contract between the two halves of a fatal shell state.
 *
 * `src/routes/_app/-server/shell.ts` throws the message *key* rather than a
 * sentence, because the request that failed has no workspace and therefore no
 * access to the stored language preference — it could only have negotiated
 * against `Accept-Language`, which is not necessarily the language the document
 * around the error boundary is in. The boundary resolves the key instead, inside
 * the provider, and prints it as prose rather than as a monospace diagnostic.
 *
 * Two things have to hold for that to work: the keys must exist in the
 * catalogue, and recognising one must survive the trip across the
 * server-function boundary, where an `Error.message` is what is left of a throw.
 */

describe('a thrown shell state is recognised by the boundary', () => {
  it('names keys the catalogue carries', () => {
    for (const key of SHELL_STATE_KEYS) {
      expect(key.startsWith('shell.')).toBe(true)
      expect(shell).toHaveProperty(key.slice('shell.'.length))
    }
  })

  it('recognises the state on an Error, which is what crosses the wire', () => {
    expect(shellStateOf(new Error('shell.session.noWorkspace'))).toBe(
      'shell.session.noWorkspace',
    )
    expect(shellStateOf(new Error('shell.session.membershipRemoved'))).toBe(
      'shell.session.membershipRemoved',
    )
  })

  it('recognises a bare string, because a throw need not be an Error', () => {
    expect(shellStateOf('shell.session.noWorkspace')).toBe(
      'shell.session.noWorkspace',
    )
  })

  it('leaves an ordinary failure to the diagnostic path', () => {
    expect(shellStateOf(new Error('D1_ERROR: no such column'))).toBeNull()
    expect(shellStateOf(new Error(''))).toBeNull()
    expect(shellStateOf(undefined)).toBeNull()
    expect(shellStateOf(null)).toBeNull()
    expect(shellStateOf({ message: 'shell.session.noWorkspace' })).toBeNull()
  })

  it('does not match a key that merely looks like one', () => {
    expect(shellStateOf(new Error('shell.session'))).toBeNull()
    expect(shellStateOf(new Error('shell.error.title'))).toBeNull()
  })
})

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
