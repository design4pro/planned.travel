/**
 * The single writer of `platform_audit_log`, and the five things that make it trustworthy.
 *
 * 1. **The vocabulary is the document's.** docs/ACCESS.md §4.2 closes the action list and pairs each
 *    prefix with an `entity_type`. Both are asserted against the names spelled out below rather than
 *    against the schema's own array, so a change made in one place and not the other is a failure
 *    here and not a silent agreement between two copies of the same mistake.
 * 2. **The global-table path never reaches through the tenant layer.** SPEC §5 forbids it by name.
 *    That invariant is reachability rather than text, so it lives in `isolation.test.ts` beside this
 *    file as a walk of the module graph — a standing check that must still pass in Faza C when
 *    `repo.ts` arrives beside `audit.ts`, not a Faza B formality.
 * 3. **An append never fails a caller.** §4.3: the mutation has already committed by the time the
 *    row is written, so a rejected append is a logging incident and never a `500` — including when
 *    the logging backend is what failed.
 * 4. **The four ban and impersonation verbs are audited without exception.** They are retried once
 *    and then raised at the highest severity the logger has, and the line names the action and the
 *    actor so the gap in the ledger is identifiable afterwards.
 * 5. **Every field a caller does not control the size of is bounded, and the bound is recorded in
 *    the row as well as in the log.** `ip`, `user_agent` and `changes` all land verbatim in an
 *    append-only table with a 400-day window. An oversized value costs that value and never the
 *    entry, never the rest of the diff (§4.4) and never the truth of the row: what is written in
 *    its place says that it was bounded, because `NULL` on those columns already means "the request
 *    sent none" (§4.1) and a silently shortened string reads thirteen months later as one a client
 *    actually sent.
 * 6. **The prune is bounded and is the platform's.** It is the only delete path the table has, it
 *    selects by `created_at` alone, it refuses an actor that is not `system`, it sizes its
 *    statements off a constant rather than off the backlog, and it says so loudly when a run leaves
 *    rows behind.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'
import { eq } from 'drizzle-orm'
import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import { newId, platformAuditLog } from '#/server/db/schema'
import { createLogger, createMemorySink } from '#/server/observability'
import {
  ALWAYS_AUDITED_ACTIONS,
  PLATFORM_ACTIONS,
  PLATFORM_AUDIT_ENTITY_BY_PREFIX,
  PLATFORM_AUDIT_PRUNE_BATCH_SIZE,
  PLATFORM_AUDIT_PRUNE_MAX_BATCHES,
  PLATFORM_AUDIT_READ_MAX,
  PLATFORM_AUDIT_RETENTION_DAYS,
  PLATFORM_SYSTEM_ACTOR,
  appendPlatformAudit,
  entityTypeForAction,
  prunePlatformAuditLog,
  readPlatformAuditByEntity,
} from '../audit'
import { createPlatformTables } from './platform-tables'
import type {
  PlatformActionName,
  PlatformAuditEntryInput,
  PlatformSystemActor,
} from '../audit'
import type { PlatformTables } from './platform-tables'
import type { PlatformActor } from '#/server/auth/guard'
import type { LogRecord, LogSink, Logger } from '#/server/observability'

/**
 * docs/ACCESS.md §4.2's fifteen `platform.*` rows, in the order the table lists them.
 *
 * The sixteen two-segment catalogue names in the same table — `catalog_place.*`,
 * `catalog_ingest.*`, `place_pack.*`, `catalog_source.*` — belong to `src/server/catalog/repo.ts`
 * in Faza C. When that file lands, **widen** this list to all thirty-one and widen the expected set
 * with it; do not rewrite the assertion.
 */
const ACCESS_PLATFORM_ACTIONS = [
  'platform.user.created',
  'platform.user.updated',
  'platform.user.role_changed',
  'platform.user.banned',
  'platform.user.unbanned',
  'platform.user.deleted',
  'platform.user.password_set',
  'platform.user.email_set',
  'platform.user.impersonation_started',
  'platform.user.impersonation_ended',
  'platform.session.revoked',
  'platform.session.revoked_all',
  'platform.token.issued',
  'platform.token.revoked',
  'platform.share.revoked',
  'provider.limit_changed',
  'provider.policy_changed',
] as const

/** docs/ACCESS.md §4.2's prefix table, all nine rows, transcribed from the document. */
const ACCESS_PREFIX_TABLE: Record<string, string> = {
  catalog_place: 'catalog_place',
  catalog_ingest: 'catalog_ingest',
  place_pack: 'place_pack',
  catalog_source: 'catalog_source',
  'platform.user': 'user',
  'platform.session': 'session',
  'platform.token': 'staff_api_token',
  'platform.share': 'share_link',
  provider: 'provider',
}

const OPERATOR: PlatformActor = {
  userId: 'usr_operator',
  actorKind: 'human',
  role: 'admin',
  tokenId: null,
}

