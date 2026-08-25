/**
 * Reading the account a console action is aimed at, and the two refusals every caller shares.
 *
 * Its own module because three files need it and none of them owns it: `./users` reads the
 * before-state for every `changes` payload, `./impersonation` reads the target's ban state and role
 * before it mints a session, and both need "not your own account" to mean the same thing. A second
 * copy of either would be a second answer to "does this account exist".
 */

import { platformApi } from './bindings'
import { ConsoleActionError, isAuthNotFound } from './errors'
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
