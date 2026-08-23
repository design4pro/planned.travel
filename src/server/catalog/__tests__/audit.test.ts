/**
 * The single writer of `platform_audit_log`, and the four things that make it trustworthy.
 *
 * 1. **The vocabulary is the document's.** docs/ACCESS.md §4.2 closes the action list and pairs each
 *    prefix with an `entity_type`. Both are asserted against the names spelled out below rather than
 *    against the schema's own array, so a change made in one place and not the other is a failure
 *    here and not a silent agreement between two copies of the same mistake.
 * 2. **The global-table path never reaches through the tenant layer.** SPEC §5 forbids it by name,
 *    and the guard is a grep over the whole directory — a standing check that must still pass in
 *    Faza C when `repo.ts` arrives beside this file, not a Faza B formality.
 * 3. **An append never fails a caller.** §4.3: the mutation has already committed by the time the
 *    row is written, so a rejected append is a logging incident and never a `500`.
 * 4. **The four ban and impersonation verbs are audited without exception.** They are retried once
 *    and then raised at the highest severity the logger has, and the line names the action and the
 *    actor so the gap in the ledger is identifiable afterwards.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { newId, platformAuditLog } from '#/server/db/schema'
import { createLogger, createMemorySink } from '#/server/observability'
import { AUDIT_ACTION_PATTERN } from '#/server/repos/audit'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  ALWAYS_AUDITED_ACTIONS,
  PLATFORM_ACTIONS,
  PLATFORM_AUDIT_ENTITY_BY_PREFIX,
  PLATFORM_AUDIT_RETENTION_DAYS,
  PLATFORM_SYSTEM_ACTOR,
  appendPlatformAudit,
  entityTypeForAction,
  prunePlatformAuditLog,
} from '../audit'
import type { Harness } from '#/server/repos/__tests__/harness'
import type { PlatformActionName, PlatformAuditEntryInput } from '../audit'
import type { PlatformActor } from '#/server/auth/guard'
import type { LogRecord, LogSink } from '#/server/observability'

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
] as const

/** docs/ACCESS.md §4.2's prefix table, all eight rows, transcribed from the document. */
const ACCESS_PREFIX_TABLE: Record<string, string> = {
  catalog_place: 'catalog_place',
  catalog_ingest: 'catalog_ingest',
  place_pack: 'place_pack',
  catalog_source: 'catalog_source',
  'platform.user': 'user',
  'platform.session': 'session',
  'platform.token': 'staff_api_token',
  'platform.share': 'share_link',
}

const OPERATOR: PlatformActor = {
  userId: 'usr_operator',
  actorKind: 'human',
  role: 'admin',
  tokenId: null,
}

function memoryLogger(): { logger: ReturnType<typeof createLogger>; records: Array<LogRecord> } {
  const sink: LogSink & { records: Array<LogRecord> } = createMemorySink()
  return { logger: createLogger({ level: 'debug', sink }), records: sink.records }
}