function memoryLogger(): { logger: Logger; records: Array<LogRecord> } {
  const sink: LogSink & { records: Array<LogRecord> } = createMemorySink()
  return {
    logger: createLogger({ level: 'debug', sink }),
    records: sink.records,
  }
}

/** A logging backend that is down — the ordinary way a sink fails. */
function throwingLogger(): { logger: Logger; calls: Array<string> } {
  const calls: Array<string> = []
  const sink: LogSink = {
    write(record) {
      calls.push(record.level)
      throw new Error('log sink unavailable')
    },
  }
  return { logger: createLogger({ level: 'debug', sink }), calls }
}

describe('the platform action vocabulary', () => {
  it('exports exactly the seventeen console-written names docs/ACCESS.md §4.2 declares', () => {
    // Both halves of §4.2's union test, at the level this phase can close them. A name in code and
    // not in the table fails the first expectation; a name in the table that this module does not
    // export fails the second. The document's stronger form — "a name in this table that nothing
    // *writes* fails it" — is scoped here to export parity on purpose: `platform.share.revoked` has
    // no writer until Faza F owns the moderation screen, and `platform.token.*` none until Faza E,
    // yet the §1.1 dictionary is closed in this phase and cannot grow later without amending
    // docs/ACCESS.md. Widen this to call-site parity when the last of those writers lands.
    const exported = Object.values(PLATFORM_ACTIONS)
    expect([...exported].sort()).toEqual([...ACCESS_PLATFORM_ACTIONS].sort())
    expect(exported).toHaveLength(17)
  })

  it('exports platform.share.revoked now, ahead of the Faza F writer', () => {
    expect(PLATFORM_ACTIONS.SHARE_REVOKED).toBe('platform.share.revoked')
  })

  it('matches every constant against the imported dotted-action regex', () => {
    // The regex is `src/server/db/audit-action.ts`'s, imported rather than re-declared, so the
    // tenant log and the platform log cannot drift into two spellings of one character class (§4.2).
    for (const action of Object.values(PLATFORM_ACTIONS)) {
      expect(action).toMatch(AUDIT_ACTION_PATTERN)
      expect(action.length).toBeLessThanOrEqual(64)
    }
  })

  it('declares the dotted-action character class in the leaf module and nowhere new', () => {
    // §4.2's rule as a standing check rather than a one-off grep at review time. "Imported, never
    // re-declared" is a claim about every file, and it is as false when the second spelling sits in
    // a *test* — a test that re-types the class asserts against its own copy and can pass while the
    // declaration it is supposed to be guarding says something else. The needle is assembled from
    // fragments so this file is not itself an occurrence of the thing it counts.
    const characterClass = `[a-${'z0-9'}]`
    const needle = `${characterClass}+(?:[._]${characterClass}+)*`

    const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const files = readdirSync(sourceRoot, {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => `${entry.parentPath}/${entry.name}`)

    expect(files.length).toBeGreaterThan(100)
    const occurrences = files
      .map((file) => ({
        file,
        count: readFileSync(file, 'utf8').split(needle).length - 1,
      }))
      .filter((entry) => entry.count > 0)

    const declaration = `${sourceRoot}server/db/audit-action.ts`
    expect(occurrences.filter((entry) => entry.file === declaration)).toEqual([
      { file: declaration, count: 1 },
    ])

    // One file outside the declaration still spells the class, and it is not this item's to change:
    // `src/server/db/__tests__/platform-schema.test.ts` belongs to an item accepted in an earlier
    // round, and editing an accepted sibling is the finding that rejected this one. It is reported
    // with this item instead, for the owning item to reopen and re-point at the leaf module. Any
    // *other* file appearing here is the drift §4.2 forbids and fails this assertion.
    const reported = `${sourceRoot}server/db/__tests__/platform-schema.test.ts`
    for (const entry of occurrences) {
      expect(
        [declaration, reported],
        `${entry.file} re-declares the character class`,
      ).toContain(entry.file)
    }
  })

  it('begins every constant with a prefix listed in the §4.2 prefix table', () => {
    const prefixes = Object.keys(PLATFORM_AUDIT_ENTITY_BY_PREFIX)
    for (const action of Object.values(PLATFORM_ACTIONS)) {
      expect(prefixes.some((prefix) => action.startsWith(`${prefix}.`))).toBe(
        true,
      )
    }
  })

  it('freezes the constants and the four always-audited verbs', () => {
    expect(Object.isFrozen(PLATFORM_ACTIONS)).toBe(true)
    expect(Object.isFrozen(PLATFORM_AUDIT_ENTITY_BY_PREFIX)).toBe(true)
    expect(Object.isFrozen(ALWAYS_AUDITED_ACTIONS)).toBe(true)
    expect(Object.isFrozen(PLATFORM_SYSTEM_ACTOR)).toBe(true)
  })

  it('names the four verbs §4.3 audits without exception', () => {
    expect([...ALWAYS_AUDITED_ACTIONS]).toEqual([
      'platform.user.banned',
      'platform.user.unbanned',
      'platform.user.impersonation_started',
      'platform.user.impersonation_ended',
    ])
  })
})

describe('the prefix table', () => {
  it('equals the nine rows of docs/ACCESS.md §4.2 exactly', () => {
    // §4.4's timeline query filters on (entity_type, entity_id), so it never has to guess which
    // prefix belongs to which table — this mapping is the reason it does not have to.
    expect({ ...PLATFORM_AUDIT_ENTITY_BY_PREFIX }).toEqual(ACCESS_PREFIX_TABLE)
    expect(Object.keys(PLATFORM_AUDIT_ENTITY_BY_PREFIX)).toHaveLength(9)
  })

  it('resolves each action to the entity_type its prefix names', () => {
    expect(entityTypeForAction(PLATFORM_ACTIONS.USER_ROLE_CHANGED)).toBe('user')
    expect(entityTypeForAction(PLATFORM_ACTIONS.SESSION_REVOKED_ALL)).toBe(
      'session',
    )
    expect(entityTypeForAction(PLATFORM_ACTIONS.TOKEN_ISSUED)).toBe(
      'staff_api_token',
    )
    expect(entityTypeForAction(PLATFORM_ACTIONS.SHARE_REVOKED)).toBe(
      'share_link',
    )
    expect(entityTypeForAction(PLATFORM_ACTIONS.PROVIDER_LIMIT_CHANGED)).toBe(
      'provider',
    )
    // A compound verb keeps its underscore on the verb side of the split: the segment count
    // decides which prefix form an action takes, never the underscore.
    expect(entityTypeForAction('place_pack.places_set')).toBe('place_pack')
    expect(entityTypeForAction('catalog_place.licence_escalated')).toBe(
      'catalog_place',
    )
  })
})

/**
 * Checked by `tsc --noEmit` as much as by vitest — the assertions below are the whole point of the
 * block, and they fail at build time rather than at run time.
 */
describe('the writer boundary', () => {
  it('narrows action to the fifteen frozen names rather than to the schema string input', () => {
    // §4.3 makes this writer swallow its own failures, so a mistyped verb cannot be caught at
    // runtime *by this module*: the schema rejects `platform.user.bannd`, the rejection goes to the
    // logger, and the caller — whose ban already committed — returns success with no row behind it.
    // The compiler is the only layer that can fail loudly, which is what makes the frozen constants
    // load-bearing at the call site instead of advisory.
    expectTypeOf<
      PlatformAuditEntryInput['action']
    >().toEqualTypeOf<PlatformActionName>()
    expectTypeOf<'platform.user.bannd'>().not.toExtend<
      PlatformAuditEntryInput['action']
    >()
    expectTypeOf<'platform.user.banned'>().toExtend<
      PlatformAuditEntryInput['action']
    >()
    expectTypeOf<string>().not.toExtend<PlatformAuditEntryInput['action']>()
    // Faza C widens this union to the sixteen catalogue names; today it does not carry them.
    expectTypeOf<'catalog_place.published'>().not.toExtend<
      PlatformAuditEntryInput['action']
    >()
  })

  it('keeps every other field derived from the schema, so the two cannot drift', () => {
    expectTypeOf<PlatformAuditEntryInput['entityId']>().toEqualTypeOf<
      string | null
    >()
    expectTypeOf<PlatformAuditEntryInput['ip']>().toEqualTypeOf<
      string | null | undefined
    >()
    expectTypeOf<PlatformAuditEntryInput['userAgent']>().toEqualTypeOf<
      string | null | undefined
    >()
  })
})

describe('appendPlatformAudit', () => {
  let tables: PlatformTables

  beforeEach(async () => {
    tables = await createPlatformTables()
  })

  afterEach(() => {
    tables.close()
  })

  it('writes the row, deriving entity_type and narrowing the actor role', async () => {
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      // `user.role` is a comma-joined column, so the row records the highest role held rather than
      // the string — §4.1 stores the role as a fact about the event.
      {
        userId: 'usr_operator',
        actorKind: 'human',
        role: 'curator,admin',
        tokenId: null,
      },
      {
        action: PLATFORM_ACTIONS.USER_ROLE_CHANGED,
        entityId,
        changes: { before: { role: 'user' }, after: { role: 'curator' } },
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (console)',
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toBeDefined()
    expect(row.action).toBe('platform.user.role_changed')
    expect(row.entityType).toBe('user')
    expect(row.actorKind).toBe('human')
    expect(row.actorRole).toBe('admin')
    expect(row.tokenId).toBeNull()
    expect(row.changes).toEqual({
      before: { role: 'user' },
      after: { role: 'curator' },
    })
    expect(row.ip).toBe('203.0.113.7')
    expect(row.userAgent).toBe('Mozilla/5.0 (console)')
    expect(records).toHaveLength(0)
  })

  it('writes a system row with no actor, no role and no credential', async () => {
    const { logger } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      { action: PLATFORM_ACTIONS.USER_UNBANNED, entityId },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const row = rows[0]
    expect(row).toBeDefined()
    expect(row.actorKind).toBe('system')
    expect(row.actorUserId).toBeNull()
    expect(row.actorRole).toBeNull()
    expect(row.tokenId).toBeNull()
  })

  it('keeps a User-Agent longer than the tenant log would accept', async () => {
    // §4.1 says this column holds the header verbatim, so the bound has to sit above what real
    // clients send rather than at the tenant log's 200-character form-field cap. A 300-character UA
    // is ordinary traffic and is stored whole.
    const { logger, records } = memoryLogger()
    const entityId = newId()
    const userAgent = `Mozilla/5.0 ${'x'.repeat(288)}`

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      { action: PLATFORM_ACTIONS.USER_BANNED, entityId, userAgent },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    expect(rows[0]?.userAgent).toBe(userAgent)
    expect(records).toHaveLength(0)
  })

  it('bounds an oversized request field in the row itself, and still writes the entry', async () => {
    // Three rules meet on this row. Unbounded, `user_agent` is a header-sized value in a table that
    // keeps it for 400 days. Written as `NULL`, it claims the request sent no header — which is what
    // §4.1 says `NULL` means there, and is a different fact from the one that happened. Shortened
    // without a mark, it is a plausible string nobody sent. So the head is kept, the shortening is
    // stated in the value, and one line records the measurement. Dropping the *entry* instead would
    // be the gap §4.3 says must not exist for a ban.
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_BANNED,
        entityId,
        ip: `203.0.113.7${'0'.repeat(500)}`,
        userAgent: 'A'.repeat(4_096),
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const row = rows[0]
    expect(row).toBeDefined()

    // Not `NULL`: a bounded field and a missing header have to stay tellable apart once the log line
    // has aged out and only the row is left.
    expect(row.ip).not.toBeNull()
    expect(row.userAgent).not.toBeNull()
    expect(row.ip).toHaveLength(64)
    expect(row.userAgent).toHaveLength(512)
    expect(row.ip?.startsWith('203.0.113.7')).toBe(true)
    expect(row.ip?.endsWith('…[truncated from 511 characters]')).toBe(true)
    expect(row.userAgent?.startsWith('AAAA')).toBe(true)
    expect(row.userAgent?.endsWith('…[truncated from 4096 characters]')).toBe(
      true,
    )

    // One line per bounded field, at the severity the action itself would be reported at.
    expect(records.map((record) => record.boundedField)).toEqual([
      'ip',
      'userAgent',
    ])
    expect(records.every((record) => record.level === 'error')).toBe(true)
    expect(records[0]?.measured).toBe(511)
    expect(records[0]?.limit).toBe(64)
    expect(records[1]?.measured).toBe(4_096)
    expect(records[1]?.limit).toBe(512)
    expect(records[0]?.action).toBe('platform.user.banned')
    expect(records[0]?.actorUserId).toBe('usr_operator')
  })

  it('bounds the offending key of `changes` and keeps the rest of the diff', async () => {
    // §4.4 says the before/after diff is why this log exists instead of a revision table. An earlier
    // form of this dropped the whole payload because one value was long, which throws away the
    // evidence in order to avoid storing it. The long value keeps its head and says it was cut; both
    // its neighbours and the other side of the diff are written untouched.
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: {
          before: { name: 'y'.repeat(2_000), email: 'old@example.com' },
          after: { name: 'Ada', email: 'new@example.com' },
        },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const changes = rows[0]?.changes
    const before = changes?.before

    expect(before?.email).toBe('old@example.com')
    expect(changes?.after).toEqual({ name: 'Ada', email: 'new@example.com' })
    expect(before?.name).toHaveLength(512)
    expect(
      String(before?.name).endsWith('…[truncated from 2000 characters]'),
    ).toBe(true)

    expect(records).toHaveLength(1)
    expect(records[0]?.boundedField).toBe('changes')
    expect(records[0]?.boundedKey).toBe('before.name')
    expect(records[0]?.reason).toBe('value-longer-than-bound')
    expect(records[0]?.measured).toBe(2_002)
    expect(records[0]?.level).toBe('warn')
  })

  it('replaces an oversized value that is not a string with a mark, in place', async () => {
    // A nested object has no head worth keeping, so the key stays and the value says what it was.
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: {
          before: null,
          after: { profile: { note: 'x'.repeat(1_000) }, role: 'curator' },
        },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const after = rows[0]?.changes?.after

    expect(after?.role).toBe('curator')
    expect(after?.profile).toBe('[refused: oversized value, 1011 characters]')
    expect(records[0]?.boundedKey).toBe('after.profile')
    expect(records[0]?.reason).toBe('value-longer-than-bound')
  })

  it('keeps a value it cannot serialise as a mark rather than losing the diff', async () => {
    // A cycle or a `BigInt` reaches SQLite as a throw from the driver's own JSON step, which would
    // cost the entry rather than the value.
    const { logger, records } = memoryLogger()
    const entityId = newId()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: {
          before: null,
          after: { self: cyclic, email: 'new@example.com' },
        },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const after = rows[0]?.changes?.after

    expect(after?.email).toBe('new@example.com')
    expect(after?.self).toBe('[refused: unserialisable value]')
    expect(records[0]?.reason).toBe('unserialisable-value')
    expect(records[0]?.boundedKey).toBe('after.self')
  })

  it('drops keys past the per-side key bound, which is the one case a key is lost', async () => {
    // There is nowhere to write a mark for a key that is not in the object, so this is the single
    // case the log line is the only record. A diff with sixty-five fields on one side is a payload.
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: {
          before: null,
          after: Object.fromEntries(
            Array.from({ length: 65 }, (_value, index) => [
              `field${index}`,
              index,
            ]),
          ),
        },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const after = rows[0]?.changes?.after

    expect(Object.keys(after ?? {})).toHaveLength(32)
    expect(after?.field0).toBe(0)
    expect(after?.field64).toBeUndefined()
    expect(records).toHaveLength(1)
    expect(records[0]?.reason).toBe('too-many-keys')
    expect(records[0]?.boundedKey).toBe('after')
    expect(records[0]?.measured).toBe(65)
    expect(records[0]?.limit).toBe(32)
  })

  it('drops a key whose own name is past the bound', async () => {
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: {
          before: null,
          after: { ['k'.repeat(65)]: 1, email: 'new@example.com' },
        },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))

    expect(rows[0]?.changes?.after).toEqual({ email: 'new@example.com' })
    expect(records[0]?.reason).toBe('key-name-longer-than-bound')
    expect(records[0]?.measured).toBe(65)
  })

  it('bounds the whole payload largest-first when every value is individually legal', async () => {
    // Thirty small values are as large as one big one, so the per-value bound is not the last word.
    // What the payload bound must not do is disappear: every value it replaces leaves its key behind
    // carrying a mark, and the run reports how many it had to touch.
    const { logger, records } = memoryLogger()
    const entityId = newId()
    const side = (fill: string): Record<string, unknown> =>
      Object.fromEntries(
        Array.from({ length: 32 }, (_value, index) => [
          `field${index}`,
          fill.repeat(500),
        ]),
      )

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_UPDATED,
        entityId,
        changes: { before: side('a'), after: side('b') },
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const changes = rows[0]?.changes

    expect(JSON.stringify(changes).length).toBeLessThanOrEqual(16_384)
    expect(Object.keys(changes?.before ?? {})).toHaveLength(32)
    expect(Object.keys(changes?.after ?? {})).toHaveLength(32)

    const marked = Object.values(changes?.before ?? {}).filter(
      (value) =>
        typeof value === 'string' &&
        value.startsWith('[refused: payload bound'),
    )
    expect(marked.length).toBeGreaterThan(0)

    const line = records.find(
      (record) => record.reason === 'payload-longer-than-bound',
    )
    expect(line?.boundedField).toBe('changes')
    expect(Number(line?.replaced)).toBeGreaterThan(0)
  })

  it('writes a `changes` payload inside the bounds untouched', async () => {
    const { logger, records } = memoryLogger()
    const entityId = newId()
    const changes = {
      before: { email: 'old@example.com' },
      after: { email: 'new@example.com' },
    }

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      { action: PLATFORM_ACTIONS.USER_EMAIL_SET, entityId, changes },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    expect(rows[0]?.changes).toEqual(changes)
    expect(records).toHaveLength(0)
  })

  it('records a header that trims to nothing as NULL rather than refusing the entry', async () => {
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      {
        action: PLATFORM_ACTIONS.USER_BANNED,
        entityId,
        ip: '   ',
        userAgent: '',
      },
      logger,
    )

    const rows = await tables.db
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.entityId, entityId))
    const row = rows[0]
    expect(row).toBeDefined()
    expect(row.ip).toBeNull()
    expect(row.userAgent).toBeNull()
    expect(records).toHaveLength(0)
  })

  it('returns normally when the append is rejected, and never rethrows', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(tables.db, 'insert')
    tables.sqlite.exec('drop table platform_audit_log')

    await expect(
      appendPlatformAudit(
        tables.db,
        OPERATOR,
        { action: PLATFORM_ACTIONS.USER_UPDATED, entityId: 'usr_target' },
        logger,
      ),
    ).resolves.toBeUndefined()

    // One attempt for an ordinary verb, reported at `warn` — never a 500 handed to the caller and
    // never a rollback of work that already committed.
    expect(insert).toHaveBeenCalledTimes(1)
    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('warn')
    expect(records[0]?.action).toBe('platform.user.updated')
  })

  it('returns normally when the log sink itself throws', async () => {
    // The failure path is the last place that may raise: a `Logger` writes through a sink, and a
    // sink that throws is the ordinary way a logging backend fails. Unguarded, reporting a failed
    // append would hand the caller the very error the append exists not to hand them.
    const { logger, calls } = throwingLogger()
    tables.sqlite.exec('drop table platform_audit_log')

    await expect(
      appendPlatformAudit(
        tables.db,
        OPERATOR,
        { action: PLATFORM_ACTIONS.USER_UPDATED, entityId: 'usr_target' },
        logger,
      ),
    ).resolves.toBeUndefined()

    // Both severities go through the same guard, so a ban's `error` line is covered too.
    await expect(
      appendPlatformAudit(
        tables.db,
        OPERATOR,
        { action: PLATFORM_ACTIONS.USER_BANNED, entityId: 'usr_target' },
        logger,
      ),
    ).resolves.toBeUndefined()

    // And so is the rejection path, which reports before any insert is attempted.
    await expect(
      appendPlatformAudit(
        tables.db,
        {
          userId: 'usr_operator',
          actorKind: 'human',
          role: 'admin',
          tokenId: 'tok_1',
        },
        { action: PLATFORM_ACTIONS.USER_BANNED, entityId: 'usr_target' },
        logger,
      ),
    ).resolves.toBeUndefined()

    expect(calls).toEqual(['warn', 'error', 'error'])
  })

  it('retries a ban exactly once and then raises at the highest severity the logger has', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(tables.db, 'insert')
    tables.sqlite.exec('drop table platform_audit_log')

    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      { action: PLATFORM_ACTIONS.USER_BANNED, entityId: 'usr_target' },
      logger,
    )

    expect(insert).toHaveBeenCalledTimes(2)
    expect(records).toHaveLength(1)
    const record = records[0]
    expect(record).toBeDefined()
    // `LogLevel` has no `fatal`; `error` is the top of the scale.
    expect(record.level).toBe('error')
    expect(record.action).toBe('platform.user.banned')
    expect(record.actorUserId).toBe('usr_operator')
    expect(record.actorKind).toBe('human')
    expect(record.attempts).toBe(2)
  })

  it('retries each of the four always-audited verbs and no others', async () => {
    const { logger } = memoryLogger()
    const insert = vi.spyOn(tables.db, 'insert')
    tables.sqlite.exec('drop table platform_audit_log')

    for (const action of ALWAYS_AUDITED_ACTIONS) {
      insert.mockClear()
      await appendPlatformAudit(
        tables.db,
        OPERATOR,
        { action, entityId: 'usr_target' },
        logger,
      )
      expect(insert, action).toHaveBeenCalledTimes(2)
    }

    insert.mockClear()
    await appendPlatformAudit(
      tables.db,
      OPERATOR,
      { action: PLATFORM_ACTIONS.SESSION_REVOKED, entityId: 'ses_1' },
      logger,
    )
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('refuses an attribution the audit table would reject, without attempting an insert', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(tables.db, 'insert')

    // A human wearing a credential breaks `platform_audit_log_token_agent_only_chk`. The boundary
    // refuses it here so the row never reaches SQLite, and the caller still returns normally.
    await appendPlatformAudit(
      tables.db,
      {
        userId: 'usr_operator',
        actorKind: 'human',
        role: 'admin',
        tokenId: 'tok_1',
      },
      { action: PLATFORM_ACTIONS.USER_BANNED, entityId: 'usr_target' },
      logger,
    )

    expect(insert).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('error')
    expect(records[0]?.attempts).toBe(0)
  })
})

