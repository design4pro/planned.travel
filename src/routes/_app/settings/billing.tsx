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
  downloadInvoice,
  loadBilling,
  openBillingPortal,
  startPlanChange,
} from '../-server/billing'
import { SettingsSection } from '../-ui/settings-nav'

import type { BadgeTone } from '#/components/ui'
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
function messageOf(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.trim() : ''
  const readable =
    message !== '' &&
    message.length <= MAX_FAILURE_MESSAGE &&
    !message.startsWith('[') &&
    !message.startsWith('{')
  return readable
    ? message
    : 'The billing provider rejected that request. Try again in a moment.'
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

/**
 * The one line under the plan name that says what happens next, and when.
 *
 * The trial lines are deliberately not the ones a card-optional provider would
 * write. Polar collects a payment method at checkout and charges it when the
 * trial ends unless the customer cancels first, so the honest sentence is when
 * the charge lands — not an invitation to "add a card later" that the customer
 * has already been through.
 */
function renewalLine(state: Entitlements): string {
  const on = formatDate(state.currentPeriodEnd)

  if (state.trialing) {
    const left = daysFromNow(state.trialEndsAt)
    if (left !== null && left >= 0) {
      return left === 0
        ? 'Your trial ends today. The first charge follows unless you cancel before then.'
        : `Your trial ends in ${left} ${left === 1 ? 'day' : 'days'}, and the first charge follows unless you cancel before then.`
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
      return 'The last payment did not go through. Update your card in the billing portal to avoid losing the paid modules.'
    case 'unpaid':
      return 'This subscription is unpaid and the paid modules are locked.'
    case 'paused':
      return 'This subscription is paused. Resume it whenever you are ready to travel again.'
    case 'canceled':
    case 'incomplete_expired':
      return 'Choose a plan below to unlock reservations, the journal and offline maps again.'
    case 'incomplete':
      return 'Polar has not confirmed this payment yet.'
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

/** Which section a failed provider call belongs to, so it is shown in place. */
type FailureScope = 'plan' | 'portal'

interface Failure {
  readonly scope: FailureScope
  readonly message: string
}

/** The single portal action's pending key. Polar mints one URL, so there is one. */
const PORTAL_KEY = 'portal'

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
      setFailure({ scope, message: messageOf(cause) })
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
          title="Payment received"
          actions={<RefreshButton onClick={refresh} />}
        >
          Your new plan is being applied. It appears here the moment Polar
          confirms it — usually within a few seconds.
        </Alert>
      ) : null}

      {search.checkout === 'cancelled' ? (
        <Alert tone="neutral" title="Checkout cancelled">
          Nothing was charged and your plan has not changed.
        </Alert>
      ) : null}

      {search.plan === 'changed' ? (
        <Alert
          tone="success"
          title="Plan updated"
          actions={<RefreshButton onClick={refresh} />}
        >
          The change is already in force with Polar, who will invoice the
          difference. The summary below catches up within a minute.
        </Alert>
      ) : null}

      {search.portal === 'complete' ? (
        <Alert
          tone="info"
          title="Back from the billing portal"
          actions={<RefreshButton onClick={refresh} />}
        >
          Anything you changed there lands here as soon as Polar confirms it.
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
        failure={failure?.scope === 'portal' ? failure.message : null}
        onManageBilling={openPortal}
      />

      <UsageMeters state={state} />

      <SettingsSection
        title="Plans"
        description="Change plan whenever you like. Upgrades are invoiced immediately and prorated to the day; a downgrade waits until the period you have paid for is over."
        actions={<IntervalToggle value={interval} onChange={setInterval} />}
      >
        <div className="flex flex-col gap-4">
          {failure?.scope === 'plan' ? (
            <Alert tone="danger" title="That change was not applied" size="sm">
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
  return (
    <Button variant="ghost" size="sm" shape="pill" onClick={onClick}>
      Refresh
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
                iconAfter={<ExternalLink />}
                disabled={!state.hasProviderCustomer}
                loading={pending === PORTAL_KEY}
                loadingLabel="Opening the billing portal"
                aria-describedby={hintId}
                onClick={onManageBilling}
              >
                Manage billing
              </Button>
              <p
                id={hintId}
                className="max-w-[40ch] text-caption leading-relaxed text-inverse-muted lg:text-right"
              >
                {state.hasProviderCustomer
                  ? 'Cards, billing address, VAT number, receipts and cancellation live with Polar, who issues the invoice.'
                  : 'There is no billing profile yet. Choosing a paid plan below creates one, and the portal opens from then on.'}
              </p>
              {failure === null ? null : (
                <p
                  role="alert"
                  className="max-w-[40ch] rounded-lg bg-danger-soft px-2.5 py-1.5 text-caption leading-relaxed text-danger lg:text-right"
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
  plan: Plan,
  chosen: number,
  members: number,
): string | null {
  if (!plan.seatBased) return null
  const max = plan.seatRange.max
  if (max !== null && members > max) {
    const over = members - max
    return `This workspace has ${members} members and ${plan.name} bills at most ${max}. Remove ${over} ${over === 1 ? 'member' : 'members'} before switching.`
  }
  if (chosen < members) {
    return `You have ${members} members. Choose at least ${members} seats — Polar rejects a subscription with fewer seats than assignments.`
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
    : seatProblem(plan, seatCount, state.usage.seats)

  const label = isCurrent
    ? 'Current plan'
    : isFree
      ? 'Cancel in the portal'
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
          <Field
            label="Members"
            hint="Change it any time — billing follows."
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
          disabled={!canManage || isCurrent || seatError !== null}
          loading={busy}
          loadingLabel={isFree ? 'Opening the billing portal' : 'Opening Polar'}
          iconAfter={
            isCurrent ? undefined : isFree ? <ExternalLink /> : <ArrowUpRight />
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
    readonly label: string
    readonly tone: BadgeTone
  }
} = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'info' },
  partially_refunded: { label: 'Part refunded', tone: 'info' },
  void: { label: 'Void', tone: 'neutral' },
}

const INVOICE_DESCRIPTION = 'Every order for this workspace, newest first.'

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
  if (invoice.status === 'draft') {
    return (
      <>
        <span aria-hidden className="text-caption text-ink-4">
          &mdash;
        </span>
        <span className="sr-only">No invoice while this order is a draft</span>
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
        Preparing
        <span className="sr-only">
          Polar is still rendering invoice {invoice.number}. The download
          returns in a few seconds.
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
      loadingLabel={
        invoice.invoiceGenerated
          ? 'Fetching the invoice'
          : 'Polar is preparing the invoice'
      }
      onClick={() => {
        void onOpen(invoice)
      }}
    >
      <span className="sr-only">Invoice {invoice.number} as </span>
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
        title: 'Polar is still writing that invoice',
        body: `Invoice ${invoice.number} is being rendered. The download comes back on its own in a few seconds.`,
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
        title: 'That invoice did not open',
        body: messageOf(cause),
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
        iconAfter={<ExternalLink />}
        loading={portalPending}
        loadingLabel="Opening the billing portal"
        onClick={onOpenPortal}
      >
        All receipts
      </Button>
    ) : null

  // Polar failing is a state of *this section*, not of the page. Leading the
  // screen with a warning banner made a working subscription look broken; the
  // plan, the usage meters and the plan picker above are all live either way.
  if (unavailable) {
    return (
      <SettingsSection title="Orders" description={INVOICE_DESCRIPTION}>
        <EmptyState
          tone="warning"
          variant="filled"
          icon={<Receipt />}
          title="Orders are not loading"
          description="Polar did not answer in time for the history. Everything above is live — try again in a moment, or read the full record in the billing portal."
          action={portalAction}
        />
      </SettingsSection>
    )
  }

  if (invoices.length === 0) {
    return (
      <SettingsSection
        title="Orders"
        description={INVOICE_DESCRIPTION}
        actions={portalAction}
      >
        <EmptyState
          variant="dashed"
          icon={<FileText />}
          title="No orders yet"
          description={
            hasCustomer
              ? 'The first invoice appears here as soon as a billing period closes.'
              : 'This workspace has never been charged. Choose a paid plan and the invoices collect here.'
          }
        />
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Orders"
      description={INVOICE_DESCRIPTION}
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
                    {formatMoneyMinor(invoice.total, invoice.currency)}
                  </p>
                </div>
                <p className="mt-0.5 text-caption text-ink-3 tabular-nums">
                  {formatDate(invoice.createdAt) ?? 'Date unknown'}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Badge tone={badge.tone} size="sm">
                    {badge.label}
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
          <Table label="Order history" containerClassName="-mx-1">
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Document</TableHead>
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
                      {formatDate(invoice.createdAt) ?? 'Date unknown'}
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
