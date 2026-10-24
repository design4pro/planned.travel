/**
 * Everything the application shell says, in Greek.
 *
 * Made from `../en/shell.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` stores a
 * notification as `titleKey` + `bodyKey` + a `params` record, never as a
 * rendered sentence, so the `notification.*` pairs below are what a row written
 * a year ago resolves against today. A reader's own text — a chat preview, a
 * poll question — is set in Greek quotation marks, which is the only thing a
 * translator can do to a message that is nothing but a placeholder.
 *
 * **Numbers.** §8's rule holds: `count` selects the plural branch and is never
 * printed. A figure a reader sees arrives as its own placeholder, already
 * grouped for `el` by `src/lib/format.ts`.
 */

import type En from '../en/shell'
import type { TranslationOf } from '../../types'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Βασικές ενότητες',
  'nav.mobile': 'Ενότητες',
  'nav.dashboardLink': 'Πίνακας του planned.travel',
  'nav.homeLink': 'Αρχική του planned.travel',
  'nav.newTrip': 'Νέο ταξίδι',

  'nav.trips': 'Τα ταξίδια μου',
  'nav.trips.short': 'Ταξίδια',
  'nav.vacay': 'Άδειες',
  'nav.vacay.short': 'Άδειες',
  'nav.atlas': 'Άτλαντας',
  'nav.atlas.short': 'Άτλας',
  'nav.journey': 'Χρονικό',
  'nav.journey.short': 'Χρονικό',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Ενότητες ταξιδιού',
  'trip.nav.back': 'Ταξίδια',
  'trip.nav.share': 'Κοινή χρήση',
  'trip.nav.shareLabel': 'Κοινή χρήση αυτού του ταξιδιού',
  'trip.tab.plan': 'Πρόγραμμα',
  'trip.tab.transports': 'Μετακινήσεις',
  'trip.tab.book': 'Κρατήσεις',
  'trip.tab.lists': 'Λίστες',
  'trip.tab.costs': 'Κόστη',
  'trip.tab.files': 'Αρχεία',
  'trip.tab.collab': 'Ομάδα',

  /* ------------------------------------------------------------ user menu */
  'account.menu': '{name}, μενού λογαριασμού',
  'account.settings': 'Ρυθμίσεις',
  'account.billing': 'Πλάνο και χρεώσεις',
  'account.admin': 'Διαχείριση',
  'account.signOut': 'Αποσύνδεση',
  'account.signingOut': 'Αποσυνδέεστε…',
  'account.signOutFailed': 'Δεν μπορέσαμε να σας αποσυνδέσουμε',
  'account.signOutFailedBody': 'Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Χώρος εργασίας',
  'workspace.switched': 'Έγινε μετάβαση στον χώρο {name}',
  'workspace.switchFailed': 'Δεν μπορέσαμε να αλλάξουμε χώρο εργασίας',
  'workspace.switchFailedBody': 'Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
  'workspace.switchUnconfirmedBody':
    'Δεν ήταν δυνατή η επιβεβαίωση του ενεργού χώρου εργασίας. Φορτώστε ξανά τη σελίδα πριν συνεχίσετε.',
  'workspace.switchRateLimitedBody':
    'Έγιναν πάρα πολλές αλλαγές χώρου εργασίας. Περιμένετε λίγο και δοκιμάστε ξανά.',
  'workspace.create': 'Δημιουργία χώρου εργασίας',
  'workspace.createTitle': 'Δημιουργία νέου χώρου εργασίας',
  'workspace.createDescription':
    'Ένας ξεχωριστός χώρος με δικά του ταξίδια, μέρη και άτομα. Ξεκινά στο πρόγραμμα Δωρεάν και δεν μοιράζεται το πρόγραμμα του χώρου εργασίας στον οποίο βρίσκεστε.',
  'workspace.createPermanent':
    'Στο planned.travel δεν υπάρχει ακόμη επιλογή διαγραφής ενός χώρου εργασίας. Κάθε χώρος εργασίας που δημιουργείτε ή στον οποίο εντάσσεστε προσμετράται στο όριο: όταν ανήκετε σε {limit} χώρους εργασίας, δεν μπορείτε να δημιουργήσετε άλλον.',
  'workspace.createName': 'Όνομα χώρου εργασίας',
  'workspace.createNameRequired': 'Εισαγάγετε ένα όνομα για τον χώρο εργασίας.',
  'workspace.createUpgrade':
    'Ο χώρος «{workspace}» είναι στο πρόγραμμα Δωρεάν και μόνο ένας χώρος εργασίας με επί πληρωμή πρόγραμμα μπορεί να δημιουργήσει άλλον. Αν κάποιος από τους άλλους χώρους εργασίας σας έχει επί πληρωμή πρόγραμμα, μεταβείτε σε αυτόν και δημιουργήστε από εκεί. Διαφορετικά, αναβαθμίστε τον χώρο «{workspace}».',
  'workspace.createLimitReached':
    'Ανήκετε σε όσους χώρους εργασίας επιτρέπει το όριο, επομένως δεν μπορείτε να δημιουργήσετε άλλον.',
  'workspace.createRoleRequired':
    'Μόνο ένας διαχειριστής του χώρου εργασίας μπορεί να δημιουργήσει χώρο εργασίας. Ζητήστε το από έναν διαχειριστή αυτού του χώρου ή μεταβείτε σε χώρο που διαχειρίζεστε.',
  'workspace.createFailed': 'Δεν μπορέσαμε να δημιουργήσουμε τον χώρο εργασίας',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Εμφάνιση',
  'theme.light': 'Φωτεινό',
  'theme.dark': 'Σκούρο',
  'theme.system': 'Όπως η συσκευή',
  'theme.state.light': 'φωτεινό',
  'theme.state.dark': 'σκούρο',
  'theme.state.system': 'όπως η συσκευή',
  'theme.trigger': 'Θέμα: {state}. Αλλαγή θέματος',
  'language.trigger': 'Γλώσσα: {language}. Αλλαγή γλώσσας',
  'language.hint':
    'Αποθηκεύεται σε αυτή τη συσκευή. Μόλις συνδεθείτε, ισχύει η γλώσσα που έχετε ορίσει στον λογαριασμό σας· μπορείτε να την αλλάξετε στις Ρυθμίσεις.',
  'language.announce': 'Η γλώσσα άλλαξε σε {language}',
  'language.notApplied':
    'Αυτό το πρόγραμμα περιήγησης δεν κράτησε την επιλογή σας. Επιτρέψτε τα cookies για αυτόν τον ιστότοπο και επιλέξτε ξανά.',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Ειδοποιήσεις, καμία μη διαβασμένη',
  'bell.unread': {
    one: 'Ειδοποιήσεις, {unread} μη διαβασμένη',
    other: 'Ειδοποιήσεις, {unread} μη διαβασμένες',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Εισερχόμενα',
  'inbox.title': 'Ειδοποιήσεις',
  'inbox.error': 'Τα εισερχόμενά σας δεν φόρτωσαν',
  'inbox.allRead': 'Όλα διαβασμένα',
  'inbox.unread': {
    one: '{unread} μη διαβασμένο μήνυμα',
    other: '{unread} μη διαβασμένα μηνύματα',
  },
  'inbox.markAll': 'Σήμανση όλων ως διαβασμένων',
  'inbox.markingAll': 'Σημαίνονται όλα ως διαβασμένα',
  'inbox.cleared': 'Τα εισερχόμενα καθάρισαν',
  'inbox.markAllFailed': 'Δεν σημάνθηκαν όλα ως διαβασμένα',
  'inbox.retryHint': 'Ελέγξτε τη σύνδεσή σας και ξαναδοκιμάστε.',
  'inbox.filter.all': 'Όλα',
  'inbox.filter.unread': 'Μη διαβασμένα',
  'inbox.waiting': {
    one: '{invitations} πρόσκληση σε αναμονή',
    other: '{invitations} προσκλήσεις σε αναμονή',
  },
  'inbox.empty.title': 'Τα εισερχόμενά σας είναι άδεια',
  'inbox.empty.body':
    'Προσκλήσεις σε ταξίδια, αλλαγές προγράμματος, υπενθυμίσεις κρατήσεων και εξοφλημένα υπόλοιπα καταλήγουν όλα εδώ.',
  'inbox.empty.action': 'Πίσω στον πίνακα',
  'inbox.emptyUnread.title': 'Τίποτα μη διαβασμένο',
  'inbox.emptyUnread.body':
    'Τα έχετε διαβάσει όλα. Πηγαίνετε στα «Όλα» για να δείτε το ιστορικό.',
  'inbox.emptyUnread.action': 'Δείξε όλα',
  'inbox.row.new': 'Νέο',
  'inbox.row.accepted': 'Αποδεκτή',
  'inbox.row.declined': 'Απορρίφθηκε',
  'inbox.row.open': 'Άνοιγμα',
  'inbox.row.markRead': 'Διαβάστηκε',
  'inbox.row.markingRead': 'Σημαίνεται ως διαβασμένο',
  'inbox.row.markReadFailed': 'Δεν σημάνθηκε ως διαβασμένο',
  'inbox.preferences':
    'Διαλέξτε ποιες από αυτές φτάνουν στα εισερχόμενα, στο email και στο κινητό σας.',
  'inbox.preferencesAction': 'Ρυθμίσεις ειδοποιήσεων',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Σας προσκάλεσαν στο {tripTitle}',
  'notification.trip.invited.body': '{actorName} σας πρόσθεσε στο ταξίδι.',
  'notification.trip.updated.title': 'Το {tripTitle} ενημερώθηκε',
  'notification.trip.updated.body': '{actorName} άλλαξε το πρόγραμμα.',
  'notification.trip.member_added.title': '{memberName} μπήκε στο {tripTitle}',
  'notification.trip.member_added.body':
    'Βλέπει πλέον το πρόγραμμα, τις κρατήσεις και τα έξοδα.',
  'notification.trip.member_removed.title':
    '{memberName} έφυγε από το {tripTitle}',
  'notification.trip.member_removed.body':
    'Η πρόσβασή του στο ταξίδι σταμάτησε.',
  'notification.trip.starting_soon.title': {
    one: 'Το {tripTitle} ξεκινά σε {days} ημέρα',
    other: 'Το {tripTitle} ξεκινά σε {days} ημέρες',
  },
  'notification.trip.starting_soon.body':
    'Ώρα να δείτε τη λίστα αποσκευών και τις κρατήσεις.',
  'notification.trip.copied.title': 'Το {tripTitle} είναι έτοιμο',
  'notification.trip.copied.body': {
    one: 'Πέρασε {days} ημέρα',
    other: 'Πέρασαν {days} ημέρες',
  },
  'notification.trip.copied.places': {
    one: '{places} μέρος',
    other: '{places} μέρη',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} σημείωση παραλείφθηκε',
    other: '{dropped} σημειώσεις παραλείφθηκαν',
  },
  'notification.trip.copyFailed.title':
    'Το {tripTitle} δεν μπόρεσε να αντιγραφεί',
  'notification.trip.copyFailed.body':
    'Δεν χάθηκε τίποτα. Δοκιμάστε ξανά από το αρχικό.',
  'notification.reservation.reminder.title': 'Το {title} πλησιάζει',
  'notification.reservation.reminder.body':
    'Δείτε την ώρα και τον κωδικό επιβεβαίωσης πάνω στην κράτηση.',
  'notification.reservation.confirmed.title': 'Το {title} επιβεβαιώθηκε',
  'notification.reservation.confirmed.body':
    'Η κράτηση σημάνθηκε ως επιβεβαιωμένη στο {tripTitle}.',
  'notification.expense.added.title': '{actorName} πρόσθεσε ένα έξοδο',
  'notification.expense.added.body': '{title} στο {tripTitle}.',
  'notification.expense.settled.title': '{actorName} εξόφλησε',
  'notification.expense.settled.body': 'Το υπόλοιπο στο {tripTitle} πληρώθηκε.',
  'notification.list.assigned.title': '{actorName} σας ανέθεσε ένα στοιχείο',
  'notification.list.assigned.body': '{title} στο {tripTitle}.',
  'notification.collab.message.title': '{actorName} έγραψε στο {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'Άνοιξε ψηφοφορία στο {tripTitle}',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'Σας προσκάλεσαν στο {organizationName}',
  'notification.organization.invited.body':
    'Αποδεχτείτε για να μπείτε στον χώρο εργασίας και σε όσα μοιράζονται εκεί.',
  'notification.journey.published.title': 'Το {title} δημοσιεύτηκε',
  'notification.journey.published.body':
    'Όποιος έχει τον σύνδεσμο μπορεί τώρα να διαβάσει το χρονικό.',
  'notification.billing.plan_changed.title': 'Το πλάνο σας άλλαξε',
  'notification.billing.plan_changed.body':
    'Το {organizationName} είναι πλέον στο πλάνο {plan}.',
  'notification.billing.invoice_paid.title': 'Η πληρωμή ελήφθη',
  'notification.billing.invoice_paid.body':
    'Το τελευταίο τιμολόγιο για {organizationName} εξοφλήθηκε.',
  'notification.billing.payment_failed.title': 'Μια πληρωμή δεν ολοκληρώθηκε',
  'notification.billing.payment_failed.body':
    'Το {organizationName} έχει ληξιπρόθεσμη πληρωμή. Ενημερώστε τον τρόπο πληρωμής για να κρατήσετε το πλάνο.',
  'notification.fallback.title': 'Κάτι άλλαξε στον χώρο εργασίας σας',
  'notification.fallback.body': 'Ανοίξτε το ταξίδι για να δείτε τι ήταν.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Ο πίνακας δεν φόρτωσε',
  'dashboard.blank.title': 'Το επόμενο ταξίδι σας ξεκινά εδώ',
  'dashboard.blank.body':
    'Φτιάξτε ένα ταξίδι, βάλτε στον χάρτη τα μέρη που θέλετε να δείτε, και το planned.travel θα χτίσει γύρω τους το πρόγραμμα των ημερών.',
  'dashboard.blank.action': 'Σχεδιάστε ταξίδι',
  'dashboard.blank.secondary': 'Δείτε τον άτλαντά σας',

  'dashboard.upNext': 'Ακολουθεί',
  'dashboard.openPlan': 'Ανοίξτε το πρόγραμμα',
  'dashboard.hero.travellers': 'Ταξιδιώτες',
  'dashboard.hero.datesMissing': 'Βάλτε ημερομηνίες για να φτιαχτούν οι ημέρες',
  'dashboard.hero.startsIn': 'Ξεκινά σε',
  'dashboard.hero.started': 'Ξεκίνησε',
  'dashboard.hero.today': 'Σήμερα',
  'dashboard.hero.startUnknown': 'χωρίς ημερομηνία έναρξης',
  'dashboard.hero.startToday': 'καλό ταξίδι',
  'dashboard.hero.startPast': { one: 'ημέρα πριν', other: 'ημέρες πριν' },
  'dashboard.hero.startFuture': { one: 'ημέρα', other: 'ημέρες' },
  'dashboard.hero.nights': 'Νύχτες',
  'dashboard.hero.companionsHint': 'σε αυτό το ταξίδι',
  'dashboard.hero.progress': 'Σε εξέλιξη',
  'dashboard.hero.places': 'Μέρη',
  'dashboard.hero.placesNone': 'τίποτα στον χάρτη ακόμη',
  'dashboard.hero.placesHint': 'στον χάρτη',

  'dashboard.stat.countries': 'Χώρες που επισκεφθήκατε',
  'dashboard.stat.countriesUnit': 'από {total}',
  'dashboard.stat.countriesNone':
    'Σημειώστε μια χώρα για να ξεκινήσει ο άτλαντάς σας',
  'dashboard.stat.visits': {
    one: '{visits} επίσκεψη',
    other: '{visits} επισκέψεις',
  },
  'dashboard.stat.trips': 'Σύνολο ταξιδιών',
  'dashboard.stat.tripsCaption':
    '{planning} σε σχεδιασμό · {booked} με κρατήσεις',
  'dashboard.stat.places': 'Μέρη στον χάρτη',
  'dashboard.stat.placesNone': 'Τίποτα στον χάρτη ακόμη',
  'dashboard.stat.placesAcross': {
    one: 'σε {trips} ταξίδι',
    other: 'σε {trips} ταξίδια',
  },
  'dashboard.stat.bookings': 'Επιβεβαιωμένες κρατήσεις',
  'dashboard.stat.bookingsNone': 'Καμία κράτηση σε ορίζοντα',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} κράτηση καθ’ οδόν',
    other: '{bookings} κρατήσεις καθ’ οδόν',
  },

  'dashboard.trips.label': 'Τα ταξίδια σας',
  'dashboard.trips.all': 'Όλα τα ταξίδια',
  'dashboard.trips.empty.title': 'Κανένα ταξίδι ακόμη',
  'dashboard.trips.empty.body':
    'Ό,τι σχεδιάζετε εμφανίζεται εδώ, με το νεότερο πρώτο.',
  'dashboard.trips.empty.action': 'Δημιουργήστε ταξίδι',

  'dashboard.bookings.label': 'Επόμενες κρατήσεις',
  'dashboard.bookings.empty.title': 'Καμία κράτηση ακόμη',
  'dashboard.bookings.empty.body':
    'Επιβεβαιωμένες διαμονές, τραπέζια και εισιτήρια εμφανίζονται εδώ όσο πλησιάζουν οι ημερομηνίες τους.',

  'dashboard.pipeline.label': 'Ροή ταξιδιών',
  'dashboard.pipeline.empty':
    'Τίποτα στη ροή. Το πρώτο σας ταξίδι θα τη χωρίσει κατά στάδιο.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} αγαπημένο',
    other: '{favourites} αγαπημένα',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} αρχειοθετημένο ταξίδι',
    other: '{archived} αρχειοθετημένα ταξίδια',
  },

  'dashboard.storage.label': 'Αποθηκευτικός χώρος',
  'dashboard.storage.count': '{used} από {limit}',
  'dashboard.storage.files': {
    one: '{files} αρχείο σε όλα τα ταξίδια, μαζί με φωτογραφίες και εισιτήρια.',
    other:
      '{files} αρχεία σε όλα τα ταξίδια, μαζί με φωτογραφίες και εισιτήρια.',
  },
  'dashboard.storage.more': 'Χρειάζεστε περισσότερο χώρο;',
  'dashboard.storage.plans': 'Δείτε τα πλάνα',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Αναφορά',
  'dashboard.widgets.choose': 'Επιλογή widget',
  'dashboard.widgets.description':
    'Τα widget που κρατάτε δίπλα στον πίνακά σας.',
  'dashboard.clock.label': 'Παγκόσμιο ρολόι',
  'dashboard.clock.add': 'Προσθήκη ζώνης ώρας',
  'dashboard.clock.search': 'Αναζήτηση πόλεων και περιοχών',
  'dashboard.clock.noMatches': 'Καμία ζώνη ώρας με αυτό το όνομα',
  'dashboard.clock.remove': 'Κατάργηση {zone}',
  'dashboard.clock.offset': '{offset} από τη δική σας ώρα',
  'dashboard.clock.here': 'Η δική σας ώρα',
  'dashboard.clock.empty.title': 'Καμία καρφιτσωμένη ζώνη ώρας',
  'dashboard.clock.empty.body':
    'Καρφιτσώστε ένα μέρος και διαβάστε την ώρα του δίπλα στη δική σας.',
  'dashboard.clock.unknown.title': 'Αυτή η συσκευή δεν γνωρίζει τη ζώνη {zone}',
  'dashboard.clock.unknown.body':
    'Η ώρα της δεν μπορεί να διαβαστεί εδώ. Καταργήστε τη γραμμή για να το διορθώσετε.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Η κονσόλα διαχείρισης δεν φόρτωσε',
  'admin.denied.title': 'Μόνο οι διαχειριστές του χώρου εργασίας το ανοίγουν',
  'admin.denied.body':
    'Ζητήστε από ιδιοκτήτη ή διαχειριστή αυτού του χώρου να αλλάξει τον ρόλο σας, αν το χρειάζεστε.',
  'admin.denied.action': 'Πίσω στον πίνακα',
  'admin.eyebrow': 'Διαχείριση χώρου εργασίας',
  'admin.description': 'Πλάνο {plan} · δημιουργήθηκε {date}',
  'admin.createdUnknown': 'πρόσφατα',
  'admin.workspaceSettings': 'Ρυθμίσεις χώρου εργασίας',
  'admin.billing': 'Πλάνο και χρεώσεις',

  'admin.invitations.title': {
    one: '{invitations} πρόσκληση παραμένει ανοιχτή',
    other: '{invitations} προσκλήσεις παραμένουν ανοιχτές',
  },
  'admin.invitations.body':
    'Κάθε ανοιχτή πρόσκληση μετρά στις θέσεις που πληρώνει το πλάνο σας.',
  'admin.invitations.action': 'Δείτε τις προσκλήσεις',

  'admin.stat.members': 'Μέλη',
  'admin.stat.membersCaption': {
    one: '{invitations} πρόσκληση σε εκκρεμότητα',
    other: '{invitations} προσκλήσεις σε εκκρεμότητα',
  },
  'admin.stat.storage': 'Αποθηκευτικός χώρος',
  'admin.stat.storageUnit': 'από {limit}',
  'admin.stat.storageUnlimited': 'χωρίς όριο',
  'admin.stat.storageCaption': 'Αρχεία, φωτογραφίες και εξαγωγές',
  'admin.stat.audit': 'Καταχωρίσεις ελέγχου',
  'admin.stat.auditCaption': 'Η πιο πρόσφατη δραστηριότητα φαίνεται παρακάτω',
  'admin.stat.plan': 'Πλάνο',
  'admin.stat.planCaption':
    'Τα όρια επιβάλλονται στο επίπεδο του αποθετηρίου δεδομένων',

  'admin.quotas.label': 'Όρια',
  'admin.quotas.count': {
    one: '{metrics} μέτρηση',
    other: '{metrics} μετρήσεις',
  },
  'admin.quotas.unlimited': 'Χωρίς όριο',
  'admin.quotas.value': '{used} από {limit}',

  'admin.members.label': 'Μέλη',
  'admin.members.table': 'Μέλη αυτού του χώρου εργασίας',
  'admin.members.person': 'Πρόσωπο',
  'admin.members.role': 'Ρόλος',
  'admin.members.joined': 'Εντάχθηκε',
  'admin.members.role.label': 'Ρόλος: {name}',
  'admin.members.role.saved': 'Ο/Η {name} έχει τώρα τον ρόλο: {role}.',
  'admin.members.role.impersonated':
    'Ο ρόλος δεν μπορεί να αλλάξει όσο ενεργείτε ως άλλος λογαριασμός.',
  'admin.members.role.notPermitted':
    'Δεν μπορείτε να κάνετε αυτή την αλλαγή. Μόνο ένας κάτοχος μπορεί να δώσει τον ρόλο του κατόχου ή να αλλάξει έναν κάτοχο.',
  'admin.members.role.lastOwner':
    'Αυτός είναι ο μόνος κάτοχος του χώρου εργασίας. Ορίστε πρώτα άλλον κάτοχο.',
  'admin.members.role.notFound':
    'Αυτό το άτομο δεν ανήκει πια στον χώρο εργασίας. Η λίστα ανανεώθηκε.',
  'admin.members.role.failed': 'Ο ρόλος δεν άλλαξε. Δοκιμάστε ξανά.',
  'admin.members.role.promote.title': 'Να γίνει ο/η {name} κάτοχος;',
  'admin.members.role.promote.body':
    'Ο/Η {name} θα έχει την ίδια εξουσία με εσάς: χρέωση, μέλη και ρυθμίσεις. Ένας κάτοχος μπορεί να υποβιβάσει ή να αφαιρέσει οποιονδήποτε άλλον κάτοχο, και εσάς.',
  'admin.members.role.promote.confirm': 'Ορισμός κατόχου',
  'admin.members.role.promote.cancel': 'Ακύρωση',

  'admin.activity.label': 'Πρόσφατη δραστηριότητα',
  'admin.activity.empty.title': 'Τίποτα καταγεγραμμένο ακόμη',
  'admin.activity.empty.body':
    'Κάθε εγγραφή που μετράει προστίθεται στο ιστορικό ελέγχου καθώς συμβαίνει.',
  'admin.activity.workspace': 'ο χώρος εργασίας',
  'admin.actions.label': 'Πιο συχνές ενέργειες',
  'admin.actions.count': {
    one: '{actions} ενέργεια',
    other: '{actions} ενέργειες',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Πρόχειρο',
  'tripStatus.planning': 'Σε σχεδιασμό',
  'tripStatus.booked': 'Με κρατήσεις',
  'tripStatus.active': 'Ενεργό',
  'tripStatus.completed': 'Ολοκληρωμένο',
  'tripStatus.archived': 'Αρχειοθετημένο',

  'bookingStatus.none': 'Χωρίς κράτηση',
  'bookingStatus.pending': 'Εκκρεμεί',
  'bookingStatus.confirmed': 'Βεβαιωμένη',
  'bookingStatus.cancelled': 'Ακυρωμένη',
  'bookingStatus.completed': 'Έγινε',

  'bookingType.accommodation': 'Διαμονή',
  'bookingType.restaurant': 'Τραπέζι',
  'bookingType.activity': 'Δραστηριότητα',
  'bookingType.tour': 'Περιήγηση',
  'bookingType.ticket': 'Εισιτήριο',
  'bookingType.transport': 'Μετακίνηση',
  'bookingType.other': 'Κράτηση',

  'role.owner': 'Ιδιοκτήτης',
  'role.admin': 'Διαχειριστής',
  'role.member': 'Μέλος',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} ταξίδι',
    other: '{value} ταξίδια',
  },
  'trips.count.favourites': {
    one: '{value} αγαπημένο',
    other: '{value} αγαπημένα',
  },
  'trips.count.archived': {
    one: '{value} στο αρχείο',
    other: '{value} στο αρχείο',
  },
  'trips.atLimit.body':
    'Το πρόγραμμά σου καλύπτει {trips}. Αρχειοθέτησε ένα που τελείωσες ή ανέβα πρόγραμμα για να κρατάς περισσότερα ανοιχτά μαζί.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Νέο ημερολόγιο',
  'newJourney.title': 'Ξεκίνα ένα ημερολόγιο',
  'newJourney.description':
    'Το ημερολόγιο είναι η γραμμένη πλευρά ενός ταξιδιού — καταχωρίσεις με σειρά ημερομηνίας, με τις φωτογραφίες και τον καιρό που θυμάσαι.',
  'newJourney.titlePlaceholder': 'Δύο εβδομάδες στο Κιότο',
  'newJourney.subtitle': 'Υπότιτλος',
  'newJourney.subtitleHint': 'Μια γραμμή κάτω από τον τίτλο, στο εξώφυλλο.',
  'newJourney.subtitlePlaceholder': 'Ναοί, τρένα και πολύ περισσότερο matcha',
  'newJourney.trip': 'Με βάση ένα ταξίδι',
  'newJourney.tripHint': 'Προαιρετικό — δένει την ιστορία με το πρόγραμμά της.',
  'newJourney.tripNone': 'Χωρίς σύνδεση με ταξίδι',
  'newJourney.datesError': 'Η ημερομηνία λήξης είναι πριν την έναρξη.',
  'newJourney.submit': 'Δημιουργία ημερολογίου',
  'newJourney.creating': 'Δημιουργείται το ημερολόγιο',
  'newJourney.created': 'Το ημερολόγιο ξεκίνησε',
  'newJourney.createdBody':
    'Πρόσθεσε την πρώτη καταχώριση για να ξεκινήσει η ιστορία.',
  'newJourney.error': 'Το ημερολόγιο δεν δημιουργήθηκε. Δοκίμασε ξανά σε λίγο.',
  'newCollection.trigger': 'Νέα συλλογή',
  'newCollection.title': 'Ξεκίνα μια συλλογή',
  'newCollection.description':
    'Ένας τόπος για τα μέρη που βρίσκεις πριν ξέρεις σε ποιο ταξίδι ανήκουν.',
  'newCollection.namePlaceholder': 'Καφές που αξίζει να διασχίσεις την πόλη',
  'newCollection.descriptionHint': 'Τι ανήκει εδώ και τι όχι.',
  'newCollection.submit': 'Δημιουργία συλλογής',
  'newCollection.creating': 'Δημιουργείται η συλλογή',
  'newCollection.created': 'Η συλλογή δημιουργήθηκε',
  'newCollection.createdBody': 'Ξεκίνα να αποθηκεύεις μέρη σε αυτήν.',
  'newCollection.error': 'Η συλλογή δεν δημιουργήθηκε. Δοκίμασε ξανά σε λίγο.',

  'newTrip.title': 'Ξεκίνα ένα νέο ταξίδι',
  'newTrip.description':
    'Ένας τίτλος αρκεί. Οι ημερομηνίες φτιάχνουν το πρόγραμμα μέρα με μέρα, και τα υπόλοιπα περιμένουν ώσπου να τα ξέρεις.',
  'newTrip.name': 'Όνομα ταξιδιού',
  'newTrip.namePlaceholder': 'Κιότο στην εποχή των κερασιών',
  'newTrip.destination': 'Προορισμός',
  'newTrip.destinationHint': 'Μια πόλη, μια περιοχή ή όλη η διαδρομή.',
  'newTrip.destinationPlaceholder': 'Κιότο, Ιαπωνία',
  'newTrip.departure': 'Αναχώρηση',
  'newTrip.return': 'Επιστροφή',
  'newTrip.returnError': 'Η ημερομηνία επιστροφής είναι πριν την αναχώρηση.',
  'newTrip.currency': 'Νόμισμα προϋπολογισμού',
  'newTrip.currencyHint': 'Σε αυτό αθροίζεται κάθε έξοδο του ταξιδιού.',
  'newTrip.currencySearch': 'Αναζήτηση με κωδικό ή όνομα',
  'newTrip.currencyEmpty': 'Κανένα νόμισμα δεν ταιριάζει.',
  'newTrip.currencyFavourites': 'Αγαπημένα',
  'newTrip.currencyAll': 'Όλα τα νομίσματα',
  'newTrip.summary': 'Περίληψη',
  'newTrip.summaryPlaceholder': 'Δύο εβδομάδες με ναούς, τρένα και ράμεν.',
  'newTrip.duration': 'Διάρκεια σε ημέρες',
  'newTrip.durationHint':
    'Χωρίς ημερομηνίες, το ταξίδι ξεκινά με τόσες ημέρες χωρίς ημερομηνία.',
  'newTrip.durationDerived': 'Υπολογίζεται από τις δύο ημερομηνίες.',
  'newTrip.reminder': 'Υπενθύμιση πριν από την αναχώρηση',
  'newTrip.reminderNone': 'Καμία',
  'newTrip.reminderBefore': {
    one: '{count} ημέρα πριν',
    other: '{count} ημέρες πριν',
  },
  'newTrip.reminderCustom': 'Προσαρμοσμένη',
  'newTrip.reminderCustomDays': 'Ημέρες πριν από την αναχώρηση',
  'newTrip.reminderOn': 'Υπενθύμιση στις {date}',
  'newTrip.reminderNoDeparture':
    'Διάλεξε ημερομηνία αναχώρησης για να δεις την ημέρα.',
  'newTrip.submit': 'Δημιουργία ταξιδιού',
  'newTrip.creating': 'Δημιουργείται το ταξίδι',
  'newTrip.error': 'Το ταξίδι δεν δημιουργήθηκε. Δοκίμασε ξανά σε λίγο.',
  'newTrip.created': 'Το ταξίδι δημιουργήθηκε',
  'newTrip.createdBody': 'Ξεκίνα να βάζεις μέρη στον χάρτη.',
  'newTrip.coverChoose': 'Προσθήκη εικόνας εξωφύλλου',
  'newTrip.coverChange': 'Αλλαγή εικόνας εξωφύλλου',
  'newTrip.coverHint':
    'Σύρε εδώ μια εικόνα, επικόλλησέ την ή επίλεξε αρχείο. PNG, JPEG, WebP, AVIF ή GIF.',
  'newTrip.coverChosen': 'Εικόνα εξωφύλλου: {name}',
  'newTrip.coverRemove': 'Αφαίρεση εικόνας εξωφύλλου',
  'newTrip.coverTypeError':
    'Το «{name}» δεν μπορεί να γίνει εικόνα εξωφύλλου. Επίλεξε PNG, JPEG, WebP, AVIF ή GIF.',
  'newTrip.coverSizeError':
    'Το «{name}» είναι μεγαλύτερο από {max}. Επίλεξε μικρότερη εικόνα.',
  'newTrip.coverUploading': 'Μεταφόρτωση της εικόνας εξωφύλλου',
  'newTrip.coverFailedTitle': 'Η εικόνα εξωφύλλου δεν προστέθηκε',
  'newTrip.coverFailed':
    'Το ταξίδι δημιουργήθηκε, αλλά το «{name}» δεν μεταφορτώθηκε ως εξώφυλλο.',
  'newTrip.coverRetry': 'Δοκίμασε ξανά',
  'newTrip.coverContinue': 'Άνοιγμα του ταξιδιού χωρίς εξώφυλλο',
  'newTrip.people': 'Άτομα',
  'newTrip.peopleHint':
    'Προστίθενται μόλις δημιουργηθεί το ταξίδι. Παραμένεις ο ιδιοκτήτης του.',
  'newTrip.peoplePlaceholder': 'Επίλεξε από τον χώρο εργασίας σου',
  'newTrip.peopleSearch': 'Αναζήτηση με όνομα',
  'newTrip.peopleLoading': 'Φόρτωση των ατόμων του χώρου εργασίας σου',
  'newTrip.peopleLoadError':
    'Δεν φορτώθηκαν τα άτομα του χώρου εργασίας σου. Δημιούργησε το ταξίδι και πρόσθεσέ τα από την οθόνη Άτομα του.',
  'newTrip.peopleNone':
    'Προς το παρόν είσαι το μόνο άτομο σε αυτόν τον χώρο εργασίας.',
  'newTrip.peopleNoneMember':
    'Ο ιδιοκτήτης ή ένας διαχειριστής του χώρου εργασίας μπορεί να προσκαλέσει κι άλλα άτομα.',
  'newTrip.peopleInvite': 'Πρόσκληση ατόμων στον χώρο εργασίας',
  'newTrip.peopleChosen': 'Επιλεγμένα άτομα και οι ρόλοι τους',
  'newTrip.peopleFailedTitle':
    'Το ταξίδι δημιουργήθηκε, αλλά δεν προστέθηκαν όλοι',
  'newTrip.noticeBothTitle':
    'Το ταξίδι δημιουργήθηκε, αλλά δεν προστέθηκαν όλα',
  'newTrip.peopleNotInWorkspace':
    'Το άτομο {name} δεν ανήκει πια σε αυτόν τον χώρο εργασίας, γι’ αυτό δεν προστέθηκε.',
  'newTrip.peopleAlreadyOn': 'Το άτομο {name} ήταν ήδη σε αυτό το ταξίδι.',
  'newTrip.peopleUnconfirmed':
    'Δεν επιβεβαιώθηκε η προσθήκη του ατόμου {name}. Έλεγξε στην οθόνη Άτομα αν προστέθηκε.',
  'newTrip.peopleContinue': 'Συνέχεια',
  'newTrip.peopleRetry': 'Δοκίμασε ξανά',
  'newTrip.coverRetryOnly': 'Δοκίμασε ξανά το εξώφυλλο',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Ενέργειες για {title}',
  'tripActions.copy': 'Αντιγραφή',
  'tripActions.favourite': 'Προσθήκη στα αγαπημένα',
  'tripActions.unfavourite': 'Αφαίρεση από τα αγαπημένα',
  'tripActions.edit': 'Επεξεργασία',
  'tripActions.archive': 'Αρχειοθέτηση',
  'tripActions.restore': 'Επαναφορά',
  'tripActions.delete': 'Διαγραφή',
  'tripActions.deleteForGood': 'Οριστική διαγραφή',
  'tripActions.starFailed': 'Το αγαπημένο δεν αποθηκεύτηκε',
  'tripActions.starFallback': 'Το ταξίδι επανήλθε όπως ήταν.',
  'tripActions.archived': 'Το ταξίδι αρχειοθετήθηκε',
  'tripActions.archiveFailed': 'Το ταξίδι δεν αρχειοθετήθηκε',
  'tripActions.restored': 'Το ταξίδι επανήλθε',
  'tripActions.restoreFailed': 'Το ταξίδι δεν επανήλθε',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Επεξεργασία ταξιδιού',
  'editTrip.submit': 'Αποθήκευση αλλαγών',
  'editTrip.saving': 'Αποθήκευση ταξιδιού',
  'editTrip.cancel': 'Ακύρωση',
  'editTrip.saved': 'Το ταξίδι ενημερώθηκε',
  'editTrip.errorTitle': 'Αυτό δεν αποθηκεύτηκε',
  'editTrip.retry': 'Δοκιμάστε ξανά',
  'editTrip.error': 'Το ταξίδι δεν αποθηκεύτηκε. Δοκιμάστε ξανά σε λίγο.',
  'editTrip.coverFailed':
    'Το «{name}» δεν μεταφορτώθηκε ως εξώφυλλο. Τίποτε άλλο δεν έχει αποθηκευτεί ακόμη.',
  'editTrip.coverContinue': 'Αποθήκευση χωρίς το νέο εξώφυλλο',
  'editTrip.currencyLocked':
    'Αυτό το ταξίδι έχει ήδη τιμές, γι’ αυτό το νόμισμα προϋπολογισμού δεν μπορεί να αλλάξει εδώ. Χρησιμοποιήστε το «Αλλαγή νομίσματος προϋπολογισμού» στην καρτέλα Κόστη ή ορίστε ξανά {current} για να αποθηκευτούν οι υπόλοιπες αλλαγές σας.',
  'editTrip.currencyReadonly':
    'Το νόμισμα προϋπολογισμού αλλάζει από την καρτέλα Κόστη.',
  'editTrip.currencyLink': 'Άνοιγμα της καρτέλας Κόστη',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Οριστική διαγραφή του «{title}»;',
  'deleteTrip.description':
    'Δεν υπάρχει αναίρεση ούτε κάδος. Η αρχειοθέτηση βγάζει ένα ταξίδι από τη λίστα χωρίς να το χάσετε.',
  'deleteTrip.reading': 'Ανάγνωση του περιεχομένου αυτού του ταξιδιού',
  'deleteTrip.errorTitle': 'Αυτό δεν φορτώθηκε',
  'deleteTrip.summaryError':
    'Δεν ήταν δυνατή η ανάγνωση του περιεχομένου αυτού του ταξιδιού.',
  'deleteTrip.confirmLabel':
    'Πληκτρολογήστε το όνομα του ταξιδιού για επιβεβαίωση',
  'deleteTrip.deleting': 'Διαγραφή ταξιδιού',
  'deleteTrip.deleted': 'Το ταξίδι διαγράφηκε',
  'deleteTrip.failed': 'Το ταξίδι δεν διαγράφηκε',
  'deleteTrip.carried.reservations': {
    one: 'κράτηση',
    other: 'κρατήσεις',
  },
  'deleteTrip.carried.transports': {
    one: 'μετακίνηση',
    other: 'μετακινήσεις',
  },
  'deleteTrip.carried.expenses': {
    one: 'έξοδο',
    other: 'έξοδα',
  },
  'deleteTrip.carried.files': {
    one: 'αρχείο',
    other: 'αρχεία',
  },
  'deleteTrip.carried.members': {
    one: 'άτομο',
    other: 'άτομα',
  },
  'copyTrip.title': 'Αντιγραφή του «{title}»',
  'copyTrip.nameLabel': 'Όνομα του αντιγράφου',
  'copyTrip.titleRequired': 'Δώστε όνομα στο αντίγραφο.',
  'copyTrip.datesLabel': 'Ημερομηνίες',
  'copyTrip.datesTogether':
    'Ορίστε και τις δύο ημερομηνίες ή σβήστε τις και τις δύο.',
  'copyTrip.clearDates': 'Αντιγραφή χωρίς ημερομηνίες',
  'copyTrip.carries':
    'Οι ημέρες, τα μέρη και οι σημειώσεις περνούν. Οι κρατήσεις, τα χρήματα, τα αρχεία και τα άτομα όχι.',
  'copyTrip.shorter':
    'Αυτό είναι πιο σύντομο από το αρχικό. Τα μέρη των επιπλέον ημερών πάνε στις ιδέες και οι σημειώσεις τους χάνονται.',
  'copyTrip.submit': 'Αντιγραφή ταξιδιού',
  'copyTrip.copying': 'Αντιγραφή του ταξιδιού',
  'copyTrip.cancel': 'Ακύρωση',
  'copyTrip.started': 'Αντιγράφεται το «{title}»',
  'copyTrip.errorTitle': 'Αυτό δεν αντιγράφηκε',
  'copyTrip.error': 'Το ταξίδι δεν αντιγράφηκε. Δοκιμάστε ξανά σε λίγο.',

  'trips.error': 'Τα ταξίδια σου δεν φορτώθηκαν',
  'trips.eyebrow': 'Χώρος',
  'trips.nothingPlanned': 'Τίποτα σχεδιασμένο ακόμη',
  'trips.search': 'Αναζήτηση ταξιδιών',
  'trips.atLimit.title': 'Γέμισες κάθε ταξίδι που επιτρέπει το πρόγραμμά σου',
  'trips.atLimit.action': 'Σύγκριση προγραμμάτων',
  'trips.noMatch.title': 'Τίποτα δεν ταιριάζει σε αυτό το φίλτρο',
  'trips.noMatch.body':
    'Δοκίμασε άλλο στάδιο, καθάρισε την αναζήτηση ή δες στο αρχείο.',
  'trips.noMatch.action': 'Επαναφορά φίλτρων',
  'trips.empty.body':
    'Ένα ταξίδι κρατά το πρόγραμμα, τον χάρτη, τις κρατήσεις, τις λίστες και τα χρήματα. Ξεκίνα ένα και τα υπόλοιπα ακολουθούν.',
  'trips.next.title': 'Κάπου μετά',
  'trips.next.body':
    'Ξεκίνα ένα ταξίδι και το planned.travel φτιάχνει μία μέρα ανά ημερομηνία, έτοιμη για ό,τι έχεις αποθηκεύσει.',
  'trips.savedPlaces': 'Αποθηκευμένα μέρη',
  'trips.filter.all': 'Όλα',
  'trips.filter.favourites': 'Αγαπημένα',
  'trips.view.label': 'Διάταξη',
  'trips.view.grid': 'Πλέγμα',
  'trips.view.list': 'Λίστα',
  'trips.card.favourite': 'Αγαπημένο',
  'trips.card.noDestination': 'Προορισμός χωρίς ορισμό ακόμη',
  'trips.card.noDates': 'Ημερομηνίες χωρίς ορισμό',
  'trips.card.startsIn': 'σε {days} ημ',
  'trips.card.days': '{days} ημ',
  'trips.card.copying': 'Αντιγράφεται',
  'trips.card.copyingLabel': 'Το {title} αντιγράφεται ακόμη',
  'trips.card.copyingReason': 'Περιμένετε να ολοκληρωθεί η αντιγραφή.',
  'metric.trips': 'Ταξίδια',
  'metric.places': 'Μέρη',
  'metric.members': 'Μέλη',
  'metric.files': 'Αρχεία',
  'metric.storage_bytes': 'Χώρος',
  'metric.collections': 'Συλλογές',
  'metric.journeys': 'Χρονικά',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Αυτό δεν φόρτωσε',
  'error.body':
    'Τίποτα δεν χάθηκε. Δοκιμάστε ξανά, και αν συνεχίζει, στείλτε μας τη λεπτομέρεια παρακάτω.',
  'error.retry': 'Δοκιμάστε ξανά',
  'error.dashboard': 'Επιστροφή στον πίνακα',
  'error.reported': 'Ειδοποιηθήκαμε και το εξετάζουμε.',
  'error.reference': 'Κωδικός αναφοράς',
  'error.feedback.open': 'Πείτε μας τι συνέβη',
  'error.feedback.label': 'Τι κάνατε όταν συνέβη αυτό;',
  'error.feedback.send': 'Αποστολή',
  'error.feedback.sent': 'Ευχαριστούμε — μας βοηθάει.',
  'error.feedback.failed':
    'Δεν στάλθηκε. Ο κωδικός παραπάνω φτάνει ούτως ή άλλως σε εμάς.',
  'error.root': 'Βγήκαμε από τη διαδρομή',
  'error.session': 'Η πρόσβασή σας στον χώρο εργασίας άλλαξε',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Αναφορά προβλήματος',
  'feedback.formTitle': 'Αναφορά προβλήματος',
  'feedback.messageLabel': 'Τι δεν πάει καλά ή τι πρέπει να αλλάξει;',
  'feedback.messagePlaceholder': 'Τι περιμένατε και τι έγινε αντ’ αυτού;',
  'feedback.emailLabel': 'Διεύθυνση email',
  'feedback.emailPlaceholder': 'giorgos@example.com',
  'feedback.isRequiredLabel': '(υποχρεωτικό)',
  'feedback.submitButtonLabel': 'Αποστολή αναφοράς',
  'feedback.cancelButtonLabel': 'Άκυρο',
  'feedback.confirmButtonLabel': 'Επιβεβαίωση',
  'feedback.addScreenshotButtonLabel': 'Προσθήκη στιγμιότυπου',
  'feedback.removeScreenshotButtonLabel': 'Αφαίρεση στιγμιότυπου',
  'feedback.highlightToolText': 'Επισήμανση',
  'feedback.hideToolText': 'Απόκρυψη',
  'feedback.successMessageText': 'Ευχαριστούμε — λάβαμε την αναφορά σας.',
  'feedback.errorEmptyMessageText':
    'Γράψτε πρώτα μια πρόταση — μια κενή αναφορά δεν μας λέει τίποτα.',
  'feedback.errorTimeoutText':
    'Αργεί υπερβολικά και δεν μπορούμε να επιβεβαιώσουμε ότι η αναφορά στάλθηκε.',
  'feedback.errorForbiddenText':
    'Αυτή η σελίδα δεν επιτρέπεται να στέλνει αναφορές.',
  'feedback.errorGenericText':
    'Δεν στάλθηκε. Ελέγξτε τη σύνδεση και μήπως παρεμβαίνει κάποιο πρόγραμμα αποκλεισμού διαφημίσεων.',

  'notFound.eyebrow': 'Σφάλμα 404',
  'notFound.title': 'Αυτή η σελίδα δεν είναι στον χάρτη',
  'notFound.body':
    'Ο σύνδεσμος μπορεί να είναι παλιός, ή το ταξίδι στο οποίο έδειχνε μετακινήθηκε ή διαγράφηκε.',
  'notFound.trips': 'Όλα τα ταξίδια',
  'notFound.rootBody':
    'Ψάξαμε παντού πάνω στη διαδρομή. Η διεύθυνση μπορεί να έχει λάθος, ή η σελίδα να προχώρησε αλλού.',
  'notFound.home': 'Πίσω στην αρχική',
  'notFound.plans': 'Δείτε τα πλάνα μας',

  'session.noWorkspace':
    'Ο λογαριασμός σας δεν είναι ακόμη συνδεδεμένος με χώρο εργασίας. Αποσυνδεθείτε και μπείτε ξανά για να ολοκληρωθεί η ρύθμιση.',
  'session.membershipRemoved':
    'Η συμμετοχή σας σε αυτόν τον χώρο εργασίας καταργήθηκε.',
  'session.workspaceChanged':
    'Ο χώρος εργασίας άλλαξε σε άλλη καρτέλα ή παράθυρο. Δεν αποθηκεύτηκε τίποτα.',
  'session.workspaceChangedTitle': 'Ο χώρος εργασίας άλλαξε σε άλλη καρτέλα',
  'session.workspaceChangedBody':
    'Αυτή η καρτέλα εμφανίζει τον χώρο «{name}», αλλά ο χώρος εργασίας άλλαξε σε άλλη καρτέλα ή παράθυρο. Δεν αποθηκεύτηκε τίποτα.',
  'session.openCurrentWorkspace': 'Άνοιγμα του τρέχοντος χώρου εργασίας',
  'session.workspaceChangedDismiss': 'Όχι τώρα',
} satisfies TranslationOf<typeof En>

export default messages
