import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type * as ReactRouter from '@tanstack/react-router'
import type { ComponentType, PropsWithChildren, ReactNode } from 'react'

/**
 * The reason the bookings screen gives a reader who may not write (#1091): the trip is archived,
 * which is true for an owner and an editor too, or the role is short. A writer of a live trip is
 * told neither.
 */
const container = ({ children }: PropsWithChildren) => <div>{children}</div>
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useRouteContext: () => ({
    shell: { session: { user: { id: 'user-1' }, organization: null } },
  }),
}))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: container,
  AppSections: container,
}))
vi.mock('#/components/layout/error-state', () => ({ ErrorPanel: () => null }))
vi.mock('#/components/modules/book', () => ({
  BookingsTimeline: () => null,
  ImportBookingsAction: () => <button>Import bookings</button>,
  ImportBookingsDialog: () => null,
  NewBookingAction: () => <button>New booking</button>,
  bookImportsOwner: () => 'owner',
}))
vi.mock('#/components/ui', () => ({
  Alert: container,
  Card: container,
  ProgressRing: () => null,
  StatCard: () => null,
}))
vi.mock('#/lib/i18n', () => ({
  useLocale: () => 'en',
  useTranslate: () => (key: string) => key,
}))
vi.mock('#/server/fns/reservations', () => ({ loadBookingDeskFn: vi.fn() }))
vi.mock('../../../../-server/settings', () => ({
  loadDisplayPreferences: vi.fn(),
}))
vi.mock('../../../../-ui/trip-header', () => ({
  TripModuleHeader: ({
    actions,
  }: PropsWithChildren<{ actions: ReactNode }>) => <div>{actions}</div>,
}))
vi.mock('../../../../-ui/scaffold', () => ({
  HeaderSkeleton: () => null,
  RowsSkeleton: () => null,
  StatsSkeleton: () => null,
}))
const { Route } = await import('../../book')

afterEach(cleanup)

function mount(canWrite: boolean, archived: boolean) {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    currency: 'EUR',
    canWrite,
    archived,
    bookings: [],
    days: [],
    byStatus: [],
    committedMinor: 0,
    maskCodes: false,
  })
  vi.spyOn(Route, 'useParams').mockReturnValue({ tripId: 'trip-1' })
  vi.spyOn(Route, 'useSearch').mockReturnValue({ import: undefined })
  vi.spyOn(Route, 'useNavigate').mockReturnValue(vi.fn())
  const Component = Route.options.component as ComponentType
  return render(<Component />)
}

it('tells a viewer of a live trip that only owners and editors change the bookings', () => {
  const result = mount(false, false)
  expect(result.getByText('trips.book.readOnly.role')).toBeTruthy()
  expect(result.queryByText('trips.book.readOnly.archived')).toBeNull()
  expect(result.queryByRole('button', { name: 'New booking' })).toBeNull()
})

it('tells every reader of an archived trip to restore it', () => {
  const result = mount(false, true)
  expect(result.getByText('trips.book.readOnly.archived')).toBeTruthy()
  expect(result.queryByText('trips.book.readOnly.role')).toBeNull()
})

it('says nothing, and offers the writers, to a writer of a live trip', () => {
  const result = mount(true, false)
  expect(result.queryByText(/trips\.book\.readOnly/)).toBeNull()
  expect(result.getByRole('button', { name: 'New booking' })).toBeTruthy()
})
