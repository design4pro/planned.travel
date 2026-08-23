/**
 * The platform access dictionary and the three platform roles (docs/ACCESS.md §1, §2).
 *
 * One object, read by three consumers that cannot share a runtime: the console screens, the
 * permission guard in `./guard`, and the MCP server. That is why this file has exactly two import
 * specifiers and why neither of them reaches a Worker binding, a database or a `node:` builtin —
 * it has to be safe to evaluate in a browser bundle and in `workerd` alike. A third import is a
 * change to that property, and `__tests__/access.test.ts` fails when one appears.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * - `statement` spreads Better Auth's `defaultStatements`. That is convenient and it is also how a
 *   dependency bump could widen our grid without anyone deciding to: a future `user` action would
 *   be granted to every role that enumerates `user` actions. The drift test deep-equals both
 *   upstream arrays against literals, so a bump fails a test instead of shipping a statement
 *   nobody ruled on.
 * - The roles are built from `statement` and never from `adminAc`. Better Auth's own admin role
 *   omits `user:impersonate-admins`, which happens to be the decision docs/ACCESS.md §2.4 reaches
 *   as well — but reaching it by inheritance would mean the omission was the dependency's opinion
 *   rather than ours, and would silently follow the dependency the day it changes its mind.
 */
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/admin/access'

/**
 * Six resources, twenty-four statements, closed (docs/ACCESS.md §1.1). A seventh resource or a new
 * action on an existing one is an amendment to that document and to the grid in its §2, in the
 * same commit — not a line added here on the way past.
 */
export const statement = {
  ...defaultStatements,
  catalog: ['read', 'write', 'publish'],
  pack: ['read', 'write', 'publish'],
  source: ['read', 'run'],
  share: ['read', 'revoke'],
} as const

export const ac = createAccessControl(statement)

export type PlatformStatement = typeof statement

/** One of the six resource names in {@link statement}. */
export type PlatformResource = keyof PlatformStatement

/**
 * What a caller asks the guard for: `{ catalog: ['write'] }`, `{ user: ['ban'] }`.
 *
 * Every listed action must be held for the request to succeed, and an empty request is a denial —
 * both are Better Auth's `authorize` semantics under its default `AND` connector, and neither is
 * re-implemented here.
 */
export type PlatformPermissionRequest = {
  readonly [Resource in PlatformResource]?: ReadonlyArray<
    PlatformStatement[Resource][number]
  >
}

/**
 * Full platform authority, minus one cell.
 *
 * `user:impersonate-admins` is granted to nobody, our own `admin` included (docs/ACCESS.md §2.4):
 * admin-on-admin impersonation is the one action with no accountability path left, because the
 * operator acquires full platform authority under a second identity that also holds it. The
 * statement stays in the dictionary so the guard denies it explicitly rather than falling through
 * an unknown key.
 */
export const adminRole = ac.newRole({
  user: [
    'create',
    'list',
    'set-role',
    'ban',
    'impersonate',
    'delete',
    'set-password',
    'set-email',
    'get',
    'update',
  ],
  session: ['list', 'revoke', 'delete'],
  catalog: ['read', 'write', 'publish'],
  pack: ['read', 'write', 'publish'],
  source: ['read', 'run'],
  share: ['read', 'revoke'],
})

/**
 * The catalogue, packs, sources and share moderation. Nothing that touches users or sessions.
 *
 * `user` and `session` are declared empty rather than omitted so that the denial is a statement
 * this file makes, and so the subset test has something to check on both halves of the grid.
 */
export const curatorRole = ac.newRole({
  user: [],
  session: [],
  catalog: ['read', 'write', 'publish'],
  pack: ['read', 'write', 'publish'],
  source: ['read', 'run'],
  share: ['read', 'revoke'],
})

/** Everyone else, which is nearly everyone. No platform surface at all — all twenty-four denied. */
export const userRole = ac.newRole({
  user: [],
  session: [],
  catalog: [],
  pack: [],
  source: [],
  share: [],
})

/**
 * The complete role set, and the only place the three role names are enumerated.
 *
 * Better Auth's `admin` plugin resolves `session.user.role` against whatever object it is handed,
 * so an incomplete map here is not a type error anywhere — a missing `curator` key simply denies
 * everything, quietly. Passing this whole object to the plugin and reading it in the guard is what
 * keeps one answer to "what may this role do".
 */
export const roles = {
  admin: adminRole,
  curator: curatorRole,
  user: userRole,
} as const

/** `admin`, `curator` or `user` — derived from {@link roles} so the vocabulary is declared once. */
export type PlatformRole = keyof typeof roles

/**
 * Most privileged first. `user.role` stores a comma-joined string for a multi-role account and
 * Better Auth splits it the same way, so `'curator,user'` has to resolve to the strongest name it
 * carries rather than to whichever one happens to be first.
 */
export const PLATFORM_ROLES_BY_PRECEDENCE = [
  'admin',
  'curator',
  'user',
] as const satisfies ReadonlyArray<PlatformRole>

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === 'string' && Object.hasOwn(roles, value)
}

/**
 * The `user.role` column as one of the three roles (docs/ACCESS.md §1.3, steps 2 and 3).
 *
 * `null` resolves to `user` because the migration that adds the column leaves every pre-existing
 * row null and the plugin only applies `defaultRole` at signup; an unrecognised value resolves to
 * `user` because deny-by-default is the only safe reading of a string nobody declared. Neither is
 * ever read as "unset, therefore permissive".
 */
export function resolvePlatformRole(role: string | null): PlatformRole {
  if (role === null) return 'user'

  const held = new Set(role.split(',').map((part) => part.trim()))
  return (
    PLATFORM_ROLES_BY_PRECEDENCE.find((candidate) => held.has(candidate)) ??
    'user'
  )
}
