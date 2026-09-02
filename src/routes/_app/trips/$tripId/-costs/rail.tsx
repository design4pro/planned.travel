/**
 * The right-hand rail: who owes whom, where everyone stands, where the money went,
 * and what has already been paid back.
 *
 * The settle-up panel is the only place on the screen that both proposes an action
 * and performs it. Its transfers come from the repository's own greedy matching —
 * at most `travellers − 1` payments to clear the whole trip — so accepting one is
 * always a step towards zero rather than a guess.
 */
import { ArrowRight, Plus, Scale, Wallet } from 'lucide-react'

import { Avatar, Badge, Button, EmptyState, Progress } from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney, formatSignedMoney } from '#/lib/money'
import { formatDayLabel } from '#/components/costs'
import { Panel, PanelRow } from '../../../-ui/scaffold'
import { humaniseToken } from '../../../-lib/format'
import { categoryLabel } from './categories'
import { swatchFor } from '../../../-lib/tone'

import type { CostsSnapshot } from '#/components/costs'
import type {
  CostsBalance,
  CostsCategoryTotal,
  CostsPerson,
  CostsSettlement,
  CostsSuggestion,
} from '#/server/fns/costs'

export interface CostsRailProps {
  readonly snapshot: CostsSnapshot
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
  readonly currency: string
  readonly budgetTargetMinor: number | null
  readonly onSettle: (suggestion: CostsSuggestion) => void
  readonly onAddPayment: () => void
}

export function CostsRail({
  snapshot,
  people,
  viewerUserId,
  currency,
  budgetTargetMinor,
  onSettle,
  onAddPayment,
}: CostsRailProps) {
  const t = useTranslate()
  const nameOf = (userId: string): string =>
    people.find((person) => person.userId === userId)?.name ??
    t('costs.person.removed')
  const imageOf = (userId: string): string | null =>
    people.find((person) => person.userId === userId)?.image ?? null

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <SettleUp
        suggestions={snapshot.suggestions}
        viewerUserId={viewerUserId}
        currency={currency}
        nameOf={nameOf}
        imageOf={imageOf}
        onSettle={onSettle}
        onAddPayment={onAddPayment}
        busy={snapshot.busy}
      />
      <Balances
        balances={snapshot.balances}
        viewerUserId={viewerUserId}
        currency={currency}
        nameOf={nameOf}
        imageOf={imageOf}
      />
      <ByCategory
        rows={snapshot.byCategory}
        spentMinor={snapshot.spentMinor}
        budgetTargetMinor={budgetTargetMinor}
        currency={currency}
      />
      <Payments
        settlements={snapshot.settlements}
        currency={currency}
        nameOf={nameOf}
        viewerUserId={viewerUserId}
      />
    </aside>
  )
}

/* -------------------------------------------------------------------------- */

