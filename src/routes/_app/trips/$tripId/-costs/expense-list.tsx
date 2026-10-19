/**
 * The expense list, grouped by the day the money went out.
 *
 * The row is where this screen earns its keep. It carries six facts the reference
 * spreads across two lines and a tooltip: what it was, who covered it, what it cost
 * in the trip's currency, what it cost in the currency it was actually written in,
 * what the reader's own share of it is, and whether there is a note behind it. Every
 * figure is tabular, and the amount is right-aligned inside the same flexible column
 * on every row, so a column of money lines up whatever the titles do.
 *
 * The layout is two stacked lines at every width rather than one wide line that
 * collapses: on a 360px phone the title and the amount share the first line and the
 * quiet detail shares the second, which is a designed small screen rather than a
 * squeezed large one.
 */
import { Pencil, StickyNote, Trash2 } from 'lucide-react'

import {
  Avatar,
  Badge,
  IconButton,
  Spinner,
  Tooltip,
  TooltipProvider,
} from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { formatConversion, formatMoney } from '#/lib/money'
import { groupByDay, isOptimisticId, shareOf } from '#/components/costs'
import { Panel } from '../../../-ui/scaffold'
import { ConvertedFigure } from './converted-figure'
import { CategoryGlyph, categoryLabel } from './categories'

import type { DisplayCurrency } from '#/lib/money'
import type { CostsExpense, CostsPerson } from '#/server/fns/costs'

export interface ExpenseListProps {
  readonly rows: ReadonlyArray<CostsExpense>
  readonly people: ReadonlyArray<CostsPerson>
  readonly viewerUserId: string
  readonly currency: string
  readonly display: DisplayCurrency
  readonly busyExpenseIds: ReadonlySet<string>
  /** Whether the row offers edit and delete. A reader sees the ledger and none of its controls. */
  readonly canWrite: boolean
  readonly onEdit: (row: CostsExpense) => void
  readonly onDelete: (row: CostsExpense) => void
}

export function ExpenseList({
  rows,
  people,
  viewerUserId,
  currency,
  display,
  busyExpenseIds,
  canWrite,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  const locale = useLocale()
  const t = useTranslate()
  const groups = groupByDay(rows, locale)

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={200}>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <Panel
            key={group.day}
            label={group.label}
            count={t('costs.list.daySpent', {
              amount: formatMoney(group.totalMinor, currency, locale),
            })}
            flush
          >
            <ul>
              {group.rows.map((row) => (
                <li key={row.id}>
                  <ExpenseRow
                    row={row}
                    people={people}
                    viewerUserId={viewerUserId}
                    currency={currency}
                    display={display}
                    busy={busyExpenseIds.has(row.id)}
                    canWrite={canWrite}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </TooltipProvider>
  )
}

function ExpenseRow({
  row,
  people,
  viewerUserId,
  currency,
  display,
  busy,
  canWrite,
  onEdit,
  onDelete,
}: {
  row: CostsExpense
  people: ReadonlyArray<CostsPerson>
  viewerUserId: string
  currency: string
  display: DisplayCurrency
  busy: boolean
  canWrite: boolean
  onEdit: (row: CostsExpense) => void
  onDelete: (row: CostsExpense) => void
}) {
  const locale = useLocale()
  const t = useTranslate()
  const payer = people.find((person) => person.userId === row.paidBy)
  const conversion = formatConversion(row, locale)
  const mine = shareOf(row, viewerUserId)
  // A row the server has never seen has no id to edit or delete against, so its
  // actions stay closed until the write comes back with a real one.
  const locked = busy || isOptimisticId(row.id)

  return (
    <div
      aria-busy={locked || undefined}
      className={cn(
        'flex min-w-0 items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5',
        'not-last:border-b not-last:border-edge-faint',
        'transition-colors duration-fast ease-out-quint hover:bg-hover',
        // A row mid-write is dimmed rather than replaced: the reader keeps their
        // place in the list, and the spinner says which line is still moving.
        locked && 'opacity-60',
      )}
    >
      <CategoryGlyph category={row.category} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <p className="truncate text-label font-semibold text-ink">
            {row.title}
          </p>
          <span className="shrink-0 font-display text-subtitle font-bold tabular-nums text-ink">
            {formatMoney(row.amountMinor, currency, locale)}
          </span>
        </div>

        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3">
            {row.paidBy === null ? (
              <Badge tone="warning" size="sm">
                {t('costs.row.noPayer')}
              </Badge>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar
                  name={payer?.name ?? t('costs.person.removed')}
                  src={payer?.image}
                  size="xs"
                />
                <span className="truncate font-medium text-ink-2">
                  {row.paidBy === viewerUserId
                    ? t('costs.row.youPaid')
                    : t('costs.row.paid', {
                        name: payer?.name ?? t('costs.person.removed'),
                      })}
                </span>
              </span>
            )}
            <Dot />
            <span className="truncate">{categoryLabel(row.category, t)}</span>
            {conversion === null ? null : (
              <>
                <Dot />
                <span className="truncate tabular-nums text-ink-4">
                  {conversion}
                </span>
              </>
            )}
            {row.notes === null ? null : (
              <Tooltip content={row.notes} side="top">
                <button
                  type="button"
                  aria-label={t('costs.row.noteOn', { title: row.title })}
                  className="focus-ring grid size-5 shrink-0 place-items-center rounded-full text-ink-4 transition-colors duration-fast ease-out-quint hover:bg-hover hover:text-ink-2"
                >
                  <StickyNote aria-hidden className="size-3.5" />
                </button>
              </Tooltip>
            )}
          </div>

          <span className="shrink-0 text-caption tabular-nums text-ink-4">
            {mine === 0
              ? t('costs.row.notYourShare')
              : t('costs.row.yourShare', {
                  amount: formatMoney(mine, currency, locale),
                })}
          </span>
        </div>

        {display.mode === 'fixed' && !locked ? (
          // Its own line, under the amount it converts: beside the share it would take the width
          // the payer and category need on a 360px column.
          <div className="flex justify-end">
            <ConvertedFigure
              display={display}
              convertedMinor={row.convertedMinor}
            />
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {locked ? (
            <span className="grid size-8 place-items-center text-ink-4">
              <Spinner size="xs" label={t('costs.row.saving')} />
            </span>
          ) : (
            <>
              <IconButton
                size="sm"
                variant="ghost"
                icon={<Pencil aria-hidden />}
                label={t('costs.row.edit', { title: row.title })}
                onClick={() => onEdit(row)}
              />
              <IconButton
                size="sm"
                variant="danger"
                icon={<Trash2 aria-hidden />}
                label={t('costs.row.delete', { title: row.title })}
                onClick={() => onDelete(row)}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** The hairline separator between two facts on the quiet line. */
function Dot() {
  return (
    <span aria-hidden className="text-ink-4">
      ·
    </span>
  )
}
