/**
 * The trip tabs' own copy, in el.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Πληθυντικός.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Αυτό το ταξίδι δεν φορτώθηκε',
  'error.plan': 'Το πρόγραμμα δεν φορτώθηκε',
  'error.costs': 'Τα έξοδα δεν φορτώθηκαν',
  'error.collab': 'Η συνομιλία δεν φορτώθηκε',
  'error.book': 'Οι κρατήσεις δεν φορτώθηκαν',
  'error.transports': 'Οι μετακινήσεις δεν φορτώθηκαν',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Πρόγραμμα',
  'plan.places': 'Τοποθεσίες',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Μαζί',
  'collab.empty': 'Δεν έχει μοιραστεί τίποτα ακόμη',
  'collab.conversation': 'Συνομιλία',
  'collab.count.messages': {
    one: '{messages} μήνυμα',
    other: '{messages} μηνύματα',
  },
  'collab.count.notes': {
    one: '{notes} σημείωση',
    other: '{notes} σημειώσεις',
  },
  'collab.count.polls': {
    one: '{polls} ψηφοφορία',
    other: '{polls} ψηφοφορίες',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Κρατήσεις',
  'book.empty': 'Δεν έχει κλειστεί τίποτα ακόμη',
  'book.count.bookings': {
    one: '{bookings} κράτηση',
    other: '{bookings} κρατήσεις',
  },
  'book.count.confirmed': {
    one: '{confirmed} επιβεβαιωμένη',
    other: '{confirmed} επιβεβαιωμένες',
  },
  'book.progressLabel': {
    one: '{confirmed} από {total} κράτηση επιβεβαιωμένη',
    other: '{confirmed} από {total} κρατήσεις επιβεβαιωμένες',
  },
  'book.ofTotal': 'από {total}',
  'book.confirmed': 'Επιβεβαιωμένες',
  'book.awaiting': 'Αναμένει επιβεβαίωση',
  'book.nothingHanging': 'Τίποτα σε εκκρεμότητα',
  'book.chase': 'Κυνηγήστε τες πριν την πτήση',
  'book.committed': 'Δεσμευμένα',
  'book.committedCaption': 'Σε όλες τις κρατήσεις αυτού του ταξιδιού',
  'book.onItinerary': 'Στο πρόγραμμα',
  'book.pinnedCaption': 'Καρφιτσωμένο σε μια μέρα του προγράμματος',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Μετακινήσεις',
  'transports.empty': 'Τίποτα καταγεγραμμένο ακόμη',
  'transports.count.transports': {
    one: '{transports} μετακίνηση',
    other: '{transports} μετακινήσεις',
  },
  'transports.distance': 'Απόσταση που διανύθηκε',
  'transports.equator': '≈ {times}× ο γύρος του ισημερινού',
  'transports.noGrouping': 'Τίποτα ομαδοποιημένο ακόμη',
  'transports.mostly': 'κυρίως {mode}',
  'transports.confirmed': 'Επιβεβαιωμένες',
  'transports.stillPending': {
    one: '{pending} ακόμη σε εκκρεμότητα',
    other: '{pending} ακόμη σε εκκρεμότητα',
  },
  'transports.spent': 'Δαπάνη για ταξίδια',
  'transports.noPrices': 'Καμία τιμή καταγεγραμμένη',
  'transports.priced': {
    one: 'σε {priced} μετακίνηση με τιμή',
    other: 'σε {priced} μετακινήσεις με τιμή',
  },
} satisfies TranslationOf<typeof En>

export default messages
