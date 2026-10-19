import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ComponentType, PropsWithChildren } from 'react'

const container = ({ children }: PropsWithChildren) => <div>{children}</div>
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: container,
  AppSections: container,
}))
vi.mock('#/components/layout/error-state', () => ({ ErrorPanel: () => null }))
vi.mock('#/components/modules/files', () => ({
  CalendarPanel: () => <div>Calendar</div>,
  ExportPanel: () => <div>PDF</div>,
  FileLibrary: () => <div>Attachments</div>,
  StorageMeter: () => null,
  UploadFilesAction: () => null,
}))
vi.mock('#/components/modules/files/places-panel', () => ({
  PlacesPanel: () => <div>Places</div>,
}))
vi.mock('#/components/ui', () => ({
  Button: container,
  Card: container,
  Progress: () => null,
  StatCard: () => null,
}))
vi.mock('#/lib/i18n', () => ({ useTranslate: () => (key: string) => key }))
vi.mock('../../../../-server/trip', () => ({ loadTripFiles: vi.fn() }))
vi.mock('../../../../-ui/trip-header', () => ({ TripModuleHeader: container }))
vi.mock('../../../../-ui/scaffold', () => ({
  HeaderSkeleton: () => null,
  RowsSkeleton: () => null,
  StatsSkeleton: () => null,
}))
const { Route } = await import('../../files')

it('renders the places and PDF panels together without duplicate React keys', () => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    files: [],
    tripBytes: 0,
    workspaceBytes: 0,
    limitBytes: 1,
    byKind: [],
    people: [],
    hasDates: false,
    hasPlaces: true,
  })
  vi.spyOn(Route, 'useParams').mockReturnValue({ tripId: 'trip-1' })
  vi.spyOn(Route, 'useSearch').mockReturnValue({ export: undefined })
  const warnings = vi.spyOn(console, 'error').mockImplementation(() => {})
  const Component = Route.options.component as ComponentType
  const result = render(<Component />)
  expect(result.getByText('Places')).toBeTruthy()
  expect(result.getByText('PDF')).toBeTruthy()
  expect(
    warnings.mock.calls.filter((call) => String(call[0]).includes('same key')),
  ).toEqual([])
})
