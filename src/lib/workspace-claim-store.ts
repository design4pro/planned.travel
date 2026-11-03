/**
 * The tab's own record of the workspace it is showing (see `./workspace-claim`).
 *
 * It lives in this module's memory and nowhere else - not `localStorage`, not a cookie, not a
 * cross-tab channel - because a claim that travelled between tabs would stop being the tab's own
 * belief, which is the thing the server compares.
 */
import { useSyncExternalStore } from 'react'

import { z } from 'zod'

import {
  isWorkspaceChanged,
  parseWorkspaceClaim,
  WORKSPACE_CLAIM_HEADER,
  WORKSPACE_CHANGED_KEY,
} from './workspace-claim'

export interface WorkspaceClaimState {
  /** The workspace the tab is showing, or `null` before the shell has loaded. */
  readonly organizationId: string | null
  /** A call was refused: the tab sends nothing more until navigation or explicit compatibility verification. */
  readonly stale: boolean
  /** The notice is showing. "Not now" closes it without clearing `stale`. */
  readonly noticeOpen: boolean
  /** A deliberate switch/create owns the tab; unrelated calls remain unsent. */
  readonly switching: boolean
}

const INITIAL: WorkspaceClaimState = {
  organizationId: null,
  stale: false,
  noticeOpen: false,
  switching: false,
}

let state: WorkspaceClaimState = INITIAL
// A navigation to the same workspace still supersedes requests made by the previous screen.
let generation = 0
// Refusals invalidate recovery without making other in-flight refusals obsolete.
let recoveryAttempt = 0

export function workspaceClaimGeneration(): number {
  return generation
}

const listeners = new Set<() => void>()

function commit(next: Partial<WorkspaceClaimState>): void {
  // Client only. Module scope in a Worker isolate is shared by every request it serves, so a claim
  // written during server rendering would be one reader's workspace in another's response.
  if (typeof window === 'undefined') return
  const changed = (Object.keys(next) as Array<keyof WorkspaceClaimState>).some(
    (key) => state[key] !== next[key],
  )
  if (!changed) return
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export function subscribeWorkspaceClaim(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function workspaceClaimState(): WorkspaceClaimState {
  return state
}

/**
 * The shell was read for this tab: it now shows `organizationId`, and a stale tab is current.
 *
 * An owned shell read updates the claim before its dashboard loader runs, but unrelated calls
 * stay blocked until `endWorkspaceSwitch` closes the transition.
 */
export function setWorkspaceClaim(organizationId: string | null): void {
  generation += 1
  commit({ organizationId, stale: false, noticeOpen: false })
}

/**
 * A navigation is about to re-read the shell. Calls it makes must reach the server again, or a
 * stale tab could never learn the workspace it is now in.
 */
export function resumeWorkspaceClaim(): void {
  generation += 1
  commit({ stale: false, noticeOpen: false })
}

/**
 * The server refused a call that carried `sentWith`.
 *
 * Ignored when the tab has moved on since the call left (a navigation updated the claim while the
 * refusal was in flight), so a late answer cannot mark a current tab stale.
 */
export function markWorkspaceStale(sentWith: string): void {
  if (state.organizationId !== sentWith) return
  recoveryAttempt += 1
  commit({ stale: true, noticeOpen: true })
}

/** Only an explicit authenticated read can reopen this gate without rereading the shell. */
export async function recoverWorkspaceClaim(): Promise<boolean> {
  const claim = parseWorkspaceClaim(state.organizationId)
  if (!state.stale || state.switching || claim.status !== 'valid') return false
  const startedGeneration = generation
  const attempt = ++recoveryAttempt
  try {
    const response = await fetch('/api/workspace-compatibility', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { [WORKSPACE_CLAIM_HEADER]: claim.organizationId },
    })
    if (!response.ok) return false
    const result = z
      .object({ organizationId: z.string() })
      .safeParse(await response.json())
    if (
      !result.success ||
      result.data.organizationId !== claim.organizationId ||
      generation !== startedGeneration ||
      recoveryAttempt !== attempt ||
      state.organizationId !== claim.organizationId ||
      !state.stale ||
      state.switching
    )
      return false
    commit({ stale: false, noticeOpen: false })
    return true
  } catch {
    return false
  }
}

/** The reader did something and it was stopped because the tab is stale: say so again. */
export function reopenWorkspaceNotice(): void {
  commit({ noticeOpen: true })
}

/**
 * For the `catch` of an action the reader started: when `error` is the workspace-changed refusal,
 * brings the notice back (a stale tab's later calls fail locally and do not) and says so, so the
 * caller shows no message of its own. Never call it from a poll or a preload.
 */
export function reopenNoticeFor(error: unknown): boolean {
  if (!isWorkspaceChanged(error)) return false
  reopenWorkspaceNotice()
  return true
}

export function dismissWorkspaceNotice(): void {
  recoveryAttempt += 1
  commit({ noticeOpen: false })
}

/** Local capability for one deliberate transition; never sent as authorization. */
export interface WorkspaceSwitch {
  readonly id: number
  readonly organizationId: string | null
  readonly fetch: typeof globalThis.fetch
  readonly ready: Promise<void>
  expected: ReadonlyArray<string | null>
}

let nextSwitchId = 0
let activeSwitch: WorkspaceSwitch | undefined
let pendingResync: WorkspaceSwitch | undefined
let pendingDocument: WorkspaceSwitch | undefined
const shellSwitches = new WeakMap<AbortController, WorkspaceSwitch>()
const calls = new Set<Promise<void>>()

/** Register before dispatch so activation waits for earlier claim refusals as well as successes. */
export function trackWorkspaceCall(): () => void {
  if (typeof window === 'undefined') return () => {}
  let finish = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })
  calls.add(done)
  return () => {
    calls.delete(done)
    finish()
  }
}

