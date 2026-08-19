import * as React from 'react'
import { Compass, X } from 'lucide-react'

import { cn } from '#/lib/cn'
import { GlassPanel, IconButton, SectionLabel } from '#/components/ui'

import type { CoverageReport } from '#/lib/map/coverage'

export interface CoverageNoticeProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  readonly coverage: CoverageReport
  /** Shows a dismiss button. A note on a map that cannot get out of the way is a nuisance. */
  readonly onDismiss?: () => void
}

/**
 * The designed "no street detail here" state.
 *
 * A tile archive is cut to a region, and the region it was cut to is a fact in
 * its header rather than something to be inferred from an empty screen. When a
 * trip falls outside it the map keeps every single thing that does not need
 * tiles — our own sea and coastlines, the pins at their true coordinates, the
 * day routes, the camera, the scale of the gaps between stops — and this panel
 * says plainly which one thing is missing.
 *
 * Nothing here is an error tone. Warning yellow would claim something is broken;
 * nothing is broken, the world is simply bigger than the archive. So it is the
 * quiet informational treatment, announced politely because it appears after
 * first paint.
 */
export const CoverageNotice = React.forwardRef<
  HTMLDivElement,
  CoverageNoticeProps
>(({ coverage, onDismiss, className, ...props }, ref) => {
  if (coverage.status !== 'outside' && coverage.status !== 'partial') {
    return null
  }

  const partial = coverage.status === 'partial'
  const places = coverage.outside === 1 ? 'place' : 'places'

  return (
    <GlassPanel
      ref={ref}
      radius="lg"
      padding="sm"
      role="status"
      aria-live="polite"
      className={cn(
        // Bottom-centre: the legend claims bottom-left, the controls and the
        // attribution bottom-right, the category filter top-centre. Faded in
        // rather than risen, because the centring translate and a transform
        // animation cannot share one element.
        'absolute bottom-4 left-1/2 z-dropdown w-max max-w-[min(22rem,calc(100%-2rem))]',
        '-translate-x-1/2 animate-overlay-in',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-info-soft text-info"
          aria-hidden="true"
        >
          <Compass size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <SectionLabel as="h2">
            {partial ? 'Partial street detail' : 'No street detail here'}
          </SectionLabel>
          <p className="mt-1 text-caption text-ink-2">
            {partial ? (
              <>
                The published map data stops short of{' '}
                <span className="font-semibold tabular-nums text-ink">
                  {coverage.outside}
                </span>{' '}
                of this trip&rsquo;s {places}. They are drawn at their real
                positions on our own coastlines.
              </>
            ) : (
              <>
                Streets are not published for this region yet. The coastlines,
                the pins and the routes between them are all real — only the
                buildings and roads are missing.
              </>
            )}
          </p>
        </div>
        {onDismiss ? (
          <IconButton
            icon={<X />}
            label="Dismiss the map coverage note"
            size="xs"
            variant="ghost"
            className="-mt-1 -mr-1 shrink-0"
            onClick={onDismiss}
          />
        ) : null}
      </div>
    </GlassPanel>
  )
})
CoverageNotice.displayName = 'CoverageNotice'
