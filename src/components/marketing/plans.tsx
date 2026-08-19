import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { Badge, Button, Card, Separator } from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  BILLING_INTERVALS,
  PLAN_LIST,
  formatPlanAmount,
  isUnlimited,
  monthlyEquivalent,
  yearlySavingPercent,
} from '#/lib/plans'

import type { BillingInterval, Plan } from '#/lib/plans'
import type { ReactNode } from 'react'

/** Token easing expressed as the cubic-bezier array `motion` expects. */
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const

/* ------------------------------------------------------------------ helpers */

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
  plan: Plan,
  interval: BillingInterval,
): string {
  const price = plan.prices[interval]
  if (price === null) return 'Free'
  return formatPlanAmount(monthlyEquivalent(price), price.currency)
}

/** What sits on the headline's baseline: `/ month`, or `/ member / month`. */
export function planPriceSuffix(
  plan: Plan,
  interval: BillingInterval,
): string | null {
  const price = plan.prices[interval]
  if (price === null) return null
  return price.perSeat ? '/ member / month' : '/ month'
}

/** The quiet line under the price: what is actually billed, and when. */
export function planPriceFootnote(
  plan: Plan,
  interval: BillingInterval,
): string {
  const price = plan.prices[interval]
  if (price === null) return 'No card, no expiry, no countdown'
  if (interval === 'yearly') {
    const billed = formatPlanAmount(price.amount, price.currency)
    return price.perSeat
      ? `${billed} a year per member, billed once`
      : `${billed} billed once a year`
  }
  return `${plan.trialDays}-day free trial, no card needed`
}

/** Seats and trips, as one line for the card's footer band. */
export function planScopeLine(plan: Plan): string {
  const seats =
    plan.seatRange.max === null
      ? 'Unlimited members'
      : plan.seatRange.max === 1
        ? 'One traveller'
        : `Up to ${plan.seatRange.max} members`
  const trips = isUnlimited(plan.limits.trips)
    ? 'unlimited trips'
    : `${plan.limits.trips} trips at a time`
  return `${seats} · ${trips}`
}

export function planCtaLabel(plan: Plan): string {
  return plan.prices.monthly === null
    ? 'Start for free'
    : `Start the ${plan.name} trial`
}

/* -------------------------------------------------------- interval selector */

export type BillingIntervalToggleProps = {
  value: BillingInterval
  onChange: (next: BillingInterval) => void
  className?: string
  /** Rendered under the control — what the chosen interval actually means. */
  note?: ReactNode
}

const INTERVAL_LABELS: { readonly [I in BillingInterval]: string } = {
  monthly: 'Monthly',
  yearly: 'Yearly',
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
  const reduceMotion = useReducedMotion()
  const saving = bestYearlySaving()
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: EASE_OUT_QUINT }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        role="group"
        aria-label="Billing interval"
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
              {INTERVAL_LABELS[option]}
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
export function intervalNote(interval: BillingInterval): string {
  return interval === 'yearly'
    ? 'Billed once a year. Two months on the house.'
    : 'Billed monthly. Change or cancel whenever you like.'
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
  const featured = plan.recommended
  const suffix = planPriceSuffix(plan, interval)
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
              {plan.name}
            </h3>
            <p
              className={cn(
                'mt-1 text-label',
                featured ? 'text-inverse-muted' : 'text-ink-3',
              )}
            >
              {plan.tagline}
            </p>
          </div>
          {featured ? (
            <Badge tone="brand" size="sm" className="shrink-0">
              Most popular
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
              {planPriceHeadline(plan, interval)}
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
            {planPriceFootnote(plan, interval)}
          </p>
        </div>

        {cta}

        <Separator
          weight="faint"
          className={featured ? 'bg-inverse-edge' : undefined}
        />

        <ul className="flex flex-col gap-3">
          {plan.features.map((feature) => (
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
                {compact || feature.detail === undefined ? null : (
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
          {planScopeLine(plan)}
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
                <Link to="/register">{planCtaLabel(plan)}</Link>
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  )
}
