/**
 * The people the creation dialog's picker offers: the workspace, minus the person asking.
 *
 * **A picker's answer, not a directory.** Name and image are what a person is recognised by; the
 * address, the workspace role, the membership id and the join date stay in the repository. Any
 * workspace member may read it, a plain `member` included: `loadOrganizationSettings` already hands
 * every member the whole list with addresses, and a member who creates a trip owns it and reads the
 * same names as `invitable` on its People screen. It is scoped to the caller's workspace by the same
 * `listMemberProfiles` read, and it writes nothing: who may be added to a trip is still decided by
 * `addTripMember`.
 *
 * Fetched when the dialog opens and by no loader, so a screen that never opens the dialog never
 * pays for the roster.
 */
import { createServerFn } from '@tanstack/react-start'

import { listMemberProfiles } from '#/server/repos'
import { appScope } from './context'

import type { TenantScope } from '#/server/repos'

/** One person the picker can offer. */
export interface RosterPerson {
  readonly userId: string
  readonly name: string
  readonly image: string | null
}

/**
 * The roster as a plain function, because outside a Start build a `createServerFn` handler's return
 * value is unreachable from a unit test.
 */
export async function readWorkspaceRoster(
  scope: TenantScope,
): Promise<Array<RosterPerson>> {
  const profiles = await listMemberProfiles(scope)
  return profiles
    .filter((profile) => profile.userId !== scope.ctx.userId)
    .map((profile) => ({
      userId: profile.userId,
      name: profile.name,
      image: profile.image,
    }))
}

export const loadWorkspaceRoster = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<RosterPerson>> =>
    readWorkspaceRoster(await appScope()),
)
