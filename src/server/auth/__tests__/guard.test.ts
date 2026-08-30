/**
 * The seventy-five cells, the four resolution rules, and the shape of the guard itself.
 *
 * docs/ACCESS.md §2 prints the grid as literal yes and no with no conditional cell and no
 * footnote, so it is transcribed here as two literal lists rather than derived from `roles` — a
 * matrix generated from the object under test agrees with itself no matter what it says. What *is*
 * derived is the enumeration of cells, from `statement`, so that a resource quietly dropped from
 * the dictionary shrinks the matrix and fails the count assertion instead of passing unnoticed.
 *
 * The last describe block asserts properties of the file rather than of its behaviour, because
 * they are the ones a passing matrix cannot see. A guard re-expressed as a wrapper around Better
 * Auth's own permission endpoint would satisfy every cell below while importing the id-list bypass
 * of docs/ACCESS.md §1.4 into the single place authorisation is decided — and would keep
 * satisfying them for exactly as long as that list stayed empty.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { statement } from '#/server/auth/access'
import { requirePermission } from '#/server/auth/guard'
import { AuthRequirementError } from '#/server/auth/tenant'
import type {
  PlatformPermissionRequest,
  PlatformRole,
} from '#/server/auth/access'
import type { PlatformActor } from '#/server/auth/guard'
import type { AuthSession } from '#/server/auth/tenant'

const GUARD_MODULE = join(process.cwd(), 'src', 'server', 'auth', 'guard.ts')

interface Cell {
  readonly key: string
  readonly request: PlatformPermissionRequest
}

/** Every statement in the dictionary, as the single-statement request a caller would make. */
const ALL_STATEMENTS: ReadonlyArray<Cell> = Object.entries(statement).flatMap(
  ([resource, actions]) =>
    actions.map((action) => ({
      key: `${resource}:${action}`,
      request: { [resource]: [action] },
    })),
)

/** docs/ACCESS.md §2.1 and §2.2, `admin` column — every yes, and `impersonate-admins` is not one. */
const ADMIN_ALLOWS: ReadonlyArray<string> = [
  'user:create',
  'user:list',
  'user:set-role',
  'user:ban',
  'user:impersonate',
  'user:delete',
  'user:set-password',
  'user:set-email',
  'user:get',
  'user:update',
  'session:list',
  'session:revoke',
  'session:delete',
  'catalog:read',
  'catalog:write',
  'catalog:publish',
  'pack:read',
  'pack:write',
  'pack:publish',
  'source:read',
  'source:run',
  'share:read',
  'share:revoke',
  'sandcastle:read',
]

/** docs/ACCESS.md §2.3, `curator` column. Nothing that touches users or sessions. */
const CURATOR_ALLOWS: ReadonlyArray<string> = [
  'catalog:read',
  'catalog:write',
  'catalog:publish',
  'pack:read',
  'pack:write',
  'pack:publish',
  'source:read',
  'source:run',
  'share:read',
  'share:revoke',
]

const GRID: Record<PlatformRole, ReadonlyArray<string>> = {
  admin: ADMIN_ALLOWS,
  curator: CURATOR_ALLOWS,
  user: [],
}

const ROLE_NAMES = ['admin', 'curator', 'user'] as const

interface SessionOptions {
  readonly role?: string | null
  readonly banned?: boolean
  readonly impersonatedBy?: string | null
}

function sessionWith({
  role = null,
  banned = false,
  impersonatedBy = null,
}: SessionOptions = {}): AuthSession {
  return {
    user: {
      id: 'usr_actor',
      email: 'ops@planned.travel',
      name: 'Ops',
      emailVerified: true,
      image: null,
      twoFactorEnabled: true,
      role,
      banned,
      banReason: banned ? 'Abuse' : null,
      banExpires: null,
    },
    session: {
      id: 'ses_1',
      token: 'tok_1',
      userId: 'usr_actor',
      activeOrganizationId: 'org_1',
      expiresAt: new Date('2026-09-01T10:00:00.000Z'),
      impersonatedBy,
    },
  }
}

function allows(
  session: AuthSession | null,
  request: PlatformPermissionRequest,
): boolean {
  try {
    requirePermission(session, request)
    return true
  } catch (error) {
    if (error instanceof AuthRequirementError) return false
    throw error
  }
}

function denialReason(
  session: AuthSession | null,
  request: PlatformPermissionRequest,
): string {
  try {
    requirePermission(session, request)
    return 'allowed'
  } catch (error) {
    if (error instanceof AuthRequirementError) return error.reason
    throw error
  }
}

describe('PlatformActor', () => {
  it('describes all three actor kinds from one definition', () => {
    // B4's audit writer, B5's console server functions and Faza C's `catalog/repo.ts` all take one
    // of these. The assertion is that the three shapes are expressible, which is what stops the
    // type being re-declared — narrower than it looks, and the only thing a run-time test can say
    // about a type.
    const human: PlatformActor = {
      userId: 'usr_actor',
      actorKind: 'human',
      role: 'admin',
      tokenId: null,
    }
    const agent: PlatformActor = {
      userId: 'usr_actor',
      actorKind: 'agent',
      role: 'curator',
      tokenId: 'tok_mcp',
    }
    const system: PlatformActor = {
      userId: null,
      actorKind: 'system',
      role: null,
      tokenId: null,
    }

    expect([human, agent, system].map((actor) => actor.actorKind)).toEqual([
      'human',
      'agent',
      'system',
    ])
  })
})

