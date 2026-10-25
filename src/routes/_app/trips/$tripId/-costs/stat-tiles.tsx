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
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import {
  MemberBar,
  dailySeries,
  findPerson,
  memberShares,
} from '#/components/costs'

import type { CostsSnapshot, CostsTotals } from '#/components/costs'
import type { CostsDepartedPerson, CostsPerson } from '#/server/fns/costs'

export interface StatTilesProps {
  readonly snapshot: CostsSnapshot
  readonly totals: CostsTotals
  readonly people: ReadonlyArray<CostsPerson>
  readonly departedPeople: ReadonlyArray<CostsDepartedPerson>
  readonly viewerUserId: string
  readonly currency: string
  readonly budgetTargetMinor: number | null
  readonly plannedMinor: number
}

export function StatTiles({
  snapshot,
  totals,
  people,
  departedPeople,
  viewerUserId,
  currency,
  budgetTargetMinor,
  plannedMinor,
}: StatTilesProps) {
  const locale = useLocale()
  const t = useTranslate()
  const nameOf = (userId: string): string =>
    userId === viewerUserId
      ? t('costs.person.you')
      : (findPerson(people, departedPeople, userId)?.name ??
        t('costs.person.removed'))
  const imageOf = (userId: string): string | null =>
    findPerson(people, departedPeople, userId)?.image ?? null

  const creditors = snapshot.suggestions.filter(
    (row) => row.fromUserId === viewerUserId,
  )
  const debtors = snapshot.suggestions.filter(
    (row) => row.toUserId === viewerUserId,
  )
  const series = dailySeries(snapshot.expenses)
  const members = memberShares(snapshot.expenses).map((member) => ({
    ...member,
    name: nameOf(member.userId),
  }))

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<ArrowDownLeft />}
        label={t('costs.tile.owe.label')}
        value={formatMoney(totals.owesMinor, currency, locale)}
        valueTone={totals.owesMinor === 0 ? 'default' : 'danger'}
        caption={
          totals.owesMinor === 0
            ? t('costs.tile.owe.settled')
            : t('costs.tile.owe.pending')
        }
        footer={
          <PeopleLine
            prefix={t('costs.tile.owe.to')}
            userIds={creditors.map((row) => row.toUserId)}
            nameOf={nameOf}
            imageOf={imageOf}
          />
        }
      />
      <StatCard
        icon={<ArrowUpRight />}
        label={t('costs.tile.owed.label')}
        value={formatMoney(totals.owedMinor, currency, locale)}
        valueTone={totals.owedMinor === 0 ? 'default' : 'success'}
        caption={
          totals.owedMinor === 0
            ? t('costs.tile.owed.none')
            : t('costs.tile.owed.pending')
        }
        footer={
          <PeopleLine
            prefix={t('costs.tile.owed.from')}
            userIds={debtors.map((row) => row.fromUserId)}
            nameOf={nameOf}
            imageOf={imageOf}
          />
        }
      />
      <StatCard
        icon={<CircleAlert />}
        label={t('costs.tile.outstanding.label')}
        value={formatMoney(totals.unclaimedMinor, currency, locale)}
        valueTone={totals.unclaimedMinor === 0 ? 'default' : 'warning'}
        caption={
          totals.unclaimedCount === 0
            ? t('costs.tile.outstanding.none')
            : t('costs.tile.outstanding.some', {
                count: totals.unclaimedCount,
                expenses: formatNumber(totals.unclaimedCount, locale),
              })
        }
      />
      <StatCard
        tone="inverse"
        icon={<Coins />}
        label={t('costs.totalTile.label')}
        value={formatMoney(snapshot.spentMinor, currency, locale)}
        sparkline={series.length > 1 ? series : undefined}
        caption={
          budgetTargetMinor === null || budgetTargetMinor === 0
            ? t('costs.totalTile.captionPlanned', {
                amount: formatMoney(plannedMinor, currency, locale),
              })
            : t('costs.totalTile.captionBudget', {
                amount: formatMoney(budgetTargetMinor, currency, locale),
              })
        }
        footer={
          <div className="flex w-full flex-col gap-3">
            <MemberBar members={members} spentMinor={snapshot.spentMinor} />
            {/* No budget bar here on purpose: the track token is drawn for a light
                surface and this tile is the inverse one. The budget's progress
                lives under "By category", on a surface built for it. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="min-w-0">
                <dt className="text-micro font-semibold uppercase tracking-label text-inverse-muted [overflow-wrap:anywhere]">
                  {t('costs.totalTile.yourShare')}
                </dt>
                <dd className="truncate text-label font-semibold tabular-nums text-inverse-on">
                  {formatMoney(totals.viewerShareMinor, currency, locale)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-micro font-semibold uppercase tracking-label text-inverse-muted [overflow-wrap:anywhere]">
                  {t('costs.totalTile.youPaid')}
                </dt>
                <dd className="truncate text-label font-semibold tabular-nums text-inverse-on">
                  {formatMoney(totals.viewerPaidMinor, currency, locale)}
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
  imageOf,
}: {
  prefix: string
  userIds: ReadonlyArray<string>
  nameOf: (userId: string) => string
  imageOf: (userId: string) => string | null
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
          className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pe-2 ps-0.5"
        >
          <Avatar name={nameOf(userId)} src={imageOf(userId)} size="xs" />
          <span className="truncate font-medium text-ink-2">
            {nameOf(userId)}
          </span>
        </span>
      ))}
      {extra > 0 ? (
        <span className="shrink-0 tabular-nums">+{extra}</span>
      ) : null}
    </span>
  )
}
