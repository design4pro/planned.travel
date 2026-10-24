/**
 * Impersonation, both halves.
 *
 * Impersonation's entire effect is `Set-Cookie`. `auth.api.impersonateUser` writes six of them — it
 * expires the current session cookie, its signed data companion and the remember-me marker, sets a
 * signed `admin_session` cookie carrying the operator's own token, then sets the impersonated
 * session cookie and its marker — and returns a JSON body that says nothing about any of it. Six
 * rather than the three the endpoint's source reads like is a measurement against
 * `better-auth@1.7.1`, taken in `__tests__/console.test.ts`, and it is the reason the merge is one
 * array rather than a hand-written trio. An in-process `auth.api` call drops response headers unless it is
 * asked for them, so both functions here pass `returnHeaders: true` and hand the result to
 * {@link forwardAuthCookies}, which merges every value onto this server function's own response
 * with `getSetCookie()`. A call that omitted either half would report success, change nothing, and
 * read as a dependency bug (docs/ACCESS.md §2.6).
 *
 * **Both halves, and the second one is the one that gets forgotten.**
 * `/admin/stop-impersonating` is closed with the other fourteen paths, so
 * {@link endImpersonationFn} is the only way out of an impersonated session that exists —
 * §6.1's **End impersonation** button calls it, and there is no fallback behind it. It is written
 * and tested with the same care as its opposite for that reason, and it is the one function here
 * whose audit row is appended *before* the plugin call, because §6.1 and §2.6 both specify that
 * order for the exit by name.
 *
 * **The exit's name is frozen.** docs/ACCESS.md §6.1 names the button and the function together as
 * `endImpersonation`, and the app shell's **End impersonation** control is wired against it, so the
 * code moved to the document rather than the other way round. The `Fn` suffix is this directory's
 * universal convention for a `createServerFn` export — its opposite is `startImpersonationFn` — and
 * `endImpersonation` is the action the document names. Anything that renames this back to
 * `stopImpersonating`, matching the plugin endpoint behind it, breaks the shell.
 *
 * **Why a banned target is refused here rather than left to the plugin.** `impersonateUser` creates
 * a session, and the `admin` plugin's `session.create.before` hook rejects a banned user with
 * `FORBIDDEN` carrying `bannedUserMessage`. That message is our own repo copy — and it is written
 * *for the banned user*, in the second person, to be read on a login screen. Shown to an operator it
 * says their account is suspended, which is both false and alarming. So the ban and the
 * admin-on-admin case are both checked before the call, and {@link refineImpersonationFailure}
 * catches the same two afterwards: the pre-check is what an operator sees, and the refinement is
 * what covers the account that was banned in the second between the read and the call.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { resolvePlatformRole } from '#/server/auth/access'
import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import { platformApi } from './bindings'
import {
  openConsoleCall,
  openImpersonationExit,
  recordConsoleAction,
} from './context'
import { forwardAuthCookies } from './cookies'
import { ConsoleActionError, authErrorCode, isAuthNotFound } from './errors'
import { platformUserSchema } from './projections'
import { readTargetUser, refuseSelfTarget } from './target'

export const startImpersonationInputSchema = z.object({
  userId: z.string().trim().min(1).max(64),
})

/**
 * Nothing, strictly.
 *
 * The session cookie and the signed `admin_session` cookie beside it are the whole of what
 * identifies the exit; a client that sends a target id is trying to end somebody else's
 * impersonation and is refused at the boundary rather than ignored.
 */
export const endImpersonationInputSchema = z.object({}).strict()

/**
 * The impersonated session, as the caller needs it.
 *
 * `expiresAt` is read back off the session the plugin actually minted rather than computed from a
 * constant here, so the countdown in the warning bar is showing the session's real remaining life
 * and not a second opinion about it. docs/ACCESS.md §6.2 pins that life at 900 seconds through the
 * plugin's `impersonationSessionDuration`; the plugin's own fallback is 3600, which is precisely why
 * this value is reported rather than assumed.
 */
export interface ImpersonationStarted {
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly expiresAt: string
}

