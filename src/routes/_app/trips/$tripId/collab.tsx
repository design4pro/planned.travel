import { useEffect, useRef, useState } from 'react'
import {
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PresenceBar } from '#/components/modules/collab'
import { CollabScreen } from '#/components/modules/collab/collab-screen'
import { CollabSectionsMenu } from '#/components/modules/collab/collab-sections-menu'
import { enabledCollabSections } from '#/lib/collab-sections'
import { CollabSkeletons } from '#/components/modules/collab/collab-skeletons'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadTripCollab, setCollabSectionFn } from './-server/collab'
import { formatNumber } from '../../-lib/format'
import { HeaderSkeleton } from '../../-ui/scaffold'
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

  const router = useRouter()
  const ownWrite = useRef(false)

  /**
   * The realtime room is opened only after hydration.
   *
   * The socket hook must never run during server rendering — there is no window
   * to read an origin from and no connection to keep — so the component that owns
   * it is mounted from an effect rather than guarded inside itself.
   */
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  const enabled = enabledCollabSections(data.sections)
  const empty =
    enabled.length === 3 &&
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
                enabled
                  .map((id) => {
                    const counts = {
                      conversation: t('trips.collab.count.messages', {
                        count: data.messages.length,
                        messages: formatNumber(data.messages.length, locale),
                      }),
                      notes: t('trips.collab.count.notes', {
                        count: data.notes.length,
                        notes: formatNumber(data.notes.length, locale),
                      }),
                      polls: t('trips.collab.count.polls', {
                        count: data.polls.length,
                        polls: formatNumber(data.polls.length, locale),
                      }),
                    }
                    return counts[id]
                  })
                  .join(' · ')
          }
          actions={
            data.canConfigure ? (
              <CollabSectionsMenu
                sections={data.sections}
                write={(section, on) =>
                  setCollabSectionFn({ data: { tripId, section, on } })
                }
                refresh={() => router.invalidate()}
                onWritingChange={(writing) => {
                  ownWrite.current = writing
                }}
              />
            ) : null
          }
        >
          {live ? <PresenceBar tripId={tripId} /> : null}
        </TripModuleHeader>

        <CollabScreen
          data={data}
          tripId={tripId}
          canModerate={shell.role !== 'member'}
          ownWrite={ownWrite}
        />
      </AppSections>
    </AppFrame>
  )
}

function CollabPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <CollabSkeletons />
      </AppSections>
    </AppFrame>
  )
}
