/**
 * The dictionary, the grid, and the two invariants nothing in the toolchain enforces.
 *
 * `eslint.config.js` has no import-restriction rule and `ac.newRole()` validates nothing at run
 * time, so both properties this file asserts are enforced here or nowhere:
 *
 * - **The import leaf.** `access.ts` is read by the console, the guard and Faza E's MCP server,
 *   which is only safe while the file and everything it reaches are free of `node:` builtins and
 *   Worker bindings. A third import specifier, or a dependency bump that pulls `node:crypto` into
 *   the access-control module, fails here. The graph is walked under the conditions the *bundler*
 *   resolves with, not Node's `require` conditions: those two graphs already differ inside
 *   `better-call`, and a builtin reached only down the ESM branch is precisely what a
 *   `require`-shaped crawl cannot see.
 * - **The subset.** `ac.newRole()` validates nothing at run time, so what a role declares is
 *   checked here. Two different mistakes, and this file catches one of them:
 *   `catalog: ['publsh']` — an action outside the dictionary — is what the subset loop below
 *   exists for, and it keeps being caught if a later role is ever assembled through a cast or a
 *   widened variable, where TypeScript's `RoleInput` stops looking. What the subset loop cannot
 *   catch is `user: ['ban']` on `curator`: `ban` *is* a member of `statement.user`, so a
 *   membership check passes it. That mistake is a grid violation rather than a dictionary
 *   violation, and it is caught twice elsewhere — by the per-role assertions below, which pin
 *   `curatorRole.statements.user` to `[]`, and by the seventy-two-cell matrix in `guard.test.ts`.
 */

