/**
 * The declaration layer for platform roles and the platform audit log.
 *
 * Two failures this file exists to catch, both of which typecheck cleanly and neither of which any
 * other test can see:
 *
 * 1. **A snake_case property key on `user` or `session`.** Better Auth's Drizzle adapter resolves a
 *    column as `schemaModel[getFieldName({ model, field })]`, and `initGetFieldName` returns the
 *    declared field name with no case transform. So `ban_reason` as a *property* compiles, passes
 *    `pnpm typecheck`, and throws `BetterAuthError` at runtime on the first ban. The SQL argument is
 *    snake_case; the key is not, and the assertions below pin both halves.
 * 2. **A `CHECK` constraint that reads correctly and does not fire.** The rules in
 *    `docs/ACCESS.md` §4.1 are cross-column, so nothing in TypeScript enforces them. The harness
 *    generates its DDL from this very schema through `drizzle-kit/api` and runs it on `node:sqlite`,
 *    so the constraints exercised here are the ones the migration ships.
 * 3. **Half a biconditional.** §4.1's two invariants each say "exactly when", and the obvious
 *    `CHECK` for each covers only the forward direction: `agent ⇒ token` leaves a `human` row free
 *    to carry a credential, and `system ⇒ no actor` leaves every other kind free to carry none.
 *    Both converses are constraints too, and the cases below insert the three rows that used to be
 *    accepted so a regression is a failing test rather than a quiet hole in the log.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { session, user } from '#/server/db/auth-schema'
import {
  PLATFORM_AUDIT_ENTITY_TYPES,
  newId,
  platformAuditLog,
  staffApiTokens,
} from '#/server/db/schema'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'
import type { Harness } from '#/server/repos/__tests__/harness'
import type { NewPlatformAuditLogEntry } from '#/server/db/types'

/**
 * The constraint a rejected write tripped.
 *
 * Drizzle's own message repeats the SQL and the parameters; SQLite's name for the constraint is on
 * the `cause`. Asserting on the name rather than on "it threw" is what distinguishes the two
 * cross-column rules from each other and from a `NOT NULL` that happened to fire first.
 */
function constraintName(error: Error): string {
  const cause: unknown = error.cause
  return cause instanceof Error ? cause.message : error.message
}

function sqlNames(table: typeof user | typeof session): Array<string> {
  return getTableConfig(table).columns.map((column) => column.name)
}

describe('the admin plugin columns on user and session', () => {
  it('spells its property keys camelCase, which is how the adapter addresses them', () => {
    expect(Object.keys(user)).toEqual(
      expect.arrayContaining(['role', 'banned', 'banReason', 'banExpires']),
    )
    expect(Object.keys(session)).toEqual(expect.arrayContaining(['impersonatedBy']))

    // The SQL spellings are not keys. A key named this way is the runtime failure described above.
    for (const wrong of ['ban_reason', 'ban_expires']) {
      expect(Object.keys(user)).not.toContain(wrong)
    }
    expect(Object.keys(session)).not.toContain('impersonated_by')
  })

  it('spells its SQL column names snake_case', () => {
    expect(sqlNames(user)).toEqual(
      expect.arrayContaining(['role', 'banned', 'ban_reason', 'ban_expires']),
    )
    expect(sqlNames(session)).toContain('impersonated_by')
  })

  it('leaves role nullable and defaults banned to false', () => {
    expect(user.role.notNull).toBe(false)
    expect(user.role.hasDefault).toBe(false)
    expect(user.banned.notNull).toBe(true)
    expect(user.banned.default).toBe(false)
  })

  it('indexes role, because the console lists by it', () => {
    const names = getTableConfig(user).indexes.map((entry) => entry.config.name)
    expect(names).toContain('user_role_idx')
  })
})

