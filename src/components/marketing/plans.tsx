import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { Badge, Button, Card, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  BILLING_INTERVALS,
  PLAN_LIST,
  formatStorage,
  isUnlimited,
  monthlyEquivalent,
  yearlySavingPercent,
} from '#/lib/plans'

import { formatPrice } from '#/lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { useLocale, useTranslate } from '#/lib/i18n'
import { PLAN_COPY } from '#/lib/plan-copy'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'

import type { BillingInterval, Plan } from '#/lib/plans'
import type { ReactNode } from 'react'

/** Token easing expressed as the cubic-bezier array `motion` expects. */
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const

/* ------------------------------------------------------------------ helpers */

/** One bullet on a pricing card: a line, and the quieter line under it. */
interface CardFeature {
  readonly label: string
  readonly detail: string | null
}

/**
 * The five bullets a pricing card shows, resolved from the catalogue.
 *
 * `plans.ts` ships the same five in English beside each plan's numbers, and
 * `plan-copy.ts` records why they stay English there: that module is read by the
 * server, where a plan's name is an operator's record. A marketing page is not
 * that, so the card reads keys instead.
 *
 * Two things here are deliberate and neither is visible in the output.
 *
 * Five of the labels are the keys the comparison table further down this page
 * already uses for the same modules. Naming one capability two ways on one page
 * is the drift this page can least afford, and reusing the key makes the two
 * impossible to separate.
 *
 * The two bullets that state a number do not restate it as prose: the count goes
 * through the plural message `planScopeLine` already needs, and the storage
 * figure through `formatStorage`. So raising a quota moves the card without
 * touching one of the twenty-three catalogue files — which is the duplicated
 * fact `PLAN_ALLOWANCE_CLAIMS` guards on the settings screen, avoided here
 * rather than guarded.
 */
function cardFeatures(t: Translate, plan: Plan): ReadonlyArray<CardFeature> {
  const line = (label: MessageKey, detail?: MessageKey): CardFeature => ({
    label: t(label),
    detail: detail === undefined ? null : t(detail),
  })
  const counted = (
    label: MessageKey,
    count: number,
    detail: MessageKey,
  ): CardFeature => ({
    label: t(label, { count, value: count }),
    detail: t(detail),
  })
  // Every plan in the catalogue publishes a storage figure. The `null` the type
  // carries is the unlimited case a workspace override can hold, which no plan
  // uses, so it never reaches the formatter.
  const size = formatStorage(plan.limits.storageBytes ?? 0)
  const storage = (shared: boolean): CardFeature => ({
    label: t(
      shared
        ? 'marketing.pricing.feature.storageShared'
        : 'marketing.pricing.feature.storage',
      { size },
    ),
    detail: null,
  })

  switch (plan.id) {
    case 'free':
      return [
        counted(
          'marketing.pricing.card.trips',
          plan.limits.trips ?? 0,
          'marketing.pricing.feature.free.tripsDetail',
        ),
        line('settings.billing.plan.free.feature.itinerary'),
        line('settings.billing.plan.free.feature.lists'),
        line('marketing.pricing.module.atlas'),
        storage(false),
      ]
    case 'solo':
      return [
        line('settings.billing.plan.solo.feature.trips'),
        line(
          'marketing.pricing.feature.solo.modules',
          'marketing.pricing.feature.solo.modulesDetail',
        ),
        line(
          'marketing.pricing.module.offlineMaps',
          'marketing.pricing.feature.solo.offlineDetail',
        ),
        line('marketing.pricing.module.pdfExport'),
        storage(false),
      ]
    case 'crew':
      return [
        counted(
          'marketing.pricing.card.seatsUpTo',
          plan.seatRange.max ?? 0,
          'marketing.pricing.feature.crew.membersDetail',
        ),
        line(
          'marketing.pricing.module.realtime',
          'marketing.pricing.feature.crew.realtimeDetail',
        ),
        line('settings.billing.plan.crew.feature.everything'),
        storage(true),
        line(
          'marketing.pricing.module.prioritySupport',
          'marketing.pricing.feature.crew.supportDetail',
        ),
      ]
  }
}

/** The largest yearly discount in the catalogue, for the toggle's saving chip. */
export function bestYearlySaving(
  plans: ReadonlyArray<Plan> = PLAN_LIST,
): number {
  return plans.reduce(
    (best, plan) => Math.max(best, yearlySavingPercent(plan)),
    0,
  )
}

/** `"Free"`, or the monthly-equivalent headline for the chosen interval. */
export function planPriceHeadline(
  t: Translate,
  plan: Plan,
  interval: BillingInterval,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const price = plan.prices[interval]
  if (price === null) return t('settings.billing.price.free')
  return formatPrice(monthlyEquivalent(price), price.currency, locale)
}

