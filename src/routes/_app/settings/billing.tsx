import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Infinity as InfinityIcon,
  Lock,
  Receipt,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Progress,
  SectionLabel,
  Separator,
  SimpleSelect,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import {
  BILLING_INTERVALS,
  FREE_PLAN,
  PLANS,
  PLAN_LIST,
  QUOTA_KEYS,
  clampSeats,
  formatPlanAmount,
  formatStorage,
  isUnlimited,
  monthlyEquivalent,
  planById,
  yearlySavingPercent,
} from '#/lib/plans'
import {
  formatDate,
  formatMoneyMinor,
  formatNumber,
  formatPercent,
} from '../-lib/format'
import {
  loadBilling,
  openBillingPortal,
  startPlanChange,
} from '../-server/billing'
import { SettingsSection } from '../-ui/settings-nav'
import { PLAN_COPY } from './-lib/plan-copy'
import { RouteError } from './-ui/route-error'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { BillingInterval, BillingState, Plan, QuotaKey } from '#/lib/plans'
import type { InvoiceSummary } from '#/server/billing/checkout'
import type { Entitlements, QuotaState } from '#/server/billing/types'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------- search */

type CheckoutOutcome = 'complete' | 'cancelled'

interface BillingSearch {
  /** Set by the URLs Stripe Checkout redirects back to. */
  readonly checkout?: CheckoutOutcome
  /** Set when the customer comes back out of the Billing Portal. */
  readonly portal?: true
}

function readOutcome(value: unknown): CheckoutOutcome | undefined {
  return value === 'complete' || value === 'cancelled' ? value : undefined
}

export const Route = createFileRoute('/_app/settings/billing')({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    checkout: readOutcome(search.checkout),
    portal: search.portal === 'complete' ? true : undefined,
  }),
  loader: () => loadBilling(),
  pendingComponent: BillingPending,
  errorComponent: BillingError,
  component: BillingPage,
})

function BillingError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <RouteError error={error} title={t('settings.billing.error')} />
}

/* ------------------------------------------------------------------ helpers */

/** Where a plan sits in the catalogue — how upgrade is told from downgrade. */
function rankOf(planId: Plan['id']): number {
  return PLAN_LIST.findIndex((plan) => plan.id === planId)
}

/**
 * The nine Stripe subscription states, each with the key that names it and the
 * tone it wears. Keys, not sentences, because a module-scope table cannot be
 * translated and a literal checked against `MessageKey` cannot be misspelled.
 */
const STATUS_BADGES: {
  readonly [K in BillingState]: {
    label: MessageKey
    tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand'
  }
} = {
  none: { label: 'settings.billing.status.none', tone: 'neutral' },
  trialing: { label: 'settings.billing.status.trialing', tone: 'brand' },
  active: { label: 'settings.billing.status.active', tone: 'success' },
  past_due: { label: 'settings.billing.status.past_due', tone: 'warning' },
  unpaid: { label: 'settings.billing.status.unpaid', tone: 'danger' },
  paused: { label: 'settings.billing.status.paused', tone: 'neutral' },
  canceled: { label: 'settings.billing.status.canceled', tone: 'neutral' },
  incomplete: { label: 'settings.billing.status.incomplete', tone: 'warning' },
  incomplete_expired: {
    label: 'settings.billing.status.incomplete_expired',
    tone: 'neutral',
  },
}

const QUOTA_LABEL_KEYS: { readonly [K in QuotaKey]: MessageKey } = {
  seats: 'settings.billing.quota.seats',
  trips: 'settings.billing.quota.trips',
  storageBytes: 'settings.billing.quota.storageBytes',
}

/** Days from now until an ISO instant, floored. Negative once it has passed. */
function daysFromNow(iso: string | null): number | null {
  if (iso === null) return null
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  return Math.floor((at - Date.now()) / 86_400_000)
}

