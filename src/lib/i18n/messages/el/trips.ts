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
  'collab.readOnly.archived':
    'Αυτό το ταξίδι έχει αρχειοθετηθεί. Η συνεργασία είναι μόνο για ανάγνωση.',
  'collab.readOnly.role':
    'Μόνο οι ιδιοκτήτες και οι συντάκτες του ταξιδιού μπορούν να αλλάζουν τη συζήτηση, τις σημειώσεις και τις δημοσκοπήσεις.',
  'notFound.title': 'Δεν μπορούμε να βρούμε αυτό το ταξίδι',
  'notFound.body':
    'Δεν είναι ανάμεσα στα ταξίδια που μπορείς να ανοίξεις στον τρέχοντα χώρο εργασίας. Ίσως έχει διαγραφεί ή δεν έχεις πρόσβαση σε αυτό.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Προσθήκη μέρους σε αυτό το ταξίδι',
  'plan.editor.editTitle': 'Επεξεργασία αυτού του μέρους',
  'plan.editor.createDescription':
    'Δώστε όνομα τώρα και θέση αργότερα - ένα μη προγραμματισμένο μέρος περιμένει στον πίνακα μερών μέχρι να το προσθέσετε σε μια ημέρα.',
  'plan.editor.editDescription':
    'Οι αλλαγές ισχύουν παντού: στον χάρτη, σε κάθε σχετική ημέρα και στη λίστα μερών του ταξιδιού.',
  'plan.editor.nameRequired': 'Το μέρος χρειάζεται όνομα',
  'plan.editor.nameExample': 'π.χ. Φουσίμι Ινάρι Τάισα',
  'plan.editor.city': 'Πόλη',
  'plan.editor.cityExample': 'π.χ. Κιότο',
  'plan.editor.addressExample': 'π.χ. 68 Φουκακούσα Γιαμπουνοούτσιτσο',
  'plan.editor.duration': 'Χρόνος παραμονής',
  'plan.editor.rating': 'Αξίζει;',
  'plan.editor.latitude': 'Γεωγραφικό πλάτος',
  'plan.editor.longitude': 'Γεωγραφικό μήκος',
  'plan.editor.positionHint': 'Ή κλείστε και επιλέξτε το σημείο στον χάρτη.',
  'plan.editor.latitudeError': 'Μεταξύ -90 και 90',
  'plan.editor.longitudeError': 'Μεταξύ -180 και 180',
  'plan.editor.positionError': 'Η θέση χρειάζεται και τους δύο αριθμούς',
  'plan.editor.day': 'Προσθήκη σε ημέρα',
  'plan.editor.dayHint': 'Αφήστε κενό για να παραμείνει στον πίνακα μερών.',
  'plan.editor.unplanned': 'Χωρίς προγραμματισμό',
  'plan.editor.dayNamed': 'Ημέρα {day} · {title}',
  'plan.editor.stopFallback': 'Αυτή η στάση',
  'plan.editor.dayNumber': 'Ημέρα {day}',
  'plan.editor.visited': 'Έχει ήδη γίνει επίσκεψη',
  'plan.editor.visitedHint': 'Σημειώνει την καρφίτσα με ένα τικ.',
  'plan.editor.saving': 'Αποθήκευση μέρους',
  'plan.editor.save': 'Αποθήκευση αλλαγών',
  'plan.editor.noCategory': 'Χωρίς κατηγορία',
  'plan.editor.arrive': 'Άφιξη',
  'plan.editor.leave': 'Αναχώρηση',
  'plan.editor.timeError': 'Η αναχώρηση πρέπει να είναι μετά την άφιξη',
  'plan.editor.booking': 'Κράτηση',
  'plan.editor.note': 'Σημείωση για αυτή τη στάση',
  'plan.editor.noteExample':
    'Πηγαίνετε νωρίς - μετά τις 9 η αναμονή είναι μία ώρα.',
  'plan.editor.savingTimes': 'Αποθήκευση ωρών',
  'plan.editor.saveTimes': 'Αποθήκευση',
  'plan.editor.duration0': 'Χωρίς σταθερή διάρκεια',
  'plan.editor.duration30': '30 λεπτά',
  'plan.editor.duration45': '45 λεπτά',
  'plan.editor.duration60': '1 ώρα',
  'plan.editor.duration90': '1½ ώρα',
  'plan.editor.duration120': '2 ώρες',
  'plan.editor.duration180': '3 ώρες',
  'plan.editor.duration240': 'Μισή ημέρα',
  'plan.editor.duration480': 'Ολόκληρη ημέρα',
  'plan.editor.rating0': 'Χωρίς αξιολόγηση',
  'plan.editor.rating1': '★ 1 - παραλείψτε το',
  'plan.editor.rating2': '★ 2 - αν υπάρχει χρόνος',
  'plan.editor.rating3': '★ 3 - αξίζει',
  'plan.editor.rating4': '★ 4 - πολύ καλό',
  'plan.editor.rating5': '★ 5 - μην το χάσετε',
  'plan.editor.bookingNone': 'Δεν χρειάζεται κράτηση',
  'plan.editor.bookingPending': 'Εκκρεμεί κράτηση',
  'plan.editor.bookingConfirmed': 'Κράτηση επιβεβαιωμένη',
  'plan.editor.bookingCompleted': 'Επίσκεψη ολοκληρωμένη',
  'plan.editor.bookingCancelled': 'Ακυρώθηκε',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Αυτό το ταξίδι δεν φορτώθηκε',
  'error.plan': 'Το πρόγραμμα δεν φορτώθηκε',
  'error.costs': 'Τα έξοδα δεν φορτώθηκαν',
  'error.collab': 'Η συνομιλία δεν φορτώθηκε',
  'error.book': 'Οι κρατήσεις δεν φορτώθηκαν',
  'error.transports': 'Οι μετακινήσεις δεν φορτώθηκαν',
  'error.people': 'Τα άτομα δεν φορτώθηκαν',
  'header.length': {
    one: '{days} ημέρα',
    other: '{days} ημέρες',
  },
  'header.planned': {
    one: '{days} ημέρα σχεδιασμένη',
    other: '{days} ημέρες σχεδιασμένες',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Πρόγραμμα',
  'plan.places': 'Τοποθεσίες',
  'plan.readOnly.archived':
    'Αυτό το ταξίδι είναι αρχειοθετημένο, οπότε το πρόγραμμα είναι μόνο για ανάγνωση.',
  'plan.readOnly.role':
    'Μπορείτε να διαβάσετε αυτό το πρόγραμμα. Μόνο ο ιδιοκτήτης του ταξιδιού και οι συντάκτες μπορούν να το αλλάξουν.',
  'plan.day.empty':
    'Τίποτα προγραμματισμένο — σύρε εδώ ένα μέρος ή μια σημείωση',
  'plan.move.refused.duplicate': 'Το {name} υπάρχει ήδη σε εκείνη την ημέρα',
  'plan.move.refused.duplicateBody':
    'Ένα μέρος μπορεί να εμφανίζεται μία φορά ανά ημέρα. Μετακινήστε το σε άλλη ημέρα.',
  'plan.move.refused.notInIdeas': 'Η σημείωση μένει μέσα στην ημέρα',
  'plan.move.refused.notInIdeasBody':
    'Οι ιδέες είναι μέρη που περιμένουν ημέρα. Η σημείωση ανήκει πάντα σε μια ημέρα.',
  'plan.move.refused.journeyNotInIdeas': 'Η μετακίνηση μένει μέσα στην ημέρα',
  'plan.move.refused.journeyNotInIdeasBody':
    'Οι ιδέες είναι μέρη που περιμένουν ημέρα. Η μετακίνηση ανήκει στην ημέρα που γίνεται.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Η μετακίνηση μένει στη δική της ημέρα',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Η ημέρα μιας μετακίνησης προκύπτει από τις ημερομηνίες της. Αλλάξτε τες στην καρτέλα Μετακινήσεις.',
  'plan.move.refused.journeyTimed': 'Το {name} αναχωρεί στις {time}',
  'plan.move.refused.journeyTimedBody':
    'Η ώρα αναχώρησης ανήκει στο δρομολόγιο, όχι στο πλάνο. Βάλτε τη μετακίνηση εκεί που δείχνει το ρολόι της.',
  'plan.move.spoken.duplicate':
    'Το {name} δεν μετακινήθηκε. Εκείνη η ημέρα το έχει ήδη.',
  'plan.move.spoken.notInIdeas':
    'Το {name} δεν μετακινήθηκε. Η σημείωση μένει μέσα στην ημέρα.',
  'plan.move.spoken.timed':
    'Το {name} έχει ώρα {time}. Ρωτάμε αν θα την αφήσουμε.',
  'plan.move.spoken.journeyNotInIdeas':
    'Το {name} δεν μετακινήθηκε. Η μετακίνηση μένει μέσα στην ημέρα.',
  'plan.move.spoken.journeyNotInAnotherDay':
    'Το {name} δεν μετακινήθηκε. Η μετακίνηση μένει στη δική της ημέρα.',
  'plan.move.spoken.journeyTimed':
    'Το {name} δεν μετακινήθηκε. Αναχωρεί στις {time}.',
  'plan.move.error.save': 'Η μετακίνηση δεν αποθηκεύτηκε',
  'plan.move.error.retry': 'Δοκιμάστε ξανά σε λίγο.',
  'plan.move.dropTime.title':
    'Μετακίνηση του {name} και κατάργηση της ώρας {time};',
  'plan.move.dropTime.body':
    'Αυτή η θέση έρχεται σε αντίθεση με την ώρα που έχει. Η μετακίνηση εδώ σβήνει την ώρα — η νέα σειρά και η σβησμένη ώρα αποθηκεύονται μαζί.',
  'plan.move.dropTime.confirm': 'Μετακίνηση και κατάργηση ώρας',
  'plan.move.dropTime.cancel': 'Να μείνει όπου είναι',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Επεξεργασία μέρους',
  'plan.stop.menu.setTime': 'Ορισμός ώρας',
  'plan.stop.menu.placeOnMap': 'Τοποθέτηση στον χάρτη',
  'plan.stop.menu.movePin': 'Μετακίνηση της καρφίτσας',
  'plan.stop.menu.moveToDay': 'Μετακίνηση σε άλλη ημέρα',
  'plan.stop.menu.backToUnplanned': 'Επιστροφή στα μη προγραμματισμένα',
  'plan.stop.menu.delete': 'Διαγραφή από το ταξίδι',
  'plan.stop.visited': 'Επισκεφθήκατε',
  'plan.delete.title': 'Διαγραφή του «{name}»;',
  'plan.delete.titleUnnamed': 'Διαγραφή αυτού του μέρους;',
  'plan.delete.bodyUnplanned':
    'Αφαιρείται εντελώς από τα μέρη του ταξιδιού. Αυτό δεν αναιρείται.',
  'plan.delete.bodyOnDays': {
    one: 'Βρίσκεται σε {count} ημέρα αυτού του ταξιδιού και αφαιρείται από αυτήν. Αυτό δεν αναιρείται.',
    other:
      'Βρίσκεται σε {count} ημέρες αυτού του ταξιδιού και αφαιρείται από όλες. Αυτό δεν αναιρείται.',
  },
  'plan.delete.error': 'Η διαγραφή δεν ολοκληρώθηκε',
  'plan.delete.confirm': 'Διαγραφή μέρους',
  'plan.delete.deleting': 'Διαγραφή του μέρους',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Προσθήκη σημείωσης',
  'plan.note.addForDay': 'Προσθήκη σημείωσης, {day}',
  'plan.addPlace.label': 'Προσθήκη τοποθεσίας',
  'plan.addPlace.more': 'Περισσότεροι τρόποι προσθήκης τοποθεσίας',
  'plan.addPlace.option.map': 'Τοποθέτηση στον χάρτη',
  'plan.addPlace.forDayNamed': 'Προσθήκη τοποθεσίας, {day}',
  'plan.addPlace.quota':
    'Φτάσατε το όριο τοποθεσιών του πακέτου σας. Αναβαθμίστε για να προσθέσετε περισσότερες.',
  'plan.addPlace.quotaAction': 'Δείτε τα πακέτα',
  'plan.stay.checkIn': 'Άφιξη',
  'plan.stay.checkOut': 'Αποχώρηση',
  'plan.day.addStay': 'Προσθήκη διαμονής, {day}',
  'plan.day.addStayShort': 'Προσθήκη διαμονής',
  'plan.handoff.stop':
    'Άνοιγμα του {place} στο {service} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.directions': 'Οδηγίες στο {service}',
  'plan.handoff.day.directionsName':
    'Οδηγίες στο {service}: {day} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.directionsPartial':
    'Στάσεις: οι πρώτες {carried} από {total}',
  'plan.handoff.day.directionsPartialName':
    'Οδηγίες στο {service}: {day}, στάσεις: οι πρώτες {carried} από {total} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.point': 'Εμφάνιση στο {service}',
  'plan.handoff.day.pointName':
    'Εμφάνιση στο {service}: η μοναδική στάση με θέση στον χάρτη, {day} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.part': 'Μέρος {n} από {count}',
  'plan.handoff.day.directionsPartName':
    'Οδηγίες στο {service}, μέρος {n} από {count}, {day} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.directionsPartialPartName':
    'Οδηγίες στο {service}, μέρος {n} από {count}, στάσεις: οι πρώτες {carried} από {total}, {day} (ανοίγει σε νέα καρτέλα)',
  'plan.handoff.day.pointPartName':
    'Εμφάνιση στο {service}, μέρος {n} από {count}, {day} (ανοίγει σε νέα καρτέλα)',
  'plan.drop.hint':
    'Κάντε δεξί κλικ στον χάρτη ή πατήστε παρατεταμένα για να προσθέσετε μια τοποθεσία ακριβώς εκεί.',
  'plan.drop.armed':
    'Κάντε κλικ στον χάρτη εκεί που ανήκει ή μετακινήστε τον χάρτη και πατήστε Enter για να την αφήσετε στο κέντρο.',
  'plan.drop.stop': 'Διακοπή τοποθέτησης νέας καρφίτσας',
  'plan.drop.pin': 'Νέα τοποθεσία',
  'plan.drop.lookingUp': 'Αναζήτηση διεύθυνσης…',
  'plan.drop.error': 'Η καρφίτσα δεν τοποθετήθηκε. Δοκίμασε ξανά σε λίγο.',
  'plan.place.pastedPosition': 'Αναγνωρίστηκε: πλάτος {lat}, μήκος {lng}',
  'plan.note.showMore': 'Περισσότερα',
  'plan.note.showLess': 'Λιγότερα',
  'plan.note.moveUp': 'Μετακίνηση πάνω',
  'plan.note.moveDown': 'Μετακίνηση κάτω',
  'plan.note.moveToDay': 'Μετακίνηση σε άλλη ημέρα',
  'plan.note.drag': 'Αναδιάταξη σημείωσης',
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
  'plan.transport.phase.flight.departing': 'Απογείωση',
  'plan.transport.phase.flight.travelling': 'Στον αέρα',
  'plan.transport.phase.flight.arriving': 'Προσγείωση',
  'plan.transport.phase.hire.departing': 'Παραλαβή',
  'plan.transport.phase.hire.travelling': 'Σε ενοικίαση',
  'plan.transport.phase.hire.arriving': 'Παράδοση',
  'plan.transport.phase.journey.departing': 'Έναρξη',
  'plan.transport.phase.journey.travelling': 'Σε εξέλιξη',
  'plan.transport.phase.journey.arriving': 'Λήξη',
  'plan.transport.label': 'Από {from} προς {to}',
  'plan.transport.drag': 'Αναδιάταξη, {journey}',
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
  'book.readOnly.archived':
    'Αυτό το ταξίδι είναι αρχειοθετημένο, οπότε οι κρατήσεις και οι διαμονές είναι μόνο για ανάγνωση. Επαναφέρετε το ταξίδι για να τις αλλάξετε.',
  'book.readOnly.role':
    'Μπορείτε να διαβάσετε αυτές τις κρατήσεις και διαμονές. Μόνο ο ιδιοκτήτης του ταξιδιού και οι συντάκτες μπορούν να τις αλλάξουν.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Αυτή η αλλαγή απορρίφθηκε. Ελέγξτε την τρέχουσα κατάσταση του ταξιδιού πριν κάνετε άλλες αλλαγές.',
  'transports.recovery.failed':
    'Δεν ήταν δυνατή η ανανέωση του ταξιδιού. Δοκιμάστε ξανά πριν κάνετε αλλαγές.',
  'transports.readOnly.archived':
    'Αυτό το ταξίδι έχει αρχειοθετηθεί. Επαναφέρετέ το για να αλλάξετε τις μετακινήσεις.',
  'transports.readOnly.role':
    'Μπορείτε να διαβάσετε αυτές τις μετακινήσεις. Μόνο ο ιδιοκτήτης του ταξιδιού και οι συντάκτες μπορούν να τις αλλάξουν.',
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
  'people.title': 'Άτομα',
  'people.description':
    'Ποιοι είναι σε αυτό το ταξίδι και ποιοι μπορούν να το βρουν',
  'people.members.title': 'Σε αυτό το ταξίδι',
  'people.members.empty':
    'Κανείς από αυτό το ταξίδι δεν είναι πια σε αυτόν τον χώρο εργασίας',
  'people.role.label': 'Ρόλος',
  'people.role.owner': 'Ιδιοκτήτης',
  'people.role.editor': 'Συντάκτης',
  'people.role.viewer': 'Αναγνώστης',
  'people.you': 'Εσείς',
  'people.owner.hint': 'Κάθε ταξίδι κρατά τουλάχιστον έναν ιδιοκτήτη',
  'people.remove.action': 'Αφαίρεση του {name} από αυτό το ταξίδι',
  'people.remove.title': 'Αφαίρεση του {name} από αυτό το ταξίδι;',
  'people.remove.body':
    'Χάνει αμέσως την πρόσβαση στο πρόγραμμα. Όσα πρόσθεσε μένουν στο ταξίδι.',
  'people.remove.confirm': 'Αφαίρεση',
  'people.leave.action': 'Αποχώρηση από το ταξίδι',
  'people.leave.title': 'Αποχώρηση από αυτό το ταξίδι;',
  'people.leave.body':
    'Χάνετε την πρόσβαση στο πρόγραμμα μέχρι να σας προσθέσει ξανά κάποιος από το ταξίδι.',
  'people.leave.confirm': 'Αποχώρηση',
  'people.cancel': 'Άκυρο',
  'people.invite.title': 'Προσθήκη ατόμου',
  'people.invite.placeholder': 'Αναζητήστε άτομα σε αυτόν τον χώρο εργασίας',
  'people.invite.action': 'Προσθήκη στο ταξίδι',
  'people.invite.role': 'Συμμετέχει ως',
  'people.invite.empty':
    'Όλοι σε αυτόν τον χώρο εργασίας είναι ήδη σε αυτό το ταξίδι',
  'people.invite.emptyHint':
    'Πρώτα μπαίνει κάποιος νέος στον χώρο εργασίας, από τις Ρυθμίσεις',
  'people.visibility.title': 'Ποιοι μπορούν να βρουν αυτό το ταξίδι',
  'people.visibility.switch': 'Ορατό σε όλους στον χώρο εργασίας',
  'people.visibility.private':
    'Μόνο τα άτομα που αναφέρονται εδώ βλέπουν αυτό το ταξίδι',
  'people.visibility.organization':
    'Οποιοσδήποτε σε αυτόν τον χώρο εργασίας μπορεί να ανοίξει αυτό το ταξίδι',
  'people.visibility.public':
    'Αυτό το ταξίδι είναι κοινόχρηστο με δημόσιο σύνδεσμο',
  'people.error.lastOwner':
    'Κάθε ταξίδι κρατά τουλάχιστον έναν ιδιοκτήτη. Κάντε πρώτα κάποιον άλλον ιδιοκτήτη.',
  'people.error.notInWorkspace':
    'Αυτό το άτομο δεν είναι σε αυτόν τον χώρο εργασίας',
  'people.error.alreadyOnTrip': 'Αυτό το άτομο είναι ήδη σε αυτό το ταξίδι',
  'people.guests.title': 'Ταξιδεύουν μαζί σου',
  'people.guests.description': 'Άτομα αυτού του ταξιδιού χωρίς λογαριασμό',
  'people.guests.empty': 'Κανείς ακόμα',
  'people.guests.emptyHint':
    'Καλεσμένος είναι κάποιος που ταξιδεύει μαζί σου χωρίς να χρειάζεται λογαριασμό. Πρόσθεσέ τον με το όνομά του.',
  'people.guest.badge': 'Καλεσμένος',
  'people.guest.add.label': 'Όνομα',
  'people.guest.add.placeholder': 'Άννα',
  'people.guest.add.action': 'Προσθήκη καλεσμένου',
  'people.guest.rename.action': 'Μετονομασία: {name}',
  'people.guest.rename.title': 'Μετονομασία: {name}',
  'people.guest.rename.confirm': 'Μετονομασία',
  'people.guest.remove.action': 'Αφαίρεση του/της {name} από το ταξίδι',
  'people.guest.remove.title': 'Αφαίρεση του/της {name} από το ταξίδι;',
  'people.guest.remove.body':
    'Ο καλεσμένος αφαιρείται. Τίποτε άλλο δεν αλλάζει στο ταξίδι.',
  'people.guest.remove.confirm': 'Αφαίρεση',
  'people.guest.merge.action': '{name}: είναι πλέον…',
  'people.guest.merge.title':
    '{name}: είναι πλέον ένα από τα άτομα του ταξιδιού',
  'people.guest.merge.body':
    'Ό,τι έχει ανατεθεί στον/στην {name} περνά στο άτομο που θα επιλέξεις και ο καλεσμένος αφαιρείται. Δεν αναιρείται.',
  'people.guest.merge.inherits':
    'Ο/Η {member} αναλαμβάνει ό,τι έχει ανατεθεί στο/στη {name}.',
  'people.guest.merge.placeholder': 'Επίλεξε κάποιον από το ταξίδι',
  'people.guest.merge.confirm': 'Συγχώνευση',
  'people.guest.merge.done': '{name}: είναι πλέον {member}',
  'people.guest.merge.nothingMoved': 'Δεν είχε ανατεθεί ακόμα τίποτα',
  'people.error.guestNameTaken':
    'Υπάρχει ήδη καλεσμένος με όνομα {name} σε αυτό το ταξίδι',
  'people.error.guestLimit':
    'Ένα ταξίδι χωράει έως {limit} καλεσμένους, γιατί μια μεγαλύτερη λίστα δυσκολεύει την επιλογή συμμετεχόντων και την ανάγνωση του καταμερισμού εξόδων',
  'people.error.guestMergeTarget': 'Επίλεξε κάποιον που είναι ήδη στο ταξίδι',
  'plan.weather.badge.forecast':
    'Πρόγνωση: {figures}, {condition} (μέγιστη {max}, ελάχιστη {min})',
  'plan.weather.badge.forecastNoCondition':
    'Πρόγνωση: {figures} (μέγιστη {max}, ελάχιστη {min})',
  'plan.weather.badge.unavailable':
    'Ο καιρός δεν είναι διαθέσιμος για αυτή την ημέρα',
  'plan.weather.badge.loading': 'Φόρτωση καιρού',
  'plan.weather.badge.recorded': 'Καταγραφή: μέγιστη {max}, ελάχιστη {min}',
  'plan.weather.badge.recordedHigh': 'Καταγραφή: μέγιστη {max}',
  'plan.weather.badge.recordedLow': 'Καταγραφή: ελάχιστη {min}',
  'plan.weather.badge.estimate':
    'Εκτίμηση: τυπική μέγιστη {max}, τυπική ελάχιστη {min}',
  'plan.weather.badge.estimateHigh': 'Εκτίμηση: τυπική μέγιστη {max}',
  'plan.weather.badge.estimateLow': 'Εκτίμηση: τυπική ελάχιστη {min}',
  'plan.weather.badge.notYetRecorded': 'Δεν έχει καταγραφεί ακόμη',
  'plan.weather.condition.clear': 'Αίθριος',
  'plan.weather.condition.fair': 'Σχετικά αίθριος',
  'plan.weather.condition.partlyCloudy': 'Λίγα σύννεφα',
  'plan.weather.condition.cloudy': 'Συννεφιά',
  'plan.weather.condition.fog': 'Ομίχλη',
  'plan.weather.condition.rain': 'Βροχή',
  'plan.weather.condition.heavyRain': 'Έντονη βροχή',
  'plan.weather.condition.sleet': 'Χιονόνερο',
  'plan.weather.condition.snow': 'Χιόνι',
  'plan.weather.condition.thunder': 'Καταιγίδα',
  'plan.weather.panel.title': 'Καιρός για {date}',
  'plan.weather.panel.temperature': 'Μέγιστη / ελάχιστη',
  'plan.weather.panel.precipitation': 'Βροχόπτωση',
  'plan.weather.panel.precipitationTypical': 'Τυπική ημερήσια βροχόπτωση',
  'plan.weather.panel.probability': 'Πιθανότητα {percent}',
  'plan.weather.panel.wind': 'Άνεμος',
  'plan.weather.panel.sunrise': 'Ανατολή ηλίου',
  'plan.weather.panel.sunset': 'Δύση ηλίου',
  'plan.weather.panel.noSunrise': 'Χωρίς ανατολή ηλίου',
  'plan.weather.panel.noSunset': 'Χωρίς δύση ηλίου',
  'plan.weather.panel.slots': 'Μέσα στην ημέρα',
  'plan.weather.panel.slot.night': 'Νύχτα',
  'plan.weather.panel.slot.morning': 'Πρωί',
  'plan.weather.panel.slot.afternoon': 'Απόγευμα',
  'plan.weather.panel.slot.evening': 'Βράδυ',
  'plan.weather.panel.high': 'Μέγιστη',
  'plan.weather.panel.low': 'Ελάχιστη',
  'plan.weather.panel.recordedNote': 'Μετρημένες τιμές για αυτήν την ημέρα.',
  'plan.weather.panel.temperatureTypical': 'Τυπική μέγιστη / ελάχιστη',
  'plan.weather.panel.typicalHigh': 'Τυπική μέγιστη',
  'plan.weather.panel.typicalLow': 'Τυπική ελάχιστη',
  'plan.weather.panel.estimateNote':
    'Μακροπρόθεσμος μέσος όρος για αυτόν τον μήνα, όχι πρόγνωση.',
  'plan.weather.attribution.metNorway':
    'Δεδομένα πρόγνωσης: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Δεδομένα: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Αλλαγή πλάτους προγράμματος',
  'plan.workspace.resizePlaces': 'Αλλαγή πλάτους τοποθεσιών',
  'plan.workspace.toggleDay': 'Ανάπτυξη ή σύμπτυξη {day}',
  'plan.workspace.days': 'Ημέρες',
  'plan.workspace.showPanel': 'Εμφάνιση πίνακα {label}',
  'plan.workspace.hidePanel': 'Απόκρυψη πίνακα {label}',
  'plan.workspace.narrowPanel': 'Στένεμα {label}',
  'plan.workspace.widenPanel': 'Διεύρυνση {label}',
  'collab.sections.tabsLabel': 'Ενότητες συνεργασίας',
  'collab.sections.trigger': 'Επιλογή ενοτήτων',
  'collab.sections.menuLabel': 'Εμφάνιση σε όλους σε αυτό το ταξίδι',
  'collab.sections.keepOne': 'Τουλάχιστον μία ενότητα παραμένει ενεργή.',
  'collab.sections.failed': 'Η αλλαγή δεν αποθηκεύτηκε',
  'collab.sections.failedBody':
    'Το μενού δείχνει την τρέχουσα αποθηκευμένη κατάσταση.',
  'collab.sections.someHidden':
    'Ορισμένες ενότητες είναι κρυφές σε αυτό το ταξίδι.',
  'collab.sections.turnedOff':
    'Αυτή η ενότητα απενεργοποιήθηκε για το ταξίδι. Θα κλείσει όταν στείλετε ή διαγράψετε όσα γράφετε.',
  'collab.sections.changed': 'Οι ενότητες αυτού του ταξιδιού άλλαξαν.',
  'collab.sections.savedHidden':
    'Αποθηκεύτηκε. Αυτή η ενότητα είναι κρυφή για το ταξίδι και κλείνει τώρα.',
  'plan.place.error.save':
    'Δεν ήταν δυνατή η αποθήκευση του μέρους. Δοκιμάστε ξανά σε λίγο.',
  'plan.stop.error.saveTimes':
    'Δεν ήταν δυνατή η αποθήκευση των ωρών της στάσης. Δοκιμάστε ξανά σε λίγο.',
  'plan.place.error.delete':
    'Δεν ήταν δυνατή η διαγραφή του μέρους. Δοκιμάστε ξανά σε λίγο.',
  'plan.pin.error.move':
    'Δεν ήταν δυνατή η μετακίνηση της πινέζας. Δοκιμάστε ξανά σε λίγο.',
  'plan.place.toast.created': 'Το μέρος προστέθηκε',
  'plan.place.toast.updated': 'Το μέρος ενημερώθηκε',
  'plan.stop.toast.timesSaved': 'Οι ώρες της στάσης αποθηκεύτηκαν',
  'plan.place.toast.deleted': 'Το μέρος διαγράφηκε',
  'plan.pin.toast.moved': 'Τοποθετήθηκε πινέζα στο {name}',
  'join.page.title': 'Σύνδεσμος πρόσκλησης στο ταξίδι',
  'join.page.description':
    'Ανοίξτε αυτόν τον σύνδεσμο για να συμμετάσχετε σε ένα κοινό ταξίδι στο planned.travel.',
  'join.title.invited': 'Πρόσκληση σε ταξίδι από {inviter}',
  'join.requirement':
    'Ο σύνδεσμος ισχύει για όσους είναι ήδη στον χώρο εργασίας του χρήστη {inviter}.',
  'join.newHere':
    'Πρώτη φορά εδώ; Ζητήστε πρώτα από τον χρήστη {inviter} να σας προσθέσει στον χώρο εργασίας του.',
  'join.trip.label': 'Ταξίδι',
  'join.role.label': 'Θα συμμετέχετε ως',
  'join.dates.label': 'Ημερομηνίες',
  'join.destination.label': 'Προορισμός',
  'join.action.signIn': 'Σύνδεση',
  'join.action.join': 'Συμμετοχή στο ταξίδι',
  'join.action.joining': 'Γίνεται συμμετοχή στο ταξίδι',
  'join.action.open': 'Άνοιγμα ταξιδιού',
  'join.action.openIn': 'Άνοιγμα ταξιδιού και αλλαγή χώρου εργασίας',
  'join.action.openIn.pending': 'Αλλαγή χώρου εργασίας',
  'join.loading': 'Φόρτωση της πρόσκλησης',
  'join.joined.title': 'Συμμετέχετε στο ταξίδι',
  'join.joined.body': 'Ανοίξτε το για να δείτε το πλάνο.',
  'join.member.title': 'Συμμετέχετε ήδη σε αυτό το ταξίδι',
  'join.needsWorkspace.title':
    'Αυτό το ταξίδι ανήκει σε χώρο εργασίας στον οποίο δεν συμμετέχετε',
  'join.needsWorkspace.body':
    'Ζητήστε πρώτα από τον χρήστη {inviter} να σας προσθέσει στον χώρο εργασίας και μετά ανοίξτε ξανά αυτόν τον σύνδεσμο.',
  'join.needsWorkspace.signedInAs':
    'Έχετε συνδεθεί ως {email}. Πείτε στον χρήστη {inviter} να χρησιμοποιήσει αυτή τη διεύθυνση.',
  'join.needsWorkspace.acceptFirst':
    'Αν έχετε ήδη email με πρόσκληση σε χώρο εργασίας, αποδεχτείτε την πρώτα και μετά ανοίξτε ξανά αυτόν τον σύνδεσμο.',
  'join.needsWorkspace.otherAccount': 'Σύνδεση με άλλον λογαριασμό',
  'join.unavailable.title': 'Αυτός ο σύνδεσμος πρόσκλησης δεν είναι διαθέσιμος',
  'join.unavailable.body':
    'Ο σύνδεσμος μπορεί να έχει αντικατασταθεί ή απενεργοποιηθεί. Ζητήστε νέο από όποιον σας τον έστειλε.',
  'join.unavailable.signIn': 'Σύνδεση',
  'join.unavailable.trips': 'Μετάβαση στα ταξίδια σας',
  'join.error.title':
    'Δεν ήταν δυνατή η φόρτωση αυτού του συνδέσμου πρόσκλησης',
  'join.error.retry': 'Δοκιμάστε ξανά',
  'join.error.busy':
    'Η σελίδα είναι απασχολημένη. Δοκιμάστε ξανά σε ένα λεπτό.',
  'join.error.join':
    'Δεν ήταν δυνατή η συμμετοχή. Ο σύνδεσμος εξακολουθεί να λειτουργεί, δοκιμάστε ξανά.',
  'join.error.switch':
    'Δεν ήταν δυνατή η αλλαγή χώρου εργασίας. Δοκιμάστε ξανά.',

  'invite.title': 'Σύνδεσμος πρόσκλησης',
  'invite.description':
    'Όποιος ανοίξει τον σύνδεσμο από αυτόν τον χώρο εργασίας συμμετέχει στο ταξίδι.',
  'invite.empty.title': 'Δεν υπάρχει ακόμη σύνδεσμος',
  'invite.empty.body':
    'Δημιουργήστε έναν σύνδεσμο και στείλτε τον στην ομαδική συνομιλία για να συμμετέχουν μέλη αυτού του χώρου.',
  'invite.action.create': 'Δημιουργία συνδέσμου',
  'invite.link.label': 'Σύνδεσμος πρόσκλησης',
  'invite.copy': 'Αντιγραφή συνδέσμου',
  'invite.copied': 'Ο σύνδεσμος αντιγράφηκε',
  'invite.copyFailed':
    'Η αντιγραφή απέτυχε. Επιλέξτε τον σύνδεσμο και αντιγράψτε τον χειροκίνητα.',
  'invite.switch.label':
    'Όλοι σε αυτόν τον χώρο με τον σύνδεσμο μπορούν να συμμετέχουν',
  'invite.switch.onHint':
    'Η απενεργοποίηση ακυρώνει τον σύνδεσμο για όλους, ακόμη και τα αντίγραφα που έχουν σταλεί.',
  'invite.switch.offHint':
    'Η ενεργοποίηση δημιουργεί νέο σύνδεσμο. Οι προηγούμενοι παραμένουν άκυροι.',
  'invite.off.body':
    'Ο σύνδεσμος είναι ανενεργός. Κανείς δεν μπορεί να συμμετάσχει με αυτόν.',
  'invite.uses': {
    one: 'Συμμετοχές μέσω αυτού του συνδέσμου: {count}',
    other: 'Συμμετοχές μέσω αυτού του συνδέσμου: {count}',
  },
  'invite.uses.never':
    'Κανείς δεν έχει συμμετάσχει ακόμη μέσω αυτού του συνδέσμου.',
  'invite.lastUsed': 'Τελευταία συμμετοχή: {when}',
  'invite.role.upgrade.title': 'Να δοθεί δικαίωμα επεξεργασίας;',
  'invite.role.upgrade.body':
    'Ισχύει για όλα τα αντίγραφα που έχουν σταλεί και για όσους συμμετέχουν από εδώ και πέρα.',
  'invite.role.upgrade.confirm': 'Δικαίωμα επεξεργασίας',
  'invite.replace.action': 'Αντικατάσταση συνδέσμου',
  'invite.replace.title': 'Αντικατάσταση αυτού του συνδέσμου;',
  'invite.replace.body':
    'Ο παλιός σύνδεσμος θα ακυρωθεί αμέσως για όλους. Όσοι συμμετέχουν ήδη παραμένουν στο ταξίδι· αφαιρέστε τους από την παρακάτω λίστα αν χρειάζεται.',
  'invite.replace.deadBody':
    'Ο παλιός σύνδεσμος δεν λειτουργεί πλέον. Όσοι συμμετέχουν ήδη παραμένουν στο ταξίδι.',
  'invite.replace.confirm': 'Αντικατάσταση συνδέσμου',
  'invite.replace.pending': 'Αντικατάσταση σε εξέλιξη',
  'invite.stale': 'Αυτός ο σύνδεσμος δεν λειτουργεί πλέον. Αντικαταστήστε τον.',
  'invite.creatorGone':
    'Ο σύνδεσμος δεν λειτουργεί γιατί ο δημιουργός του δεν είναι πλέον ιδιοκτήτης. Αντικαταστήστε τον.',
  'invite.archived':
    'Το ταξίδι είναι αρχειοθετημένο. Ο σύνδεσμος θα λειτουργήσει ξανά όταν αποκατασταθεί.',
  'invite.announce.created': 'Ο σύνδεσμος πρόσκλησης δημιουργήθηκε',
  'invite.announce.roleEditor':
    'Οι νέοι συμμετέχοντες θα μπορούν να επεξεργάζονται',
  'invite.announce.off': 'Ο σύνδεσμος πρόσκλησης απενεργοποιήθηκε',
  'invite.announce.newLink':
    'Ο νέος σύνδεσμος είναι έτοιμος. Αντιγράψτε και στείλτε τον ξανά.',
  'invite.announce.roleViewer':
    'Οι νέοι συμμετέχοντες θα έχουν δικαίωμα προβολής',
  'invite.error.title': 'Ο σύνδεσμος δεν φορτώθηκε',
  'invite.error.retry': 'Δοκιμάστε ξανά',
  'invite.refusal.archived': 'Το ταξίδι είναι αρχειοθετημένο.',
  'invite.refusal.notOwner':
    'Μόνο ιδιοκτήτης του ταξιδιού μπορεί να αλλάξει τον σύνδεσμο.',
  'invite.refusal.changed':
    'Κάποιος άλλαξε τον σύνδεσμο. Εμφανίζεται ο τρέχων.',
  'invite.announce.recovered':
    'Εμφανίζονται οι τρέχουσες ρυθμίσεις του συνδέσμου. Ελέγξτε τις πριν από άλλη αλλαγή.',
} satisfies TranslationOf<typeof En>

export default messages
