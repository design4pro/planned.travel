/**
 * The declaration layer for platform roles and the platform audit log.
 *
 * Four failures this file exists to catch. The first three typecheck cleanly and the fourth is the
 * absence of typechecking; no other test in the repository can see any of them:
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
 * 3. **Half a biconditional.** The two rules §4.1's Notes column states each say "exactly when",
 *    which is why §4.1 lists four `CHECK`s: the obvious one for each rule covers only the forward
 *    direction, so `agent ⇒ token` leaves a `human` row free to carry a credential and
 *    `system ⇒ no actor` leaves every other kind free to carry none.
 *    Both converses are constraints too, and the cases below insert the three rows that used to be
 *    accepted so a regression is a failing test rather than a quiet hole in the log.
 * 4. **A vocabulary column narrowed nowhere.** `entity_type` and `action` carry no `CHECK` on
 *    purpose (§4.1), which leaves `$type` as the only thing standing between them and a value
 *    nobody declared — and a column declared `text()` without one is bare `string` on both
 *    inferred row types, so `entityType: 'trip'` and an undotted `action` compile silently. The
 *    type-level block asserts all four vocabularies, and it is checked by `tsc --noEmit` as much
 *    as by vitest.
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest'
import { eq } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import { session, user } from '#/server/db/auth-schema'
import {
  PLATFORM_ACTOR_ROLES,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_ENTITY_TYPES,
  newId,
  platformAuditLog,
  staffApiTokens,
} from '#/server/db/schema'
import { PLATFORM_ROLES_BY_PRECEDENCE } from '#/server/auth/access'
import { captureError, constraintName, createHarness } from '#/server/repos/__tests__/harness'
import type { Harness } from '#/server/repos/__tests__/harness'
import type { PlatformRole } from '#/server/auth/access'
import type {
  NewPlatformAuditLogEntry,
  PlatformActorKind,
  PlatformActorRole,
  PlatformAuditAction,
  PlatformAuditChanges,
  PlatformAuditEntityType,
  PlatformAuditLogEntry,
} from '#/server/db/types'

function sqlNames(table: typeof user | typeof session): Array<string> {
  return getTableConfig(table).columns.map((column) => column.name)
}

/**
 * A value the column's `$type` refuses, put back into the row so the database can answer for
 * itself.
 *
 * Every use of this is a test asking the second question — "and if TypeScript were bypassed?" —
 * which is the only interesting one to ask of a `CHECK`, and the only way to demonstrate the
 * *absence* of one. The cast is named rather than scattered so that a reader can see that no
 * production path can construct these values at all: `pnpm typecheck` refuses them, which is what
 * the block of type assertions below pins.
 */
function pastTheTypeSystem<TField extends keyof NewPlatformAuditLogEntry>(
  value: string,
): NewPlatformAuditLogEntry[TField] {
  return value as NewPlatformAuditLogEntry[TField]
}

