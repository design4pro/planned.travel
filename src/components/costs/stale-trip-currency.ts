/**
 * The state a money dialog keeps after the server refused its save because the trip's budget
 * currency changed while the dialog was open (`costs.refusal.tripCurrencyChanged`).
 *
 * The dialog keeps what the reader typed, the screen refreshes its data, and the digits that were in
 * the old currency are marked until the reader looks at them again. This holds the one piece the
 * dialog cannot derive: which currency it was saving under, so it can tell when the refreshed one
 * has arrived.
 *
 * Framework-free apart from `useState`, and with no copy: the dialog renders the message.
 */
import { useState } from 'react'

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
  /** The save made under `from` was refused. */
  readonly refuse: (from: string) => void
  /** The dialog has acted on `adopt`. */
  readonly adopted: () => void
  /** The reader changed a figure or the currency: the message has done its job. */
  readonly dismiss: () => void
}

export function useStaleTripCurrency(tripCurrency: string): StaleTripCurrency {
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const current = currencyCode(tripCurrency)
  const refreshed = refusal !== null && refusal.from !== current
  return {
    adopt:
      refreshed && !refusal.adopted
        ? { from: refusal.from, to: current }
        : null,
    messageFor: refreshed ? current : null,
    refuse: (from) => setRefusal({ from, adopted: false }),
    adopted: () =>
      setRefusal((was) => (was === null ? null : { ...was, adopted: true })),
    dismiss: () => setRefusal(null),
  }
}
