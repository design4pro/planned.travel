import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type * as ReactRouter from '@tanstack/react-router'
import type { ComponentType, PropsWithChildren, ReactNode } from 'react'

const container = ({ children }: PropsWithChildren) => <div>{children}</div>
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useRouteContext: () => ({ shell: { role: 'admin' } }),
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: container,
  AppSections: container,
}))
vi.mock('#/components/layout/error-state', () => ({ ErrorPanel: () => null }))
vi.mock('#/components/modules/collab', () => ({ PresenceBar: () => null }))
vi.mock('#/components/modules/collab/collab-screen', () => ({
  CollabScreen: () => null,
}))
vi.mock('#/components/modules/collab/collab-sections-menu', () => ({
  CollabSectionsMenu: () => <button>Configure sections</button>,
}))
vi.mock('#/components/modules/collab/collab-summary', () => ({
  collabSummary: () => '',
}))
vi.mock('#/components/modules/collab/collab-skeletons', () => ({
  CollabSkeletons: () => null,
}))
vi.mock('#/lib/i18n', () => ({
  useLocale: () => 'en',
  useTranslate: () => (key: string) => key,
}))
vi.mock('../../-server/collab', () => ({
  loadTripCollab: vi.fn(),
  setCollabSectionFn: vi.fn(),
}))
vi.mock('../../../../-ui/trip-header', () => ({
  TripModuleHeader: ({ actions }: { actions: ReactNode }) => (
    <div>{actions}</div>
  ),
}))
vi.mock('../../../../-ui/scaffold', () => ({ HeaderSkeleton: () => null }))

const { Route } = await import('../../collab')
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it.each([
  [undefined, true, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
] as const)(
  'gates section writes on capability %s and configuration permission %s',
  (canWrite, canConfigure, expected) => {
    vi.spyOn(Route, 'useLoaderData').mockReturnValue({
      sections: { conversation: true, notes: true, polls: true },
      canConfigure,
      canWrite,
      messages: [],
      messageCount: 0,
      notes: [],
      polls: [],
      people: [],
      viewerUserId: 'reader',
      timeZone: 'UTC',
    })
    vi.spyOn(Route, 'useParams').mockReturnValue({ tripId: 'trip' })
    const Component = Route.options.component as ComponentType
    render(<Component />)
    expect(
      screen.queryByRole('button', { name: 'Configure sections' }) !== null,
    ).toBe(expected)
  },
)
