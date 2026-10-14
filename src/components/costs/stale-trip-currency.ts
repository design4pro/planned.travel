/**
 * The state a money dialog keeps after the server refused its save because the trip's budget
 * currency changed while the dialog was open (`costs.refusal.tripCurrencyChanged`).
 *
 * The dialog keeps what the reader typed, the screen refreshes its data, and the digits that were in
 * the old currency are marked until the reader looks at them again. This holds the one piece the
 * dialog cannot derive: which currency it was saving under, so it can tell when the refreshed one
 * has arrived.
 *
 * Framework-free apart from `useState` and the focus effect, and with no copy: the dialog renders
 * the message.
 */
import { useEffect, useRef, useState } from 'react'

import { currencyCode } from '#/lib/money'

interface Refusal {
  /** The trip currency the refused save was made under. */
  readonly from: string
  /** The dialog has already moved its currency control to the refreshed currency. */
  readonly adopted: boolean
}

export interface StaleTripCurrency {
  /**
   * Set once, when the refreshed currency arrives: the currency the refused save was made under and
   * the one that replaced it, so the dialog can move a control that still shows the old one.
   */
  readonly adopt: { readonly from: string; readonly to: string } | null
  /** The refreshed currency to name in the message while the refusal stands; else `null`. */
  readonly messageFor: string | null
  /** The save was refused but the refreshed currency has not arrived (or never will): say so plainly. */
  readonly pending: boolean
  /** The save made under `from` was refused. */
  readonly refuse: (from: string) => void
  /** The dialog has acted on `adopt`. */
  readonly adopted: () => void
  /** The reader changed a figure or the currency: the message has done its job. */
  readonly dismiss: () => void
}

/**
 * `focusTarget` names the field the reader has to look at, read after the dialog has rendered with
 * the refreshed currency (a converted field can vanish with it) and once `saving` is over (a
 * disabled input cannot take focus); the refusal is focused once per state it moves through.
 */
export function useStaleTripCurrency(
  tripCurrency: string,
  saving: boolean,
  focusTarget: () => HTMLElement | null,
): StaleTripCurrency {
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const focusedFor = useRef<Refusal | null>(null)
  const current = currencyCode(tripCurrency)
  const refreshed = refusal !== null && refusal.from !== current
  useEffect(() => {
    if (refusal !== null && !saving && focusedFor.current !== refusal) {
      focusedFor.current = refusal
      focusTarget()?.focus()
    }
  })
  return {
    adopt:
      refreshed && !refusal.adopted
        ? { from: refusal.from, to: current }
        : null,
    messageFor: refreshed ? current : null,
    pending: refusal !== null && !refreshed,
    refuse: (from) => setRefusal({ from, adopted: false }),
    adopted: () =>
      setRefusal((was) => (was === null ? null : { ...was, adopted: true })),
    dismiss: () => setRefusal(null),
  }
}