/** The one line under the plan name that says what happens next, and when. */
function renewalLine(
  t: Translate,
  locale: Locale,
  state: Entitlements,
): string {
  const on = formatDate(state.currentPeriodEnd, locale)

  if (state.trialing) {
    const left = daysFromNow(state.trialEndsAt)
    if (left !== null && left >= 0) {
      return left === 0
        ? t('settings.billing.renewal.trialEndsToday')
        : t('settings.billing.renewal.trialEndsIn', {
            count: left,
            value: formatNumber(left, locale),
          })
    }
    return t('settings.billing.renewal.trialEnded')
  }

  if (state.cancelAtPeriodEnd) {
    return on === null
      ? t('settings.billing.renewal.endsNoDate')
      : t('settings.billing.renewal.endsOn', { date: on })
  }

  switch (state.status) {
    case 'past_due':
      return t('settings.billing.renewal.pastDue')
    case 'unpaid':
      return t('settings.billing.renewal.unpaid')
    case 'paused':
      return t('settings.billing.renewal.paused')
    case 'canceled':
    case 'incomplete_expired':
      return t('settings.billing.renewal.lapsed')
    case 'incomplete':
      return t('settings.billing.renewal.incomplete')
    case 'none':
      return t('settings.billing.renewal.free')
    case 'active':
    case 'trialing':
      return on === null
        ? t('settings.billing.renewal.auto')
        : t('settings.billing.renewal.renewsOn', { date: on })
  }
}

/**
 * The interval this workspace is billed on.
 *
 * The interval comes from the Stripe subscription and can be missing — a record
 * imported without one, a plan an operator set by hand, a webhook that has not landed
 * yet. A paid plan is quoted monthly everywhere else in the product, so that is the
 * fallback. Without it the header priced a paid plan at "Free" directly above a renewal
 * date, and the picker offered to "switch to monthly" the very plan and interval the
 * workspace was already on.
 */
function billedInterval(state: Entitlements): BillingInterval | null {
  if (state.interval !== null) return state.interval
  return state.planId === FREE_PLAN.id ? null : 'monthly'
}

/** Meters go warm before they go red, so a limit is never a surprise. */
function meterTone(quota: QuotaState): 'brand' | 'warning' | 'danger' {
  if (quota.exceeded || quota.ratio >= 1) return 'danger'
  return quota.ratio >= 0.8 ? 'warning' : 'brand'
}

/**
 * A quota amount in its own units, grouped for the locale.
 *
 * `formatQuota` and `formatQuotaUsage` in `src/lib/plans.ts` answer with
 * `String(n)`, which prints `1234` with no separator in all twenty-three
 * languages — §8's rule on numbers a reader sees. Storage keeps the binary
 * units R2 bills in; a count goes through the locale's own grouping.
 */
function quotaAmount(key: QuotaKey, value: number, locale: Locale): string {
  return key === 'storageBytes'
    ? formatStorage(value)
    : formatNumber(value, locale)
}

/** A quota's ceiling, or the word for having none. */
function quotaCeiling(
  t: Translate,
  key: QuotaKey,
  limit: number | null,
  locale: Locale,
): string {
  return isUnlimited(limit)
    ? t('settings.billing.quota.unlimited')
    : quotaAmount(key, limit, locale)
}

function quotaHint(
  t: Translate,
  key: QuotaKey,
  quota: QuotaState,
  locale: Locale,
): string {
  if (isUnlimited(quota.limit)) return t('settings.billing.quota.noLimit')
  // Being *over* a limit and being exactly *at* one are different situations, and
  // a workspace that inherited members from a richer plan is genuinely over.
  // Telling it "you have used every seat" understated the problem by three seats.
  if (quota.used > quota.limit) {
    const over = quota.used - quota.limit
    if (key === 'storageBytes') {
      return t('settings.billing.quota.over.storage', {
        value: formatStorage(over),
      })
    }
    return t(
      key === 'seats'
        ? 'settings.billing.quota.over.seats'
        : 'settings.billing.quota.over.trips',
      { count: over, value: formatNumber(over, locale) },
    )
  }
  if (quota.remaining === null || quota.remaining === 0) {
    switch (key) {
      case 'seats':
        return t('settings.billing.quota.exhausted.seats')
      case 'trips':
        return t('settings.billing.quota.exhausted.trips')
      default:
        return t('settings.billing.quota.exhausted.storage')
    }
  }
  return t('settings.billing.quota.left', {
    value: quotaAmount(key, quota.remaining, locale),
  })
}

