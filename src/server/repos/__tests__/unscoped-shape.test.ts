import { relative, resolve } from 'node:path'
import { withProgram } from './compiler-program'
import * as ts from 'typescript/unstable/ast'
import { SignatureKind, SymbolFlags } from 'typescript/unstable/sync'
import type {
  Project,
  Symbol as CompilerSymbol,
} from 'typescript/unstable/sync'
import { describe, expect, it } from 'vitest'

const callers: Record<string, string> = {
  findSubscriptionByOrganizationUnscoped: 'src/server/billing/store.ts',
  findSubscriptionByProviderCustomerUnscoped: 'src/server/billing/store.ts',
  findSubscriptionByProviderSubscriptionUnscoped: 'src/server/billing/store.ts',
  upsertSubscriptionUnscoped: 'src/server/billing/store.ts',
  listSubscriptionsByOrganizationsUnscoped:
    'src/routes/_app/console/-server/account-billing.ts',
  findLiveFeedByDigestUnscoped: 'src/server/public/calendar-feed.ts',
  findLiveTripInviteByDigestUnscoped: 'src/server/public/trip-invite.ts',
  readInvitePreviewUnscoped: 'src/server/public/trip-invite.ts',
  countAccountPlacesUnscoped: 'src/server/erasure/verify.ts',
  joinTripByInviteUnscoped: 'src/routes/join/-lib/join.ts',
}

/** Resolve symbols rather than spelling: an alias or a barrel must retain its provenance. */
function inspect(project: Project, allowed: Record<string, string>) {
  const { program, checker } = project
  const violations: Array<string> = []
  const discovered = new Set<string>()
  const imported = new Set<string>()
  function original(symbol: CompilerSymbol): CompilerSymbol {
    return symbol.flags & SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol
  }
  function protectedName(symbol: CompilerSymbol): string | undefined {
    const target = original(symbol)
    if (!target.name.endsWith('Unscoped') && !symbol.name.endsWith('Unscoped'))
      return
    if (!target.declarations?.some((d) => d.path.includes('/server/repos/')))
      return
    return target.name.endsWith('Unscoped') ? target.name : symbol.name
  }
  for (const file of program
    .getSourceFileNames()
    .filter((path) => path.includes('/src/') && !path.includes('node_modules'))
    .map((path) => program.getSourceFile(path))
    .filter((loaded): loaded is ts.SourceFile => loaded !== undefined)) {
    if (
      file.isDeclarationFile ||
      !file.fileName.includes('/src/') ||
      /(__tests__|\.(test|spec)\.)/.test(file.fileName)
    )
      continue
    const path = relative(process.cwd(), file.fileName)
    const module = file.fileName.includes('/server/repos/')
      ? checker.getSymbolAtLocation(file)
      : undefined
    if (module && file.fileName.includes('/server/repos/')) {
      for (const exported of checker.getExportsOfModule(module)) {
        const name = protectedName(exported)
        if (!name) continue
        discovered.add(name)
        if (!allowed[name]) violations.push(`unmapped ${name}`)
        const signatures = checker.getSignaturesOfType(
          checker.getTypeOfSymbolAtLocation(original(exported), file),
          SignatureKind.Call,
        )
        if (signatures.length === 0) violations.push(`Not callable: ${name}`)
        for (const signature of signatures) {
          const first = signature.getParameters()[0]
          const declaration = first?.valueDeclaration?.resolve()
          const type =
            declaration && ts.isParameterDeclaration(declaration)
              ? declaration.type
              : undefined
          const symbol =
            type && ts.isTypeReferenceNode(type)
              ? checker.getSymbolAtLocation(type.typeName)
              : undefined
          const target = symbol && original(symbol)
          if (
            !target ||
            target.name !== 'Database' ||
            !target.declarations?.some((d) =>
              d.path.endsWith('/server/db/types.ts'),
            )
          )
            violations.push(`Database required: ${name}`)
        }
      }
    }
    function visit(node: ts.Node) {
      // Resolve imported/exported names through aliases; namespaces are checked below.
      if (
        ts.isIdentifier(node) &&
        (ts.isImportSpecifier(node.parent) || ts.isExportSpecifier(node.parent))
      ) {
        const symbol = checker.getSymbolAtLocation(node)
        const name = symbol && protectedName(symbol)
        if (
          symbol &&
          name &&
          !original(symbol).declarations.some((d) => d.path === file.fileName)
        ) {
          imported.add(name)
          if (allowed[name] !== path)
            violations.push(`unauthorized ${name}: ${path}`)
        }
      }
      // A namespace or star export exposes every protected member even without spelling its name.
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      ) {
        const symbol = checker.getSymbolAtLocation(node.moduleSpecifier)
        const namespace =
          ts.isImportDeclaration(node) &&
          node.importClause?.namedBindings &&
          ts.isNamespaceImport(node.importClause.namedBindings)
        const star =
          ts.isExportDeclaration(node) &&
          (!node.exportClause || ts.isNamespaceExport(node.exportClause))
        if (symbol && (namespace || star))
          for (const member of checker.getExportsOfModule(symbol)) {
            const name = protectedName(member)
            if (
              name &&
              allowed[name] !== path &&
              // The existing repository barrel transports exports, not authority. Its
              // consumers are still resolved to the original symbols above.
              !(star && path === 'src/server/repos/index.ts')
            )
              violations.push(`namespace exposure ${name}: ${path}`)
          }
      }
      node.forEachChild(visit)
    }
    visit(file)
  }
  return {
    violations: [...new Set(violations)],
    discovered: [...discovered].sort(),
    imported: [...imported].sort(),
  }
}

