/** Global state only. The workspace-deletion driver is the sole production state writer. */
import { and, asc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  newId,
  workspaceDeletions as ledger,
  WORKSPACE_DELETION_STATES,
  WORKSPACE_DELETION_REFUSALS,
  platformAuditLog,
} from '#/server/db/schema'
import type { Database } from '#/server/db/types'

const snapshotSchema = z.strictObject({
  plan: z.enum(['free', 'solo', 'crew']).optional(),
  subscriptionStatus: z
    .enum([
      'trialing',
      'active',
      'past_due',
      'paused',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
    ])
    .optional(),
  trips: z.number().int().nonnegative().optional(),
  fileRows: z.number().int().nonnegative().optional(),
  r2ObjectsDeleted: z.number().int().nonnegative().optional(),
})
const requestSchema = z.discriminatedUnion('initiator', [
  z.strictObject({
    organizationId: z.string().min(1),
    initiator: z.literal('owner'),
    requestedBy: z.string().min(1),
    receiptTo: z.email().max(320).optional(),
    receiptName: z.string().max(60).optional(),
    snapshot: snapshotSchema.optional(),
  }),
  z.strictObject({
    organizationId: z.string().min(1),
    initiator: z.literal('erasure'),
    erasureId: z.string().min(1),
    snapshot: snapshotSchema.optional(),
  }),
])
const nonRefused = sql`${ledger.state} <> 'refused'`

/** Also used inside atomic membership and invitation writes; no read/write gap. */
export function workspaceDeletionAbsent(organizationId: string) {
  return sql`not exists (select 1 from ${ledger} where ${ledger.organizationId} = ${organizationId} and ${nonRefused})`
}
/** Internal driver authority; never part of a request or queue payload. */
export interface WorkspaceDeletionAuthority {
  readonly id: string
  readonly organizationId: string
  readonly token: string
  readonly requestedBy: string | null
  readonly initiator: 'owner' | 'erasure'
  readonly now: number
}

/** Named sibling of the admission fence: no projection or general tenant/global join. */
export function workspaceDeletionAuthorityPresent(
  organizationId: string,
  departingUserId: string | undefined,
  authority: WorkspaceDeletionAuthority | undefined,
  operation: 'drain' | 'delete',
) {
  if (
    !authority ||
    authority.organizationId !== organizationId ||
    (authority.initiator === 'owner'
      ? authority.requestedBy === null ||
        authority.requestedBy !== departingUserId
      : authority.requestedBy !== null || departingUserId !== undefined)
  )
    return sql`0`
  const state = operation === 'drain' ? 'requested' : 'drained'
  // SQLite evaluates its clock when this statement executes, including after awaited room closure.
  // NULL clock/expiry and equality deny; a future trusted clock may only deny earlier.
  return sql`exists (select 1 from ${ledger} where ${ledger.id} = ${authority.id}
    and ${ledger.organizationId} = ${organizationId}
    and ${ledger.leaseToken} = ${authority.token}
    and ${ledger.requestedBy} is ${authority.requestedBy}
    and ${ledger.initiator} = ${authority.initiator}
    and ${ledger.state} = ${state} and ${ledger.refusalReason} is null
    and ${ledger.leaseUntil} > max(${authority.now}, cast(unixepoch('subsec') * 1000 as integer)))`
}

/** Diagnostic only; destructive safety belongs to the predicate inside each DELETE. */
export async function workspaceDeletionAuthorityCurrent(
  db: Database,
  organizationId: string,
  departingUserId: string | undefined,
  authority: WorkspaceDeletionAuthority | undefined,
  operation: 'drain' | 'delete',
) {
  if (!authority) return false
  const rows = await db
    .select({ id: ledger.id })
    .from(ledger)
    .where(
      and(
        eq(ledger.id, authority.id),
        workspaceDeletionAuthorityPresent(
          organizationId,
          departingUserId,
          authority,
          operation,
        ),
      ),
    )
    .limit(1)
  return rows.length !== 0
}

