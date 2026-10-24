/**
 * The provisioning module is SQL outside `src/server/repos`, named in docs/SPEC.md §6 as a stated,
 * closed exception. The exception is bounded by what the module may import: three tables of the
 * Better Auth identity schema (`user`, `organization`, `member`), never the tenant schema, a
 * repository or the catalogue, and no raw SQL. An import outside that list moves the module past
 * what §6 names and fails here; adding a table is a contract change, so it is a change to this
 * test and to §6 together.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/server/auth/provisioning.ts', 'utf8')
const spec = readFileSync('docs/SPEC.md', 'utf8').replace(/\s+/g, ' ')

/** Every module specifier the file imports or re-exports, type-only or not. */
const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map(
  (match) => match[1],
)

/** The names imported from one module, as written in its `{ ... }` list. */
function namesImportedFrom(specifier: string): Array<string> {
  const match = source.match(
    new RegExp(
      `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+'${specifier}'`,
    ),
  )
  if (match === null) throw new Error(`no named import from ${specifier}`)
  return match[1]
    .split(',')
    .map((name) => name.trim().split(/\s+as\s+/)[0])
    .filter((name) => name !== '')
    .sort()
}

describe('src/server/auth/provisioning.ts', () => {
  it('imports from a closed list of modules and never from the tenant schema, a repository or the catalogue', () => {
    expect([...specifiers].sort()).toEqual([
      '#/lib/workspace-limit',
      '#/server/db/auth-schema',
      './db',
      './participation',
      'drizzle-orm',
      'nanoid',
    ])
  })

  it('touches the user, organization and member tables and no other identity table', () => {
    expect(namesImportedFrom('#/server/db/auth-schema')).toEqual([
      'member',
      'organization',
      'user',
    ])
  })

  it('writes no raw SQL and imports nothing dynamically', () => {
    expect(namesImportedFrom('drizzle-orm')).toEqual([
      'and',
      'asc',
      'count',
      'eq',
    ])
    expect(source).not.toMatch(/\bimport\(/)
    expect(source).not.toMatch(/\brequire\(/)
    // A side-effect or double-quoted import would slip past the specifier scan above.
    expect(source).not.toMatch(/^\s*import\s+['"]/m)
    expect(source).not.toMatch(/from\s+"/)
  })

  it('reaches the tenant layer only through the participation anchor', () => {
    expect(source).toContain(
      "import { recordParticipation } from './participation'",
    )
  })
})

describe('docs/SPEC.md §6', () => {
  it('names the provisioning module as a stated exception, with the tables it touches', () => {
    expect(spec).toContain('The stated exceptions are three, and closed')
    expect(spec).toContain('`src/server/auth/provisioning.ts`')
    expect(spec).toContain(
      'reads `user` and reads and writes `organization` and `member`',
    )
    expect(spec).toContain('Adding a table is a contract change')
  })
})
