/**
 * Everything a day's footer offers, beyond the note control `DaySection` draws itself.
 *
 * The screen mounts this through `DaySection`'s `dayTools` slot, so a later stage that
 * gives a day another footer control adds it here rather than queueing for
 * `plan-screen.tsx` or the planner component.
 */

import { BedDouble, MapPin } from 'lucide-react'

import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { focusRing, transitionBase } from '#/components/ui'

import type { LucideIcon } from 'lucide-react'
import type { PlannerDay } from '#/components/planner'

export interface PlannerDayToolsProps {
  readonly day: PlannerDay
  /** Opens the place form with this day preset. */
  readonly onAddPlace: (dayId: string) => void
  /** Opens the booking desk's stay dialog with this day as the first night. */
  readonly onAddStay: (dayId: string) => void
}

export function PlannerDayTools({
  day,
  onAddPlace,
  onAddStay,
}: PlannerDayToolsProps) {
  const t = useTranslate()

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      <DayTool
        icon={MapPin}
        label={t('trips.plan.addPlace.forDay')}
        name={t('trips.plan.addPlace.forDayNamed', { day: day.title })}
        onClick={() => onAddPlace(day.dayId)}
      />
      <DayTool
        icon={BedDouble}
        label={t('trips.plan.day.addStayShort')}
        name={t('trips.plan.day.addStay', { day: day.title })}
        onClick={() => onAddStay(day.dayId)}
      />
    </div>
  )
}

/**
 * One footer control. Ten days are ten of each, so the accessible `name` says which
 * day it acts on while the visible `label` stays short — the note control's own pattern.
 */
function DayTool({
  icon: Icon,
  label,
  name,
  onClick,
}: {
  readonly icon: LucideIcon
  readonly label: string
  readonly name: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 rounded-md',
        'border border-dashed border-edge bg-surface-2 px-3 py-2',
        'text-caption text-ink-3',
        transitionBase,
        focusRing,
        'hover:border-edge-strong hover:bg-hover hover:text-ink-2',
      )}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}
