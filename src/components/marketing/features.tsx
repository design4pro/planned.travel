import {
  CalendarDays,
  Check,
  Coins,
  Compass,
  Globe,
  ListChecks,
  Map,
  Paperclip,
  Ticket,
  Users,
} from 'lucide-react'

import { Card, SectionLabel } from '#/components/ui'
import { cn } from '#/lib/cn'
import { Section, SectionIntro } from './section'
import { CostsVisual, PlannerVisual, ReservationsVisual } from './visuals'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* --------------------------------------------------------------- spotlights */

type Spotlight = {
  readonly id: string
  readonly eyebrow: string
  readonly icon: LucideIcon
  readonly title: string
  readonly lede: string
  readonly points: ReadonlyArray<string>
  readonly visual: () => ReactNode
  /** Puts the illustration on the left on wide screens. */
  readonly mirrored?: boolean
  readonly tone?: 'canvas' | 'tint'
}

const SPOTLIGHTS: ReadonlyArray<Spotlight> = [
  {
    id: 'planner',
    eyebrow: 'Plan',
    icon: Map,
    title: 'A day-by-day plan drawn on a real map',
    lede: 'Collect the places you want to see, then drag them onto a day. The map redraws the route as you go, so you can see immediately when a morning has you crossing the city twice.',
    points: [
      'One column per day, with its date, its weather and the place you are sleeping.',
      'Places you have not scheduled wait in their own column until they have a day.',
      'On Crew, everyone drags at once — live cursors, instant sync, no refresh.',
      'Vector tiles served from our own storage, so no map vendor is watching you plan.',
    ],
    visual: PlannerVisual,
  },
  {
    id: 'costs',
    eyebrow: 'Costs',
    icon: Coins,
    title: 'Shared costs that actually settle',
    lede: 'Log what you spend in the trip’s own currency, split each expense the way you actually agreed, and see the shortest set of transfers that clears the whole thing.',
    points: [
      'Split evenly, by share, or by exact amount — per expense, not per trip.',
      'Everything converted into one trip currency so the total means something.',
      'The settle-up view names who pays whom, and logs the transfer once it happens.',
      'Attach the receipt to the expense, so the number always has its evidence.',
    ],
    visual: CostsVisual,
    mirrored: true,
    tone: 'tint',
  },
  {
    id: 'reservations',
    eyebrow: 'Book',
    icon: Ticket,
    title: 'Every booking, with the code you need at the door',
    lede: 'Stays, tables, tours and tickets in one list, next to the flights, trains and ferries that get you between them — each with its confirmation number and the day it belongs to.',
    points: [
      'Transport legs carry the seat, the platform, the terminal and the booking code.',
      'A booking is attached to a day, so it shows up in the plan without retyping.',
      'Requested, confirmed and cancelled are separate states, not a note in a field.',
      'Export the whole trip as a PDF itinerary or a calendar file before you fly.',
    ],
    visual: ReservationsVisual,
  },
]

function SpotlightPoints({ points }: { points: ReadonlyArray<string> }) {
  return (
    <ul className="mt-7 flex flex-col gap-3.5">
      {points.map((point) => (
        <li key={point} className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="min-w-0 text-label leading-relaxed text-ink-2">
            {point}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SpotlightBand({ spotlight }: { spotlight: Spotlight }) {
  const Visual = spotlight.visual
  const headingId = `${spotlight.id}-heading`

  return (
    <Section
      id={spotlight.id}
      tone={spotlight.tone ?? 'canvas'}
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div
          className={cn(
            'min-w-0',
            spotlight.mirrored ? 'lg:order-2' : undefined,
          )}
        >
          <SectionLabel icon={<spotlight.icon />}>
            {spotlight.eyebrow}
          </SectionLabel>
          <h2
            id={headingId}
            className="mt-3 font-display text-title font-extrabold tracking-tighter text-balance text-ink sm:text-display"
          >
            {spotlight.title}
          </h2>
          <p className="mt-4 text-body leading-relaxed text-pretty text-ink-2">
            {spotlight.lede}
          </p>
          <SpotlightPoints points={spotlight.points} />
        </div>

        <div
          className={cn(
            'min-w-0',
            spotlight.mirrored ? 'lg:order-1' : undefined,
          )}
        >
          <Visual />
        </div>
      </div>
    </Section>
  )
}

/** The three modules that earn a full band and an illustration of their own. */
export function FeatureSpotlights() {
  return (
    <>
      {SPOTLIGHTS.map((spotlight) => (
        <SpotlightBand key={spotlight.id} spotlight={spotlight} />
      ))}
    </>
  )
}

/* --------------------------------------------------------------- module grid */

type Module = {
  readonly icon: LucideIcon
  readonly name: string
  readonly benefit: string
  readonly detail: string
}

const MODULES: ReadonlyArray<Module> = [
  {
    icon: ListChecks,
    name: 'Lists',
    benefit: 'Nobody arrives without the adapter.',
    detail:
      'Packing, to-dos, shopping and documents — one list per job, shared with everyone travelling and ticked off as it happens.',
  },
  {
    icon: Compass,
    name: 'Journal',
    benefit: 'The trip becomes a story, not a folder.',
    detail:
      'Entries in date order with the photographs you took, where you were, the weather, and how the day actually felt.',
  },
  {
    icon: Globe,
    name: 'Atlas',
    benefit: 'One map of everywhere you have been.',
    detail:
      'Mark a country visited and it joins your world map, with the first visit, the most recent, and how many times you have been back.',
  },
  {
    icon: CalendarDays,
    name: 'Vacay',
    benefit: 'Book the leave before you book the flight.',
    detail:
      'Mark the days you are away and the year fills in — weekends, public holidays and everyone else’s time off in the same grid.',
  },
  {
    icon: Users,
    name: 'Collab',
    benefit: 'The decisions stay with the trip.',
    detail:
      'One thread per trip, shared notes for the things everyone must remember, and a poll for when the group cannot agree on dinner.',
  },
  {
    icon: Paperclip,
    name: 'Files',
    benefit: 'Boarding passes where you can find them.',
    detail:
      'Confirmations, tickets, insurance documents and receipts attached to the trip they belong to, not buried in an inbox.',
  },
]

/** The rest of the product, in a grid: name, the benefit, then the mechanism. */
export function ModuleGrid() {
  return (
    <Section
      id="modules"
      tone="tint"
      aria-labelledby="modules-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="modules-heading"
        eyebrow="Every module"
        title="The rest of the trip, handled"
        lede="Each module does one job properly and hands its work to the others. Nothing here is a placeholder tab waiting for a future release."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {MODULES.map((module) => (
          <li key={module.name} className="min-w-0">
            <Card padding="lg" className="flex h-full flex-col gap-3">
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-subtle text-ink [&_svg]:size-4.5"
              >
                <module.icon />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-subtitle font-bold tracking-tight text-ink">
                  {module.name}
                </h3>
                <p className="mt-1 text-label font-semibold text-brand">
                  {module.benefit}
                </p>
              </div>
              <p className="text-caption leading-relaxed text-ink-2">
                {module.detail}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}
