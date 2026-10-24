import { useState } from 'react'

import { hasUnsentText } from './has-unsent-text'

/**
 * Where "Open the current workspace" lands. A document load, not a client navigation: it re-runs
 * `loadShell` for the whole tab, drops every cached loader result of the workspace being left, and
 * lands on the one screen that means the same thing in every workspace.
 */
const CURRENT_WORKSPACE_HREF = '/dashboard'

/**
 * The recovery for a tab whose workspace is no longer the session's (`src/lib/workspace-claim.ts`).
 *
 * The load cannot be taken back. A caller that sits beside text the reader may have typed passes
 * `guardUnsentText`: the first `open` with unsent text then only sets `confirming`, and the caller
 * shows the warning and a way to `cancel`; the next `open` goes on. Nothing is cleared or disabled.
 * A screen that has already been replaced (`ErrorPanel`) has nothing to lose and does not ask.
 *
 * `opening` stays true once started: the page is leaving, and a second press on a control that is
 * already navigating would only queue another load.
 */
export function useOpenCurrentWorkspace({
  guardUnsentText = false,
}: { readonly guardUnsentText?: boolean } = {}): {
  readonly opening: boolean
  readonly confirming: boolean
  readonly open: () => void
  readonly cancel: () => void
} {
  const [opening, setOpening] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return {
    opening,
    confirming,
    open: () => {
      if (guardUnsentText && !confirming && hasUnsentText()) {
        setConfirming(true)
        return
      }
      setOpening(true)
      window.location.assign(CURRENT_WORKSPACE_HREF)
    },
    cancel: () => setConfirming(false),
  }
}
