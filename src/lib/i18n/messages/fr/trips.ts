/**
 * The trip tabs' own copy, in fr.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Pluriel.** `one` · `many` · `other` ; `many` ne sert qu’aux grands nombres compacts.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Ce voyage n’a pas pu être chargé',
  'error.plan': 'L’itinéraire n’a pas pu être chargé',
  'error.costs': 'Les dépenses n’ont pas pu être chargées',
  'error.collab': 'La conversation n’a pas pu être chargée',
  'error.book': 'Les réservations n’ont pas pu être chargées',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinéraire',
  'plan.places': 'Lieux',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Ensemble',
  'collab.empty': 'Rien de partagé pour l’instant',
  'collab.conversation': 'Discussion',
  'collab.count.messages': {
    one: '{messages} message',
    many: '{messages} messages',
    other: '{messages} messages',
  },
  'collab.count.notes': {
    one: '{notes} note',
    many: '{notes} notes',
    other: '{notes} notes',
  },
  'collab.count.polls': {
    one: '{polls} sondage',
    many: '{polls} sondages',
    other: '{polls} sondages',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Réservations',
  'book.empty': 'Rien de réservé pour l’instant',
  'book.count.bookings': {
    one: '{bookings} réservation',
    many: '{bookings} réservations',
    other: '{bookings} réservations',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmée',
    many: '{confirmed} confirmées',
    other: '{confirmed} confirmées',
  },
  'book.progressLabel': {
    one: '{confirmed} réservation confirmée sur {total}',
    many: '{confirmed} réservations confirmées sur {total}',
    other: '{confirmed} réservations confirmées sur {total}',
  },
  'book.ofTotal': 'sur {total}',
  'book.confirmed': 'Confirmées',
  'book.awaiting': 'En attente de confirmation',
  'book.nothingHanging': 'Rien en suspens',
  'book.chase': 'Relancez avant le départ',
  'book.committed': 'Engagé',
  'book.committedCaption': 'Sur toutes les réservations de ce voyage',
  'book.onItinerary': 'Dans l’itinéraire',
  'book.pinnedCaption': 'Épinglé à un jour du plan',
} satisfies TranslationOf<typeof En>

export default messages
