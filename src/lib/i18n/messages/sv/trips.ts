/**
 * The trip tabs' own copy, in sv.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Den här resan kunde inte läsas in',
  'error.plan': 'Resplanen kunde inte läsas in',
  'error.costs': 'Kostnaderna kunde inte läsas in',
  'error.collab': 'Samtalet kunde inte läsas in',
  'error.book': 'Bokningarna kunde inte läsas in',
  'error.transports': 'Färderna kunde inte laddas',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Resplan',
  'plan.places': 'Platser',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Tillsammans',
  'collab.empty': 'Inget delat än',
  'collab.conversation': 'Samtal',
  'collab.count.messages': {
    one: '{messages} meddelande',
    other: '{messages} meddelanden',
  },
  'collab.count.notes': {
    one: '{notes} anteckning',
    other: '{notes} anteckningar',
  },
  'collab.count.polls': {
    one: '{polls} omröstning',
    other: '{polls} omröstningar',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Bokningar',
  'book.empty': 'Inget bokat än',
  'book.count.bookings': {
    one: '{bookings} bokning',
    other: '{bookings} bokningar',
  },
  'book.count.confirmed': {
    one: '{confirmed} bekräftad',
    other: '{confirmed} bekräftade',
  },
  'book.progressLabel': {
    one: '{confirmed} av {total} bokning bekräftad',
    other: '{confirmed} av {total} bokningar bekräftade',
  },
  'book.ofTotal': 'av {total}',
  'book.confirmed': 'Bekräftade',
  'book.awaiting': 'Väntar på bekräftelse',
  'book.nothingHanging': 'Inget öppet',
  'book.chase': 'Ligg på innan ni flyger',
  'book.committed': 'Bundet',
  'book.committedCaption': 'Över alla bokningar på den här resan',
  'book.onItinerary': 'I resplanen',
  'book.pinnedCaption': 'Fäst vid en dag i planen',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Färder',
  'transports.empty': 'Inget noterat än',
  'transports.count.transports': {
    one: '{transports} färd',
    other: '{transports} färder',
  },
  'transports.distance': 'Tillryggalagd sträcka',
  'transports.equator': '≈ {times}× runt ekvatorn',
  'transports.noGrouping': 'Inget grupperat än',
  'transports.mostly': 'mest {mode}',
  'transports.confirmed': 'Bekräftade',
  'transports.stillPending': {
    one: '{pending} väntar fortfarande',
    other: '{pending} väntar fortfarande',
  },
  'transports.spent': 'Spenderat på resor',
  'transports.noPrices': 'Inga priser noterade',
  'transports.priced': {
    one: 'över {priced} prissatt färd',
    other: 'över {priced} prissatta färder',
  },
} satisfies TranslationOf<typeof En>

export default messages