/* --------------------------------------------------------------------- page */

function BillingPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const t = useTranslate()

  const state = data.entitlements
  const plan = planById(state.planId)

  const [interval, setInterval] = useState<BillingInterval>(
    state.interval ?? 'monthly',
  )
  // Seeded from what the workspace already has, clamped into the seat-based
  // plan's own range so the stepper can never show a value it cannot offer.
  const [seats, setSeats] = useState<number>(
    clampSeats(PLANS.crew, Math.max(state.seats, state.usage.seats)),
  )
  const [pending, setPending] = useState<string | null>(null)

  /** Hands the browser to Stripe, keeping the button that asked in a pending state. */
  async function goToStripe(
    key: string,
    run: () => Promise<{ url: string }>,
  ): Promise<void> {
    setPending(key)
    try {
      const { url } = await run()
      window.location.assign(url)
    } catch {
      setPending(null)
      // Authored copy, not the thrown message: a Stripe error string is written
      // for an operator's log and reaches this screen in English whatever the
      // reader's language.
      toast.error(t('settings.billing.stripe.failed'), {
        description: t('settings.billing.stripe.failedBody'),
      })
    }
  }

  function choosePlan(target: Plan): void {
    void goToStripe(`plan:${target.id}`, () =>
      startPlanChange({
        data: {
          planId: target.id,
          interval,
          seats: target.seatBased ? seats : undefined,
        },
      }),
    )
  }

  function toPortal(
    key: string,
    intent: 'home' | 'paymentMethod' | 'cancel',
  ): void {
    void goToStripe(key, () => openBillingPortal({ data: { intent } }))
  }

  return (
    <div className="flex flex-col gap-6">
      {search.checkout === 'complete' ? (
        <Alert
          tone="success"
          title={t('settings.billing.checkout.completeTitle')}
          actions={
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                void router.invalidate()
              }}
            >
              {t('settings.billing.refresh')}
            </Button>
          }
        >
          {t('settings.billing.checkout.completeBody')}
        </Alert>
      ) : null}

      {search.checkout === 'cancelled' ? (
        <Alert
          tone="neutral"
          title={t('settings.billing.checkout.cancelledTitle')}
        >
          {t('settings.billing.checkout.cancelledBody')}
        </Alert>
      ) : null}

      {search.portal === true ? (
        <Alert
          tone="info"
          title={t('settings.billing.portal.backTitle')}
          actions={
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                void router.invalidate()
              }}
            >
              {t('settings.billing.refresh')}
            </Button>
          }
        >
          {t('settings.billing.portal.backBody')}
        </Alert>
      ) : null}

      {data.canManage ? null : (
        <Alert
          tone="info"
          title={t('settings.billing.readOnly.title')}
          icon={<Lock />}
        >
          {t('settings.billing.readOnly.body')}
        </Alert>
      )}

      <PlanHero
        state={state}
        plan={plan}
        canManage={data.canManage}
        pending={pending}
        onManagePayment={() =>
          toPortal('portal:paymentMethod', 'paymentMethod')
        }
        onCancel={() => toPortal('portal:cancel', 'cancel')}
      />

      <UsageMeters state={state} />

      <SettingsSection
        title={t('settings.billing.plans.title')}
        description={t('settings.billing.plans.description')}
        actions={<IntervalToggle value={interval} onChange={setInterval} />}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {PLAN_LIST.map((candidate) => (
            <PlanOption
              key={candidate.id}
              plan={candidate}
              interval={interval}
              state={state}
              canManage={data.canManage}
              pending={pending}
              seats={seats}
              onSeatsChange={setSeats}
              onChoose={() => choosePlan(candidate)}
              onDowngradeToFree={() => toPortal('portal:cancel', 'cancel')}
            />
          ))}
        </div>
      </SettingsSection>

      <InvoiceHistory
        invoices={data.invoices}
        unavailable={data.invoicesUnavailable}
        hasCustomer={state.hasStripeCustomer}
        canManage={data.canManage}
        pending={pending}
        onOpenPortal={() => toPortal('portal:home', 'home')}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- plan hero */

