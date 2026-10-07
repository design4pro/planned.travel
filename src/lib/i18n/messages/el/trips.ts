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
    'Οι ιδέες είναι μέρη που περιμένουν ημέρα. Η σημείωση ανήκει στην ημέρα για την οποία γράφτηκε.',
  'plan.move.refused.notInAnotherDay': 'Η σημείωση μένει στη δική της ημέρα',
  'plan.move.refused.notInAnotherDayBody':
    'Οι σημειώσεις δεν μετακινούνται ακόμη μεταξύ ημερών. Επεξεργαστείτε τη σημείωση ή γράψτε την στην άλλη ημέρα.',
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
  'plan.move.spoken.notInAnotherDay':
    'Το {name} δεν μετακινήθηκε. Η σημείωση μένει στη δική της ημέρα.',
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
} satisfies TranslationOf<typeof En>

export default messages
