import { z } from 'zod'
import type { WorkspaceDeletion } from '#/server/db/types'

type State = WorkspaceDeletion['state']
export interface WorkspaceDeletionCheckpoint {
  lastError?: string | null
  snapshot?: WorkspaceDeletion['snapshot']
  receiptQueued?: true
}
type Refusal = NonNullable<WorkspaceDeletion['refusalReason']>

/** Inert delivery contract; activation must provide an accepting adapter, never a success stub. */
const opaqueId = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .min(1)
  .max(128)
export const erasureResumeRequestSchema = z
  .strictObject({
    kind: z.literal('person-erasure'),
    id: z.string(),
    delaySeconds: z.literal(30),
    payload: z
      .strictObject({ erasureId: opaqueId, deletionId: opaqueId })
      .readonly(),
  })
  .refine(
    (request) =>
      request.id ===
      `person-erasure:${request.payload.erasureId}:${request.payload.deletionId}`,
  )
  .readonly()
export type ErasureResumeRequest = z.infer<typeof erasureResumeRequestSchema>
export const refusalNoticeRequestSchema = z
  .strictObject({
    kind: z.literal('workspace-deletion-refused'),
    id: z.string(),
    deletionId: opaqueId,
    reason: z.enum([
      'billing-unavailable',
      'live-subscription',
      'has-other-members',
    ]),
    to: z.email(),
    name: z.string().nullable(),
  })
  .refine(
    (request) =>
      request.id === `workspace-deletion:${request.deletionId}:refused`,
  )
  .readonly()
export type RefusalNoticeRequest = z.infer<typeof refusalNoticeRequestSchema>
export const deliveryAcceptanceSchema = z
  .strictObject({ accepted: z.literal(true), id: z.string() })
  .readonly()
export type DeliveryAcceptance = z.infer<typeof deliveryAcceptanceSchema>

export function workspaceDeletionResumeId(
  erasureId: string,
  deletionId: string,
) {
  return `person-erasure:${erasureId}:${deletionId}`
}

function erasureResumeRequest(row: WorkspaceDeletion): ErasureResumeRequest {
  if (row.initiator !== 'erasure')
    throw new Error('Erasure delivery requires an erasure row')
  return erasureResumeRequestSchema.parse({
    kind: 'person-erasure',
    id: workspaceDeletionResumeId(row.erasureId ?? '', row.id),
    delaySeconds: 30,
    payload: { erasureId: row.erasureId, deletionId: row.id },
  })
}

function requireAcceptance(
  request: { readonly id: string },
  result: DeliveryAcceptance,
) {
  if (deliveryAcceptanceSchema.parse(result).id !== request.id)
    throw new Error('Workspace deletion delivery identity mismatch')
}

/** External state and effects live at these ports; each call performs one bounded step. */
export interface WorkspaceDeletionPorts {
  now: () => Date
  lease: (
    id: string,
    now: Date,
  ) => Promise<
    | {
        row: WorkspaceDeletion
        token: string
      }
    | 'busy'
    | null
  >
  checkpoint: (
    row: WorkspaceDeletion,
    token: string,
    next: State,
    patch: WorkspaceDeletionCheckpoint,
    now: Date,
  ) => Promise<boolean>
  recordRefusal: (
    row: WorkspaceDeletion,
    token: string,
    reason: Refusal,
    now: Date,
  ) => Promise<boolean>
  /** Stable per-deletion refusal identity; resolves only after delivery acceptance. */
  refusalNotice: (request: RefusalNoticeRequest) => Promise<DeliveryAcceptance>
  billing: (
    row: WorkspaceDeletion,
  ) => Promise<'allowed' | 'billing-unavailable' | 'live-subscription'>
  drain: (
    row: WorkspaceDeletion,
  ) => Promise<
    | 'drained'
    | 'pending'
    | 'has-other-members'
    | 'live-subscription'
    | 'lost-lease'
  >
  refuse: (row: WorkspaceDeletion, reason: Refusal) => Promise<void>
  resumeErasure: (request: ErasureResumeRequest) => Promise<DeliveryAcceptance>
  deleteRows: (
    row: WorkspaceDeletion,
  ) => Promise<
    'deleted' | 'has-other-members' | 'live-subscription' | 'lost-lease'
  >
  invalidatePlan: (organizationId: string) => Promise<void>
  /** Idempotent, throwing append with read-back, keyed by deletion id. */
  audit: (row: WorkspaceDeletion) => Promise<void>
  /** Idempotent enqueue keyed by deletion id; resolves only after the queue accepts it. */
  receipt: (row: WorkspaceDeletion) => Promise<void>
  reconcileBilling: (row: WorkspaceDeletion) => Promise<void>
  sweep: (
    row: WorkspaceDeletion,
  ) => Promise<{ drained: boolean; deleted: number }>
}

