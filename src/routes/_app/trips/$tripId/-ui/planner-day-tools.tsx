/**
 * Everything a day's footer offers, beyond the note control `DaySection` draws itself.
 *
 * The screen mounts this through `DaySection`'s `dayTools` slot, so a later stage that
 * gives a day another footer control adds it here rather than queueing for
 * `plan-screen.tsx` or the planner component.
 */

import {
  BedDouble,
  ExternalLink,
  MapPin,
  Navigation,
  Route,
} from 'lucide-react'

import { cn } from '#/lib/cn'
import { MAP_SERVICE_NAME, dayHandoffs } from '#/lib/geo/handoff'
import { useTranslate } from '#/lib/i18n'
import { focusRing, transitionBase } from '#/components/ui'

import type { LucideIcon } from 'lucide-react'
import type { PlannerDay } from '#/components/planner'
import type { DayHandoff } from '#/lib/geo/handoff'

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
  const handoffs = dayHandoffs(day.items)

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      <DayTool
        icon={MapPin}
        label={t('trips.plan.addPlace.label')}
        name={t('trips.plan.addPlace.forDayNamed', { day: day.title })}
        onClick={() => onAddPlace(day.dayId)}
      />
      <DayTool
        icon={BedDouble}
        label={t('trips.plan.day.addStayShort')}
        name={t('trips.plan.day.addStay', { day: day.title })}
        onClick={() => onAddStay(day.dayId)}
      />
      <DayHandoffLinks day={day} handoffs={handoffs} />
    </div>
  )
}

/** The read-only footer shares the editor's link and its partial-day note. */
export function PlannerDayHandoff({ day }: { readonly day: PlannerDay }) {
  const handoffs = dayHandoffs(day.items)
  if (handoffs.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      <DayHandoffLinks day={day} handoffs={handoffs} />
    </div>
  )
}

/**
 * One link per side of a flight, ferry or train, numbered "Part n of count" when there is more
 * than one; a single link keeps the plain copy, so a day no journey splits reads as before.
 */
function DayHandoffLinks({
  day,
  handoffs,
}: {
  readonly day: PlannerDay
  readonly handoffs: ReadonlyArray<DayHandoff>
}) {
  return handoffs.map((handoff, index) => (
    <DayHandoffLink
      key={index}
      day={day}
      handoff={handoff}
      part={
        handoffs.length > 1 ? { n: index + 1, count: handoffs.length } : null
      }
    />
  ))
}

/**
 * The day's way out to a map application: directions through its placed stops in visiting
 * order, or a point link when only one is placed. A day over the link's waypoint limit says
 * so in visible text and in the name, because a link that dropped stops quietly would hand
 * the traveller a route that skips part of their day.
 */
function DayHandoffLink({
  day,
  handoff,
  part,
}: {
  readonly day: PlannerDay
  readonly handoff: DayHandoff
  /** Which of the day's links this is, or `null` when the day offers just one. */
  readonly part: { readonly n: number; readonly count: number } | null
}) {
  const t = useTranslate()
  const service = MAP_SERVICE_NAME.google
  const counts = { carried: handoff.carried, total: handoff.total }
  const partial =
    handoff.kind === 'directions' && handoff.carried < handoff.total
  const partLine = part === null ? [] : [t('trips.plan.handoff.day.part', part)]
  const named = { service, day: day.title }

  if (handoff.kind === 'point') {
    return (
      <DayLink
        icon={Navigation}
        href={handoff.href}
        label={t('trips.plan.handoff.day.point', { service })}
        notes={partLine}
        name={
          part === null
            ? t('trips.plan.handoff.day.pointName', named)
            : t('trips.plan.handoff.day.pointPartName', { ...named, ...part })
        }
      />
    )
  }

  return (
    <DayLink
      icon={Route}
      href={handoff.href}
      label={t('trips.plan.handoff.day.directions', { service })}
      notes={
        partial
          ? [...partLine, t('trips.plan.handoff.day.directionsPartial', counts)]
          : partLine
      }
      name={directionsName(t, named, part, partial ? counts : null)}
    />
  )
}

/** The accessible name of a directions link: a full catalogue sentence per combination. */
function directionsName(
  t: ReturnType<typeof useTranslate>,
  named: { readonly service: string; readonly day: string },
  part: { readonly n: number; readonly count: number } | null,
  counts: { readonly carried: number; readonly total: number } | null,
): string {
  if (part === null) {
    return counts === null
      ? t('trips.plan.handoff.day.directionsName', named)
      : t('trips.plan.handoff.day.directionsPartialName', {
          ...named,
          ...counts,
        })
  }
  return counts === null
    ? t('trips.plan.handoff.day.directionsPartName', { ...named, ...part })
    : t('trips.plan.handoff.day.directionsPartialPartName', {
        ...named,
        ...part,
        ...counts,
      })
}

const DAY_TOOL_CLASS = cn(
  'flex w-full justify-center gap-1.5 rounded-md',
  'border border-dashed border-edge bg-surface-2 px-3 py-2',
  'text-caption text-ink-3',
  transitionBase,
  focusRing,
  'hover:border-edge-strong hover:bg-hover hover:text-ink-2 active:bg-active',
)

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
      className={cn(DAY_TOOL_CLASS, 'items-center')}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}

/**
 * A footer control that leaves the app: the same look as {@link DayTool}, a real anchor
 * that opens a new tab without sending the trip's URL as a referrer. `notes` are further
 * visible lines for what the label cannot carry, and part of `name`.
 */
function DayLink({
  icon: Icon,
  href,
  label,
  notes,
  name,
}: {
  readonly icon: LucideIcon
  readonly href: string
  readonly label: string
  readonly notes: ReadonlyArray<string>
  readonly name: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={name}
      className={cn(DAY_TOOL_CLASS, 'flex-col items-center')}
    >
      <span className="flex items-center gap-1.5">
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
        {label}
        <ExternalLink
          size={10}
          strokeWidth={2}
          aria-hidden="true"
          data-mirror-rtl
        />
      </span>
      {notes.map((note) => (
        <span key={note} className="text-micro text-ink-3">
          {note}
        </span>
      ))}
    </a>
  )
}
