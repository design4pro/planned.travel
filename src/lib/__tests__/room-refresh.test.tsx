import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  notFound,
  RouterProvider,
} from '@tanstack/react-router'

import {
  refreshFromRoom,
  readRoomRefresh,
  readWorkspaceShell,
  roomRefreshToken,
} from '../room-refresh'
import {
  resetWorkspaceClaim,
  beginWorkspaceSwitch,
  workspaceClaimState,
} from '../workspace-claim-store'
import { WORKSPACE_CHANGED_KEY } from '../workspace-claim'
import { useTripRoom } from '#/components/modules/collab/use-trip-room'
import { TRIP_ROOM_CLOSED_REASON } from '#/server/do/protocol'

const socket = vi.hoisted(() => ({
  options: null as null | {
    onMessage: (event: { data: string }) => void
    onClose: (event: { reason: string }) => void
  },
}))
vi.mock('partysocket/use-ws', () => {
  const connection = {
    OPEN: 1,
    readyState: 0,
    retryCount: 0,
    reconnect: vi.fn(),
    send: vi.fn(),
  }
  return {
    default: (
      _url: unknown,
      _protocols: unknown,
      options: typeof socket.options,
    ) => {
      socket.options = options
      return connection
    },
  }
})

let session = 'A'
let shellRead = async () => ({ session: { organization: { id: session } } })
let headerRead = async () => {
  authorize()
  return 'Trip A'
}
let dataRead = async () => {
  authorize()
  return 'revision 1'
}
function authorize() {
  if (session !== workspaceClaimState().organizationId)
    throw new Error(WORKSPACE_CHANGED_KEY)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  resetWorkspaceClaim()
  session = 'A'
  shellRead = async () => ({ session: { organization: { id: session } } })
  headerRead = async () => {
    authorize()
    return 'Trip A'
  }
  dataRead = async () => {
    authorize()
    return 'revision 1'
  }
})
afterEach(cleanup)

async function mount() {
  let rootReads = 0
  const root = createRootRoute({
    component: Outlet,
    staleTime: Infinity,
    loader: () => {
      rootReads += 1
      return workspaceClaimState().stale
        ? 'fallback catalogue'
        : 'English catalogue'
    },
  })
  const app = createRoute({
    getParentRoute: () => root,
    id: '_app',
    beforeLoad: async ({ abortController, preload }) => ({
      shell: await readWorkspaceShell(abortController, preload, () =>
        shellRead(),
      ),
      roomRefresh: roomRefreshToken(abortController),
    }),
    component: () => (
      <>
        <span>{app.useRouteContext().shell?.session.organization?.id}</span>
        <Outlet />
      </>
    ),
  })
  const trip = createRoute({
    getParentRoute: () => app,
    path: 'trip',
    loader: ({ abortController, context }) =>
      readRoomRefresh(
        abortController,
        trip.id,
        () => headerRead(),
        context.roomRefresh,
      ),
    component: () => (
      <>
        <h1>{trip.useLoaderData()}</h1>
        <Outlet />
      </>
    ),
  })
  const collab = createRoute({
    getParentRoute: () => trip,
    path: 'collab',
    loader: ({ abortController, context }) =>
      readRoomRefresh(
        abortController,
        collab.id,
        () => dataRead(),
        context.roomRefresh,
      ),
    component: Composer,
  })
  const destination = createRoute({
    getParentRoute: () => app,
    path: 'dashboard',
    component: () => <h1>Dashboard</h1>,
  })
  const router = createRouter({
    routeTree: root.addChildren([
      app.addChildren([trip.addChildren([collab]), destination]),
    ]),
    history: createMemoryHistory({ initialEntries: ['/trip/collab'] }),
    isServer: false,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultErrorComponent: ({ error }) => <p>{error.message}</p>,
  })
  let refresh: Promise<void> = Promise.resolve()
  function Composer() {
    const [text, setText] = useState('')
    useTripRoom('trip', {
      onCommit: () => {
        refresh = Promise.all([refresh, refreshFromRoom(router)]).then(() => {})
      },
    })
    return (
      <>
        <p>{collab.useLoaderData()}</p>
        <textarea
          aria-label="Draft"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </>
    )
  }
  await router.load()
  render(<RouterProvider router={router} />)
  const field = (await screen.findByRole('textbox')) as HTMLTextAreaElement
  fireEvent.change(field, {
    target: { value: 'Exact unsent text\nsecond line' },
  })
  return { router, field, refresh: () => refresh, rootReads: () => rootReads }
}
function trigger(kind: string) {
  if (kind === 'close')
    socket.options?.onClose({ reason: TRIP_ROOM_CLOSED_REASON })
  else
    socket.options?.onMessage({
      data: JSON.stringify(
        kind === 'commit'
          ? {
              t: 'commit',
              version: 2,
              entries: [],
              patch: { entity: 'trip', id: 'trip', op: 'update' },
            }
          : {
              t: 'welcome',
              protocol: 1,
              version: 2,
              you: {
                connectionId: 'c',
                user: { id: 'u', name: 'Ada', initials: 'A', hue: 1 },
                joinedAt: 1,
                lastSeenAt: 1,
                focus: null,
              },
              peers: [],
              commits: [
                {
                  version: 2,
                  patch: { entity: 'trip', id: 'trip', op: 'update' },
                },
              ],
            },
      ),
    })
}

