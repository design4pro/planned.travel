/**
 * The four figures the costs screen opens with.
 *
 * Three of them are signed money, so the sign is what carries the hue: what you
 * owe is red, what you are owed is green, and a settled zero is neutral, because a
 * cleared balance is not a warning. The fourth is the trip's whole spend on the one
 * inverse tile the screen is allowed.
 *
 * Each of the first three names the people behind the number, which the reference
 * only does for one of them — a figure with no counterparty is a figure you cannot
 * act on.
 */
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Coins } from 'lucide-react'

import { Avatar, StatCard } from '#/components/ui'
import { formatMoney } from '#/lib/money'
import { dailySeries } from '#/components/costs'
import { pluralise } from '../../../-lib/format'

import type { CostsSnapshot, CostsTotals } from '#/components/costs'
import type { CostsPerson } from '#/server/fns/costs'

export interface StatTilesProps {
  readonly snapshot: CostsSnapshot
  readonly totals: CostsTotals
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
  readonly currency: string
  readonly budgetTargetMinor: number | null
  readonly plannedMinor: number
}

export function StatTiles({
  snapshot,
  totals,
  people,
  viewerUserId,
  currency,
  budgetTargetMinor,
  plannedMinor,
}: StatTilesProps) {
  const nameOf = (userId: string): string =>
    people.find((person) => person.userId === userId)?.name ?? 'Removed traveller'

  const creditors = snapshot.suggestions.filter((row) => row.fromUserId === viewerUserId)
  const debtors = snapshot.suggestions.filter((row) => row.toUserId === viewerUserId)
  const series = dailySeries(snapshot.expenses)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<ArrowDownLeft />}
        label="You owe"
        value={formatMoney(totals.owesMinor, currency)}
        valueTone={totals.owesMinor === 0 ? 'default' : 'danger'}
        caption={
          totals.owesMinor === 0
            ? 'You are all settled up'
            : 'Settle before you fly home'
        }
        footer={
          <PeopleLine
            prefix="To"
            userIds={creditors.map((row) => row.toUserId)}
            nameOf={nameOf}
            people={people}
          />
        }
      />
      <StatCard
        icon={<ArrowUpRight />}
        label="You're owed"
        value={formatMoney(totals.owedMinor, currency)}
        valueTone={totals.owedMinor === 0 ? 'default' : 'success'}
        caption={
          totals.owedMinor === 0 ? 'Nothing owed to you' : 'Still to come back to you'
        }
        footer={
          <PeopleLine
            prefix="From"
            userIds={debtors.map((row) => row.fromUserId)}
            nameOf={nameOf}
            people={people}
          />
        }
      />
      <StatCard
        icon={<CircleAlert />}
        label="Outstanding"
        value={formatMoney(totals.unclaimedMinor, currency)}
        valueTone={totals.unclaimedMinor === 0 ? 'default' : 'warning'}
        caption={
          totals.unclaimedCount === 0
            ? 'Every expense has a payer'
            : `${pluralise(totals.unclaimedCount, 'expense')} with no payer yet`
        }
      />
      <StatCard
        tone="inverse"
        icon={<Coins />}
        label="Total trip spend"
        value={formatMoney(snapshot.spentMinor, currency)}
        sparkline={series.length > 1 ? series : undefined}
        caption={
          budgetTargetMinor === null || budgetTargetMinor === 0
            ? `Planned ${formatMoney(plannedMinor, currency)} across all travellers`
            : `${formatMoney(budgetTargetMinor, currency)} budgeted for the trip`
        }
        footer={
          <div className="w-full">
            {/* No budget bar here on purpose: the track token is drawn for a light
                surface and this tile is the inverse one. The budget's progress
                lives under "By category", on a surface built for it. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="min-w-0">
                <dt className="truncate text-micro font-semibold uppercase tracking-label text-inverse-muted">
                  Your share
                </dt>
                <dd className="truncate text-label font-semibold tabular-nums text-inverse-on">
                  {formatMoney(totals.viewerShareMinor, currency)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="truncate text-micro font-semibold uppercase tracking-label text-inverse-muted">
                  You paid
                </dt>
                <dd className="truncate text-label font-semibold tabular-nums text-inverse-on">
                  {formatMoney(totals.viewerPaidMinor, currency)}
                </dd>
              </div>
            </dl>
          </div>
        }
      />
    </div>
  )
}

/** `To [A] Anna` — the counterparties behind a balance, at most two of them named. */
function PeopleLine({
  prefix,
  userIds,
  nameOf,
  people,
}: {
  prefix: string
  userIds: ReadonlyArray<string>
  nameOf: (userId: string) => string
  people: ReadonlyArray<CostsPerson>
}) {
  if (userIds.length === 0) {
    return null
  }
  const shown = userIds.slice(0, 2)
  const extra = userIds.length - shown.length

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-caption text-ink-3">
      <span className="shrink-0">{prefix}</span>
      {shown.map((userId) => (
        <span
          key={userId}
          className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2 pl-0.5"
        >
          <Avatar
            name={nameOf(userId)}
            src={people.find((person) => person.userId === userId)?.image}
            size="xs"
          />
          <span className="truncate font-medium text-ink-2">{nameOf(userId)}</span>
        </span>
      ))}
      {extra > 0 ? <span className="shrink-0 tabular-nums">+{extra}</span> : null}
    </span>
  )
}
