import { getPlanSummary } from '#/server/repos/billing'
import { tripsRepository } from '#/server/repos/trips'
import { tripFilesRepository } from '#/server/repos/files'
import {
  insertWorkspaceDeletion,
  readWorkspaceDeletionOutcome,
} from '#/server/catalog/workspace-deletions'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { Locale } from '#/lib/i18n'
import type { DeleteWorkspaceResult } from '#/server/fns/workspace-delete-writes'
import type { advanceWorkspaceDeletion } from './driver'

/** Driver-owned admission. The caller has proved identity; the target is its authenticated scope. */
export async function requestOwnerWorkspaceDeletion(
  db: Database,
  input: { scope: TenantScope; name: string; email: string; locale: Locale },
  ports: {
    now: () => Date
    deadline?: number
    advance: (id: string) => ReturnType<typeof advanceWorkspaceDeletion>
    enqueue: (id: string) => Promise<void>
  },
): Promise<DeleteWorkspaceResult> {
  if (
    input.scope.ctx.role !== 'owner' ||
    input.scope.ctx.impersonatedBy != null
  )
    throw new Error('Invalid owner deletion authority')
  // Diagnostic snapshot only; membership/provider eligibility stays after the ledger fence.
  const [plan, trips, fileRows] = await Promise.all([
    getPlanSummary(input.scope),
    tripsRepository.count(input.scope),
    tripFilesRepository.count(input.scope),
  ])
  const row = await insertWorkspaceDeletion(
    db,
    {
      organizationId: input.scope.ctx.organizationId,
      requestedBy: input.scope.ctx.userId,
      initiator: 'owner',
      receiptTo: input.email,
      receiptName: input.name,
      receiptLocale: input.locale,
      snapshot: {
        plan: plan.planId,
        subscriptionStatus: plan.status,
        trips,
        fileRows,
      },
    },
    ports.now(),
  )
  if (row.initiator !== 'owner' || row.requestedBy !== input.scope.ctx.userId)
    throw new Error('Incompatible deletion request')
  // Durable continuation admission precedes optional inline work; failure never loses the fence.
  await ports.enqueue(row.id)
  const deadline = ports.deadline ?? ports.now().getTime() + 2000
  for (let n = 0; n < 4 && ports.now().getTime() < deadline; n++) {
    const outcome = await ports.advance(row.id)
    if (outcome !== 'advanced' && outcome !== 'pending') break
  }
  const outcome = await readWorkspaceDeletionOutcome(db, row.id)
  if (outcome?.state === 'refused' && outcome.reason !== null)
    return { ok: false, reason: outcome.reason }
  return {
    ok: true,
    complete: Boolean(
      outcome &&
      ['rows_deleted', 'audited', 'swept', 'done'].includes(outcome.state),
    ),
  }
}
