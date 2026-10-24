import { useRef, useState } from 'react'

import { hasUnsentText } from './has-unsent-text'

/**
 * Where "Open the current workspace" lands. A document load, not a client navigation: it re-runs
 * `loadShell` for the whole tab, drops every cached loader result of the workspace being left, and
 * lands on the one screen that means the same thing in every workspace.
 */
const CURRENT_WORKSPACE_HREF = '/dashboard'

/**
 * How long the confirmation ignores a press after it appears. The confirming button takes the
 * place of the one just pressed, so a double click, a double tap or a held Enter would otherwise
 * land on "Open anyway" and discard the text the warning is about.
 */
const CONFIRM_ARM_MS = 500

/**
 * For the buttons of this recovery: a button keeps its label on one line, and the translated
 * "Open the current workspace" is wider than a 360px card in several locales.
 */
export const CURRENT_WORKSPACE_BUTTON_CLASS =
  'h-auto min-h-10 max-w-full whitespace-normal py-2 text-center'

/**
 * The recovery for a tab whose workspace is no longer the session's (`src/lib/workspace-claim.ts`).
 *
 * The load cannot be taken back. A caller that sits beside text the reader may have typed passes
 * `guardUnsentText`: the first `open` with unsent text then only sets `confirming`, and the caller
 * shows the warning and a way to `cancel`; the next `open` goes on. Nothing is cleared or disabled.
 * A screen that has already been replaced (`ErrorPanel`) has nothing to lose and does not ask.
 *
 * The confirming `open` is ignored for `CONFIRM_ARM_MS`, so one gesture repeated cannot confirm.
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
  const confirmingSince = useRef(0)

  return {
    opening,
    confirming,
    open: () => {
      if (guardUnsentText && !confirming && hasUnsentText()) {
        confirmingSince.current = Date.now()
        setConfirming(true)
        return
      }
      if (confirming && Date.now() - confirmingSince.current < CONFIRM_ARM_MS) {
        return
      }
      setOpening(true)
      window.location.assign(CURRENT_WORKSPACE_HREF)
    },
    cancel: () => setConfirming(false),
  }
}