describe('prunePlatformAuditLog', () => {
  let tables: PlatformTables

  beforeEach(async () => {
    tables = await createPlatformTables()
  })

  afterEach(() => {
    tables.close()
  })

  const DAY_MS = 24 * 60 * 60 * 1000
  const NOW = new Date('2026-08-23T04:17:00.000Z')

  async function seedRow(ageInDays: number, entityId: string): Promise<void> {
    await tables.db.insert(platformAuditLog).values({
      actorUserId: null,
      actorKind: 'system',
      actorRole: null,
      tokenId: null,
      action: 'platform.user.unbanned',
      entityType: 'user',
      entityId,
      createdAt: new Date(NOW.getTime() - ageInDays * DAY_MS),
    })
  }

  it('deletes by created_at alone at a 400-day window', async () => {
    expect(PLATFORM_AUDIT_RETENTION_DAYS).toBe(400)
    await seedRow(401, 'older')
    await seedRow(399, 'newer')

    const { logger } = memoryLogger()
    const result = await prunePlatformAuditLog(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: NOW,
      },
    )

    expect(result.deleted).toBe(1)
    expect(result.drained).toBe(true)
    const survivors = await tables.db.select().from(platformAuditLog)
    expect(survivors.map((row) => row.entityId)).toEqual(['newer'])
  })

  it('emits one structured line with the row count and audits nothing about itself', async () => {
    await seedRow(500, 'ancient')
    const { logger, records } = memoryLogger()

    await prunePlatformAuditLog(tables.db, PLATFORM_SYSTEM_ACTOR, logger, {
      now: NOW,
    })

    expect(records).toHaveLength(1)
    const record = records[0]
    expect(record).toBeDefined()
    expect(record.level).toBe('info')
    expect(record.deleted).toBe(1)
    expect(record.batches).toBe(1)
    expect(record.drained).toBe(true)
    expect(record.retentionDays).toBe(400)
    expect(record.actorKind).toBe('system')
    expect(record.actorUserId).toBeNull()

    // The prune does not append a row about the prune — §4.3: how many rows it removed is a log
    // line, not a row in the table it just pruned.
    const remaining = await tables.db.select().from(platformAuditLog)
    expect(remaining).toHaveLength(0)
  })

  it('logs a zero count rather than staying silent when nothing is old enough', async () => {
    await seedRow(10, 'fresh')
    const { logger, records } = memoryLogger()

    const result = await prunePlatformAuditLog(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: NOW,
      },
    )
    expect(result.deleted).toBe(0)
    expect(records).toHaveLength(1)
    expect(records[0]?.deleted).toBe(0)
  })

  it('deletes in bounded batches rather than in one unbounded statement', async () => {
    // A backlog must size the schedule, never the statement: an unbounded `DELETE … RETURNING id`
    // materialises every removed id into the isolate purely to obtain a count.
    for (let index = 0; index < 5; index += 1) {
      await seedRow(500, `old-${index}`)
    }
    const { logger, records } = memoryLogger()

    const result = await prunePlatformAuditLog(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: NOW,
        batchSize: 2,
      },
    )

    expect(result).toEqual({ deleted: 5, batches: 3, drained: true })
    expect(records[0]?.batchSize).toBe(2)
    expect(await tables.db.select().from(platformAuditLog)).toHaveLength(0)
  })

  it('stops at the batch cap with the backlog still due, and says so', async () => {
    for (let index = 0; index < 5; index += 1) {
      await seedRow(500, `old-${index}`)
    }
    const { logger, records } = memoryLogger()

    const result = await prunePlatformAuditLog(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: NOW,
        batchSize: 2,
        maxBatches: 2,
      },
    )

    expect(result).toEqual({ deleted: 4, batches: 2, drained: false })
    // docs/ARCHITECTURE.md §9 names `drained: false` as a number worth alerting on: it means the
    // ceiling has stopped being a safety margin and the table is now growing past its window. A
    // field inside a routine weekly `info` line is not an alertable signal, so the whole line moves
    // to the top of the severity scale.
    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('error')
    expect(records[0]?.drained).toBe(false)
    expect(records[0]?.deleted).toBe(4)
    // The remainder is not lost, only deferred: next week's tick carries on from here.
    expect(await tables.db.select().from(platformAuditLog)).toHaveLength(1)
  })

  it('bounds each statement the way the sibling cron in the same switch is bounded', () => {
    // The statement bound is what stops one tick becoming an isolate-killing query, and it matches
    // `sweepReminders`. The run bound is a *rate*: 250 × 200 clears 50 000 rows a week, a sustained
    // 7 100 audit rows a day, where the earlier 10 000 a week could be exceeded by one bulk import.
    expect(PLATFORM_AUDIT_PRUNE_BATCH_SIZE).toBe(200)
    expect(PLATFORM_AUDIT_PRUNE_MAX_BATCHES).toBe(250)
  })

  it('refuses an actor that is not the platform itself, and deletes nothing', async () => {
    // docs/ACCESS.md §4.3: the only delete path an append-only table has runs as an `actor_kind`
    // `system` actor. Validating the *shape* of an actor accepts any well-formed human on it, which
    // is what this rejects. The compiler refuses the same call — the cast is what a caller outside
    // TypeScript, or a Faza E console surface built on a widened variable, would do by accident.
    await seedRow(500, 'ancient')
    const { logger, records } = memoryLogger()

    const human: PlatformActor = {
      userId: 'usr_operator',
      actorKind: 'human',
      role: 'admin',
      tokenId: null,
    }

    await expect(
      prunePlatformAuditLog(tables.db, human as PlatformSystemActor, logger, {
        now: NOW,
      }),
    ).rejects.toThrow()

    expect(await tables.db.select().from(platformAuditLog)).toHaveLength(1)
    expect(records).toHaveLength(0)
  })

  it('refuses a malformed system actor rather than acting as one', async () => {
    // SPEC §5: always an explicit platform actor. A `system` actor carrying a user id is not one of
    // the three shapes §4.1's CHECK constraints accept, and the prune is not the place to discover
    // that a caller invented a fourth.
    await seedRow(500, 'ancient')
    const { logger } = memoryLogger()

    await expect(
      prunePlatformAuditLog(
        tables.db,
        {
          userId: 'usr_operator',
          actorKind: 'system',
          role: null,
          tokenId: null,
        },
        logger,
        { now: NOW },
      ),
    ).rejects.toThrow()

    expect(await tables.db.select().from(platformAuditLog)).toHaveLength(1)
  })

  it('does not propagate a throwing log sink', async () => {
    await seedRow(500, 'ancient')
    const { logger, calls } = throwingLogger()

    const result = await prunePlatformAuditLog(
      tables.db,
      PLATFORM_SYSTEM_ACTOR,
      logger,
      {
        now: NOW,
      },
    )

    expect(result.deleted).toBe(1)
    expect(calls).toEqual(['info'])
  })
})

