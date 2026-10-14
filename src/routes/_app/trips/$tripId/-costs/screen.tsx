/**
 * The costs screen.
 *
 * It owns three things and delegates everything else: the dialog session state, the
 * URL-backed filter state, and the CSV export. The figures come from
 * `useCostsActions`, which folds any in-flight write into the repository's own
 * aggregates; the arithmetic comes from `#/components/costs`; the chrome comes from
 * the design system.
 *
 * Dialogs are keyed by a session counter rather than reset by an effect. Opening
 * bumps the counter, which remounts the form with fresh state; closing leaves the
 * same instance in place, so its exit animation still runs.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Coins, Download, Plus, Scale } from 'lucide-react'
import { toast } from 'sonner'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { Alert, Button, Card, EmptyState } from '#/components/ui'
import {
  ConfirmDeleteDialog,
  CostsToolbar,
  DisplayCurrencyMenu,
  ExpenseDialog,
  PaymentDialog,
  csvFilename,
  dayOptions,
  downloadCsv,
  expensesCsv,
  filterExpenses,
  formatDayShort,
  isFiltered,
  totalsFor,
} from '#/components/costs'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import { TripModuleHeader, useTripHeader } from '../../../-ui/trip-header'
import { pluralise } from '../../../-lib/format'
import { CATEGORY_OPTIONS } from './categories'
import { ExpenseList } from './expense-list'
import { CostsRail } from './rail'
import { StatTiles } from './stat-tiles'
import { useCostsActions } from './actions'

import type {
  CostsFilters,
  PaymentSeed,
  ToolbarOption,
} from '#/components/costs'
import type {
  CostsExpense,
  CostsPayload,
  CostsSuggestion,
  ExpenseCategory,
} from '#/server/fns/costs'

export interface CostsScreenProps {
  readonly data: CostsPayload
  readonly filters: CostsFilters
  readonly onFiltersChange: (next: Partial<CostsFilters>) => void
}

type Session =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'expense'
      readonly id: number
      readonly row: CostsExpense | null
    }
  | {
      readonly kind: 'payment'
      readonly id: number
      readonly seed: PaymentSeed | null
    }
  | { readonly kind: 'delete'; readonly id: number; readonly row: CostsExpense }

export function CostsScreen({
  data,
  filters,
  onFiltersChange,
}: CostsScreenProps) {
  const locale = useLocale()
  const t = useTranslate()
  const { trip } = useTripHeader()
  const {
    snapshot,
    addExpense,
    editExpense,
    removeExpense,
    addPayment,
    setDisplay,
    savingDisplay,
  } = useCostsActions(data)

  const [session, setSession] = useState<Session>({ kind: 'none' })
  const [open, setOpen] = useState(false)
  // A monotonic counter, not state: it only ever feeds the `key` of the dialog
  // being opened, and bumping it must not itself schedule a render.
  const sessions = useRef(0)

  const start = useCallback((make: (id: number) => Session): void => {
    sessions.current += 1
    setSession(make(sessions.current))
    setOpen(true)
  }, [])

  const openExpense = useCallback(
    (row: CostsExpense | null): void => {
      start((id) => ({ kind: 'expense', id, row }))
    },
    [start],
  )

  const openPayment = useCallback(
    (seed: PaymentSeed | null): void => {
      start((id) => ({ kind: 'payment', id, seed }))
    },
    [start],
  )

  const openDelete = useCallback(
    (row: CostsExpense): void => {
      start((id) => ({ kind: 'delete', id, row }))
    },
    [start],
  )

  const totals = useMemo(
    () => totalsFor(snapshot, data.viewerUserId),
    [snapshot, data.viewerUserId],
  )

  const visible = useMemo(
    () =>
      filterExpenses(
        snapshot.expenses,
        filters,
        data.people,
        data.viewerUserId,
      ),
    [snapshot.expenses, filters, data.people, data.viewerUserId],
  )

  const visibleMinor = visible.reduce(
    (total, row) => total + row.amountMinor,
    0,
  )

  const categoryFilters = useMemo<Array<ToolbarOption<ExpenseCategory>>>(
    () =>
      CATEGORY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: snapshot.expenses.filter((row) => row.category === option.value)
          .length,
      })).filter((option) => option.count > 0),
    [snapshot.expenses],
  )

  const dayFilters = useMemo<Array<ToolbarOption>>(
    () =>
      dayOptions(snapshot.expenses).map((day) => ({
        value: day,
        label: formatDayShort(day, locale),
        count: snapshot.expenses.filter((row) => row.spentOn === day).length,
      })),
    [snapshot.expenses],
  )

  const viewCounts = useMemo(
    () => ({
      all: snapshot.expenses.length,
      paid: filterExpenses(
        snapshot.expenses,
        {
          ...filters,
          view: 'paid',
          q: undefined,
          category: undefined,
          day: undefined,
        },
        data.people,
        data.viewerUserId,
      ).length,
      owed: filterExpenses(
        snapshot.expenses,
        {
          ...filters,
          view: 'owed',
          q: undefined,
          category: undefined,
          day: undefined,
        },
        data.people,
        data.viewerUserId,
      ).length,
    }),
    [snapshot.expenses, filters, data.people, data.viewerUserId],
  )

  /**
   * The category a new expense should open on: whichever this trip logs most.
   * A blank form that guesses right is one fewer control to touch per receipt.
   */
  const defaultCategory = useMemo<ExpenseCategory>(() => {
    const busiest = [...snapshot.byCategory]
      .filter((row) => row.expenseCount > 0)
      .sort((left, right) => right.expenseCount - left.expenseCount)
      .at(0)
    const known = CATEGORY_OPTIONS.find(
      (option) => option.value === busiest?.category,
    )
    return known?.value ?? 'other'
  }, [snapshot.byCategory])

  const exportRows = useCallback((): void => {
    if (visible.length === 0) {
      toast.error('Nothing to export', {
        description: 'No expenses match the filters you have on.',
      })
      return
    }
    downloadCsv(
      csvFilename(trip.title, data.today),
      expensesCsv({
        rows: visible,
        people: data.people,
        viewerUserId: data.viewerUserId,
        display: data.displayCurrency,
      }),
    )
    toast.success('Export ready', {
      description: `${pluralise(visible.length, 'expense')} written to CSV.`,
    })
  }, [
    data.displayCurrency,
    data.people,
    data.today,
    data.viewerUserId,
    trip.title,
    visible,
  ])

  const settle = useCallback(
    (suggestion: CostsSuggestion): void => {
      openPayment({
        fromUserId: suggestion.fromUserId,
        toUserId: suggestion.toUserId,
        amountMinor: suggestion.amountMinor,
      })
    },
    [openPayment],
  )

  // A reader has no expense to add, so an empty ledger offers them no call to action and says
  // whose move it is instead.
  const emptyLedgerHint = data.canWrite
    ? `Log what you spend as you go. planned.travel splits it between everyone travelling and keeps the running total in ${data.currency}.`
    : t('costs.readOnly.empty')

  const addFirstExpense = data.canWrite ? (
    <Button
      type="button"
      variant="primary"
      shape="pill"
      icon={<Plus aria-hidden strokeWidth={2.5} />}
      onClick={() => openExpense(null)}
    >
      Add the first expense
    </Button>
  ) : null

  const clearFilters = (
    <Button
      type="button"
      variant="secondary"
      shape="pill"
      onClick={() =>
        onFiltersChange({
          q: undefined,
          category: undefined,
          day: undefined,
          view: 'all',
        })
      }
    >
      Clear the filters
    </Button>
  )

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Costs"
          description={
            snapshot.expenseCount === 0
              ? 'Nothing spent yet'
              : `${pluralise(snapshot.expenseCount, 'expense')} · ${formatMoney(snapshot.spentMinor, data.currency, locale)} spent`
          }
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                shape="pill"
                icon={<Download aria-hidden />}
                onClick={exportRows}
              >
                Export CSV
              </Button>
              {data.canWrite ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    shape="pill"
                    icon={<Scale aria-hidden />}
                    onClick={() => openPayment(null)}
                  >
                    Settle up
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    shape="pill"
                    icon={<Plus aria-hidden strokeWidth={2.5} />}
                    onClick={() => openExpense(null)}
                  >
                    Add expense
                  </Button>
                </>
              ) : null}
            </>
          }
        />

        {data.canWrite ? null : (
          <Alert tone="info" size="sm" title={t('costs.readOnly.title')}>
            {t('costs.readOnly.body')}
          </Alert>
        )}

        {data.unconverted.length === 0 ? null : (
          <Alert
            tone="warning"
            size="sm"
            title={t('costs.display.alert.title')}
            data-part="display-currency-alert"
          >
            <p>{t('costs.display.alert.body')}</p>
            <ul className="mt-1 list-disc ps-5">
              {data.unconverted.map((pair) => (
                <li key={`${pair.from}-${pair.to}-${pair.on}`}>
                  {t('costs.display.alert.pair', {
                    from: pair.from,
                    to: pair.to,
                    date: formatDayShort(pair.on, locale),
                  })}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <StatTiles
          snapshot={snapshot}
          totals={totals}
          people={data.people}
          viewerUserId={data.viewerUserId}
          currency={data.currency}
          budgetTargetMinor={data.budgetTargetMinor}
          plannedMinor={data.plannedMinor}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            {/* No rows means nothing to filter, and a bar of empty controls over an
                empty state is furniture rather than help. Payments still carry a converted
                figure, so a trip with only those keeps the one control that governs it. */}
            {snapshot.expenses.length === 0 ? (
              snapshot.settlements.length === 0 ? null : (
                <div className="flex justify-end">
                  <DisplayCurrencyMenu
                    display={data.displayCurrency}
                    choices={data.displayChoices}
                    budgetCurrency={data.currency}
                    saving={savingDisplay}
                    onChange={(code) => void setDisplay(code)}
                  />
                </div>
              )
            ) : (
              <Card className="py-4">
                <CostsToolbar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  categories={categoryFilters}
                  days={dayFilters}
                  viewCounts={viewCounts}
                  shown={visible.length}
                  total={snapshot.expenses.length}
                  shownMinor={visibleMinor}
                  currency={data.currency}
                  display={data.displayCurrency}
                  displayChoices={data.displayChoices}
                  savingDisplay={savingDisplay}
                  onDisplayChange={(code) => void setDisplay(code)}
                />
              </Card>
            )}

            {visible.length === 0 ? (
              <Card variant="dashed" padding="none">
                <EmptyState
                  size="lg"
                  tone={isFiltered(filters) ? 'neutral' : 'brand'}
                  icon={<Coins />}
                  title={
                    snapshot.expenses.length === 0
                      ? 'No expenses yet'
                      : 'Nothing matches those filters'
                  }
                  description={
                    snapshot.expenses.length === 0
                      ? emptyLedgerHint
                      : 'Widen the search, pick another day, or clear the filters to see the whole trip again.'
                  }
                  action={
                    snapshot.expenses.length === 0
                      ? addFirstExpense
                      : clearFilters
                  }
                />
              </Card>
            ) : (
              <ExpenseList
                rows={visible}
                people={data.people}
                viewerUserId={data.viewerUserId}
                currency={data.currency}
                display={data.displayCurrency}
                busyExpenseIds={snapshot.busyExpenseIds}
                canWrite={data.canWrite}
                onEdit={openExpense}
                onDelete={openDelete}
              />
            )}
          </div>

          <CostsRail
            snapshot={snapshot}
            people={data.people}
            viewerUserId={data.viewerUserId}
            currency={data.currency}
            display={data.displayCurrency}
            budgetTargetMinor={data.budgetTargetMinor}
            canWrite={data.canWrite}
            onSettle={settle}
            onAddPayment={() => openPayment(null)}
          />
        </div>
      </AppSections>

      {session.kind === 'expense' ? (
        <ExpenseDialog
          key={`expense-${session.id}`}
          open={open}
          onOpenChange={setOpen}
          expense={session.row}
          people={data.people}
          viewerUserId={data.viewerUserId}
          tripCurrency={data.currency}
          categories={CATEGORY_OPTIONS}
          defaultCategory={defaultCategory}
          today={data.today}
          onSubmit={(value) =>
            session.row === null
              ? addExpense(value)
              : editExpense(session.row, value)
          }
        />
      ) : null}

      {session.kind === 'payment' ? (
        <PaymentDialog
          key={`payment-${session.id}`}
          open={open}
          onOpenChange={setOpen}
          seed={session.seed}
          people={data.people}
          viewerUserId={data.viewerUserId}
          currency={data.currency}
          today={data.today}
          onSubmit={addPayment}
        />
      ) : null}

      {session.kind === 'delete' ? (
        <ConfirmDeleteDialog
          key={`delete-${session.id}`}
          open={open}
          onOpenChange={setOpen}
          title={session.row.title}
          amountMinor={session.row.amountMinor}
          currency={data.currency}
          affects={session.row.shares.map(
            (share) =>
              data.people.find((person) => person.userId === share.userId)
                ?.name ?? 'a removed traveller',
          )}
          onConfirm={() => removeExpense(session.row)}
        />
      ) : null}
    </AppFrame>
  )
}
