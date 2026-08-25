/**
 * A module-graph walk, because the invariant it serves is about reachability and not about text.
 *
 * SPEC §5 says the global tables are never reached through the tenant repository layer — neither
 * `base.ts` nor the factory it exports. Faza B tried to express that as a grep three times and it
 * was defeated twice: once by a deep alias import the barrel-shaped needle did not match, once by a
 * *relative* `../repos/base` that an alias-shaped needle could not see. Both left the grep printing
 * a clean zero while the graph from `catalog/audit.ts` grew from eight modules to fifteen. A grep
 * can express a naming rule; it cannot express "nothing this file reaches, at any depth, is the
 * tenant repository". So this walks the graph instead.
 *
 * Three decisions worth stating, because each one is a place a walker can quietly stop checking:
 *
 * - **Conditions, not `require`.** Package entry points are resolved by reading `package.json`
 *   `exports` under the condition list the *bundler* uses, the way
 *   `src/server/auth/__tests__/access.test.ts` does. Node's `require` graph and the shipped ESM
 *   graph already differ inside this repository's dependencies, and a crawl that resolves the wrong
 *   one reports on a build nothing ships. `resolveExternal` is exported so a test can prove the
 *   condition list steers anything at all.
 * - **First-party is walked exhaustively; a package is resolved one hop and not walked.** Every way
 *   into `src/server/repos/**` starts from a first-party module, because `#/*` is this package's own
 *   `imports` map — scoped to this package by the resolution algorithm — and a relative specifier
 *   inside `node_modules` cannot climb out into `src/`. What the one hop does buy is the assertion
 *   that no bare specifier resolves back into the repository's own sources, which is the one shape
 *   that reasoning would miss.
 * - **Type-only imports count as edges.** They are erased at build time, so an `import type` from
 *   the tenant layer evaluates none of it today. It is still the line somebody deletes the `type`
 *   from, and the boundary this guards is a design boundary rather than a bundling one.
 * - **A specifier in prose is not an edge, and a specifier this walk cannot read is not silence.**
 *   Two blind spots were found in the first form of this walker by probing it rather than by
 *   reading it: an `import()` written with a template literal was invisible, and the scan ran over
 *   comments, so a docblock spelling an import created an edge nobody had written. Both are closed
 *   below — {@link scanSpecifiers} reads template literals and reports every `import()` argument it
 *   cannot resolve to a literal, and an edge has to survive the comment stripper or stand at a
 *   statement position to be followed.
 * - **An import statement is an edge whatever the stripper thought.** Stripping comments is only
 *   safe if losing one cannot lose an edge, so the scan runs twice — over the source and over
 *   {@link codeOf} of it — and anything written at a statement position is walked even when the
 *   stripped pass missed it. This file is a scanner and not a parser; that union is what stops a
 *   scanning mistake from becoming a hole. Whatever is left over is a specifier that appears in
 *   prose alone, and it is reported as `commentOnly` rather than followed.
 *
 * Neither this file nor the test beside it spells the factory's identifier. Both live inside the
 * directory the older text check scans, and a file that supplies the string whose absence is being
 * asserted is how a check ends up either wrong or silenced.
 */

import { isBuiltin } from 'node:module'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'

/** What a browser bundle resolves with. */
export const BROWSER_CONDITIONS: ReadonlyArray<string> = ['browser', 'module', 'import', 'default']

/** What the Worker build resolves with. */
export const WORKER_CONDITIONS: ReadonlyArray<string> = [
  'workerd',
  'worker',
  'browser',
  'module',
  'import',
  'default',
]

/** Node's own, used only as the control that proves the lists above steer anything. */
export const NODE_CONDITIONS: ReadonlyArray<string> = ['node', 'module', 'import', 'default']

interface ExportsConditions {
  readonly [condition: string]: ExportsTarget
}

type ExportsTarget = string | null | ReadonlyArray<ExportsTarget> | ExportsConditions

