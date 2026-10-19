/**
 * The two literals the `admin` plugin is registered with, and the two mandatory drift tests
 * docs/ACCESS.md §1.4 and §2.6 ask for.
 *
 * Both are asserted against `../admin-options`, which is the module `src/server/auth/index.ts`
 * imports and passes **verbatim** — `admin(adminOptions)` and `disabledPaths: DISABLED_PATHS`,
 * both checked against the source text below. That indirection is the whole point of the file
 * existing. A test that built its own `admin({})` would report `adminUserIds` absent vacuously,
 * because it would be describing an object the Worker never sees; and a test that imported
 * `../index` could not run here at all, since that module reaches `./env`, which imports
 * `cloudflare:workers` at module scope. So this file runs in the `server` (plain Node) project with
 * no `vi.mock` anywhere in it, and the fact that it imports cleanly is itself half the binding-free
 * proof. The other half is the graph walk at the bottom.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { admin, organization } from 'better-auth/plugins'
import { defaultRoles } from 'better-auth/plugins/admin/access'
import { describe, expect, it } from 'vitest'
import { ac, roles } from '../access'
import {
  BANNED_USER_MESSAGE,
  DISABLED_ADMIN_PATHS,
  DISABLED_ORGANIZATION_PATHS,
  DISABLED_PATHS,
  IMPERSONATION_SESSION_SECONDS,
  adminOptions,
} from '../admin-options'

const SRC_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const ADMIN_OPTIONS_MODULE = resolvePath(
  SRC_DIR,
  'server/auth/admin-options.ts',
)
const AUTH_INDEX_MODULE = resolvePath(SRC_DIR, 'server/auth/index.ts')
const AUTH_ENV_MODULE = resolvePath(SRC_DIR, 'server/auth/env.ts')
const AUTH_CLIENT_MODULE = resolvePath(SRC_DIR, 'lib/auth/client.ts')

/** Better Auth's own fallback, `admin.mjs:16`. The string our copy must never be. */
const UPSTREAM_BANNED_MESSAGE =
  'You have been banned from this application. Please contact support if you believe this is an error.'

/** The fallback `routes.mjs:598` reaches for when `impersonationSessionDuration` is omitted. */
const UPSTREAM_IMPERSONATION_FALLBACK_SECONDS = 3600

