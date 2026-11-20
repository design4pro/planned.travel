import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ComponentType, PropsWithChildren, ReactNode } from 'react'

import { I18nProvider, loadCatalogue } from '#/lib/i18n'

const container = ({ children }: PropsWithChildren) => <div>{children}</div>
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: container,
  AppSections: container,
}))
vi.mock('#/components/layout/error-state', () => ({
  ErrorPanel: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('#/components/modules/files', () => ({
  CalendarPanel: () => <div>Calendar</div>,
  ExportPanel: () => <div>PDF</div>,
  FileLibrary: ({ canWrite }: { canWrite: boolean }) => (
    <div>{canWrite ? 'Writable attachments' : 'Read-only attachments'}</div>
  ),
  StorageMeter: () => null,
  UploadFilesAction: () => <button>Upload files</button>,
}))
vi.mock('#/components/modules/files/places-panel', () => ({
  PlacesPanel: () => <div>Places</div>,
}))
vi.mock('#/components/ui', () => ({
  Button: container,
  Card: container,
  Progress: () => null,
  StatCard: ({
    label,
    caption,
    unit,
  }: {
    label: string
    caption?: string
    unit?: string
  }) => (
    <div>
      <span>{label}</span>
      <span>{caption}</span>
      <span>{unit}</span>
    </div>
  ),
}))
vi.mock('../../../../-server/trip', () => ({ loadTripFiles: vi.fn() }))
vi.mock('../../../../-ui/trip-header', () => ({
  TripModuleHeader: ({
    children,
    actions,
    title,
    description,
  }: PropsWithChildren<{
    actions: ReactNode
    title: string
    description: string
  }>) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
      {children}
    </div>
  ),
}))
vi.mock('../../../../-ui/scaffold', () => ({
  HeaderSkeleton: () => null,
  RowsSkeleton: () => null,
  StatsSkeleton: () => null,
}))
const { Route } = await import('../../files')

const EN = await loadCatalogue('en')

afterEach(cleanup)

it('renders the places and PDF panels together without duplicate React keys', () => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    canWrite: true,
    archived: false,
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
  const result = render(
    <I18nProvider locale="en" messages={EN}>
      <Component />
    </I18nProvider>,
  )
  expect(result.getByText('Places')).toBeTruthy()
  expect(result.getByText('PDF')).toBeTruthy()
  expect(
    warnings.mock.calls.filter((call) => String(call[0]).includes('same key')),
  ).toEqual([])
})

it.each([false, true])(
  'the files page offers upload only to writers: %s',
  (canWrite) => {
    vi.spyOn(Route, 'useLoaderData').mockReturnValue({
      canWrite,
      archived: false,
      files: [],
      tripBytes: 0,
      workspaceBytes: 0,
      limitBytes: 1,
      byKind: [],
      people: [],
      hasDates: false,
      hasPlaces: false,
    })
    vi.spyOn(Route, 'useParams').mockReturnValue({ tripId: 'trip-1' })
    vi.spyOn(Route, 'useSearch').mockReturnValue({ export: undefined })
    const Component = Route.options.component as ComponentType
    const result = render(
      <I18nProvider locale="en" messages={EN}>
        <Component />
      </I18nProvider>,
    )
    expect(
      result.queryByRole('button', { name: 'Upload files' }) !== null,
    ).toBe(canWrite)
    expect(
      result.getByText(
        canWrite ? 'Writable attachments' : 'Read-only attachments',
      ),
    ).toBeTruthy()
  },
)

it.each([
  [0, '0 plików', 'Nie ma jeszcze załączników'],
  [1, '1 plik', '1 plik · 256 B w tej podróży'],
  [2, '2 pliki', '2 pliki · 256 B w tej podróży'],
  [5, '5 plików', '5 plików · 256 B w tej podróży'],
])(
  'localizes the Files page with %s attachments',
  async (count, fileCount, summary) => {
    vi.spyOn(Route, 'useLoaderData').mockReturnValue({
      canWrite: false,
      archived: false,
      files: Array.from({ length: count }, (_, index) => ({
        id: `file-${index}`,
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 256,
        kind: 'image',
        description: null,
        uploadedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
      })),
      tripBytes: count ? 256 : 0,
      workspaceBytes: 256,
      limitBytes: 512,
      byKind: [],
      people: [],
      hasDates: false,
      hasPlaces: false,
    })
    vi.spyOn(Route, 'useParams').mockReturnValue({ tripId: 'trip-1' })
    vi.spyOn(Route, 'useSearch').mockReturnValue({ export: undefined })
    const Component = Route.options.component as ComponentType
    render(
      <I18nProvider locale="pl" messages={await loadCatalogue('pl')}>
        <Component />
      </I18nProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Pliki' })).toBeTruthy()
    expect(screen.getByText(summary)).toBeTruthy()
    expect(screen.getByText(fileCount)).toBeTruthy()
    expect(screen.getByText('Wykorzystano 50%')).toBeTruthy()
    expect(screen.getByText('z 512 B')).toBeTruthy()
  },
)

it('localizes the Files error title', async () => {
  const ErrorComponent = Route.options.errorComponent
  if (!ErrorComponent) throw new Error('Files has no error component')
  render(
    <I18nProvider locale="pl" messages={await loadCatalogue('pl')}>
      <ErrorComponent error={new Error('Files failed')} reset={vi.fn()} />
    </I18nProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Nie udało się wczytać plików' }),
  ).toBeTruthy()
})
