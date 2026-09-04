/**
 * The trip tabs' own copy, in it.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurale.** `one` · `many` · `other`; `many` solo per i numeri compatti grandi.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Non è stato possibile caricare questo viaggio',
  'error.plan': 'Non è stato possibile caricare l’itinerario',
  'error.costs': 'Non è stato possibile caricare le spese',
  'error.collab': 'Non è stato possibile caricare la conversazione',
  'error.book': 'Non è stato possibile caricare le prenotazioni',
  'error.transports': 'Gli spostamenti non sono stati caricati',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerario',
  'plan.places': 'Luoghi',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Insieme',
  'collab.empty': 'Non è ancora stato condiviso nulla',
  'collab.conversation': 'Conversazione',
  'collab.count.messages': {
    one: '{messages} messaggio',
    many: '{messages} messaggi',
    other: '{messages} messaggi',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} note',
    other: '{notes} note',
  },
  'collab.count.polls': {
    one: '{polls} sondaggio',
    many: '{polls} sondaggi',
    other: '{polls} sondaggi',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Prenotazioni',
  'book.empty': 'Non è ancora stato prenotato nulla',
  'book.count.bookings': {
    one: '{bookings} prenotazione',
    many: '{bookings} prenotazioni',
    other: '{bookings} prenotazioni',
  },
  'book.count.confirmed': {
    one: '{confirmed} confermata',
    many: '{confirmed} confermate',
    other: '{confirmed} confermate',
  },
  'book.progressLabel': {
    one: '{confirmed} prenotazione confermata su {total}',
    many: '{confirmed} prenotazioni confermate su {total}',
    other: '{confirmed} prenotazioni confermate su {total}',
  },
  'book.ofTotal': 'su {total}',
  'book.confirmed': 'Confermate',
  'book.awaiting': 'In attesa di conferma',
  'book.nothingHanging': 'Niente in sospeso',
  'book.chase': 'Sollecitale prima di partire',
  'book.committed': 'Impegnato',
  'book.committedCaption': 'Su tutte le prenotazioni di questo viaggio',
  'book.onItinerary': 'Nell’itinerario',
  'book.pinnedCaption': 'Fissato a un giorno del piano',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Spostamenti',
  'transports.empty': 'Ancora nulla registrato',
  'transports.count.transports': {
    one: '{transports} spostamento',
    many: '{transports} spostamenti',
    other: '{transports} spostamenti',
  },
  'transports.distance': 'Distanza percorsa',
  'transports.equator': '≈ {times}× il giro dell’equatore',
  'transports.noGrouping': 'Ancora nulla raggruppato',
  'transports.mostly': 'soprattutto {mode}',
  'transports.confirmed': 'Confermati',
  'transports.stillPending': {
    one: '{pending} ancora in attesa',
    many: '{pending} ancora in attesa',
    other: '{pending} ancora in attesa',
  },
  'transports.spent': 'Speso in viaggi',
  'transports.noPrices': 'Nessun prezzo registrato',
  'transports.priced': {
    one: 'su {priced} spostamento con prezzo',
    many: 'su {priced} spostamenti con prezzo',
    other: 'su {priced} spostamenti con prezzo',
  },
} satisfies TranslationOf<typeof En>

export default messages