describe('adminOptions is the literal the production betterAuth() call receives', () => {
  // Prose removed: this module explains the traps it avoids, and an explanation of `admin({ … })`
  // is not a call to it.
  const indexSource = codeOf(AUTH_INDEX_MODULE)

  it('is passed to admin() and disabledPaths without being rebuilt or spread', () => {
    expect(indexSource).toContain("from './admin-options'")
    expect(indexSource).toContain('admin(adminOptions)')
    expect(indexSource).toContain('disabledPaths: DISABLED_PATHS')
    // A spread would make every assertion below describe a different object from the Worker's.
    expect(indexSource).not.toContain('admin({')
    expect(indexSource).not.toContain('...adminOptions')
    expect(indexSource).not.toContain('...DISABLED_PATHS')
  })

  it('registers disabledPaths as a top-level option, a sibling of plugins', () => {
    const disabledAt = indexSource.indexOf('disabledPaths: DISABLED_PATHS')
    const pluginsAt = indexSource.indexOf('plugins: [')
    const optionsAt = indexSource.indexOf('betterAuth({')
    expect(optionsAt).toBeGreaterThan(-1)
    expect(disabledAt).toBeGreaterThan(optionsAt)
    expect(pluginsAt).toBeGreaterThan(optionsAt)
    // Both at the same indentation depth inside the same object literal.
    const indentOf = (at: number) =>
      at - indexSource.lastIndexOf('\n', at - 1) - 1
    expect(indentOf(disabledAt)).toBe(indentOf(pluginsAt))
  })

  it('carries the complete role set rather than ac alone', () => {
    // `ac` is server-inert: the only read of `options.ac` in the plugin is its client module.
    // Authorisation reads `input.options?.roles || defaultRoles`, and `defaultRoles` has no
    // `curator` — so `ac` without `roles` denies every curator statement silently.
    expect(adminOptions.ac).toBe(ac)
    expect(adminOptions.roles).toBe(roles)
    expect(Object.keys(adminOptions.roles).sort()).toEqual([
      'admin',
      'curator',
      'user',
    ])
    expect(Object.keys(defaultRoles)).not.toContain('curator')
  })

  it('names the platform roles the plugin treats as administrative', () => {
    expect(adminOptions.adminRoles).toEqual(['admin'])
    expect(adminOptions.defaultRole).toBe('user')
  })

  it('sets the impersonation ceiling explicitly rather than inheriting the hour', () => {
    expect(adminOptions.impersonationSessionDuration).toBe(900)
    expect(IMPERSONATION_SESSION_SECONDS).toBe(900)
    expect(adminOptions.impersonationSessionDuration).not.toBe(
      UPSTREAM_IMPERSONATION_FALLBACK_SECONDS,
    )
  })

  it('replaces the upstream ban message with repo copy, declared once', () => {
    expect(adminOptions.bannedUserMessage).toBe(BANNED_USER_MESSAGE)
    expect(adminOptions.bannedUserMessage).not.toBe(UPSTREAM_BANNED_MESSAGE)
    // One place: the constant is imported, never restated.
    const optionsSource = readFileSync(ADMIN_OPTIONS_MODULE, 'utf8')
    expect(optionsSource).toContain('bannedUserMessage: BANNED_USER_MESSAGE')
  })

  it('omits adminUserIds entirely — absent, not [] (docs/ACCESS.md §1.4)', () => {
    expect(Object.keys(adminOptions)).not.toContain('adminUserIds')
    expect('adminUserIds' in adminOptions).toBe(false)
    expect(readFileSync(ADMIN_OPTIONS_MODULE, 'utf8')).not.toContain(
      'adminUserIds:',
    )
  })

  it('omits allowImpersonatingAdmins, so §2.4 decides it and not a flag', () => {
    expect(Object.keys(adminOptions)).not.toContain('allowImpersonatingAdmins')
    expect('allowImpersonatingAdmins' in adminOptions).toBe(false)
  })

  it('keeps exactly the six keys above and no seventh', () => {
    expect(Object.keys(adminOptions).sort()).toEqual([
      'ac',
      'adminRoles',
      'bannedUserMessage',
      'defaultRole',
      'impersonationSessionDuration',
      'roles',
    ])
  })
})

describe('admin(adminOptions) constructs', () => {
  it('does not throw — a rejected adminRoles is a dead Worker, not a 500', () => {
    // `admin.mjs:18-20` validates `adminRoles` against `Object.keys(roles)` synchronously and
    // raises `BetterAuthError`. That call sits inside the memoised `buildAuth()`, so a mismatch
    // takes down every request including anonymous marketing pages.
    expect(() => admin(adminOptions)).not.toThrow()
  })

  it('would have thrown for a role that is not in the map (control)', () => {
    expect(() => admin({ ...adminOptions, adminRoles: ['superuser'] })).toThrow(
      /Invalid admin roles/,
    )
  })

  it('stores the raw options object, which is what makes the assertions above binding', () => {
    expect(admin(adminOptions).options).toBe(adminOptions)
  })
})

