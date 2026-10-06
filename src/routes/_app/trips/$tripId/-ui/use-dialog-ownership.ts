import * as React from 'react'

/**
 * Which dialog a write belongs to.
 *
 * A write started from a form can settle after that form was closed, and by then another dialog
 * may be open. `claim()` is called as the write starts and returns a check, `owns()`, that stays
 * true only while the very dialog that was open at that moment still is: it is false for a write
 * that started with no dialog (a pin drop), once the dialog was closed (`release()`), and once a
 * different dialog took its place. A result that is not owned must not touch the open dialog's
 * error slot or close it.
 */
export function useDialogOwnership<TDialog>(dialog: TDialog | null): {
  readonly claim: () => () => boolean
  readonly release: () => void
} {
  const epoch = React.useRef(0)
  const open = React.useRef(dialog)
  open.current = dialog

  const claim = React.useCallback((): (() => boolean) => {
    const owner = open.current
    const startedAt = epoch.current
    return () =>
      owner !== null && startedAt === epoch.current && open.current === owner
  }, [])

  const release = React.useCallback((): void => {
    epoch.current += 1
  }, [])

  return { claim, release }
}