const impersonationResultSchema = z.object({
  session: z.object({
    // The workspace `session.create.before` landed the new session in. Absent or empty reads as
    // none, so a body that omits it still parses and the row says `null` rather than failing.
    activeOrganizationId: z
      .string()
      .nullish()
      .transform((value) => (value ? value : null)),
    expiresAt: z
      .union([z.date(), z.string(), z.number()])
      .transform((value) => new Date(value))
      .refine(
        (value) => Number.isFinite(value.getTime()),
        'must be a real instant',
      ),
  }),
  user: platformUserSchema,
})

/**
 * Starts impersonating an account. `platform.user.impersonation_started`.
 *
 * `changes.after.organizationId` is the workspace the new session was landed in, an id and never a
 * name, `null` when it has none (docs/ACCESS.md §6.4). Later switches are
 * `platform.user.impersonation_workspace_changed`; the per-request fallback of `requireOrg` is not
 * recorded at all.
 *
 * The audit row is appended after the cookies are on the response, which is docs/ACCESS.md §4.3's
 * ordering applied to an action whose "row change" is a cookie: the swap has happened by then, so
 * the ledger cannot record an impersonation that did not begin.
 *
 * **The body is parsed before any of those cookies is forwarded**, and the order is not cosmetic.
 * TanStack merges the event's `Set-Cookie` values onto whatever response leaves the handler, an
 * error response included - so forwarding first and parsing second means a plugin body this schema
 * cannot read still swaps the browser into the impersonated session, while the screen reports a
 * failure and the ledger holds no `platform.user.impersonation_started` row for a session that is
 * live for the next fifteen minutes. Parsed first, that failure leaves the operator exactly where
 * they were: the plugin's own session row expires unused, no cookie moved, and §4.3's "audited
 * without exception" stays true because there was no impersonation to audit.
 */
export const startImpersonationFn = createServerFn({ method: 'POST' })
  .validator(startImpersonationInputSchema)
  .handler(async ({ data }): Promise<ImpersonationStarted> => {
    const call = await openConsoleCall({ user: ['impersonate'] })
    refuseSelfTarget(
      call,
      data.userId,
      'You are already signed in as yourself.',
    )

    const target = await readTargetUser(call, data.userId)

    // Refused here, before a session is minted, so the operator reads copy about the *target*.
    // Left to the plugin this arrives as `FORBIDDEN` carrying `bannedUserMessage`, which is our own
    // repo copy written in the second person for the banned account's own login screen.
    if (target.banned === true) {
      throw new ConsoleActionError(
        'target-banned',
        'That account is banned. Lift the ban before impersonating it.',
      )
    }

    // docs/ACCESS.md §2.4: `user:impersonate-admins` is granted to no role, ours included. The
    // plugin enforces it too; this is the half that produces a sentence naming the way out.
    if (resolvePlatformRole(target.role ?? null) === 'admin') {
      throw new ConsoleActionError(
        'target-is-admin',
        'Platform admins cannot be impersonated. Demote the account first, then restore its role.',
      )
    }

    const result = await platformApi()
      .impersonateUser({
        body: { userId: data.userId },
        headers: call.headers,
        returnHeaders: true,
      })
      .catch((cause: unknown) => {
        throw refineImpersonationFailure(cause)
      })

    // Parsed before a single cookie is forwarded. TanStack merges the event's `Set-Cookie` onto a
    // non-ok response too, so the reverse order lands the operator *inside* the impersonated session
    // while the screen reports the parse failure, with no `platform.user.impersonation_started` row
    // anywhere. Nothing below can reject: `forwardAuthCookies` is one `setResponseHeader`, and
    // `recordConsoleAction` never throws.
    const parsed = impersonationResultSchema.parse(result.response)
    const expiresAt = parsed.session.expiresAt
    const forwarded = forwardAuthCookies(result.headers)

    await recordConsoleAction(
      call,
      {
        action: PLATFORM_ACTIONS.USER_IMPERSONATION_STARTED,
        entityId: parsed.user.id,
        changes: {
          before: { impersonating: null },
          after: {
            impersonating: parsed.user.id,
            targetRole: resolvePlatformRole(parsed.user.role ?? null),
            organizationId: parsed.session.activeOrganizationId,
            expiresAt: expiresAt.toISOString(),
          },
        },
      },
      { cookiesForwarded: forwarded },
    )

    return {
      userId: parsed.user.id,
      name: parsed.user.name,
      email: parsed.user.email,
      expiresAt: expiresAt.toISOString(),
    }
  })

