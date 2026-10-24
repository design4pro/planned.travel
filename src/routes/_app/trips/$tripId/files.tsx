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
import { pluralise } from '../../-lib/format'
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
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The files did not load" />
    </AppFrame>
  ),
  component: FilesPage,
})

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

  const limit = Math.max(data.limitBytes, 1)
  const ratio = data.workspaceBytes / limit
  const images = data.files.filter((file) => file.kind === 'image').length
  const documents = data.files.filter(
    (file) => file.kind === 'ticket' || file.kind === 'receipt',
  ).length

  return (
    <AppFrame>
      <AppSections>
        <TripModuleHeader
          title="Files"
          description={
            data.files.length === 0
              ? 'Nothing attached yet'
              : `${pluralise(data.files.length, 'file')} · ${formatStorage(data.tripBytes)} on this trip`
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
            label="This trip"
            value={formatStorage(data.tripBytes)}
            caption={pluralise(data.files.length, 'file')}
          />
          <StatCard
            label="Workspace storage"
            value={formatStorage(data.workspaceBytes)}
            unit={`of ${formatStorage(limit)}`}
            caption={`${Math.round(ratio * 100)}% used`}
            footer={
              <Progress
                value={data.workspaceBytes}
                max={limit}
                size="xs"
                tone={
                  ratio > 0.9 ? 'danger' : ratio > 0.7 ? 'warning' : 'brand'
                }
              />
            }
          />
          <StatCard
            icon={<FileImage />}
            label="Photos"
            value={images}
            caption="Images across this trip"
          />
          <StatCard
            icon={<Ticket />}
            label="Tickets & receipts"
            value={documents}
            caption="Ready for the border and the accountant"
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
