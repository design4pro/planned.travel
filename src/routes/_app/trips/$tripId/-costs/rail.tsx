/**
 * The right-hand rail: who owes whom, where everyone stands, where the money went,
 * and what has already been paid back.
 *
 * The settle-up panel is the only place on the screen that both proposes an action
 * and performs it. Its transfers come from the repository's own greedy matching —
 * at most `travellers − 1` payments to clear the whole trip — so accepting one is
 * always a step towards zero rather than a guess.
 */
import { ArrowRight, Plus, Scale, Trash2, Wallet } from 'lucide-react'

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Progress,
  focusRingInset,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { directionOf, useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney, formatSignedMoney } from '#/lib/money'
import {
  CategoryDonut,
  formatDayLabel,
  isOptimisticId,
  paymentMethodLabel,
} from '#/components/costs'
import { Panel, PanelRow } from '../../../-ui/scaffold'
import { EXPENSE_CATEGORY_ORDER, categoryLabel } from './categories'
import { categoryColour } from './chart-colours'
import { ConvertedFigure } from './converted-figure'

import type { Locale, Translate } from '#/lib/i18n'
import type { RefObject } from 'react'
import type { CostsSnapshot, DonutRow } from '#/components/costs'
import type { DisplayCurrency } from '#/lib/money'
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
  readonly display: DisplayCurrency
  readonly budgetTargetMinor: number | null
  /** A reader sees the proposed transfers and none of the buttons that record one. */
  readonly canWrite: boolean
  readonly onSettle: (suggestion: CostsSuggestion) => void
  readonly onAddPayment: () => void
  readonly onDeletePayment: (payment: CostsSettlement) => void
  /**
   * Where focus goes when the delete dialog closes. The row that opened it is gone by then, and
   * a dialog can only hand focus back to something still on the page.
   */
  readonly paymentsRef: RefObject<HTMLDivElement | null>
}

export function CostsRail({
  snapshot,
  people,
  viewerUserId,
  currency,
  display,
  budgetTargetMinor,
  canWrite,
  onSettle,
  onAddPayment,
  onDeletePayment,
  paymentsRef,
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
        canWrite={canWrite}
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
        display={display}
        nameOf={nameOf}
        viewerUserId={viewerUserId}
        canWrite={canWrite}
        onDelete={onDeletePayment}
        focusRef={paymentsRef}
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
  canWrite,
  onSettle,
  onAddPayment,
  busy,
}: {
  suggestions: ReadonlyArray<CostsSuggestion>
  viewerUserId: string
  currency: string
  nameOf: (userId: string) => string
  imageOf: (userId: string) => string | null
  canWrite: boolean
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
        canWrite ? (
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
        ) : undefined
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
            description={t(
              canWrite
                ? 'costs.settle.empty.body'
                : 'costs.readOnly.settleEmpty',
            )}
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
                  {canWrite ? (
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
                  ) : null}
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

/** A category's place in the ring; one outside the enum goes last, in the order it came. */
function categoryRank(row: CostsCategoryTotal): number {
  const order: ReadonlyArray<string> = EXPENSE_CATEGORY_ORDER
  const rank = order.indexOf(row.category)
  return rank === -1 ? order.length : rank
}

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
  const t = useTranslate()
  const donutRows = [...rows]
    .sort((left, right) => categoryRank(left) - categoryRank(right))
    .map((row): DonutRow => ({
      key: row.category,
      label: categoryLabel(row.category, t),
      spentMinor: row.spentMinor,
      plannedMinor: row.plannedMinor,
      colour: categoryColour(row.category),
    }))

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
      <CategoryDonut rows={donutRows} currency={currency} />
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

/** A name wrapped so that its script's direction cannot leak into the text around it. */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}

/**
 * The arrow between a payment's two people. It points the way the money goes, so in a right-to-left
 * locale it is the mirrored glyph: U+2192 is not mirrored by the text direction and would read
 * from the payee back to the payer. A caller isolates each name (`<bdi>`, or {@link isolate}), or
 * two names in a left-to-right script would make the neutral arrow left-to-right again.
 */
export function paymentArrow(locale: Locale): string {
  return directionOf(locale) === 'rtl' ? '←' : '→'
}

/**
 * "You → Anna": a payment's two people as the reader sees them, the same words on the row, on its
 * delete button and in the dialog that confirms the delete.
 */
export function paymentWho(
  row: Pick<CostsSettlement, 'fromUserId' | 'toUserId'>,
  nameOf: (userId: string) => string,
  viewerUserId: string,
  t: Translate,
): { readonly from: string; readonly to: string } {
  return {
    from:
      row.fromUserId === viewerUserId
        ? t('costs.person.you')
        : nameOf(row.fromUserId),
    to:
      row.toUserId === viewerUserId
        ? t('costs.person.youTarget')
        : nameOf(row.toUserId),
  }
}

function Payments({
  settlements,
  currency,
  display,
  nameOf,
  viewerUserId,
  canWrite,
  onDelete,
  focusRef,
}: {
  settlements: ReadonlyArray<CostsSettlement>
  currency: string
  display: DisplayCurrency
  nameOf: (userId: string) => string
  viewerUserId: string
  canWrite: boolean
  onDelete: (payment: CostsSettlement) => void
  focusRef: RefObject<HTMLDivElement | null>
}) {
  const locale = useLocale()
  const t = useTranslate()

  return (
    <Panel
      label={t('costs.payments.label')}
      count={settlements.length === 0 ? undefined : String(settlements.length)}
      flush
    >
      {/* A deleted payment takes its own button with it, so the dialog that confirmed the delete
          returns focus here instead of dropping it to the page. */}
      <div
        ref={focusRef}
        tabIndex={-1}
        role="group"
        aria-label={t('costs.payments.label')}
        className={cn('rounded-b-xl outline-none', focusRingInset)}
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
            {settlements.map((row) => {
              const who = paymentWho(row, nameOf, viewerUserId, t)
              return (
                <li key={row.id}>
                  <PanelRow>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-caption font-medium text-ink">
                        <bdi>{who.from}</bdi>
                        {` ${paymentArrow(locale)} `}
                        <bdi>{who.to}</bdi>
                      </p>
                      <p className="truncate text-caption text-ink-3">
                        {formatDayLabel(row.settledOn, locale)} ·{' '}
                        {paymentMethodLabel(row.method, t)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone="success" size="sm" className="tabular-nums">
                        {formatMoney(row.amountMinor, currency, locale)}
                      </Badge>
                      {isOptimisticId(row.id) ? null : (
                        <ConvertedFigure
                          display={display}
                          convertedMinor={row.convertedMinor}
                        />
                      )}
                    </div>
                    {canWrite && !isOptimisticId(row.id) ? (
                      <IconButton
                        size="sm"
                        variant="danger"
                        icon={<Trash2 aria-hidden />}
                        // Names, not "You": the button's name sits mid-sentence, where the
                        // arrow line's "You" forms are wrong in most locales. The day follows the
                        // amount so two equal payments between the same people can be told apart.
                        label={t('costs.payments.delete', {
                          from: nameOf(row.fromUserId),
                          to: nameOf(row.toUserId),
                          amount: `${formatMoney(row.amountMinor, currency, locale)}, ${formatDayLabel(row.settledOn, locale)}`,
                        })}
                        onClick={() => onDelete(row)}
                      />
                    ) : null}
                  </PanelRow>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}
