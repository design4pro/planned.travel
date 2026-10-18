/**
 * The filter bar over the expense list.
 *
 * Every control writes straight to the URL — there is no local copy of the filter
 * state to fall out of step with it. That is what makes a filtered view
 * shareable, survive a reload and work with the back button, and it is why the
 * search field is fully controlled by the search param rather than debounced into
 * it: a field whose value lags the URL is a field that fights the reader when they
 * press Escape or navigate back.
 */
import { Search, SlidersHorizontal, X } from 'lucide-react'

import {
  Badge,
  Button,
  Input,
  SectionLabel,
  SimpleSelect,
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { formatNumber } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatMoney } from '#/lib/money'
import { EXPENSE_VIEWS, isExpenseView, isFiltered } from './data'
import { DisplayCurrencyMenu } from './display-currency-menu'

import type { MessageKey, Translate } from '#/lib/i18n'
import type { DisplayCurrency } from '#/lib/money'
import type { CostsDisplayChoices, ExpenseCategory } from '#/server/fns/costs'
import type { CostsFilters, ExpenseView } from './data'

/** Radix rejects an empty item value, so "no filter" needs a sentinel. */
const ALL = '__all'

export interface ToolbarOption<TValue extends string = string> {
  readonly value: TValue
  readonly label: string
  readonly count: number
}

const VIEW_LABELS: { readonly [K in ExpenseView]: MessageKey } = {
  all: 'shell.trips.filter.all',
  paid: 'costs.toolbar.paidByMe',
  owed: 'costs.toolbar.owedToMe',
}

export interface CostsToolbarProps {
  readonly filters: CostsFilters
  readonly onFiltersChange: (next: Partial<CostsFilters>) => void
  readonly categories: ReadonlyArray<ToolbarOption<ExpenseCategory>>
  readonly days: ReadonlyArray<ToolbarOption>
  readonly viewCounts: { readonly [K in ExpenseView]: number }
  /** Rows currently showing, and rows in total. */
  readonly shown: number
  readonly total: number
  /** Sum of the rows currently showing. */
  readonly shownMinor: number
  readonly currency: string
  readonly display: DisplayCurrency
  readonly displayChoices: CostsDisplayChoices
  readonly savingDisplay: boolean
  readonly onDisplayChange: (code: string | null) => void
}

