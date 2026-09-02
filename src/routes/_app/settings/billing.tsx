import { useEffect, useId, useRef, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Check,
  CreditCard,
  ExternalLink,
  FileDown,
  FileText,
  Infinity as InfinityIcon,
  Lock,
  Receipt,
  Sparkles,
} from 'lucide-react'

import { ErrorPanel } from '#/components/layout/error-state'
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
  Spinner,
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
  formatQuota,
  formatQuotaUsage,
  isUnlimited,
  monthlyEquivalent,
  planById,
  yearlySavingPercent,
} from '#/lib/plans'
import { formatDate, formatMoneyMinor, formatPrice } from '../-lib/format'
import { PLAN_COPY, QUOTA_LABEL_KEYS } from '#/lib/plan-copy'
import {
  downloadInvoice,
  loadBilling,
  openBillingPortal,
  startPlanChange,
} from '../-server/billing'
import { SettingsSection } from '../-ui/settings-nav'

import type { BadgeTone } from '#/components/ui'
import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { BillingInterval, BillingState, Plan, QuotaKey } from '#/lib/plans'
import type { InvoiceSummary } from '#/server/billing/checkout'
import type { Entitlements, QuotaState } from '#/server/billing/types'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------- search */

type CheckoutOutcome = 'complete' | 'cancelled'

/**
 * The three ways a customer arrives here from somewhere else.
 *
 * Each outcome keeps its own literal rather than collapsing to `true`. The
 * router re-serialises whatever `validateSearch` returns back into the address
 * bar, so a boolean wrote `?portal=true`, which the next validation no longer
 * recognised — the parameter was dropped on the spot and the alert never
 * rendered. Round-tripping the word keeps the URL shareable and idempotent.
 */
interface BillingSearch {
  /** Set by the URLs Polar Checkout returns the browser to. */
  readonly checkout?: CheckoutOutcome
  /** Set when the customer comes back out of the hosted customer portal. */
  readonly portal?: 'complete'
  /**
   * Set by a plan change we applied ourselves. Polar has no hosted "confirm the
   * proration" page, so `changePlan()` patches the subscription server-side and
   * sends the browser back here rather than out to the provider.
   */
  readonly plan?: 'changed'
}

function readOutcome(value: unknown): CheckoutOutcome | undefined {
  return value === 'complete' || value === 'cancelled' ? value : undefined
}

export const Route = createFileRoute('/_app/settings/billing')({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    checkout: readOutcome(search.checkout),
    portal: search.portal === 'complete' ? 'complete' : undefined,
    plan: search.plan === 'changed' ? 'changed' : undefined,
  }),
  loader: () => loadBilling(),
  pendingComponent: BillingPending,
  errorComponent: BillingError,
  component: BillingPage,
})

function BillingError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('settings.billing.error')} />
}

/* ------------------------------------------------------------------ helpers */

/** Where a plan sits in the catalogue — how upgrade is told from downgrade. */
function rankOf(planId: Plan['id']): number {
  return PLAN_LIST.findIndex((plan) => plan.id === planId)
}

/** Longest provider sentence the screen will repeat verbatim. */
const MAX_FAILURE_MESSAGE = 200

/**
 * What a rejected call says on screen.
 *
 * The server functions already replace an operator-facing provider error with a
 * customer sentence, so what usually arrives here is prose worth showing. A
 * rejection from the Zod validator is the exception: it serialises as JSON and
 * is a diagnostic, not a sentence, so anything that opens like a structure or
 * runs past a readable length is replaced rather than pasted into the alert.
 */
function messageOf(t: Translate, cause: unknown): string {
  const message = cause instanceof Error ? cause.message.trim() : ''
  const readable =
    message !== '' &&
    message.length <= MAX_FAILURE_MESSAGE &&
    !message.startsWith('[') &&
    !message.startsWith('{')
  return readable ? message : t('settings.billing.provider.rejected')
}

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

/** Days from now until an ISO instant, floored. Negative once it has passed. */
function daysFromNow(iso: string | null): number | null {
  if (iso === null) return null
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  return Math.floor((at - Date.now()) / 86_400_000)
}

