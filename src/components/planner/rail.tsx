import * as React from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '#/lib/cn'
import {
  GlassPanel,
  IconButton,
  SectionLabel,
  transitionBase,
} from '#/components/ui'

export interface PlannerRailProps {
  /** Which edge of the map the rail is docked to. Decides the collapse glyph. */
  readonly side: 'left' | 'right'
  readonly label: string
  /** A count or short fact beside the label. Rendered with tabular numerals. */
  readonly meta?: React.ReactNode
  readonly collapsed: boolean
  readonly onCollapsedChange: (next: boolean) => void
  /** Controls that belong above the scrolling body — a search field, a button. */
  readonly toolbar?: React.ReactNode
  readonly footer?: React.ReactNode
  /** Positioning is the screen's job; the rail only knows how to look. */
  readonly className?: string
  readonly children: React.ReactNode
}

/**
 * A floating rail over the map.
 *
 * Collapsible for one specific reason: the map is the point of this screen, and two
 * 22rem rails over a 1280px viewport leave a 30rem window to read it through. So
 * either rail folds to a labelled tab, and the screen tells the camera about it —
 * `fitBounds` padding shrinks with the rail, which is what stops a pin from hiding
 * behind glass the moment the reader collapses a panel.
 *
 * Collapsed it is still a labelled control carrying its own count, so folding a rail
 * never costs the reader the information that it is there or how much is in it. The
 * label is written along the tab with `writing-mode`, not rotated with a transform,
 * so it stays selectable and keeps its baseline.
 *
 * A rail with a `footer` also gets a fold, which is two halves of one measurement:
 * the scrolling body reserves `--rail-fold` at its end so the last row always scrolls
 * clear of the summary card, and the card carries a fade of exactly that height above
 * its hairline, so a row crossing the bottom edge mid-list reads as a list that
 * continues rather than as a row cut in half. Scrolled to the end — or on a list too
 * short to scroll — the fade covers the reserved space, which is empty, and is
 * therefore invisible.
 */
/**
 * The fold's height, published once as a custom property.
 *
 * The spacer and the fade have to be the same height or the fade lands over a row
 * that has nowhere to scroll to, so neither of them is allowed its own number.
 */
type RailVars = React.CSSProperties & Record<'--rail-fold', string>
const RAIL_VARS: RailVars = { '--rail-fold': 'var(--space-6)' }

export function PlannerRail({
  side,
  label,
  meta,
  collapsed,
  onCollapsedChange,
  toolbar,
  footer,
  className,
  children,
}: PlannerRailProps) {
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  if (collapsed) {
    return (
      <GlassPanel
        radius="xl"
        padding="none"
        className={cn('flex w-11 flex-col items-center py-2', className)}
      >
        <IconButton
          icon={<CollapseIcon className={side === 'right' ? 'rotate-180' : ''} />}
          label={`Show the ${label.toLowerCase()} panel`}
          size="sm"
          variant="ghost"
          onClick={() => onCollapsedChange(false)}
        />
        <span
          className={cn(
            'mt-2 flex min-h-0 flex-1 items-center justify-center gap-2',
            'text-micro font-semibold uppercase tracking-label text-ink-3',
          )}
          // Written along the tab rather than transformed, so the glyphs keep
          // their baseline and the text stays selectable.
          style={{ writingMode: 'vertical-rl' }}
        >
          {label}
          {meta === undefined ? null : (
            <span className="tabular-nums text-ink-4">{meta}</span>
          )}
        </span>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel
      radius="xl"
      padding="none"
      style={RAIL_VARS}
      className={cn('flex flex-col overflow-hidden', className)}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-glass-edge px-3 py-2.5">
        <SectionLabel as="h2" className="min-w-0 flex-1">
          {label}
        </SectionLabel>
        {meta === undefined ? null : (
          <span className="shrink-0 text-caption font-medium tabular-nums text-ink-3">
            {meta}
          </span>
        )}
        <IconButton
          icon={<CollapseIcon className={side === 'right' ? 'rotate-180' : ''} />}
          label={`Hide the ${label.toLowerCase()} panel`}
          size="xs"
          variant="ghost"
          onClick={() => onCollapsedChange(true)}
        />
      </div>

      {toolbar === undefined ? null : (
        <div className="shrink-0 border-b border-glass-edge px-3 py-2.5">
          {toolbar}
        </div>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pt-2',
          footer === undefined && 'pb-2',
          transitionBase,
        )}
      >
        {children}

        {/* Half one of the fold: the clearance the last row needs to scroll fully
            past the summary card. `shrink-0` because an empty flex item in a
            scrolling column is the first thing flexbox collapses. */}
        {footer === undefined ? null : (
          <div
            aria-hidden="true"
            data-rail-fold=""
            className="h-(--rail-fold) shrink-0"
          />
        )}
      </div>

      {footer === undefined ? null : (
        <div className="relative shrink-0 border-t border-glass-edge px-3 py-2.5">
          {/* Half two: the fade over that clearance. Drawn from the card rather
              than from inside the scroller, so it sits at the fold in every scroll
              position — over the row crossing the edge mid-list, over the reserved
              space at the end, and over nothing at all on a short list. */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-full',
              'h-(--rail-fold) bg-linear-to-t from-glass to-transparent',
            )}
          />
          {footer}
        </div>
      )}
    </GlassPanel>
  )
}
