/**
 * The Costs tab.
 *
 * The route owns three things: the search-param contract, the one read that fills
 * the screen, and the designed pending and error states. Everything else lives in
 * `-costs/` and `#/components/costs`.
 *
 * Filters live in the URL rather than in component state, so a narrowed view is a
 * link someone can send, survives a reload and works with the back button. Text
 * search replaces the history entry — forty keystrokes should not be forty steps
 * back — while a category, day or view change pushes one, because those are
 * decisions a reader may well want to undo.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { EXPENSE_VIEWS } from '#/components/costs'
import { loadCosts } from '#/server/fns/costs'
import { EXPENSE_CATEGORY_ORDER } from './-costs/categories'
import { useTranslate } from '#/lib/i18n'
import { CostsScreen } from './-costs/screen'
import { CostsSkeleton } from './-costs/skeleton'

import type { CostsFilters } from '#/components/costs'

/**
 * The search contract.
 *
 * Every field ends in `.catch(...)`, so a hand-mangled or stale link degrades to
 * the unfiltered view instead of throwing a search-validation error at the reader.
 * `q` is deliberately *not* trimmed here: trimming in the schema would delete a
 * trailing space as the reader typed it, and their cursor would jump back a word.
 * The filter itself trims, which is where it matters.
 */
const searchSchema = z.object({
  q: z.string().max(120).optional().catch(undefined),
  category: z.enum(EXPENSE_CATEGORY_ORDER).optional().catch(undefined),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  view: z.enum(EXPENSE_VIEWS).default('all').catch('all'),
})

export const Route = createFileRoute('/_app/trips/$tripId/costs')({
  validateSearch: searchSchema,
  loader: ({ params }) => loadCosts({ data: { tripId: params.tripId } }),
  pendingComponent: CostsSkeleton,
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: CostsError,
  component: CostsPage,
})

function CostsError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.costs')} />
    </AppFrame>
  )
}

function CostsPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const filters: CostsFilters = {
    q: search.q,
    category: search.category,
    day: search.day,
    view: search.view,
  }

  const onFiltersChange = useCallback(
    (next: Partial<CostsFilters>): void => {
      const keys = Object.keys(next)
      void navigate({
        search: (previous) => ({ ...previous, ...next }),
        replace: keys.length === 1 && keys[0] === 'q',
      })
    },
    [navigate],
  )

  return (
    <CostsScreen
      data={data}
      filters={filters}
      onFiltersChange={onFiltersChange}
    />
  )
}
