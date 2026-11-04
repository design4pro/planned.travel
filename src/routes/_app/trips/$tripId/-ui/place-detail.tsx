import * as React from 'react'
import { X } from 'lucide-react'
import { MarkerPopover } from '#/components/map/marker-popover'
import { GlassPanel, IconButton } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import type { PlannerCategory, PlannerRow } from '#/components/planner/types'

/** Place reading belongs to the detail slot, including unlocated or filtered Places. */
export function PlaceDetail({
  place,
  category,
  compact,
  controls,
  panelRef,
  blockedEscape,
  onClose,
}: {
  readonly place: PlannerRow
  readonly category?: PlannerCategory
  readonly compact: boolean
  readonly controls: React.ReactNode
  readonly panelRef: React.RefObject<HTMLDivElement | null>
  readonly blockedEscape: boolean
  readonly onClose: () => void
}) {
  const t = useTranslate()
  const heading = React.useId()
  return (
    <GlassPanel
      ref={panelRef}
      role="region"
      aria-labelledby={heading}
      data-place-detail={place.placeId}
      padding="none"
      className={cn(
        'absolute z-30 mx-auto flex max-h-1/2 max-w-3xl flex-col overflow-hidden rounded-2xl',
        compact
          ? 'start-3 end-(--plan-controls-clearance) bottom-3'
          : 'inset-x-3 bottom-(--plan-bar) lg:start-[calc(var(--plan-left)+2rem)] lg:end-(--plan-controls-clearance) lg:bottom-4',
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || blockedEscape)
          return
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(
            '[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
          )
        )
          return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-glass-edge px-3 py-2',
          compact && 'gap-1 py-1',
        )}
      >
        <h2
          id={heading}
          tabIndex={-1}
          className="min-w-0 flex-1 line-clamp-2 text-label font-semibold text-ink"
        >
          {place.name}
        </h2>
        {controls}
        <IconButton
          label={t('atlas.overlay.close', { name: place.name })}
          icon={<X />}
          onClick={onClose}
        />
      </header>
      <div
        role="group"
        aria-labelledby={heading}
        tabIndex={0}
        className="min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <MarkerPopover
          placeId={place.placeId}
          name={place.name}
          showName={false}
          category={category}
          address={place.location}
          rating={place.rating}
          imageUrl={place.imageUrl}
          photo={place.photo}
          side={null}
          className="w-full max-w-none rounded-none border-0 shadow-none"
        />
      </div>
    </GlassPanel>
  )
}
