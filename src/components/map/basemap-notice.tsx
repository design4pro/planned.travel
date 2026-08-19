import * as React from 'react'
import { MapPinned, RefreshCw } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Button, GlassPanel, SectionLabel } from '#/components/ui'

export interface BasemapNoticeProps extends React.ComponentPropsWithoutRef<'div'> {
  /** Re-probes the archive. Shows a spinner on the button while it runs. */
  onRetry?: () => void
  retrying?: boolean
}

/**
 * The designed "no basemap" state.
 *
 * The `.pmtiles` archive is a deploy artefact, not a repository asset, so it is
 * legitimately absent in local development and during a bad deploy. The map keeps
 * working — the graticule style renders, the camera moves, every pin sits at its
 * true coordinate — and this panel says so plainly instead of leaving the reader
 * to interpret an empty rectangle. Announced politely, because it appears after
 * first paint.
 */
export const BasemapNotice = React.forwardRef<
  HTMLDivElement,
  BasemapNoticeProps
>(({ className, onRetry, retrying = false, ...props }, ref) => (
  <GlassPanel
    ref={ref}
    radius="lg"
    padding="sm"
    role="status"
    aria-live="polite"
    className={cn(
      // Bottom-centre is the one edge nothing else claims: the legend sits
      // bottom-left, the controls and attribution bottom-right, the category
      // filter top-centre. Faded in rather than risen, because the centring
      // translate and a transform animation cannot share one element.
      'absolute bottom-4 left-1/2 z-dropdown max-w-72 -translate-x-1/2 animate-overlay-in',
      className,
    )}
    {...props}
  >
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-warning-soft text-warning"
        aria-hidden="true"
      >
        <MapPinned size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <SectionLabel as="h2">Basemap unavailable</SectionLabel>
        <p className="mt-1 text-caption text-ink-2">
          Street detail is offline. Every place is still shown at its real
          position, so distances and clusters remain accurate.
        </p>
        {onRetry ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2"
            icon={<RefreshCw size={14} strokeWidth={2} />}
            loading={retrying}
            loadingLabel="Checking for the basemap"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  </GlassPanel>
))
BasemapNotice.displayName = 'BasemapNotice'
