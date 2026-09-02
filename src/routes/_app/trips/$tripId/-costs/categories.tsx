/**
 * The expense categories, in the order the module presents them.
 *
 * The labels live in a `Record<ExpenseCategory, string>`, so adding a category to
 * the database schema fails to compile here until it has a name and a place in the
 * order. The glyphs and tints come from `-lib/tone`, which is the one place in the
 * product where a domain value becomes a colour.
 */
import { cn } from '#/lib/cn'
import { expenseIcon, expenseTint } from '../../../-lib/tone'

import type { CategoryOption } from '#/components/costs'
import type { ExpenseCategory } from '#/server/fns/costs'

/**
 * Exhaustive by construction: a `Record` over the schema's own union, so adding a
 * category to the database and forgetting to name it here is a compile error.
 */
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  accommodation: 'Accommodation',
  transport: 'Transport',
  food: 'Food & drink',
  activities: 'Activities',
  shopping: 'Shopping',
  fees: 'Fees & charges',
  insurance: 'Insurance',
  other: 'Other',
}

/**
 * The same labels, widened for lookup by an arbitrary string. A category retired
 * from the schema can still appear on an old row, and that row has to render.
 */
const CATEGORY_LOOKUP: Record<string, string> = CATEGORY_LABELS

export function categoryLabel(category: string): string {
  return CATEGORY_LOOKUP[category] ?? 'Other'
}

/**
 * The presentation order, typed as a non-empty tuple of the schema's union so it
 * can seed a Zod enum for the URL's category filter without a cast.
 */
export const EXPENSE_CATEGORY_ORDER: readonly [
  ExpenseCategory,
  ...Array<ExpenseCategory>,
] = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'fees',
  'insurance',
  'other',
]

/** The category list the expense dialog's select is built from. */
export const CATEGORY_OPTIONS: ReadonlyArray<CategoryOption> =
  EXPENSE_CATEGORY_ORDER.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
    icon: <CategoryGlyph category={category} bare />,
  }))

/**
 * The leading chip on an expense row.
 *
 * An expense has no image to carry it, so this is the only thing that tells a
 * reader what kind of spend they are looking at before they read the words.
 */
export function CategoryGlyph({
  category,
  bare = false,
  className,
}: {
  category: string
  /** Renders the glyph alone, for a select item that supplies its own box. */
  bare?: boolean
  className?: string
}) {
  const Icon = expenseIcon(category)
  if (bare) {
    return <Icon aria-hidden className="size-4" />
  }
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-lg',
        expenseTint(category),
        className,
      )}
    >
      <Icon aria-hidden className="size-4.5" />
    </span>
  )
}
