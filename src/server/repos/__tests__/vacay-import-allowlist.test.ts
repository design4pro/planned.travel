import { relative, resolve } from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { SymbolFlags } from 'typescript/unstable/sync'
import { describe, expect, it } from 'vitest'
import { withProgram } from './compiler-program'
import type {
  Project,
  Symbol as CompilerSymbol,
} from 'typescript/unstable/sync'

/**
 * What production code may import from the leave-planner repository, `src/server/repos/vacay.ts`.
 *
 * The repository's older writers and readers (`setEntry`, `updatePlan`, `listUserYears`, the
 * `*Repository` objects, and the rest) prove a plan is in the caller's workspace and nothing more.
 * `requirePlanActor` / `requirePlanOwner` is the rule that a leave plan is personal, and a function
 * that takes a client-sent plan id is safe to call only once that rule stands in front of it. So the
 * list below is the whole surface a screen or a queue consumer may reach: the stage that needs
 * another function guards it, then edits this list, which is what makes review see it.
 *
 * `setEntitlementInput` and `updatePlanSettingsInput` are on the list because the server functions
 * validate with them; each is a schema, not a way into a row, and the second keeps the dialog's two
 * bounds in one place instead of copying them into the route.
 *
 * Symbols are resolved through the compiler, not read from import text, so an alias, the
 * `#/server/repos` barrel, a re-export, a namespace import and a dynamic `import()` all keep their
 * provenance. The repositories, the tests and the dev seeder (exempt by name) are not production
 * callers.
 */
const ALLOWED = new Set([
  'ensurePlan',
  'getPlanOverview',
  'saveAllowance',
  'getAllowance',
  'requirePlanActor',
  'requirePlanOwner',
  'updatePlanSettings',
  'setEntitlementInput',
  'updatePlanSettingsInput',
])

const VACAY_REPOSITORY = '/src/server/repos/vacay.ts'

const EXEMPT =
  /^src\/(server\/repos\/|routes\/api\/dev\/-seed\/)|(__tests__|\.(test|spec)\.)/

function inspect(project: Project): {
  readonly violations: Array<string>
  readonly exported: Array<string>
} {
  const { program, checker } = project
  const violations = new Set<string>()
  const exported = new Set<string>()

  const original = (symbol: CompilerSymbol): CompilerSymbol =>
    symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol

  /** The name of a value the vacay repository declares, or `undefined` for anything else. */
  const vacayValue = (symbol: CompilerSymbol): string | undefined => {
    const target = original(symbol)
    const declaredThere = target.declarations?.some((declaration) =>
      declaration.path.endsWith(VACAY_REPOSITORY),
    )
    return declaredThere && target.flags & SymbolFlags.Value
      ? target.name
      : undefined
  }

  const vacayModule = program.getSourceFile(
    resolve('src/server/repos/vacay.ts'),
  )
  const vacaySymbol = vacayModule && checker.getSymbolAtLocation(vacayModule)
  for (const symbol of vacaySymbol
    ? checker.getExportsOfModule(vacaySymbol)
    : []) {
    const name = vacayValue(symbol)
    if (name !== undefined) exported.add(name)
  }

  for (const file of program
    .getSourceFileNames()
    .filter((path) => path.includes('/src/'))
    .map((path) => program.getSourceFile(path))
    .filter((loaded): loaded is ts.SourceFile => loaded !== undefined)) {
    const path = relative(process.cwd(), file.fileName)
    if (file.isDeclarationFile || EXEMPT.test(path)) continue

    /** A module whose exports reach the vacay repository: a namespace, a star export, `import()`. */
    const flagExposure = (specifier: ts.Node, how: string) => {
      const module = checker.getSymbolAtLocation(specifier)
      for (const member of module ? checker.getExportsOfModule(module) : []) {
        const name = vacayValue(member)
        if (name !== undefined && !ALLOWED.has(name)) {
          violations.add(`${how} exposes ${name}: ${path}`)
        }
      }
    }

    const visit = (node: ts.Node): void => {
      if (
        ts.isIdentifier(node) &&
        (ts.isImportSpecifier(node.parent) || ts.isExportSpecifier(node.parent))
      ) {
        const symbol = checker.getSymbolAtLocation(node)
        const name = symbol && vacayValue(symbol)
        if (name !== undefined && !ALLOWED.has(name)) {
          violations.add(`${name}: ${path}`)
        }
      }
      if (ts.isImportDeclaration(node)) {
        const bindings = node.importClause?.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) {
          flagExposure(node.moduleSpecifier, 'namespace import')
        }
      }
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        (!node.exportClause || ts.isNamespaceExport(node.exportClause))
      ) {
        flagExposure(node.moduleSpecifier, 'star export')
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0]
      ) {
        flagExposure(node.arguments[0], 'dynamic import')
      }
      node.forEachChild(visit)
    }
    visit(file)
  }

  return { violations: [...violations].sort(), exported: [...exported].sort() }
}