export async function workspaceDeletionPending(
  db: Database,
  organizationId: string,
) {
  const rows = await db
    .select({ id: ledger.id })
    .from(ledger)
    .where(and(eq(ledger.organizationId, organizationId), nonRefused))
    .limit(1)
  return rows.length !== 0
}
export async function assertWorkspaceNotDeleting(
  db: Database,
  organizationId: string,
) {
  if (await workspaceDeletionPending(db, organizationId))
    throw new Error('WORKSPACE_DELETION_PENDING')
}
export async function insertWorkspaceDeletion(
  db: Database,
  input: unknown,
  now = new Date(),
) {
  const parsed = requestSchema.parse(input)
  await db
    .insert(ledger)
    .values({
      ...parsed,
      snapshot: parsed.snapshot ?? {},
      requestedAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
  const rows = await db
    .select()
    .from(ledger)
    .where(and(eq(ledger.organizationId, parsed.organizationId), nonRefused))
    .limit(1)
  const row = rows[0]
  if (!row) throw new Error('Workspace deletion insertion lost its live row')
  return row
}
const unfinished = sql`${ledger.state} not in ('done', 'refused')`
/** A scope can be minted only from the row actually owned by this unexpired lease. */
export async function readLeasedWorkspaceDeletion(
  db: Database,
  id: string,
  token: string,
  now = new Date(),
) {
  const rows = await db
    .select()
    .from(ledger)
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.leaseToken, token),
        unfinished,
        sql`${ledger.leaseUntil} > ${now.getTime()}`,
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/** Terminal and missing ids are no-ops; a held lease must remain retryable to queue callers. */
export async function leaseWorkspaceDeletion(
  db: Database,
  id: string,
  now = new Date(),
) {
  const token = await acquireDeletionLease(db, id, now)
  if (token !== null) {
    const row = await readLeasedWorkspaceDeletion(db, id, token, now)
    return row === null ? ('busy' as const) : { row, token }
  }
  const rows = await db
    .select({ id: ledger.id })
    .from(ledger)
    .where(and(eq(ledger.id, id), unfinished))
    .limit(1)
  return rows.length ? ('busy' as const) : null
}

/** Erasure handshakes expose state only, never workspace or receipt content. */
export async function readWorkspaceDeletionErasureState(
  db: Database,
  id: string,
  erasureId: string,
) {
  const rows = await db
    .select({ state: ledger.state })
    .from(ledger)
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.initiator, 'erasure'),
        eq(ledger.erasureId, erasureId),
      ),
    )
    .limit(1)
  return rows[0]?.state ?? null
}

/** One erasure delivery owns verification; the same envelope may recover after a crash. */
export async function consumeWorkspaceDeletionErasure(
  db: Database,
  id: string,
  erasureId: string,
  envelopeId: string,
) {
  z.string().min(1).max(512).parse(envelopeId)
  const rows = await db
    .update(ledger)
    .set({ erasureConsumer: envelopeId })
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.initiator, 'erasure'),
        eq(ledger.erasureId, erasureId),
        sql`${ledger.state} in ('rows_deleted', 'audited', 'swept', 'done', 'refused')`,
        or(
          isNull(ledger.erasureConsumer),
          eq(ledger.erasureConsumer, envelopeId),
        ),
      ),
    )
    .returning({ id: ledger.id })
  return rows.length !== 0
}

export async function acquireDeletionLease(
  db: Database,
  id: string,
  now = new Date(),
) {
  const token = newId()
  const rows = await db
    .update(ledger)
    .set({
      leaseToken: token,
      leaseUntil: new Date(now.getTime() + 5 * 60_000),
      updatedAt: now,
      attempts: sql`${ledger.attempts} + 1`,
    })
    .where(
      and(
        eq(ledger.id, id),
        unfinished,
        or(isNull(ledger.leaseUntil), lte(ledger.leaseUntil, now)),
      ),
    )
    .returning({ id: ledger.id })
  return rows.length ? token : null
}
/** Freeze the first refusal while this worker still owns the live nonterminal lease. */
export async function recordWorkspaceDeletionRefusal(
  db: Database,
  id: string,
  token: string,
  reason: typeof ledger.$inferSelect.refusalReason,
  now = new Date(),
) {
  const parsed = z.enum(WORKSPACE_DELETION_REFUSALS).parse(reason)
  const rows = await db
    .update(ledger)
    .set({ refusalReason: parsed, updatedAt: now })
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.leaseToken, token),
        sql`${ledger.leaseUntil} > ${now.getTime()}`,
        sql`${ledger.state} in ('requested', 'drained')`,
        or(isNull(ledger.refusalReason), eq(ledger.refusalReason, parsed)),
        sql`not exists (select 1 from ${platformAuditLog} where ${platformAuditLog.id} = ${'workspace-deletion:' + id} and ${platformAuditLog.action} <> 'platform.workspace.deletion_refused')`,
      ),
    )
    .returning({ id: ledger.id })
  return rows.length !== 0
}

