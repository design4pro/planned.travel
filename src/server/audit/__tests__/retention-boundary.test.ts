import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import {
  SOURCE_ROOT,
  WORKER_CONDITIONS,
  codeOf,
  moduleGraphFrom,
  modulesUnder,
  scanSpecifiers,
} from '#/server/catalog/__tests__/module-graph'

const discovery = join(SOURCE_ROOT, 'server/catalog/tenant-audit-retention.ts')

it('keeps discovery reachable only from the retention orchestrator in production', () => {
  const importers = modulesUnder(SOURCE_ROOT, { tests: false }).filter((file) =>
    scanSpecifiers(codeOf(readFileSync(file, 'utf8'))).specifiers.some(
      (specifier) => {
        const candidate =
          specifier.startsWith('#/') || specifier.startsWith('@/')
            ? join(SOURCE_ROOT, specifier.slice(2))
            : resolve(dirname(file), specifier)
        return (
          candidate.replace(/\.(ts|tsx|js)$/, '') === discovery.slice(0, -3)
        )
      },
    ),
  )
  expect(importers).toEqual([join(SOURCE_ROOT, 'server/audit/retention.ts')])
})

it('never reaches tenant repositories from discovery, even through another module', () => {
  const graph = moduleGraphFrom([discovery], WORKER_CONDITIONS)
  expect(graph.unresolved).toEqual([])
  expect(
    graph.modules.filter((file) =>
      file.startsWith(join(SOURCE_ROOT, 'server/repos/')),
    ),
  ).toEqual([])
})