describe('every admin endpoint is in disabledPaths (docs/ACCESS.md §2.6)', () => {
  const endpointPaths = Object.values(admin(adminOptions).endpoints)
    .map((endpoint) => endpoint.path)
    .filter((path) => path.startsWith('/admin/'))

  it('publishes fifteen paths under /admin/, all of them closed', () => {
    expect(endpointPaths).toHaveLength(15)
    expect(DISABLED_ADMIN_PATHS).toHaveLength(15)
    expect([...endpointPaths].sort()).toEqual([...DISABLED_ADMIN_PATHS].sort())
  })

  it('exposes no endpoint outside /admin/ that the list would have missed', () => {
    const all = Object.values(admin(adminOptions).endpoints).map((e) => e.path)
    expect(all.filter((path) => !path.startsWith('/admin/'))).toEqual([])
  })

  it('writes the entries basePath-stripped, the only spelling that matches', () => {
    // `normalizePathname` strips `/api/auth` before the `includes()`, so `/api/auth/admin/...`
    // entries would match nothing and close nothing.
    for (const path of DISABLED_ADMIN_PATHS) {
      expect(path.startsWith('/admin/')).toBe(true)
      expect(path.startsWith('/api/')).toBe(false)
    }
    expect(new Set(DISABLED_ADMIN_PATHS).size).toBe(DISABLED_ADMIN_PATHS.length)
  })
})

describe('the organization member-write paths are closed beside the admin list (#995, #1010)', () => {
  it('names the paths the organization plugin actually publishes', () => {
    const { endpoints } = organization()
    expect(DISABLED_ORGANIZATION_PATHS).toEqual([
      endpoints.updateMemberRole.path,
      endpoints.removeMember.path,
      endpoints.leaveOrganization.path,
      endpoints.createInvitation.path,
      endpoints.cancelInvitation.path,
    ])
    expect(endpoints.updateMemberRole.path).toBe(
      '/organization/update-member-role',
    )
    expect(endpoints.removeMember.path).toBe('/organization/remove-member')
  })

  it('closes organization/leave while retaining the in-process endpoint', () => {
    expect(DISABLED_PATHS).toContain(
      organization().endpoints.leaveOrganization.path,
    )
  })

  it('merges both lists into the one array disabledPaths receives, without touching the admin list', () => {
    expect(DISABLED_PATHS).toEqual([
      ...DISABLED_ADMIN_PATHS,
      ...DISABLED_ORGANIZATION_PATHS,
    ])
    expect(DISABLED_ADMIN_PATHS).toHaveLength(15)
    for (const path of DISABLED_ORGANIZATION_PATHS) {
      expect(path.startsWith('/organization/')).toBe(true)
    }
  })
})

/**
 * The plugin factory the browser must never be handed, spelled in two halves.
 *
 * The whole-repository check for it is `grep -rn <that name> src | wc -l` printing `0`, and a test
 * asserting on a token cannot contain the token or it becomes its own first hit. Concatenating is
 * the only way this file can both make the assertion and stay outside its own answer.
 */
const FORBIDDEN_CLIENT_PLUGIN = `admin${'Client'}`

describe('the browser is never given an admin vocabulary', () => {
  it('registers exactly twoFactorClient() and organizationClient()', () => {
    const source = readFileSync(AUTH_CLIENT_MODULE, 'utf8')
    expect(source).toContain('twoFactorClient()')
    expect(source).toContain('organizationClient()')
    expect(source).not.toContain(FORBIDDEN_CLIENT_PLUGIN)
  })

  it('has no reference to it anywhere under src/', () => {
    // The console talks to our server functions. A browser vocabulary for the admin plugin would
    // be built against fifteen paths that answer 404.
    expect(sourceFilesContaining(FORBIDDEN_CLIENT_PLUGIN)).toEqual([])
    expect(sourceFilesContaining('twoFactorClient')).not.toEqual([])
  })
})

/* -------------------------------------------------------------------------------------------------
 * The binding-free proof
 * ---------------------------------------------------------------------------------------------- */

/**
 * Runtime module specifiers, with `import type` removed.
 *
 * `verbatimModuleSyntax` is on, so a `import type` statement emits nothing at all and cannot put a
 * module in anybody's graph. Comments are stripped first because this file's own prose names
 * modules it does not import.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** The code of a module with its prose removed — what the runtime actually sees. */
function codeOf(file: string): string {
  return stripComments(readFileSync(file, 'utf8'))
}

