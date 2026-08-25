import * as React from 'react'
import { Hourglass, MapPinned, MonitorX, RefreshCw } from 'lucide-react'

import { cn } from '#/lib/cn'
import { FALLBACK_ATTRIBUTION } from '#/lib/map/style'
import { Button, GlassPanel, SectionLabel } from '#/components/ui'
import { useAtlasCopy } from './copy'
import { MapCreditList } from './map-attribution'

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
 * working — the bundled outlines still draw the world's land and coastlines, the
 * camera moves, every pin sits at its true coordinate — and this panel says so
 * plainly instead of leaving the reader to interpret a map with no street detail.
 * Announced politely, because it appears after first paint.
 *
 * It also carries the credit for the outlines it is explaining, rather than
 * leaving that to a second floating pill. Both want the same bottom-centre lane —
 * the only edge of a map that no rail, no filter bar and no control column
 * claims — and a screen is free to move its credit into it, which the planner
 * does to lift the credit clear of the mobile action bar. Two independently
 * positioned elements in one lane is a collision waiting for a viewport width to
 * happen at: the pill ends up behind the panel with a few pixels of itself
 * showing, which is worse than either alone. One panel, one credit, no stacking
 * order to get wrong. See `MapAttribution`, which stands down for exactly as long
 * as this panel is up.
 */
export const BasemapNotice = React.forwardRef<
  HTMLDivElement,
  BasemapNoticeProps
>(({ className, onRetry, retrying = false, ...props }, ref) => {
  const t = useAtlasCopy()

  return (
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
        //
        // `w-max` is what makes the width the panel's own rather than whatever is
        // left of the container to the right of its centre line: a shrink-to-fit
        // box anchored at `left-1/2` can never exceed half the map, which on a
        // phone turned four lines of copy into seven in a column half as wide as
        // it was designed for.
        'absolute bottom-4 left-1/2 z-map-overlay w-max max-w-[min(18rem,calc(100%-2rem))]',
        '-translate-x-1/2 animate-overlay-in',
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
          <SectionLabel as="h2">{t('atlas.map.basemap.title')}</SectionLabel>
          <p className="mt-1 text-caption text-ink-2">
            {t('atlas.map.basemap.body')}
          </p>
          {/* What the reader is actually looking at, named where they are already
            reading about it. Quiet — a data credit is not the message — but a
            real link, with the same hover, focus and underline treatment it has
            in the pill. */}
          <p className="mt-2 text-caption text-ink-3">
            {t('atlas.map.basemap.credit')}{' '}
            <MapCreditList credits={FALLBACK_ATTRIBUTION} />
          </p>
          {onRetry ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ms-2"
              icon={<RefreshCw size={14} strokeWidth={2} />}
              loading={retrying}
              loadingLabel={t('atlas.map.basemap.retrying')}
              onClick={onRetry}
            >
              {t('atlas.map.basemap.retry')}
            </Button>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  )
})
BasemapNotice.displayName = 'BasemapNotice'

/** Which renderer failure the notice is explaining. */
export type MapEngineFailure = 'unsupported' | 'stalled'

/**
 * What each failure looks like, minus its words.
 *
 * The tone and the glyph are design decisions and stay in the table; the title
 * and the body are copy and live in `messages/en/atlas.ts` under
 * `map.engine.<reason>.*`, so the two failures read in the reader's language
 * without either one growing a branch here.
 */
const ENGINE_MARKS: Readonly<
  Record<
    MapEngineFailure,
    { readonly tone: string; readonly icon: React.ReactNode }
  >
> = {
  unsupported: {
    tone: 'bg-warning-soft text-warning',
    icon: <MonitorX size={14} strokeWidth={2} />,
  },
  stalled: {
    tone: 'bg-info-soft text-info',
    icon: <Hourglass size={14} strokeWidth={2} />,
  },
}

/** The two keys each failure carries, named once so they cannot drift. */
const ENGINE_KEYS = {
  unsupported: {
    title: 'atlas.map.engine.unsupported.title',
    body: 'atlas.map.engine.unsupported.body',
  },
  stalled: {
    title: 'atlas.map.engine.stalled.title',
    body: 'atlas.map.engine.stalled.body',
  },
} as const

export interface MapEngineNoticeProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> {
  readonly reason: MapEngineFailure
}

/**
 * The designed "nothing will ever be drawn here" state.
 *
 * Distinct from {@link BasemapNotice}, which explains a missing *archive* on a
 * map that is otherwise working perfectly. This one explains a missing
 * *renderer*: no WebGL2 context, or a canvas that never drew a frame. The two
 * look identical to a reader staring at an empty rectangle and have nothing else
 * in common, so they say different things — and this one replaces the loading
 * spinner rather than joining it, because a spinner that never stops is a lie.
 *
 * Centred, because there is no map content for it to sit out of the way of.
 */
export const MapEngineNotice = React.forwardRef<
  HTMLDivElement,
  MapEngineNoticeProps
>(({ reason, className, ...props }, ref) => {
  const t = useAtlasCopy()
  const mark = ENGINE_MARKS[reason]
  const keys = ENGINE_KEYS[reason]

  return (
    <GlassPanel
      ref={ref}
      radius="lg"
      padding="sm"
      role="status"
      aria-live="polite"
      className={cn(
        'absolute top-1/2 left-1/2 z-map-overlay w-max max-w-[min(20rem,calc(100%-2rem))]',
        '-translate-x-1/2 -translate-y-1/2 animate-overlay-in',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
            mark.tone,
          )}
          aria-hidden="true"
        >
          {mark.icon}
        </span>
        <div className="min-w-0">
          <SectionLabel as="h2">{t(keys.title)}</SectionLabel>
          <p className="mt-1 text-caption text-ink-2">{t(keys.body)}</p>
        </div>
      </div>
    </GlassPanel>
  )
})
MapEngineNotice.displayName = 'MapEngineNotice'