describe('the admin plugin columns on user and session', () => {
  it('spells its property keys camelCase, which is how the adapter addresses them', () => {
    expect(Object.keys(user)).toEqual(
      expect.arrayContaining(['role', 'banned', 'banReason', 'banExpires']),
    )
    expect(Object.keys(session)).toEqual(
      expect.arrayContaining(['impersonatedBy']),
    )

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
    expect(
      getTableConfig(platformAuditLog).columns.map((column) => column.name),
    ).toEqual([
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
    const names = getTableConfig(platformAuditLog).columns.map(
      (column) => column.name,
    )
    expect(names).not.toContain('organization_id')
  })

  it('declares all five indexes and no two-column entity index beside the three-column one', () => {
    const indexes = getTableConfig(platformAuditLog).indexes.map((entry) => ({
      name: entry.config.name,
      columns: entry.config.columns.map((column) =>
        'name' in column ? column.name : '',
      ),
    }))

    expect(indexes).toEqual([
      {
        name: 'platform_audit_log_entity_idx',
        columns: ['entity_type', 'entity_id', 'created_at'],
      },
      {
        name: 'platform_audit_log_actor_idx',
        columns: ['actor_user_id', 'created_at'],
      },
      {
        name: 'platform_audit_log_action_idx',
        columns: ['action', 'created_at'],
      },
      { name: 'platform_audit_log_token_idx', columns: ['token_id'] },
      { name: 'platform_audit_log_created_at_idx', columns: ['created_at'] },
    ])
  })

  it('declares five CHECKs, forward halves first, and none on entity_type', () => {
    // The order is load-bearing: SQLite reports the first constraint a row violates in declaration
    // order, so a `system` row naming a token is reported against the kind it claimed to be rather
    // than against the converse rule it also broke. The behavioural half is asserted further down.
    expect(
      getTableConfig(platformAuditLog).checks.map((entry) => entry.name),
    ).toEqual([
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
    expect(references[0]?.columns.map((column) => column.name)).toEqual([
      'token_id',
    ])
    expect(references[0]?.foreignColumns.map((column) => column.name)).toEqual([
      'id',
    ])
    // `restrict`, which is what docs/ACCESS.md §4.1's type column says. `SET NULL` — the wording
    // it replaced — is unreachable here: it violates the agent CHECK on the only rows able to name
    // a token, so the DELETE was always refused. The two tests further down pin the behaviour.
    expect(config.foreignKeys[0]?.onDelete).toBe('restrict')
  })
})

/**
 * docs/ACCESS.md §4.1 narrows `entity_type` and `action` in TypeScript rather than in SQL, because
 * both vocabularies grow by amendment and a `CHECK` would price each amendment at a recreate of a
 * table that may not be recreated. That reasoning is only sound while the narrowing exists, and a
 * column declared `text()` with no `$type` is bare `string` on both inferred row types — which
 * accepts `actorKind: 'robot'`, `actorRole: 'wizard'`, an undotted `action` and `entityType:
 * 'trip'` with no complaint from `pnpm typecheck` at all. That is exactly the row an auditor
 * compiled against an earlier form of this table.
 *
 * These assertions are the whole of the guarantee for the two columns with no `CHECK` behind them,
 * and the first line of it for the two that have one. They are type-level, so they are checked by
 * `tsc --noEmit` as well as run by vitest.
 */
describe('the four vocabulary columns, narrowed in TypeScript', () => {
  it('types entity_type as the nine entities of docs/ACCESS.md §4.2', () => {
    expectTypeOf<
      NewPlatformAuditLogEntry['entityType']
    >().toEqualTypeOf<PlatformAuditEntityType>()
    expectTypeOf<
      PlatformAuditLogEntry['entityType']
    >().toEqualTypeOf<PlatformAuditEntityType>()
    expectTypeOf<'trip'>().not.toExtend<PlatformAuditEntityType>()
  })

  it('types action as the thirty-four actions of docs/ACCESS.md §4.2', () => {
    expectTypeOf<
      NewPlatformAuditLogEntry['action']
    >().toEqualTypeOf<PlatformAuditAction>()
    expectTypeOf<
      PlatformAuditLogEntry['action']
    >().toEqualTypeOf<PlatformAuditAction>()
    expectTypeOf<'NOT A DOTTED ACTION'>().not.toExtend<PlatformAuditAction>()
    expectTypeOf<'trip.hijacked'>().not.toExtend<PlatformAuditAction>()

    expect(PLATFORM_AUDIT_ACTIONS).toHaveLength(34)
    // §4.2: eighteen two-segment actions and sixteen three-segment platform ones.
    const platform = PLATFORM_AUDIT_ACTIONS.filter((action) =>
      action.startsWith('platform.'),
    )
    expect(platform).toHaveLength(16)
    expect(platform.every((action) => action.split('.').length === 3)).toBe(
      true,
    )
    expect(
      PLATFORM_AUDIT_ACTIONS.filter(
        (action) => !action.startsWith('platform.'),
      ).every((action) => action.split('.').length === 2),
    ).toBe(true)
  })

  it('types action against the dotted-action regex both logs enforce', () => {
    // The shape rule of docs/ACCESS.md §4.2, restated here only as a property of the list. The
    // regex lives in `src/server/db/audit-action.ts`, the leaf module both logs read it from, and
    // §4.2 requires every reader to import it rather than re-declare it — a second spelling of the
    // character class is a second vocabulary, and it would drift silently because it would keep
    // passing. So this file imports it too; the assertion is about the vocabulary, not the
    // validator.
    for (const action of PLATFORM_AUDIT_ACTIONS) {
      expect(action).toMatch(AUDIT_ACTION_PATTERN)
      expect(action.length).toBeLessThanOrEqual(64)
    }
  })

  it('types actor_kind and actor_role as their three names each', () => {
    expectTypeOf<
      NewPlatformAuditLogEntry['actorKind']
    >().toEqualTypeOf<PlatformActorKind>()
    expectTypeOf<
      NonNullable<NewPlatformAuditLogEntry['actorRole']>
    >().toEqualTypeOf<PlatformActorRole>()
    expectTypeOf<'robot'>().not.toExtend<PlatformActorKind>()
    expectTypeOf<'wizard'>().not.toExtend<PlatformActorRole>()
  })

  it('spells actor_role with the same three names as the role dictionary', () => {
    // `src/server/auth/access.ts` enumerates the three roles a second time, as the keys of its
    // `roles` map, because this file is reachable from the client graph and from drizzle-kit and
    // will not import an authorisation module to type a column. This is the join between them: a
    // fourth role added to either side without the other fails here, at the type level and at
    // runtime both.
    expectTypeOf<PlatformActorRole>().toEqualTypeOf<PlatformRole>()
    expect([...PLATFORM_ACTOR_ROLES].sort()).toEqual(
      [...PLATFORM_ROLES_BY_PRECEDENCE].sort(),
    )
  })

  it('narrows the nested changes payload rather than reusing the flat tenant one', () => {
    expectTypeOf<
      NonNullable<NewPlatformAuditLogEntry['changes']>
    >().toEqualTypeOf<PlatformAuditChanges>()
  })
})

describe('staff_api_tokens declaration', () => {
  it('matches docs/CATALOG.md §2.10 column for column', () => {
    expect(
      getTableConfig(staffApiTokens).columns.map((column) => column.name),
    ).toEqual([
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
      columns: entry.config.columns.map((column) =>
        'name' in column ? column.name : '',
      ),
    }))

    expect(indexes).toEqual([
      {
        name: 'staff_api_tokens_token_hash_unq',
        unique: true,
        columns: ['token_hash'],
      },
      {
        name: 'staff_api_tokens_user_revoked_idx',
        unique: false,
        columns: ['user_id', 'revoked_at'],
      },
      {
        name: 'staff_api_tokens_expires_at_idx',
        unique: false,
        columns: ['expires_at'],
      },
      {
        name: 'staff_api_tokens_created_by_idx',
        unique: false,
        columns: ['created_by'],
      },
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
  function entry(
    overrides: Partial<NewPlatformAuditLogEntry>,
  ): NewPlatformAuditLogEntry {
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

  async function append(
    overrides: Partial<NewPlatformAuditLogEntry>,
  ): Promise<void> {
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
    await append({
      actorKind: 'human',
      actorUserId: newId(),
      actorRole: 'admin',
    })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorKind).toBe('human')
    expect(rows[0]?.actorRole).toBe('admin')
  })

  it('rejects an agent row with no token', async () => {
    const error = await captureError(() =>
      append({
        actorKind: 'agent',
        actorUserId: newId(),
        actorRole: 'curator',
        tokenId: null,
      }),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_agent_token_chk',
    )
  })

  it('accepts an agent row that names its credential', async () => {
    const tokenId = await seedToken()
    await append({
      actorKind: 'agent',
      actorUserId: newId(),
      actorRole: 'curator',
      tokenId,
    })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.tokenId).toBe(tokenId)
  })

  it('rejects a human row carrying a token, because only an agent arrives on one', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() =>
      append({ actorKind: 'human', tokenId }),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_token_agent_only_chk',
    )
  })

  it('rejects a human row with no actor', async () => {
    const error = await captureError(() =>
      append({ actorKind: 'human', actorUserId: null }),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_actor_identity_chk',
    )
  })

  it('rejects a human row with no role', async () => {
    const error = await captureError(() =>
      append({ actorKind: 'human', actorRole: null }),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_actor_identity_chk',
    )
  })

  it('rejects an agent row with no actor, even though it names a token', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() =>
      append({
        actorKind: 'agent',
        actorUserId: null,
        actorRole: 'curator',
        tokenId,
      }),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_actor_identity_chk',
    )
  })

  it('rejects a system row that names an actor', async () => {
    const error = await captureError(() =>
      append(systemEntry({ actorUserId: newId() })),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_system_actor_chk',
    )
  })

  it('rejects a system row that names a role', async () => {
    const error = await captureError(() =>
      append(systemEntry({ actorRole: 'admin' })),
    )
    expect(constraintName(error)).toContain(
      'platform_audit_log_system_actor_chk',
    )
  })

  it('rejects a system row that names a token', async () => {
    const tokenId = await seedToken()
    const error = await captureError(() => append(systemEntry({ tokenId })))
    expect(constraintName(error)).toContain(
      'platform_audit_log_system_actor_chk',
    )
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
      // `robot` is refused by the column's `$type` as well; the cast is what lets this test ask the
      // second question — whether the CHECK still stands when TypeScript is bypassed.
      append({ actorKind: pastTheTypeSystem<'actorKind'>('robot') }),
    )
    expect(constraintName(error)).toContain('platform_audit_log_actor_kind_chk')
  })

  it('leaves entity_type unconstrained in SQL, which is what docs/ACCESS.md §4.1 asks for', async () => {
    // §4.1's type column marks `actor_kind` as text + enumCheck() and `entity_type` as plain text,
    // with the nine values in the Notes column; `action` is closed the same way in §4.2 and is
    // plain text too. A tenth entity type therefore costs an amendment to §4.2's mapping table and
    // not a recreate of a table that may not be recreated. This test pins the *absence* of the
    // CHECK, so a future round cannot quietly add one; the narrowing that does the work is the
    // `$type` asserted in the block below, which is why an undeclared value needs a cast to get
    // here.
    await append({ entityType: pastTheTypeSystem<'entityType'>('trip') })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.entityType).toBe('trip')
    expect(PLATFORM_AUDIT_ENTITY_TYPES).not.toContain('trip')
    expect(PLATFORM_AUDIT_ENTITY_TYPES).toHaveLength(9)
  })

  it('leaves action unconstrained in SQL for the same reason', async () => {
    await append({ action: pastTheTypeSystem<'action'>('trip.hijacked') })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.action).toBe('trip.hijacked')
  })

  it('refuses to hard-delete a credential an agent row still names', async () => {
    // `on delete set null`, which docs/ACCESS.md §4.1 said before it was amended to `restrict`,
    // was never a reachable outcome: SQLite re-evaluates CHECKs on the implicit UPDATE that SET
    // NULL performs, and the agent CHECK demands a non-NULL token_id on exactly the rows able to
    // reference a token, so the DELETE aborted against a constraint the caller never mentioned.
    // `restrict` produces the same outcome and names it: the history keeps its attribution, and
    // the refusal reads as one.
    const tokenId = await seedToken()
    await append({
      actorKind: 'agent',
      actorUserId: newId(),
      actorRole: 'curator',
      tokenId,
    })

    const error = await captureError(() =>
      harness.db.delete(staffApiTokens).where(eq(staffApiTokens.id, tokenId)),
    )
    expect(constraintName(error)).toContain('FOREIGN KEY constraint failed')

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.tokenId).toBe(tokenId)
  })

  it('still deletes a credential no audit row names', async () => {
    const tokenId = await seedToken()

    await harness.db
      .delete(staffApiTokens)
      .where(eq(staffApiTokens.id, tokenId))

    expect(await harness.db.select().from(staffApiTokens)).toHaveLength(0)
  })

  it('round-trips a nested before/after changes payload', async () => {
    await append({
      actorUserId: newId(),
      actorRole: 'admin',
      changes: { before: { role: null }, after: { role: 'curator' } },
    })

    const rows = await harness.db.select().from(platformAuditLog)
    expect(rows[0]?.changes).toEqual({
      before: { role: null },
      after: { role: 'curator' },
    })
  })
})
