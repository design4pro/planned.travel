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
import { useRouter } from '@tanstack/react-router'
import { ArrowLeftRight, Coins, Download, Plus, Scale } from 'lucide-react'
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
  findPerson,
  formatDayShort,
  isFiltered,
  totalsFor,
} from '#/components/costs'
import { requireFound } from '#/lib/absence'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import { loadCosts } from '#/server/fns/costs'
import {
  changeTripCurrencyFn,
  previewCurrencyChangeFn,
} from '#/server/fns/trip-currency'
import { TripModuleHeader, useTripHeader } from '../../../-ui/trip-header'
import { categoryOptions } from './categories'
import { ExpenseList } from './expense-list'
import { CostsRail, isolate, paymentArrow, paymentWho } from './rail'
import { StatTiles } from './stat-tiles'
import { useCostsActions } from './actions'
import { CurrencyRebaseDialog } from './currency-rebase-dialog'

import type {
  CostsFilters,
  PaymentSeed,
  ToolbarOption,
} from '#/components/costs'
import type {
  CostsExpense,
  CostsPayload,
  CostsSettlement,
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
  | {
      readonly kind: 'deletePayment'
      readonly id: number
      readonly row: CostsSettlement
    }
  | {
      readonly kind: 'currency'
      readonly id: number
      readonly currency: string
    }

export function CostsScreen({
  data,
  filters,
  onFiltersChange,
}: CostsScreenProps) {
  const locale = useLocale()
  const t = useTranslate()
  const { trip } = useTripHeader()
  const router = useRouter()
  const {
    snapshot,
    addExpense,
    editExpense,
    removeExpense,
    addPayment,
    removePayment,
    setDisplay,
    savingDisplay,
  } = useCostsActions(data)

  const [session, setSession] = useState<Session>({ kind: 'none' })
  const [open, setOpen] = useState(false)
  // A monotonic counter, not state: it only ever feeds the `key` of the dialog
  // being opened, and bumping it must not itself schedule a render.
  const sessions = useRef(0)
  const paymentsRef = useRef<HTMLDivElement>(null)
  const paymentOpener = useRef<HTMLElement | null>(null)

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

  const paymentTitle = (row: CostsSettlement): string => {
    const who = paymentWho(
      row,
      (userId) =>
        findPerson(data.people, data.departedPeople, userId)?.name ??
        t('costs.person.removed'),
      data.viewerUserId,
      t,
    )
    return `${isolate(who.from)} ${paymentArrow(locale)} ${isolate(who.to)}`
  }

  const openDeletePayment = useCallback(
    (row: CostsSettlement): void => {
      // Safari and Firefox on macOS do not focus a button on click, so the focus holder can be the
      // page itself: that is no opener, and the Payments list takes focus instead.
      const holder = document.activeElement
      paymentOpener.current =
        holder instanceof HTMLElement && holder !== document.body
          ? holder
          : null
      start((id) => ({ kind: 'deletePayment', id, row }))
    },
    [start],
  )

  // The dialog previews against the currency it opened on; a refresh behind it must not move that base.
  const budgetCurrency = data.currency
  const openCurrency = useCallback((): void => {
    start((id) => ({ kind: 'currency', id, currency: budgetCurrency }))
  }, [start, budgetCurrency])

  // Only the owner of a live trip is offered the change; the server refuses anyone else regardless.
  const canChangeCurrency =
    !trip.isArchived &&
    data.people.find((person) => person.userId === data.viewerUserId)?.role ===
      'owner'

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
        t('costs.person.removed'),
      ),
    [snapshot.expenses, filters, data.people, data.viewerUserId, t],
  )

  const visibleMinor = visible.reduce(
    (total, row) => total + row.amountMinor,
    0,
  )

  // Resolved at render, per reader: a label computed once would serve one locale to everyone.
  const categories = useMemo(() => categoryOptions(t), [t])

  const categoryFilters = useMemo<Array<ToolbarOption<ExpenseCategory>>>(
    () =>
      categories
        .map((option) => ({
          value: option.value,
          label: option.label,
          count: snapshot.expenses.filter(
            (row) => row.category === option.value,
          ).length,
        }))
        // The active category stays listed when its last expense is gone, so the filter summary
        // can name it in the reader's language instead of printing the stored token.
        .filter(
          (option) => option.count > 0 || option.value === filters.category,
        ),
    [categories, filters.category, snapshot.expenses],
  )

  const dayFilters = useMemo<Array<ToolbarOption>>(() => {
    const days = dayOptions(snapshot.expenses)
    // As with the category: the active day stays listed once its last expense is gone, so the
    // filter summary shows a day in the reader's format rather than the stored date.
    if (filters.day !== undefined && !days.includes(filters.day)) {
      days.push(filters.day)
      days.sort((left, right) => right.localeCompare(left))
    }
    return days.map((day) => ({
      value: day,
      label: formatDayShort(day, locale),
      count: snapshot.expenses.filter((row) => row.spentOn === day).length,
    }))
  }, [snapshot.expenses, filters.day])

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
    const known = categories.find(
      (option) => option.value === busiest?.category,
    )
    return known?.value ?? 'other'
  }, [categories, snapshot.byCategory])

  const exportRows = useCallback((): void => {
    if (visible.length === 0) {
      toast.error(t('costs.export.empty.title'), {
        description: t('costs.export.empty.body'),
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
        t,
      }),
    )
    toast.success(t('costs.export.ready.title'), {
      description: t('costs.export.ready.body', {
        count: visible.length,
        expenses: formatNumber(visible.length, locale),
      }),
    })
  }, [
    data.displayCurrency,
    data.people,
    data.today,
    data.viewerUserId,
    locale,
    t,
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
    ? t('costs.screen.empty.body', { currency: data.currency })
    : t('costs.readOnly.empty')

  const addFirstExpense = data.canWrite ? (
    <Button
      type="button"
      variant="primary"
      shape="pill"
      icon={<Plus aria-hidden strokeWidth={2.5} />}
      onClick={() => openExpense(null)}
    >
      {t('costs.screen.addFirst')}
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
      {t('ui.action.clearFilters')}
    </Button>
  )

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title={t('shell.trip.tab.costs')}
          description={
            snapshot.expenseCount === 0
              ? t('costs.screen.nothingSpent')
              : t('costs.screen.summary', {
                  expenses: t('costs.count.expenses', {
                    count: snapshot.expenseCount,
                    expenses: formatNumber(snapshot.expenseCount, locale),
                  }),
                  spent: formatMoney(
                    snapshot.spentMinor,
                    data.currency,
                    locale,
                  ),
                })
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
                {t('costs.screen.exportCsv')}
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
                    {t('costs.settle.label')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    shape="pill"
                    icon={<Plus aria-hidden strokeWidth={2.5} />}
                    onClick={() => openExpense(null)}
                  >
                    {t('costs.expense.add')}
                  </Button>
                </>
              ) : null}
              {canChangeCurrency ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  data-part="trip-currency-change"
                  icon={<ArrowLeftRight aria-hidden />}
                  className="basis-full justify-center sm:basis-auto"
                  onClick={openCurrency}
                >
                  {t('costs.rebase.open')}
                </Button>
              ) : null}
            </>
          }
        />

        {data.canWrite ? null : (
          <Alert tone="info" size="sm" title={t('costs.readOnly.title')}>
            {trip.isArchived
              ? t('costs.readOnly.archived')
              : t('costs.readOnly.body')}
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
          departedPeople={data.departedPeople}
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
                    unconverted={data.unconverted.length > 0}
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
                  displayUnconverted={data.unconverted.length > 0}
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
                      ? t('costs.screen.empty.title')
                      : t('costs.screen.filtered.title')
                  }
                  description={
                    snapshot.expenses.length === 0
                      ? emptyLedgerHint
                      : t('costs.screen.filtered.body')
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
                departedPeople={data.departedPeople}
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
            departedPeople={data.departedPeople}
            viewerUserId={data.viewerUserId}
            currency={data.currency}
            display={data.displayCurrency}
            budgetTargetMinor={data.budgetTargetMinor}
            canWrite={data.canWrite}
            onSettle={settle}
            onAddPayment={() => openPayment(null)}
            onDeletePayment={openDeletePayment}
            paymentsRef={paymentsRef}
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
          departedPeople={data.departedPeople}
          viewerUserId={data.viewerUserId}
          tripCurrency={data.currency}
          categories={categories}
          defaultCategory={defaultCategory}
          today={data.today}
          suggestedRate={data.suggestedRate}
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
          withBalance={data.balances
            .filter((row) => row.balanceMinor !== 0)
            .map((row) => row.userId)}
          viewerUserId={data.viewerUserId}
          currency={data.currency}
          today={data.today}
          onSubmit={addPayment}
        />
      ) : null}

      {session.kind === 'currency' ? (
        <CurrencyRebaseDialog
          key={`currency-${session.id}`}
          open={open}
          onOpenChange={setOpen}
          currency={session.currency}
          people={data.people}
          departedPeople={data.departedPeople}
          loadPreview={(request) =>
            previewCurrencyChangeFn({
              data: { tripId: data.tripId, ...request },
            })
          }
          commit={(request) =>
            changeTripCurrencyFn({ data: { tripId: data.tripId, ...request } })
          }
          readCurrency={() =>
            loadCosts({ data: { tripId: data.tripId } }).then(
              (fresh) => requireFound(fresh).currency,
            )
          }
          onChanged={(to) => {
            toast.success(t('costs.rebase.done', { to }))
            void router.invalidate({ sync: true })
          }}
        />
      ) : null}

      {session.kind === 'deletePayment' ? (
        <ConfirmDeleteDialog
          key={`delete-payment-${session.id}`}
          open={open}
          onOpenChange={setOpen}
          subject="payment"
          title={paymentTitle(session.row)}
          amountMinor={session.row.amountMinor}
          currency={data.currency}
          affects={[session.row.fromUserId, session.row.toUserId].map(
            (userId) =>
              findPerson(data.people, data.departedPeople, userId)?.name ??
              t('costs.person.removedTarget'),
          )}
          onConfirm={() => removePayment(session.row)}
          // The dialog cannot hand focus back itself: its own button takes focus first (`autoFocus`),
          // so the element it remembers is gone with it. The button that opened it gets focus back
          // while it is still on the page; after a delete it is not (and after a refusal the row is a
          // new node), and the Payments list takes focus instead.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const opener = paymentOpener.current
            paymentOpener.current = null
            const target = opener?.isConnected ? opener : paymentsRef.current
            target?.focus({ preventScroll: true })
          }}
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
              findPerson(data.people, data.departedPeople, share.userId)
                ?.name ?? t('costs.person.removedTarget'),
          )}
          onConfirm={() => removeExpense(session.row)}
        />
      ) : null}
    </AppFrame>
  )
}
