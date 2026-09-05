/**
 * The trip tabs' own copy, in hu.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Többes szám.** `one` · `other`; a magyar szám után egyes számot használ.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Ezt az utazást nem sikerült betölteni',
  'error.plan': 'Az útitervet nem sikerült betölteni',
  'error.costs': 'A költségeket nem sikerült betölteni',
  'error.collab': 'A beszélgetést nem sikerült betölteni',
  'error.book': 'A foglalásokat nem sikerült betölteni',
  'error.transports': 'Az utak nem töltődtek be',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Útiterv',
  'plan.places': 'Helyek',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Közösen',
  'collab.empty': 'Még semmit sem osztottak meg',
  'collab.conversation': 'Beszélgetés',
  'collab.count.messages': {
    one: '{messages} üzenet',
    other: '{messages} üzenet',
  },
  'collab.count.notes': {
    one: '{notes} jegyzet',
    other: '{notes} jegyzet',
  },
  'collab.count.polls': {
    one: '{polls} szavazás',
    other: '{polls} szavazás',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Foglalások',
  'book.empty': 'Még nincs foglalás',
  'book.count.bookings': {
    one: '{bookings} foglalás',
    other: '{bookings} foglalás',
  },
  'book.count.confirmed': {
    one: '{confirmed} megerősítve',
    other: '{confirmed} megerősítve',
  },
  'book.progressLabel': {
    one: '{total} foglalásból {confirmed} megerősítve',
    other: '{total} foglalásból {confirmed} megerősítve',
  },
  'book.ofTotal': '/ {total}',
  'book.confirmed': 'Megerősítve',
  'book.awaiting': 'Megerősítésre vár',
  'book.nothingHanging': 'Semmi sem lóg',
  'book.chase': 'Intézd el indulás előtt',
  'book.committed': 'Lekötve',
  'book.committedCaption': 'Az utazás összes foglalására',
  'book.onItinerary': 'Az útitervben',
  'book.pinnedCaption': 'Az útiterv egy napjához rögzítve',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Utak',
  'transports.empty': 'Még nincs rögzítve semmi',
  'transports.count.transports': {
    one: '{transports} út',
    other: '{transports} út',
  },
  'transports.distance': 'Megtett távolság',
  'transports.equator': '≈ {times}× az Egyenlítő körül',
  'transports.noGrouping': 'Még nincs csoportosítva semmi',
  'transports.mostly': 'többnyire {mode}',
  'transports.confirmed': 'Megerősítve',
  'transports.stillPending': {
    one: '{pending} még függőben',
    other: '{pending} még függőben',
  },
  'transports.spent': 'Utazásra költve',
  'transports.noPrices': 'Nincs rögzített ár',
  'transports.priced': {
    one: '{priced} árazott úton',
    other: '{priced} árazott úton',
  },
} satisfies TranslationOf<typeof En>

export default messages
