/**
 * The registry of erasure outcomes cannot drift from the schema.
 *
 * Every column that names a user has one recorded outcome, and the next engineer who adds a
 * `userRef()` column is told here, in a red test, that an erasure has to know about it. The check is
 * made over the schema *source* because `userRef()` is a plain `text` column and records nothing at
 * runtime. The controls matter as much as the assertions: a comparison that extracts nothing also
 * reports no drift, so a fixture adds a column to a copy of the source and removes another, and the
 * comparison has to name both.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { is } from 'drizzle-orm'
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { authSchema } from '#/server/db/auth-schema'
import * as domainSchema from '#/server/db/schema'
import { ERASURE_OUTCOMES, ERASURE_REGISTRY } from '../registry'
import {
  extractUserForeignKeys,
  extractUserRefColumns,
  findRegistryDrift,
} from './schema-user-columns'

// Independently counted from the 50 userRef column declarations in schema.ts.
const EXPECTED_USER_REF_COLUMNS = 50

function assertUserRefBaseline(source: string): void {
  expect(extractUserRefColumns(source)).toHaveLength(EXPECTED_USER_REF_COLUMNS)
}

const ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const schemaSource = readFileSync(join(ROOT, 'src/server/db/schema.ts'), 'utf8')
const authSchemaSource = readFileSync(
  join(ROOT, 'src/server/db/auth-schema.ts'),
  'utf8',
)

/** `table.column` for every column the two schema modules declare, as drizzle describes them. */
function declaredColumns(): Set<string> {
  const exported: Array<unknown> = Object.values({
    ...authSchema,
    ...domainSchema,
  })
  const keys = new Set<string>()
  for (const value of exported) {
    if (is(value, SQLiteTable)) {
      const config = getTableConfig(value)
      for (const column of config.columns) {
        keys.add(`${config.name}.${column.name}`)
      }
    }
  }
  return keys
}

describe('the registry against the schema', () => {
  it('reads the schema well enough to mean something', () => {
    // An extraction that silently found nothing would make the drift assertions vacuous.
    assertUserRefBaseline(schemaSource)
    expect(extractUserForeignKeys(authSchemaSource)).toEqual(
      expect.arrayContaining([
        'session.user_id',
        'account.user_id',
        'two_factor.user_id',
        'passkey.user_id',
        'member.user_id',
        'invitation.inviter_id',
      ]),
    )
  })

  it('has an entry for every user-naming column and none for a column that is gone', () => {
    expect(
      findRegistryDrift(schemaSource, authSchemaSource, ERASURE_REGISTRY),
    ).toEqual({ missing: [], surplus: [] })
  })

  it('fails when the schema gains a userRef column the registry does not list', () => {
    const grown = schemaSource.replace(
      "    userId: userRef('user_id').notNull(),\n    erasureId: text('erasure_id'),",
      "    userId: userRef('user_id').notNull(),\n    invitedBy: userRef('invited_by'),\n    erasureId: text('erasure_id'),",
    )
    expect(grown).not.toBe(schemaSource)

    expect(
      findRegistryDrift(grown, authSchemaSource, ERASURE_REGISTRY),
    ).toEqual({ missing: ['workspace_participants.invited_by'], surplus: [] })
  })

  it('fails when the schema loses a userRef column the registry still lists', () => {
    const shrunk = schemaSource.replace(
      "    senderUserId: userRef('sender_user_id'),\n",
      '',
    )
    expect(shrunk).not.toBe(schemaSource)

    expect(
      findRegistryDrift(shrunk, authSchemaSource, ERASURE_REGISTRY),
    ).toEqual({ missing: [], surplus: ['notifications.sender_user_id'] })
  })

  it('rejects coordinated removal from the schema and registry', () => {
    const shrunk = schemaSource.replace(
      "    senderUserId: userRef('sender_user_id'),\n",
      '',
    )
    expect(shrunk).not.toBe(schemaSource)
    const registry = ERASURE_REGISTRY.filter(
      (entry) =>
        !(entry.table === 'notifications' && entry.column === 'sender_user_id'),
    )
    expect(findRegistryDrift(shrunk, authSchemaSource, registry)).toEqual({
      missing: [], surplus: [],
    })
    expect(() => assertUserRefBaseline(shrunk)).toThrow()
  })

  it('fails when an auth table gains a foreign key to the user', () => {
    const grown = authSchemaSource.replace(
      "    impersonatedBy: text('impersonated_by'),",
      "    impersonatedBy: text('impersonated_by'),\n    auditorId: text('auditor_id').references(() => user.id),",
    )
    expect(grown).not.toBe(authSchemaSource)

    expect(
      findRegistryDrift(schemaSource, grown, ERASURE_REGISTRY).missing,
    ).toEqual(['session.auditor_id'])
  })

  it('names only columns the schema declares, the embedded places included', () => {
    const declared = declaredColumns()
    const unknown = ERASURE_REGISTRY.filter(
      (entry) => !declared.has(`${entry.table}.${entry.column}`),
    ).map((entry) => `${entry.table}.${entry.column}`)
    expect(unknown).toEqual([])
  })
})

describe('every entry', () => {
  it('is registered once', () => {
    const keys = ERASURE_REGISTRY.map(
      (entry) => `${entry.table}.${entry.column}`,
    )
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([])
  })

  it('gives every entry a reason of a real sentence', () => {
    const short = ERASURE_REGISTRY.filter(
      (entry) => entry.reason.trim().length < 20,
    ).map((entry) => `${entry.table}.${entry.column}: ${entry.reason}`)
    expect(short).toEqual([])
  })

  it('has an outcome of the closed vocabulary, a reason and an owner module that exists', () => {
    for (const entry of ERASURE_REGISTRY) {
      const name = `${entry.table}.${entry.column}`
      expect(ERASURE_OUTCOMES, name).toContain(entry.outcome)
      expect(
        existsSync(join(ROOT, entry.owner)),
        `${name} owner ${entry.owner}`,
      ).toBe(true)
      if (entry.alternative !== undefined) {
        expect(ERASURE_OUTCOMES, name).toContain(entry.alternative.outcome)
        expect(entry.alternative.outcome, name).not.toBe(entry.outcome)
        expect(entry.alternative.when.trim().length, name).toBeGreaterThan(0)
      }
    }
  })

  it('keeps nothing but the platform audit ledger', () => {
    const kept = ERASURE_REGISTRY.filter(
      (entry) =>
        entry.outcome === 'keep' || entry.alternative?.outcome === 'keep',
    ).map((entry) => entry.table)
    expect(kept.length).toBeGreaterThan(0)
    expect(new Set(kept)).toEqual(new Set(['platform_audit_log']))
  })

  it('removes the participation anchor after the verification sweep, and nothing else then', () => {
    const last = ERASURE_REGISTRY.filter((entry) => entry.step === 'finish')
    expect(last.map((entry) => `${entry.table}.${entry.column}`)).toEqual([
      'workspace_participants.user_id',
    ])
  })

  it('leaves every global table to the catalog module and every tenant table to a repository', () => {
    const global = new Set([
      'staff_api_tokens',
      'platform_audit_log',
      'provider_registry',
      'user',
      'session',
      'account',
      'two_factor',
      'passkey',
      'member',
      'invitation',
      'verification',
    ])
    for (const entry of ERASURE_REGISTRY) {
      const expected = global.has(entry.table)
        ? 'src/server/catalog/erasure.ts'
        : undefined
      if (expected === undefined) {
        expect(entry.owner, entry.table).toMatch(/^src\/server\/repos\//)
      } else {
        expect(entry.owner, entry.table).toBe(expected)
      }
    }
  })
})