it.each(['commit', 'welcome', 'close'])(
  'preserves mounted text and claim on %s after another tab switches workspace',
  async (kind) => {
    const view = await mount()
    session = 'B'
    await act(async () => {
      trigger(kind)
      await view.refresh()
    })
    expect(view.rootReads()).toBe(1)
    expect(screen.getByRole('textbox')).toBe(view.field)
    expect(view.field.value).toBe('Exact unsent text\nsecond line')
    expect(screen.getByRole('heading').textContent).toBe('Trip A')
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'A',
      stale: true,
    })
    await waitFor(() => expect(view.router.state.isLoading).toBe(false))
  },
)

it('refreshes authorized changes without unmounting the composer', async () => {
  const view = await mount()
  dataRead = async () => {
    authorize()
    return 'revision 2'
  }
  await act(async () => {
    trigger('close')
    await view.refresh()
  })
  expect(screen.getByText('revision 2')).toBeTruthy()
  expect(screen.getByRole('textbox')).toBe(view.field)
})

it.each(['header', 'collab'])(
  'preserves the displayed workspace on a mismatch during %s loading',
  async (stage) => {
    const view = await mount()
    const changed = async () => {
      session = 'B'
      authorize()
      return 'B content'
    }
    if (stage === 'header') headerRead = changed
    else dataRead = changed
    await act(async () => {
      trigger('close')
      await view.refresh()
    })
    expect(screen.getByRole('textbox')).toBe(view.field)
    expect(screen.queryByText('B content')).toBeNull()
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'A',
      stale: true,
    })
  },
)

it('retains genuine revocation errors rather than preserving access', async () => {
  const view = await mount()
  headerRead = async () => {
    throw new Error('Access revoked')
  }
  await act(async () => {
    trigger('close')
    await view.refresh()
  })
  expect(await screen.findByText('Access revoked')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it.each(['success', 'mismatch'])(
  'ignores delayed shell %s after deliberate navigation',
  async (outcome) => {
    const view = await mount()
    const pending = deferred<Awaited<ReturnType<typeof shellRead>>>()
    let started = false
    shellRead = () => {
      started = true
      return pending.promise
    }
    act(() => trigger('close'))
    await waitFor(() => expect(started).toBe(true))
    session = 'B'
    shellRead = async () => ({ session: { organization: { id: 'B' } } })
    await act(async () => {
      await view.router.navigate({ to: '/dashboard' })
    })
    await act(async () => {
      if (outcome === 'success')
        pending.resolve({ session: { organization: { id: 'A' } } })
      else pending.reject(new Error(WORKSPACE_CHANGED_KEY))
      await view.refresh()
    })
    expect(screen.getByRole('heading').textContent).toBe('Dashboard')
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'B',
      stale: false,
    })
  },
)

it.each(['header', 'collab'])(
  'ignores a delayed %s mismatch after navigation back to the same workspace',
  async (stage) => {
    const view = await mount()
    const pending = deferred<string>()
    let started = false
    const delayed = () => {
      started = true
      return pending.promise
    }
    if (stage === 'header') headerRead = delayed
    else dataRead = delayed
    act(() => trigger('close'))
    await waitFor(() => expect(started).toBe(true))
    await act(async () => {
      await view.router.navigate({ to: '/dashboard' })
    })
    await act(async () => {
      pending.reject(new Error(WORKSPACE_CHANGED_KEY))
      await view.refresh()
    })
    expect(screen.getByRole('heading').textContent).toBe('Dashboard')
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'A',
      stale: false,
    })
  },
)

it('coalesces room events into one trailing refresh without dropping later changes', async () => {
  const view = await mount()
  const pending = deferred<Awaited<ReturnType<typeof shellRead>>>()
  const read = vi.fn(() => pending.promise)
  shellRead = read
  act(() => {
    trigger('close')
    trigger('commit')
    trigger('welcome')
  })
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  await act(async () => {
    pending.resolve({ session: { organization: { id: 'A' } } })
    await view.refresh()
  })
  expect(read).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('textbox')).toBe(view.field)
})

