/**
 * Reading the account a console action is aimed at, and the two refusals every caller shares.
 *
 * Its own module because three files need it and none of them owns it: `./users` reads the
 * before-state for every `changes` payload, `./impersonation` reads the target's ban state and role
 * before it mints a session, and both need "not your own account" to mean the same thing. A second
 * copy of either would be a second answer to "does this account exist".
 */

import { platformApi, readOwnership, readWorkspaces } from './bindings'
import { ConsoleActionError, isAuthNotFound } from './errors'
import { describeWorkspaces, findSoleOwnedWorkspaces } from './last-owner'
import { platformUserSchema } from './projections'

import type { ConsoleCall } from './context'
import type { PlatformUserRow } from './projections'

/**
 * The target account, parsed, or a typed refusal.
 *
 * `auth.api.getUser` rather than a read of our own: it is the plugin's own accessor for the row it
 * is about to change, so the before-state in an audit row and the row the mutation sees come from
 * one source. Its `NOT_FOUND` becomes {@link ConsoleActionError}; every other failure is re-thrown
 * untouched, so a transport fault never reads as a missing account.
 */
export async function readTargetUser(
  call: ConsoleCall,
  id: string,
): Promise<PlatformUserRow> {
  try {
    const user = await platformApi().getUser({
      query: { id },
      headers: call.headers,
    })
    return platformUserSchema.parse(user)
  } catch (cause) {
    if (isAuthNotFound(cause)) {
      throw new ConsoleActionError(
        'target-not-found',
        'That account no longer exists.',
      )
    }
    throw cause
  }
}

/**
 * Refuses an action that must never be aimed at the operator's own account.
 *
 * Better Auth refuses self-ban and self-delete too, with `BAD_REQUEST` and a message a screen would
 * have to sniff by text. Pre-empting it is what turns "something went wrong" into copy, and it means
 * the refusal happens before any read of the target at all.
 */
export function refuseSelfTarget(
  call: ConsoleCall,
  id: string,
  message: string,
): void {
  if (call.actor.userId === id) {
    throw new ConsoleActionError('target-is-self', message)
  }
}

/**
 * Refuses to delete the only owner of a workspace that other people still belong to.
 *
 * `removeUser` cascades the `member` rows and runs no organization hook, so the plugin's own
 * last-owner refusals never see a deletion; without this, the workspace is left with nobody who can
 * administer its members, its billing or its deletion, and nothing in the product can put that right.
 * A target whose workspaces have nobody else in them is not refused: that is every new account's
 * personal workspace, and it is deleted exactly as before. See `./last-owner` for the counting.
 *
 * The sentence names the target's own workspaces - which the console shows beside the account - and
 * the two exits: an owner of the workspace promoting another owner from its Workspace console, and
 * suspending the account. It speaks of the first as somebody else's act, because the operator reading
 * it is in the platform console and has no role action of their own. It names nobody else, and
 * neither does anything this function logs.
 *
 * A read that could not be completed refuses too, under `target-beyond-cap`, rather than deciding on
 * what it saw.
 */
export async function refuseSoleOwner(
  call: ConsoleCall,
  id: string,
): Promise<void> {
  const ownership = await readOwnership(id)
  if (!ownership.complete) {
    call.logger.warn(
      'console could not read every membership of a deletion target',
      {
        entityId: id,
      },
    )
    throw new ConsoleActionError(
      'target-beyond-cap',
      'The console could not confirm that this account is not the only owner of a workspace other people belong to. An owner of each of those workspaces can promote another member to owner from its Workspace console first, or the account can be suspended instead of deleting it.',
    )
  }

  const stranded = findSoleOwnedWorkspaces(ownership)
  if (stranded.length === 0) return

  const where = describeWorkspaces(
    (await readWorkspaces(stranded)).map((row) => row.name),
  )

  throw new ConsoleActionError(
    'target-sole-owner',
    `This account is the only owner of ${where}, and other people still belong to ${stranded.length === 1 ? 'it' : 'them'}. An owner of ${stranded.length === 1 ? 'that workspace' : 'those workspaces'} can promote another member to owner from ${stranded.length === 1 ? 'its' : 'their'} Workspace console first, or the account can be suspended instead of deleting it.`,
  )
}