/**
 * The one line under the plan name that says what happens next, and when.
 *
 * The trial lines are deliberately not the ones a card-optional provider would
 * write. Polar collects a payment method at checkout and charges it when the
 * trial ends unless the customer cancels first, so the honest sentence is when
 * the charge lands — not an invitation to "add a card later" that the customer
 * has already been through.
 */
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
            value: left,
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
 * The interval comes from the Polar subscription and can be missing — a record
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
 * Which key states each quota's overage and exhaustion.
 *
 * Storage is measured, so its sentences take a formatted size; seats and trips
 * are counted, so theirs are plural messages and the count picks the branch. The
 * two shapes cannot share one key, which is why the catalogue carries both.
 */
const QUOTA_OVER: Record<QuotaKey, MessageKey> = {
  seats: 'settings.billing.quota.over.seats',
  trips: 'settings.billing.quota.over.trips',
  storageBytes: 'settings.billing.quota.over.storage',
}

const QUOTA_EXHAUSTED: Record<QuotaKey, MessageKey> = {
  seats: 'settings.billing.quota.exhausted.seats',
  trips: 'settings.billing.quota.exhausted.trips',
  storageBytes: 'settings.billing.quota.exhausted.storage',
}

function quotaHint(t: Translate, key: QuotaKey, quota: QuotaState): string {
  if (isUnlimited(quota.limit)) return t('settings.billing.quota.noLimit')
  // Being *over* a limit and being exactly *at* one are different situations, and
  // a workspace that inherited members from a richer plan is genuinely over.
  // Telling it "you have used every seat" understated the problem by three seats.
  if (quota.used > quota.limit) {
    const over = quota.used - quota.limit
    return t(QUOTA_OVER[key], {
      count: over,
      value: formatQuotaUsage(key, over),
    })
  }
  if (quota.remaining === null || quota.remaining === 0) {
    return t(QUOTA_EXHAUSTED[key])
  }
  return t('settings.billing.quota.left', {
    value: formatQuotaUsage(key, quota.remaining),
  })
}

/* --------------------------------------------------------------------- page */

/** Which section a failed provider call belongs to, so it is shown in place. */
type FailureScope = 'plan' | 'portal'

interface Failure {
  readonly scope: FailureScope
  readonly message: string
}

/** The single portal action's pending key. Polar mints one URL, so there is one. */
const PORTAL_KEY = 'portal'

