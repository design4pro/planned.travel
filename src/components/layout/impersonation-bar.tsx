import { useCallback, useEffect, useRef, useState } from 'react'
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

import type { RefObject } from 'react'
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
 *   visual order the same thing. An open modal is the one state that could still
 *   take it away — see {@link useReachableThroughModals}, which is why it does
 *   not.
 * - **It cannot be dismissed.** There is no close control anywhere in this file.
 *   A dismissible warning about a live credential for somebody else's account is
 *   a warning that will be dismissed.
 * - **It says who, and who by.** Below `sm` the two names are stacked and each
 *   owns a whole line of the identity column, so neither is competing with the
 *   other for width and neither is truncated until its own name alone overruns
 *   the column — which at 360px is around thirty characters each. From `sm` the
 *   column is wide enough for one line and they share it, shrinking in
 *   proportion, with no ceiling on either: a short account name hands its slack
 *   to a long operator name instead of holding it back. Two earlier shapes both
 *   failed the same width. One truncating line put the names in competition and
 *   the operator, being last, lost it outright; capping the operator at half the
 *   row stopped it vanishing but left the account's unused slack stranded, so a
 *   long operator name was still clipped with 29px of the row empty beside it.
 *   Whoever is acting is named at every width the design system claims.
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
 * The chord that reaches the exit from inside a modal's focus trap.
 *
 * Read from `event.code` rather than `event.key` so it is the same physical key
 * on every layout, and so macOS — where Option+Shift+E is a dead key that
 * composes an accent — cannot turn it into a character instead of a command. It
 * is published to assistive technology as `aria-keyshortcuts` on the button
 * itself, which is the attribute WAI-ARIA defines for exactly this and which
 * costs the bar no pixels it would then have to find at 360px.
 */
const EXIT_SHORTCUT = 'Alt+Shift+E'

/**
 * What keeps the exit reachable while a Radix dialog is open.
 *
 * A modal is a focus trap by definition, and the three mechanisms Radix uses to
 * build one each take the End impersonation control away in a different way:
 *
 * - **Assistive technology.** `DialogContent` calls `hideOthers()` from
 *   `aria-hidden`, which marks every element outside the panel `aria-hidden`.
 *   That function exempts anything matching `[aria-live]`, so the bar declares
 *   `aria-live="off"` — which is also the truth about it: nothing here should be
 *   announced on change, least of all a countdown that ticks every second.
 * - **Pointer.** `DismissableLayer` sets `pointer-events: none` on `<body>`
 *   while a modal layer is open. The bar re-enables its own, and its band is
 *   above `--z-modal`, so a click lands on it rather than on the overlay.
 * - **Keyboard.** `FocusScope` listens for `focusin` and `focusout` on
 *   `document` and pulls focus straight back inside the panel. Both listeners
 *   are registered in the bubble phase; the two below are registered in the
 *   capture phase on the same node, so they run first and stop the event dead
 *   whenever the element gaining or keeping focus is inside this bar. That makes
 *   focus *stay* here; {@link EXIT_SHORTCUT} is how it gets here, because the
 *   scope's own `Tab` handling loops within the panel and can never leave it.
 *
 * Narrow on purpose: it exempts one element — the bar — and only ever suppresses
 * an event whose target is inside it, so every other focus trap in the product
 * keeps behaving exactly as it did.
 */
