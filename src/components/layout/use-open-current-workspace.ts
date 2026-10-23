import { useState } from 'react'

/**
 * Where "Open the current workspace" lands. A document load, not a client navigation: it re-runs
 * `loadShell` for the whole tab, drops every cached loader result of the workspace being left, and
 * lands on the one screen that means the same thing in every workspace.
 */
const CURRENT_WORKSPACE_HREF = '/dashboard'

/**
 * The recovery for a tab whose workspace is no longer the session's (`src/lib/workspace-claim.ts`).
 *
 * `opening` stays true once started: the page is leaving, and a second press on a control that is
 * already navigating would only queue another load.
 */
export function useOpenCurrentWorkspace(): {
  readonly opening: boolean
  readonly open: () => void
} {
  const [opening, setOpening] = useState(false)

  return {
    opening,
    open: () => {
      setOpening(true)
      window.location.assign(CURRENT_WORKSPACE_HREF)
    },
  }
}
