/**
 * The browser half of the workspace claim, registered once in `src/start.ts`.
 *
 * Every server function a tab calls states the workspace the tab is showing, and the server compares
 * it with the session's (`requireOrg`). Registering it globally is what makes "a tab's data and its
 * chrome cannot disagree" a property of the product rather than of each call site: a new server
 * function cannot forget to send it, and one that must not be checked simply never calls `requireOrg`
 * (shell adoption during navigation, sign-in, invitations, the console). Room shell
 * refreshes check the original claim before reading tenant content.
 *
 * There is no server half. The header is read where the session already is, in `requireOrg`,
 * because that is the one door every tenant-scoped call passes through.
 *
 * A tab stops after its first refusal: a stale tab that kept polling would send a refused call per
 * tick and count each one in `server_fn.failure`. Once stale, calls fail here with the same refusal
 * until a navigation re-reads the shell (`src/routes/_app/route.tsx`). They do not reopen the
 * notice: a poll or a link preload is not the reader asking, and a dialog that came back every few
 * seconds after "Not now" would pull focus away from whatever they were doing. The surfaces a
 * reader's own action ends in (`useAction`, `messageOf`, `ErrorPanel`) reopen it.
 *
 * The refusal the caller sees is a plain `Error` carrying the catalogue key, not the redaction
 * envelope the server sent. A reader of the envelope that does not know this key (a form, a toast)
 * then finds an `unexpected` failure and shows its own generic wording instead of printing the key;
 * `isWorkspaceChanged` recognises both.
 */
import { createMiddleware } from '@tanstack/react-start'

import {
  WORKSPACE_CHANGED_KEY,
  WORKSPACE_CLAIM_HEADER,
  isWorkspaceChanged,
} from './workspace-claim'
import {
  markWorkspaceStale,
  permitsWorkspaceCall,
  trackWorkspaceCall,
  workspaceSwitchCancelled,
  workspaceClaimState,
  workspaceCallClaim,
  workspaceClaimGeneration,
} from './workspace-claim-store'

export const workspaceClaimMiddleware = createMiddleware({
  type: 'function',
}).client(async ({ next, fetch }) => {
  const generation = workspaceClaimGeneration()
  const { stale } = workspaceClaimState()
  const organizationId = workspaceCallClaim(fetch)

  if (stale) {
    throw new Error(WORKSPACE_CHANGED_KEY)
  }

  if (!permitsWorkspaceCall(fetch)) throw workspaceSwitchCancelled()
  // Shell-less calls keep their existing behavior; transitions never remove a displayed claim.
  const finish = trackWorkspaceCall()
  try {
    if (organizationId === null) return await next()
    return await next({ headers: { [WORKSPACE_CLAIM_HEADER]: organizationId } })
  } catch (cause) {
    if (isWorkspaceChanged(cause)) {
      if (organizationId !== null && workspaceClaimGeneration() === generation)
        markWorkspaceStale(organizationId)
      throw new Error(WORKSPACE_CHANGED_KEY, { cause })
    }
    throw cause
  } finally {
    finish()
  }
})
