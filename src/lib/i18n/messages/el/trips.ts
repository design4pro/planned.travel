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
  'plan.day.empty': 'Τίποτα προγραμματισμένο — σύρε εδώ ένα μέρος ή μια σημείωση',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Προσθήκη σημείωσης',
  'plan.note.addForDay': 'Προσθήκη σημείωσης, {day}',
  'plan.note.showMore': 'Περισσότερα',
  'plan.note.showLess': 'Λιγότερα',
  'plan.note.moveUp': 'Μετακίνηση πάνω',
  'plan.note.moveDown': 'Μετακίνηση κάτω',
  'plan.note.edit': 'Επεξεργασία σημείωσης',
  'plan.note.delete': 'Διαγραφή σημείωσης',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Προσθήκη σημείωσης',
  'plan.note.dialog.editTitle': 'Επεξεργασία σημείωσης',
  'plan.note.field.body': 'Σημείωση',
  'plan.note.field.bodyHint': 'Μία γραμμή. Αυτό δείχνει η ημέρα.',
  'plan.note.field.detail': 'Λεπτομέρειες',
  'plan.note.field.detailHint':
    'Επικεφαλίδες, λίστες, σύνδεσμοι, παραθέσεις, κώδικας και πίνακες.',
  'plan.note.field.time': 'Ώρα',
  'plan.note.field.timeHint': 'Προαιρετικό, σε 24ωρη μορφή.',
  'plan.note.field.icon': 'Εικονίδιο',
  'plan.note.tab.write': 'Σύνταξη',
  'plan.note.tab.preview': 'Προεπισκόπηση',
  'plan.note.previewEmpty': 'Δεν υπάρχει ακόμη κάτι για προεπισκόπηση',
  'plan.note.save': 'Αποθήκευση σημείωσης',
  'plan.note.cancel': 'Ακύρωση',
  'plan.note.confirmDelete': 'Διαγραφή αυτής της σημείωσης;',
  'plan.note.confirmDeleteBody':
    'Η σημείωση και οι λεπτομέρειές της φεύγουν από αυτήν την ημέρα.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Η σημείωση προστέθηκε',
  'plan.note.toast.updated': 'Η σημείωση αποθηκεύτηκε',
  'plan.note.toast.deleted': 'Η σημείωση διαγράφηκε',
  'plan.note.error.save': 'Η σημείωση δεν αποθηκεύτηκε',
  'plan.note.error.delete': 'Η σημείωση δεν διαγράφηκε',
  'plan.note.error.move': 'Η μετακίνηση δεν αποθηκεύτηκε',
  'plan.note.error.retry': 'Δοκιμάστε ξανά σε λίγο.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Υπενθύμιση',
  'plan.note.icon.clock': 'Ώρα',
  'plan.note.icon.flashlight': 'Φακός',
  'plan.note.icon.footprints': 'Περπάτημα',
  'plan.note.icon.info': 'Πληροφορία',
  'plan.note.icon.luggage': 'Αποσκευές',
  'plan.note.icon.package': 'Δέμα',
  'plan.note.icon.ticket': 'Εισιτήρια',
  'plan.note.icon.trainFront': 'Τρένο',
  'plan.note.icon.wifi': 'Ίντερνετ',
  'plan.note.icon.stickyNote': 'Σημείωση',
  'plan.note.icon.utensils': 'Φαγητό',
  'plan.note.icon.bus': 'Μεταφορά',
  'plan.note.icon.bedDouble': 'Διαμονή',
  'plan.note.icon.camera': 'Φωτογραφία',
  'plan.note.icon.mapPin': 'Τοποθεσία',
  'plan.note.icon.wallet': 'Χρήματα',
  'plan.note.icon.umbrella': 'Βροχή',
  'plan.note.icon.triangleAlert': 'Προειδοποίηση',
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