export function workspaceSwitchCancelled(): DOMException {
  return new DOMException('Workspace transition cancelled', 'AbortError')
}

export function ownsWorkspaceSwitch(token: WorkspaceSwitch): boolean {
  return activeSwitch === token
}

/** New unrelated calls are cancelled, never queued for a different workspace. */
export function permitsWorkspaceCall(
  fetch: typeof globalThis.fetch | undefined,
): boolean {
  return (
    !state.switching ||
    (activeSwitch !== undefined && fetch === activeSwitch.fetch)
  )
}

/** Creation is bound to the workspace that opened the transition, even if an earlier read settles. */
export function workspaceCallClaim(
  fetch: typeof globalThis.fetch | undefined,
): string | null {
  if (
    activeSwitch &&
    fetch === activeSwitch.fetch &&
    activeSwitch.expected.length === 0
  )
    return activeSwitch.organizationId
  return state.organizationId
}

export function beginWorkspaceSwitch(): WorkspaceSwitch {
  if (activeSwitch) throw workspaceSwitchCancelled()
  const token: WorkspaceSwitch = {
    id: ++nextSwitchId,
    organizationId: state.organizationId,
    expected: [],
    ready: Promise.all([...calls]).then(() => undefined),
    fetch: (...args) => {
      if (!ownsWorkspaceSwitch(token)) throw workspaceSwitchCancelled()
      return globalThis.fetch(...args)
    },
  }
  activeSwitch = token
  // Do not advance generation: a refusal already in flight must still mark the tab stale.
  commit({ switching: true })
  return token
}

export async function waitForWorkspaceCalls(
  token: WorkspaceSwitch,
): Promise<void> {
  // A stalled prior RPC cancels this intent; it must never activate later when that RPC settles.
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      token.ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(workspaceSwitchCancelled()), 10_000)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
  if (!ownsWorkspaceSwitch(token)) throw workspaceSwitchCancelled()
  if (state.stale) throw new Error(WORKSPACE_CHANGED_KEY)
  if (state.organizationId !== token.organizationId)
    throw workspaceSwitchCancelled()
}

/** Only the next shell read of this explicit router operation receives the capability. */
export function prepareWorkspaceResync(
  token: WorkspaceSwitch,
  expected: ReadonlyArray<string | null>,
): void {
  if (!ownsWorkspaceSwitch(token)) throw workspaceSwitchCancelled()
  if (state.stale) throw new Error(WORKSPACE_CHANGED_KEY)
  token.expected = expected
  pendingResync = token
}

export function takeWorkspaceResync(
  controller: AbortController,
): WorkspaceSwitch | undefined {
  const token = pendingResync
  pendingResync = undefined
  if (token && ownsWorkspaceSwitch(token)) shellSwitches.set(controller, token)
  const bound = shellSwitches.get(controller)
  return bound && ownsWorkspaceSwitch(bound) ? bound : undefined
}

export function workspaceResyncToken(
  controller: AbortController,
): number | undefined {
  const bound = shellSwitches.get(controller)
  return bound && ownsWorkspaceSwitch(bound) ? bound.id : undefined
}

export function workspaceSwitchFetch(
  id: number | undefined,
): typeof globalThis.fetch | undefined {
  return activeSwitch && activeSwitch.id === id ? activeSwitch.fetch : undefined
}

/** The document locale belongs to this invalidation, after its shell confirmed the destination. */
export function prepareWorkspaceDocument(token: WorkspaceSwitch): void {
  if (!ownsWorkspaceSwitch(token) || state.stale)
    throw workspaceSwitchCancelled()
  pendingDocument = token
}

/** Only the root loader consumes this one-shot capability; ordinary locale calls remain blocked. */
export function takeWorkspaceDocumentFetch():
  typeof globalThis.fetch | undefined {
  const token = pendingDocument
  pendingDocument = undefined
  return token &&
    ownsWorkspaceSwitch(token) &&
    !state.stale &&
    token.expected.includes(state.organizationId)
    ? token.fetch
    : undefined
}

export function finishWorkspaceResync(token: WorkspaceSwitch): void {
  if (pendingResync === token) pendingResync = undefined
  if (pendingDocument === token) pendingDocument = undefined
}

export function endWorkspaceSwitch(
  token: WorkspaceSwitch | undefined = activeSwitch,
): void {
  if (!token || !ownsWorkspaceSwitch(token)) return
  activeSwitch = undefined
  finishWorkspaceResync(token)
  commit({ switching: false })
}

/** Test seam. */
export function resetWorkspaceClaim(): void {
  generation += 1
  activeSwitch = undefined
  pendingResync = undefined
  pendingDocument = undefined
  calls.clear()
  state = INITIAL
  listeners.forEach((listener) => listener())
}

export function useWorkspaceClaim(): WorkspaceClaimState {
  return useSyncExternalStore(
    subscribeWorkspaceClaim,
    workspaceClaimState,
    () => INITIAL,
  )
}
