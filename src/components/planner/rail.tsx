import * as React from 'react'
import { PanelLeftClose, PanelLeftOpen, Minus, Plus } from 'lucide-react'

import { useTranslate } from '#/lib/i18n'
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
  readonly resize?: {
    readonly width: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly label: string
    readonly onChange: (width: number) => void
  }
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
  resize,
}: PlannerRailProps) {
  const t = useTranslate()
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  if (collapsed) {
    return (
      <GlassPanel
        radius="xl"
        padding="none"
        className={cn('flex w-11 flex-col items-center py-2', className)}
      >
        <IconButton
          icon={
            <CollapseIcon className={side === 'right' ? 'rotate-180' : ''} />
          }
          label={t('trips.plan.workspace.showPanel', { label })}
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
      {resize === undefined ? null : <RailResize side={side} resize={resize} />}
      <div className="flex shrink-0 items-center gap-2 border-b border-glass-edge px-3 py-2.5">
        <SectionLabel as="h2" className="min-w-0 flex-1">
          {label}
        </SectionLabel>
        {meta === undefined ? null : (
          <span className="shrink-0 text-caption font-medium tabular-nums text-ink-3">
            {meta}
          </span>
        )}
        {resize === undefined ? null : (
          <>
            <IconButton
              icon={<Minus />}
              size="sm"
              variant="ghost"
              label={t('trips.plan.workspace.narrowPanel', { label })}
              disabled={resize.width <= resize.min}
              onClick={() =>
                resize.onChange(
                  Math.max(resize.min, resize.width - resize.step),
                )
              }
            />
            <IconButton
              icon={<Plus />}
              size="sm"
              variant="ghost"
              label={t('trips.plan.workspace.widenPanel', { label })}
              disabled={resize.width >= resize.max}
              onClick={() =>
                resize.onChange(
                  Math.min(resize.max, resize.width + resize.step),
                )
              }
            />
          </>
        )}
        <IconButton
          icon={
            <CollapseIcon className={side === 'right' ? 'rotate-180' : ''} />
          }
          label={t('trips.plan.workspace.hidePanel', { label })}
          size="sm"
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

function RailResize({
  side,
  resize,
}: {
  readonly side: 'left' | 'right'
  readonly resize: NonNullable<PlannerRailProps['resize']>
}) {
  const drag = React.useRef<{ x: number; width: number } | null>(null)
  const change = (width: number) =>
    resize.onChange(Math.max(resize.min, Math.min(resize.max, width)))
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={resize.label}
      aria-orientation="vertical"
      aria-valuenow={resize.width}
      aria-valuemin={resize.min}
      aria-valuemax={resize.max}
      className={cn(
        'absolute inset-y-0 z-10 flex w-2 touch-none cursor-col-resize items-center justify-center hover:bg-hover focus-visible:bg-brand/25 focus-visible:outline-2 focus-visible:outline-brand',
        side === 'left' ? 'end-0' : 'start-0',
      )}
      onKeyDown={(event) => {
        let next: number
        if (event.key === 'Home') next = resize.min
        else if (event.key === 'End') next = resize.max
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const rtl =
            getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
          next =
            resize.width +
            direction * rtl * (side === 'left' ? 1 : -1) * resize.step
        } else return
        event.preventDefault()
        change(next)
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, width: resize.width }
      }}
      onPointerMove={(event) => {
        if (drag.current === null) return
        const rtl =
          getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
        change(
          drag.current.width +
            (event.clientX - drag.current.x) * rtl * (side === 'left' ? 1 : -1),
        )
      }}
      onPointerUp={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onLostPointerCapture={() => {
        drag.current = null
      }}
    >
      <span
        aria-hidden="true"
        className="h-10 w-1 rounded-full bg-edge-strong"
      />
    </div>
  )
}
