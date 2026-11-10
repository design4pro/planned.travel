import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const adrPath = 'docs/adr/0051-bounded-release-content-contract.md'
const policyPaths = [
  'AGENTS.md',
  'CODE_REVIEW.md',
  'docs/SPEC.md',
  'docs/ACCESS.md',
  'docs/ARCHITECTURE.md',
  'docs/CATALOG.md',
  'docs/agents/CODING_STANDARDS.md',
  'docs/adr/0002-tenant-scoped-repository-boundary.md',
  '.claude/agents/persona-workspace-owner.md',
  '.claude/skills/i18n-messages/SKILL.md',
  ...[
    'om-fix',
    'om-code-review',
    'om-auto-create-pr',
    'om-auto-create-pr-loop',
    'om-auto-continue-pr',
    'om-auto-continue-pr-loop',
  ].map((skill) => `.ai/skills/${skill}/SKILL.md`),
]

describe('bounded release-content policy', () => {
  it.each(policyPaths)('%s points to the same bounded amendment', (path) => {
    expect(read(path)).toContain('0051-bounded-release-content-contract.md')
  })

  it('closes the table set and repository owners without admitting runtime work', () => {
    const adr = read(adrPath)
    const tableSection =
      adr.split('## Admitted tables')[1]?.split('## ')[0] ?? ''
    expect(
      [...tableSection.matchAll(/^\| `([^`]+)`/gm)].map((match) => match[1]),
    ).toEqual([
      'content_entries',
      'content_versions',
      'content_translations',
      'release_publications',
      'release_deployments',
      'release_deployment_entries',
      'release_production_state',
    ])
    for (const term of [
      'src/server/repos/content.ts',
      'src/server/repos/releases.ts',
      '(production, headingVersion)',
      'no runtime content SQL',
      'not a catalog member',
      'not an FU-3 resolver',
    ])
      expect(adr).toContain(term)
  })

  it('keeps release authority and atomic audit separate from existing best-effort callers', () => {
    const access = read('docs/ACCESS.md')
    for (const term of [
      'release:review',
      'release:publish',
      'preparePlatformAudit',
      'runAtomicDatabaseBatch',
    ]) {
      expect(access).toContain(term)
    }
    expect(access).toContain('then the entry is appended')
    const adr = read(adrPath)
    for (const term of [
      'primary role and ban state',
      'requirePermission',
      'impersonation',
      'before any statement executes',
      'no sequential fallback',
      'no catalog-to-repos import',
      'no second audit writer',
    ])
      expect(adr).toContain(term)
    const audit = read('src/server/catalog/audit.ts')
    expect(audit).toContain('Call it **after** the mutation has committed')
    expect(audit).toContain('export async function appendPlatformAudit(')
  })

  it('bounds editorial fallback while preserving interface parity', () => {
    const spec = read('docs/SPEC.md')
    expect(spec).toContain('interface messages have no fallback')
    expect(spec).toContain('whole-entry English fallback')
    expect(spec).toContain('lang="en"')
    expect(spec).toContain('dir="ltr"')
    expect(read('docs/ACCESS.md')).toMatch(/curator.*Denied.*Denied/)
  })
})
