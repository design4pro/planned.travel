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
import { useTranslate } from '#/lib/i18n'
import { PLAN_COPY } from '#/lib/plan-copy'
import { Section, SectionIntro } from './section'
import { CostsVisual, PlannerVisual, ReservationsVisual } from './visuals'

import type { MessageKey } from '#/lib/i18n'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* --------------------------------------------------------------- spotlights */

type Spotlight = {
  readonly id: string
  /**
   * The module's own name, as the app's navigation says it. A landing page that
   * calls a module something the product does not is a defect, so the key is the
   * shell's rather than a second wording of the same word.
   */
  readonly eyebrow: MessageKey
  readonly icon: LucideIcon
  readonly title: MessageKey
  readonly lede: MessageKey
  readonly points: readonly [MessageKey, MessageKey, MessageKey, MessageKey]
  readonly visual: () => ReactNode
  /** Puts the illustration on the left on wide screens. */
  readonly mirrored?: boolean
  readonly tone?: 'canvas' | 'tint'
}

const SPOTLIGHTS: ReadonlyArray<Spotlight> = [
  {
    id: 'planner',
    eyebrow: 'shell.trip.tab.plan',
    icon: Map,
    title: 'marketing.feature.planner.title',
    lede: 'marketing.feature.planner.lede',
    points: [
      'marketing.feature.planner.point.days',
      'marketing.feature.planner.point.unscheduled',
      'marketing.feature.planner.point.crew',
      'marketing.feature.planner.point.tiles',
    ],
    visual: PlannerVisual,
  },
  {
    id: 'costs',
    eyebrow: 'shell.trip.tab.costs',
    icon: Coins,
    title: 'marketing.feature.costs.title',
    lede: 'marketing.feature.costs.lede',
    points: [
      'marketing.feature.costs.point.split',
      'marketing.feature.costs.point.currency',
      'marketing.feature.costs.point.settle',
      'marketing.feature.costs.point.receipt',
    ],
    visual: CostsVisual,
    mirrored: true,
    tone: 'tint',
  },
  {
    id: 'reservations',
    eyebrow: 'shell.trip.tab.book',
    icon: Ticket,
    title: 'marketing.feature.book.title',
    lede: 'marketing.feature.book.lede',
    points: [
      'marketing.feature.book.point.legs',
      'marketing.feature.book.point.day',
      'marketing.feature.book.point.states',
      'marketing.feature.book.point.export',
    ],
    visual: ReservationsVisual,
  },
]

function SpotlightPoints({ points }: { points: ReadonlyArray<MessageKey> }) {
  const t = useTranslate()
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
            {t(point, { crew: t(PLAN_COPY.crew.name) })}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SpotlightBand({ spotlight }: { spotlight: Spotlight }) {
  const t = useTranslate()
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
            {t(spotlight.eyebrow)}
          </SectionLabel>
          <h2
            id={headingId}
            className="mt-3 font-display text-title font-extrabold tracking-tighter text-balance text-ink sm:text-display"
          >
            {t(spotlight.title)}
          </h2>
          <p className="mt-4 text-body leading-relaxed text-pretty text-ink-2">
            {t(spotlight.lede)}
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
  /** The shell's own name for the module, for the reason `Spotlight` records. */
  readonly name: MessageKey
  readonly benefit: MessageKey
  readonly detail: MessageKey
}

const MODULES: ReadonlyArray<Module> = [
  {
    icon: ListChecks,
    name: 'shell.trip.tab.lists',
    benefit: 'marketing.feature.module.lists.benefit',
    detail: 'marketing.feature.module.lists.detail',
  },
  {
    icon: Compass,
    // The one module the shell has no name for: it has no tab of its own.
    name: 'marketing.feature.module.journal.name',
    benefit: 'marketing.feature.module.journal.benefit',
    detail: 'marketing.feature.module.journal.detail',
  },
  {
    icon: Globe,
    name: 'shell.nav.atlas',
    benefit: 'marketing.feature.module.atlas.benefit',
    detail: 'marketing.feature.module.atlas.detail',
  },
  {
    icon: CalendarDays,
    name: 'shell.nav.vacay',
    benefit: 'marketing.feature.module.vacay.benefit',
    detail: 'marketing.feature.module.vacay.detail',
  },
  {
    icon: Users,
    name: 'shell.trip.tab.collab',
    benefit: 'marketing.feature.module.collab.benefit',
    detail: 'marketing.feature.module.collab.detail',
  },
  {
    icon: Paperclip,
    name: 'shell.trip.tab.files',
    benefit: 'marketing.feature.module.files.benefit',
    detail: 'marketing.feature.module.files.detail',
  },
]

/** The rest of the product, in a grid: name, the benefit, then the mechanism. */
export function ModuleGrid() {
  const t = useTranslate()
  return (
    <Section
      id="modules"
      tone="tint"
      aria-labelledby="modules-heading"
      className="scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]"
    >
      <SectionIntro
        headingId="modules-heading"
        eyebrow={t('marketing.footer.link.everyModule')}
        title={t('marketing.feature.modules.title')}
        lede={t('marketing.feature.modules.lede')}
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
                  {t(module.name)}
                </h3>
                <p className="mt-1 text-label font-semibold text-brand">
                  {t(module.benefit)}
                </p>
              </div>
              <p className="text-caption leading-relaxed text-ink-2">
                {t(module.detail)}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}
