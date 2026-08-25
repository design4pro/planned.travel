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

import type { ShellSession } from './session'

/**
 * The persistent warning that this session is not the operator's own.
 *
 * `docs/ACCESS.md` §6.1 makes four things hard requirements and each one is a
 * decision in the markup below rather than a preference:
 *
 * - **It is on every screen under `/_app`.** Rendered by `AppShell`, which is
 *   the only wrapper with a session in scope, so no route can omit it and no
 *   route can scroll it away. It is first in the shell's DOM, which is what
 *   makes the End button the first tab stop and keeps the reading order and the
 *   visual order the same thing.
 * - **It cannot be dismissed.** There is no close control anywhere in this file.
 *   A dismissible warning about a live credential for somebody else's account is
 *   a warning that will be dismissed.
 * - **It says who, and who by.** The account being acted on and the operator
 *   acting are both named at every width from 360px up; the copy shortens rather
 *   than dropping either of them.
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

export function ImpersonationBar({ session }: ImpersonationBarProps) {
  const router = useRouter()
  const [ending, setEnding] = useState(false)
  const operator = session.impersonatedBy
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
        description:
          cause instanceof Error && cause.message.length > 0
            ? cause.message
            : 'Reload the page and try again.',
      })
    }
  }, [router])

  if (operator === null) {
    return null
  }

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
          <p className="truncate text-caption text-ink">
            <span className="font-semibold">
              <span className="hidden sm:inline">Acting as </span>
              {session.user.name}
            </span>
            <span className="hidden text-ink-2 lg:inline">
              {' '}
              ({session.user.email})
            </span>
            <span className="text-ink-2">
              <span className="hidden sm:inline"> · started by </span>
              <span className="sm:hidden"> · by </span>
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
