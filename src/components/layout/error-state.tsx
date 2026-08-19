import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { cn } from '#/lib/cn'
import { Wordmark } from './brand'
import { ActionButton, Panel, buttonClass } from './kit'

import type { ErrorComponentProps } from '@tanstack/react-router'

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return 'The request failed before it could finish.'
}

export interface ErrorPanelProps {
  error: unknown
  /** Called instead of a router invalidation when the panel owns the retry. */
  onRetry?: () => void
  title?: string
  className?: string
}

/**
 * The recoverable error surface. It always offers a way forward — retry the
 * same route, or leave for a page that is known to work — and it shows the real
 * message rather than a shrug, because a person reporting a bug needs it.
 */
export function ErrorPanel({
  error,
  onRetry,
  title = 'This did not load',
  className,
}: ErrorPanelProps) {
  const router = useRouter()

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
        <h2 className="font-display text-subtitle text-ink">{title}</h2>
        <p className="mx-auto max-w-md text-label leading-relaxed text-ink-3">
          Nothing was lost. Try again, and if it keeps happening the detail below is what to send
          us.
        </p>
      </div>
      <p className="max-w-lg break-words rounded-md bg-surface-2 px-3 py-2 font-mono text-caption text-ink-2">
        {messageOf(error)}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <ActionButton onClick={retry}>
          <RotateCw aria-hidden className="size-4" />
          Try again
        </ActionButton>
        <Link to="/dashboard" className={buttonClass({ variant: 'secondary' })}>
          Back to dashboard
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
  return (
    <div className="flex min-h-svh flex-col bg-canvas px-4 py-8">
      <Link to="/" aria-label="planned.travel home" className="w-fit rounded-md focus-ring">
        <Wordmark />
      </Link>
      <div className="flex flex-1 items-center justify-center py-10">
        <ErrorPanel
          error={error}
          onRetry={reset}
          title="Something went off route"
          className="w-full max-w-xl"
        />
      </div>
    </div>
  )
}