describe('Unscoped repository contract', () => {
  it('finds all ten exceptions, their real callers and their plain Database parameters', () => {
    const result = withProgram({}, (project) => inspect(project, callers))
    expect(result.discovered).toEqual(Object.keys(callers).sort())
    expect(result.imported).toEqual(Object.keys(callers).sort())
    expect(result.violations).toEqual([])
  }, 30000)

  it('detects aliases, barrels, namespace exposure and a new incorrectly scoped exception', () => {
    const probe = resolve('src/unscoped-probe.ts')
    const barrel = resolve('src/unscoped-barrel.ts')
    const wrong = resolve('src/server/repos/unscoped-probe.ts')
    const namespace = resolve('src/unscoped-namespace.ts')
    const alias = resolve('src/unscoped-alias.ts')
    const result = withProgram(
      {
        [namespace]:
          "import * as concealed from '#/server/repos'; void concealed",
        [alias]:
          "import { hidden as innocent } from './unscoped-barrel'; void innocent",
        [barrel]:
          "export { findLiveFeedByDigestUnscoped as hidden } from '#/server/repos/calendar-feeds'",
        [probe]:
          "import { hidden as alias } from './unscoped-barrel'; import * as repos from '#/server/repos/calendar-feeds'; export { alias }; export * from '#/server/repos/calendar-feeds'; void repos",
        [wrong]:
          "import type { TenantScope } from './base'; export function probeUnscoped(scope: TenantScope) { return scope }",
      },
      (project) => inspect(project, callers),
    )
    expect(result.violations).toContain('unmapped probeUnscoped')
    expect(result.violations).toContain('Database required: probeUnscoped')
    expect(result.violations).toContain(
      'unauthorized findLiveFeedByDigestUnscoped: src/unscoped-probe.ts',
    )
    expect(result.violations).toContain(
      'unauthorized findLiveFeedByDigestUnscoped: src/unscoped-barrel.ts',
    )
    expect(result.violations).toContain(
      'namespace exposure findLiveFeedByDigestUnscoped: src/unscoped-probe.ts',
    )
    expect(result.violations).toContain(
      'namespace exposure findLiveFeedByDigestUnscoped: src/unscoped-namespace.ts',
    )
    expect(result.violations).toContain(
      'unauthorized findLiveFeedByDigestUnscoped: src/unscoped-alias.ts',
    )
  }, 30000)

  it('keeps scope construction out of the public handler', () => {
    const identifiers = withProgram({}, (project) => {
      const ast = project.program.getSourceFile(
        resolve('src/server/public/calendar-feed.ts'),
      )
      if (!ast) throw new Error('Handler not loaded')
      const found: Array<string> = []
      function visit(node: ts.Node) {
        if (ts.isIdentifier(node)) found.push(node.text)
        node.forEachChild(visit)
      }
      visit(ast)
      return found
    })
    expect(identifiers).toContain('openFeedScope')
    expect(identifiers).not.toContain('createScope')
  })

  it('keeps scope construction and SQL out of the trip invite resolver', () => {
    const identifiers = withProgram({}, (project) => {
      const ast = project.program.getSourceFile(
        resolve('src/server/public/trip-invite.ts'),
      )
      if (!ast) throw new Error('Resolver not loaded')
      const found: Array<string> = []
      function visit(node: ts.Node) {
        if (ts.isIdentifier(node)) found.push(node.text)
        node.forEachChild(visit)
      }
      visit(ast)
      return found
    })
    expect(identifiers).toContain('findLiveTripInviteByDigestUnscoped')
    for (const forbidden of ['createScope', 'openFeedScope', 'drizzle']) {
      expect(identifiers).not.toContain(forbidden)
    }
  })
})