describe('the platform action vocabulary', () => {
  it('exports exactly the fifteen platform.* names docs/ACCESS.md §4.2 declares', () => {
    // Both halves of §4.2's union test, at the level this phase can close them. A name in code and
    // not in the table fails the first expectation; a name in the table that this module does not
    // export fails the second. The document's stronger form — "a name in this table that nothing
    // *writes* fails it" — is scoped here to export parity on purpose: `platform.share.revoked` has
    // no writer until Faza F owns the moderation screen, and `platform.token.*` none until Faza E,
    // yet the §1.1 dictionary is closed in this phase and cannot grow later without amending
    // docs/ACCESS.md. Widen this to call-site parity when the last of those writers lands.
    const exported = Object.values(PLATFORM_ACTIONS)
    expect([...exported].sort()).toEqual([...ACCESS_PLATFORM_ACTIONS].sort())
    expect(exported).toHaveLength(15)
  })

  it('exports platform.share.revoked now, ahead of the Faza F writer', () => {
    expect(PLATFORM_ACTIONS.SHARE_REVOKED).toBe('platform.share.revoked')
  })

  it('matches every constant against the imported dotted-action regex', () => {
    // The regex is `src/server/repos/audit.ts`'s, imported rather than re-declared, so the tenant
    // log and the platform log cannot drift into two spellings of one character class (§4.2).
    for (const action of Object.values(PLATFORM_ACTIONS)) {
      expect(action).toMatch(AUDIT_ACTION_PATTERN)
      expect(action.length).toBeLessThanOrEqual(64)
    }
  })

  it('spells the dotted-action character class exactly once in the whole repository', () => {
    // §4.2's rule as a standing check rather than a one-off grep at review time. "Imported, never
    // re-declared" is a claim about every file, and it is as false when the second spelling sits in
    // a *test* — a test that re-types the class asserts against its own copy and can pass while the
    // declaration it is supposed to be guarding says something else. The needle is assembled from
    // fragments so this file is not itself an occurrence of the thing it counts.
    const characterClass = `[a-${'z0-9'}]`
    const needle = `${characterClass}+(?:[._]${characterClass}+)*`

    const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => `${entry.parentPath}/${entry.name}`)

    expect(files.length).toBeGreaterThan(100)
    const occurrences = files
      .map((file) => ({ file, count: readFileSync(file, 'utf8').split(needle).length - 1 }))
      .filter((entry) => entry.count > 0)

    expect(occurrences).toEqual([{ file: `${sourceRoot}server/repos/audit.ts`, count: 1 }])
  })

  it('begins every constant with a prefix listed in the §4.2 prefix table', () => {
    const prefixes = Object.keys(PLATFORM_AUDIT_ENTITY_BY_PREFIX)
    for (const action of Object.values(PLATFORM_ACTIONS)) {
      expect(prefixes.some((prefix) => action.startsWith(`${prefix}.`))).toBe(true)
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
  it('equals the eight rows of docs/ACCESS.md §4.2 exactly', () => {
    // §4.4's timeline query filters on (entity_type, entity_id), so it never has to guess which
    // prefix belongs to which table — this mapping is the reason it does not have to.
    expect({ ...PLATFORM_AUDIT_ENTITY_BY_PREFIX }).toEqual(ACCESS_PREFIX_TABLE)
    expect(Object.keys(PLATFORM_AUDIT_ENTITY_BY_PREFIX)).toHaveLength(8)
  })

  it('resolves each action to the entity_type its prefix names', () => {
    expect(entityTypeForAction(PLATFORM_ACTIONS.USER_ROLE_CHANGED)).toBe('user')
    expect(entityTypeForAction(PLATFORM_ACTIONS.SESSION_REVOKED_ALL)).toBe('session')
    expect(entityTypeForAction(PLATFORM_ACTIONS.TOKEN_ISSUED)).toBe('staff_api_token')
    expect(entityTypeForAction(PLATFORM_ACTIONS.SHARE_REVOKED)).toBe('share_link')
    // A compound verb keeps its underscore on the verb side of the split: the segment count
    // decides which prefix form an action takes, never the underscore.
    expect(entityTypeForAction('place_pack.places_set')).toBe('place_pack')
    expect(entityTypeForAction('catalog_place.licence_escalated')).toBe('catalog_place')
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
    expectTypeOf<PlatformAuditEntryInput['action']>().toEqualTypeOf<PlatformActionName>()
    expectTypeOf<'platform.user.bannd'>().not.toExtend<PlatformAuditEntryInput['action']>()
    expectTypeOf<'platform.user.banned'>().toExtend<PlatformAuditEntryInput['action']>()
    expectTypeOf<string>().not.toExtend<PlatformAuditEntryInput['action']>()
    // Faza C widens this union to the sixteen catalogue names; today it does not carry them.
    expectTypeOf<'catalog_place.published'>().not.toExtend<PlatformAuditEntryInput['action']>()
  })

  it('keeps every other field derived from the schema, so the two cannot drift', () => {
    expectTypeOf<PlatformAuditEntryInput['entityId']>().toEqualTypeOf<string | null>()
    expectTypeOf<PlatformAuditEntryInput['ip']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<PlatformAuditEntryInput['userAgent']>().toEqualTypeOf<string | null | undefined>()
  })
})

describe('the global-table path', () => {
  it('never reaches through the tenant repository layer', () => {
    // SPEC §5: these tables must never be reached through `base.ts` or the tenant repository
    // factory, and `src/server/repos/index.ts` is an `export *` barrel over `base.ts`, so a single
    // import from that specifier pulls the tenant layer into the global-table path. Both needles
    // are assembled rather than written out because this file lives inside the directory the
    // acceptance grep scans, and a test asserting a string's absence must not be the line that
    // supplies it.
    const tenantFactory = ['create', 'Tenant', 'Repository'].join('')
    const reposBarrel = `from '#/server/${'repos'}'`

    const directory = fileURLToPath(new URL('../', import.meta.url))
    const files = readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => `${entry.parentPath}/${entry.name}`)

    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} imports the tenant repository factory`).not.toContain(tenantFactory)
      expect(source, `${file} imports the tenant repository barrel`).not.toContain(reposBarrel)
    }
  })
})

describe('appendPlatformAudit', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await createHarness()
  })

  afterEach(() => {
    harness.close()
  })

  it('writes the row, deriving entity_type and narrowing the actor role', async () => {
    const { logger, records } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      harness.db,
      // `user.role` is a comma-joined column, so the row records the highest role held rather than
      // the string — §4.1 stores the role as a fact about the event.
      { userId: 'usr_operator', actorKind: 'human', role: 'curator,admin', tokenId: null },
      {
        action: PLATFORM_ACTIONS.USER_ROLE_CHANGED,
        entityId,
        changes: { before: { role: 'user' }, after: { role: 'curator' } },
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (console)',
      },
      logger,
    )

    const rows = await harness.db
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
    expect(row.changes).toEqual({ before: { role: 'user' }, after: { role: 'curator' } })
    expect(row.ip).toBe('203.0.113.7')
    expect(row.userAgent).toBe('Mozilla/5.0 (console)')
    expect(records).toHaveLength(0)
  })

  it('writes a system row with no actor, no role and no credential', async () => {
    const { logger } = memoryLogger()
    const entityId = newId()

    await appendPlatformAudit(
      harness.db,
      PLATFORM_SYSTEM_ACTOR,
      { action: PLATFORM_ACTIONS.USER_UNBANNED, entityId },
      logger,
    )

    const rows = await harness.db
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

  it('returns normally when the append is rejected, and never rethrows', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(harness.db, 'insert')
    harness.sqlite.exec('drop table platform_audit_log')

    await expect(
      appendPlatformAudit(
        harness.db,
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

  it('retries a ban exactly once and then raises at the highest severity the logger has', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(harness.db, 'insert')
    harness.sqlite.exec('drop table platform_audit_log')

    await appendPlatformAudit(
      harness.db,
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
    const insert = vi.spyOn(harness.db, 'insert')
    harness.sqlite.exec('drop table platform_audit_log')

    for (const action of ALWAYS_AUDITED_ACTIONS) {
      insert.mockClear()
      await appendPlatformAudit(harness.db, OPERATOR, { action, entityId: 'usr_target' }, logger)
      expect(insert, action).toHaveBeenCalledTimes(2)
    }

    insert.mockClear()
    await appendPlatformAudit(
      harness.db,
      OPERATOR,
      { action: PLATFORM_ACTIONS.SESSION_REVOKED, entityId: 'ses_1' },
      logger,
    )
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('refuses an attribution the audit table would reject, without attempting an insert', async () => {
    const { logger, records } = memoryLogger()
    const insert = vi.spyOn(harness.db, 'insert')

    // A human wearing a credential breaks `platform_audit_log_token_agent_only_chk`. The boundary
    // refuses it here so the row never reaches SQLite, and the caller still returns normally.
    await appendPlatformAudit(
      harness.db,
      { userId: 'usr_operator', actorKind: 'human', role: 'admin', tokenId: 'tok_1' },
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
  let harness: Harness

  beforeEach(async () => {
    harness = await createHarness()
  })

  afterEach(() => {
    harness.close()
  })

  const DAY_MS = 24 * 60 * 60 * 1000
  const NOW = new Date('2026-08-23T04:17:00.000Z')

  async function seedRow(ageInDays: number, entityId: string): Promise<void> {
    await harness.db.insert(platformAuditLog).values({
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
    const deleted = await prunePlatformAuditLog(harness.db, logger, { now: NOW })

    expect(deleted).toBe(1)
    const survivors = await harness.db.select().from(platformAuditLog)
    expect(survivors.map((row) => row.entityId)).toEqual(['newer'])
  })

  it('emits one structured line with the row count and audits nothing about itself', async () => {
    await seedRow(500, 'ancient')
    const { logger, records } = memoryLogger()

    await prunePlatformAuditLog(harness.db, logger, { now: NOW })

    expect(records).toHaveLength(1)
    const record = records[0]
    expect(record).toBeDefined()
    expect(record.level).toBe('info')
    expect(record.deleted).toBe(1)
    expect(record.retentionDays).toBe(400)
    expect(record.actorKind).toBe('system')

    // The prune does not append a row about the prune — §4.3: how many rows it removed is a log
    // line, not a row in the table it just pruned.
    const remaining = await harness.db.select().from(platformAuditLog)
    expect(remaining).toHaveLength(0)
  })

  it('logs a zero count rather than staying silent when nothing is old enough', async () => {
    await seedRow(10, 'fresh')
    const { logger, records } = memoryLogger()

    expect(await prunePlatformAuditLog(harness.db, logger, { now: NOW })).toBe(0)
    expect(records).toHaveLength(1)
    expect(records[0]?.deleted).toBe(0)
  })
})