describe('platform_audit_log declaration', () => {
  it('carries the twelve columns of docs/ACCESS.md §4.1 and no thirteenth', () => {
    expect(getTableConfig(platformAuditLog).columns.map((column) => column.name)).toEqual([
      'id',
      'actor_user_id',
      'actor_kind',
      'actor_role',
      'token_id',
      'action',
      'entity_type',
      'entity_id',
      'changes',
      'ip',
      'user_agent',
      'created_at',
    ])
  })

  it('carries no organization_id, because a platform action belongs to no tenant', () => {
    const names = getTableConfig(platformAuditLog).columns.map((column) => column.name)
    expect(names).not.toContain('organization_id')
  })

  it('declares all five indexes and no two-column entity index beside the three-column one', () => {
    const indexes = getTableConfig(platformAuditLog).indexes.map((entry) => ({
      name: entry.config.name,
      columns: entry.config.columns.map((column) => ('name' in column ? column.name : '')),
    }))

    expect(indexes).toEqual([
      {
        name: 'platform_audit_log_entity_idx',
        columns: ['entity_type', 'entity_id', 'created_at'],
      },
      { name: 'platform_audit_log_actor_idx', columns: ['actor_user_id', 'created_at'] },
      { name: 'platform_audit_log_action_idx', columns: ['action', 'created_at'] },
      { name: 'platform_audit_log_token_idx', columns: ['token_id'] },
      { name: 'platform_audit_log_created_at_idx', columns: ['created_at'] },
    ])
  })

  it('declares five CHECKs, forward halves first, and none on entity_type', () => {
    // The order is load-bearing: SQLite reports the first constraint a row violates in declaration
    // order, so a `system` row naming a token is reported against the kind it claimed to be rather
    // than against the converse rule it also broke. The behavioural half is asserted further down.
    expect(getTableConfig(platformAuditLog).checks.map((entry) => entry.name)).toEqual([
      'platform_audit_log_actor_kind_chk',
      'platform_audit_log_agent_token_chk',
      'platform_audit_log_system_actor_chk',
      'platform_audit_log_token_agent_only_chk',
      'platform_audit_log_actor_identity_chk',
    ])
  })

  it('gives token_id a real foreign key and actor_user_id none', () => {
    const config = getTableConfig(platformAuditLog)
    const references = config.foreignKeys.map((key) => key.reference())

    expect(references).toHaveLength(1)
    expect(references[0]?.columns.map((column) => column.name)).toEqual(['token_id'])
    expect(references[0]?.foreignColumns.map((column) => column.name)).toEqual(['id'])
    // The declared clause is docs/ACCESS.md §4.1's, verbatim. What it does at runtime is not what
    // it reads as; the two tests further down pin the actual behaviour.
    expect(config.foreignKeys[0]?.onDelete).toBe('set null')
  })
})

describe('staff_api_tokens declaration', () => {
  it('matches docs/CATALOG.md §2.10 column for column', () => {
    expect(getTableConfig(staffApiTokens).columns.map((column) => column.name)).toEqual([
      'id',
      'user_id',
      'name',
      'token_hash',
      'token_prefix',
      'last_used_at',
      'last_used_ip',
      'expires_at',
      'revoked_at',
      'created_by',
      'created_at',
      'updated_at',
    ])
  })

  it('makes expires_at mandatory — the console sells no unbounded token', () => {
    expect(staffApiTokens.expiresAt.notNull).toBe(true)
    expect(staffApiTokens.revokedAt.notNull).toBe(false)
  })

  it('declares its four indexes, the token hash unique', () => {
    const indexes = getTableConfig(staffApiTokens).indexes.map((entry) => ({
      name: entry.config.name,
      unique: entry.config.unique,
      columns: entry.config.columns.map((column) => ('name' in column ? column.name : '')),
    }))

    expect(indexes).toEqual([
      { name: 'staff_api_tokens_token_hash_unq', unique: true, columns: ['token_hash'] },
      {
        name: 'staff_api_tokens_user_revoked_idx',
        unique: false,
        columns: ['user_id', 'revoked_at'],
      },
      { name: 'staff_api_tokens_expires_at_idx', unique: false, columns: ['expires_at'] },
      { name: 'staff_api_tokens_created_by_idx', unique: false, columns: ['created_by'] },
    ])
  })
})