function useReachableThroughModals(
  bar: RefObject<HTMLDivElement | null>,
  exit: RefObject<HTMLButtonElement | null>,
): void {
  useEffect(() => {
    const inBar = (node: EventTarget | null): boolean =>
      node instanceof Node && bar.current !== null && bar.current.contains(node)

    const holdFocus = (event: FocusEvent): void => {
      const landing =
        event.type === 'focusin' ? event.target : event.relatedTarget
      if (inBar(landing)) {
        event.stopImmediatePropagation()
      }
    }

    const reachExit = (event: KeyboardEvent): void => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
        return
      }
      if (event.code !== 'KeyE' || exit.current === null) return
      event.preventDefault()
      event.stopImmediatePropagation()
      exit.current.focus()
    }

    document.addEventListener('focusin', holdFocus, true)
    document.addEventListener('focusout', holdFocus, true)
    document.addEventListener('keydown', reachExit, true)
    return () => {
      document.removeEventListener('focusin', holdFocus, true)
      document.removeEventListener('focusout', holdFocus, true)
      document.removeEventListener('keydown', reachExit, true)
    }
  }, [bar, exit])
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
  const barRef = useRef<HTMLDivElement | null>(null)
  const exitRef = useRef<HTMLButtonElement | null>(null)
  useReachableThroughModals(barRef, exitRef)

  const end = useCallback(async (): Promise<void> => {
    setEnding(true)

    // One `await` per outcome, because the operator is told what happened
    // rather than what the last statement did. Everything after this line runs
    // on a session that is already the operator's own again: reporting a
    // refreshed router's failure as "could not end impersonation" would tell
    // somebody holding their own credential that they are still holding
    // somebody else's, which is the more dangerous of the two wrong answers.
    try {
      await endImpersonationFn({ data: {} })
    } catch (cause) {
      setEnding(false)
      toast.error('Could not end impersonation', {
        description: describeExitFailure(cause),
      })
      return
    }

    try {
      // The cookie has been swapped back to the operator's own session, but the
      // router still holds every loader result resolved for the account that was
      // being impersonated. Throwing them away before navigating is what stops
      // the shell rendering the previous person's data behind a correct cookie.
      await router.invalidate()
      await router.navigate({ to: '/dashboard', replace: true })
      toast.success('Impersonation ended', {
        description: 'You are signed in as yourself again.',
      })
    } catch {
      toast.success('Impersonation ended', {
        description:
          'You are signed in as yourself again. Reload the page to clear the screens that were loaded for the other account.',
      })
    }
  }, [router])

  const operatorName = operator.name ?? operator.email ?? operator.id
  const expired = remaining !== null && remaining <= 0

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Impersonated session"
      // Not an announcement — a countdown that ticks every second must never be
      // one. It is here because `aria-hidden`'s `hideOthers()`, which every
      // Radix modal calls, exempts `[aria-live]` from being hidden, and this bar
      // is the one thing on the page a modal may not take away.
      aria-live="off"
      data-motion-transform
      className={cn(
        'sticky top-0 z-impersonation animate-rise',
        // Radix sets `pointer-events: none` on `<body>` while a modal layer is
        // open. The band above `--z-modal` puts the bar over the overlay; this
        // is what lets the click land.
        'pointer-events-auto',
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
          {/* A line each where the column is narrow, one shared line where it is
              not. Below `sm` the column is about 190px at 360px — too little for
              two names to share without one of them losing, and a ceiling on
              either share only moves which one loses while leaving the other's
              slack stranded. Stacked, each name has the whole column and clips
              only against its own length. From `sm` there is room for one line,
              and both spans shrink from their content width with no ceiling, so
              free space always goes to whichever name needs it. */}
          <p className="flex min-w-0 flex-col text-caption text-ink sm:flex-row sm:items-baseline sm:gap-1">
            <span className="min-w-0 truncate font-semibold">
              <span className="hidden sm:inline">Acting as </span>
              {session.user.name}
              <span className="hidden font-normal text-ink-2 lg:inline">
                {' '}
                ({session.user.email})
              </span>
            </span>
            <span className="min-w-0 truncate text-ink-2">
              <span aria-hidden className="hidden sm:inline">
                ·{' '}
              </span>
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
          ref={exitRef}
          variant="primary"
          size="sm"
          shape="pill"
          loading={ending}
          loadingLabel="Ending impersonation"
          aria-label="End impersonation"
          aria-keyshortcuts={EXIT_SHORTCUT}
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
