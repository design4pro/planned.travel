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
import { collabSummary } from '#/components/modules/collab/collab-summary'
import { CollabSkeletons } from '#/components/modules/collab/collab-skeletons'
import { requireFound } from '#/lib/absence'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadTripCollab, setCollabSectionFn } from './-server/collab'
import { HeaderSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/collab')({
  loader: async ({ params }) =>
    requireFound(await loadTripCollab({ data: { tripId: params.tripId } })),
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

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title={t('trips.collab.title')}
          description={collabSummary(data, t, locale)}
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
