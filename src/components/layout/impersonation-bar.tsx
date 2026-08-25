import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { TimerReset, UserRoundCog } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui'
import { parseInstant, pluralise } from '#/lib/format'
import { cn } from '#/lib/cn'
// `endImpersonation` is the name `docs/ACCESS.md` §6.1 gives this function — it
// names the button and the function together — carrying the repository's uniform
// `Fn` suffix for a server function. There is no fallback behind it: §2.6 answers
// the plugin's own `/admin/stop-impersonating` with 404, so this is the only exit
// from an impersonated session that exists.
import { endImpersonationFn } from '#/server/fns/console/impersonation'

import type { ShellImpersonator, ShellSession } from './session'

/**
 * The persistent warning that this session is not the operator's own.
 *
 * `docs/ACCESS.md` §6.1 makes four things hard requirements and each one is a
 * decision in the markup below rather than a preference:
 *
 * - **It is on every screen under `/_app`.** Rendered by `AppShell`, which is
 *   the only wrapper with a session in scope, so no route can omit the bar and
 *   no route can scroll it away. It is first in the shell's DOM, which is what
 *   makes the End button the first tab stop and keeps the reading order and the
 *   visual order the same thing.
 * - **It cannot be dismissed.** There is no close control anywhere in this file.
 *   A dismissible warning about a live credential for somebody else's account is
 *   a warning that will be dismissed.
 * - **It says who, and who by.** The account being acted on and the operator
 *   acting share one row, and each holds its own share of it: the account takes
 *   the space the operator does not need, and the operator can never be given
 *   less than half. A single truncating line put both names in competition and
 *   the operator, being last, lost — at 360px it disappeared entirely, which is
 *   the one question the bar exists to answer. Neither name can now be truncated
 *   away, at any width from 360px up; the surrounding words shorten instead.
 * - **It counts down.** The remaining life comes from the session's own
 *   `expiresAt` rather than from §6.2's 900-second constant, so a session the
 *   plugin minted with a different duration is described honestly.
 *
 * The bar occupies `--impersonation-h`, which is `0rem` everywhere else in the
 * product: the shell root raises it, every chrome offset composes it, and a
 * screen with no bar therefore keeps exactly the geometry it had.
 *
 * Measured on `--color-warning-soft`, light / dark:
 *   ink 16.23 / 14.80 · ink-2 9.94 / 10.79 · warning 5.52 / 7.20 ·
 *   danger 5.51 / 5.75 (the expired countdown)
 * The glyph tile is `warning-on` on `warning` at 6.33 / 8.23, and the button is
 * `accent-on` on `accent` at 18.60 / 17.21. Every pair clears WCAG 2.2 AA for
 * normal text in both themes.
 */
export interface ImpersonationBarProps {
  session: ShellSession
}

/** One second, in milliseconds. */
const TICK = 1_000

/**
 * `mm:ss`, always five characters, so a tabular slot never re-measures — and
 * `h:mm:ss` above the hour, which our own 900-second sessions never reach but a
 * session minted elsewhere might.
 */
function formatRemaining(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const tail = `${pad(minutes)}:${pad(clamped % 60)}`
  return hours > 0 ? `${hours}:${tail}` : tail
}

/** The same duration as a sentence, for a screen reader that lands on it. */
function speakRemaining(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  if (clamped === 0) {
    return 'This impersonated session has expired'
  }
  const minutes = Math.floor(clamped / 60)
  if (minutes === 0) {
    return `${pluralise(clamped, 'second')} remaining`
  }
  return `${pluralise(minutes, 'minute')} remaining`
}

/**
 * Seconds left on the session, or `null` until the client has mounted.
 *
 * `null` on the server *and* on the first client render, deliberately: a clock
 * read during server rendering and read again during hydration cannot produce
 * the same string, and the difference is a hydration warning on a page that owes
 * zero of them. The slot it renders into has a fixed width, so filling it costs
 * no layout shift.
 *
 * It is called from {@link ImpersonatedSessionBar} and therefore only ever runs
 * on a session that actually has a bar. A hook cannot be conditional, so a
 * countdown installed in the outer component would have put a one-second
 * interval and a `setState` per tick on every authenticated page of every
 * ordinary session — which is all of them but a handful.
 */
function useRemainingSeconds(expiresAt: string): number | null {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const deadline = parseInstant(expiresAt)
    if (deadline === null) {
      setRemaining(null)
      return
    }

    const read = (): void => {
      setRemaining(Math.max(0, (deadline.getTime() - Date.now()) / 1000))
    }

    read()
    const timer = setInterval(read, TICK)
    return () => {
      clearInterval(timer)
    }
  }, [expiresAt])

  return remaining
}

/**
 * The refusal code a console server function carries, read structurally.
 *
 * `ConsoleActionError` is thrown on the server and arrives here across the
 * serialization boundary, so `instanceof` is meaningless and the class is not
 * imported — reading the one field the type promises is both cheaper and honest
 * about what actually survives the trip.
 */
function refusalCode(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return null
  }
  return typeof cause.code === 'string' ? cause.code : null
}

