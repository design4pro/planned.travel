import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileImage, HardDrive, Ticket } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import {
  CalendarPanel,
  FileLibrary,
  StorageMeter,
  UploadFilesAction,
} from '#/components/modules/files'
import { Card, Progress, StatCard } from '#/components/ui'
import { formatStorage } from '#/lib/plans'
import { loadTripFiles } from '../../-server/trip'
import { pluralise } from '../../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../../-ui/scaffold'
import { TripModuleHeader } from '../../-ui/trip-header'

export const Route = createFileRoute('/_app/trips/$tripId/files')({
  loader: ({ params }) => loadTripFiles({ data: { tripId: params.tripId } }),
  pendingComponent: FilesPending,
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="The files did not load" />
    </AppFrame>
  ),
  component: FilesPage,
})

function FilesPage() {
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
            <UploadFilesAction onClick={() => setPickRequestedAt(Date.now())} />
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

        <FileLibrary
          tripId={tripId}
          files={data.files}
          people={data.people}
          workspaceBytes={data.workspaceBytes}
          limitBytes={data.limitBytes}
          pickRequestedAt={pickRequestedAt}
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