interface PackageManifest {
  readonly exports?: ExportsTarget
  readonly imports?: Record<string, string>
  readonly module?: string
  readonly main?: string
}

/**
 * `import … from`, `export … from` and bare `import '…'`.
 *
 * A static import's specifier is a string literal by grammar — a template literal is a syntax error
 * there — so these two patterns need no backtick. The call forms below do.
 */
const STATIC_PATTERNS: ReadonlyArray<RegExp> = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
]

/** `import(…)` and `require(…)`, argument and all, so an argument that is not a literal is seen. */
const CALL_PATTERN = /\b(import|require)\s*\(\s*([^)]*?)\s*\)/g

/** `'x'`, `"x"` or `` `x` `` — one quote, matched by the same quote, and nothing after it. */
const LITERAL_ARGUMENT = /^(['"`])([^\n]*)\1$/

export interface SpecifierScan {
  /** Specifiers this walk can follow. */
  readonly specifiers: ReadonlyArray<string>
  /**
   * `import(…)` and `require(…)` arguments that are not a literal — a computed path, or a template
   * with an interpolation in it. They are reported rather than skipped: an edge this walk cannot
   * resolve is exactly the shape a reachability check must not pass over in silence.
   */
  readonly dynamic: ReadonlyArray<string>
}

/**
 * Specifiers written where a module specifier can only be code: at the start of a line, as an
 * `import`/`export` statement.
 *
 * This is the recovery path for the comment stripper, and it is what makes stripping safe to base
 * edges on. A docblock line begins with `*` or `//` and never matches; a real import statement the
 * stripper mis-parsed its way past does match, and is walked anyway. So prose costs nothing and a
 * parsing mistake in {@link codeOf} costs nothing either.
 */
const STATEMENT_PATTERNS: ReadonlyArray<RegExp> = [
  /^[\t ]*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  /^[\t ]*import\s*['"]([^'"]+)['"]/gm,
]

/** The subset of `source`'s specifiers that stand at a statement position. */
export function statementSpecifiers(source: string): Array<string> {
  const found: Array<string> = []
  for (const pattern of STATEMENT_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(source)
    while (match) {
      found.push(match[1])
      match = pattern.exec(source)
    }
  }
  return found
}

/** Every module specifier in `source`, and every one it could not read. */
export function scanSpecifiers(source: string): SpecifierScan {
  const specifiers: Array<string> = []
  const dynamic: Array<string> = []

  for (const pattern of STATIC_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(source)
    while (match) {
      // A specifier carrying `${` is not a path: it is text inside a template literal that happens
      // to read like an import. Reported rather than resolved, for the same reason a computed
      // `import()` argument is.
      if (match[1].includes('${')) {
        dynamic.push(`from '${match[1]}'`)
      } else {
        specifiers.push(match[1])
      }
      match = pattern.exec(source)
    }
  }

  CALL_PATTERN.lastIndex = 0
  let call = CALL_PATTERN.exec(source)
  while (call) {
    const argument = call[2]
    const literal = LITERAL_ARGUMENT.exec(argument)
    const value = literal === null ? null : literal[2]

    if (value === null || value.includes('${')) {
      dynamic.push(`${call[1]}(${argument})`)
    } else {
      specifiers.push(value)
    }
    call = CALL_PATTERN.exec(source)
  }

  return { specifiers, dynamic }
}

const REPOSITORY_ROOT = realpathSync(process.cwd())
const SOURCE_ROOT = join(REPOSITORY_ROOT, 'src')

/**
 * `source` with its comments removed, so an identifier can be looked for in code rather than in
 * prose.
 *
 * The two modules that explain this boundary — `src/server/db/schema.ts` and
 * `src/server/db/audit-action.ts` — both name the tenant repository factory in a docblock, since
 * describing a rule requires saying what it forbids. A raw substring search calls that a violation,
 * which is how a text check ends up either wrong or silenced. Strings and template literals are
 * preserved: a name that appears in one is being handled as data, and the check should see it.
 *
 * This is a scanner and not a parser, so a regular-expression literal can still confuse it — an
 * unescaped `//` inside a character class reads as a line comment to it. That cannot turn into a
 * hole in the invariant, because {@link moduleGraphFrom} walks the union of this function's output
 * and {@link statementSpecifiers} of the raw source: an import statement is an edge whatever this
 * function made of the line above it. The one mis-read handled here directly is `\/` immediately
 * before the `/` that closes a regular expression, which is not the start of a comment.
 */
export function codeOf(source: string): string {
  const out: Array<string> = []
  let index = 0

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (char === '/' && next === '/' && source[index - 1] !== '\\') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }
    if (char === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1
      }
      index += 2
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      // Consumed whole, escapes and all. A template literal keeps its interpolations verbatim,
      // which is deliberate: an identifier inside `${…}` is code and the check should see it.
      out.push(char)
      index += 1
      while (index < source.length && source[index] !== char) {
        if (source[index] === '\\') {
          out.push(source[index], source[index + 1] ?? '')
          index += 2
          continue
        }
        out.push(source[index])
        index += 1
      }
      out.push(char)
      index += 1
      continue
    }

    out.push(char)
    index += 1
  }

  return out.join('')
}

