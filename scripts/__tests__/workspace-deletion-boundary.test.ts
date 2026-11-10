import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import {
  SOURCE_ROOT,
  modulesUnder,
  scanSpecifiers,
  codeOf,
  moduleGraphFrom,
  WORKER_CONDITIONS,
} from '../../src/server/catalog/__tests__/module-graph'

it('pins every production ledger reader and admits state writers only inside the driver', () => {
  const allowed: Record<string, ReadonlyArray<string>> = {
    'server/workspace-deletion/scope.ts': ['WorkspaceDeletionAuthority'],
    'server/workspace-deletion/runtime.ts': ['listStaleWorkspaceDeletions'],
    'server/workspace-deletion/erasure.ts': [
      'consumeWorkspaceDeletionErasure',
      'readWorkspaceDeletionErasureState',
    ],
    'server/workspace-deletion/ledger.ts': [
      'leaseWorkspaceDeletion',
      'recordWorkspaceDeletionRefusal',
      'transitionWorkspaceDeletion',
      'pruneWorkspaceDeletions',
    ],
    'server/auth/index.ts': ['assertWorkspaceNotDeleting'],
    'server/billing/store.ts': ['workspaceDeletionPending'],
    'server/repos/community.ts': ['workspaceDeletionAbsent'],
    'server/repos/members.ts': [
      'assertWorkspaceNotDeleting',
      'workspaceDeletionAbsent',
      'workspaceDeletionAuthorityPresent',
      'workspaceDeletionAuthorityCurrent',
      'WorkspaceDeletionAuthority',
    ],
    'server/repos/workspace-invitation-acceptance.ts': [
      'workspaceDeletionAbsent',
    ],
  }
  const actual: Record<string, Array<string>> = {}
  for (const file of modulesUnder(SOURCE_ROOT, { tests: false })) {
    const source = readFileSync(file, 'utf8')
    const ledgerEdges = scanSpecifiers(codeOf(source)).specifiers.filter(
      (specifier) => /\/workspace-deletions(?:\.ts)?$/.test(specifier),
    )
    if (ledgerEdges.length) {
      const matches = [
        ...source.matchAll(
          /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*['"][^'"]*\/workspace-deletions(?:\.ts)?['"]/g,
        ),
      ]
      const match = matches[0]
      expect(matches).toHaveLength(ledgerEdges.length)
      if (!match) throw new Error(`Unbounded ledger import: ${file}`)
      actual[relative(SOURCE_ROOT, file)] = matches
        .flatMap((entry) => entry[1].split(','))
        .map(
          (name) =>
            name
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0],
        )
        .filter(Boolean)
        .sort()
    }
    if (
      file.endsWith('/catalog/workspace-deletions.ts') ||
      file.endsWith('/catalog/audit.ts') ||
      file.endsWith('/db/schema.ts')
    )
      continue
    expect(codeOf(source), file).not.toMatch(/\bworkspaceDeletions\b/)
  }
  expect(actual).toEqual(
    Object.fromEntries(
      Object.entries(allowed).map(([file, names]) => [file, [...names].sort()]),
    ),
  )
})

it('excludes the system scope from request imports, including indirect imports', () => {
  const factory = join(SOURCE_ROOT, 'server/workspace-deletion/scope.ts')
  const roots = [
    ...modulesUnder(join(SOURCE_ROOT, 'routes'), { tests: false }),
    ...modulesUnder(join(SOURCE_ROOT, 'server/fns'), { tests: false }),
  ]
  expect(roots.length).toBeGreaterThan(0)
  expect(moduleGraphFrom(roots, WORKER_CONDITIONS).modules).not.toContain(
    factory,
  )
  const probe = mkdtempSync(join(tmpdir(), 'workspace-deletion-import-probe-'))
  try {
    const entry = join(probe, 'entry.ts')
    writeFileSync(entry, "export * from './bridge'\n")
    writeFileSync(
      join(probe, 'bridge.ts'),
      "import('#/server/workspace-deletion/scope')\n",
    )
    expect(moduleGraphFrom([entry], WORKER_CONDITIONS).modules).toContain(
      factory,
    )
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
})
