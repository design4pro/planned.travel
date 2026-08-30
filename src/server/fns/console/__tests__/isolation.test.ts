/**
 * The boundaries this directory is defined by, asserted against the module graph rather than
 * against prose.
 *
 * Five of them, and each was a stated risk before it was a test:
 *
 * - **No tenant scope, ever.** SPEC §5: a console action has no organization, and handing the
 *   tenant layer a fabricated one to reach global rows "destroys the single guarantee it was built
 *   to give". Expressed as reachability, not as a grep, for the reason
 *   `src/server/catalog/__tests__/isolation.test.ts` gives at length: a grep can express a naming
 *   rule and cannot express "nothing this file reaches, at any depth, is the tenant repository",
 *   and two successive spellings of that grep passed while the graph grew.
 * - **One binding seam.** `cloudflare:workers` is imported by `./bindings` and by nothing else, so
 *   every other module in the directory can be driven with a fake environment — which is what makes
 *   the guard, the ordering and the audit append testable as themselves rather than as mocks.
 * - **The seam holds no query.** The same fact that makes `./bindings` unloadable in this project
 *   makes anything written inside it untestable, and a query nobody executes is a rule pinned to a
 *   copy of itself.
 * - **No Better Auth client.** The console talks to server functions. Giving the browser bundle an
 *   admin vocabulary would be building against fifteen paths that answer `404` (docs/ACCESS.md
 *   §2.6), and the exact search that closes it is reproduced here.
 * - **`getSetCookie()` and never `get('set-cookie')`.** The joined form is unparseable once a cookie
 *   carries an `Expires=` attribute, and impersonation sets six cookies at once.
 *
 * The walk uses the *Worker* condition list, because that is the graph the deployed bundle has.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  REPOSITORY_ROOT,
  WORKER_CONDITIONS,
  codeOf,
  moduleGraphFrom,
  modulesUnder,
} from '#/server/catalog/__tests__/module-graph'

const CONSOLE_DIR = join(REPOSITORY_ROOT, 'src/server/fns/console')
const TENANT_REPOS = join(REPOSITORY_ROOT, 'src/server/repos')
const TENANT_FNS_CONTEXT = join(REPOSITORY_ROOT, 'src/server/fns/context.ts')

/** Production modules only: a test fixture may legitimately name what production may not import. */
const productionModules = modulesUnder(CONSOLE_DIR, { tests: false })
const graph = moduleGraphFrom(productionModules, WORKER_CONDITIONS)

function sourceOf(file: string): string {
  return readFileSync(file, 'utf8')
}

/** Every production file's code with comments removed, so prose about a rule is not a violation. */
const productionCode = productionModules.map((file) => ({
  file,
  code: codeOf(sourceOf(file)),
}))

describe('the console directory reaches no tenant layer', () => {
  it('has a graph worth asserting on', () => {
    // A walk that silently resolved nothing would make every assertion below vacuous.
    expect(productionModules.length).toBeGreaterThanOrEqual(9)
    expect(graph.modules.length).toBeGreaterThan(productionModules.length)
    // One documented exception, and it is narrow. `src/lib/i18n/types.ts` imports a type from each
    // namespace it declares, and five of those namespace files have not landed yet — the parity
    // suite's own header says the catalogue "grows with the catalogue" and that a namespace with no
    // file has nothing to check. Those specifiers are unresolvable today by design, not because
    // this walk could not read them. Everything else must still resolve, or the assertions below
    // are vacuous.
    const pending = /\/lib\/i18n\/types\.ts\)$/
    expect(graph.unresolved.filter((entry) => !pending.test(entry))).toEqual([])
  })

  it('reaches no module under src/server/repos, at any depth', () => {
    const reached = graph.modules.filter((file) =>
      file.startsWith(`${TENANT_REPOS}/`),
    )
    expect(reached).toEqual([])
  })

  it('reaches the tenant server-function bootstrap not at all', () => {
    expect(graph.modules).not.toContain(TENANT_FNS_CONTEXT)
  })

  it('names neither the tenant bootstrap nor the tenant repository factory in code', () => {
    // The supplement to the structural check above: it catches a *re-implementation* rather than an
    // import. Comments are stripped first — this directory's own headers explain the rule by saying
    // what it forbids, and a raw substring search would call that a violation.
    const offenders = productionCode.filter(
      ({ code }) =>
        code.includes('appScope') ||
        code.includes('createTenantRepository') ||
        code.includes('TenantScope'),
    )
    expect(offenders.map((entry) => entry.file)).toEqual([])
  })
})

