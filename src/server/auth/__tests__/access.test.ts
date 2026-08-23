/**
 * The dictionary, the grid, and the two invariants nothing in the toolchain enforces.
 *
 * `eslint.config.js` has no import-restriction rule and `ac.newRole()` validates nothing at run
 * time, so both properties this file asserts are enforced here or nowhere:
 *
 * - **The import leaf.** `access.ts` is read by the console, the guard and Faza E's MCP server,
 *   which is only safe while the file and everything it reaches are free of `node:` builtins and
 *   Worker bindings. A third import specifier, or a dependency bump that pulls `node:crypto` into
 *   the access-control module, fails here.
 * - **The subset.** TypeScript's `RoleInput` does reject a misspelt action in an inline role
 *   literal — `catalog: ['publsh']` is a compile error today, and that was verified rather than
 *   assumed. What it cannot see is `user: ['ban']` on `curator`: a perfectly valid subset of the
 *   dictionary, a silent grant, and a green build. The run-time check below covers both halves and
 *   keeps covering them if a later role is ever built through a cast or a widened variable.
 */

import { createRequire, isBuiltin } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'
import { describe, expect, it } from 'vitest'
import {
  PLATFORM_ROLES_BY_PRECEDENCE,
  ac,
  adminRole,
  curatorRole,
  isPlatformRole,
  resolvePlatformRole,
  roles,
  statement,
  userRole,
} from '#/server/auth/access'

const ACCESS_MODULE = join(process.cwd(), 'src', 'server', 'auth', 'access.ts')

/** docs/ACCESS.md §1.1, printed there and copied here as a literal on purpose. */
const UPSTREAM_USER_ACTIONS = [
  'create',
  'list',
  'set-role',
  'ban',
  'impersonate',
  'impersonate-admins',
  'delete',
  'set-password',
  'set-email',
  'get',
  'update',
]

const UPSTREAM_SESSION_ACTIONS = ['list', 'revoke', 'delete']

describe('statement — the upstream half', () => {
  it('deep-equals the eleven `user` actions docs/ACCESS.md §1.1 is written against', () => {
    expect(statement.user).toEqual(UPSTREAM_USER_ACTIONS)
  })

  it('deep-equals the three `session` actions', () => {
    expect(statement.session).toEqual(UPSTREAM_SESSION_ACTIONS)
  })

  it('takes both arrays from the spread rather than restating them', () => {
    // If the spread were ever replaced by a local copy the two assertions above would still pass
    // while the drift they exist to catch became undetectable.
    expect(statement.user).toEqual(defaultStatements.user)
    expect(statement.session).toEqual(defaultStatements.session)
  })
})

describe('statement — our half', () => {
  it('is closed at six resources', () => {
    expect(Object.keys(statement)).toEqual([
      'user',
      'session',
      'catalog',
      'pack',
      'source',
      'share',
    ])
  })

  it('carries the four resources docs/ACCESS.md §1.1 declares', () => {
    expect(statement.catalog).toEqual(['read', 'write', 'publish'])
    expect(statement.pack).toEqual(['read', 'write', 'publish'])
    expect(statement.source).toEqual(['read', 'run'])
    expect(statement.share).toEqual(['read', 'revoke'])
  })

  it('totals twenty-four statements, the grid docs/ACCESS.md §2 enumerates', () => {
    const total = Object.values(statement).reduce(
      (sum, actions) => sum + actions.length,
      0,
    )
    expect(total).toBe(24)
  })

  it('is the object the access controller was built from', () => {
    expect(ac.statements).toBe(statement)
  })
})

describe('roles', () => {
  it('is the complete three-name set and nothing else', () => {
    expect(Object.keys(roles)).toEqual(['admin', 'curator', 'user'])
    expect(roles.admin).toBe(adminRole)
    expect(roles.curator).toBe(curatorRole)
    expect(roles.user).toBe(userRole)
  })

  it('grants `admin` everything except `user:impersonate-admins`', () => {
    expect(adminRole.statements.user).toEqual([
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
    ])
    expect(adminRole.statements.user).not.toContain('impersonate-admins')
    expect(adminRole.statements.session).toEqual(['list', 'revoke', 'delete'])
    expect(adminRole.statements.catalog).toEqual(['read', 'write', 'publish'])
    expect(adminRole.statements.pack).toEqual(['read', 'write', 'publish'])
    expect(adminRole.statements.source).toEqual(['read', 'run'])
    expect(adminRole.statements.share).toEqual(['read', 'revoke'])
  })

  it('gives `curator` the four content resources and nothing on users or sessions', () => {
    expect(curatorRole.statements.user).toEqual([])
    expect(curatorRole.statements.session).toEqual([])
    expect(curatorRole.statements.catalog).toEqual(['read', 'write', 'publish'])
    expect(curatorRole.statements.pack).toEqual(['read', 'write', 'publish'])
    expect(curatorRole.statements.source).toEqual(['read', 'run'])
    expect(curatorRole.statements.share).toEqual(['read', 'revoke'])
  })

  it('gives `user` nothing at all, on every one of the six resources', () => {
    const granted: Record<string, ReadonlyArray<string>> = userRole.statements

    for (const resource of Object.keys(statement)) {
      expect(granted[resource]).toEqual([])
    }
  })

  it('builds `admin` from `statement` rather than inheriting `adminAc`', () => {
    // `adminAc` happens to omit `impersonate-admins` too, which is exactly why inheriting it would
    // look right: the omission would be the dependency's opinion rather than docs/ACCESS.md §2.4's,
    // and it would follow the dependency the day it changes. The tell is the four resources
    // `adminAc` has never heard of.
    expect(adminRole).not.toBe(adminAc)
    expect(Object.keys(adminAc.statements)).toEqual(['user', 'session'])
    expect(Object.keys(adminRole.statements)).toEqual(Object.keys(statement))
  })

  it('declares every one of the six resources on every role', () => {
    // An omitted resource key denies too, but by falling through Better Auth's unknown-resource
    // branch rather than by a decision this repository made.
    for (const role of Object.values(roles)) {
      expect(Object.keys(role.statements)).toEqual(Object.keys(statement))
    }
  })

  it('grants no action that is not in the dictionary', () => {
    const dictionary: Record<string, ReadonlyArray<string>> = statement

    for (const [name, role] of Object.entries(roles)) {
      for (const [resource, actions] of Object.entries(role.statements)) {
        expect(
          Object.hasOwn(dictionary, resource),
          `${name} declares unknown resource "${resource}"`,
        ).toBe(true)

        for (const action of actions) {
          expect(
            dictionary[resource],
            `${name} grants "${resource}:${action}"`,
          ).toContain(action)
        }
      }
    }
  })
})