/**
 * Functions that production code must never reach even though they are exported: they take a
 * traveller's id from the caller and answer to no actor rule of their own, because the repository
 * calls them only after one has passed.
 */
const REPOSITORY_ONLY = ['recomputeCarryOver']

describe('the leave planner repository import allowlist', () => {
  it.each(REPOSITORY_ONLY)(
    'keeps %s exported for the repository’s tests and off the allowlist',
    (name) => {
      const result = withProgram({}, inspect)

      expect(result.exported).toContain(name)
      expect(ALLOWED.has(name)).toBe(false)
    },
    30000,
  )

  it('lets production code reach only the guarded surface, and every entry names a real export', () => {
    const result = withProgram({}, inspect)

    expect(result.violations).toEqual([])
    for (const name of ALLOWED) {
      expect(result.exported).toContain(name)
    }
  }, 30000)

  it('catches a direct import, an alias, a re-exporting barrel, a namespace, a star export and import()', () => {
    const probe = (name: string) => resolve(`src/${name}.ts`)
    const result = withProgram(
      {
        [probe('vacay-probe-direct')]:
          "import { setEntry, vacayPlansRepository, recomputeCarryOver } from '#/server/repos'; void setEntry; void vacayPlansRepository; void recomputeCarryOver",
        [probe('vacay-probe-deep')]:
          "import { updatePlan } from '#/server/repos/vacay'; void updatePlan",
        [probe('vacay-probe-barrel')]:
          "export { removeEntry as hidden } from '#/server/repos'",
        [probe('vacay-probe-alias')]:
          "import { hidden as innocent } from './vacay-probe-barrel'; void innocent",
        [probe('vacay-probe-namespace')]:
          "import * as repos from '#/server/repos'; void repos",
        [probe('vacay-probe-star')]: "export * from '#/server/repos/vacay'",
        [probe('vacay-probe-dynamic')]:
          "export const load = () => import('#/server/repos')",
        [probe('vacay-probe-allowed')]:
          "import { saveAllowance, ensurePlan } from '#/server/repos'; import type { VacayPlanOverview, SetEntitlementInput } from '#/server/repos'; void saveAllowance; void ensurePlan; export type Probe = [VacayPlanOverview, SetEntitlementInput]",
      },
      inspect,
    )

    expect(result.violations).toEqual(
      expect.arrayContaining([
        'setEntry: src/vacay-probe-direct.ts',
        'vacayPlansRepository: src/vacay-probe-direct.ts',
        'recomputeCarryOver: src/vacay-probe-direct.ts',
        'updatePlan: src/vacay-probe-deep.ts',
        'removeEntry: src/vacay-probe-barrel.ts',
        'removeEntry: src/vacay-probe-alias.ts',
        'namespace import exposes setEntry: src/vacay-probe-namespace.ts',
        'star export exposes setEntry: src/vacay-probe-star.ts',
        'dynamic import exposes setEntry: src/vacay-probe-dynamic.ts',
      ]),
    )
    expect(result.violations.join('\n')).not.toContain('vacay-probe-allowed')
  }, 30000)
})