const checkpointSchema = z.strictObject({
  snapshot: snapshotSchema.optional(),
  lastError: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .nullable()
    .optional(),
  receiptQueued: z.literal(true).optional(),
})
const nextState = {
  requested: ['drained', 'refused'],
  drained: ['rows_deleted', 'refused'],
  rows_deleted: ['audited'],
  audited: ['swept'],
  swept: ['done'],
  done: [],
  refused: [],
} as const
export async function transitionWorkspaceDeletion(
  db: Database,
  id: string,
  token: string,
  expected: typeof ledger.$inferSelect.state,
  next: typeof ledger.$inferSelect.state,
  now = new Date(),
  checkpoint: unknown = {},
) {
  z.enum(WORKSPACE_DELETION_STATES).parse(expected)
  z.enum(WORKSPACE_DELETION_STATES).parse(next)
  const patch = checkpointSchema.parse(checkpoint)
  const { receiptQueued, ...stored } = patch
  if (
    expected !== next &&
    !(nextState[expected] as ReadonlyArray<string>).includes(next)
  )
    throw new Error('Invalid workspace deletion transition')
  let outcomeAllowed =
    expected === next ? undefined : isNull(ledger.refusalReason)
  if (next === 'refused') {
    outcomeAllowed = and(
      sql`${ledger.refusalReason} is not null`,
      sql`exists (select 1 from ${platformAuditLog} where ${platformAuditLog.id} = ${'workspace-deletion:' + id} and ${platformAuditLog.action} = 'platform.workspace.deletion_refused' and ${platformAuditLog.entityId} = ${ledger.organizationId})`,
    )
  }
  const rows = await db
    .update(ledger)
    .set({
      ...stored,
      state: next,
      updatedAt: now,
      leaseToken: null,
      leaseUntil: null,
      ...(next === 'swept' && expected !== next ? { sweptAt: now } : {}),
      ...(next === 'done' && expected !== next ? { doneAt: now } : {}),
      ...(receiptQueued || ['done', 'refused'].includes(next)
        ? { receiptTo: null, receiptName: null }
        : {}),
    })
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.state, expected),
        receiptQueued ? isNull(ledger.refusalReason) : undefined,
        outcomeAllowed,
        eq(ledger.leaseToken, token),
        sql`${ledger.leaseUntil} > ${now.getTime()}`,
      ),
    )
    .returning({ id: ledger.id })
  return rows.length !== 0
}
/** Production recovery budget: five unfinished rows older than the quarter-hour slot. */
export async function listStaleWorkspaceDeletions(
  db: Database,
  now = new Date(),
) {
  return db
    .select()
    .from(ledger)
    .where(
      and(
        unfinished,
        lt(ledger.updatedAt, new Date(now.getTime() - 15 * 60_000)),
        or(isNull(ledger.leaseUntil), lte(ledger.leaseUntil, now)),
      ),
    )
    .orderBy(asc(ledger.updatedAt), asc(ledger.id))
    .limit(5)
}
export async function pruneWorkspaceDeletions(db: Database, now = new Date()) {
  const cutoff = now.getTime() - 30 * 86_400_000
  const terminal = or(
    and(eq(ledger.state, 'done'), sql`${ledger.doneAt} < ${cutoff}`),
    and(eq(ledger.state, 'refused'), sql`${ledger.updatedAt} < ${cutoff}`),
  )
  const rows = await db
    .delete(ledger)
    .where(
      sql`${ledger.id} in (select ${ledger.id} from ${ledger} where ${terminal} limit 100)`,
    )
    .returning({ id: ledger.id })
  return rows.length
}
