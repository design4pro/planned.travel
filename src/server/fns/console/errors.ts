/**
 * The refusals a console action raises on its own behalf.
 *
 * Authorisation refusals are not here: those are `AuthRequirementError` from `#/server/auth/tenant`,
 * raised by `requirePermission`, and one vocabulary for "you may not" is the whole point of that
 * type. What this file carries is the other kind — the operator *may* perform the action and the
 * target cannot receive it. They are separated because they answer different questions and lead to
 * different copy: a 403 tells an operator to stop, a 409 tells them to pick a different target.
 *
 * Most of these codes exist because Better Auth's own refusal for the same case is unusable at the
 * console. `provider-not-blockable` is the first that does not: it refuses a configuration this
 * deployment will not enforce, and no dependency has an opinion about it. The shared property is
 * the shape rather than the origin — a 409 whose message names the way forward.
 *
 * The sharpest of the Better Auth ones is {@link ConsoleActionError.code} `target-banned`:
 * impersonating a banned account otherwise throws the `admin` plugin's `FORBIDDEN` carrying
 * `bannedUserMessage`, which is copy
 * written *for the banned user* ("This account is suspended…") and would be shown to the operator
 * as though it described them. The others are pre-empted for the same reason — the plugin's
 * `YOU_CANNOT_BAN_YOURSELF` and `USER_NOT_FOUND` arrive as `APIError` instances that a screen would
 * have to sniff by message text.
 */

/** Why a console action refused a target it was otherwise permitted to act on. */
export type ConsoleRefusalCode =
  /** No account with that id. */
  | 'target-not-found'
  /** The account is banned; impersonating it would mint a session its own ban forbids. */
  | 'target-banned'
  /** The operator aimed at their own account, on an action that must not be self-inflicted. */
  | 'target-is-self'
  /** docs/ACCESS.md §2.4: admin-on-admin impersonation is granted to no role, ours included. */
  | 'target-is-admin'
  /** `stopImpersonating` on a session that is not an impersonated one. */
  | 'not-impersonating'
  /**
   * The account holds more sessions than one call enumerates, and the named one was not among the
   * ones this call saw.
   *
   * Its own code rather than `target-not-found`, because the two lead to opposite actions: "that
   * session has already ended" invites the operator to move on, and this one says the session may
   * well be live and the way to end it is to revoke every session of the account at once. Reporting
   * a session the enumeration never reached as ended is precisely the silent truncation this code
   * exists to make impossible.
   *
   * It is also what the purge's runaway-loop guard raises (`./session-keys`), on the one path where
   * an account holds more sessions than a single Worker invocation could ever clear. That refusal
   * happens before any mutation, for the same reason: half a purge carried into a ban is a live
   * session no later call can name.
   *
   * A deletion raises it too, when it cannot establish whether the account is the only owner of a
   * workspace (a page of memberships that came back full, or a row it could not read): an answer
   * it could not read is refused, never taken for "no".
   */
  | 'target-beyond-cap'
  /**
   * The account is the only owner of a workspace that other people still belong to.
   *
   * `removeUser` cascades the `member` rows without running any organization hook, so nothing but
   * this refusal stands between a deletion and a workspace nobody can administer, bill or delete.
   * The message names the account's own workspaces - which the console already shows beside it - and
   * offers the two exits: an owner of that workspace promotes another owner from its Workspace console
   * first, or the account is suspended instead. It does not tell the operator to promote anyone, because
   * the platform console has no such action. It names nobody else.
   */
  | 'target-sole-owner'
  /**
   * The target's cached session blobs could not all be deleted, so the mutation was not attempted.
   *
   * The refusal is the whole point of the code. A ban, a session revocation and an administrative
   * password reset each delete the account's KV session blobs *before* they change anything, because
   * `findSession` answers from those blobs in preference to D1 and the snapshot inside one still
   * says `banned: false`. If a blob survives, the mutation would report success while the account
   * stayed signed in - and once the mutation has run, the D1 rows naming those tokens are gone and
   * nothing can reach them again. Refusing leaves the account exactly as it was found, with every
   * token still named in D1, so the operator can simply try again.
   */
  | 'sessions-still-cached'
  /**
   * The provider may not be set to refuse its own calls, whatever the form sent.
   *
   * `provider_registry.blockable` is an interlock rather than a preference, and this code is how it
   * reaches a reader. Blocking a provider whose feature has no fallback does not cap a cost, it
   * stops the feature: blocking `polar` stops checkout, so it stops revenue in order to protect a
   * number *about* revenue. The refusal lives in the mutation rather than in a greyed control, so
   * it holds however the mutation is reached — a stale tab, a replayed request, a second operator —
   * and the screen renders this beside the control that produced it.
   *
   * The way forward the message names is a ceiling with `allow`: the console will still warn at the
   * thresholds and the meter still counts, which is the whole of what an unblockable provider can
   * be given.
   */
  | 'provider-not-blockable'