/**
 * `#/*` comes from this package's own `imports` map rather than from a constant, so the walker
 * follows whatever the runtime follows. `@/*` exists only in `tsconfig.json` and `vitest.config.ts`
 * and is mirrored here: a specifier the walker cannot classify as first-party is resolved as a
 * package and reported when that fails, so an alias missing from this table surfaces as a broken
 * edge instead of as a clean graph.
 */
function firstPartyAliases(): ReadonlyArray<{
  readonly prefix: string
  readonly target: string
}> {
  const manifest = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  ) as PackageManifest

  const aliases = Object.entries(manifest.imports ?? {})
    .filter(([key, value]) => key.endsWith('/*') && value.endsWith('/*'))
    .map(([key, value]) => ({
      prefix: key.slice(0, -1),
      target: join(REPOSITORY_ROOT, value.slice(0, -1)),
    }))

  return [...aliases, { prefix: '@/', target: `${SOURCE_ROOT}/` }]
}

const ALIASES = firstPartyAliases()

const FILE_PROBES: ReadonlyArray<string> = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.mjs',
  '.js',
  '/index.ts',
  '/index.tsx',
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
 * One branch of an `exports` value, under `conditions`. Declaration order decides, which is why a
 * condition that must not win — `types`, `dev-source` — has to be absent from the list rather than
 * merely ranked below `default`.
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

  return best === null ? null : selectTarget(map[best.key], best.wildcard, conditions)
}

/** A package specifier, resolved to the file the given conditions select. */
export function resolveExternal(
  specifier: string,
  importer: string,
  conditions: ReadonlyArray<string>,
): string | null {
  const segments = specifier.split('/')
  const name = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]

  const directory = packageDirectory(name, dirname(importer))
  if (directory === null) return null

  const manifest = JSON.parse(
    readFileSync(join(directory, 'package.json'), 'utf8'),
  ) as PackageManifest

  const subpath = specifier.length === name.length ? '.' : `.${specifier.slice(name.length)}`

  if (manifest.exports !== undefined) {
    const target = targetFor(manifest.exports, subpath, conditions)
    return target === null ? null : probeFile(join(directory, target))
  }

  if (subpath === '.') {
    return probeFile(join(directory, manifest.module ?? manifest.main ?? 'index.js'))
  }
  return probeFile(join(directory, subpath))
}

/** A first-party specifier — relative, absolute or aliased — or `null` when it is a package. */
function resolveFirstParty(specifier: string, importer: string): string | null | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return probeFile(resolvePath(dirname(importer), specifier))
  }

  for (const alias of ALIASES) {
    if (specifier.startsWith(alias.prefix)) {
      return probeFile(join(alias.target, specifier.slice(alias.prefix.length)))
    }
  }
  return undefined
}

