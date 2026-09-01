/**
 * The trip tabs' own copy, in de.
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
  'error.trip': 'Diese Reise konnte nicht geladen werden',
  'error.plan': 'Der Reiseverlauf konnte nicht geladen werden',
  'error.costs': 'Die Kosten konnten nicht geladen werden',
  'error.collab': 'Die Unterhaltung konnte nicht geladen werden',
  'error.book': 'Die Buchungen konnten nicht geladen werden',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reiseverlauf',
  'plan.places': 'Orte',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Gemeinsam',
  'collab.empty': 'Noch nichts geteilt',
  'collab.conversation': 'Unterhaltung',
  'collab.count.messages': {
    one: '{messages} Nachricht',
    other: '{messages} Nachrichten',
  },
  'collab.count.notes': {
    one: '{notes} Notiz',
    other: '{notes} Notizen',
  },
  'collab.count.polls': {
    one: '{polls} Umfrage',
    other: '{polls} Umfragen',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Buchungen',
  'book.empty': 'Noch nichts gebucht',
  'book.count.bookings': {
    one: '{bookings} Buchung',
    other: '{bookings} Buchungen',
  },
  'book.count.confirmed': {
    one: '{confirmed} bestätigt',
    other: '{confirmed} bestätigt',
  },
  'book.progressLabel': {
    one: '{confirmed} von {total} Buchung bestätigt',
    other: '{confirmed} von {total} Buchungen bestätigt',
  },
  'book.ofTotal': 'von {total}',
  'book.confirmed': 'Bestätigt',
  'book.awaiting': 'Wartet auf Bestätigung',
  'book.nothingHanging': 'Nichts offen',
  'book.chase': 'Kläre das vor dem Abflug',
  'book.committed': 'Festgelegt',
  'book.committedCaption': 'Über alle Buchungen dieser Reise',
  'book.onItinerary': 'Im Reiseverlauf',
  'book.pinnedCaption': 'An einen Tag des Plans geheftet',
} satisfies TranslationOf<typeof En>

export default messages
