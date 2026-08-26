/**
 * `requirePermission` — the only implementation of "may this actor do this"
 * (docs/SPEC.md §5, docs/ACCESS.md §2.5).
 *
 * Console server functions and the MCP server call this same function, so the answer cannot differ
 * between the two surfaces. Three properties make that claim worth something:
 *
 * - **It is a predicate and nothing else.** No database read, no cache read, no audit write, and
 *   nothing to wait on: it is synchronous by construction, and its only two run-time imports are
 *   the dictionary and the error class. Everything it needs is already in the session the caller
 *   was handed. A guard that did any work of its own would run *after* something, and the moment
 *   it can run after a mutation it stops being a boundary. `__tests__/guard.test.ts` asserts that
 *   against the source text, because nothing in the toolchain does.
 * - **It reaches the grid through `./access` only.** Better Auth's `admin` plugin ships an
 *   authorisation implementation of its own whose first branch answers `true` from an id list
 *   before any role or statement is read (docs/ACCESS.md §1.4). Re-expressing this function as a
 *   wrapper around that endpoint would import that bypass straight into the one place
 *   authorisation is decided — and would still pass every matrix test below while the list is
 *   empty. The test asserts the three identifiers involved are absent from this file.
 * - **It never compares `role === 'admin'`.** `user.role` is a comma-joined string for a
 *   multi-role account. Resolution lives in `resolvePlatformRole`, and this file has one caller of
 *   it.
 *
 * Denials are the widened {@link AuthRequirementError} from `./tenant`, so a console route, a
 * server function and an MCP tool all describe a refusal in one vocabulary.
 */
import { resolvePlatformRole, roles } from './access'
import { AuthRequirementError } from './tenant'
import type { PlatformPermissionRequest } from './access'
import type { AuthSession } from './tenant'
import type { PlatformActorKind } from '#/server/db/types'

/**
 * Who performed a platform action, as `platform_audit_log` records it (docs/ACCESS.md §4.1).
 *
 * Exported here rather than beside the audit writer because the writer, the console server
 * functions and `src/server/catalog/repo.ts` all take one, and three modules agreeing on a shape
 * by coincidence is three chances to disagree about it later.
 *
 * `userId` and `role` are null only for a `system` actor — cron, matcher, prune. `tokenId` is
 * non-null exactly for an `agent`, the MCP bearer in `staff_api_tokens`.
 */
export type PlatformActor = {
  userId: string | null
  actorKind: PlatformActorKind
  role: string | null
  tokenId: string | null
}

/**
 * Throws unless `session` may perform every statement in `request`; returns nothing when it may.
 *
 * The four refusals, in the order they are decided:
 *
 * 1. no session → `401 unauthenticated`;
 * 2. `user.banned` → `403 banned`, whatever the role says, because a ban is a veto on top of a
 *    role rather than a change to one (docs/ACCESS.md §1.3);
 * 3. `session.impersonatedBy` set → `403 impersonated`, whatever platform role the impersonated
 *    account holds. A curator being worn does not lend its `catalog:write` to the operator wearing
 *    it (docs/ACCESS.md §6.4);
 * 4. the resolved role does not hold the statement → `403 insufficient-platform-permission`.
 *
 * Steps 2 and 3 are both vetoes and both answer 403, so their order decides only which reason a
 * banned operator inside an impersonated session is told. Ban is reported first: it is the fact
 * about the account, and it survives ending the impersonation.
 */
export function requirePermission(
  session: AuthSession | null,
  request: PlatformPermissionRequest,
): void {
  if (!session) {
    throw new AuthRequirementError(
      'unauthenticated',
      'You need to sign in to continue.',
    )
  }

  if (session.user.banned) {
    throw new AuthRequirementError('banned', 'This account is suspended.')
  }

  if (session.session.impersonatedBy !== null) {
    throw new AuthRequirementError(
      'impersonated',
      'Platform actions are unavailable while you are impersonating someone.',
    )
  }

  const role = roles[resolvePlatformRole(session.user.role)]
  if (!role.authorize(request).success) {
    throw new AuthRequirementError(
      'insufficient-platform-permission',
      'Your platform role does not allow that.',
    )
  }
}
