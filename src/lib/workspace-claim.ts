/**
 * Which workspace a browser tab believes it is in, and what happens when the session disagrees.
 *
 * The active workspace is `session.activeOrganizationId`, a column on the session row, so every tab
 * of one session shares it. A tab opened before another tab switched keeps its old chrome while its
 * next server call resolves the new workspace. The tab therefore states, on every server-function
 * call it makes from inside the authenticated shell, the workspace it is showing (the claim), and
 * `requireOrg` refuses the call when the session's effective workspace is a different one.
 *
 * **The claim only ever narrows access.** It is compared, never used: `TenantContext.organizationId`
 * still comes from the session alone, and membership is re-read on every request, so a forged or
 * stale claim can turn an allowed call into a refusal and can never open one.
 *
 * This module is the pure half - the header name, the parser, the refusal key - and is read by the
 * server in `src/server/auth/tenant.ts`. The tab's own store is `./workspace-claim-store`.
 */
import { readPublicFailure } from '#/lib/errors'

/** The request header a tab states its workspace in. */
export const WORKSPACE_CLAIM_HEADER = 'x-planned-workspace'

/**
 * The refusal, as the catalogue key it travels as.
 *
 * Same shape as `SHELL_STATE_KEYS` (`src/components/layout/session.ts`): the server throws the key
 * and the browser resolves it in the locale the page was rendered in, so no English sentence
 * crosses the boundary. `classifyFailure` lets exactly this string through as authored copy.
 *
 * It is a plain literal, not `satisfies MessageKey`: the server reaches this module, and a type
 * import of the catalogue is an edge the catalog isolation walk would follow into every locale
 * file. `workspace-claim.test.ts` checks the key against the catalogue instead.
 */
export const WORKSPACE_CHANGED_KEY = 'shell.session.workspaceChanged'

/** Better Auth ids are `nanoid(24)`: URL-safe, so this is the whole alphabet a claim may use. */
const CLAIM_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export type ParsedClaim =
  | { readonly status: 'absent' }
  | { readonly status: 'valid'; readonly organizationId: string }
  | { readonly status: 'malformed' }

/**
 * Reads the header's raw value.
 *
 * Absent is allowed and behaves as before (a call made before the shell loaded, a non-browser
 * caller); present but malformed is refused rather than ignored, because ignoring it would let a
 * client switch the guard off by sending garbage.
 */
export function parseWorkspaceClaim(
  raw: string | null | undefined,
): ParsedClaim {
  if (raw === null || raw === undefined) return { status: 'absent' }
  return CLAIM_PATTERN.test(raw)
    ? { status: 'valid', organizationId: raw }
    : { status: 'malformed' }
}

/** Whether a thrown value is the workspace-changed refusal, as it arrives in the browser. */
export function isWorkspaceChanged(error: unknown): boolean {
  const message =
    readPublicFailure(error).message ??
    (error instanceof Error ? error.message : error)
  return message === WORKSPACE_CHANGED_KEY
}
