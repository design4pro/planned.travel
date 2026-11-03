/** Room refreshes keep the displayed workspace; only a navigation may adopt the session's. */

import { isWorkspaceChanged, WORKSPACE_CHANGED_KEY } from './workspace-claim'
import {
  markWorkspaceStale,
  takeWorkspaceResync,
  ownsWorkspaceSwitch,
  workspaceSwitchCancelled,
  resumeWorkspaceClaim,
  setWorkspaceClaim,
  workspaceClaimGeneration,
  workspaceClaimState,
} from './workspace-claim-store'

interface Refresh {
  readonly id: number
  controller?: AbortController
  again: boolean
  refused: boolean
  readonly organizationId: string
  readonly generation: number
  readonly shell: unknown
  readonly data: ReadonlyMap<string, unknown>
}

let nextId = 0
const tokens = new Map<number, Refresh>()
let pending: Refresh | undefined
const active = new WeakMap<object, Refresh>()
const queued = new WeakMap<object, Promise<void>>()
const refreshes = new WeakMap<AbortController, Refresh>()

/** Bind only the first shell read, never a navigation that supersedes it. */
export async function refreshFromRoom(router: {
  invalidate: (options: {
    sync: true
    filter: (match: { routeId: string }) => boolean
  }) => Promise<void>
  subscribe: (
    event: 'onBeforeLoad' | 'onResolved',
    listener: () => void,
  ) => () => void
  readonly state: {
    readonly isLoading: boolean
    readonly matches: ReadonlyArray<{
      readonly routeId: string
      readonly context: unknown
      readonly loaderData?: unknown
    }>
  }
}): Promise<void> {
  const { organizationId, stale, switching } = workspaceClaimState()
  if (organizationId === null || stale || switching) return
  const running = active.get(router)
  if (running) {
    running.again = true
    return
  }
  if (pending) return
  if (router.state.isLoading) {
    const waiting = queued.get(router)
    if (waiting) return waiting
    const routes = router.state.matches.map((match) => match.routeId).join(',')
    const wait = (async () => {
      const cancelled = await new Promise<boolean>((resolve) => {
        const finish = (cancelled: boolean) => {
          stopResolved()
          stopNavigation()
          resolve(cancelled)
        }
        const stopResolved = router.subscribe('onResolved', () => finish(false))
        const stopNavigation = router.subscribe('onBeforeLoad', () =>
          finish(true),
        )
      })
      queued.delete(router)
      const generation = workspaceClaimGeneration()
      await Promise.resolve()
      if (
        !cancelled &&
        workspaceClaimGeneration() === generation &&
        workspaceClaimState().organizationId === organizationId &&
        router.state.matches.map((match) => match.routeId).join(',') === routes
      )
        await refreshFromRoom(router)
    })()
    queued.set(router, wait)
    return wait
  }
  const context = router.state.matches.find(
    (match) => match.routeId === '/_app',
  )?.context
  if (!context || typeof context !== 'object' || !('shell' in context)) return
  const refresh = {
    id: ++nextId,
    again: false,
    refused: false,
    organizationId,
    generation: workspaceClaimGeneration(),
    shell: context.shell,
    data: new Map(
      router.state.matches.map((match) => [match.routeId, match.loaderData]),
    ),
  }
  active.set(router, refresh)
  pending = refresh
  let started = false
  const unsubscribe = router.subscribe('onBeforeLoad', () => {
    if (started && pending === refresh) pending = undefined
    started = true
  })
  try {
    // Keep tenant reads together and retain the document catalogue when the claim becomes stale.
    await router.invalidate({
      sync: true,
      filter: (match) => match.routeId !== '__root__',
    })
  } finally {
    if (pending === refresh) pending = undefined
    tokens.delete(refresh.id)
    active.delete(router)
    unsubscribe()
  }
  if (refresh.again && workspaceClaimGeneration() === refresh.generation)
    await refreshFromRoom(router)
}

export function roomRefreshToken(
  controller: AbortController,
): number | undefined {
  return refreshes.get(controller)?.id
}

function refuseRefresh(controller: AbortController, refresh: Refresh): void {
  refresh.refused = true
  if (
    !controller.signal.aborted &&
    workspaceClaimGeneration() === refresh.generation
  ) {
    markWorkspaceStale(refresh.organizationId)
  }
}

/** Only a verified workspace mismatch retains the previous route data; access failures still throw. */
export async function readRoomRefresh<T>(
  controller: AbortController,
  routeId: string,
  read: () => Promise<T>,
  token?: number,
): Promise<T> {
  const refresh = token === undefined ? undefined : tokens.get(token)
  if (
    refresh &&
    (refresh.refused || workspaceClaimGeneration() !== refresh.generation)
  )
    return refresh.data.get(routeId) as T
  try {
    const result = await read()
    return refresh &&
      (refresh.refused || workspaceClaimGeneration() !== refresh.generation)
      ? (refresh.data.get(routeId) as T)
      : result
  } catch (error) {
    if (refresh && workspaceClaimGeneration() !== refresh.generation)
      return refresh.data.get(routeId) as T
    if (refresh && !controller.signal.aborted && isWorkspaceChanged(error)) {
      refuseRefresh(refresh.controller ?? controller, refresh)
      // This is the previous successful output of this same route's reader.
      return refresh.data.get(routeId) as T
    }
    throw error
  }
}

export async function readWorkspaceShell<
  T extends {
    readonly session: { readonly organization: { readonly id: string } | null }
  },
>(
  controller: AbortController,
  preload: boolean,
  read: (
    preserveWorkspace: boolean,
    fetch?: typeof globalThis.fetch,
  ) => Promise<T | null>,
): Promise<T | null> {
  const transition = !preload ? takeWorkspaceResync(controller) : undefined
  if (workspaceClaimState().switching && !transition)
    throw workspaceSwitchCancelled()
  const refresh = !preload ? pending : undefined
  if (refresh) {
    pending = undefined
    refresh.controller = controller
    refreshes.set(controller, refresh)
    tokens.set(refresh.id, refresh)
  } else if (!preload && !transition) {
    resumeWorkspaceClaim()
  }
  const generation = workspaceClaimGeneration()
  let shell: T | null
  try {
    shell = await read(refresh !== undefined, transition?.fetch)
  } catch (error) {
    if (refresh && workspaceClaimGeneration() !== refresh.generation)
      return refresh.shell as T
    if (!refresh || controller.signal.aborted || !isWorkspaceChanged(error))
      throw error
    refuseRefresh(controller, refresh)
    return refresh.shell as T
  }
  if (controller.signal.aborted || preload || shell === null) return shell
  const organizationId = shell.session.organization?.id ?? null
  if (transition) {
    if (
      !ownsWorkspaceSwitch(transition) ||
      workspaceClaimGeneration() !== generation
    )
      throw workspaceSwitchCancelled()
    if (
      workspaceClaimState().stale ||
      !transition.expected.includes(organizationId)
    ) {
      const displayed = workspaceClaimState().organizationId
      if (displayed !== null) markWorkspaceStale(displayed)
      throw new Error(WORKSPACE_CHANGED_KEY)
    }
  }
  if (refresh && workspaceClaimGeneration() !== refresh.generation)
    return refresh.shell as T
  if (refresh) {
    if (
      workspaceClaimGeneration() === refresh.generation &&
      organizationId !== refresh.organizationId
    ) {
      refuseRefresh(controller, refresh)
      return refresh.shell as T
    }
  } else {
    setWorkspaceClaim(organizationId)
  }
  return shell
}
