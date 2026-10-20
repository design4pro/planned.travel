/**
 * Static pins around the participation anchor (ADR 0043).
 *
 * Four claims are asserted over the source tree; fixtures prove the import and anchor detectors are
 * not blind: every place that inserts a membership also writes the anchor; the anchor's table is
 * named only by the modules allowed to touch it; the erasure catalog has no importer
 * outside the backfill handler; and its cleanup/count primitives have no production caller yet.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SOURCE_ROOT,
  codeOf,
  modulesUnder,
  scanSpecifiers,
} from '#/server/catalog/__tests__/module-graph'

const relative = (file: string) => file.slice(SOURCE_ROOT.length + 1)

const sources = modulesUnder(SOURCE_ROOT, { tests: false })

/** A statement that creates a `member` row, in any spelling this codebase uses. */
const MEMBERSHIP_INSERT =
  /\.insert\(\s*member\s*\)|membersRepository\.insert\(|\bcreateMember\s*\(/

const ANCHOR_WRITE = /\brecordParticipation\(|\brecordParticipant\(/

/** Files whose code inserts a membership and never writes the anchor. */
function unanchored(files: ReadonlyArray<[string, string]>): Array<string> {
  return files
    .filter(([, source]) => {
      const code = codeOf(source)
      return MEMBERSHIP_INSERT.test(code) && !ANCHOR_WRITE.test(code)
    })
    .map(([name]) => name)
}

const sourceTexts: Array<[string, string]> = sources.map((file) => [
  relative(file),
  readFileSync(file, 'utf8'),
])

describe('every place that inserts a membership writes the anchor', () => {
  it('finds the known insert sites, so the scan is not vacuous', () => {
    const sites = sourceTexts
      .filter(([, source]) => MEMBERSHIP_INSERT.test(codeOf(source)))
      .map(([name]) => name)
    expect(sites).toEqual(
      expect.arrayContaining([
        'routes/api/dev/-seed/bootstrap.ts',
        'server/auth/provisioning.ts',
        'server/repos/members.ts',
      ]),
    )
  })

  it('leaves no insert site without an anchor write', () => {
    expect(unanchored(sourceTexts)).toEqual([])
  })

  it('wires both Better Auth paths that the library inserts a member through', () => {
    const index = codeOf(
      readFileSync(`${SOURCE_ROOT}/server/auth/index.ts`, 'utf8'),
    )
    expect(index).toMatch(/beforeAddMember[\s\S]*?recordParticipation\(/)
    expect(index).toContain('organizationWithAtomicInvitations')
    const acceptance = codeOf(
      readFileSync(
        `${SOURCE_ROOT}/server/repos/workspace-invitation-acceptance.ts`,
        'utf8',
      ),
    )
    expect(acceptance).toMatch(
      /runAtomicBatch[\s\S]*?prepareTenantInsert[\s\S]*?workspaceParticipants/,
    )
  })

  it('notices an insert with no anchor write (fixture)', () => {
    expect(
      unanchored([
        [
          'fixture.ts',
          'await db.insert(member).values({ organizationId, userId })',
        ],
        ['spelled-out.ts', 'await membersRepository.insert(scope, { userId })'],
        [
          'ok.ts',
          'recordParticipation(db, o, u); db.insert(member).values({})',
        ],
      ]),
    ).toEqual(['fixture.ts', 'spelled-out.ts'])
  })
})

describe('the anchor table is named only where it may be', () => {
  const ALLOWED = [
    'server/auth/participation.ts',
    'server/catalog/erasure.ts',
    'server/db/schema.ts',
    'server/erasure/registry.ts',
    'server/repos/participants.ts',
    'server/repos/workspace-invitation-acceptance.ts',
  ]
  const NAME = /workspace_participants|workspaceParticipants/

  it('is named by the schema, the two writers, the catalog read and the registry, and nothing else', () => {
    const named = sourceTexts
      .filter(([, source]) => NAME.test(codeOf(source)))
      .map(([name]) => name)
      .sort()
    expect(named).toEqual(ALLOWED)
  })

  it('is not reachable by a spelling the pattern misses (fixture)', () => {
    expect(NAME.test('sql`select * from workspace_participants`')).toBe(true)
    expect(
      NAME.test("import { workspaceParticipants } from '#/server/db/schema'"),
    ).toBe(true)
  })
})

describe('who imports the erasure catalog', () => {
  it('keeps cleanup and count primitives without production callers until the engine amendment', () => {
    const workerOnly =
      /\b(?:eraseWorkspaceInvitations|eraseAccountAuthLeftovers|erasePlatformUserReferences|countPlatformUserReferences)\b/
    expect(
      sourceTexts
        .filter(
          ([file, source]) =>
            file !== 'server/catalog/erasure.ts' &&
            workerOnly.test(codeOf(source)),
        )
        .map(([file]) => file),
    ).toEqual([])
  })

  const imports = (file: string, source: string) =>
    scanSpecifiers(codeOf(source)).specifiers.some(
      (specifier) =>
        /(^|\/)catalog\/erasure$/.test(specifier) ||
        (file.startsWith('server/catalog/') && specifier === './erasure'),
    )

  it('is the participation backfill handler and nothing else', () => {
    const importers = sourceTexts
      .filter(([file, source]) => imports(file, source))
      .map(([file]) => file)
    expect(importers).toEqual(['server/queue/handlers/participant-backfill.ts'])
  })

  it('sees an importer under any spelling (fixture)', () => {
    expect(
      imports('x.ts', "import { a } from '#/server/catalog/erasure'"),
    ).toBe(true)
    expect(imports('x.ts', "import { a } from '../../catalog/erasure'")).toBe(
      true,
    )
    expect(
      imports('x.ts', "const m = await import('#/server/catalog/erasure')"),
    ).toBe(true)
    expect(
      imports('server/catalog/x.ts', "import { a } from './erasure'"),
    ).toBe(true)
    expect(imports('x.ts', "import { a } from '#/server/catalog/audit'")).toBe(
      false,
    )
  })
})
