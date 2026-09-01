/**
 * The trip tabs' own copy, in nl.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Deze reis kon niet worden geladen',
  'error.plan': 'De reisroute kon niet worden geladen',
  'error.costs': 'De kosten konden niet worden geladen',
  'error.collab': 'Het gesprek kon niet worden geladen',
  'error.book': 'De boekingen konden niet worden geladen',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reisroute',
  'plan.places': 'Plekken',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Samen',
  'collab.empty': 'Nog niets gedeeld',
  'collab.conversation': 'Gesprek',
  'collab.count.messages': {
    one: '{messages} bericht',
    other: '{messages} berichten',
  },
  'collab.count.notes': {
    one: '{notes} notitie',
    other: '{notes} notities',
  },
  'collab.count.polls': {
    one: '{polls} peiling',
    other: '{polls} peilingen',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Boekingen',
  'book.empty': 'Nog niets geboekt',
  'book.count.bookings': {
    one: '{bookings} boeking',
    other: '{bookings} boekingen',
  },
  'book.count.confirmed': {
    one: '{confirmed} bevestigd',
    other: '{confirmed} bevestigd',
  },
  'book.progressLabel': {
    one: '{confirmed} van {total} boeking bevestigd',
    other: '{confirmed} van {total} boekingen bevestigd',
  },
  'book.ofTotal': 'van {total}',
  'book.confirmed': 'Bevestigd',
  'book.awaiting': 'Wacht op bevestiging',
  'book.nothingHanging': 'Niets open',
  'book.chase': 'Regel dit voor vertrek',
  'book.committed': 'Vastgelegd',
  'book.committedCaption': 'Over alle boekingen van deze reis',
  'book.onItinerary': 'In de reisroute',
  'book.pinnedCaption': 'Vastgezet op een dag van de route',
} satisfies TranslationOf<typeof En>

export default messages