describe('resolvePlatformRole', () => {
  it('reads null as `user`, never as unset-therefore-permissive', () => {
    expect(resolvePlatformRole(null)).toBe('user')
  })

  it('reads an unrecognised value as `user`', () => {
    expect(resolvePlatformRole('wizard')).toBe('user')
    expect(resolvePlatformRole('')).toBe('user')
    expect(resolvePlatformRole('Admin')).toBe('user')
  })

  it('takes the strongest name out of a comma-joined column', () => {
    expect(resolvePlatformRole('curator,user')).toBe('curator')
    expect(resolvePlatformRole('user,curator')).toBe('curator')
    expect(resolvePlatformRole('user,admin')).toBe('admin')
    expect(resolvePlatformRole('curator,admin')).toBe('admin')
    expect(resolvePlatformRole(' curator , user ')).toBe('curator')
    expect(resolvePlatformRole('wizard,curator')).toBe('curator')
  })

  it('orders the three names by precedence, strongest first', () => {
    expect(PLATFORM_ROLES_BY_PRECEDENCE).toEqual(['admin', 'curator', 'user'])
  })

  it('recognises exactly the three role names', () => {
    expect(isPlatformRole('admin')).toBe(true)
    expect(isPlatformRole('curator')).toBe(true)
    expect(isPlatformRole('user')).toBe(true)
    expect(isPlatformRole('wizard')).toBe(false)
    expect(isPlatformRole('toString')).toBe(false)
    expect(isPlatformRole(null)).toBe(false)
  })
})

/** Every way a module specifier can appear in ESM or CJS source. */
const SPECIFIER_PATTERNS: ReadonlyArray<RegExp> = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function specifiersIn(source: string): Array<string> {
  const found: Array<string> = []
  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(source)
    while (match) {
      found.push(match[1])
      match = pattern.exec(source)
    }
  }
  return found
}

interface Graph {
  readonly files: Array<string>
  readonly builtins: Array<string>
  readonly unresolved: Array<string>
}

/** Breadth-first over everything the two roots reach, resolved the way Node resolves it. */
function reachableFrom(roots: ReadonlyArray<string>, importer: string): Graph {
  const files = new Set<string>()
  const builtins = new Set<string>()
  const unresolved: Array<string> = []
  const queue: Array<[string, string]> = roots.map((root) => [root, importer])

  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    const [specifier, from] = next

    if (isBuiltin(specifier)) {
      builtins.add(`${specifier} (imported by ${from})`)
      continue
    }

    let resolved: string
    try {
      resolved = createRequire(from).resolve(specifier)
    } catch {
      unresolved.push(`${specifier} (imported by ${from})`)
      continue
    }

    if (files.has(resolved)) continue
    files.add(resolved)

    for (const specifierFound of specifiersIn(readFileSync(resolved, 'utf8'))) {
      queue.push([specifierFound, resolved])
    }
  }

  return { files: [...files], builtins: [...builtins], unresolved }
}

describe('access.ts is an import leaf', () => {
  const source = readFileSync(ACCESS_MODULE, 'utf8')

  it('imports exactly the two better-auth access subpaths', () => {
    expect(specifiersIn(source).sort()).toEqual([
      'better-auth/plugins/access',
      'better-auth/plugins/admin/access',
    ])
  })

  it('reaches no `node:` builtin, so it is safe in a browser bundle', () => {
    const graph = reachableFrom(
      ['better-auth/plugins/access', 'better-auth/plugins/admin/access'],
      ACCESS_MODULE,
    )

    expect(graph.unresolved).toEqual([])
    expect(graph.builtins).toEqual([])
    // A walker that resolves nothing also reports no builtins. Both roots and their internals are
    // real files, so a graph this small would mean the crawl stopped early.
    expect(graph.files.length).toBeGreaterThanOrEqual(4)
  })

  it('has a builtin detector that detects builtins', () => {
    // The positive control for the assertion above: the same crawl, pointed at a root that does
    // reach `node:` code, has to come back red.
    const control = reachableFrom(['node:path'], ACCESS_MODULE)

    expect(control.builtins).toHaveLength(1)
    expect(control.files).toEqual([])
  })
})