describe('the binding seam', () => {
  it('is one file', () => {
    const importers = graph.external
      .filter((edge) => edge.specifier === 'cloudflare:workers')
      .map((edge) => edge.importer)
      .filter((importer) => importer.startsWith(`${CONSOLE_DIR}/`))

    expect(importers).toEqual([join(CONSOLE_DIR, 'bindings.ts')])
  })

  it('holds no database query, because a query written there can only be tested against a copy', () => {
    // The measured reason this rule exists. `../bindings` cannot be loaded by the `server` project
    // at all, so the test that drives the console replaces it wholesale — and while the two adapter
    // queries lived there, the mock factory carried a restatement of both. Deleting the expiry
    // predicate or the `id` sort from the shipped file left every console test green, which made
    // two repairs pinned to those clauses unenforceable. Queries live in `./adapter-reads`, take
    // their adapter as an argument, and are executed by the tests as themselves.
    const offenders = productionCode.filter(
      ({ file, code }) =>
        file !== join(CONSOLE_DIR, 'adapter-reads.ts') &&
        (code.includes('findMany') || code.includes('findOne')),
    )
    expect(offenders.map((entry) => entry.file)).toEqual([])
  })
})

describe('the Better Auth client never appears', () => {
  it('prints zero for the search that closes docs/ACCESS.md §2.6', () => {
    // The search from this item's acceptance, run over the directory's whole text — comments
    // included, because a commented-out call to one of the fifteen closed HTTP paths is an
    // invitation rather than an explanation.
    // Assembled rather than written out: this file is inside the directory it scans, and a check
    // that supplies the string whose absence it asserts is how a check ends up silenced.
    const needles = [
      `admin${'Client'}`,
      `auth${'Client'}`,
      `fetch('/api/${'auth'}`,
    ]
    const hits = modulesUnder(CONSOLE_DIR, { tests: true }).flatMap((file) => {
      const source = sourceOf(file)
      return needles.filter((needle) => source.includes(needle)).map(() => file)
    })
    expect(hits).toEqual([])
  })
})

describe('Set-Cookie is read the only way that survives six values', () => {
  it('uses getSetCookie and never Headers#get', () => {
    const offenders = productionCode.filter(
      ({ code }) =>
        code.includes(".get('set-cookie')") ||
        code.includes('.get("set-cookie")') ||
        code.includes(".get('Set-Cookie')"),
    )
    expect(offenders.map((entry) => entry.file)).toEqual([])
  })

  it('reads them through getSetCookie in exactly one module', () => {
    const users = productionCode.filter(({ code }) =>
      code.includes('getSetCookie'),
    )
    expect(users.map((entry) => entry.file)).toEqual([
      join(CONSOLE_DIR, 'cookies.ts'),
    ])
  })
})

describe('every console verb validates its input', () => {
  it('pairs every createServerFn with a validator', () => {
    // The acceptance says "every function under this directory validates its input with Zod". A
    // handler with no `.validator()` type-checks, runs, and trusts the wire.
    for (const { file, code } of productionCode) {
      const declarations = code.split('createServerFn(').length - 1
      if (declarations === 0) continue
      const validators = code.split('.validator(').length - 1
      expect({ file, declarations, validators }).toEqual({
        file,
        declarations,
        validators: declarations,
      })
    }
  })

  /**
   * The verbs come in two kinds now, and the count below cannot be `createServerFn(` any more.
   *
   * The three session verbs and the two impersonation verbs are server functions, because the
   * console's own client components call them. The ten account verbs are plain `async` functions
   * reached only through `src/routes/_app/console/-server/users.ts`: a `createServerFn` called from
   * inside another one's handler is compiled to an RPC stub the build never registers, and throws
   * `Server function info not found` in the deployed Worker (see `../users`).
   *
   * What both kinds still share is the thing the acceptance is actually about — one exported input
   * schema per verb, consumed at that verb's own boundary. So that is what is counted, and a verb
   * that declares a schema and then forgets to apply it fails here whichever kind it is.
   */
  const declaredSchemas = productionCode.flatMap(({ file, code }) =>
    [...code.matchAll(/export const (\w+InputSchema)\b/g)].map((match) => ({
      file,
      code,
      schema: match[1],
    })),
  )

  it('consumes every declared input schema exactly once', () => {
    expect(declaredSchemas.length).toBeGreaterThan(0)

    // Tallied by captured name rather than by substring: `unbanPlatformUserInputSchema` ends with
    // `banPlatformUserInputSchema`, so counting occurrences of the shorter name finds the longer
    // one too and reports two consumers of a schema that has one.
    for (const { file, code, schema } of declaredSchemas) {
      const consumers = [
        ...code.matchAll(/\.validator\((\w+InputSchema)\)/g),
        ...code.matchAll(/\b(\w+InputSchema)\.parse\(input\)/g),
      ].filter((match) => match[1] === schema)

      expect({ file, schema, consumed: consumers.length }).toEqual({
        file,
        schema,
        consumed: 1,
      })
    }
  })

  it('declares the fifteen the console needs and no sixteenth', () => {
    // Ten account verbs, three session verbs, two impersonation verbs. A sixteenth is a new
    // capability and belongs in docs/ACCESS.md §4.2 before it belongs here.
    expect(declaredSchemas.length).toBe(15)
  })
})