export function CostsToolbar({
  filters,
  onFiltersChange,
  categories,
  days,
  viewCounts,
  shown,
  total,
  shownMinor,
  currency,
  display,
  displayChoices,
  savingDisplay,
  onDisplayChange,
}: CostsToolbarProps) {
  const t = useTranslate()
  const locale = useLocale()
  const filtered = isFiltered(filters)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-display text-subtitle font-bold text-ink">
            {t('costs.toolbar.title')}
          </h2>
          <p className="text-caption tabular-nums text-ink-3">
            {filtered
              ? t('costs.toolbar.shownOf', {
                  shown: formatNumber(shown, locale),
                  total: formatNumber(total, locale),
                })
              : formatNumber(total, locale)}
            <span aria-hidden> · </span>
            <span className="font-semibold text-ink-2">
              {formatMoney(shownMinor, currency, locale)}
            </span>
          </p>
        </div>
        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            icon={<X aria-hidden />}
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
        ) : null}
      </div>

      {/* Wraps rather than scrolls above `sm`: at 1280px the search field, two
          selects and the segmented control want more room than the main column
          has once the rail is subtracted, and a wrapped second line reads better
          than a control that has been squeezed narrower than its own label. */}
      <div
        data-part="costs-filters"
        className="flex flex-wrap items-center gap-x-3 gap-y-3"
      >
        <Input
          size="sm"
          type="search"
          value={filters.q ?? ''}
          onChange={(event) =>
            onFiltersChange({
              q: event.target.value === '' ? undefined : event.target.value,
            })
          }
          onClear={() => onFiltersChange({ q: undefined })}
          leading={<Search />}
          placeholder={t('costs.toolbar.searchPlaceholder')}
          aria-label={t('costs.toolbar.searchLabel')}
          wrapperClassName="sm:w-64 lg:w-72"
        />

        {/* Below `sm` this is a stack, not a strip that scrolls sideways: the
            display currency on its own line, the two selects sharing one at
            equal width and the view tabs across the full width. A fixed-width
            row of five controls is wider than a 360px phone and hid the day
            select and the tabs with nothing to say it scrolled. */}
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:ms-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <DisplayCurrencyMenu
            stacked
            display={display}
            choices={displayChoices}
            budgetCurrency={currency}
            saving={savingDisplay}
            onChange={onDisplayChange}
          />
          <SimpleSelect
            size="sm"
            className="w-full min-w-0 sm:w-40 sm:shrink-0"
            options={[
              { value: ALL, label: t('costs.toolbar.allCategories') },
              ...categories.map((option) => ({
                value: option.value,
                label: option.label,
                description: t('costs.toolbar.logged', {
                  count: option.count,
                  value: formatNumber(option.count, locale),
                }),
              })),
            ]}
            value={filters.category ?? ALL}
            onValueChange={(next) =>
              onFiltersChange({
                category:
                  next === ALL
                    ? undefined
                    : categories.find((option) => option.value === next)?.value,
              })
            }
            ariaLabel={t('costs.toolbar.filterCategory')}
          />
          <SimpleSelect
            size="sm"
            className="w-full min-w-0 sm:w-36 sm:shrink-0"
            options={[
              { value: ALL, label: t('costs.toolbar.allDays') },
              ...days.map((option) => ({
                value: option.value,
                label: option.label,
                description: t('costs.toolbar.logged', {
                  count: option.count,
                  value: formatNumber(option.count, locale),
                }),
              })),
            ]}
            value={filters.day ?? ALL}
            onValueChange={(next) =>
              onFiltersChange({ day: next === ALL ? undefined : next })
            }
            ariaLabel={t('costs.toolbar.filterDay')}
          />
          <Tabs
            value={filters.view}
            onValueChange={(next) => {
              if (isExpenseView(next)) {
                onFiltersChange({ view: next })
              }
            }}
            variant="segmented"
            size="sm"
            className="col-span-2 min-w-0 sm:col-span-1 sm:shrink-0"
          >
            <TabsList aria-label={t('costs.toolbar.whose')}>
              {EXPENSE_VIEWS.map((view) => (
                <TabsTrigger
                  key={view}
                  value={view}
                  // Below `sm` the three triggers split the width and a long
                  // label wraps rather than widening the row or being clipped;
                  // `wrap-anywhere` lets a word longer than the segment break
                  // instead of spilling into its neighbour.
                  className="h-auto min-h-7 min-w-0 gap-1.5 px-2 py-1 text-center wrap-anywhere whitespace-normal sm:h-7 sm:gap-2 sm:px-3 sm:py-0 sm:wrap-normal sm:whitespace-nowrap"
                  badge={
                    // `outline` rather than `neutral` for the resting chip: the
                    // segmented track and `surface-2` are within a shade of each
                    // other, so a filled chip would read as a smudge.
                    <Badge
                      tone={filters.view === view ? 'accent' : 'outline'}
                      size="sm"
                      className="tabular-nums"
                    >
                      {viewCounts[view]}
                    </Badge>
                  }
                >
                  {t(VIEW_LABELS[view])}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {filtered ? (
        <SectionLabel
          icon={<SlidersHorizontal />}
          className="text-ink-4"
          aria-live="polite"
        >
          {describe(filters, categories, days, t)}
        </SectionLabel>
      ) : null}
    </div>
  )
}

/** A plain-language summary of the active filters, for the reader and the reviewer. */
function describe(
  filters: CostsFilters,
  categories: ReadonlyArray<ToolbarOption<ExpenseCategory>>,
  days: ReadonlyArray<ToolbarOption>,
  t: Translate,
): string {
  const parts: Array<string> = []
  if (filters.view !== 'all') {
    parts.push(t(VIEW_LABELS[filters.view]))
  }
  if (filters.category !== undefined) {
    parts.push(
      categories.find((option) => option.value === filters.category)?.label ??
        filters.category,
    )
  }
  if (filters.day !== undefined) {
    parts.push(
      days.find((option) => option.value === filters.day)?.label ?? filters.day,
    )
  }
  const needle = (filters.q ?? '').trim()
  if (needle !== '') {
    parts.push(t('costs.toolbar.summary.search', { term: needle }))
  }
  return parts.length === 0
    ? t('costs.toolbar.summary.everything')
    : t('costs.toolbar.summary.filtered', { filters: parts.join(' · ') })
}