/**
 * A console action refusing its target.
 *
 * `status` is `409 Conflict` for every code: the request was well-formed and the operator was
 * authorised, and the state of the target is what refused it. A `404` would leak whether an id
 * exists to anyone who can reach the console — which is only ever a platform `admin`, so the leak
 * is not the reason; the reason is that a screen showing a row it just listed should not be told
 * the row is missing when what happened is that somebody else deleted it a second ago.
 */
export class ConsoleActionError extends Error {
  readonly code: ConsoleRefusalCode
  readonly status = 409

  constructor(code: ConsoleRefusalCode, message: string) {
    super(message)
    this.name = 'ConsoleActionError'
    this.code = code
  }
}

/**
 * A console action stopped because a fact its audit row must carry could not be established.
 *
 * Not a {@link ConsoleActionError}, and the difference is the whole reason it is a second class.
 * That one is a `409` about the *target's state* - the operator may act and this account cannot
 * receive it - and its codes are a closed vocabulary a screen renders as advice about the target.
 * This is a `500`: the operator may act, the target is fine, and the dependency did not answer. No
 * code, because there is nothing for a screen to branch on; the only honest instruction is to try
 * again, and it is in the message.
 *
 * It exists for one caller. The impersonation exit writes the *operator's* platform role into
 * `platform_audit_log.actor_role` as a value, and the read behind it can fail. Every failure used to
 * arrive as `null`, and `resolvePlatformRole(null)` is `'user'` - so a failed read was written into
 * the ledger as a fact about an operator who must have held `admin`, indistinguishable from a plain
 * account and unrecoverable, because docs/ACCESS.md §4.1 makes `actor_role` a value precisely so
 * nothing can re-derive it later. Refusing the action and raising at `error` is the cheaper failure.
 */
export class ConsoleUnattributableError extends Error {
  readonly status = 500

  constructor(message: string) {
    super(message)
    this.name = 'ConsoleUnattributableError'
  }
}

/* ---------------------------------------------------- reading Better Auth's own refusals */

/**
 * Better Auth's `APIError` read structurally rather than by `instanceof`.
 *
 * The class lives behind a subpath of a dependency whose surface this directory otherwise touches
 * only through `auth.api`, and an `instanceof` across a bundler boundary is exactly the check that
 * starts failing silently after a version bump duplicates a module. The two properties read below
 * are the ones the plugin sets on every refusal it raises: `status` is the HTTP status *name*, and
 * `body.code` is the machine code — `BANNED_USER`, `YOU_CANNOT_IMPERSONATE_ADMINS`.
 *
 * Message text is never matched. It is copy, it is localisable, and it changes.
 */
export function authErrorCode(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null || !('body' in cause)) {
    return null
  }
  const body: unknown = cause.body
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return null
  }
  return typeof body.code === 'string' ? body.code : null
}

/** True for Better Auth's `NOT_FOUND` and for nothing else — never for a transport failure. */
export function isAuthNotFound(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    cause.status === 'NOT_FOUND'
  )
}
