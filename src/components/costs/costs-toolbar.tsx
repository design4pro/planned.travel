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
import { formatMoney } from '#/lib/money'
import { EXPENSE_VIEWS, isExpenseView, isFiltered } from './data'

import type { ExpenseCategory } from '#/server/fns/costs'
import type { CostsFilters, ExpenseView } from './data'

/** Radix rejects an empty item value, so "no filter" needs a sentinel. */
const ALL = '__all'

export interface ToolbarOption<TValue extends string = string> {
  readonly value: TValue
  readonly label: string
  readonly count: number
}

const VIEW_LABELS: { readonly [K in ExpenseView]: string } = {
  all: 'All',
  paid: 'Paid by me',
  owed: "I'm owed",
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
}: CostsToolbarProps) {
  const filtered = isFiltered(filters)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-display text-subtitle font-bold text-ink">Expenses</h2>
          <p className="text-caption tabular-nums text-ink-3">
            {filtered ? `${shown} of ${total}` : `${total}`}
            <span aria-hidden> · </span>
            <span className="font-semibold text-ink-2">{formatMoney(shownMinor, currency)}</span>
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
              onFiltersChange({ q: undefined, category: undefined, day: undefined, view: 'all' })
            }
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* Wraps rather than scrolls above `sm`: at 1280px the search field, two
          selects and the segmented control want more room than the main column
          has once the rail is subtracted, and a wrapped second line reads better
          than a control that has been squeezed narrower than its own label. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <Input
          size="sm"
          type="search"
          value={filters.q ?? ''}
          onChange={(event) =>
            onFiltersChange({ q: event.target.value === '' ? undefined : event.target.value })
          }
          onClear={() => onFiltersChange({ q: undefined })}
          leading={<Search />}
          placeholder="Search expenses, notes or payer…"
          aria-label="Search expenses"
          wrapperClassName="sm:w-64 lg:w-72"
        />

        <div className="scrollbar-none -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 sm:mx-0 sm:ml-auto sm:overflow-visible sm:px-0">
          <SimpleSelect
            size="sm"
            className="w-40 shrink-0"
            options={[
              { value: ALL, label: 'All categories' },
              ...categories.map((option) => ({
                value: option.value,
                label: option.label,
                description: `${option.count} logged`,
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
            ariaLabel="Filter by category"
          />
          <SimpleSelect
            size="sm"
            className="w-36 shrink-0"
            options={[
              { value: ALL, label: 'All days' },
              ...days.map((option) => ({
                value: option.value,
                label: option.label,
                description: `${option.count} logged`,
              })),
            ]}
            value={filters.day ?? ALL}
            onValueChange={(next) => onFiltersChange({ day: next === ALL ? undefined : next })}
            ariaLabel="Filter by day"
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
            className="shrink-0"
          >
            <TabsList aria-label="Whose expenses">
              {EXPENSE_VIEWS.map((view) => (
                <TabsTrigger
                  key={view}
                  value={view}
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
                  {VIEW_LABELS[view]}
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
          {describe(filters, categories, days)}
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
): string {
  const parts: Array<string> = []
  if (filters.view !== 'all') {
    parts.push(VIEW_LABELS[filters.view].toLowerCase())
  }
  if (filters.category !== undefined) {
    parts.push(
      categories.find((option) => option.value === filters.category)?.label ?? filters.category,
    )
  }
  if (filters.day !== undefined) {
    parts.push(days.find((option) => option.value === filters.day)?.label ?? filters.day)
  }
  const needle = (filters.q ?? '').trim()
  if (needle !== '') {
    parts.push(`matching “${needle}”`)
  }
  return parts.length === 0 ? 'Showing everything' : `Filtered: ${parts.join(' · ')}`
}
