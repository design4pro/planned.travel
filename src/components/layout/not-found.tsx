import { Link } from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import { cn } from '#/lib/cn'
import { Wordmark } from './brand'
import { Panel, SectionLabel, buttonClass } from './kit'

/**
 * In-app "nothing here" surface. Keeps the person inside the product with two
 * routes onward rather than dead-ending them on a apology.
 */
export function NotFoundPanel({ className }: { className?: string }) {
  return (
    <Panel className={cn('flex flex-col items-center gap-5 px-6 py-14 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        <Compass aria-hidden className="size-5" />
      </span>
      <div className="space-y-2">
        <SectionLabel>Error 404</SectionLabel>
        <h2 className="font-display text-title text-ink">This page is not on the map</h2>
        <p className="mx-auto max-w-md text-label leading-relaxed text-ink-3">
          The link may be out of date, or the trip it pointed at was moved or deleted.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link to="/dashboard" className={buttonClass({ variant: 'primary' })}>
          Back to dashboard
        </Link>
        <Link to="/trips" className={buttonClass({ variant: 'secondary' })}>
          All trips
        </Link>
      </div>
    </Panel>
  )
}

/**
 * Root-level 404, reachable by anonymous visitors, so every route out of it is
 * public. The oversized numeral is the same display treatment the product uses
 * for its own statistics — the error page still looks like the product.
 */
export function RootNotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-canvas px-4 py-8 sm:px-8">
      <Link to="/" aria-label="planned.travel home" className="w-fit rounded-md focus-ring">
        <Wordmark />
      </Link>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 py-12 text-center">
        <p
          aria-hidden
          className="numeral font-display text-[clamp(5rem,22vw,11rem)] font-extrabold leading-[0.85] tracking-tighter text-ink"
        >
          404
        </p>
        <div className="space-y-3">
          <h1 className="font-display text-title text-ink sm:text-display">
            This page is not on the map
          </h1>
          <p className="mx-auto max-w-lg text-body leading-relaxed text-ink-3">
            We looked everywhere along the route. The address may be mistyped, or the page has
            since moved on.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/" className={buttonClass({ variant: 'primary', size: 'lg' })}>
            Back to home
          </Link>
          <Link to="/pricing" className={buttonClass({ variant: 'secondary', size: 'lg' })}>
            See the plans
          </Link>
        </div>
      </div>
    </div>
  )
}
