import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireFound } from '#/lib/absence'
import { useTranslate } from '#/lib/i18n'
import { FileImage, HardDrive, Ticket } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  CalendarPanel,
  ExportPanel,
  FileLibrary,
  StorageMeter,
  UploadFilesAction,
} from '#/components/modules/files'
import { PlacesPanel } from '#/components/modules/files/places-panel'
import { Button, Card, Progress, StatCard } from '#/components/ui'
import { formatStorage } from '#/lib/plans'
import { loadTripFiles } from '../../-server/trip'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/files')({
  validateSearch: z.object({
    export: z
      .string()
      .regex(/^[A-Za-z0-9-]{1,128}$/)
      .optional()
      .catch(undefined),
  }),
  loader: async ({ params }) =>
    requireFound(await loadTripFiles({ data: { tripId: params.tripId } })),
  pendingComponent: FilesPending,
  errorComponent: FilesError,
  component: FilesPage,
})

function FilesError({ error }: { error: Error }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('modules.files.page.error')} />
    </AppFrame>
  )
}

function FilesPage() {
  const t = useTranslate()
  const { export: exportId } = Route.useSearch()
  const exportHeading = useRef<HTMLDivElement>(null)
  const data = Route.useLoaderData()
  const { tripId } = Route.useParams()
  /**
   * The header's upload button and the library's hidden file input live in
   * different components, so the button asks for the picker by bumping a
   * timestamp rather than by reaching across the tree for a ref.
   */
  const [pickRequestedAt, setPickRequestedAt] = useState(0)

  const hasLimit = Number.isFinite(data.limitBytes) && data.limitBytes >= 0
  const limit = Math.max(data.limitBytes, 1)
  const count = data.files.length
  const tripSize = formatStorage(data.tripBytes)
  const fileCount = t('modules.files.count.attached', { count })
  const ratio = data.workspaceBytes / limit
  const images = data.files.filter((file) => file.kind === 'image').length
  const documents = data.files.filter(
    (file) => file.kind === 'ticket' || file.kind === 'receipt',
  ).length

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title={t('shell.trip.tab.files')}
          description={
            count === 0
              ? t('modules.files.page.empty')
              : t('modules.files.page.summary', {
                  files: fileCount,
                  size: tripSize,
                })
          }
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  exportHeading.current?.focus({ preventScroll: true })
                  exportHeading.current?.scrollIntoView({
                    behavior: 'instant',
                    block: 'start',
                  })
                }}
              >
                {t('modules.files.export.jump')}
              </Button>
              {data.canWrite ? (
                <UploadFilesAction
                  onClick={() => setPickRequestedAt(Date.now())}
                />
              ) : null}
            </>
          }
        >
          <StorageMeter
            usedBytes={data.workspaceBytes}
            limitBytes={data.limitBytes}
          />
        </TripModuleHeader>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            tone="inverse"
            icon={<HardDrive />}
            label={t('modules.files.page.thisTrip')}
            value={tripSize}
            caption={fileCount}
          />
          <StatCard
            label={t('modules.files.page.workspaceStorage')}
            value={formatStorage(data.workspaceBytes)}
            unit={
              hasLimit
                ? t('modules.files.storage.ofLimit', {
                    limit: formatStorage(data.limitBytes),
                  })
                : undefined
            }
            caption={
              hasLimit
                ? t('modules.files.storage.percentUsed', {
                    percent: Math.round(ratio * 100),
                  })
                : t('modules.files.storage.unlimited')
            }
            footer={
              hasLimit ? (
                <Progress
                  value={data.workspaceBytes}
                  max={limit}
                  size="xs"
                  tone={
                    ratio > 0.9 ? 'danger' : ratio > 0.7 ? 'warning' : 'brand'
                  }
                />
              ) : undefined
            }
          />
          <StatCard
            icon={<FileImage />}
            label={t('journal.figure.photos')}
            value={images}
            caption={t('modules.files.page.photosCaption')}
          />
          <StatCard
            icon={<Ticket />}
            label={t('modules.files.page.documents')}
            value={documents}
            caption={t('modules.files.page.documentsCaption')}
          />
        </div>

        <CalendarPanel tripId={tripId} hasDates={data.hasDates} />

        <PlacesPanel
          key={`places-${tripId}`}
          tripId={tripId}
          hasPlaces={data.hasPlaces}
        />

        <FileLibrary
          canWrite={data.canWrite}
          archived={data.archived}
          tripId={tripId}
          files={data.files}
          people={data.people}
          workspaceBytes={data.workspaceBytes}
          limitBytes={data.limitBytes}
          pickRequestedAt={pickRequestedAt}
        />

        <ExportPanel
          key={tripId}
          tripId={tripId}
          exportId={exportId}
          headingRef={exportHeading}
        />
      </AppSections>
    </AppFrame>
  )
}

function FilesPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <Card padding="none">
          <RowsSkeleton rows={6} />
        </Card>
      </AppSections>
    </AppFrame>
  )
}