export interface ExternalEdge {
  readonly specifier: string
  readonly importer: string
  /** `null` when nothing resolved under the conditions the graph was walked with. */
  readonly file: string | null
}

export interface ModuleGraph {
  /** Absolute paths of every first-party module reachable from the roots, the roots included. */
  readonly modules: ReadonlyArray<string>
  /** Package specifiers reached, resolved one hop under the walk's conditions. */
  readonly external: ReadonlyArray<ExternalEdge>
  /** `node:` specifiers reached, with the module that imported each. */
  readonly builtins: ReadonlyArray<string>
  /** First-party specifiers that resolved to no file — reported rather than passed over. */
  readonly unresolved: ReadonlyArray<string>
  /** `import()`/`require()` arguments that are not literals, so this walk cannot follow them. */
  readonly dynamic: ReadonlyArray<string>
  /**
   * Specifiers found in the source but not in the comment-stripped source. Prose that spells an
   * import is the ordinary cause and is not an edge; a specifier the stripper mis-read is the other
   * one, which is why these are reported rather than dropped.
   */
  readonly commentOnly: ReadonlyArray<ExternalEdge>
}

/** Breadth-first over every first-party module the roots reach, following code edges only. */
export function moduleGraphFrom(
  roots: ReadonlyArray<string>,
  conditions: ReadonlyArray<string>,
): ModuleGraph {
  const modules = new Set<string>()
  const external: Array<ExternalEdge> = []
  const builtins = new Set<string>()
  const unresolved: Array<string> = []
  const dynamic: Array<string> = []
  const commentOnly: Array<ExternalEdge> = []
  const queue: Array<string> = roots.map((root) => realpathSync(root))

  while (queue.length > 0) {
    const file = queue.shift()
    if (file === undefined) break
    if (modules.has(file)) continue
    modules.add(file)

    const source = readFileSync(file, 'utf8')
    const code = scanSpecifiers(codeOf(source))
    const whole = scanSpecifiers(source)

    for (const argument of code.dynamic) {
      dynamic.push(`${argument} (in ${file})`)
    }

    // An edge is what the comment-stripped source holds, plus anything written at a statement
    // position that the stripper did not report. The second half is why a mis-parse in `codeOf`
    // cannot become a missing edge, and the first half is why a docblock cannot become one.
    const edges = new Set([...code.specifiers, ...statementSpecifiers(source)])

    // What is left is a specifier that appears only in prose. It is reported rather than dropped,
    // because "nothing here mentions the tenant layer at all" is worth being able to read, and
    // resolved so the report says where the mention points.
    for (const specifier of whole.specifiers) {
      if (edges.has(specifier) || isBuiltin(specifier)) continue

      const target = resolveFirstParty(specifier, file)
      commentOnly.push({
        specifier,
        importer: file,
        file: target === undefined ? resolveExternal(specifier, file, conditions) : target,
      })
    }

    for (const specifier of edges) {
      if (isBuiltin(specifier)) {
        builtins.add(`${specifier} (imported by ${file})`)
        continue
      }

      const firstParty = resolveFirstParty(specifier, file)
      if (firstParty === undefined) {
        external.push({
          specifier,
          importer: file,
          file: resolveExternal(specifier, file, conditions),
        })
        continue
      }
      if (firstParty === null) {
        unresolved.push(`${specifier} (imported by ${file})`)
        continue
      }
      queue.push(firstParty)
    }
  }

  return {
    modules: [...modules],
    external,
    builtins: [...builtins],
    unresolved,
    dynamic,
    commentOnly,
  }
}

/** Every `.ts`/`.tsx` module under `directory`, recursively — the walk's entry points. */
export function modulesUnder(
  directory: string,
  options: { readonly tests: boolean },
): Array<string> {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => options.tests || !file.includes('__tests__'))
    .sort()
}

export { REPOSITORY_ROOT, SOURCE_ROOT }