/** What sits on the headline's baseline: `/ month`, or `/ member / month`. */
export function planPriceSuffix(
  t: Translate,
  plan: Plan,
  interval: BillingInterval,
): string | null {
  const price = plan.prices[interval]
  if (price === null) return null
  return t(
    price.perSeat
      ? 'settings.billing.plan.perMemberMonth'
      : 'settings.billing.plan.perMonth',
  )
}

/**
 * The quiet line under the price: what is actually billed, and when.
 *
 * The free plan genuinely asks for nothing, so it says so. A paid plan does
 * not: Polar's checkout takes a payment method when the trial starts and
 * charges it the day the trial ends. That is what the pricing FAQ and the
 * terms already say, and a card the reader is not warned about is the one
 * surprise a pricing page must never spring — so this line says it too.
 */
export function planPriceFootnote(
  t: Translate,
  plan: Plan,
  interval: BillingInterval,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const price = plan.prices[interval]
  if (price === null) return t('marketing.pricing.card.noCard')
  if (interval === 'yearly') {
    const amount = formatPrice(price.amount, price.currency, locale)
    return t(
      price.perSeat
        ? 'marketing.pricing.card.yearlyPerSeat'
        : 'marketing.pricing.card.yearly',
      { amount },
    )
  }
  return t('marketing.pricing.card.trial', {
    count: plan.trialDays,
    value: plan.trialDays,
  })
}

/** Seats and trips, as one line for the card's footer band. */
/**
 * Two counted phrases joined by a separator, not one sentence.
 *
 * A list survives translation where a sentence with two inflected nouns does
 * not: each half takes the plural branch its own language needs and neither
 * depends on the other's grammar.
 */
export function planScopeLine(t: Translate, plan: Plan): string {
  const max = plan.seatRange.max
  const seats =
    max === null
      ? t('marketing.pricing.card.seatsUnlimited')
      : max === 1
        ? t('settings.billing.hero.singleTraveller')
        : t('marketing.pricing.card.seatsUpTo', { count: max, value: max })
  const limit = plan.limits.trips
  const trips = isUnlimited(limit)
    ? t('marketing.pricing.card.tripsUnlimited')
    : t('marketing.pricing.card.trips', { count: limit, value: limit })
  return `${seats} · ${trips}`
}

export function planCtaLabel(t: Translate, plan: Plan): string {
  return plan.prices.monthly === null
    ? t('marketing.pricing.card.startFree')
    : t('marketing.pricing.card.startTrial', {
        plan: t(PLAN_COPY[plan.id].name),
      })
}

/* -------------------------------------------------------- interval selector */

export type BillingIntervalToggleProps = {
  value: BillingInterval
  onChange: (next: BillingInterval) => void
  className?: string
  /** Rendered under the control — what the chosen interval actually means. */
  note?: ReactNode
}

const INTERVAL_LABELS: { readonly [I in BillingInterval]: MessageKey } = {
  monthly: 'settings.billing.interval.monthly',
  yearly: 'settings.billing.interval.yearly',
}

/**
 * The monthly / yearly switch. Two real buttons on a tinted track, with the
 * active thumb as a single shared element so the selection slides rather than
 * cross-fading — transform only, and instant under `prefers-reduced-motion`.
 */
