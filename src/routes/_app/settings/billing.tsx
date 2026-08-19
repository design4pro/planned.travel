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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import {
  BILLING_INTERVALS,
  FREE_PLAN,
  PLANS,
  PLAN_LIST,
  QUOTA_KEYS,
  QUOTA_LABELS,
  clampSeats,
  formatPlanAmount,
  formatQuota,
  formatQuotaUsage,
  isUnlimited,
  monthlyEquivalent,
  planById,
  yearlySavingPercent,
} from '#/lib/plans'
import { formatDate, formatMoneyMinor } from '../-lib/format'
import {
  loadBilling,
  openBillingPortal,
  startPlanChange,
} from '../-server/billing'
import { SettingsSection } from '../-ui/settings-nav'

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
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="Billing did not load" />
  ),
  component: BillingPage,
})

/* ------------------------------------------------------------------ helpers */

/** Where a plan sits in the catalogue — how upgrade is told from downgrade. */
function rankOf(planId: Plan['id']): number {
  return PLAN_LIST.findIndex((plan) => plan.id === planId)
}

const STATUS_BADGES: {
  readonly [K in BillingState]: {
    label: string
    tone: 'success' | 'warning' | 'danger' | 'neutral' | 'brand'
  }
} = {
  none: { label: 'No subscription', tone: 'neutral' },
  trialing: { label: 'Trial', tone: 'brand' },
  active: { label: 'Active', tone: 'success' },
  past_due: { label: 'Payment failed', tone: 'warning' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
  paused: { label: 'Paused', tone: 'neutral' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  incomplete_expired: { label: 'Expired', tone: 'neutral' },
}

/** Days from now until an ISO instant, floored. Negative once it has passed. */
function daysFromNow(iso: string | null): number | null {
  if (iso === null) return null
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  return Math.floor((at - Date.now()) / 86_400_000)
}

/** The one line under the plan name that says what happens next, and when. */
function renewalLine(state: Entitlements): string {
  const on = formatDate(state.currentPeriodEnd)

  if (state.trialing) {
    const left = daysFromNow(state.trialEndsAt)
    if (left !== null && left >= 0) {
      return left === 0
        ? 'Your trial ends today. Add a card to keep every module unlocked.'
        : `Your trial ends in ${left} ${left === 1 ? 'day' : 'days'}. No card needed until then.`
    }
    return 'Your trial has ended.'
  }

  if (state.cancelAtPeriodEnd) {
    return on === null
      ? 'This plan is set to end and will not renew.'
      : `This plan ends on ${on}. Nothing is deleted — the paid modules simply lock.`
  }

  switch (state.status) {
    case 'past_due':
      return 'The last payment did not go through. Update your card to avoid losing the paid modules.'
    case 'unpaid':
      return 'This subscription is unpaid and the paid modules are locked.'
    case 'paused':
      return 'This subscription is paused. Resume it whenever you are ready to travel again.'
    case 'canceled':
    case 'incomplete_expired':
      return 'Choose a plan below to unlock reservations, the journal and offline maps again.'
    case 'incomplete':
      return 'Stripe is still waiting for this payment to be confirmed.'
    case 'none':
      return 'Two trips at a time, on the house. Upgrade whenever you outgrow it.'
    case 'active':
    case 'trialing':
      return on === null ? 'Renews automatically.' : `Renews on ${on}.`
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

const QUOTA_NOUN: Record<QuotaKey, string> = {
  seats: 'seat',
  trips: 'trip slot',
  storageBytes: 'byte',
}

function quotaHint(key: QuotaKey, quota: QuotaState): string {
  if (isUnlimited(quota.limit)) return 'No limit on this plan'
  // Being *over* a limit and being exactly *at* one are different situations, and
  // a workspace that inherited members from a richer plan is genuinely over.
  // Telling it "you have used every seat" understated the problem by three seats.
  if (quota.used > quota.limit) {
    const over = quota.used - quota.limit
    return key === 'storageBytes'
      ? `${formatQuotaUsage(key, over)} over this plan's limit`
      : `${over} ${QUOTA_NOUN[key]}${over === 1 ? '' : 's'} over this plan's limit`
  }
  if (quota.remaining === null || quota.remaining === 0) {
    return `You have used every ${QUOTA_NOUN[key]} on this plan`
  }
  return `${formatQuotaUsage(key, quota.remaining)} left`
}

/* --------------------------------------------------------------------- page */

function BillingPage() {
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

  /** Hands the browser to Stripe, keeping the button that asked in a pending state. */
  async function goToStripe(
    key: string,
    run: () => Promise<{ url: string }>,
  ): Promise<void> {
    setPending(key)
    try {
      const { url } = await run()
      window.location.assign(url)
    } catch (cause) {
      setPending(null)
      toast.error('Stripe could not be reached', {
        description:
          cause instanceof Error
            ? cause.message
            : 'Check your connection and try again in a moment.',
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
          title="Payment received"
          actions={
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                void router.invalidate()
              }}
            >
              Refresh
            </Button>
          }
        >
          Your new plan is being applied. It appears here the moment Stripe
          confirms it — usually within a few seconds.
        </Alert>
      ) : null}

      {search.checkout === 'cancelled' ? (
        <Alert tone="neutral" title="Checkout cancelled">
          Nothing was charged and your plan has not changed.
        </Alert>
      ) : null}

      {search.portal === true ? (
        <Alert
          tone="info"
          title="Back from Stripe"
          actions={
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                void router.invalidate()
              }}
            >
              Refresh
            </Button>
          }
        >
          Anything you changed there lands here as soon as Stripe confirms it.
        </Alert>
      ) : null}

      {data.canManage ? null : (
        <Alert
          tone="info"
          title="You are a member of this workspace"
          icon={<Lock />}
        >
          Only an owner or an admin can change the subscription. Everything
          below is read-only for you.
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
        title="Plans"
        description="Change plan whenever you like. Upgrades are prorated to the day; a downgrade waits until the period you have paid for is over."
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
            Current plan
          </SectionLabel>

          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-title font-bold tracking-tight text-inverse-on">
              {plan.name}
            </h2>
            <Badge tone={badge.tone} size="sm" dot>
              {badge.label}
            </Badge>
            {state.cancelAtPeriodEnd ? (
              <Badge tone="inverse" size="sm">
                Ends at period close
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 max-w-prose text-label leading-relaxed text-inverse-muted">
            {renewalLine(state)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
          <div className="lg:text-right">
            <p className="flex items-baseline gap-1.5 lg:justify-end">
              <span className="font-display text-display leading-none font-extrabold tracking-tighter tabular-nums text-inverse-on">
                {price === null
                  ? 'Free'
                  : formatPlanAmount(total, price.currency)}
              </span>
              {price === null ? null : (
                <span className="text-subtitle font-medium text-inverse-muted">
                  {price.interval === 'yearly' ? '/ year' : '/ month'}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-caption tabular-nums text-inverse-muted">
              {price === null
                ? // The trip ceiling in force, not the catalogue's: a free workspace
                  // can legitimately have been given head-room by hand.
                  `${formatQuota('trips', state.limits.trips)} trips, one traveller`
                : price.perSeat
                  ? `${state.seats} members × ${formatPlanAmount(price.amount, price.currency)}`
                  : 'One traveller'}
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
                loadingLabel="Opening Stripe"
                onClick={onManagePayment}
              >
                Payment method
              </Button>
              {paid ? (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  className="text-inverse-muted hover:bg-inverse-surface hover:text-inverse-on"
                  loading={pending === 'portal:cancel'}
                  loadingLabel="Opening Stripe"
                  onClick={onCancel}
                >
                  Cancel plan
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
  return (
    <SettingsSection
      title="Usage"
      description="Counted live, so a meter is never stale. Limits follow the plan in force right now."
    >
      <div className="flex flex-col gap-5">
        {QUOTA_KEYS.map((key) => {
          const quota = state.quotas[key]
          const unlimited = isUnlimited(quota.limit)
          return (
            <div key={key} className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-label font-medium text-ink">
                  {QUOTA_LABELS[key]}
                </p>
                <p className="flex items-baseline gap-1.5 text-caption tabular-nums text-ink-3">
                  <span className="font-semibold text-ink">
                    {formatQuotaUsage(key, quota.used)}
                  </span>
                  <span aria-hidden>/</span>
                  {unlimited ? (
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon aria-hidden className="size-3.5" />
                      Unlimited
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
                  aria-label={`${QUOTA_LABELS[key]} used`}
                />
              )}

              <p
                className={cn(
                  'mt-1.5 text-caption',
                  quota.exceeded ? 'text-danger' : 'text-ink-4',
                )}
              >
                {quotaHint(key, quota)}
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
  const saving = Math.max(...PLAN_LIST.map(yearlySavingPercent))

  return (
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
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold focus-ring',
              'transition-[background-color,color,box-shadow] duration-base ease-out-quint',
              active
                ? 'bg-track-thumb text-ink shadow-card'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option === 'monthly' ? 'Monthly' : 'Yearly'}
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

const SEAT_OPTION_LABEL = (count: number): string => `${count} members`

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
  const price = plan.prices[interval]
  const isCurrentPlan = plan.id === state.planId
  const isCurrent =
    isCurrentPlan && (price === null || billedInterval(state) === interval)
  const delta = rankOf(plan.id) - rankOf(state.planId)
  const busy = pending === `plan:${plan.id}` || pending === 'portal:cancel'

  const seatCount = plan.seatBased ? seats : plan.seatRange.min
  const total =
    price === null ? 0 : price.amount * (price.perSeat ? seatCount : 1)

  const label = isCurrent
    ? 'Current plan'
    : plan.id === FREE_PLAN.id
      ? 'Move to Free'
      : isCurrentPlan
        ? interval === 'yearly'
          ? 'Switch to yearly'
          : 'Switch to monthly'
        : delta > 0
          ? `Upgrade to ${plan.name}`
          : `Change to ${plan.name}`

  const seatOptions = plan.seatBased
    ? Array.from(
        {
          length:
            (plan.seatRange.max ?? plan.seatRange.min) - plan.seatRange.min + 1,
        },
        (_, index) => {
          const count = plan.seatRange.min + index
          return { value: String(count), label: SEAT_OPTION_LABEL(count) }
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
              {plan.name}
            </h3>
            <p className="mt-0.5 text-caption text-ink-3">{plan.tagline}</p>
          </div>
          {isCurrent ? (
            <Badge tone="brand" size="sm" className="shrink-0">
              Current
            </Badge>
          ) : plan.recommended ? (
            <Badge tone="neutral" size="sm" className="shrink-0">
              Popular
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-title leading-none font-extrabold tracking-tighter tabular-nums text-ink">
              {price === null
                ? 'Free'
                : formatPlanAmount(monthlyEquivalent(price), price.currency)}
            </span>
            {price === null ? null : (
              <span className="text-caption font-medium text-ink-3">
                {price.perSeat ? '/ member / month' : '/ month'}
              </span>
            )}
          </p>
          <p className="mt-1 text-caption tabular-nums text-ink-4">
            {price === null
              ? 'Always free, no card'
              : interval === 'yearly'
                ? `${formatPlanAmount(total, price.currency)} billed yearly`
                : `${formatPlanAmount(total, price.currency)} billed monthly`}
          </p>
        </div>

        {plan.seatBased && !isCurrent ? (
          <Field label="Members" hint="Change it any time — billing follows.">
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
          {plan.features.slice(0, 4).map((feature) => (
            <li key={feature.label} className="flex min-w-0 gap-2">
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                <Check aria-hidden className="size-2.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 text-caption leading-relaxed text-ink-2">
                {feature.label}
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
          loadingLabel="Opening Stripe"
          iconAfter={isCurrent ? undefined : <ArrowUpRight />}
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
    label: string
    tone: 'success' | 'warning' | 'danger' | 'neutral'
  }
} = {
  paid: { label: 'Paid', tone: 'success' },
  open: { label: 'Due', tone: 'warning' },
  draft: { label: 'Draft', tone: 'neutral' },
  void: { label: 'Void', tone: 'neutral' },
  uncollectible: { label: 'Uncollectible', tone: 'danger' },
}

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
  const portalButton = canManage ? (
    <Button
      variant="secondary"
      size="sm"
      shape="pill"
      icon={<Receipt />}
      disabled={!hasCustomer}
      loading={pending === 'portal:home'}
      loadingLabel="Opening Stripe"
      onClick={onOpenPortal}
    >
      Billing portal
    </Button>
  ) : null

  // Stripe failing is a state of *this section*, not of the page. Leading the
  // screen with a warning banner made a working subscription look broken; the
  // plan, the usage meters and the plan picker above are all live either way.
  if (unavailable) {
    return (
      <SettingsSection
        title="Invoices"
        description="Every receipt for this workspace, newest first."
        actions={portalButton}
      >
        <EmptyState
          tone="warning"
          icon={<Receipt />}
          title="Receipts are not loading"
          description="Stripe did not answer in time for the history. Everything above is live; open the billing portal for the full record, or come back in a moment."
        />
      </SettingsSection>
    )
  }

  if (invoices.length === 0) {
    return (
      <SettingsSection
        title="Invoices"
        description="Every receipt for this workspace, newest first."
        actions={portalButton}
      >
        <EmptyState
          icon={<FileText />}
          title="No invoices yet"
          description={
            hasCustomer
              ? 'The first receipt appears here as soon as a billing period closes.'
              : 'This workspace has never been charged. Choose a paid plan and the receipts will collect here.'
          }
        />
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Invoices"
      description="Every receipt for this workspace, newest first."
      actions={portalButton}
      className="overflow-hidden"
    >
      <Table label="Invoice history" containerClassName="-mx-1">
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">Period</TableHead>
            <TableHead numeric>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="sr-only">Receipt</TableHead>
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
                  {formatDate(invoice.createdAt) ?? '—'}
                </TableCell>
                <TableCell muted className="hidden sm:table-cell">
                  {formatDate(invoice.periodStart) ?? '—'} —{' '}
                  {formatDate(invoice.periodEnd) ?? '—'}
                </TableCell>
                <TableCell numeric>
                  {formatMoneyMinor(invoice.total, invoice.currency)}
                </TableCell>
                <TableCell>
                  <Badge tone={badge.tone} size="sm">
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell align="end">
                  {invoice.hostedUrl === null && invoice.pdfUrl === null ? (
                    <span className="text-caption text-ink-4">—</span>
                  ) : (
                    <Button asChild variant="ghost" size="sm" shape="pill">
                      <a
                        href={invoice.hostedUrl ?? invoice.pdfUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        View
                        <ExternalLink aria-hidden />
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
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading billing</span>

      <Card
        variant="inverse"
        className="flex flex-col gap-6 lg:flex-row lg:justify-between"
      >
        <div className="space-y-3">
          <Bar className="h-2.5 w-24 bg-inverse-surface" />
          <Bar className="h-7 w-40 bg-inverse-surface" />
          <Bar className="h-3 w-64 bg-inverse-surface" />
        </div>
        <div className="space-y-3 lg:text-right">
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
