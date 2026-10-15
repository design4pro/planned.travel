import { useEffect, useState } from 'react'
import { createFileRoute, useRouteContext } from '@tanstack/react-router'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  NotesBoard,
  PollsBoard,
  PresenceBar,
  Thread,
} from '#/components/modules/collab'
import { ModulePanel } from '#/components/modules/shared'
import { Card } from '#/components/ui'
import { TRIP_RAIL_STICKY_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadTripCollab } from './-server/collab'
import { formatNumber } from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/collab')({
  loader: ({ params }) => loadTripCollab({ data: { tripId: params.tripId } }),
  pendingComponent: CollabPending,
  errorComponent: CollabError,
  component: CollabPage,
})

function CollabError({ error }: { error: Error }) {
  const t = useTranslate()

  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('trips.error.collab')} />
    </AppFrame>
  )
}

function CollabPage() {
  const locale = useLocale()
  const t = useTranslate()
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  const { shell } = useRouteContext({ from: '/_app' })

  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [newPollOpen, setNewPollOpen] = useState(false)

  /**
   * The realtime room is opened only after hydration.
   *
   * The socket hook must never run during server rendering — there is no window
   * to read an origin from and no connection to keep — so the component that owns
   * it is mounted from an effect rather than guarded inside itself.
   */
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  const empty =
    data.messages.length === 0 &&
    data.notes.length === 0 &&
    data.polls.length === 0

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title={t('trips.collab.title')}
          description={
            empty
              ? t('trips.collab.empty')
              : // A list, not a sentence: each tally agrees on its own count and
                // the middle dot does the joining.
                [
                  t('trips.collab.count.messages', {
                    count: data.messages.length,
                    messages: formatNumber(data.messages.length, locale),
                  }),
                  t('trips.collab.count.notes', {
                    count: data.notes.length,
                    notes: formatNumber(data.notes.length, locale),
                  }),
                  t('trips.collab.count.polls', {
                    count: data.polls.length,
                    polls: formatNumber(data.polls.length, locale),
                  }),
                ].join(' · ')
          }
        >
          {live ? <PresenceBar tripId={tripId} /> : null}
        </TripModuleHeader>

        <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)] xl:gap-8">
          <ModulePanel
            label={t('trips.collab.conversation')}
            count={
              data.messages.length === 0
                ? undefined
                : formatNumber(data.messages.length, locale)
            }
            // 12rem of slack, not 6: the panel is sticky *below* the page header,
            // so at the top of the page its foot — and therefore the composer —
            // otherwise sat under the fold.
            className={cn(
              'xl:sticky xl:max-h-[calc(100svh-var(--impersonation-h)-var(--nav-h)-1px-var(--subnav-h)-1px-12rem)]',
              TRIP_RAIL_STICKY_CLASS,
            )}
            bodyClassName="flex min-h-0 flex-col px-5 py-3"
          >
            <Thread
              tripId={tripId}
              messages={data.messages}
              people={data.people}
              viewerUserId={data.viewerUserId}
              canModerate={shell.role !== 'member'}
              timeZone={data.timeZone}
            />
          </ModulePanel>

          <div className="flex min-w-0 flex-col gap-6">
            <NotesBoard
              tripId={tripId}
              notes={data.notes}
              people={data.people}
              newNoteOpen={newNoteOpen}
              onNewNoteOpenChange={setNewNoteOpen}
            />
            <PollsBoard
              tripId={tripId}
              polls={data.polls}
              viewerUserId={data.viewerUserId}
              newPollOpen={newPollOpen}
              onNewPollOpenChange={setNewPollOpen}
            />
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}

function CollabPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)] xl:gap-8">
          <Card padding="none">
            <RowsSkeleton rows={6} />
          </Card>
          <Card padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
