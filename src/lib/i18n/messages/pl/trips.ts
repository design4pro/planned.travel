/**
 * The trip tabs' own copy, in pl.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Liczba mnoga.** `one` · `few` · `many` · `other`; `other` to liczba dziesiętna.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Nie udało się wczytać tej wycieczki',
  'error.plan': 'Nie udało się wczytać planu',
  'error.costs': 'Nie udało się wczytać kosztów',
  'error.collab': 'Nie udało się wczytać rozmowy',
  'error.book': 'Nie udało się wczytać rezerwacji',
  'error.transports': 'Przejazdy się nie wczytały',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Plan dnia',
  'plan.places': 'Miejsca',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Wspólnie',
  'collab.empty': 'Nic jeszcze nie udostępniono',
  'collab.conversation': 'Rozmowa',
  'collab.count.messages': {
    one: '{messages} wiadomość',
    few: '{messages} wiadomości',
    many: '{messages} wiadomości',
    other: '{messages} wiadomości',
  },
  'collab.count.notes': {
    one: '{notes} notatka',
    few: '{notes} notatki',
    many: '{notes} notatek',
    other: '{notes} notatki',
  },
  'collab.count.polls': {
    one: '{polls} ankieta',
    few: '{polls} ankiety',
    many: '{polls} ankiet',
    other: '{polls} ankiety',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Rezerwacje',
  'book.empty': 'Nic jeszcze nie zarezerwowano',
  'book.count.bookings': {
    one: '{bookings} rezerwacja',
    few: '{bookings} rezerwacje',
    many: '{bookings} rezerwacji',
    other: '{bookings} rezerwacji',
  },
  'book.count.confirmed': {
    one: '{confirmed} potwierdzona',
    few: '{confirmed} potwierdzone',
    many: '{confirmed} potwierdzonych',
    other: '{confirmed} potwierdzonej',
  },
  'book.progressLabel': {
    one: '{confirmed} z {total} rezerwacji potwierdzona',
    few: '{confirmed} z {total} rezerwacji potwierdzone',
    many: '{confirmed} z {total} rezerwacji potwierdzonych',
    other: '{confirmed} z {total} rezerwacji potwierdzonych',
  },
  'book.ofTotal': 'z {total}',
  'book.confirmed': 'Potwierdzone',
  'book.awaiting': 'Czeka na potwierdzenie',
  'book.nothingHanging': 'Nic nie wisi',
  'book.chase': 'Dopilnuj ich przed wylotem',
  'book.committed': 'Zobowiązania',
  'book.committedCaption': 'Ze wszystkich rezerwacji tej wycieczki',
  'book.onItinerary': 'W planie dnia',
  'book.pinnedCaption': 'Przypięte do dnia planu',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Przejazdy',
  'transports.empty': 'Nic jeszcze nie zapisano',
  'transports.count.transports': {
    one: '{transports} przejazd',
    few: '{transports} przejazdy',
    many: '{transports} przejazdów',
    other: '{transports} przejazdu',
  },
  'transports.distance': 'Pokonany dystans',
  'transports.equator': '≈ {times}× dookoła równika',
  'transports.noGrouping': 'Nic jeszcze nie pogrupowano',
  'transports.mostly': 'głównie {mode}',
  'transports.confirmed': 'Potwierdzone',
  'transports.stillPending': {
    one: '{pending} wciąż oczekuje',
    few: '{pending} wciąż oczekują',
    many: '{pending} wciąż oczekuje',
    other: '{pending} wciąż oczekuje',
  },
  'transports.spent': 'Wydane na podróż',
  'transports.noPrices': 'Brak zapisanych cen',
  'transports.priced': {
    one: 'z {priced} wycenionego przejazdu',
    few: 'z {priced} wycenionych przejazdów',
    many: 'z {priced} wycenionych przejazdów',
    other: 'z {priced} wycenionych przejazdów',
  },
} satisfies TranslationOf<typeof En>

export default messages