/**
 * What to tell an operator whose exit failed.
 *
 * Never `cause.message`. The exit's own failures are Better Auth's — the plugin
 * answers a missing signed `admin_session` cookie with an internal 500 whose
 * text describes its own lookup — and an operator holding somebody else's live
 * credential needs an instruction, not a stack-trace fragment. Its opposite,
 * `refineImpersonationFailure` in `src/server/fns/console/impersonation.ts`,
 * refines the entry the same way and for the same reason.
 */
function describeExitFailure(cause: unknown): string {
  switch (refusalCode(cause)) {
    case 'not-impersonating':
      return 'This session is already your own. Reload the page and the bar will be gone.'
    default:
      return 'You are still signed in as this account. Reload the page and try again. If it refuses twice, sign out to end the session.'
  }
}

export function ImpersonationBar({ session }: ImpersonationBarProps) {
  const operator = session.impersonatedBy

  // Everything below this line — the countdown's interval among it — belongs to
  // a session that has a bar. See `useRemainingSeconds`.
  if (operator === null) {
    return null
  }

  return <ImpersonatedSessionBar session={session} operator={operator} />
}

interface ImpersonatedSessionBarProps {
  session: ShellSession
  operator: ShellImpersonator
}

function ImpersonatedSessionBar({
  session,
  operator,
}: ImpersonatedSessionBarProps) {
  const router = useRouter()
  const [ending, setEnding] = useState(false)
  const remaining = useRemainingSeconds(session.expiresAt)

  const end = useCallback(async (): Promise<void> => {
    setEnding(true)
    try {
      await endImpersonationFn({ data: {} })
      // The cookie has been swapped back to the operator's own session, but the
      // router still holds every loader result resolved for the account that was
      // being impersonated. Throwing them away before navigating is what stops
      // the shell rendering the previous person's data behind a correct cookie.
      await router.invalidate()
      await router.navigate({ to: '/dashboard', replace: true })
      toast.success('Impersonation ended', {
        description: 'You are signed in as yourself again.',
      })
    } catch (cause) {
      setEnding(false)
      toast.error('Could not end impersonation', {
        description: describeExitFailure(cause),
      })
    }
  }, [router])

  const operatorName = operator.name ?? operator.email ?? operator.id
  const expired = remaining !== null && remaining <= 0

  return (
    <div
      role="region"
      aria-label="Impersonated session"
      data-motion-transform
      className={cn(
        'sticky top-0 z-impersonation animate-rise',
        'border-b border-warning/45 bg-warning-soft pt-safe',
      )}
    >
      {/* The row is the token less the hairline above, so the bar's whole
          border box measures exactly `--impersonation-h` and every offset that
          composes the token needs one term rather than two. Safe here and
          nowhere else: this element only exists while the token is non-zero. */}
      <div className="mx-auto flex h-[calc(var(--impersonation-h)-1px)] max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span
          aria-hidden
          className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-warning text-warning-on shadow-card sm:flex"
        >
          <UserRoundCog className="size-4" strokeWidth={2.25} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="text-micro uppercase text-warning">
            Impersonated session
          </span>
          {/* Two shares of one row rather than one line both names compete for.
              The account shrinks and the operator does not, so a long account
              name shortens itself rather than pushing the operator out; the
              operator's own ceiling is half the row, so it can never take the
              account's place either. Neither span grows, which keeps the two
              names beside each other instead of at opposite ends of a 1440px
              bar. */}
          <p className="flex min-w-0 items-baseline gap-1 text-caption text-ink">
            <span className="min-w-0 shrink truncate font-semibold">
              <span className="hidden sm:inline">Acting as </span>
              {session.user.name}
              <span className="hidden font-normal text-ink-2 lg:inline">
                {' '}
                ({session.user.email})
              </span>
            </span>
            <span className="min-w-0 max-w-[50%] shrink-0 truncate text-ink-2">
              <span aria-hidden>· </span>
              <span className="hidden sm:inline">started by </span>
              <span className="sm:hidden">by </span>
              {operatorName}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The label names the figure from `md` up; below it the glyph does,
              so five digits beside a button are never read as a clock time. */}
          <TimerReset
            aria-hidden
            className={cn(
              'size-3.5 md:hidden',
              expired ? 'text-danger' : 'text-ink-2',
            )}
          />
          <span className="hidden text-micro uppercase text-ink-2 md:inline">
            {expired ? 'Expired' : 'Ends in'}
          </span>
          <span
            role="timer"
            aria-label={
              remaining === null ? undefined : speakRemaining(remaining)
            }
            className={cn(
              'numeral min-w-12 text-right text-label font-semibold tracking-tight',
              expired ? 'text-danger' : 'text-ink',
            )}
          >
            {remaining === null ? '--:--' : formatRemaining(remaining)}
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          shape="pill"
          loading={ending}
          loadingLabel="Ending impersonation"
          aria-label="End impersonation"
          onClick={() => {
            void end()
          }}
        >
          <span className="sm:hidden">End</span>
          <span className="hidden sm:inline">End impersonation</span>
        </Button>
      </div>
    </div>
  )
}