function SettleUp({
  suggestions,
  viewerUserId,
  currency,
  nameOf,
  imageOf,
  onSettle,
  onAddPayment,
  busy,
}: {
  suggestions: ReadonlyArray<CostsSuggestion>
  viewerUserId: string
  currency: string
  nameOf: (userId: string) => string
  imageOf: (userId: string) => string | null
  onSettle: (suggestion: CostsSuggestion) => void
  onAddPayment: () => void
  busy: boolean
}) {
  const locale = useLocale()
  const t = useTranslate()

  return (
    <Panel
      label={t('costs.settle.label')}
      count={suggestions.length === 0 ? undefined : String(suggestions.length)}
      action={
        <Button
          type="button"
          variant="subtle"
          size="sm"
          shape="pill"
          icon={<Plus aria-hidden strokeWidth={2.5} />}
          onClick={onAddPayment}
        >
          {t('costs.settle.addPayment')}
        </Button>
      }
      flush
    >
      {suggestions.length === 0 ? (
        <div className="px-5 py-7">
          <EmptyState
            size="sm"
            tone="brand"
            icon={<Scale />}
            title={t('costs.settle.empty.title')}
            description={t('costs.settle.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {suggestions.map((row) => {
            const mine =
              row.fromUserId === viewerUserId || row.toUserId === viewerUserId
            return (
              <li key={`${row.fromUserId}:${row.toUserId}`}>
                <PanelRow className="gap-2.5">
                  <Avatar
                    name={nameOf(row.fromUserId)}
                    src={imageOf(row.fromUserId)}
                    size="sm"
                  />
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-ink-4"
                  />
                  <Avatar
                    name={nameOf(row.toUserId)}
                    src={imageOf(row.toUserId)}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-caption font-medium text-ink">
                      {row.fromUserId === viewerUserId
                        ? t('costs.person.you')
                        : nameOf(row.fromUserId)}
                      {' → '}
                      {row.toUserId === viewerUserId
                        ? t('costs.person.youTarget')
                        : nameOf(row.toUserId)}
                    </p>
                    <p className="truncate text-caption font-semibold tabular-nums text-ink-2">
                      {formatMoney(row.amountMinor, currency, locale)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={mine ? 'primary' : 'secondary'}
                    size="sm"
                    shape="pill"
                    disabled={busy}
                    onClick={() => onSettle(row)}
                  >
                    {t('costs.settle.action')}
                  </Button>
                </PanelRow>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Balances, drawn as a diverging bar around a centre line.
 *
 * A left-anchored bar can only say "how much"; anchoring at the centre says "which
 * way" as well, so a reader can tell debtors from creditors without reading a
 * single figure. The sign is also spelled out in the amount, because colour and
 * direction alone are not enough.
 */
function Balances({
  balances,
  viewerUserId,
  currency,
  nameOf,
  imageOf,
}: {
  balances: ReadonlyArray<CostsBalance>
  viewerUserId: string
  currency: string
  nameOf: (userId: string) => string
  imageOf: (userId: string) => string | null
}) {
  const t = useTranslate()
  const locale = useLocale()
  const widest = Math.max(
    ...balances.map((row) => Math.abs(row.balanceMinor)),
    1,
  )

  return (
    <Panel
      label={t('costs.balances.label')}
      count={t('costs.balances.count', {
        count: balances.length,
        travellers: formatNumber(balances.length, locale),
      })}
    >
      {balances.length === 0 ? (
        <p className="text-caption text-ink-3">{t('costs.balances.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {balances.map((row) => {
            const positive = row.balanceMinor >= 0
            const width = `${(Math.abs(row.balanceMinor) / widest) * 50}%`
            return (
              <li key={row.userId} className="flex items-center gap-3">
                <Avatar
                  name={nameOf(row.userId)}
                  src={imageOf(row.userId)}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-caption font-medium text-ink">
                    {row.userId === viewerUserId
                      ? t('costs.person.you')
                      : nameOf(row.userId)}
                  </p>
                  <div
                    aria-hidden
                    className="relative mt-1.5 h-1.5 rounded-full bg-surface-inset"
                  >
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-edge" />
                    <span
                      className={cn(
                        'absolute inset-y-0 rounded-full',
                        positive
                          ? 'left-1/2 bg-success'
                          : 'right-1/2 bg-danger',
                      )}
                      style={{ width }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-caption font-semibold tabular-nums',
                    row.balanceMinor === 0
                      ? 'text-ink-3'
                      : positive
                        ? 'text-success'
                        : 'text-danger',
                  )}
                >
                  {formatSignedMoney(row.balanceMinor, currency, locale)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

function ByCategory({
  rows,
  spentMinor,
  budgetTargetMinor,
  currency,
}: {
  rows: ReadonlyArray<CostsCategoryTotal>
  spentMinor: number
  budgetTargetMinor: number | null
  currency: string
}) {
  const locale = useLocale()
  const visible = rows
    .filter((row) => row.spentMinor > 0 || row.plannedMinor > 0)
    .sort((left, right) => right.spentMinor - left.spentMinor)
  const total = Math.max(spentMinor, 1)
  const t = useTranslate()

  return (
    <Panel
      label={t('costs.categories.label')}
      count={formatMoney(spentMinor, currency, locale)}
      footer={
        budgetTargetMinor === null || budgetTargetMinor === 0 ? undefined : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-caption">
              <span className="text-ink-3">
                {t('costs.categories.againstBudget')}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {formatMoney(budgetTargetMinor, currency, locale)}
              </span>
            </div>
            <Progress
              value={spentMinor}
              max={budgetTargetMinor}
              size="xs"
              tone={spentMinor > budgetTargetMinor ? 'danger' : 'success'}
              aria-label={t('costs.categories.progressLabel')}
            />
          </div>
        )
      }
    >
      {visible.length === 0 ? (
        <p className="text-caption text-ink-3">{t('costs.categories.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row, index) => (
            <li key={row.category}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-caption text-ink-2">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      swatchFor(index),
                    )}
                  />
                  <span className="truncate">
                    {categoryLabel(row.category)}
                  </span>
                </span>
                <span className="shrink-0 text-caption font-semibold tabular-nums text-ink">
                  {formatMoney(row.spentMinor, currency, locale)}
                </span>
              </div>
              {/* Turned round for Arabic so the fill grows from the reading
                  start; `origin-left` on the child cannot be spelled logically. */}
              <div
                aria-hidden
                className="h-1.5 overflow-hidden rounded-full bg-surface-inset rtl:-scale-x-100"
              >
                <span
                  className={cn(
                    'block h-full origin-left rounded-full transition-[scale] duration-base ease-out-quint',
                    swatchFor(index),
                  )}
                  /* A value, not motion — see `costs/split-editor.tsx`. With
                     `data-motion-transform` and an inline `transform` this rail
                     showed every category at its full budget under
                     reduce-motion. */
                  style={{ scale: `${Math.min(row.spentMinor / total, 1)} 1` }}
                />
              </div>
              {row.plannedMinor === 0 ? null : (
                <p className="mt-1 text-caption tabular-nums text-ink-4">
                  {formatMoney(row.plannedMinor, currency, locale)} planned
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

function Payments({
  settlements,
  currency,
  nameOf,
  viewerUserId,
}: {
  settlements: ReadonlyArray<CostsSettlement>
  currency: string
  nameOf: (userId: string) => string
  viewerUserId: string
}) {
  const locale = useLocale()
  const t = useTranslate()

  return (
    <Panel
      label={t('costs.payments.label')}
      count={settlements.length === 0 ? undefined : String(settlements.length)}
      flush
    >
      {settlements.length === 0 ? (
        <div className="px-5 py-7">
          <EmptyState
            size="sm"
            icon={<Wallet />}
            title={t('costs.payments.empty.title')}
            description={t('costs.payments.empty.body')}
          />
        </div>
      ) : (
        <ul>
          {settlements.map((row) => (
            <li key={row.id}>
              <PanelRow>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-caption font-medium text-ink">
                    {row.fromUserId === viewerUserId
                      ? t('costs.person.you')
                      : nameOf(row.fromUserId)}
                    {' → '}
                    {row.toUserId === viewerUserId
                      ? t('costs.person.youTarget')
                      : nameOf(row.toUserId)}
                  </p>
                  <p className="truncate text-caption text-ink-3">
                    {formatDayLabel(row.settledOn, locale)} ·{' '}
                    {humaniseToken(row.method)}
                  </p>
                </div>
                <Badge
                  tone="success"
                  size="sm"
                  className="shrink-0 tabular-nums"
                >
                  {formatMoney(row.amountMinor, currency, locale)}
                </Badge>
              </PanelRow>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
