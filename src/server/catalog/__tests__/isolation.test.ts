/**
 * SPEC §5's isolation invariant, asserted as reachability rather than as a spelling.
 *
 * "These tables must never be reached through the tenant repository layer — `base.ts` or the factory
 * it exports" is a claim about what `src/server/catalog/**` can reach, at any depth, by any
 * spelling. Faza B expressed it as a grep and the grep was defeated twice: an alias import of a deep
 * tenant module slipped past a barrel-shaped needle, and a relative `../repos/base` slipped past an
 * alias-shaped one — both times the check printed a clean zero while the graph from `audit.ts` had
 * grown from eight modules to fifteen. So the check below walks the graph, from every module in this
 * directory, and asks two questions of everything it reaches: is this file under the tenant
 * repository layer, and does it evaluate the tenant repository factory.
 *
 * The needles are assembled from fragments on purpose. This file is inside the tree the walk scans,
 * so a test that spells out the string whose absence it asserts is the line that supplies it.
 *
 * The controls matter as much as the assertions, because a walker that resolves nothing also reports
 * a clean graph. Five of them run below: a relative edge into the tenant layer has to be seen, an
 * aliased one two hops away has to be seen, an unresolvable specifier has to be reported rather than
 * skipped, a factory call has to be told apart from a docblock that names one, and the resolver has
 * to answer differently under two condition sets — which is how this file knows it is walking the
 * graph the bundler builds rather than Node's `require` graph, the round-3 lesson
 * `src/server/auth/__tests__/access.test.ts` records.
 *
 * This becomes load-bearing in Faza C, when `repo.ts` lands beside `audit.ts` and the directory has
 * a second reason to want a repository.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BROWSER_CONDITIONS,
  NODE_CONDITIONS,
  SOURCE_ROOT,
  WORKER_CONDITIONS,
  codeOf,
  moduleGraphFrom,
  modulesUnder,
  resolveExternal,
} from './module-graph'
import type { ModuleGraph } from './module-graph'

const CATALOG_DIRECTORY = join(SOURCE_ROOT, 'server', 'catalog')

/** `src/server/repos/`, spelled so this file is not itself an instance of what it forbids. */
const TENANT_LAYER = `${['server', 'repos'].join('/')}/`

/** The tenant repository factory's identifier, same reason. */
const TENANT_FACTORY = ['create', 'Tenant', 'Repository'].join('')

const CONDITION_SETS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['the Worker build', WORKER_CONDITIONS],
  ['a browser bundle', BROWSER_CONDITIONS],
]

function tenantModules(graph: ModuleGraph): Array<string> {
  return graph.modules.filter((file) => file.includes(TENANT_LAYER))
}

/**
 * Modules that name the factory *in code*. Two of the modules in this graph name it in a docblock —
 * explaining a boundary means saying what it forbids — so the search runs over comment-stripped
 * source. The controls below pin both directions of that distinction on real files.
 */
function modulesEvaluatingTheFactory(graph: ModuleGraph): Array<string> {
  return graph.modules.filter((file) => codeOf(readFileSync(file, 'utf8')).includes(TENANT_FACTORY))
}

describe('the shipped global-table path', () => {
  const roots = modulesUnder(CATALOG_DIRECTORY, { tests: false })

  it('has entry points to walk', () => {
    // A walk with no roots proves nothing, and every assertion below would pass on one.
    expect(roots.length).toBeGreaterThan(0)
    expect(roots.some((file) => file.endsWith('audit.ts'))).toBe(true)
  })

  it.each(CONDITION_SETS)('resolves every specifier it reaches in %s', (_target, conditions) => {
    const graph = moduleGraphFrom(roots, conditions)

    // A first-party specifier that resolves to nothing is a hole in the walk, not a clean edge.
    expect(graph.unresolved).toEqual([])
    // And a package specifier that resolves to nothing is a package this walk cannot see past.
    expect(graph.external.filter((edge) => edge.file === null)).toEqual([])
    // The graph is the size a real crawl produces rather than the size an early stop produces: the
    // writer alone reaches the schema, the access control, the observability layer and the shared
    // action leaf, and those four are named so a walk that quietly resolved nothing cannot pass.
    expect(graph.modules.length).toBeGreaterThanOrEqual(8)
    for (const expected of [
      'server/db/audit-action.ts',
      'server/db/schema.ts',
      'server/auth/access.ts',
      'server/observability/logger.ts',
    ]) {
      expect(
        graph.modules.some((file) => file.endsWith(expected)),
        expected,
      ).toBe(true)
    }
  })

  it.each(CONDITION_SETS)(
    'reaches no module under the tenant layer in %s',
    (_target, conditions) => {
      const graph = moduleGraphFrom(roots, conditions)

      expect(tenantModules(graph)).toEqual([])
      expect(modulesEvaluatingTheFactory(graph)).toEqual([])
    },
  )

  it.each(CONDITION_SETS)(
    'reaches no package that resolves back into src in %s',
    (_target, conditions) => {
      // The one shape "a dependency cannot climb out of node_modules" would miss: a package whose
      // entry point is a file inside this repository's own sources.
      const graph = moduleGraphFrom(roots, conditions)

      for (const edge of graph.external) {
        expect(edge.file, `${edge.specifier} resolves inside src`).toContain('/node_modules/')
      }
    },
  )
})