describe('the platform_audit_log constraints, against real SQLite', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await createHarness()
  })

  afterEach(() => {
    harness.close()
  })

  /**
   * A row that satisfies every constraint, so each case below breaks exactly the one rule it names.
   * The default actor is a `human` with both identity columns filled, which is what
   * `platform_audit_log_actor_identity_chk` requires of every kind but `system`.
   */
  function entry(overrides: Partial<NewPlatformAuditLogEntry>): NewPlatformAuditLogEntry {
    return {
      actorKind: 'human',
      actorUserId: newId(),
      actorRole: 'admin',
      action: 'platform.user.role_changed',
      entityType: 'user',
      entityId: newId(),
      ...overrides,
    }
  }

  /** A `system` row: no actor, no role, no credential, and each case puts back only what it tests. */
  function systemEntry(
    overrides: Partial<NewPlatformAuditLogEntry> = {},
  ): Partial<NewPlatformAuditLogEntry> {
    return {
      actorKind: 'system',
      actorUserId: null,
      actorRole: null,
      tokenId: null,
      ...overrides,
    }
  }

  async function append(overrides: Partial<NewPlatformAuditLogEntry>): Promise<void> {
    await harness.db.insert(platformAuditLog).values(entry(overrides))
  }

  async function seedToken(): Promise<string> {
    const id = newId()
    const ownerId = newId()
    await harness.db.insert(staffApiTokens).values({
      id,
      userId: ownerId,
      name: 'catalogue importer',
      tokenHash: `hash-${id}`,
      tokenPrefix: 'pt_mcp_abcde',
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      createdBy: ownerId,
    })
    return id
  }

  it('accepts a human row carrying an actor and a role', async () => {
    await append({ actorKind: 'human', actorUserId: newId(), actorRole: 'admin' })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorKind).toBe('human')
    expect(rows[0]?.actorRole).toBe('admin')
  })

  it('rejects an agent row with no token', async () => {
    const error = await captureError(() =>
      append({ actorKind: 'agent', actorUserId: newId(), actorRole: 'curator', tokenId: null }),
    )
    expect(constraintName(error)).toContain('platform_audit_log_agent_token_chk')
  })

  it('accepts an agent row that names its credential', async () => {
    const tokenId = await seedToken()
    await append({ actorKind: 'agent', actorUserId: newId(), actorRole: 'curator', tokenId })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.tokenId).toBe(tokenId)
  })

  it('rejects a human row carrying a token, because only an agent arrives on one', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() => append({ actorKind: 'human', tokenId }))
    expect(constraintName(error)).toContain('platform_audit_log_token_agent_only_chk')
  })

  it('rejects a human row with no actor', async () => {
    const error = await captureError(() => append({ actorKind: 'human', actorUserId: null }))
    expect(constraintName(error)).toContain('platform_audit_log_actor_identity_chk')
  })

  it('rejects a human row with no role', async () => {
    const error = await captureError(() => append({ actorKind: 'human', actorRole: null }))
    expect(constraintName(error)).toContain('platform_audit_log_actor_identity_chk')
  })

  it('rejects an agent row with no actor, even though it names a token', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() =>
      append({ actorKind: 'agent', actorUserId: null, actorRole: 'curator', tokenId }),
    )
    expect(constraintName(error)).toContain('platform_audit_log_actor_identity_chk')
  })

  it('rejects a system row that names an actor', async () => {
    const error = await captureError(() => append(systemEntry({ actorUserId: newId() })))
    expect(constraintName(error)).toContain('platform_audit_log_system_actor_chk')
  })

  it('rejects a system row that names a role', async () => {
    const error = await captureError(() => append(systemEntry({ actorRole: 'admin' })))
    expect(constraintName(error)).toContain('platform_audit_log_system_actor_chk')
  })

  it('rejects a system row that names a token', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() => append(systemEntry({ tokenId })))
    expect(constraintName(error)).toContain('platform_audit_log_system_actor_chk')
  })

  it('accepts a system row with no actor, no role and no token', async () => {
    await append(systemEntry({ entityType: 'catalog_place' }))

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.actorUserId).toBeNull()
    expect(rows[0]?.actorRole).toBeNull()
    expect(rows[0]?.tokenId).toBeNull()
  })

  it('rejects an actor_kind outside the three', async () => {
    const error = await captureError(() =>
      // `robot` is not one of the three; only the CHECK stands between it and the table.
      append({ actorKind: 'robot' }),
    )
    expect(constraintName(error)).toContain('platform_audit_log_actor_kind_chk')
  })

  it('leaves entity_type unconstrained, which is what docs/ACCESS.md §4.1 asks for', async () => {
    // §4.1's type column marks `actor_kind` as text + enumCheck() and `entity_type` as plain text,
    // with the eight values in the Notes column; `action` is closed the same way in §4.2 and is
    // plain text too. A ninth entity type therefore costs an amendment to §4.2's mapping table and
    // not a recreate of a table that may not be recreated. The vocabulary is enforced above the
    // database, by PLATFORM_AUDIT_ENTITY_TYPES and the writer that validates against it.
    await append({ entityType: 'trip' })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.entityType).toBe('trip')
    expect(PLATFORM_AUDIT_ENTITY_TYPES).not.toContain('trip')
    expect(PLATFORM_AUDIT_ENTITY_TYPES).toHaveLength(8)
  })

  it('refuses to hard-delete a credential an agent row still names', async () => {
    // `on delete set null` is docs/ACCESS.md §4.1's clause and it can never fire: SQLite
    // re-evaluates CHECKs on the implicit UPDATE that SET NULL performs, and the agent CHECK
    // demands a non-NULL token_id on exactly the rows able to reference a token. The DELETE aborts
    // and the history keeps its attribution — the behaviour the schema docblock now describes.
    const tokenId = await seedToken()
    await append({ actorKind: 'agent', actorUserId: newId(), actorRole: 'curator', tokenId })

    const error = await captureError(() =>
      harness.db.delete(staffApiTokens).where(eq(staffApiTokens.id, tokenId)),
    )
    expect(constraintName(error)).toContain('platform_audit_log_agent_token_chk')

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.tokenId).toBe(tokenId)
  })

  it('still deletes a credential no audit row names', async () => {
    const tokenId = await seedToken()

    await harness.db.delete(staffApiTokens).where(eq(staffApiTokens.id, tokenId))

    expect(await harness.db.select().from(staffApiTokens)).toHaveLength(0)
  })

  it('round-trips a nested before/after changes payload', async () => {
    await append({
      actorUserId: newId(),
      actorRole: 'admin',
      changes: { before: { role: null }, after: { role: 'curator' } },
    })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.changes).toEqual({ before: { role: null }, after: { role: 'curator' } })
  })
})