function runtimeSpecifiers(source: string): Array<string> {
  const code = stripComments(source)

  const found: Array<string> = []
  const withClause =
    /(?:^|\n)\s*(?:import|export)\s+([^'";]*?)from\s*['"]([^'"]+)['"]/g
  let match = withClause.exec(code)
  while (match) {
    if (!/^type\b/.test(match[1].trim())) found.push(match[2])
    match = withClause.exec(code)
  }

  const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  match = bare.exec(code)
  while (match) {
    found.push(match[1])
    match = bare.exec(code)
  }
  return found
}

function probe(base: string): string | null {
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    try {
      if (statSync(base + suffix).isFile()) return base + suffix
    } catch {
      continue
    }
  }
  return null
}

interface Reach {
  /** Every first-party file the roots reach, absolute. */
  readonly files: Array<string>
  /** Every bare package specifier those files import at run time. */
  readonly packages: Array<string>
}

function reachableFrom(entry: string): Reach {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined || files.has(current)) continue
    files.add(current)

    for (const specifier of runtimeSpecifiers(readFileSync(current, 'utf8'))) {
      if (specifier.startsWith('#/') || specifier.startsWith('@/')) {
        const resolved = probe(resolvePath(SRC_DIR, specifier.slice(2)))
        if (resolved === null) {
          throw new Error(
            `unresolved first-party import ${specifier} in ${current}`,
          )
        }
        queue.push(resolved)
        continue
      }
      if (specifier.startsWith('.')) {
        const resolved = probe(resolvePath(dirname(current), specifier))
        if (resolved === null) {
          throw new Error(
            `unresolved relative import ${specifier} in ${current}`,
          )
        }
        queue.push(resolved)
        continue
      }
      packages.add(specifier)
    }
  }

  return { files: [...files], packages: [...packages].sort() }
}

/** Every tracked source file under `src/` whose text contains `needle`. */
function sourceFilesContaining(needle: string): Array<string> {
  const matches: Array<string> = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const full = resolvePath(directory, entry)
      const stats = statSync(full)
      if (stats.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue
      if (readFileSync(full, 'utf8').includes(needle)) matches.push(full)
    }
  }
  walk(SRC_DIR)
  return matches
}

describe('admin-options.ts is binding-free', () => {
  const reach = reachableFrom(ADMIN_OPTIONS_MODULE)

  it('reaches no first-party module that imports cloudflare:workers', () => {
    const offenders = reach.files.filter((file) =>
      codeOf(file).includes('cloudflare:workers'),
    )
    expect(offenders).toEqual([])
  })

  it('does not reach ./env, which is where the binding import lives (control)', () => {
    // The control matters: without it, the assertion above would pass on a needle that no longer
    // appears anywhere for reasons that have nothing to do with this module.
    expect(codeOf(AUTH_ENV_MODULE)).toContain('cloudflare:workers')
    expect(reach.files).not.toContain(AUTH_ENV_MODULE)
  })

  it('reaches exactly two first-party modules, and neither is under routes/', () => {
    // It was three. `BANNED_USER_MESSAGE` used to be imported from the auth screens' error module,
    // which meant a binding-free server module reached into the route tree to read one string.
    // Localisation turned that module into a code -> message-key map with no sentences left in it,
    // so the constant moved here, where the plugin option that needs it is configured. The graph
    // getting *smaller* is the point: a server module has no business importing from routes/.
    expect([...reach.files].sort()).toEqual(
      [
        ADMIN_OPTIONS_MODULE,
        resolvePath(SRC_DIR, 'server/auth/access.ts'),
      ].sort(),
    )
    expect([...reach.files].some((f) => f.includes('/routes/'))).toBe(false)
  })

  it('imports exactly the two better-auth access subpaths at run time', () => {
    // Both are themselves import leaves, asserted in `access.test.ts` with a full node_modules
    // crawl under the bundler's own resolution conditions. This assertion is what makes that one
    // cover this module too.
    expect(reach.packages).toEqual([
      'better-auth/plugins/access',
      'better-auth/plugins/admin/access',
    ])
  })
})