describe('readPlatformAuditByEntity', () => {
  let tables: PlatformTables

  beforeEach(async () => {
    tables = await createPlatformTables()
  })

  afterEach(() => {
    tables.close()
  })

  const AT = new Date('2026-08-23T04:17:00.000Z')

  async function seed(
    entityId: string,
    offsetMs: number,
    overrides: Partial<{
      id: string
      action: PlatformActionName
      entityType: 'user' | 'session'
    }> = {},
  ): Promise<void> {
    await tables.db.insert(platformAuditLog).values({
      ...(overrides.id === undefined ? {} : { id: overrides.id }),
      actorUserId: 'usr_operator',
      actorKind: 'human',
      actorRole: 'admin',
      tokenId: null,
      action: overrides.action ?? 'platform.user.role_changed',
      entityType: overrides.entityType ?? 'user',
      entityId,
      changes: { before: { role: 'user' }, after: { role: 'curator' } },
      createdAt: new Date(AT.getTime() + offsetMs),
    })
  }

  it('returns one entity timeline newest first and nobody else', async () => {
    await seed('usr_subject', 0)
    await seed('usr_subject', 2_000)
    await seed('usr_bystander', 1_000)

    const rows = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 10,
    })

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.createdAt.toISOString())).toEqual([
      new Date(AT.getTime() + 2_000).toISOString(),
      AT.toISOString(),
    ])
  })

  it('filters on entity_type as well as entity_id', async () => {
    await seed('shared_id', 0)
    await seed('shared_id', 1_000, {
      action: 'platform.session.revoked',
      entityType: 'session',
    })

    const rows = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'shared_id',
      limit: 10,
    })

    expect(rows.map((row) => row.entityType)).toEqual(['user'])
  })

  it('breaks a shared millisecond on id, so two rows from one call keep their order', async () => {
    // `created_at` is a millisecond stamp and the two halves of a password reset share it. Without
    // the tiebreak the panel reorders itself between renders of the same page.
    await seed('usr_subject', 0, { id: 'aud_aaa' })
    await seed('usr_subject', 0, { id: 'aud_zzz' })

    const first = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 10,
    })
    const second = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 10,
    })

    expect(first.map((row) => row.id)).toEqual(['aud_zzz', 'aud_aaa'])
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id))
  })

  it('honours the limit, which is how a caller learns there are more', async () => {
    await seed('usr_subject', 0)
    await seed('usr_subject', 1_000)
    await seed('usr_subject', 2_000)

    const rows = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 2,
    })

    expect(rows).toHaveLength(2)
  })

  it('hands back the changes payload verbatim, undiffed', async () => {
    await seed('usr_subject', 0)

    const [row] = await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 1,
    })

    expect(row.changes).toEqual({
      before: { role: 'user' },
      after: { role: 'curator' },
    })
  })

  it('refuses an unbounded read rather than materialising the whole table', async () => {
    await expect(
      readPlatformAuditByEntity(tables.db, {
        entityType: 'user',
        entityId: 'usr_subject',
        limit: PLATFORM_AUDIT_READ_MAX + 1,
      }),
    ).rejects.toThrow()

    await expect(
      readPlatformAuditByEntity(tables.db, {
        entityType: 'user',
        entityId: '   ',
        limit: 10,
      }),
    ).rejects.toThrow()
  })

  it('writes nothing: reading the ledger is not one of the thirty-one mutations', async () => {
    await seed('usr_subject', 0)

    await readPlatformAuditByEntity(tables.db, {
      entityType: 'user',
      entityId: 'usr_subject',
      limit: 10,
    })

    expect(await tables.db.select().from(platformAuditLog)).toHaveLength(1)
  })
})
