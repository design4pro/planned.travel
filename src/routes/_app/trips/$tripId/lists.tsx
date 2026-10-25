import { useState } from 'react'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { CheckCheck, Scale } from 'lucide-react'

import { requireFound } from '#/lib/absence'
import { useLocale } from '#/lib/i18n'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  ListsBoard,
  NewListAction,
  progressOf,
} from '#/components/modules/lists'
import { Card, Progress, StatCard } from '#/components/ui'
import { loadTripLists } from '../../-server/trip'
import {
  formatNumber,
  formatPercent,
  formatWeight,
  pluralise,
} from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/lists')({
  loader: async ({ params }) =>
    requireFound(await loadTripLists({ data: { tripId: params.tripId } })),
  pendingComponent: ListsPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The lists did not load" />
    </AppFrame>
  ),
  component: ListsPage,
})

function ListsPage() {
  const locale = useLocale()
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  // The signed-in user comes off the shell's route context rather than a second
  // request: `_app` has already resolved the session for every screen below it.
  const { shell } = useRouteContext({ from: '/_app' })
  const [newListOpen, setNewListOpen] = useState(false)

  // Counted from the items themselves rather than from the loader's roll-up, so
  // an optimistic tick moves these numbers at the same instant as the checkbox.
  const everything = data.lists.flatMap((list) => list.items)
  const overall = progressOf(everything)
  const heaviest = [...data.lists]
    .map((list) => ({ list, weight: progressOf(list.items).weightGrams }))
    .sort((left, right) => right.weight - left.weight)
    .at(0)

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Lists"
          description={
            overall.total === 0
              ? 'No items yet'
              : `${formatNumber(overall.done, locale)} of ${formatNumber(overall.total, locale)} packed · ${formatPercent(overall.ratio, locale)}`
          }
          actions={
            data.canWrite ? (
              <NewListAction onClick={() => setNewListOpen(true)} />
            ) : undefined
          }
        />

        {overall.total === 0 && data.lists.length === 0 ? null : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                tone="inverse"
                icon={<CheckCheck />}
                label="Packed"
                value={overall.done}
                unit={`of ${formatNumber(overall.total, locale)}`}
                caption={
                  overall.total === 0
                    ? 'Nothing on the lists yet'
                    : `${formatPercent(overall.ratio, locale)} of everything`
                }
              />
              <StatCard
                label="Lists"
                value={data.lists.length}
                caption={pluralise(
                  data.lists.filter((list) => list.ownerUserId === null).length,
                  'shared list',
                )}
              />
              <StatCard
                icon={<Scale />}
                label="Pack weight"
                value={formatWeight(overall.weightGrams)}
                caption={
                  heaviest === undefined || heaviest.weight === 0
                    ? 'No weights recorded'
                    : `heaviest: ${heaviest.list.name}`
                }
              />
              <StatCard
                label="Still open"
                value={overall.open}
                caption={
                  overall.complete
                    ? 'Everything is packed'
                    : 'Items waiting to be ticked'
                }
              />
            </div>

            <Card>
              <Progress
                value={overall.done}
                max={Math.max(overall.total, 1)}
                size="lg"
                tone={overall.complete ? 'success' : 'brand'}
                label="Everything, across every list"
                valueText={`${formatNumber(overall.done, locale)} / ${formatNumber(overall.total, locale)}`}
              />
            </Card>
          </>
        )}

        <ListsBoard
          tripId={tripId}
          lists={data.lists}
          people={data.people}
          viewerUserId={shell.session.user.id}
          canWrite={data.canWrite}
          archived={data.archived}
          newListOpen={newListOpen}
          onNewListOpenChange={setNewListOpen}
        />
      </AppSections>
    </AppFrame>
  )
}

function ListsPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
