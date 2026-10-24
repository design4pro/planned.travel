/**
 * The provisioning module is SQL outside `src/server/repos`, named in docs/SPEC.md §6 as a stated,
 * closed exception. The exception is bounded by what the module may import: the Better Auth identity
 * schema, never the tenant schema. An import of the tenant schema, a repository or the catalogue
 * moves the module past what §6 names and fails here.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/server/auth/provisioning.ts', 'utf8')
const spec = readFileSync('docs/SPEC.md', 'utf8').replace(/\s+/g, ' ')

/** Every module specifier the file imports, type-only or not. */
const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map(
  (match) => match[1],
)

describe('src/server/auth/provisioning.ts', () => {
  it('imports the identity schema and never the tenant schema, a repository or the catalogue', () => {
    expect(specifiers).toContain('#/server/db/auth-schema')
    expect(specifiers.filter((from) => from.startsWith('#/server/db'))).toEqual(
      ['#/server/db/auth-schema'],
    )
    for (const from of specifiers) {
      expect(from).not.toMatch(/^#\/server\/(repos|catalog)(\/|$)/)
    }
  })

  it('reaches the tenant layer only through the write-only participation anchor', () => {
    const local = specifiers.filter((from) => from.startsWith('.'))
    expect(local.sort()).toEqual(['./db', './participation'])
  })
})

describe('docs/SPEC.md §6', () => {
  it('names the provisioning module as a stated exception, with the tables it touches', () => {
    expect(spec).toContain('The stated exceptions are three, and closed')
    expect(spec).toContain('`src/server/auth/provisioning.ts`')
    expect(spec).toContain(
      'reads `user` and writes `organization` and `member`',
    )
    expect(spec).toContain('Adding a table is a contract change')
  })
})
