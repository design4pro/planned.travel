import {
  BedDouble,
  Camera,
  CheckCheck,
  Clock,
  GripVertical,
  Landmark,
  PlaneTakeoff,
  Ticket,
  TrainFront,
  Utensils,
} from 'lucide-react'

import { Avatar, Badge, Card, GlassPanel, SectionLabel } from '#/components/ui'
import { cn } from '#/lib/cn'

import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ mini map */

type Pin = { x: number; y: number; n: number }

const MAP_PINS: ReadonlyArray<Pin> = [
  { x: 46, y: 96, n: 1 },
  { x: 94, y: 66, n: 2 },
  { x: 150, y: 40, n: 3 },
  { x: 192, y: 24, n: 4 },
]

/**
 * A stylised city map drawn entirely from tokens, so it inverts with the theme
 * and stays crisp at any density — the honest alternative to a screenshot of a
 * map we would then have to keep in step with the real one.
 *
 * The route is dotted rather than solid: the same motif as the brand mark.
 */
export function MiniMap({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 140"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn('block size-full', className)}
    >
      <rect width="240" height="140" className="fill-surface-2" />

      {/* Water, bottom edge. */}
      <path
        d="M0 104C34 92 60 116 96 110c34-6 58 14 100 6 18-4 34 2 44-2v36H0Z"
        className="fill-surface-inset"
      />

      {/* Parkland. */}
      <path
        d="M152 16c22-6 46 4 48 24s-22 28-38 20-22-38-10-44Z"
        className="fill-success-soft"
      />
      <path
        d="M16 22c16-8 34 2 32 18s-22 20-32 10-12-22 0-28Z"
        className="fill-success-soft"
      />

      {/* Blocks. */}
      <g className="fill-surface-inset/70">
        <rect x="98" y="10" width="26" height="18" rx="3" />
        <rect x="98" y="34" width="18" height="14" rx="3" />
        <rect x="122" y="34" width="20" height="14" rx="3" />
        <rect x="24" y="70" width="24" height="16" rx="3" />
        <rect x="54" y="70" width="16" height="16" rx="3" />
        <rect x="196" y="60" width="26" height="18" rx="3" />
      </g>

      {/* Arterial roads. */}
      <g
        className="stroke-edge"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M-4 60h248" />
        <path d="M84-4v148" />
        <path d="M-4 28c62 4 98-12 150 2 46 12 66 4 98 10" />
        <path d="M172-4c-2 44 16 78 8 148" />
      </g>

      {/* Side streets. */}
      <g className="stroke-edge-faint" strokeWidth="1.5" fill="none">
        <path d="M-4 92h248" />
        <path d="M36-4v148" />
        <path d="M126-4v148" />
        <path d="M212-4v148" />
        <path d="M-4 120h248" />
      </g>

      {/* The planned route between the pinned places. */}
      <path
        d="M46 96c18-18 32-12 48-30s40-10 56-26c14-12 28-8 42-16"
        className="stroke-brand"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0.1 6"
        fill="none"
      />

      {MAP_PINS.map((pin) => (
        <g key={pin.n}>
          <circle cx={pin.x} cy={pin.y} r="9" className="fill-brand/18" />
          <circle
            cx={pin.x}
            cy={pin.y}
            r="6"
            className="fill-brand stroke-brand-on"
            strokeWidth="1.5"
          />
          <text
            x={pin.x}
            y={pin.y + 2.4}
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            className="fill-brand-on"
          >
            {pin.n}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------- shells */

/**
 * The frame for a map-backed illustration: a fixed aspect ratio, because the
 * map fills it and the panels floating over it are positioned against its edges.
 */
function VisualMedia({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative isolate aspect-[4/3] overflow-hidden rounded-xl',
        'border border-edge-faint shadow-elevated sm:aspect-[16/11]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * The frame for an illustration made of rows.
 *
 * Height comes from the content rather than an aspect ratio: a fixed ratio would
 * clip the last row on a narrow phone, and a clipped row reads as a bug rather
 * than as a design.
 */
function VisualPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative isolate flex flex-col gap-3 overflow-hidden rounded-xl',
        'border border-edge-faint bg-canvas p-4 shadow-elevated sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ planner */

const PLANNER_DAYS: ReadonlyArray<{
  day: number
  date: string
  stops: ReadonlyArray<{ name: string; time: string; icon: typeof Landmark }>
}> = [
  {
    day: 1,
    date: 'Sat 12 Apr',
    stops: [
      { name: 'Fushimi Inari', time: '07:00', icon: Landmark },
      { name: 'Nishiki market', time: '11:30', icon: Utensils },
    ],
  },
  {
    day: 2,
    date: 'Sun 13 Apr',
    stops: [
      { name: 'Arashiyama grove', time: '09:00', icon: Camera },
      { name: 'Riverside ryokan', time: '18:00', icon: BedDouble },
    ],
  },
]

/**
 * The planner: a glass itinerary rail floating over the real map, a category
 * filter bar, and an unplanned place mid-drag onto a day.
 */
export function PlannerVisual() {
  return (
    <VisualMedia>
      <MiniMap className="absolute inset-0" />

      <GlassPanel
        radius="lg"
        padding="none"
        floating={false}
        className="absolute inset-y-3 left-3 flex w-40 flex-col overflow-hidden sm:w-48"
      >
        <div className="flex items-center justify-between gap-2 border-b border-glass-edge px-3 py-2">
          <SectionLabel>Itinerary</SectionLabel>
          <span className="text-micro font-semibold tabular-nums text-ink-4">
            4 days
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          {PLANNER_DAYS.map((day) => (
            <div key={day.day} className="rounded-md bg-surface/70 p-2">
              <div className="flex items-baseline gap-1.5">
                <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-accent text-micro font-bold tabular-nums text-accent-on">
                  {day.day}
                </span>
                <span className="truncate text-micro font-semibold tracking-normal text-ink">
                  {day.date}
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {day.stops.map((stop) => (
                  <li key={stop.name} className="flex items-center gap-1.5">
                    <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-brand-subtle text-brand [&_svg]:size-2.5">
                      <stop.icon />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-micro font-medium tracking-normal text-ink-2">
                      {stop.name}
                    </span>
                    <span className="shrink-0 text-micro tabular-nums tracking-normal text-ink-4">
                      {stop.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel
        radius="full"
        padding="xs"
        floating={false}
        className="absolute top-3 left-1/2 hidden -translate-x-1/2 items-center gap-1 sm:flex"
      >
        {[Utensils, Landmark, Camera, BedDouble, Ticket].map((Icon, index) => (
          <span
            key={index}
            className={cn(
              'grid size-6 place-items-center rounded-full [&_svg]:size-3',
              index === 1 ? 'bg-accent text-accent-on' : 'text-ink-3',
            )}
          >
            <Icon />
          </span>
        ))}
      </GlassPanel>

      <GlassPanel
        radius="lg"
        padding="none"
        floating={false}
        className="absolute right-3 bottom-3 hidden w-36 rotate-2 sm:block"
      >
        <div className="flex items-center gap-1.5 px-2 py-2">
          <GripVertical aria-hidden className="size-3 shrink-0 text-ink-4" />
          <span className="min-w-0 flex-1 truncate text-micro font-semibold tracking-normal text-ink">
            Kiyomizu-dera
          </span>
        </div>
        <div className="border-t border-glass-edge px-2 py-1.5">
          <span className="text-micro tracking-normal text-ink-3">
            Drop on day 3
          </span>
        </div>
      </GlassPanel>
    </VisualMedia>
  )
}

/* -------------------------------------------------------------------- costs */

const EXPENSES: ReadonlyArray<{
  who: string
  what: string
  amount: string
  split: string
}> = [
  {
    who: 'Amelia',
    what: 'Riverside ryokan, 3 nights',
    amount: '$612.00',
    split: 'split 3 ways',
  },
  {
    who: 'Jonas',
    what: 'Rail passes',
    amount: '$284.40',
    split: 'split 3 ways',
  },
  {
    who: 'Priya',
    what: 'Kaiseki dinner',
    amount: '$168.00',
    split: 'split 2 ways',
  },
]

const SETTLEMENTS: ReadonlyArray<{ from: string; to: string; amount: string }> =
  [
    { from: 'Priya', to: 'Amelia', amount: '$120.80' },
    { from: 'Jonas', to: 'Amelia', amount: '$36.40' },
  ]

/** Shared costs: what was spent, how it split, and the two transfers that end it. */
export function CostsVisual() {
  return (
    <VisualPanel>
      <Card padding="none" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel>Trip total</SectionLabel>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className="font-display text-title font-extrabold tracking-tighter tabular-nums text-ink sm:text-display"
                data-numeric=""
              >
                $1,064
              </span>
              <span className="text-caption font-medium tabular-nums text-ink-3">
                .40
              </span>
            </p>
          </div>
          <Badge tone="success" size="sm" icon={<CheckCheck />}>
            2 transfers left
          </Badge>
        </div>
      </Card>

      <ul className="flex flex-col gap-2">
        {EXPENSES.map((expense) => (
          <li
            key={expense.what}
            className="flex items-center gap-2.5 rounded-md border border-edge-faint bg-surface px-3 py-2"
          >
            <Avatar name={expense.who} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-caption font-semibold text-ink">
                {expense.what}
              </span>
              <span className="block truncate text-micro tracking-normal text-ink-4">
                {expense.who} paid · {expense.split}
              </span>
            </span>
            <span className="shrink-0 text-caption font-semibold tabular-nums text-ink">
              {expense.amount}
            </span>
          </li>
        ))}
      </ul>

      <Card variant="inset" padding="none" className="p-3">
        <SectionLabel>Settle up</SectionLabel>
        <ul className="mt-2 flex flex-col gap-1.5">
          {SETTLEMENTS.map((transfer) => (
            <li
              key={`${transfer.from}-${transfer.to}`}
              className="flex items-center gap-2 text-micro tracking-normal"
            >
              <span className="font-semibold text-ink">{transfer.from}</span>
              <span aria-hidden className="text-ink-4">
                &rarr;
              </span>
              <span className="font-semibold text-ink">{transfer.to}</span>
              <span className="ml-auto font-semibold tabular-nums text-brand">
                {transfer.amount}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </VisualPanel>
  )
}

/* ------------------------------------------------------------- reservations */

const BOOKINGS: ReadonlyArray<{
  icon: typeof PlaneTakeoff
  title: string
  meta: string
  code: string
  tone: 'success' | 'warning'
  status: string
}> = [
  {
    icon: PlaneTakeoff,
    title: 'Flight to Osaka',
    meta: 'Fri 11 Apr · 21:40 · seat 32A',
    code: 'QK4T9P',
    tone: 'success',
    status: 'Confirmed',
  },
  {
    icon: BedDouble,
    title: 'Riverside ryokan',
    meta: '12–15 Apr · 3 nights · 2 rooms',
    code: 'RY-88410',
    tone: 'success',
    status: 'Confirmed',
  },
  {
    icon: TrainFront,
    title: 'Bullet train to Tokyo',
    meta: 'Tue 15 Apr · 08:12 · car 7',
    code: 'JR-2201',
    tone: 'success',
    status: 'Confirmed',
  },
  {
    icon: Ticket,
    title: 'Tea ceremony, two places',
    meta: 'Wed 16 Apr · 14:00',
    code: 'Awaiting reply',
    tone: 'warning',
    status: 'Requested',
  },
]

/** Reservations: every confirmation code where you can reach it at the door. */
export function ReservationsVisual() {
  return (
    <VisualPanel>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel icon={<Clock />}>Next up</SectionLabel>
        <span className="text-micro font-semibold tabular-nums tracking-normal text-ink-4">
          4 of 9
        </span>
      </div>

      <ol className="relative flex flex-col gap-2">
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-4 w-px bg-edge"
        />
        {BOOKINGS.map((booking) => (
          <li key={booking.title} className="relative flex gap-3">
            <span className="relative z-10 mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-edge-faint bg-surface text-ink-2 shadow-card [&_svg]:size-3.5">
              <booking.icon />
            </span>
            <Card padding="none" className="min-w-0 flex-1 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-caption font-semibold text-ink">
                    {booking.title}
                  </span>
                  <span className="block truncate text-micro tabular-nums tracking-normal text-ink-4">
                    {booking.meta}
                  </span>
                </span>
                <Badge tone={booking.tone} size="sm" dot>
                  {booking.status}
                </Badge>
              </div>
              <span className="mt-1.5 inline-flex rounded-sm bg-surface-inset px-1.5 py-0.5 font-mono text-micro tracking-normal text-ink-2">
                {booking.code}
              </span>
            </Card>
          </li>
        ))}
      </ol>
    </VisualPanel>
  )
}

/* ----------------------------------------------------------- decorative art */

/**
 * The dotted arc behind the hero — the brand mark's route, stretched across the
 * page. Colour comes from `currentColor` so the caller sets the intensity.
 */
export function DottedRoute({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 260"
      fill="none"
      aria-hidden="true"
      className={cn('block h-auto w-full', className)}
    >
      <path
        d="M-20 236C160 236 250 40 470 40s330 176 520 176 214-92 232-108"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0.1 18"
      />
      <circle cx="470" cy="40" r="7" fill="currentColor" />
      <circle cx="990" cy="216" r="7" fill="currentColor" />
    </svg>
  )
}
