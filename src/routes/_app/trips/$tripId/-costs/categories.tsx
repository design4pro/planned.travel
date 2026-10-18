/**
 * The expense categories, in the order the module presents them.
 *
 * The labels are catalogue keys in a `Record<ExpenseCategory, MessageKey>`, so adding a
 * category to the database schema fails to compile here until it has a name and a place in
 * the order. A label is resolved where a translator is at hand - never at module scope,
 * where one evaluation would serve a single locale to every reader of the isolate. The
 * glyphs and tints come from `-lib/tone`, which is the one place in the product where a
 * domain value becomes a colour.
 */
import { cn } from '#/lib/cn'
import { expenseIcon, expenseTint } from '../../../-lib/tone'

import type { CategoryOption } from '#/components/costs'
import type { MessageKey, Translate } from '#/lib/i18n'
import type { ExpenseCategory } from '#/server/fns/costs'

/**
 * Exhaustive by construction: a `Record` over the schema's own union, so adding a
 * category to the database and forgetting to name it here is a compile error.
 */
const CATEGORY_LABEL_KEYS: Record<ExpenseCategory, MessageKey> = {
  accommodation: 'costs.category.accommodation',
  transport: 'costs.category.transport',
  food: 'costs.category.food',
  activities: 'costs.category.activities',
  shopping: 'costs.category.shopping',
  fees: 'costs.category.fees',
  insurance: 'costs.category.insurance',
  other: 'costs.category.other',
}

/**
 * The same keys, widened for lookup by an arbitrary string. A category retired
 * from the schema can still appear on an old row, and that row has to render.
 */
const CATEGORY_LOOKUP: Record<string, MessageKey> = CATEGORY_LABEL_KEYS

export function categoryLabel(category: string, t: Translate): string {
  return t(CATEGORY_LOOKUP[category] ?? CATEGORY_LABEL_KEYS.other)
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

/** The category list the expense dialog's select and the screen's filter are built from. */
export function categoryOptions(t: Translate): ReadonlyArray<CategoryOption> {
  return EXPENSE_CATEGORY_ORDER.map((category) => ({
    value: category,
    label: categoryLabel(category, t),
    icon: <CategoryGlyph category={category} bare />,
  }))
}

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