/** The id selects a ledger row, never a second tenant or departing-user authority. */
export async function advanceWorkspaceDeletion(
  id: string,
  ports: WorkspaceDeletionPorts,
) {
  const lease = await ports.lease(id, ports.now())
  if (lease === 'busy') return 'busy'
  if (lease === null) return 'terminal'
  const { row, token } = lease
  const checkpoint = async (
    next: State,
    patch: WorkspaceDeletionCheckpoint = {},
  ) => ports.checkpoint(row, token, next, patch, ports.now())
  const refuse = async (reason: Refusal) => {
    if (!(await ports.recordRefusal(row, token, reason, ports.now())))
      return 'lost-lease'
    const refused = { ...row, refusalReason: reason }
    if (row.initiator === 'owner') {
      // Owner delivery data comes only from this leased trusted row, never an envelope.
      if (row.receiptTo === null) throw new Error('Missing refusal recipient')
      const request = refusalNoticeRequestSchema.parse({
        kind: 'workspace-deletion-refused',
        id: `workspace-deletion:${row.id}:refused`,
        deletionId: row.id,
        reason,
        to: row.receiptTo,
        name: row.receiptName,
      })
      requireAcceptance(request, await ports.refusalNotice(request))
    }
    if (row.initiator === 'erasure') {
      const request = erasureResumeRequest(refused)
      requireAcceptance(request, await ports.resumeErasure(request))
    }
    await ports.refuse(refused, reason)
    return (await checkpoint('refused', { lastError: reason }))
      ? 'advanced'
      : 'lost-lease'
  }
  try {
    if (row.refusalReason !== null) return await refuse(row.refusalReason)
    if (row.state === 'requested') {
      const billing = await ports.billing(row)
      if (billing !== 'allowed') {
        if (billing === 'billing-unavailable' && row.initiator === 'erasure') {
          return (await checkpoint('requested', { lastError: billing }))
            ? 'pending'
            : 'lost-lease'
        }
        return await refuse(billing)
      }
      const result = await ports.drain(row)
      if (result === 'lost-lease') return 'lost-lease'
      if (result === 'drained') {
        return (await checkpoint('drained', { lastError: null }))
          ? 'advanced'
          : 'lost-lease'
      }
      if (result !== 'pending') return await refuse(result)
      return (await checkpoint('requested')) ? 'pending' : 'lost-lease'
    }
    if (row.state === 'drained') {
      const result = await ports.deleteRows(row)
      if (result === 'lost-lease') return 'lost-lease'
      if (result !== 'deleted') return await refuse(result)
      await ports.invalidatePlan(row.organizationId)
      return (await checkpoint('rows_deleted', { lastError: null }))
        ? 'advanced'
        : 'lost-lease'
    }
    if (row.state === 'rows_deleted') {
      await ports.audit(row)
      if (row.receiptTo !== null) {
        await ports.receipt(row)
        // Release this lease after clearing PII; subsequent reconciliation uses a fresh row.
        return (await checkpoint('rows_deleted', { receiptQueued: true }))
          ? 'pending'
          : 'lost-lease'
      }
      if (row.initiator === 'erasure') {
        const request = erasureResumeRequest(row)
        requireAcceptance(request, await ports.resumeErasure(request))
      }
      await ports.reconcileBilling(row)
      return (await checkpoint('audited', { lastError: null }))
        ? 'advanced'
        : 'lost-lease'
    }
    if (
      row.state === 'swept' &&
      (row.sweptAt === null ||
        ports.now().getTime() - row.sweptAt.getTime() < 900_000)
    ) {
      return (await checkpoint('swept')) ? 'pending' : 'lost-lease'
    }
    if (row.state === 'audited' || row.state === 'swept') {
      const progress = await ports.sweep(row)
      let next: State = row.state
      if (progress.drained) next = row.state === 'audited' ? 'swept' : 'done'
      const saved = await checkpoint(next, {
        lastError: null,
        snapshot: {
          ...row.snapshot,
          r2ObjectsDeleted:
            (row.snapshot.r2ObjectsDeleted ?? 0) + progress.deleted,
        },
      })
      if (!saved) return 'lost-lease'
      return progress.drained ? 'advanced' : 'pending'
    }
    return 'terminal'
  } catch (error) {
    // Provider bodies and user content never enter the durable error field.
    await checkpoint(row.state, { lastError: 'step-unavailable' })
    throw error
  }
}
