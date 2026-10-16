import * as React from 'react'

/** Stop activation in capture, before consumer handlers or native submit/navigation. */
export function suppressButtonActivation(event: React.SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function suppressButtonKey(event: React.KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ')
    suppressButtonActivation(event)
}

/** Slot gives child props precedence, so inactive state must reach the child itself. */
export function inactiveButtonChild(
  children: React.ReactNode,
  inactive: boolean,
  loading: boolean,
): React.ReactNode {
  if (
    !inactive ||
    !React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)
  ) {
    return children
  }
  return React.cloneElement(children, {
    'aria-disabled': true,
    'aria-busy': loading || undefined,
    onClickCapture: suppressButtonActivation,
    onKeyDownCapture: suppressButtonKey,
    onKeyUpCapture: suppressButtonKey,
  })
}
