/** Global state only. The eventual workspace-deletion driver is the sole production writer. */
import { and, asc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  newId,
  workspaceDeletions as ledger,
  WORKSPACE_DELETION_STATES,
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
  const rows = await db
    .update(ledger)
    .set({
      ...stored,
      state: next,
      updatedAt: now,
      leaseToken: null,
      leaseUntil: null,
      ...(next === 'swept' ? { sweptAt: now } : {}),
      ...(next === 'done' ? { doneAt: now } : {}),
      ...(receiptQueued || ['done', 'refused'].includes(next)
        ? { receiptTo: null, receiptName: null }
        : {}),
    })
    .where(
      and(
        eq(ledger.id, id),
        eq(ledger.state, expected),
        eq(ledger.leaseToken, token),
        sql`${ledger.leaseUntil} > ${now.getTime()}`,
      ),
    )
    .returning({ id: ledger.id })
  return rows.length !== 0
}
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
        lt(ledger.updatedAt, new Date(now.getTime() - 60_000)),
        or(isNull(ledger.leaseUntil), lte(ledger.leaseUntil, now)),
      ),
    )
    .orderBy(asc(ledger.updatedAt), asc(ledger.id))
    .limit(100)
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
