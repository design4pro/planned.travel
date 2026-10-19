/**
 * Joining a trip from `/join/<secret>`: the one write on the invite-link surface.
 *
 * The handler takes its bindings, the signed-in user and the audit write as arguments, so it runs in
 * plain Node under test and `-server/join.ts` is only the wiring that supplies them. It is the named
 * caller of `joinTripByInviteUnscoped`.
 */
import { spendPublicBudget } from '#/server/public/rate-limit'
import { joinTripByInviteUnscoped } from '#/server/repos/invites'
import { hashSecret, isSecretShape } from '#/server/security/secret'
import { AUDIT_ACTIONS } from '#/server/audit/trail'
import type { TrailInput } from '#/server/audit/trail'
import type { Database } from '#/server/db/types'
import type { RateCounterStore } from '#/server/metering/rate'
import type { TenantContext } from '#/server/repos/context'

/** Per-minute ceilings of the authenticated submit (`docs/ACCESS.md` §3.6). */
const PER_USER = 10
const PER_IP = 30

/** What the card is told. Ids travel only with `joined` and `member`. */
export type JoinAnswer =
  | {
      readonly outcome: 'joined' | 'member'
      readonly tripId: string
      readonly organizationId: string
      /** The joiner's active workspace is not the trip's: opening it needs a switch first. */
      readonly switchWorkspace: boolean
    }
  | { readonly outcome: 'needs-workspace' }
  | { readonly outcome: 'unavailable' }
  /** The session ended while the card was open: only signing in again can help. */
  | { readonly outcome: 'signed-out' }
  | { readonly outcome: 'busy'; readonly retryAfter: number }

/** The signed-in person as the join needs them. */
export interface Joiner {
  readonly id: string
  readonly banned: boolean
  readonly impersonated: boolean
  readonly activeOrganizationId: string | null
}

/** The part of a Better Auth session the join reads. */
interface SessionLike {
  readonly user: { readonly id: string; readonly banned: boolean }
  readonly session: {
    readonly impersonatedBy: string | null
    readonly activeOrganizationId: string | null
  }
}

/** `null` when nobody is signed in. An impersonated session is refused by the repository. */
export function joinerOf(session: SessionLike | null): Joiner | null {
  if (!session) return null
  return {
    id: session.user.id,
    banned: session.user.banned,
    impersonated: session.session.impersonatedBy !== null,
    activeOrganizationId: session.session.activeOrganizationId,
  }
}

export interface JoinDeps {
  readonly db: Database
  readonly store: RateCounterStore
  /** The derivation key (`BETTER_AUTH_SECRET`). */
  readonly key: string
  /** The address from `cf-connecting-ip`, or `unknown`. */
  readonly ip: string
  /** The signed-in person, or `null` when the session ended: answered before any budget is spent. */
  readonly user: Joiner | null
  /** Appends a tenant audit row for the joiner's context in the link's workspace. */
  readonly audit: (context: TenantContext, input: TrailInput) => Promise<void>
  readonly now?: () => Date
  /** Receives the link id and the outcome only: never the secret, the digest or the path. */
  readonly log?: (
    event: 'joined' | 'member' | 'refused' | 'limited',
    fields: { linkId?: string; retryAfter?: number },
  ) => void
}

export async function joinInvite(
  deps: JoinDeps,
  secret: string,
): Promise<JoinAnswer> {
  const { user } = deps
  if (!user) return { outcome: 'signed-out' }
  const now = deps.now?.() ?? new Date()
  for (const [kind, id, ceiling] of [
    ['join-user', user.id, PER_USER],
    ['join-ip', deps.ip, PER_IP],
  ] as const) {
    const retryAfter = await spendPublicBudget(
      deps.store,
      kind,
      id,
      ceiling,
      now,
    )
    if (retryAfter !== null) {
      deps.log?.('limited', { retryAfter })
      return { outcome: 'busy', retryAfter }
    }
  }

  if (!isSecretShape('trip-invite', secret)) return { outcome: 'unavailable' }
  const result = await joinTripByInviteUnscoped(
    deps.db,
    await hashSecret(secret),
    deps.key,
    user,
    now,
  )
  if (
    result.outcome === 'unavailable' ||
    result.outcome === 'needs-workspace'
  ) {
    deps.log?.('refused', {})
    return { outcome: result.outcome }
  }

  const answer: JoinAnswer = {
    outcome: result.outcome,
    tripId: result.tripId,
    organizationId: result.organizationId,
    switchWorkspace: user.activeOrganizationId !== result.organizationId,
  }
  if (result.outcome === 'member') {
    deps.log?.('member', {})
    return answer
  }
  // After the commit, and never the secret or the digest: the link's id and the role it granted.
  await deps.audit(result.context, {
    action: AUDIT_ACTIONS.TRIP_MEMBER_JOINED,
    entityType: 'trip',
    entityId: result.tripId,
    metadata: { inviteId: result.inviteId, role: result.role },
  })
  deps.log?.('joined', { linkId: result.inviteId })
  return answer
}