function BillingPage() {
  const t = useTranslate()
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()

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
  const [failure, setFailure] = useState<Failure | null>(null)

  /**
   * Hands the browser over, keeping the button that asked in a pending state.
   *
   * A rejection is rendered where the action lives rather than thrown at a
   * toast: a 422 on a seat count belongs next to the seat control, and a portal
   * that cannot be minted belongs under the button that tried.
   */
  async function handOff(
    key: string,
    scope: FailureScope,
    run: () => Promise<{ url: string }>,
  ): Promise<void> {
    setPending(key)
    setFailure(null)
    try {
      const { url } = await run()
      window.location.assign(url)
    } catch (cause) {
      setPending(null)
      setFailure({ scope, message: messageOf(t, cause) })
    }
  }

  function choosePlan(target: Plan): void {
    void handOff(`plan:${target.id}`, 'plan', () =>
      startPlanChange({
        data: {
          planId: target.id,
          interval,
          seats: target.seatBased ? seats : undefined,
        },
      }),
    )
  }

  function openPortal(): void {
    void handOff(PORTAL_KEY, 'portal', () => openBillingPortal({ data: {} }))
  }

  function refresh(): void {
    void router.invalidate()
  }

  return (
    <div className="flex flex-col gap-6">
      {search.checkout === 'complete' ? (
        <Alert
          tone="success"
          title={t('settings.billing.checkout.completeTitle')}
          actions={<RefreshButton onClick={refresh} />}
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

      {search.plan === 'changed' ? (
        <Alert
          tone="success"
          title={t('settings.billing.planChanged.title')}
          actions={<RefreshButton onClick={refresh} />}
        >
          {t('settings.billing.planChanged.body')}
        </Alert>
      ) : null}

      {search.portal === 'complete' ? (
        <Alert
          tone="info"
          title={t('settings.billing.portal.backTitle')}
          actions={<RefreshButton onClick={refresh} />}
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
        failure={failure?.scope === 'portal' ? failure.message : null}
        onManageBilling={openPortal}
      />

      <UsageMeters state={state} />

      <SettingsSection
        title={t('settings.billing.plans.title')}
        description={t('settings.billing.plans.description')}
        actions={<IntervalToggle value={interval} onChange={setInterval} />}
      >
        <div className="flex flex-col gap-4">
          {failure?.scope === 'plan' ? (
            <Alert
              tone="danger"
              title={t('settings.billing.plan.notApplied')}
              size="sm"
            >
              {failure.message}
            </Alert>
          ) : null}

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
                onOpenPortal={openPortal}
              />
            ))}
          </div>
        </div>
      </SettingsSection>

      <InvoiceHistory
        invoices={data.invoices}
        unavailable={data.invoicesUnavailable}
        hasCustomer={state.hasProviderCustomer}
        canManage={data.canManage}
        portalPending={pending === PORTAL_KEY}
        onOpenPortal={openPortal}
      />
    </div>
  )
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  const t = useTranslate()
  return (
    <Button variant="ghost" size="sm" shape="pill" onClick={onClick}>
      {t('settings.billing.refresh')}
    </Button>
  )
}

/* ----------------------------------------------------------------- plan hero */

function PlanHero({
  state,
  plan,
  canManage,
  pending,
  failure,
  onManageBilling,
}: {
  state: Entitlements
  plan: Plan
  canManage: boolean
  pending: string | null
  failure: string | null
  onManageBilling: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const hintId = useId()
  const badge = STATUS_BADGES[state.status]
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
                  : formatPrice(total, price.currency, locale)}
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
                    trips: formatQuota('trips', state.limits.trips),
                  })
                : price.perSeat
                  ? t('settings.billing.hero.perSeatLine', {
                      seats: state.seats,
                      price: formatPrice(price.amount, price.currency, locale),
                    })
                  : t('settings.billing.hero.singleTraveller')}
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-col items-start gap-2 lg:items-end">
              {/*
                One action, because Polar mints one short-lived token for the
                portal home and every card, address, VAT number, receipt and
                cancellation lives behind it. Polar is Merchant of Record, so
                the invoice details belong where the invoice is issued.
              */}
              <Button
                variant="inverse"
                size="sm"
                shape="pill"
                icon={<CreditCard />}
                iconAfter={<ExternalLink data-mirror-rtl />}
                disabled={!state.hasProviderCustomer}
                loading={pending === PORTAL_KEY}
                loadingLabel={t('settings.billing.portal.opening')}
                aria-describedby={hintId}
                onClick={onManageBilling}
              >
                {t('settings.billing.hero.manage')}
              </Button>
              <p
                id={hintId}
                className="max-w-[40ch] text-caption leading-relaxed text-inverse-muted lg:text-end"
              >
                {state.hasProviderCustomer
                  ? t('settings.billing.hero.manageHint')
                  : t('settings.billing.hero.manageHintNone')}
              </p>
              {failure === null ? null : (
                <p
                  role="alert"
                  className="max-w-[40ch] rounded-lg bg-danger-soft px-2.5 py-1.5 text-caption leading-relaxed text-danger lg:text-end"
                >
                  {failure}
                </p>
              )}
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
  return (
    <SettingsSection
      title={t('settings.billing.usage.title')}
      description={t('settings.billing.usage.description')}
    >
      <div className="flex flex-col gap-5">
        {QUOTA_KEYS.map((key) => {
          const quota = state.quotas[key]
          const unlimited = isUnlimited(quota.limit)
          return (
            <div key={key} className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-label font-medium text-ink">
                  {t(QUOTA_LABEL_KEYS[key])}
                </p>
                <p className="flex items-baseline gap-1.5 text-caption tabular-nums text-ink-3">
                  <span className="font-semibold text-ink">
                    {formatQuotaUsage(key, quota.used)}
                  </span>
                  <span aria-hidden>/</span>
                  {unlimited ? (
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon aria-hidden className="size-3.5" />
                      {t('settings.billing.quota.unlimited')}
                    </span>
                  ) : (
                    <span>{formatQuota(key, quota.limit)}</span>
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
                  aria-label={t('settings.billing.quota.used', {
                    quota: t(QUOTA_LABEL_KEYS[key]),
                  })}
                />
              )}

              <p
                className={cn(
                  'mt-1.5 text-caption',
                  quota.exceeded ? 'text-danger' : 'text-ink-4',
                )}
              >
                {quotaHint(t, key, quota)}
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
                −{saving}%
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Why a seat count can be refused before it is sent.
 *
 * `clampSeats()` exists so a tampered request cannot buy a plan at the wrong
 * price, but a silent clamp on screen is a different thing: a workspace of
 * twelve that sees "10 members" selected would buy ten seats and discover the
 * shortfall from an invoice. Both cases are named here and both block the
 * button, so nothing is quietly rounded on the customer's behalf.
 */
function seatProblem(
  t: Translate,
  plan: Plan,
  chosen: number,
  members: number,
): string | null {
  if (!plan.seatBased) return null
  const max = plan.seatRange.max
  if (max !== null && members > max) {
    const over = members - max
    return t('settings.billing.plan.seatsOverMax', {
      count: over,
      value: over,
      members,
      max,
      plan: t(PLAN_COPY[plan.id].name),
    })
  }
  if (chosen < members) {
    return t('settings.billing.plan.seatsBelowMembers', { members })
  }
  return null
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
  onOpenPortal,
}: {
  plan: Plan
  interval: BillingInterval
  state: Entitlements
  canManage: boolean
  pending: string | null
  seats: number
  onSeatsChange: (next: number) => void
  onChoose: () => void
  /** The Free card cancels, and cancelling is portal-only. */
  onOpenPortal: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const price = plan.prices[interval]
  const isCurrentPlan = plan.id === state.planId
  const isCurrent =
    isCurrentPlan && (price === null || billedInterval(state) === interval)
  const delta = rankOf(plan.id) - rankOf(state.planId)
  const isFree = plan.id === FREE_PLAN.id
  const busy =
    pending === `plan:${plan.id}` || (isFree && pending === PORTAL_KEY)

  const seatCount = plan.seatBased ? seats : plan.seatRange.min
  const total =
    price === null ? 0 : price.amount * (price.perSeat ? seatCount : 1)
  const seatError = isCurrent
    ? null
    : seatProblem(t, plan, seatCount, state.usage.seats)

  const label = isCurrent
    ? t('settings.billing.plan.current')
    : isFree
      ? t('settings.billing.plan.cancelInPortal')
      : isCurrentPlan
        ? interval === 'yearly'
          ? t('settings.billing.plan.switchYearly')
          : t('settings.billing.plan.switchMonthly')
        : delta > 0
          ? t('settings.billing.plan.upgradeTo', {
              plan: t(PLAN_COPY[plan.id].name),
            })
          : t('settings.billing.plan.changeTo', {
              plan: t(PLAN_COPY[plan.id].name),
            })

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
              value: count,
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
              {t(PLAN_COPY[plan.id].name)}
            </h3>
            <p className="mt-0.5 text-caption text-ink-3">
              {t(PLAN_COPY[plan.id].tagline)}
            </p>
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
                : formatPrice(monthlyEquivalent(price), price.currency, locale)}
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
              : t(
                  interval === 'yearly'
                    ? 'settings.billing.plan.billedYearly'
                    : 'settings.billing.plan.billedMonthly',
                  { amount: formatPrice(total, price.currency, locale) },
                )}
          </p>
        </div>

        {plan.seatBased && !isCurrent ? (
          <Field
            label={t('settings.billing.plan.members')}
            hint={t('settings.billing.plan.membersHint')}
            error={seatError}
          >
            <SimpleSelect
              size="sm"
              options={seatOptions}
              value={String(seatCount)}
              invalid={seatError !== null}
              onValueChange={(next) => onSeatsChange(Number.parseInt(next, 10))}
            />
          </Field>
        ) : null}

        <Separator weight="faint" />

        <ul className="flex min-w-0 flex-col gap-2">
          {PLAN_COPY[plan.id].features.map((feature) => (
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
          disabled={!canManage || isCurrent || seatError !== null}
          loading={busy}
          loadingLabel={t(
            isFree
              ? 'settings.billing.portal.opening'
              : 'settings.billing.provider.opening',
          )}
          iconAfter={
            isCurrent ? undefined : isFree ? (
              <ExternalLink data-mirror-rtl />
            ) : (
              <ArrowUpRight data-mirror-rtl />
            )
          }
          onClick={isFree ? onOpenPortal : onChoose}
        >
          {label}
        </Button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ invoices */

/**
 * Polar's order vocabulary, each with its own designed badge.
 *
 * A refund is neither a failure nor a success, so it gets `info` rather than
 * borrowing the danger tone from an unpaid invoice — an accountant reading this
 * table needs the two told apart at a glance.
 */
const INVOICE_TONES: {
  readonly [K in InvoiceSummary['status']]: {
    readonly label: MessageKey
    readonly tone: BadgeTone
  }
} = {
  draft: { label: 'settings.billing.invoice.draft', tone: 'neutral' },
  pending: { label: 'settings.billing.order.pending', tone: 'warning' },
  paid: { label: 'settings.billing.invoice.paid', tone: 'success' },
  refunded: { label: 'settings.billing.order.refunded', tone: 'info' },
  partially_refunded: {
    label: 'settings.billing.order.partiallyRefunded',
    tone: 'info',
  },
  void: { label: 'settings.billing.invoice.void', tone: 'neutral' },
}

/**
 * The per-row document action, shared by the mobile stack and the table.
 *
 * Three states, because Polar has three: a draft order has no invoice at all, a
 * document Polar is still rendering is a wait rather than a failure, and
 * anything else is one click away from a signed URL.
 */
function InvoiceDocument({
  invoice,
  fetching,
  generating,
  onOpen,
}: {
  invoice: InvoiceSummary
  fetching: boolean
  generating: boolean
  onOpen: (invoice: InvoiceSummary) => Promise<void>
}) {
  const t = useTranslate()

  if (invoice.status === 'draft') {
    return (
      <>
        <span aria-hidden className="text-caption text-ink-4">
          &mdash;
        </span>
        <span className="sr-only">
          {t('settings.billing.order.noInvoiceDraft')}
        </span>
      </>
    )
  }

  if (generating) {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-caption font-medium whitespace-nowrap text-warning"
      >
        <Spinner size="xs" label={null} />
        {t('settings.billing.order.preparing')}
        <span className="sr-only">
          {t('settings.billing.order.renderingHint', {
            number: invoice.number,
          })}
        </span>
      </span>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="pill"
      icon={<FileDown />}
      loading={fetching}
      loadingLabel={t(
        invoice.invoiceGenerated
          ? 'settings.billing.order.fetching'
          : 'settings.billing.order.generating',
      )}
      aria-label={t('settings.billing.order.pdfLabel', {
        number: invoice.number,
      })}
      onClick={() => {
        void onOpen(invoice)
      }}
    >
      PDF
    </Button>
  )
}

/** What the section says above the table after a per-row action answered. */
interface InvoiceNotice {
  readonly tone: 'info' | 'danger'
  readonly title: string
  readonly body: string
}

function InvoiceHistory({
  invoices,
  unavailable,
  hasCustomer,
  canManage,
  portalPending,
  onOpenPortal,
}: {
  invoices: ReadonlyArray<InvoiceSummary>
  /** Polar did not answer for the orders. Plan and usage are still live. */
  unavailable: boolean
  hasCustomer: boolean
  canManage: boolean
  portalPending: boolean
  onOpenPortal: () => void
}) {
  const t = useTranslate()
  const locale = useLocale()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<InvoiceNotice | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (retryTimer.current !== null) clearTimeout(retryTimer.current)
    },
    [],
  )

  /**
   * Resolve one order's PDF on click.
   *
   * The tab is opened by the click itself and pointed at the signed URL once
   * Polar has produced the document, because a popup opened after an await is
   * blocked. When the browser refuses the tab anyway, the current one is used.
   * A document Polar has not finished rendering is a state, not a failure: the
   * row says so and the action comes back on its own.
   */
  async function openInvoice(invoice: InvoiceSummary): Promise<void> {
    setPendingId(invoice.id)
    setNotice(null)
    const tab = window.open('about:blank', '_blank')
    if (tab !== null) tab.opener = null
    try {
      const result = await downloadInvoice({ data: { orderId: invoice.id } })
      if (result.state === 'ready') {
        if (tab === null) window.location.assign(result.url)
        else tab.location.replace(result.url)
        return
      }

      tab?.close()
      setGeneratingId(invoice.id)
      setNotice({
        tone: 'info',
        title: t('settings.billing.order.stillWritingTitle'),
        body: t('settings.billing.order.stillWritingBody', {
          number: invoice.number,
        }),
      })
      if (retryTimer.current !== null) clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null
        setGeneratingId(null)
      }, result.retryAfterMs)
    } catch (cause) {
      tab?.close()
      setNotice({
        tone: 'danger',
        title: t('settings.billing.order.openFailed'),
        body: messageOf(t, cause),
      })
    } finally {
      setPendingId(null)
    }
  }

  const portalAction =
    canManage && hasCustomer ? (
      <Button
        variant="secondary"
        size="sm"
        shape="pill"
        icon={<Receipt />}
        iconAfter={<ExternalLink data-mirror-rtl />}
        loading={portalPending}
        loadingLabel={t('settings.billing.portal.opening')}
        onClick={onOpenPortal}
      >
        {t('settings.billing.orders.receipts')}
      </Button>
    ) : null

  // Polar failing is a state of *this section*, not of the page. Leading the
  // screen with a warning banner made a working subscription look broken; the
  // plan, the usage meters and the plan picker above are all live either way.
  if (unavailable) {
    return (
      <SettingsSection
        title={t('settings.billing.orders.title')}
        description={t('settings.billing.orders.description')}
      >
        <EmptyState
          tone="warning"
          variant="filled"
          icon={<Receipt />}
          title={t('settings.billing.orders.unavailableTitle')}
          description={t('settings.billing.orders.unavailableBody')}
          action={portalAction}
        />
      </SettingsSection>
    )
  }

  if (invoices.length === 0) {
    return (
      <SettingsSection
        title={t('settings.billing.orders.title')}
        description={t('settings.billing.orders.description')}
        actions={portalAction}
      >
        <EmptyState
          variant="dashed"
          icon={<FileText />}
          title={t('settings.billing.orders.emptyTitle')}
          description={t(
            hasCustomer
              ? 'settings.billing.orders.emptyCustomer'
              : 'settings.billing.orders.emptyNoCustomer',
          )}
        />
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title={t('settings.billing.orders.title')}
      description={t('settings.billing.orders.description')}
      actions={portalAction}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-4">
        {notice === null ? null : (
          <Alert tone={notice.tone} title={notice.title} size="sm">
            {notice.body}
          </Alert>
        )}

        {/*
          Two layouts rather than one that scrolls. A five-column table at
          360px is a desktop table with a scrollbar bolted on: the date wraps
          to three lines and the status badge sits off-screen. The stack below
          is the same data read top to bottom, and the table takes over the
          moment there is room for it.
        */}
        <ul className="flex flex-col gap-2 sm:hidden">
          {invoices.map((invoice) => {
            const badge = INVOICE_TONES[invoice.status]
            return (
              <li
                key={invoice.id}
                className="rounded-lg border border-edge-faint bg-surface-2 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-label font-medium break-all text-ink tabular-nums">
                    {invoice.number}
                  </p>
                  <p className="shrink-0 text-label font-semibold text-ink tabular-nums">
                    {formatMoneyMinor(invoice.total, invoice.currency, locale)}
                  </p>
                </div>
                <p className="mt-0.5 text-caption text-ink-3 tabular-nums">
                  {formatDate(invoice.createdAt, locale) ??
                    t('settings.billing.orders.dateUnknown')}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Badge tone={badge.tone} size="sm">
                    {t(badge.label)}
                  </Badge>
                  <InvoiceDocument
                    invoice={invoice}
                    fetching={pendingId === invoice.id}
                    generating={generatingId === invoice.id}
                    onOpen={openInvoice}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <div className="hidden sm:block">
          <Table
            label={t('settings.billing.orders.tableLabel')}
            containerClassName="-mx-1"
          >
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.billing.invoices.number')}</TableHead>
                <TableHead>{t('settings.billing.invoices.date')}</TableHead>
                <TableHead numeric>
                  {t('settings.billing.invoices.amount')}
                </TableHead>
                <TableHead>{t('settings.billing.invoices.status')}</TableHead>
                <TableHead className="sr-only">
                  {t('settings.billing.orders.document')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const badge = INVOICE_TONES[invoice.status]
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium break-all text-ink tabular-nums">
                      {invoice.number}
                    </TableCell>
                    <TableCell muted className="whitespace-nowrap">
                      {formatDate(invoice.createdAt, locale) ??
                        t('settings.billing.orders.dateUnknown')}
                    </TableCell>
                    <TableCell numeric>
                      {formatMoneyMinor(
                        invoice.total,
                        invoice.currency,
                        locale,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={badge.tone} size="sm">
                        {t(badge.label)}
                      </Badge>
                    </TableCell>
                    <TableCell align="end">
                      <InvoiceDocument
                        invoice={invoice}
                        fetching={pendingId === invoice.id}
                        generating={generatingId === invoice.id}
                        onOpen={openInvoice}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
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

      <Card className="space-y-3">
        <Bar className="h-4 w-28" />
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4">
            <Bar className="h-3 w-28" />
            <Bar className="h-3 w-20" />
            <Bar className="h-3 w-16" />
            <Bar className="h-5 w-14" />
          </div>
        ))}
      </Card>
    </div>
  )
}