describe('the whole directory, tests included', () => {
  // A fixture imported across the boundary reaches the tenant layer exactly as a production import
  // would, and `__tests__` is where the cheap shortcut is taken. The tests are walked under the
  // Worker conditions alone: they are not shipped, so the browser branch says nothing extra here.
  const roots = modulesUnder(CATALOG_DIRECTORY, { tests: true })
  const graph = moduleGraphFrom(roots, WORKER_CONDITIONS)

  it('walks more than the shipped path does', () => {
    expect(roots.length).toBeGreaterThan(modulesUnder(CATALOG_DIRECTORY, { tests: false }).length)
    expect(graph.unresolved).toEqual([])
  })

  it('reaches no module under the tenant layer and no tenant repository factory', () => {
    expect(tenantModules(graph)).toEqual([])
    expect(modulesEvaluatingTheFactory(graph)).toEqual([])
  })
})

describe('the walk itself', () => {
  const importer = join(CATALOG_DIRECTORY, 'audit.ts')

  it('sees a relative edge into the tenant layer', () => {
    // The round-5 probe, run as a control instead of as an edit: `src/server/repos/audit.ts` reaches
    // `./base` by a relative specifier, which is the spelling an alias-only needle could not see.
    const graph = moduleGraphFrom(
      [join(SOURCE_ROOT, 'server', 'repos', 'audit.ts')],
      WORKER_CONDITIONS,
    )

    expect(tenantModules(graph).length).toBeGreaterThanOrEqual(2)
    expect(modulesEvaluatingTheFactory(graph).length).toBeGreaterThanOrEqual(1)
  })

  it('sees an aliased edge into the tenant layer, two hops away', () => {
    // `src/server/fns/costs.ts` imports the barrel, which is an `export *` over `base.ts`: the
    // factory is two hops from the root and is reached through the alias rather than a path.
    const graph = moduleGraphFrom(
      [join(SOURCE_ROOT, 'server', 'fns', 'costs.ts')],
      WORKER_CONDITIONS,
    )

    expect(tenantModules(graph).length).toBeGreaterThanOrEqual(2)
    expect(modulesEvaluatingTheFactory(graph).length).toBeGreaterThanOrEqual(1)
  })

  it('resolves under the condition set it is given, not under Node`s', () => {
    // The whole reason the resolver is hand-rolled: one specifier, two condition sets, two files. A
    // crawl that quietly fell back to Node would answer the same file to both and would go on
    // reporting a clean graph while walking a build nothing ships.
    expect(resolveExternal('nanoid', importer, BROWSER_CONDITIONS)).toMatch(
      /\/nanoid\/index\.browser\.js$/,
    )
    expect(resolveExternal('nanoid', importer, NODE_CONDITIONS)).toMatch(/\/nanoid\/index\.js$/)
  })

  it('reports a specifier it cannot resolve rather than inventing a file', () => {
    expect(resolveExternal('nowhere-at-all', importer, WORKER_CONDITIONS)).toBeNull()
  })

  it('tells a factory call apart from a docblock that names one', () => {
    // Both directions, on the two real files that make the distinction necessary: `base.ts` calls
    // the factory, `schema.ts` only explains that these tables must never reach it. A check that
    // cannot tell those apart is either wrong about `schema.ts` or has been widened until it is
    // wrong about everything.
    const base = readFileSync(join(SOURCE_ROOT, 'server', 'repos', 'base.ts'), 'utf8')
    const schema = readFileSync(join(SOURCE_ROOT, 'server', 'db', 'schema.ts'), 'utf8')

    expect(codeOf(base)).toContain(TENANT_FACTORY)
    expect(schema).toContain(TENANT_FACTORY)
    expect(codeOf(schema)).not.toContain(TENANT_FACTORY)
    // And it strips comments without eating the code around them.
    expect(codeOf("const a = 1 // x\nconst b = '// not a comment'")).toBe(
      "const a = 1 \nconst b = '// not a comment'",
    )
  })
})
