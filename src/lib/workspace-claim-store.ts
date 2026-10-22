/**
 * The tab's own record of the workspace it is showing (see `./workspace-claim`).
 *
 * It lives in this module's memory and nowhere else - not `localStorage`, not a cookie, not a
 * cross-tab channel - because a claim that travelled between tabs would stop being the tab's own
 * belief, which is the thing the server compares.
 */
import { useSyncExternalStore } from 'react'

export interface WorkspaceClaimState {
  /** The workspace the tab is showing, or `null` before the shell has loaded. */
  readonly organizationId: string | null
  /** A call was refused: the tab sends nothing more until a navigation re-reads the shell. */
  readonly stale: boolean
  /** The notice is showing. "Not now" closes it without clearing `stale`. */
  readonly noticeOpen: boolean
  /** This tab is switching workspace itself: its own sequence must not refuse it. */
  readonly switching: boolean
}

const INITIAL: WorkspaceClaimState = {
  organizationId: null,
  stale: false,
  noticeOpen: false,
  switching: false,
}

let state: WorkspaceClaimState = INITIAL
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

/** The shell was read for this tab: it now shows `organizationId`, and a stale tab is current. */
export function setWorkspaceClaim(organizationId: string | null): void {
  commit({ organizationId, stale: false, noticeOpen: false, switching: false })
}

/**
 * A navigation is about to re-read the shell. Calls it makes must reach the server again, or a
 * stale tab could never learn the workspace it is now in.
 */
export function resumeWorkspaceClaim(): void {
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
  commit({ stale: true, noticeOpen: true })
}

/** A call was stopped locally because the tab is stale: say so again. */
export function reopenWorkspaceNotice(): void {
  commit({ noticeOpen: true })
}

export function dismissWorkspaceNotice(): void {
  commit({ noticeOpen: false })
}

/** Around the workspace switcher's own switch-navigate-invalidate sequence. */
export function beginWorkspaceSwitch(): void {
  commit({ switching: true })
}

export function endWorkspaceSwitch(): void {
  commit({ switching: false })
}

/** Test seam. */
export function resetWorkspaceClaim(): void {
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
