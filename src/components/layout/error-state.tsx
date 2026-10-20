import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '#/components/ui'
import { cn } from '#/lib/cn'
import { readPublicFailure } from '#/lib/errors'
import { useTranslate } from '#/lib/i18n'
import { Wordmark } from './brand'
import { Panel } from './kit'
import { FailureFeedback } from './failure-feedback'
import { shellStateOf } from './session'

import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * What a reader is told about a failure, beyond the heading.
 *
 * This used to return `error.message` - the thrown text, verbatim, in a monospace chip - on the
 * reasoning that a diagnostic is for whoever the reporter forwards it to. That was wrong in the
 * only case it mattered. The messages that actually reach here are not written for anybody: when
 * D1 failed, the reader was shown the query, and with it the shape of the database.
 *
 * So the split is now by *authorship*, decided on the server where the thrown value still has its
 * class (`src/server/errors/public.ts`). Copy written for this moment - a refusal, a validation
 * message naming the field to fix - is shown as itself. A diagnostic is withheld, and what takes
 * its place is the reference the server recorded it under, which is the part somebody reporting a
 * problem actually needs.
 */

/** Whether the browser half of the reporting was configured at build time. */
const REPORTING_ENABLED =
  typeof import.meta.env.VITE_SENTRY_DSN === 'string' &&
  import.meta.env.VITE_SENTRY_DSN.length > 0

export interface ErrorPanelProps {
  error: unknown
  /** Already-read prose and its provenance; the original error still owns reporting. */
  detail?: { readonly message: string; readonly authored: boolean }
  /** Called instead of a router invalidation when the panel owns the retry. */
  onRetry?: () => void
  /** Already-translated heading. Defaults to the generic one. */
  title?: string
  className?: string
}

/**
 * The recoverable error surface. It always offers a way forward — retry the
 * same route, or leave for a page that is known to work.
 *
 * Three kinds of failure land here. A *named* shell state — the two `SHELL_STATE_KEYS` the
 * authenticated shell throws when a session has no workspace or a membership has just been revoked
 * — and a *refusal or validation message* from the server are both authored copy that already
 * explains itself, so each is printed as prose and nothing else is offered. Setting a translated
 * sentence in a diagnostic face, beside a line telling the reader to forward what is below,
 * describes the product's own message as a fault.
 *
 * An *unexpected* throw gets the generic sentence, a line saying it has been reported, and the
 * reference it was reported under — never the thrown text, which is a diagnostic written for us.
 */
export function ErrorPanel({
  error,
  detail,
  onRetry,
  title,
  className,
}: ErrorPanelProps) {
  const router = useRouter()
  const t = useTranslate()
  const state = shellStateOf(error)
  const failure = readPublicFailure(error)

  let message: string | null = null
  let english = false
  if (state !== null) {
    message = t(state)
  } else if (detail !== undefined) {
    message = detail.message
    english = detail.authored
  } else if (failure.kind !== 'unexpected' && failure.message !== undefined) {
    message = failure.message
    english = true
  }
  // Display prose can be a console fallback; reporting still follows the original envelope.
  const unexpected = state === null && failure.kind === 'unexpected'

  function retry(): void {
    if (onRetry) {
      onRetry()
      return
    }
    void router.invalidate()
  }

  return (
    <Panel
      className={cn(
        'flex flex-col items-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert aria-hidden className="size-5" />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-subtitle text-ink">
          {state === null
            ? (title ?? t('shell.error.title'))
            : t('shell.error.session')}
        </h2>
        <p
          className="mx-auto max-w-md text-label leading-relaxed text-ink-3"
          lang={english ? 'en' : undefined}
          dir={english ? 'ltr' : undefined}
        >
          {message ?? t('shell.error.body')}
        </p>
        {unexpected ? (
          <p className="mx-auto max-w-md text-label leading-relaxed text-ink-3">
            {t('shell.error.reported')}
          </p>
        ) : null}
      </div>
      {unexpected && failure.reference !== undefined ? (
        /* `code` keeps the reference left-to-right inside Arabic prose: the
           direction layer in `src/styles/styles.css` pins the run so an
           identifier does not reorder around its punctuation. */
        <p className="text-caption text-ink-3">
          {t('shell.error.reference')}{' '}
          <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-ink-2">
            {failure.reference}
          </code>
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button shape="pill" onClick={retry} icon={<RotateCw aria-hidden />}>
          {t('shell.error.retry')}
        </Button>
        <Button asChild variant="secondary" shape="pill">
          <Link to="/dashboard">{t('shell.error.dashboard')}</Link>
        </Button>
      </div>
      {/* Only where the reference points at a real Sentry event: without a DSN it is a request id,
          and feedback would attach to nothing. */}
      {unexpected && failure.reference !== undefined && REPORTING_ENABLED ? (
        <FailureFeedback reference={failure.reference} />
      ) : null}
    </Panel>
  )
}

/**
 * Root-level boundary. It cannot assume the app chrome rendered, so it paints
 * its own full-page ground and its own wordmark.
 */
export function RootErrorBoundary({ error, reset }: ErrorComponentProps) {
  const t = useTranslate()

  return (
    <div className="flex min-h-svh flex-col bg-canvas px-4 py-8">
      <Link
        to="/"
        aria-label={t('shell.nav.homeLink')}
        className="w-fit rounded-md focus-ring"
      >
        <Wordmark />
      </Link>
      <div className="flex flex-1 items-center justify-center py-10">
        <ErrorPanel
          error={error}
          onRetry={reset}
          title={t('shell.error.root')}
          className="w-full max-w-xl"
        />
      </div>
    </div>
  )
}