import { isBuiltin } from 'node:module'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
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
    // Reference identity, not deep equality: a hand-written local copy of the eleven names is deep
    // equal to the upstream array by construction, so `toEqual` here would pass on exactly the
    // change it exists to reject, and the drift test above would go on comparing a literal with a
    // literal. Spreading an object copies the array *references*, so `toBe` holds while — and only
    // while — the spread is what put them there.
    expect(statement.user).toBe(defaultStatements.user)
    expect(statement.session).toBe(defaultStatements.session)
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
    // Membership only. `catalog: ['publsh']` and a resource key nobody declared both fail here;
    // `user: ['ban']` on `curator` does not, because `ban` is a member of `statement.user` — that
    // one is the grid's business and is pinned by the three per-role assertions above and by the
    // matrix in `guard.test.ts`.
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
    expect(resolvePlatformRole('wizard,curator')).toBe('curator')
  })

  it('splits the column exactly as better-auth does, without trimming', () => {
    // `hasPermission` in the pinned plugin does `(role || defaultRole || 'user').split(',')` and
    // no trim, so `' admin '` is an undeclared role to it. Trimming here would make one stored
    // string mean `admin` in this guard and `user` inside the dependency that runs on the same
    // request — a divergence in the permissive direction. docs/ACCESS.md §1.3 step 3 settles it:
    // a string that is not one of the three resolves to `user`.
    expect(resolvePlatformRole(' admin ')).toBe('user')
    expect(resolvePlatformRole('admin ')).toBe('user')
    expect(resolvePlatformRole(' curator , user ')).toBe('user')
    expect(resolvePlatformRole('curator, admin')).toBe('curator')
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

/**
 * The conditions the shipped bundles resolve with.
 *
 * Node's `require` is not one of them, and the difference is not academic: under `require` this
 * crawl walks `better-call/dist/error.cjs`, while both bundles walk `error.mjs`. Two graphs, one
 * of which nothing else in the repository looks at. A `node:` builtin introduced on the ESM side
 * alone is exactly the change the leaf property exists to refuse, and exactly the change a
 * `require`-shaped crawl reports as clean — so the resolver below reads `package.json#exports`
 * with the condition set the bundler uses instead of asking Node.
 */
const BROWSER_CONDITIONS: ReadonlyArray<string> = [
  'browser',
  'module',
  'import',
  'default',
]

const WORKER_CONDITIONS: ReadonlyArray<string> = [
  'workerd',
  'worker',
  'browser',
  'module',
  'import',
  'default',
]

/** Node's own conditions, used only as the control that proves the list above steers anything. */
const NODE_CONDITIONS: ReadonlyArray<string> = [
  'node',
  'module',
  'import',
  'default',
]

interface ExportsConditions {
  readonly [condition: string]: ExportsTarget
}

type ExportsTarget =
  string | null | ReadonlyArray<ExportsTarget> | ExportsConditions

interface PackageManifest {
  readonly exports?: ExportsTarget
  readonly module?: string
  readonly main?: string
}

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

/** The nearest `node_modules/<name>` above `fromDirectory`, pnpm symlinks and all. */
function packageDirectory(name: string, fromDirectory: string): string | null {
  let directory = fromDirectory
  for (;;) {
    const candidate = join(directory, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate

    const parent = dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

function isConditionMap(target: ExportsTarget): target is ExportsConditions {
  return typeof target === 'object' && target !== null && !Array.isArray(target)
}

/**
 * One branch of an `exports` value, under `conditions`. Declaration order decides, which is why
 * `dev-source` and `types` — both of which sit *above* `default` in `better-auth`'s map — have to
 * be absent from the condition list rather than merely ranked below it.
 */
function selectTarget(
  target: ExportsTarget,
  wildcard: string,
  conditions: ReadonlyArray<string>,
): string | null {
  if (typeof target === 'string') return target.replaceAll('*', wildcard)
  if (target === null) return null

  if (Array.isArray(target)) {
    for (const fallback of target) {
      const picked = selectTarget(fallback, wildcard, conditions)
      if (picked !== null) return picked
    }
    return null
  }

  for (const [condition, value] of Object.entries(target)) {
    if (condition !== 'default' && !conditions.includes(condition)) continue

    const picked = selectTarget(value, wildcard, conditions)
    if (picked !== null) return picked
  }
  return null
}

/** `exports` as a whole: the sugared form, the subpath map, and `*` patterns, longest prefix wins. */
function targetFor(
  exportsField: ExportsTarget,
  subpath: string,
  conditions: ReadonlyArray<string>,
): string | null {
  if (!isConditionMap(exportsField)) {
    return subpath === '.' ? selectTarget(exportsField, '', conditions) : null
  }

  const map = exportsField
  if (!Object.keys(map).some((key) => key.startsWith('.'))) {
    // The sugared form: conditions straight off `exports`, no subpaths at all.
    return subpath === '.' ? selectTarget(map, '', conditions) : null
  }

  if (Object.hasOwn(map, subpath)) {
    return selectTarget(map[subpath], '', conditions)
  }

  let best: { readonly key: string; readonly wildcard: string } | null = null
  let bestPrefixLength = -1

  for (const key of Object.keys(map)) {
    const star = key.indexOf('*')
    if (star === -1) continue

    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue
    if (subpath.length < prefix.length + suffix.length) continue
    if (prefix.length <= bestPrefixLength) continue

    bestPrefixLength = prefix.length
    best = {
      key,
      wildcard: subpath.slice(prefix.length, subpath.length - suffix.length),
    }
  }

  return best === null
    ? null
    : selectTarget(map[best.key], best.wildcard, conditions)
}

const FILE_PROBES: ReadonlyArray<string> = [
  '',
  '.mjs',
  '.js',
  '/index.mjs',
  '/index.js',
]

/** A real file or nothing — a directory is not a module, and a miss is reported, never guessed. */
function probeFile(base: string): string | null {
  for (const suffix of FILE_PROBES) {
    const candidate = base + suffix
    try {
      if (statSync(candidate).isFile()) return realpathSync(candidate)
    } catch {
      continue
    }
  }
  return null
}

function resolveUnder(
  specifier: string,
  importer: string,
  conditions: ReadonlyArray<string>,
): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return probeFile(resolvePath(dirname(importer), specifier))
  }

  const segments = specifier.split('/')
  const name = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0]

  const directory = packageDirectory(name, dirname(importer))
  if (directory === null) return null

  const manifest = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  ) as PackageManifest

  const subpath =
    specifier.length === name.length ? '.' : `.${specifier.slice(name.length)}`

  if (manifest.exports !== undefined) {
    const target = targetFor(manifest.exports, subpath, conditions)
    return target === null ? null : probeFile(join(directory, target))
  }

  if (subpath === '.') {
    return probeFile(
      join(directory, manifest.module ?? manifest.main ?? 'index.js'),
    )
  }
  return probeFile(join(directory, subpath))
}

interface Graph {
  readonly files: Array<string>
  readonly builtins: Array<string>
  readonly unresolved: Array<string>
}

/** Breadth-first over everything the roots reach, resolved the way the bundler resolves it. */
function reachableFrom(
  roots: ReadonlyArray<string>,
  importer: string,
  conditions: ReadonlyArray<string>,
): Graph {
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

    const resolved = resolveUnder(specifier, from, conditions)
    if (resolved === null) {
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

const ACCESS_ROOTS: ReadonlyArray<string> = [
  'better-auth/plugins/access',
  'better-auth/plugins/admin/access',
]

describe('access.ts is an import leaf', () => {
  const source = readFileSync(ACCESS_MODULE, 'utf8')

  it('imports exactly the two better-auth access subpaths', () => {
    expect(specifiersIn(source).sort()).toEqual([...ACCESS_ROOTS])
  })

  it.each([
    ['a browser bundle', BROWSER_CONDITIONS],
    ['the Worker runtime', WORKER_CONDITIONS],
  ])('reaches no `node:` builtin in %s', (_target, conditions) => {
    const graph = reachableFrom(ACCESS_ROOTS, ACCESS_MODULE, conditions)

    expect(graph.unresolved).toEqual([])
    expect(graph.builtins).toEqual([])
    // A walker that resolves nothing also reports no builtins. Both roots and their internals are
    // real files, so a graph this small would mean the crawl stopped early.
    expect(graph.files.length).toBeGreaterThanOrEqual(4)
    // And it has to have left `better-auth` — the hop into `@better-auth/core` and `better-call` is
    // where the two resolution graphs diverge in the first place.
    expect(
      new Set(
        graph.files.map(
          (file) => file.split('/node_modules/').at(-1)?.split('/dist/')[0],
        ),
      ).size,
    ).toBeGreaterThanOrEqual(2)
    // Every module in it is the ESM build. Nothing here resolved through a `require` branch.
    expect(graph.files.filter((file) => !file.endsWith('.mjs'))).toEqual([])
  })

  it('resolves under the condition set it is given, not under Node`s', () => {
    // The control for the assertion above, and the whole point of hand-rolling the resolver: one
    // specifier, two condition sets, two different files. A crawl that quietly fell back to Node
    // would answer `index.js` to both and would keep reporting a clean graph while walking a build
    // nothing ships.
    const browser = resolveUnder('nanoid', ACCESS_MODULE, BROWSER_CONDITIONS)
    const node = resolveUnder('nanoid', ACCESS_MODULE, NODE_CONDITIONS)

    expect(browser).toMatch(/\/nanoid\/index\.browser\.js$/)
    expect(node).toMatch(/\/nanoid\/index\.js$/)
  })

  it('has a builtin detector that detects builtins', () => {
    // The second control: the same crawl, pointed at a root that does reach `node:` code, has to
    // come back red.
    const control = reachableFrom(
      ['node:path'],
      ACCESS_MODULE,
      BROWSER_CONDITIONS,
    )

    expect(control.builtins).toHaveLength(1)
    expect(control.files).toEqual([])
  })

  it('reports a specifier it cannot resolve rather than passing over it', () => {
    // The third: `unresolved` being empty above has to mean "everything resolved", not "the
    // resolver returns something for anything".
    const control = reachableFrom(
      ['nowhere/at/all'],
      ACCESS_MODULE,
      BROWSER_CONDITIONS,
    )

    expect(control.unresolved).toHaveLength(1)
    expect(control.files).toEqual([])
  })
})
