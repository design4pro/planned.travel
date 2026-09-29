/**
 * What a day header says about a stay covering it.
 *
 * The rule itself is `stayDayWords`, the booking desk's own, so the desk and the board cannot come
 * to disagree about which day is the check-in. This module only pairs each word with its copy and
 * the time it carries. Imported from `booking-form` directly rather than through the module's index,
 * which would bring the booking dialog and its server functions along.
 */
import { stayDayWords } from '#/components/modules/book/booking-form'

import type { StayDayWord } from '#/components/modules/book/booking-form'
import type { MessageKey } from '#/lib/i18n'
import type { PlannerStay } from './types'

/** One boundary of a stay on one day: _check in_ with its window, or _check out_ with its time. */
export interface StayFact {
  readonly word: StayDayWord
  readonly label: MessageKey
  /** Already formatted. `null` when the stay sets no time for this boundary. */
  readonly time: string | null
}

const LABEL: { readonly [K in StayDayWord]: MessageKey } = {
  checkIn: 'trips.plan.stay.checkIn',
  checkOut: 'trips.plan.stay.checkOut',
}

/**
 * The boundaries a stay has on one day it covers: check in on its first, check out on its last,
 * both on a one-day stay, and none on the nights between — where the header shows the property's
 * name alone, which it shows on every covered day.
 */
export function stayFactsOn(
  dayId: string,
  stay: PlannerStay,
): ReadonlyArray<StayFact> {
  return stayDayWords(dayId, stay.startDayId, stay.endDayId).map((word) => ({
    word,
    label: LABEL[word],
    time: word === 'checkIn' ? stay.checkIn : stay.checkOut,
  }))
}
