/**
 * Everything a day's footer offers, beyond the note control `DaySection` draws itself.
 *
 * The screen mounts this through `DaySection`'s `dayTools` slot, so a later stage that
 * gives a day another footer control adds it here rather than queueing for
 * `plan-screen.tsx` or the planner component.
 */

import { MapPin } from 'lucide-react'

import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { focusRing, transitionBase } from '#/components/ui'

import type { PlannerDay } from '#/components/planner'

export interface PlannerDayToolsProps {
  readonly day: PlannerDay
  /** Opens the place form with this day preset. */
  readonly onAddPlace: (dayId: string) => void
}

export function PlannerDayTools({ day, onAddPlace }: PlannerDayToolsProps) {
  const t = useTranslate()

  return (
    <div className="px-2 pb-2">
      <button
        type="button"
        onClick={() => onAddPlace(day.dayId)}
        // Ten days are ten of these, so the accessible name says which day it adds to
        // while the visible label stays short — the note control's own pattern.
        aria-label={t('trips.plan.addPlace.forDayNamed', { day: day.title })}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-md',
          'border border-dashed border-edge bg-surface-2 px-3 py-2',
          'text-caption text-ink-3',
          transitionBase,
          focusRing,
          'hover:border-edge-strong hover:bg-hover hover:text-ink-2',
        )}
      >
        <MapPin size={12} strokeWidth={2} aria-hidden="true" />
        {t('trips.plan.addPlace.forDay')}
      </button>
    </div>
  )
}