it('does not let an old room event supersede a deliberate navigation', async () => {
  const view = await mount()
  const pending = deferred<Awaited<ReturnType<typeof shellRead>>>()
  let started = false
  shellRead = () => {
    started = true
    return pending.promise
  }
  let navigation: Promise<void>
  act(() => {
    navigation = view.router.navigate({ to: '/dashboard' })
  })
  await waitFor(() => expect(started).toBe(true))
  act(() => trigger('close'))
  await act(async () => {
    session = 'B'
    pending.resolve({ session: { organization: { id: 'B' } } })
    await navigation
  })
  expect(screen.getByRole('heading').textContent).toBe('Dashboard')
  expect(workspaceClaimState().organizationId).toBe('B')
})

it('keeps the old screen if this tab starts switching while the shell refresh is in flight', async () => {
  const view = await mount()
  const pending = deferred<Awaited<ReturnType<typeof shellRead>>>()
  let started = false
  shellRead = () => {
    started = true
    return pending.promise
  }
  act(() => trigger('close'))
  await waitFor(() => expect(started).toBe(true))
  await act(async () => {
    beginWorkspaceSwitch()
    session = 'B'
    pending.resolve({ session: { organization: { id: 'B' } } })
    await view.refresh()
  })
  expect(screen.getByRole('textbox')).toBe(view.field)
  expect(workspaceClaimState()).toMatchObject({
    organizationId: 'A',
    stale: false,
    switching: true,
  })
})

it('keeps genuine trip absence on the normal not-found path', async () => {
  const view = await mount()
  headerRead = async () => {
    throw notFound()
  }
  await act(async () => {
    trigger('close')
    await view.refresh()
  })
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(workspaceClaimState().stale).toBe(false)
})

it('does not turn a revoked session into a workspace mismatch', async () => {
  const view = await mount()
  shellRead = async () => {
    throw new Error('Session revoked')
  }
  await act(async () => {
    trigger('close')
    await view.refresh()
  })
  expect(await screen.findByText('Session revoked')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(workspaceClaimState().stale).toBe(false)
})

it.each(['header', 'collab'])(
  'does not reuse a delayed %s refresh in a newer navigation to the same trip',
  async (stage) => {
    const view = await mount()
    const pending = deferred<string>()
    let started = false
    const delayed = () => {
      started = true
      return pending.promise
    }
    if (stage === 'header') headerRead = delayed
    else dataRead = delayed
    act(() => trigger('close'))
    await waitFor(() => expect(started).toBe(true))
    session = 'B'
    headerRead = async () => {
      throw notFound()
    }
    dataRead = async () => {
      throw notFound()
    }
    let navigation: Promise<void>
    act(() => {
      navigation = view.router.navigate({ to: '.' })
    })
    await waitFor(() => expect(workspaceClaimState().organizationId).toBe('B'))
    await act(async () => {
      pending.resolve('Old A response')
      await navigation
      await view.refresh()
    })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Old A response')).toBeNull()
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'B',
      stale: false,
    })
  },
)

it.each(['commit', 'welcome', 'close'])(
  'rechecks a %s event received during an unrelated same-route load',
  async (kind) => {
    const view = await mount()
    const pending = deferred<string>()
    let started = false
    dataRead = () => {
      started = true
      return pending.promise
    }
    let reload: Promise<void>
    act(() => {
      reload = view.router.invalidate({ sync: true })
    })
    await waitFor(() => expect(started).toBe(true))
    dataRead = async () => 'revision 3'
    act(() => trigger(kind))
    await act(async () => {
      pending.resolve('revision 2')
      await reload
      await view.refresh()
    })
    expect(screen.getByText('revision 3')).toBeTruthy()
    expect(screen.getByRole('textbox')).toBe(view.field)
  },
)

it('rechecks revoked access after a room close during an unrelated load', async () => {
  const view = await mount()
  const pending = deferred<string>()
  let started = false
  dataRead = () => {
    started = true
    return pending.promise
  }
  let reload: Promise<void>
  act(() => {
    reload = view.router.invalidate({ sync: true })
  })
  await waitFor(() => expect(started).toBe(true))
  headerRead = async () => {
    throw new Error('Access revoked')
  }
  act(() => trigger('close'))
  await act(async () => {
    pending.resolve('old response')
    await reload
    await view.refresh()
  })
  expect(await screen.findByText('Access revoked')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('cancels a queued recheck when a newer deliberate navigation starts', async () => {
  const view = await mount()
  const pending = deferred<string>()
  let started = false
  dataRead = () => {
    started = true
    return pending.promise
  }
  let reload: Promise<void>
  act(() => {
    reload = view.router.invalidate({ sync: true })
  })
  await waitFor(() => expect(started).toBe(true))
  act(() => trigger('close'))
  const read = vi.fn(async () => ({ session: { organization: { id: 'B' } } }))
  shellRead = read
  session = 'B'
  await act(async () => {
    await view.router.navigate({ to: '/dashboard' })
    pending.resolve('old response')
    await reload
    await view.refresh()
  })
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('heading').textContent).toBe('Dashboard')
  expect(workspaceClaimState()).toMatchObject({
    organizationId: 'B',
    stale: false,
  })
})