function PlanHero({
  state,
  plan,
  canManage,
  pending,
  onManagePayment,
  onCancel,
}: {
  state: Entitlements
  plan: Plan
  canManage: boolean
  pending: string | null
  onManagePayment: () => void
  onCancel: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const badge = STATUS_BADGES[state.status]
  const paid = plan.id !== FREE_PLAN.id
  const interval = billedInterval(state)
  const price = interval === null ? null : plan.prices[interval]
  const total =
    price === null ? 0 : price.amount * (price.perSeat ? state.seats : 1)

  return (
    <Card variant="inverse" padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <SectionLabel className="text-inverse-muted" icon={<Sparkles />}>
            {t('settings.billing.hero.label')}
          </SectionLabel>

          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-title font-bold tracking-tight text-inverse-on">
              {t(PLAN_COPY[plan.id].name)}
            </h2>
            <Badge tone={badge.tone} size="sm" dot>
              {t(badge.label)}
            </Badge>
            {state.cancelAtPeriodEnd ? (
              <Badge tone="inverse" size="sm">
                {t('settings.billing.hero.endsAtPeriod')}
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 max-w-prose text-label leading-relaxed text-inverse-muted">
            {renewalLine(t, locale, state)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
          <div className="lg:text-end">
            <p className="flex items-baseline gap-1.5 lg:justify-end">
              <span className="font-display text-display leading-none font-extrabold tracking-tighter tabular-nums text-inverse-on">
                {price === null
                  ? t('settings.billing.price.free')
                  : formatPlanAmount(total, price.currency)}
              </span>
              {price === null ? null : (
                <span className="text-subtitle font-medium text-inverse-muted">
                  {price.interval === 'yearly'
                    ? t('settings.billing.hero.perYear')
                    : t('settings.billing.hero.perMonth')}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-caption tabular-nums text-inverse-muted">
              {price === null
                ? // The trip ceiling in force, not the catalogue's: a free workspace
                  // can legitimately have been given head-room by hand.
                  t('settings.billing.hero.freeAllowance', {
                    trips: quotaCeiling(t, 'trips', state.limits.trips, locale),
                  })
                : price.perSeat
                  ? t('settings.billing.hero.perSeatLine', {
                      seats: formatNumber(state.seats, locale),
                      price: formatPlanAmount(price.amount, price.currency),
                    })
                  : t('settings.billing.hero.singleTraveller')}
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="inverse"
                size="sm"
                shape="pill"
                icon={<CreditCard />}
                disabled={!state.hasStripeCustomer}
                loading={pending === 'portal:paymentMethod'}
                loadingLabel={t('settings.billing.stripe.opening')}
                onClick={onManagePayment}
              >
                {t('settings.billing.hero.paymentMethod')}
              </Button>
              {paid ? (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  className="text-inverse-muted hover:bg-inverse-surface hover:text-inverse-on"
                  loading={pending === 'portal:cancel'}
                  loadingLabel={t('settings.billing.stripe.opening')}
                  onClick={onCancel}
                >
                  {t('settings.billing.hero.cancel')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------- usage meters */

function UsageMeters({ state }: { state: Entitlements }) {
  const t = useTranslate()
  const locale = useLocale()

  return (
    <SettingsSection
      title={t('settings.billing.usage.title')}
      description={t('settings.billing.usage.description')}
    >
      <div className="flex flex-col gap-5">
        {QUOTA_KEYS.map((key) => {
          const quota = state.quotas[key]
          const unlimited = isUnlimited(quota.limit)
          const name = t(QUOTA_LABEL_KEYS[key])
          return (
            <div key={key} className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-label font-medium text-ink">{name}</p>
                <p className="flex items-baseline gap-1.5 text-caption tabular-nums text-ink-3">
                  <span className="font-semibold text-ink">
                    {quotaAmount(key, quota.used, locale)}
                  </span>
                  <span aria-hidden>/</span>
                  {unlimited ? (
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon aria-hidden className="size-3.5" />
                      {t('settings.billing.quota.unlimited')}
                    </span>
                  ) : (
                    <span>{quotaCeiling(t, key, quota.limit, locale)}</span>
                  )}
                </p>
              </div>

              {unlimited ? (
                // An unlimited quota gets a filled brand track rather than an
                // empty grey one, which would read as "nothing used yet".
                <div
                  aria-hidden="true"
                  className="h-2 w-full rounded-full bg-brand-subtle"
                />
              ) : (
                <Progress
                  value={quota.ratio * 100}
                  tone={meterTone(quota)}
                  aria-label={t('settings.billing.quota.used', { quota: name })}
                />
              )}

              <p
                className={cn(
                  'mt-1.5 text-caption',
                  quota.exceeded ? 'text-danger' : 'text-ink-4',
                )}
              >
                {quotaHint(t, key, quota, locale)}
              </p>
            </div>
          )
        })}
      </div>
    </SettingsSection>
  )
}

/* --------------------------------------------------------------- plan picker */

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval
  onChange: (next: BillingInterval) => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const saving = Math.max(...PLAN_LIST.map(yearlySavingPercent))

  return (
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
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold focus-ring',
              'transition-[background-color,color,box-shadow] duration-base ease-out-quint',
              active
                ? 'bg-track-thumb text-ink shadow-card'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option === 'monthly'
              ? t('settings.billing.interval.monthly')
              : t('settings.billing.interval.yearly')}
            {option === 'yearly' && saving > 0 ? (
              <span className="rounded-full bg-success-soft px-1.5 text-micro font-bold tabular-nums text-success">
                {t('settings.billing.interval.saving', {
                  value: formatPercent(saving / 100, locale),
                })}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function PlanOption({
  plan,
  interval,
  state,
  canManage,
  pending,
  seats,
  onSeatsChange,
  onChoose,
  onDowngradeToFree,
}: {
  plan: Plan
  interval: BillingInterval
  state: Entitlements
  canManage: boolean
  pending: string | null
  seats: number
  onSeatsChange: (next: number) => void
  onChoose: () => void
  onDowngradeToFree: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()

  const price = plan.prices[interval]
  const isCurrentPlan = plan.id === state.planId
  const isCurrent =
    isCurrentPlan && (price === null || billedInterval(state) === interval)
  const delta = rankOf(plan.id) - rankOf(state.planId)
  const busy = pending === `plan:${plan.id}` || pending === 'portal:cancel'

  const seatCount = plan.seatBased ? seats : plan.seatRange.min
  const total =
    price === null ? 0 : price.amount * (price.perSeat ? seatCount : 1)

  const copy = PLAN_COPY[plan.id]
  const name = t(copy.name)
  const label = isCurrent
    ? t('settings.billing.plan.current')
    : plan.id === FREE_PLAN.id
      ? t('settings.billing.plan.moveTo', { plan: name })
      : isCurrentPlan
        ? interval === 'yearly'
          ? t('settings.billing.plan.switchYearly')
          : t('settings.billing.plan.switchMonthly')
        : delta > 0
          ? t('settings.billing.plan.upgradeTo', { plan: name })
          : t('settings.billing.plan.changeTo', { plan: name })

  const seatOptions = plan.seatBased
    ? Array.from(
        {
          length:
            (plan.seatRange.max ?? plan.seatRange.min) - plan.seatRange.min + 1,
        },
        (_, index) => {
          const count = plan.seatRange.min + index
          return {
            value: String(count),
            label: t('settings.billing.plan.seatOption', {
              count,
              value: formatNumber(count, locale),
            }),
          }
        },
      )
    : []

  return (
    <Card
      variant={isCurrent ? 'brand' : 'inset'}
      padding="none"
      className={cn(
        'flex min-w-0 flex-col',
        isCurrent && 'ring-1 ring-brand/25 ring-inset',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-subtitle font-bold tracking-tight text-ink">
              {t(copy.name)}
            </h3>
            <p className="mt-0.5 text-caption text-ink-3">{t(copy.tagline)}</p>
          </div>
          {isCurrent ? (
            <Badge tone="brand" size="sm" className="shrink-0">
              {t('settings.billing.plan.currentBadge')}
            </Badge>
          ) : plan.recommended ? (
            <Badge tone="neutral" size="sm" className="shrink-0">
              {t('settings.billing.plan.popular')}
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-title leading-none font-extrabold tracking-tighter tabular-nums text-ink">
              {price === null
                ? t('settings.billing.price.free')
                : formatPlanAmount(monthlyEquivalent(price), price.currency)}
            </span>
            {price === null ? null : (
              <span className="text-caption font-medium text-ink-3">
                {price.perSeat
                  ? t('settings.billing.plan.perMemberMonth')
                  : t('settings.billing.plan.perMonth')}
              </span>
            )}
          </p>
          <p className="mt-1 text-caption tabular-nums text-ink-4">
            {price === null
              ? t('settings.billing.plan.alwaysFree')
              : interval === 'yearly'
                ? t('settings.billing.plan.billedYearly', {
                    amount: formatPlanAmount(total, price.currency),
                  })
                : t('settings.billing.plan.billedMonthly', {
                    amount: formatPlanAmount(total, price.currency),
                  })}
          </p>
        </div>

        {plan.seatBased && !isCurrent ? (
          <Field
            label={t('settings.billing.plan.members')}
            hint={t('settings.billing.plan.membersHint')}
          >
            <SimpleSelect
              size="sm"
              options={seatOptions}
              value={String(seatCount)}
              onValueChange={(next) => onSeatsChange(Number.parseInt(next, 10))}
            />
          </Field>
        ) : null}

        <Separator weight="faint" />

        <ul className="flex min-w-0 flex-col gap-2">
          {copy.features.map((feature) => (
            <li key={feature} className="flex min-w-0 gap-2">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                <Check aria-hidden className="size-2.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 text-caption leading-relaxed text-ink-2">
                {t(feature)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-edge-faint p-4 sm:px-5">
        <Button
          variant={isCurrent ? 'subtle' : delta > 0 ? 'primary' : 'secondary'}
          size="sm"
          shape="pill"
          block
          disabled={!canManage || isCurrent}
          loading={busy}
          loadingLabel={t('settings.billing.stripe.opening')}
          iconAfter={isCurrent ? undefined : <ArrowUpRight data-mirror-rtl />}
          onClick={plan.id === FREE_PLAN.id ? onDowngradeToFree : onChoose}
        >
          {label}
        </Button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ invoices */

const INVOICE_TONES: {
  readonly [K in InvoiceSummary['status']]: {
    label: MessageKey
    tone: 'success' | 'warning' | 'danger' | 'neutral'
  }
} = {
  paid: { label: 'settings.billing.invoice.paid', tone: 'success' },
  open: { label: 'settings.billing.invoice.open', tone: 'warning' },
  draft: { label: 'settings.billing.invoice.draft', tone: 'neutral' },
  void: { label: 'settings.billing.invoice.void', tone: 'neutral' },
  uncollectible: {
    label: 'settings.billing.invoice.uncollectible',
    tone: 'danger',
  },
}

/** Stands in for a date or a link a Stripe record simply does not carry. */
const ABSENT = '—'

function InvoiceHistory({
  invoices,
  unavailable,
  hasCustomer,
  canManage,
  pending,
  onOpenPortal,
}: {
  invoices: ReadonlyArray<InvoiceSummary>
  /** Stripe did not answer for the receipts. Plan and usage are still live. */
  unavailable: boolean
  hasCustomer: boolean
  canManage: boolean
  pending: string | null
  onOpenPortal: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()

  const portalButton = canManage ? (
    <Button
      variant="secondary"
      size="sm"
      shape="pill"
      icon={<Receipt />}
      disabled={!hasCustomer}
      loading={pending === 'portal:home'}
      loadingLabel={t('settings.billing.stripe.opening')}
      onClick={onOpenPortal}
    >
      {t('settings.billing.invoices.portal')}
    </Button>
  ) : null

  // Stripe failing is a state of *this section*, not of the page. Leading the
  // screen with a warning banner made a working subscription look broken; the
  // plan, the usage meters and the plan picker above are all live either way.
  if (unavailable) {
    return (
      <SettingsSection
        title={t('settings.billing.invoices.title')}
        description={t('settings.billing.invoices.description')}
        actions={portalButton}
      >
        <EmptyState
          tone="warning"
          icon={<Receipt />}
          title={t('settings.billing.invoices.unavailableTitle')}
          description={t('settings.billing.invoices.unavailableBody')}
        />
      </SettingsSection>
    )
  }

  if (invoices.length === 0) {
    return (
      <SettingsSection
        title={t('settings.billing.invoices.title')}
        description={t('settings.billing.invoices.description')}
        actions={portalButton}
      >
        <EmptyState
          icon={<FileText />}
          title={t('settings.billing.invoices.emptyTitle')}
          description={
            hasCustomer
              ? t('settings.billing.invoices.emptyCustomer')
              : t('settings.billing.invoices.emptyNoCustomer')
          }
        />
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title={t('settings.billing.invoices.title')}
      description={t('settings.billing.invoices.description')}
      actions={portalButton}
      className="overflow-hidden"
    >
      <Table
        label={t('settings.billing.invoices.tableLabel')}
        containerClassName="-mx-1"
      >
        <TableHeader>
          <TableRow>
            <TableHead>{t('settings.billing.invoices.number')}</TableHead>
            <TableHead>{t('settings.billing.invoices.date')}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t('settings.billing.invoices.period')}
            </TableHead>
            <TableHead numeric>
              {t('settings.billing.invoices.amount')}
            </TableHead>
            <TableHead>{t('settings.billing.invoices.status')}</TableHead>
            <TableHead className="sr-only">
              {t('settings.billing.invoices.receipt')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const badge = INVOICE_TONES[invoice.status]
            return (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium text-ink tabular-nums">
                  {invoice.number}
                </TableCell>
                <TableCell muted>
                  {formatDate(invoice.createdAt, locale) ?? ABSENT}
                </TableCell>
                <TableCell muted className="hidden sm:table-cell">
                  {formatDate(invoice.periodStart, locale) ?? ABSENT} —{' '}
                  {formatDate(invoice.periodEnd, locale) ?? ABSENT}
                </TableCell>
                <TableCell numeric>
                  {formatMoneyMinor(invoice.total, invoice.currency, locale)}
                </TableCell>
                <TableCell>
                  <Badge tone={badge.tone} size="sm">
                    {t(badge.label)}
                  </Badge>
                </TableCell>
                <TableCell align="end">
                  {invoice.hostedUrl === null && invoice.pdfUrl === null ? (
                    <span className="text-caption text-ink-4">{ABSENT}</span>
                  ) : (
                    <Button asChild variant="ghost" size="sm" shape="pill">
                      <a
                        href={invoice.hostedUrl ?? invoice.pdfUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {t('settings.billing.invoices.view')}
                        <ExternalLink aria-hidden data-mirror-rtl />
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </SettingsSection>
  )
}

/* ------------------------------------------------------------------ pending */

function Bar({ className }: { className?: string }): ReactNode {
  return <Skeleton className={className} radius="sm" />
}

function BillingPending() {
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('settings.billing.loading')}</span>

      <Card
        variant="inverse"
        className="flex flex-col gap-6 lg:flex-row lg:justify-between"
      >
        <div className="space-y-3">
          <Bar className="h-2.5 w-24 bg-inverse-surface" />
          <Bar className="h-7 w-40 bg-inverse-surface" />
          <Bar className="h-3 w-64 bg-inverse-surface" />
        </div>
        <div className="space-y-3 lg:text-end">
          <Bar className="h-10 w-32 bg-inverse-surface" />
          <Bar className="h-3 w-24 bg-inverse-surface" />
        </div>
      </Card>

      <Card className="space-y-5">
        {QUOTA_KEYS.map((key) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Bar className="h-3 w-24" />
              <Bar className="h-3 w-16" />
            </div>
            <Bar className="h-2 w-full" />
          </div>
        ))}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {PLAN_LIST.map((plan) => (
          <Card key={plan.id} variant="inset" className="space-y-4">
            <Bar className="h-4 w-20" />
            <Bar className="h-8 w-28" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-3/4" />
            <Bar className="h-8 w-full" />
          </Card>
        ))}
      </div>
    </div>
  )
}
