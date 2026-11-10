import { appendWorkspaceDeletionAudit } from '#/server/catalog/audit'
import {
  checkWorkspaceDeletionBilling,
  reconcileWorkspaceDeletionBilling,
} from '#/server/billing/workspace-deletion'
import { createSubscriptionStore } from '#/server/billing/store'
import { planStateCacheKey } from '#/server/billing/entitlements'
import {
  deleteWorkspace,
  drainWorkspace,
  WorkspaceHasLiveSubscriptionError,
  WorkspaceNotEmptyError,
  WorkspaceDeletionAuthorityLostError,
} from '#/server/repos/members'
import { NotFoundError } from '#/server/repos/context'
import { drainWorkspaceObjects } from '#/server/storage/workspace-objects'
import { createWorkspaceDeletionScope } from './scope'
import type { PlatformActor } from '#/server/auth/guard'
import type { PolarClient } from '#/server/billing/types'
import type { Database, WorkspaceDeletion } from '#/server/db/types'
import type { PrefixStore } from '#/server/storage/objects'
import type { WorkspaceDeletionPorts } from './driver'

interface DeletionEffects {
  now: () => Date
  files: PrefixStore
  polar: PolarClient
  /** Receives the canonical cache key, never a caller-selected prefix. */
  invalidatePlan: (key: string) => Promise<void>
  closeRooms: (
    row: WorkspaceDeletion,
    tripIds: ReadonlyArray<string>,
  ) => Promise<void>
  /** Trusted actor lookup; no role is inferred from the reserved tenant scope. */
  actorFor: (row: WorkspaceDeletion) => Promise<PlatformActor>
  /** AC9 stages strict delivery descriptors/acceptance here; activation owns real adapters. */
  notifications: Pick<
    WorkspaceDeletionPorts,
    'receipt' | 'resumeErasure' | 'refusalNotice'
  >
}

/** Real persistence/storage effects, with external delivery and room operations passed explicitly. */
export function createWorkspaceDeletionEffects(
  db: Database,
  effects: DeletionEffects,
) {
  const subscriptions = createSubscriptionStore(db)
  const authority = (row: WorkspaceDeletion) => {
    if (!row.leaseToken) throw new WorkspaceDeletionAuthorityLostError()
    return createWorkspaceDeletionScope(
      db,
      { row, token: row.leaseToken },
      effects.now(),
    )
  }
  const refusal = (error: unknown) => {
    if (error instanceof WorkspaceDeletionAuthorityLostError)
      return 'lost-lease' as const
    if (error instanceof WorkspaceNotEmptyError)
      return 'has-other-members' as const
    if (error instanceof WorkspaceHasLiveSubscriptionError)
      return 'live-subscription' as const
    throw error
  }
  return {
    billing: (row: WorkspaceDeletion) =>
      checkWorkspaceDeletionBilling({
        runtime: { subscriptions, polar: effects.polar },
        organizationId: row.organizationId,
      }),
    drain: async (row: WorkspaceDeletion) => {
      try {
        const {
          scope,
          departingUserId,
          authority: writeAuthority,
        } = authority(row)
        const result = await drainWorkspace(
          scope,
          { departingUserId },
          (ids) => effects.closeRooms(row, ids),
          writeAuthority,
        )
        return result.drained ? ('drained' as const) : ('pending' as const)
      } catch (error) {
        return refusal(error)
      }
    },
    deleteRows: async (row: WorkspaceDeletion) => {
      try {
        const {
          scope,
          departingUserId,
          authority: writeAuthority,
        } = authority(row)
        await deleteWorkspace(scope, { departingUserId }, writeAuthority)
      } catch (error) {
        // A crash after the guarded delete but before checkpoint resumes from the missing row.
        if (!(error instanceof NotFoundError)) return refusal(error)
      }
      return 'deleted' as const
    },
    invalidatePlan: (organizationId: string) =>
      effects.invalidatePlan(planStateCacheKey(organizationId)),
    audit: async (row: WorkspaceDeletion) => {
      await appendWorkspaceDeletionAudit(
        db,
        row,
        await effects.actorFor(row),
        'deleted',
        effects.now(),
      )
    },
    refuse: async (row: WorkspaceDeletion) => {
      await appendWorkspaceDeletionAudit(
        db,
        row,
        await effects.actorFor(row),
        'deletion_refused',
        effects.now(),
      )
    },
    refusalNotice: effects.notifications.refusalNotice,
    receipt: effects.notifications.receipt,
    resumeErasure: effects.notifications.resumeErasure,
    reconcileBilling: (row: WorkspaceDeletion) =>
      reconcileWorkspaceDeletionBilling(effects.polar, row.organizationId),
    sweep: (row: WorkspaceDeletion) =>
      drainWorkspaceObjects(effects.files, row.organizationId),
  } satisfies Omit<
    WorkspaceDeletionPorts,
    'lease' | 'checkpoint' | 'recordRefusal' | 'now'
  >
}
