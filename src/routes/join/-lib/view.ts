/**
 * What `/join/<secret>` shows, decided on the server for one visitor.
 *
 * The handler takes its bindings and the session as arguments, so it runs in plain Node under test
 * and `-server/join.ts` is only the wiring that supplies them. The visitor's session reaches the
 * read side as data: `src/server/public/**` reads none.
 */
import { loadTripInvite } from '#/server/public/trip-invite'
import type { Database } from '#/server/db/types'
import type { RateCounterStore } from '#/server/metering/rate'
import type { InvitePreview } from '#/server/repos/invites'
import type { TripInviteRuntime } from '#/server/public/trip-invite'

type Invited = Extract<InvitePreview, { state: 'invited' }>
type Member = Extract<InvitePreview, { state: 'member' }>
type NeedsWorkspace = Extract<InvitePreview, { state: 'needs-workspace' }>

/** What the page renders: a closed set, one per state of the card. */
export type InviteView =
  | (Invited & { readonly signedIn: boolean })
  | (Member & { readonly switchWorkspace: boolean })
  | (NeedsWorkspace & { readonly email: string })
  | { readonly state: 'unavailable'; readonly signedIn: boolean }
  | { readonly state: 'busy'; readonly retryAfter: number }

export interface InviteViewDeps {
  readonly db: Database
  readonly store: RateCounterStore
  readonly key: string
  readonly ip: string
  /** The visitor's session as data, or `null` when anonymous. */
  readonly session: {
    readonly id: string
    readonly email: string
    readonly banned: boolean
    readonly activeOrganizationId: string | null
  } | null
  readonly log?: TripInviteRuntime['log']
}

export async function viewInvite(
  deps: InviteViewDeps,
  secret: string,
): Promise<InviteView> {
  const { session } = deps
  const answer = await loadTripInvite(
    { db: deps.db, store: deps.store, key: deps.key, log: deps.log },
    {
      secret,
      ip: deps.ip,
      viewer: session && { id: session.id, banned: session.banned },
    },
  )
  if (answer.status === 429)
    return { state: 'busy', retryAfter: answer.retryAfter }
  if (answer.status === 404)
    return { state: 'unavailable', signedIn: session !== null }
  const { preview } = answer
  if (preview.state === 'invited')
    return { ...preview, signedIn: session !== null }
  if (preview.state === 'needs-workspace')
    return { ...preview, email: session?.email ?? '' }
  return {
    ...preview,
    switchWorkspace: session?.activeOrganizationId !== preview.organizationId,
  }
}