describe('the grid is enumerated in full', () => {
  it('covers twenty-five statements', () => {
    expect(ALL_STATEMENTS.map((cell) => cell.key)).toEqual([
      'user:create',
      'user:list',
      'user:set-role',
      'user:ban',
      'user:impersonate',
      'user:impersonate-admins',
      'user:delete',
      'user:set-password',
      'user:set-email',
      'user:get',
      'user:update',
      'session:list',
      'session:revoke',
      'session:delete',
      'catalog:read',
      'catalog:write',
      'catalog:publish',
      'pack:read',
      'pack:write',
      'pack:publish',
      'source:read',
      'source:run',
      'share:read',
      'share:revoke',
      'sandcastle:read',
    ])
  })

  it('is seventy-five cells across three roles', () => {
    expect(ALL_STATEMENTS.length * ROLE_NAMES.length).toBe(75)
  })

  it('expects twenty-four yes for `admin`, ten for `curator`, none for `user`', () => {
    expect(GRID.admin).toHaveLength(24)
    expect(GRID.curator).toHaveLength(10)
    expect(GRID.user).toHaveLength(0)
  })
})

describe.each(ROLE_NAMES)('role `%s`', (role) => {
  it.each(ALL_STATEMENTS.map((cell) => [cell.key, cell.request] as const))(
    '%s',
    (key, request) => {
      expect(allows(sessionWith({ role }), request)).toBe(
        GRID[role].includes(key),
      )
    },
  )
})

describe('impersonate-admins is granted to nobody', () => {
  it.each(ROLE_NAMES)('including `%s`', (role) => {
    const session = sessionWith({ role })

    expect(allows(session, { user: ['impersonate-admins'] })).toBe(false)
    expect(denialReason(session, { user: ['impersonate-admins'] })).toBe(
      'insufficient-platform-permission',
    )
  })

  it('denies the whole request when it is bundled with statements the role holds', () => {
    // `authorize` under its default AND connector needs every listed action, so smuggling the
    // denied one alongside `user:list` does not launder it.
    expect(
      allows(sessionWith({ role: 'admin' }), {
        user: ['list', 'impersonate-admins'],
      }),
    ).toBe(false)
  })
})

describe('role resolution', () => {
  it('resolves a null role as `user`', () => {
    expect(allows(sessionWith({ role: null }), { catalog: ['read'] })).toBe(
      false,
    )
    expect(allows(sessionWith({ role: null }), { user: ['list'] })).toBe(false)
  })

  it('resolves an unrecognised role as `user` rather than as an escalation', () => {
    expect(allows(sessionWith({ role: 'wizard' }), { catalog: ['read'] })).toBe(
      false,
    )
    expect(allows(sessionWith({ role: 'wizard' }), { user: ['list'] })).toBe(
      false,
    )
  })

  it('splits the comma-joined column and takes the strongest name', () => {
    const session = sessionWith({ role: 'curator,user' })

    // A guard that compared `role === 'curator'` would deny this, and one that compared
    // `role === 'admin'` would deny every admin written the same way.
    expect(allows(session, { catalog: ['write'] })).toBe(true)
    expect(allows(session, { user: ['ban'] })).toBe(false)
    expect(allows(sessionWith({ role: 'user,admin' }), { user: ['ban'] })).toBe(
      true,
    )
  })

  it('reads a padded column value the way the dependency does — as an undeclared role', () => {
    // Better Auth's own check splits this column on `,` and never trims, and it runs inside every
    // `auth.api.*` call a console function makes after this guard has answered. Trimming here would
    // make one stored string mean `admin` on this side of the request and an undeclared role on
    // the other, in the permissive direction. docs/ACCESS.md §1.3 step 3: not one of the three,
    // therefore `user`.
    expect(allows(sessionWith({ role: ' admin ' }), { user: ['ban'] })).toBe(
      false,
    )
    expect(
      allows(sessionWith({ role: 'user, curator' }), { catalog: ['write'] }),
    ).toBe(false)
  })

  it('never reads the whole column as a single role name', () => {
    // `'admin'` is a substring of `'not-admin'`; matching on containment rather than on the split
    // parts would grant it.
    expect(
      allows(sessionWith({ role: 'not-admin' }), { catalog: ['read'] }),
    ).toBe(false)
  })
})

describe('a ban is a veto on top of the role', () => {
  it.each(ROLE_NAMES)('denies every statement to a banned `%s`', (role) => {
    const session = sessionWith({ role, banned: true })

    for (const cell of ALL_STATEMENTS) {
      expect(allows(session, cell.request), cell.key).toBe(false)
      expect(denialReason(session, cell.request), cell.key).toBe('banned')
    }
  })
})

