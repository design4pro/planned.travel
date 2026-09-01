/**
 * The trip tabs' own copy, in cs.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurál.** `one` · `few` · `many` · `other`; `many` je desetinné číslo.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Tuto cestu se nepodařilo načíst',
  'error.plan': 'Program se nepodařilo načíst',
  'error.costs': 'Náklady se nepodařilo načíst',
  'error.collab': 'Konverzaci se nepodařilo načíst',
  'error.book': 'Rezervace se nepodařilo načíst',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Program',
  'plan.places': 'Místa',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Společně',
  'collab.empty': 'Zatím nic nesdíleno',
  'collab.conversation': 'Konverzace',
  'collab.count.messages': {
    one: '{messages} zpráva',
    few: '{messages} zprávy',
    many: '{messages} zprávy',
    other: '{messages} zpráv',
  },
  'collab.count.notes': {
    one: '{notes} poznámka',
    few: '{notes} poznámky',
    many: '{notes} poznámky',
    other: '{notes} poznámek',
  },
  'collab.count.polls': {
    one: '{polls} anketa',
    few: '{polls} ankety',
    many: '{polls} ankety',
    other: '{polls} anket',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezervace',
  'book.empty': 'Zatím nic rezervováno',
  'book.count.bookings': {
    one: '{bookings} rezervace',
    few: '{bookings} rezervace',
    many: '{bookings} rezervace',
    other: '{bookings} rezervací',
  },
  'book.count.confirmed': {
    one: '{confirmed} potvrzená',
    few: '{confirmed} potvrzené',
    many: '{confirmed} potvrzené',
    other: '{confirmed} potvrzených',
  },
  'book.progressLabel': {
    one: '{confirmed} z {total} rezervace potvrzena',
    few: '{confirmed} z {total} rezervací potvrzeny',
    many: '{confirmed} z {total} rezervací potvrzeny',
    other: '{confirmed} z {total} rezervací potvrzeno',
  },
  'book.ofTotal': 'z {total}',
  'book.confirmed': 'Potvrzené',
  'book.awaiting': 'Čeká na potvrzení',
  'book.nothingHanging': 'Nic nevisí',
  'book.chase': 'Vyřeš to před odletem',
  'book.committed': 'Závazky',
  'book.committedCaption': 'Ze všech rezervací této cesty',
  'book.onItinerary': 'V programu',
  'book.pinnedCaption': 'Připnuto ke dni programu',
} satisfies TranslationOf<typeof En>

export default messages
