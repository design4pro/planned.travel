import '#/components/ui/__tests__/test-env'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { Route } from '#/routes/_app/collections/$collectionId'

const state = vi.hoisted(() => ({
  user: 'first-user',
  workspace: 'first-workspace',
  invalidate: vi.fn(),
  update: vi.fn(),
  collection: {
    id: 'same-collection',
    name: 'Someday',
    description: null,
    colour: '#2F6F5E',
    placeCount: 0,
  },
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useRouteContext: () => ({
      shell: {
        session: {
          user: { id: state.user },
          organization: { id: state.workspace },
        },
      },
    }),
    useLoaderData: () => ({
      collection: state.collection,
      canManage: true,
      places: [],
      labels: [],
      byStatus: [],
    }),
    useSearch: () => ({}),
    useParams: () => ({ collectionId: state.collection.id }),
  }),
  useRouter: () => ({ invalidate: state.invalidate }),
  useBlocker: vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  AppSections: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('#/routes/_app/-server/collections', () => ({
  updateCollectionFn: state.update,
  collectionDeleteSummaryFn: vi.fn(),
  deleteCollectionFn: vi.fn(),
  setPlaceStatusFn: vi.fn(),
}))
vi.mock('#/routes/_app/-server/library', () => ({
  loadCollectionDetail: async () => ({ collection: state.collection }),
  loadCollections: vi.fn(),
}))
const messages = {
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}
const Page = Route.options.component as () => ReactNode
function page() {
  return (
    <I18nProvider locale="en" messages={messages}>
      <Page />
    </I18nProvider>
  )
}
async function edit() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Actions for Someday' }))
  await user.click(screen.getByRole('menuitem', { name: 'Edit details' }))
  return user
}
function name() {
  return screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement
}
function dirty() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('collection route session ownership', () => {
  it.each(['user', 'workspace'] as const)(
    'replaces the same collection owner when %s changes and ignores its deferred save',
    async (identity) => {
      state.user = 'first-user'
      state.workspace = 'first-workspace'
      let finish: () => void = () => undefined
      state.update.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      )
      const view = render(page())
      const user = await edit()
      await user.type(name(), ' old draft')
      await user.keyboard('{Escape}')
      expect(dirty()).toBe(true)
      state[identity] = 'second-' + identity
      view.rerender(page())
      expect(dirty()).toBe(false)
      await edit()
      expect(name().value).toBe('Someday')
      await user.type(name(), ' pending old save')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      expect(state.update).toHaveBeenCalledOnce()
      state[identity] = 'third-' + identity
      view.rerender(page())
      expect(screen.queryByRole('dialog')).toBeNull()
      await edit()
      expect(name().value).toBe('Someday')
      await user.type(name(), ' new owner draft')
      await act(async () => {
        finish()
      })
      expect(state.invalidate).not.toHaveBeenCalled()
      expect(name().value).toBe('Someday new owner draft')
      expect(dirty()).toBe(true)
      await user.keyboard('{Escape}')
      await edit()
      expect(name().value).toBe('Someday new owner draft')
    },
  )
})
