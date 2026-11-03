import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { expect, it } from 'vitest'
import {
  SOURCE_ROOT,
  modulesUnder,
  scanSpecifiers,
  codeOf,
} from '../../src/server/catalog/__tests__/module-graph'

it('pins every production ledger reader and admits no writer before the driver ships', () => {
  const allowed: Record<string, ReadonlyArray<string>> = {
    'server/auth/index.ts': ['assertWorkspaceNotDeleting'],
    'server/billing/store.ts': ['workspaceDeletionPending'],
    'server/repos/members.ts': [
      'assertWorkspaceNotDeleting',
      'workspaceDeletionAbsent',
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
          /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*\/workspace-deletions(?:\.ts)?['"]/g,
        ),
      ]
      const match = matches[0]
      expect(matches).toHaveLength(ledgerEdges.length)
      if (!match) throw new Error(`Unbounded ledger import: ${file}`)
      actual[relative(SOURCE_ROOT, file)] = matches
        .flatMap((entry) => entry[1].split(','))
        .map((name) => name.trim().split(/\s+as\s+/)[0])
        .filter(Boolean)
        .sort()
    }
    if (
      file.endsWith('/catalog/workspace-deletions.ts') ||
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