export function BillingIntervalToggle({
  value,
  onChange,
  className,
  note,
}: BillingIntervalToggleProps) {
  const t = useTranslate()
  const reduceMotion = useReducedMotion()
  const saving = bestYearlySaving()
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: EASE_OUT_QUINT }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        role="group"
        aria-label={t('settings.billing.interval.label')}
        className="inline-flex items-center gap-0.5 rounded-full bg-track p-1"
      >
        {BILLING_INTERVALS.map((option) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                'relative isolate inline-flex h-9 items-center gap-2 rounded-full px-4',
                'text-label font-semibold focus-ring',
                'transition-colors duration-base ease-out-quint',
                active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {active ? (
                <motion.span
                  aria-hidden
                  layoutId="billing-interval-thumb"
                  transition={transition}
                  className="absolute inset-0 -z-10 rounded-full bg-track-thumb shadow-card"
                />
              ) : null}
              {t(INTERVAL_LABELS[option])}
              {option === 'yearly' && saving > 0 ? (
                <span className="rounded-full bg-success-soft px-1.5 py-0.5 text-micro font-bold tabular-nums tracking-normal text-success">
                  &minus;{saving}%
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {note === undefined ? null : (
        <p className="text-caption text-ink-4">{note}</p>
      )}
    </div>
  )
}

/** The standard note under the toggle, so both pages say the same thing. */
export function intervalNote(t: Translate, interval: BillingInterval): string {
  return t(
    interval === 'yearly'
      ? 'marketing.pricing.card.noteYearly'
      : 'marketing.pricing.card.noteMonthly',
  )
}

/* -------------------------------------------------------------- plan cards */

export type PlanCardProps = {
  plan: Plan
  interval: BillingInterval
  /** The call to action. Passed in so this card never needs the router. */
  cta: ReactNode
  /**
   * `compact` drops the per-feature detail lines — the density the landing
   * page's pricing summary wants, where the full table is one click away.
   */
  density?: 'full' | 'compact'
  className?: string
}

/**
 * One plan, priced from the catalogue in `src/lib/plans.ts`. Nothing here knows
 * an amount: every figure on the card is derived, so a price change in the
 * catalogue moves both public pages at once.
 */
export function PlanCard({
  plan,
  interval,
  cta,
  density = 'full',
  className,
}: PlanCardProps) {
  const t = useTranslate()
  const locale = useLocale()
  const featured = plan.recommended
  const suffix = planPriceSuffix(t, plan, interval)
  const compact = density === 'compact'

  return (
    <Card
      variant={featured ? 'inverse' : 'default'}
      padding="none"
      className={cn(
        'flex h-full flex-col',
        featured && 'lg:-my-3 lg:shadow-modal',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-1 flex-col gap-5',
          compact ? 'p-5 sm:p-6' : 'p-6 sm:p-7',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={cn(
                'font-display text-title font-bold tracking-tight',
                featured ? 'text-inverse-on' : 'text-ink',
              )}
            >
              {t(PLAN_COPY[plan.id].name)}
            </h3>
            <p
              className={cn(
                'mt-1 text-label',
                featured ? 'text-inverse-muted' : 'text-ink-3',
              )}
            >
              {t(PLAN_COPY[plan.id].tagline)}
            </p>
          </div>
          {featured ? (
            <Badge tone="brand" size="sm" className="shrink-0">
              {t('marketing.pricing.card.popular')}
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={cn(
                'font-display text-display leading-none font-extrabold tracking-tighter tabular-nums',
                featured ? 'text-inverse-on' : 'text-ink',
              )}
              data-numeric=""
            >
              {planPriceHeadline(t, plan, interval, locale)}
            </span>
            {suffix === null ? null : (
              <span
                className={cn(
                  'text-label font-medium',
                  featured ? 'text-inverse-muted' : 'text-ink-3',
                )}
              >
                {suffix}
              </span>
            )}
          </p>
          <p
            className={cn(
              'mt-2 text-caption tabular-nums',
              featured ? 'text-inverse-muted' : 'text-ink-4',
            )}
          >
            {planPriceFootnote(t, plan, interval, locale)}
          </p>
        </div>

        {cta}

        <Separator
          weight="faint"
          className={featured ? 'bg-inverse-edge' : undefined}
        />

        <ul className="flex flex-col gap-3">
          {cardFeatures(t, plan).map((feature) => (
            <li key={feature.label} className="flex min-w-0 gap-2.5">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full',
                  featured
                    ? 'bg-brand text-brand-on'
                    : 'bg-brand-subtle text-brand',
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block text-label font-medium',
                    featured ? 'text-inverse-on' : 'text-ink',
                  )}
                >
                  {feature.label}
                </span>
                {compact || feature.detail === null ? null : (
                  <span
                    className={cn(
                      'block text-caption',
                      featured ? 'text-inverse-muted' : 'text-ink-3',
                    )}
                  >
                    {feature.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          'border-t px-6 py-4 sm:px-7',
          featured ? 'border-inverse-edge' : 'border-edge-faint',
        )}
      >
        <p
          className={cn(
            'text-caption',
            featured ? 'text-inverse-muted' : 'text-ink-3',
          )}
        >
          {planScopeLine(t, plan)}
        </p>
      </div>
    </Card>
  )
}

export type PlanCardGridProps = {
  interval: BillingInterval
  density?: PlanCardProps['density']
  className?: string
}

/**
 * All three plans, with their calls to action wired to registration. Used by
 * both the landing page's summary and the pricing page, so the two can never
 * disagree about what a plan costs or what it includes.
 */
export function PlanCardGrid({
  interval,
  density = 'full',
  className,
}: PlanCardGridProps) {
  const t = useTranslate()
  return (
    <ul className={cn('grid gap-5 lg:grid-cols-3 lg:items-stretch', className)}>
      {PLAN_LIST.map((plan) => (
        <li key={plan.id} className="min-w-0">
          <PlanCard
            plan={plan}
            interval={interval}
            density={density}
            cta={
              <Button
                asChild
                variant={plan.recommended ? 'brand' : 'secondary'}
                size="lg"
                shape="pill"
                block
              >
                <Link to="/register">{planCtaLabel(t, plan)}</Link>
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  )
}
