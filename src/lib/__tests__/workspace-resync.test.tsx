import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { useWorkspaceResync } from '#/components/layout/workspace-switcher'
import { readWorkspaceShell } from '../room-refresh'
import {
  beginWorkspaceSwitch,
  endWorkspaceSwitch,
  resetWorkspaceClaim,
  waitForWorkspaceCalls,
  workspaceClaimState,
  workspaceResyncToken,
  workspaceSwitchFetch,
  takeWorkspaceDocumentFetch,
} from '../workspace-claim-store'
import { WORKSPACE_CLAIM_HEADER } from '../workspace-claim'

type Handler = (ctx: {
  fetch?: typeof globalThis.fetch
  next: (options?: { headers?: Record<string, string> }) => Promise<unknown>
}) => Promise<unknown>
vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ client: (handler: Handler) => handler }),
}))

afterEach(() => {
  cleanup()
  resetWorkspaceClaim()
})

it.each([undefined, 'en'])(
  'resynchronizes through the real router and follows workspace language with override %s',
  async (override) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const { workspaceClaimMiddleware } =
      await import('../workspace-claim-middleware')
    const call = workspaceClaimMiddleware as unknown as Handler
    let session = 'org_a'
    let rootReads = 0
    let failure: unknown
    let localeStarted = false
    let releaseLocale = () => {}
    const localeReady = new Promise<void>((resolve) => {
      releaseLocale = resolve
    })
    const dashboardClaims: Array<string | undefined> = []
    function Switch() {
      const resync = useWorkspaceResync()
      return (
        <button
          onClick={() => {
            const token = beginWorkspaceSwitch()
            void (async () => {
              try {
                await waitForWorkspaceCalls(token)
                session = 'org_b'
                await resync(token, ['org_b'])
              } catch (error) {
                failure = error
              } finally {
                endWorkspaceSwitch(token)
              }
            })()
          }}
        >
          Switch
        </button>
      )
    }
    const root = createRootRoute({
      component: Outlet,
      staleTime: Infinity,
      loader: async () => {
        rootReads += 1
        await call({
          fetch: takeWorkspaceDocumentFetch(),
          next: async (options) => {
            if (rootReads > 1) {
              expect(options?.headers?.[WORKSPACE_CLAIM_HEADER]).toBe('org_b')
              if (rootReads === 2) {
                localeStarted = true
                await localeReady
              }
            }
            return 'negotiated catalogue'
          },
        })
        const locale = override ?? (session === 'org_a' ? 'pl' : 'ar')
        return { locale, dir: locale === 'ar' ? 'rtl' : 'ltr' }
      },
    })
    const app = createRoute({
      getParentRoute: () => root,
      id: '_app',
      component: Outlet,
      beforeLoad: async ({ abortController, preload }) => {
        const shell = await readWorkspaceShell(
          abortController,
          preload,
          async (_, fetch) => {
            await call({ fetch, next: async () => 'shell' })
            return { session: { organization: { id: session } } }
          },
        )
        return {
          shell,
          workspaceTransition: workspaceResyncToken(abortController),
        }
      },
    })
    const start = createRoute({
      getParentRoute: () => app,
      path: 'start',
      component: Switch,
    })
    const dashboard = createRoute({
      getParentRoute: () => app,
      path: 'dashboard',
      loader: async ({ context }) => {
        await call({
          fetch: workspaceSwitchFetch(context.workspaceTransition),
          next: async (options) => {
            dashboardClaims.push(options?.headers?.[WORKSPACE_CLAIM_HEADER])
            return 'dashboard'
          },
        })
        return 'Dashboard'
      },
      component: () => <h1>{dashboard.useLoaderData()}</h1>,
    })
    const router = createRouter({
      routeTree: root.addChildren([app.addChildren([start, dashboard])]),
      history: createMemoryHistory({ initialEntries: ['/start'] }),
      isServer: false,
      defaultPendingMs: 0,
      defaultPendingMinMs: 0,
    })
    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Switch' }))
    await waitFor(() => expect(localeStarted).toBe(true))
    const unrelated = vi.fn()
    await expect(call({ next: unrelated })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(unrelated).not.toHaveBeenCalled()
    expect(takeWorkspaceDocumentFetch()).toBeUndefined()
    releaseLocale()
    await screen.findByRole('heading', { name: 'Dashboard' })
    await waitFor(() => expect(workspaceClaimState().switching).toBe(false))
    expect(failure).toBeUndefined()
    expect(rootReads).toBe(2)
    expect(
      router.state.matches.find((match) => match.routeId === '__root__')
        ?.loaderData,
    ).toEqual({ locale: override ?? 'ar', dir: override ? 'ltr' : 'rtl' })
    expect(dashboardClaims).toEqual(['org_b', 'org_b'])
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_b',
      stale: false,
      noticeOpen: false,
    })
    // Future ordinary invalidation must not reuse an expired capability from the router context.
    await router.invalidate({ sync: true })
    expect(dashboardClaims.at(-1)).toBe('org_b')
  },
)