/**
 * Ends an impersonated session and restores the operator's own. `platform.user.impersonation_ended`.
 *
 * There is no input to validate beyond its absence — see {@link endImpersonationInputSchema}.
 *
 * **The append comes first**, which is docs/ACCESS.md §6.1 and §2.6 in the order both write it: the
 * End impersonation action "appends `platform.user.impersonation_ended` and then calls
 * `auth.api.stopImpersonating` in process". It is the one place in this directory where the entry
 * precedes the mutation, and the difference between the two orders is which failure the ledger
 * survives. Appending afterwards loses the entry for an exit that happened, and it loses it in the
 * exact circumstances an audit log is read afterwards; appending first can leave an entry for an
 * exit that then failed, which is a row a reader can reconcile against the impersonation that is
 * still live. §4.3 says these five verbs are audited without exception, and this order is what makes
 * that true of the half of the lifecycle nothing else can record.
 *
 * The residual risk is named rather than hidden: {@link openImpersonationExit} has already
 * established that this session *is* an impersonated one, so the only way the call below still fails
 * is a missing or unreadable signed `admin_session` cookie — a session that cannot be exited at all,
 * whose row then reads as the attempt it was. The actor was resolved before either step, so nothing
 * about the append depends on the session that is about to be swapped away.
 */
export const endImpersonationFn = createServerFn({ method: 'POST' })
  .validator(endImpersonationInputSchema)
  .handler(async (): Promise<{ userId: string }> => {
    const exit = await openImpersonationExit()

    await recordConsoleAction(exit, {
      action: PLATFORM_ACTIONS.USER_IMPERSONATION_ENDED,
      entityId: exit.targetUserId,
      changes: {
        before: { impersonating: exit.targetUserId },
        after: { impersonating: null },
      },
    })

    const result = await platformApi().stopImpersonating({
      headers: exit.headers,
      returnHeaders: true,
    })

    // Every cookie the plugin set, on our own response and separately — the whole effect of the
    // exit. Zero forwarded here would mean the operator stays inside the impersonated session with
    // a ledger row saying they left it, so the count is logged rather than discarded.
    const forwarded = forwardAuthCookies(result.headers)
    exit.logger.info('console impersonation exit cookies forwarded', {
      action: PLATFORM_ACTIONS.USER_IMPERSONATION_ENDED,
      entityId: exit.targetUserId,
      actorUserId: exit.actor.userId,
      cookiesForwarded: forwarded,
    })

    return { userId: exit.targetUserId }
  })

/**
 * Turns the plugin's two impersonation refusals into copy an operator can act on.
 *
 * `BANNED_USER` arrives from `session.create.before` and carries `bannedUserMessage`; the target
 * being an `admin` arrives from the plugin's own `adminRoles` check, which docs/ACCESS.md §2.4 keeps
 * in force by granting `user:impersonate-admins` to no role at all. Anything else is re-thrown
 * untouched — a refusal nobody has thought about is not improved by being renamed.
 */
function refineImpersonationFailure(cause: unknown): unknown {
  const code = authErrorCode(cause)
  if (code === 'BANNED_USER') {
    return new ConsoleActionError(
      'target-banned',
      'That account is banned. Lift the ban before impersonating it.',
    )
  }
  if (code === 'YOU_CANNOT_IMPERSONATE_ADMINS') {
    return new ConsoleActionError(
      'target-is-admin',
      'Platform admins cannot be impersonated. Demote the account first, then restore its role.',
    )
  }
  if (isAuthNotFound(cause)) {
    return new ConsoleActionError(
      'target-not-found',
      'That account no longer exists.',
    )
  }
  return cause
}