describe('an impersonated session performs no platform mutation', () => {
  it.each(ROLE_NAMES)(
    'denies every statement while impersonating a `%s`',
    (role) => {
      const session = sessionWith({ role, impersonatedBy: 'usr_operator' })

      for (const cell of ALL_STATEMENTS) {
        expect(allows(session, cell.request), cell.key).toBe(false)
        expect(denialReason(session, cell.request), cell.key).toBe(
          'impersonated',
        )
      }
    },
  )

  it('applies to an impersonated admin, whose own role would otherwise allow it', () => {
    // docs/ACCESS.md §6.4: a curator being worn does not lend its `catalog:write`, and an admin
    // being worn lends nothing at all.
    const session = sessionWith({
      role: 'admin',
      impersonatedBy: 'usr_operator',
    })

    expect(allows(session, { user: ['set-role'] })).toBe(false)
    expect(allows(session, { user: ['impersonate'] })).toBe(false)
    expect(allows(session, { session: ['revoke'] })).toBe(false)
    expect(allows(session, { catalog: ['publish'] })).toBe(false)
    expect(allows(session, { user: ['create'] })).toBe(false)
  })

  it('treats an empty impersonator id as impersonation rather than as absence', () => {
    // `normaliseSession` maps an empty string to null, so this cannot arrive through that door.
    // The guard is called with sessions assembled elsewhere too — Faza E's MCP server among them —
    // and a veto that reads `''` as "nobody is wearing this account" fails open.
    expect(
      allows(sessionWith({ role: 'admin', impersonatedBy: '' }), {
        user: ['ban'],
      }),
    ).toBe(false)
  })
})

describe('denials', () => {
  it('answers 401 unauthenticated with no session', () => {
    expect(() => requirePermission(null, { catalog: ['read'] })).toThrow(
      AuthRequirementError,
    )

    try {
      requirePermission(null, { catalog: ['read'] })
      expect.unreachable('the guard allowed an anonymous caller')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthRequirementError)
      const failure = error as AuthRequirementError
      expect(failure.reason).toBe('unauthenticated')
      expect(failure.status).toBe(401)
      expect(failure.message).toBe('You need to sign in to continue.')
    }
  })

  it.each([
    ['banned', sessionWith({ role: 'admin', banned: true })],
    ['impersonated', sessionWith({ role: 'admin', impersonatedBy: 'usr_op' })],
    ['insufficient-platform-permission', sessionWith({ role: 'curator' })],
  ] as const)('answers 403 %s', (reason, session) => {
    try {
      requirePermission(session, { user: ['ban'] })
      expect.unreachable('the guard allowed a denied statement')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthRequirementError)
      const failure = error as AuthRequirementError
      expect(failure.reason).toBe(reason)
      expect(failure.status).toBe(403)
      expect(failure.message.length).toBeGreaterThan(0)
    }
  })

  it('reports the ban first when an operator is both banned and impersonating', () => {
    // Both are 403 vetoes, so the order decides only which reason is told. The ban is the fact
    // about the account and it survives ending the impersonation.
    expect(
      denialReason(
        sessionWith({ role: 'admin', banned: true, impersonatedBy: 'usr_op' }),
        { catalog: ['read'] },
      ),
    ).toBe('banned')
  })

  it('denies an empty request', () => {
    expect(allows(sessionWith({ role: 'admin' }), {})).toBe(false)
  })

  it('denies a request naming a resource the dictionary does not have', () => {
    const unknown = {
      wardrobe: ['open'],
    } as unknown as PlatformPermissionRequest

    expect(allows(sessionWith({ role: 'admin' }), unknown)).toBe(false)
  })
})

describe('requirePermission returns nothing and decides everything in one place', () => {
  it('returns undefined when the actor holds the statement', () => {
    expect(
      requirePermission(sessionWith({ role: 'admin' }), { user: ['list'] }),
    ).toBeUndefined()
  })

  it('is a synchronous function, so nothing can run after a mutation inside it', () => {
    expect(requirePermission.constructor.name).toBe('Function')
    expect(requirePermission).toHaveLength(2)
  })

  const source = readFileSync(GUARD_MODULE, 'utf8')

  it('never names the dependency`s own permission check or its id-list bypass', () => {
    for (const forbidden of [
      'hasPermission',
      'userHasPermission',
      'adminUserIds',
    ]) {
      expect(source, forbidden).not.toContain(forbidden)
    }
  })

  it('contains no asynchronous work at all', () => {
    expect(source).not.toMatch(/\basync\b/)
    expect(source).not.toMatch(/\bawait\b/)
    expect(source).not.toMatch(/\bPromise\b/)
  })

  it('imports only the dictionary, the error vocabulary and one type', () => {
    // Every import in this file is written on one line, which is what makes this readable off the
    // source. A database client, a Better Auth instance or a cache would all have to appear here
    // first, and a run-time import of anything but the first two is the tell.
    const specifiers = [...source.matchAll(/\bfrom\s*'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect([...new Set(specifiers)].sort()).toEqual([
      '#/server/db/types',
      './access',
      './tenant',
    ])
    // `#/server/db/types` is type-only, so it is erased before the module is ever evaluated.
    expect(source).toContain(
      "import type { PlatformActorKind } from '#/server/db/types'",
    )
  })
})
