import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { Wordmark } from './brand'
import { ActionButton, Panel, buttonClass } from './kit'

import type { Translate } from '#/lib/i18n'
import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * The technical detail, which is deliberately *not* translated.
 *
 * A thrown message is a diagnostic, and the person who reads it next is
 * whoever the reporter forwards it to. What is translated is the sentence
 * around it and the fallback for a throw that carried no message at all.
 */
function detailOf(error: unknown, t: Translate): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return t('shell.error.unknown')
}

export interface ErrorPanelProps {
  error: unknown
  /** Called instead of a router invalidation when the panel owns the retry. */
  onRetry?: () => void
  /** Already-translated heading. Defaults to the generic one. */
  title?: string
  className?: string
}

/**
 * The recoverable error surface. It always offers a way forward — retry the
 * same route, or leave for a page that is known to work — and it shows the real
 * message rather than a shrug, because a person reporting a bug needs it.
 */
export function ErrorPanel({ error, onRetry, title, className }: ErrorPanelProps) {
  const router = useRouter()
  const t = useTranslate()

  function retry(): void {
    if (onRetry) {
      onRetry()
      return
    }
    void router.invalidate()
  }

  return (
    <Panel className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert aria-hidden className="size-5" />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-subtitle text-ink">
          {title ?? t('shell.error.title')}
        </h2>
        <p className="mx-auto max-w-md text-label leading-relaxed text-ink-3">
          {t('shell.error.body')}
        </p>
      </div>
      {/* `code` keeps the detail left-to-right inside Arabic prose: the
          direction layer in `src/styles/styles.css` pins the run so a stack
          frame does not reorder around its punctuation. */}
      <code className="max-w-lg break-words rounded-md bg-surface-2 px-3 py-2 font-mono text-caption text-ink-2">
        {detailOf(error, t)}
      </code>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <ActionButton onClick={retry}>
          <RotateCw aria-hidden className="size-4" />
          {t('shell.error.retry')}
        </ActionButton>
        <Link to="/dashboard" className={buttonClass({ variant: 'secondary' })}>
          {t('shell.error.dashboard')}
        </Link>
      </div>
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
