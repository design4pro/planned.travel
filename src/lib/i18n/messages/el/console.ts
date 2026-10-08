/**
 * Ό,τι λέει η κονσόλα της πλατφόρμας, στα ελληνικά.
 *
 * Γραμμένο από το `../en/console.ts` (`docs/SPEC.md` §9). Το αγγλικό αρχείο είναι το σχήμα: το
 * `TranslationOf<typeof En>` κάνει ένα κλειδί που λείπει ή που επινοήθηκε σφάλμα μεταγλώττισης, και
 * το `__tests__/parity.test.ts` ελέγχει τα σύμβολα, τους κλάδους πληθυντικού και ότι δεν έμεινε
 * τίποτα αγγλικό εδώ.
 *
 * **Πληθυντικός.** Το `Intl.PluralRules('el')` δίνει `one` και `other`.
 *
 * **Δύο κλίμακες ρόλων που δεν ανακατεύονται ποτέ** (§5). Στην πλατφόρμα: διαχειριστής,
 * επιμελητής, χρήστης. Στον χώρο εργασίας: ιδιοκτήτης, διαχειριστής, μέλος. Η ίδια λέξη πέφτει και
 * στις δύο, οπότε τη διαφορά τη σηκώνει η πρόταση γύρω της.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------ ενότητες -- */

  'nav.label': 'Ενότητες της κονσόλας',
  'nav.overview': 'Επισκόπηση',
  'nav.overview.description': 'Η πλατφόρμα με μια ματιά',
  'nav.accounts': 'Λογαριασμοί',
  'nav.accounts.description': 'Ρόλοι, αναστολές και συνεδρίες',
  'nav.runs': 'Εκτελέσεις πρακτόρων',
  'nav.runs.description': 'Τι χτίζει ο στόλος sandcastle',

  /* -------------------------------------------------------------- κέλυφος -- */

  'shell.eyebrow': 'Πλατφόρμα',
  'shell.title': 'Κονσόλα',
  'shell.description':
    'Το ίδιο το προϊόν — λογαριασμοί, εξουσίες και ο κοινός κατάλογος',
  'shell.signedInAs': 'Συνδεδεμένος ως',
  'shell.error.title': 'Η κονσόλα δεν φόρτωσε',
  'shell.notFound.title': 'Δεν υπάρχει τέτοιος λογαριασμός',
  'shell.notFound.body':
    'Τίποτα στην πλατφόρμα δεν φέρει αυτό το αναγνωριστικό. Ο λογαριασμός μπορεί να διαγράφηκε αφότου φτιάχτηκε ο σύνδεσμος, ή η διεύθυνση γράφτηκε λάθος.',
  'shell.allAccounts': 'Όλοι οι λογαριασμοί',
  'shell.overview': 'Επισκόπηση της κονσόλας',

  'failure.fallback': 'Η ενέργεια δεν πέρασε. Δοκιμάστε ξανά σε λίγο.',

  /* ---------------------------------------------------------- επισκόπηση -- */

  'overview.error.title': 'Η επισκόπηση δεν φόρτωσε',
  'overview.standing.title': 'Οι εξουσίες σας στην πλατφόρμα',
  'overview.standing.body':
    'Οι λογαριασμοί, οι συνεδρίες και το να ενεργείτε στο όνομα κάποιου άλλου ανήκουν σε διαχειριστή της πλατφόρμας, οπότε η κονσόλα σάς δείχνει τον κατάλογο και τίποτε άλλο.',
  'overview.stat.accounts': 'Λογαριασμοί',
  'overview.stat.accounts.caption': {
    one: 'Ένας από αυτούς φέρει ρόλο πλατφόρμας',
    other: '{staff} από αυτούς φέρουν ρόλο πλατφόρμας',
  },
  'overview.stat.admins': 'Διαχειριστές',
  'overview.stat.admins.caption':
    'Πλήρης εξουσία πάνω σε λογαριασμούς και συνεδρίες',
  'overview.stat.curators': 'Επιμελητές',
  'overview.stat.curators.caption': 'Μόνο ο κατάλογος — ποτέ οι λογαριασμοί',
  'overview.stat.suspended': 'Σε αναστολή',
  'overview.stat.suspended.none': 'Κανείς δεν είναι κλειδωμένος έξω',
  'overview.stat.suspended.some':
    'Αποσυνδεδεμένοι παντού ώσπου να αρθεί μια αναστολή',
  'overview.stat.suspended.review': 'Δείτε τους',
  'overview.newest.label': 'Νεότεροι λογαριασμοί',
  'overview.newest.empty.title': 'Δεν υπάρχουν ακόμη λογαριασμοί',
  'overview.newest.empty.body': 'Ο πρώτος που θα εγγραφεί εμφανίζεται εδώ.',
  'overview.catalogue.label': 'Κατάλογος κατά κατάσταση',
  'overview.catalogue.empty.title': 'Ο κοινός κατάλογος δεν έχει ανοίξει ακόμη',
  'overview.catalogue.empty.body':
    'Μόλις στηθεί η γραμμή εισαγωγής, αυτός ο πίνακας θα μετρά κάθε τόπο του κοινού καταλόγου ως πρόχειρο, υπό έλεγχο ή δημοσιευμένο — και κάθε αριθμός θα ανοίγει τη λίστα πίσω του.',
  'overview.scraping.label': 'Εκτελέσεις συλλογής',
  'overview.scraping.empty.title': 'Καμία πηγή δεν έχει τρέξει',
  'overview.scraping.empty.body':
    'Οι πηγές συλλέγονται μία φορά την εβδομάδα. Όταν τελειώσει η πρώτη εκτέλεση, θα φαίνονται εδώ οι πέντε τελευταίες με ό,τι εισήγαγε, άλλαξε και απέρριψε η καθεμία.',

  /* ------------------------------------------------------ η κλίμακα ρόλων -- */

  'role.admin': 'Διαχειριστής',
  'role.admin.summary':
    'Πλήρης εξουσία στην πλατφόρμα: λογαριασμοί, ρόλοι, αναστολές, συνεδρίες και ενέργεια στο όνομα άλλου.',
  'role.admin.holds.accounts':
    'Δημιουργία λογαριασμών και ορισμός ρόλων πλατφόρμας',
  'role.admin.holds.bans': 'Αναστολή λογαριασμών και άρση αναστολών',
  'role.admin.holds.sessions': 'Ανάκληση συνεδριών και ορισμός κωδικών',
  'role.admin.holds.impersonate':
    'Ενέργεια στο όνομα λογαριασμού για δεκαπέντε λεπτά',
  'role.admin.holds.curation': 'Ό,τι μπορεί να κάνει ένας επιμελητής',
  'role.admin.withheld.admins':
    'Ενέργεια στο όνομα άλλου διαχειριστή της πλατφόρμας',
  'role.curator': 'Επιμελητής',
  'role.curator.summary':
    'Ο κατάλογος, οι συλλογές, οι πηγές και η εποπτεία των κοινόχρηστων συνδέσμων. Τίποτα που αγγίζει λογαριασμούς.',
  'role.curator.holds.places':
    'Ανάγνωση, εγγραφή και δημοσίευση τόπων του καταλόγου',
  'role.curator.holds.packs': 'Ανάγνωση, εγγραφή και δημοσίευση συλλογών τόπων',
  'role.curator.holds.sources': 'Ανάγνωση και εκτέλεση πηγών του καταλόγου',
  'role.curator.holds.shares': 'Έλεγχος και ανάκληση κοινόχρηστων συνδέσμων',
  'role.curator.withheld.accounts': 'Οτιδήποτε αγγίζει λογαριασμό ή συνεδρία',
  'role.curator.withheld.tokens': 'Έκδοση ή ανάκληση διαπιστευτηρίων μηχανής',
  'role.user': 'Χρήστης',
  'role.user.summary':
    'Καμία εξουσία στην πλατφόρμα. Αυτό ισχύει σχεδόν για όλους.',
  'role.user.withheld.everything':
    'Κάθε εξουσία της πλατφόρμας, χωρίς εξαίρεση',

  /* ---------------------------------------------------- ένας λογαριασμός -- */

  'identity.you': 'Αυτός είστε εσείς',
  'status.active': 'Ενεργός',
  'status.suspended': 'Σε αναστολή',
  'status.permanent': 'Χωρίς λήξη',
  'status.until': 'Έως {date}',
  'status.unverified': 'Χωρίς επιβεβαίωση',
  'device.on': '{browser} σε {platform}',
  'device.unrecognised': 'Άγνωστη συσκευή',

  /* -------------------------------------------------- λίστα λογαριασμών -- */

  'users.error.title': 'Η λίστα λογαριασμών δεν φόρτωσε',
  'users.total': '{total} συνολικά',
  'users.loading': 'Φόρτωση λογαριασμών',
  'users.table.label': 'Λογαριασμοί της πλατφόρμας',
  'users.search.label': 'Αναζήτηση λογαριασμών',
  'users.search.email': 'Αναζήτηση στις διευθύνσεις email',
  'users.search.name': 'Αναζήτηση στα ονόματα',
  'users.search.column': 'Σε ποια στήλη να γίνει η αναζήτηση',
  'users.search.submit': 'Αναζήτηση',
  'users.field.email': 'Διεύθυνση email',
  'users.field.name': 'Όνομα',
  'users.filter.role.label': 'Φιλτράρισμα κατά ρόλο πλατφόρμας',
  'users.filter.role.any': 'Οποιοσδήποτε ρόλος',
  'users.filter.role.admin': 'Διαχειριστές',
  'users.filter.role.curator': 'Επιμελητές',
  'users.filter.status.label': 'Φιλτράρισμα κατά κατάσταση λογαριασμού',
  'users.filter.status.any': 'Οποιαδήποτε κατάσταση',
  'users.filter.hint': 'Στενέψτε κατά ρόλο ή κατά κατάσταση — ένα κάθε φορά.',
  'users.column.account': 'Λογαριασμός',
  'users.column.role': 'Ρόλος πλατφόρμας',
  'users.column.status': 'Κατάσταση',
  'users.column.joined': 'Εγγραφή',
  'users.column.actions': 'Ενέργειες',
  'users.joined': 'Εγγραφή στις {date}',
  'users.pastEnd.title': 'Αυτή η σελίδα είναι πέρα από το τέλος',
  'users.pastEnd.body': {
    one: 'Σε αυτή την προβολή υπάρχει ένας λογαριασμός, και η σελίδα 1 είναι η μόνη που έχει.',
    other:
      'Σε αυτή την προβολή υπάρχουν {total} λογαριασμοί, δηλαδή {pages}. Η σελίδα {page} είναι πιο πέρα.',
  },
  'users.pastEnd.pages': {
    one: 'μία μόνο σελίδα',
    other: '{pages} σελίδες',
  },
  'users.pastEnd.back': 'Πίσω στην πρώτη σελίδα',
  'users.empty.filtered.title': 'Τίποτα δεν ταιριάζει σε αυτά τα φίλτρα',
  'users.empty.filtered.body':
    'Κανένας λογαριασμός της πλατφόρμας δεν απαντά σε αυτή την αναζήτηση. Διευρύνετέ την, ή καθαρίστε τα φίλτρα για να τους δείτε όλους.',
  'users.empty.title': 'Δεν υπάρχουν λογαριασμοί να δείξουμε',
  'users.empty.body':
    'Αυτή η προβολή είναι άδεια. Τίποτα δεν είναι φιλτραρισμένο, οπότε δεν υπάρχει τίποτα να διευρυνθεί.',

  /* ------------------------------------------------ σελίδα λογαριασμού -- */

  'account.error.title': 'Αυτός ο λογαριασμός δεν φόρτωσε',
  'account.loading': 'Φόρτωση του λογαριασμού',
  'account.meta.lastChange': 'Τελευταία αλλαγή',
  'account.meta.id': 'Αναγνωριστικό λογαριασμού',
  'account.banned.title': 'Αυτός ο λογαριασμός είναι σε αναστολή',
  'account.banned.noReason': 'Δεν καταγράφηκε αιτία μαζί με την αναστολή.',
  'account.banned.permanent':
    ' Μένει σε ισχύ ώσπου να την άρει ένας διαχειριστής.',
  'account.banned.until': ' Αίρεται μόνη της στις {date}.',
  'account.banned.untilUnknown': 'την ημερομηνία λήξης της',
  'account.authority.label': 'Εξουσίες στην πλατφόρμα',
  'account.authority.may': 'Μπορεί',
  'account.authority.mayNot': 'Δεν μπορεί',
  'account.authority.none': 'Τίποτα στην πλατφόρμα.',
  'account.workspaces.label': 'Χώροι εργασίας',
  'account.workspaces.truncated':
    'Αυτός ο λογαριασμός ανήκει σε περισσότερους χώρους εργασίας από τους {listed} που απαριθμούνται εδώ.',
  'account.workspaces.empty.title': 'Σε κανέναν χώρο εργασίας',
  'account.workspaces.empty.body':
    'Αυτός ο λογαριασμός δεν ανήκει ακόμη σε κανέναν χώρο εργασίας. Ένας δημιουργείται την πρώτη φορά που συνδέεται, και όποιος άλλος τον προσκαλέσει εμφανίζεται εδώ.',
  'account.workspaces.column.workspace': 'Χώρος εργασίας',
  'account.workspaces.column.role': 'Ρόλος',
  'account.workspaces.column.plan': 'Πακέτο',
  'account.subscription.label': 'Συνδρομή',
  'account.subscription.free.title': 'Στο δωρεάν πακέτο',
  'account.subscription.free.body':
    'Ο χώρος εργασίας που κατέχει αυτός ο λογαριασμός δεν πέρασε ποτέ από το ταμείο, οπότε δεν φέρει εγγραφή συνδρομής και τρέχει με τα όρια του δωρεάν πακέτου.',
  'account.subscription.none.title':
    'Τίποτα δεν χρεώνεται σε αυτόν τον λογαριασμό',
  'account.subscription.none.body':
    'Αυτός ο λογαριασμός δεν κατέχει χώρο εργασίας. Το να είσαι μέλος στον χώρο κάποιου άλλου δεν σε κάνει αυτόν που χρεώνει ο χώρος, οπότε δεν υπάρχει τίποτα να μαζευτεί εδώ.',
  'account.subscription.endsAtClose': 'Λήγει με το κλείσιμο της περιόδου',
  'account.subscription.seats': 'Θέσεις',
  'account.subscription.seatsValue': '{used} από {limit}',
  'account.subscription.ends': 'Λήγει',
  'account.subscription.renews': 'Ανανεώνεται',
  'account.sessions.label': 'Ζωντανές συνεδρίες',
  'account.sessions.truncated':
    'Αυτός ο λογαριασμός κρατά περισσότερες συνεδρίες από όσες απαριθμεί μία κλήση. Ανακαλέστε κάθε συνεδρία από το μενού ενεργειών για να είστε σίγουροι ότι δεν έμεινε καμία.',
  'account.sessions.empty.title': 'Αποσυνδεδεμένος παντού',
  'account.sessions.empty.body':
    'Αυτός ο λογαριασμός δεν κρατά καμία συνεδρία που να μην έχει λήξει. Θα εμφανιστεί εδώ τη στιγμή που θα ξανασυνδεθεί.',
  'account.sessions.column.device': 'Συσκευή',
  'account.sessions.column.address': 'Διεύθυνση',
  'account.sessions.column.started': 'Έναρξη',
  'account.sessions.column.expires': 'Λήγει',
  'account.sessions.impersonated':
    'Γεννήθηκε από ενέργεια στο όνομα του λογαριασμού',
  'account.sessions.noAddress': 'Δεν καταγράφηκε',
  'account.sessions.noAddressLong': 'Η διεύθυνση δεν καταγράφηκε',
  'account.sessions.when': 'Έναρξη {started} · λήγει {expires}',
  'account.audit.label': 'Ιστορικό ελέγχου',
  'account.audit.truncated':
    'Το μητρώο κρατά περισσότερες εγγραφές από αυτές. Το ίχνος ελέγχου της πλατφόρμας μόνο προσθέτει και φυλάσσεται τετρακόσιες ημέρες.',
  'account.audit.empty.title':
    'Κανείς δεν έκανε τίποτα σε αυτόν τον λογαριασμό',
  'account.audit.empty.body':
    'Κάθε αλλαγή ρόλου, αναστολή, ορισμός κωδικού, ανάκληση συνεδρίας και ενέργεια στο όνομα του λογαριασμού γράφεται εδώ, με το όνομα αυτού που την έκανε. Αυτόν δεν τον άγγιξε κανείς.',

  /* --------------------------------------- η κλίμακα του χώρου εργασίας -- */

  'workspace.role.owner': 'Ιδιοκτήτης',
  'workspace.role.admin': 'Διαχειριστής',
  'workspace.role.member': 'Μέλος',
  'plan.free': 'Δωρεάν',
  'plan.starter': 'Εισαγωγικό',
  'plan.pro': 'Επαγγελματικό',
  'plan.business': 'Επιχειρηματικό',
  'subscription.trialing': 'Σε δοκιμή',
  'subscription.active': 'Ενεργή',
  'subscription.pastDue': 'Ληξιπρόθεσμη',
  'subscription.canceled': 'Ακυρωμένη',
  'subscription.incomplete': 'Ημιτελής',
  'subscription.expired': 'Ληγμένη',
  'subscription.unpaid': 'Απλήρωτη',
  'subscription.paused': 'Σε παύση',

  /* ------------------------------------------------------ μητρώο ελέγχου -- */

  'audit.action.created': 'Ο λογαριασμός δημιουργήθηκε',
  'audit.action.updated': 'Τα στοιχεία του λογαριασμού άλλαξαν',
  'audit.action.roleChanged': 'Ο ρόλος πλατφόρμας άλλαξε',
  'audit.action.banned': 'Ο λογαριασμός τέθηκε σε αναστολή',
  'audit.action.unbanned': 'Η αναστολή ήρθη',
  'audit.action.deleted': 'Ο λογαριασμός διαγράφηκε',
  'audit.action.passwordSet': 'Ο κωδικός ορίστηκε από διαχειριστή',
  'audit.action.emailSet': 'Η διεύθυνση email άλλαξε',
  'audit.action.impersonationStarted':
    'Ξεκίνησε η ενέργεια στο όνομα του λογαριασμού',
  'audit.action.impersonationEnded':
    'Τέλειωσε η ενέργεια στο όνομα του λογαριασμού',
  'audit.action.sessionRevoked': 'Μια συνεδρία ανακλήθηκε',
  'audit.action.sessionRevokedAll': 'Όλες οι συνεδρίες ανακλήθηκαν',
  'audit.actor.system': 'Η ίδια η πλατφόρμα',
  'audit.actor.system.detail': 'αυτόματα',
  'audit.actor.agent': 'Διαπιστευτήριο μηχανής',
  'audit.actor.agent.detail': 'διακριτικό MCP',
  'audit.actor.deleted': 'Ένας διαγραμμένος λογαριασμός',
  'audit.actorBadge': 'Τότε: {role}',
  'audit.field.name': 'Όνομα',
  'audit.field.email': 'Διεύθυνση email',
  'audit.field.emailVerified': 'Email επιβεβαιωμένο',
  'audit.field.role': 'Ρόλος πλατφόρμας',
  'audit.field.banned': 'Σε αναστολή',
  'audit.field.banReason': 'Αιτία',
  'audit.field.banExpiresAt': 'Λήξη της αναστολής',
  'audit.field.revoked': 'Συνεδρίες που έκλεισαν',
  'audit.field.impersonating': 'Ενεργεί ως',
  'audit.field.impersonatedBy': 'Ενήργησε ο',
  'audit.field.expiresAt': 'Η συνεδρία λήγει',
  'audit.field.targetRole': 'Ο ρόλος τους στην πλατφόρμα',
  'audit.field.sessionId': 'Συνεδρία',
  'audit.value.yes': 'ναι',
  'audit.value.no': 'όχι',
  'audit.value.cleared': 'εκκαθαρίστηκε',
  'audit.became': 'έγινε',

  /* ------------------------------------------------------------- διάλογοι -- */

  'dialog.cancel': 'Άκυρο',

  'create.button': 'Νέος λογαριασμός',
  'create.title': 'Δημιουργία λογαριασμού',
  'create.body':
    'Η διεύθυνση δεν επιβεβαιώνεται και δεν φεύγει κανένα μήνυμα — δώστε εσείς τον κωδικό.',
  'create.confirm': 'Δημιουργία λογαριασμού',
  'create.name.placeholder': 'Ελένη Παπαδάκη',
  'create.email': 'Διεύθυνση email',
  'create.email.placeholder': 'eleni@planned.travel',
  'create.password': 'Κωδικός',
  'create.password.hint':
    'Αρκετά μεγάλος ώστε να είναι φράση. Ο λογαριασμός μπορεί να τον αλλάξει μετά.',
  'create.done': 'Ο λογαριασμός δημιουργήθηκε',
  'create.done.body': 'Ο {email} μπορεί να συνδεθεί με τον κωδικό που ορίσατε.',

  'action.menu.label': 'Ενέργειες για {name}',
  'action.group.account': 'Λογαριασμός',
  'action.group.credentials': 'Διαπιστευτήρια',

  'action.role.item': 'Αλλαγή ρόλου πλατφόρμας',
  'action.role.self':
    'Όχι στον δικό σας λογαριασμό — υποβιβάζοντας τον εαυτό σας μπορεί να αφήσετε την πλατφόρμα χωρίς διαχειριστή.',
  'action.role.body':
    'Τι μπορεί να κάνει ο {name} στην ίδια την πλατφόρμα. Η ιδιότητα μέλους σε χώρο εργασίας είναι ξεχωριστό λεξιλόγιο και δεν κινείται μαζί.',
  'action.role.confirm': 'Αποθήκευση ρόλου',
  'action.role.current': 'Τώρα',
  'action.role.done': 'Ο ρόλος πλατφόρμας ενημερώθηκε',
  'action.role.done.body':
    'Ο {name} φέρει τώρα τον ρόλο {role} στην πλατφόρμα.',

  'action.impersonate.item': 'Ενέργεια στο όνομα του λογαριασμού',
  'action.impersonate.self':
    'Δεν υπάρχει κανείς να γίνετε — αυτός είναι ο δικός σας λογαριασμός.',
  'action.impersonate.banned':
    'Ο λογαριασμός είναι σε αναστολή, οπότε δεν κρατά καμία συνεδρία να φορέσετε.',
  'action.impersonate.admin':
    'Κανένας ρόλος στην πλατφόρμα δεν μπορεί να ενεργήσει στο όνομα διαχειριστή, ούτε ο δικός σας.',
  'action.impersonate.title': 'Ενέργεια ως {name}',
  'action.impersonate.body':
    'Θα δείτε το προϊόν ακριβώς όπως το βλέπει αυτός ο λογαριασμός, για δεκαπέντε λεπτά.',
  'action.impersonate.confirm': 'Έναρξη',
  'action.impersonate.note.bar':
    'Μια μπάρα προειδοποίησης μένει σε κάθε οθόνη ώσπου να το τερματίσετε, και δεν κλείνει.',
  'action.impersonate.note.platform':
    'Οι ενέργειες της πλατφόρμας δεν είναι διαθέσιμες όσο ενεργείτε στο όνομα κάποιου άλλου — ούτε η κονσόλα.',
  'action.impersonate.note.audit':
    'Η αρχή και το τέλος γράφονται και τα δύο στο ίχνος ελέγχου της πλατφόρμας, με το όνομά σας πάνω τους.',

  'action.password.item': 'Ορισμός κωδικού',
  'action.password.title': 'Ορισμός κωδικού για {name}',
  'action.password.body':
    'Χρησιμοποιήστε το για να επαναφέρετε έναν κλειδωμένο λογαριασμό ή για να κλείσετε έξω έναν επιτιθέμενο από έναν παραβιασμένο.',
  'action.password.confirm': 'Ορισμός κωδικού',
  'action.password.field': 'Νέος κωδικός',
  'action.password.hint.self':
    'Με τον ορισμό τελειώνει κάθε συνεδρία — και η δική σας.',
  'action.password.hint':
    'Με τον ορισμό τελειώνει κάθε συνεδρία που κρατά ο λογαριασμός.',
  'action.password.done': 'Ο κωδικός ορίστηκε',
  'action.password.done.body': 'Ο {name} αποσυνδέθηκε από κάθε συσκευή.',

  'action.sessions.item': 'Ανάκληση κάθε συνεδρίας',
  'action.sessions.body.self':
    'Αυτό σας αποσυνδέει από κάθε συσκευή, και από αυτήν που το διαβάζετε.',
  'action.sessions.body':
    'Ο {name} αποσυνδέεται από κάθε συσκευή και πρέπει να συνδεθεί ξανά.',
  'action.sessions.confirm': 'Ανάκληση συνεδριών',
  'action.sessions.done': 'Οι συνεδρίες ανακλήθηκαν',
  'action.sessions.done.body': {
    one: 'Μία συνεδρία έκλεισε.',
    other: '{revoked} συνεδρίες έκλεισαν.',
  },

  'action.ban.item': 'Αναστολή του λογαριασμού',
  'action.ban.self':
    'Όχι στον δικό σας λογαριασμό — αναστέλλοντας τον εαυτό σας χάνετε τον δρόμο της επιστροφής.',
  'action.ban.title': 'Αναστολή του {name}',
  'action.ban.body':
    'Κάθε συνεδρία τελειώνει αμέσως και ο λογαριασμός δεν μπορεί να συνδεθεί ξανά ώσπου να αρθεί ή να λήξει η αναστολή.',
  'action.ban.confirm': 'Αναστολή λογαριασμού',
  'action.ban.reason': 'Αιτία',
  'action.ban.reason.hint':
    'Κρατιέται δεκατρείς μήνες στο ίχνος ελέγχου της πλατφόρμας και δεν δείχνεται σε κανέναν εκτός από διαχειριστή.',
  'action.ban.reason.placeholder':
    'Επανειλημμένες αναφορές κατάχρησης από τρεις χώρους εργασίας',
  'action.ban.duration': 'Διάρκεια',
  'action.ban.duration.label': 'Διάρκεια της αναστολής',
  'action.ban.duration.permanent.body':
    'Μένει σε ισχύ ώσπου ένας διαχειριστής να την άρει εσκεμμένα.',
  'action.ban.duration.day': '24 ώρες',
  'action.ban.duration.day.body':
    'Αρκετά για να διακόψει, λίγο ώστε να παραμείνει παρέμβαση.',
  'action.ban.duration.week': '7 ημέρες',
  'action.ban.duration.week.body':
    'Μία εβδομάδα για να απαντηθεί μια καταγγελία.',
  'action.ban.duration.month': '30 ημέρες',
  'action.ban.duration.month.body': 'Ένας μήνας επιβεβλημένης σιωπής.',
  'action.ban.duration.quarter': '90 ημέρες',
  'action.ban.duration.quarter.body':
    'Το μεγαλύτερο που προσφέρει η κονσόλα. Πέρα από αυτό, αναστείλετε χωρίς λήξη.',
  'action.ban.done': 'Ο λογαριασμός τέθηκε σε αναστολή',
  'action.ban.done.body':
    'Ο {name} αποσυνδέθηκε παντού και δεν μπορεί να συνδεθεί ξανά.',

  'action.unban.item': 'Άρση της αναστολής',
  'action.unban.title': 'Άρση της αναστολής του {name}',
  'action.unban.body':
    'Ο λογαριασμός μπορεί να συνδεθεί ξανά από την επόμενη προσπάθεια. Καμία προηγούμενη συνεδρία δεν επανέρχεται.',
  'action.unban.confirm': 'Άρση αναστολής',
  'action.unban.done': 'Η αναστολή ήρθη',
  'action.unban.done.body':
    'Ο {name} μπορεί να συνδεθεί ξανά. Καμία συνεδρία δεν αποκαταστάθηκε.',

  'action.delete.item': 'Διαγραφή του λογαριασμού',
  'action.delete.self':
    'Όχι στον δικό σας λογαριασμό — από εκεί δεν υπάρχει γυρισμός.',
  'action.delete.title': 'Διαγραφή του {name}',
  'action.delete.body':
    'Ο λογαριασμός, οι συνεδρίες του και κάθε διαπιστευτήριο δεμένο πάνω του αφαιρούνται. Αυτό δεν αναιρείται.',
  'action.delete.confirm': 'Διαγραφή λογαριασμού',
  'action.delete.note':
    'Το περιεχόμενο χώρου εργασίας που έφτιαξε αυτό το άτομο μένει στον χώρο που το κατέχει. Η αναστολή του λογαριασμού αντ’ αυτού κρατά την εγγραφή και αφαιρεί την πρόσβαση.',
  'action.delete.owners':
    'Ένας λογαριασμός που είναι ο μόνος κάτοχος ενός χώρου εργασίας στον οποίο ανήκουν και άλλα άτομα δεν μπορεί να διαγραφεί. Ορίστε πρώτα άλλον κάτοχο εκεί ή αναστείλετε τον λογαριασμό αντί να τον διαγράψετε.',
  'action.delete.done': 'Ο λογαριασμός διαγράφηκε',
  'action.delete.done.body':
    'Ο {name} και ό,τι ήταν δεμένο στον λογαριασμό χάθηκαν.',

  'session.revoke.label': 'Κλείσιμο της συνεδρίας σε {device}',
  'session.revoke.title': 'Κλείσιμο αυτής της συνεδρίας',
  'session.revoke.body':
    'Η συσκευή {device} πρέπει να συνδεθεί ξανά στο επόμενο αίτημα. Αν είναι η συνεδρία στην οποία το διαβάζετε, αποσυνδέεστε μαζί της.',
  'session.revoke.confirm': 'Κλείσιμο συνεδρίας',
  'session.revoke.done': 'Η συνεδρία έκλεισε',
  'session.revoke.done.body':
    'Η συσκευή πρέπει να συνδεθεί ξανά στο επόμενο αίτημα.',

  /* -------------------------------------------------- εκτελέσεις πρακτόρων -- */

  'runs.error.title': 'Το μητρώο εκτελέσεων δεν απάντησε',
  'runs.origin.local': 'Τοπικά',
  'runs.origin.githubActions': 'Ενέργειες GitHub',
  'runs.stat.live': 'Ζωντανές εκτελέσεις',
  'runs.stat.live.none': 'Αυτή τη στιγμή δεν χτίζεται τίποτα',
  'runs.stat.live.some': 'Χτυπά απέναντι σε πεντάλεπτη μίσθωση',
  'runs.stat.issues': 'Κρατημένα ζητήματα',
  'runs.stat.issues.caption':
    'Μισθωμένα σε μία εκτέλεση το καθένα, μαζί με προγόνους και υποζητήματα',
  'runs.stat.orphans': 'Ορφανοί κλάδοι',
  'runs.stat.orphans.none': 'Καμία δουλειά δεν μένει αζήτητη',
  'runs.stat.orphans.some':
    'Commit από εκτέλεση που σταμάτησε, σε αναμονή να υιοθετηθούν',
  'runs.live.empty.title': 'Καμία εκτέλεση δεν είναι καταχωρισμένη',
  'runs.live.empty.body':
    'Μια εκτέλεση εμφανίζεται εδώ τη στιγμή που καταχωρίζεται — από αυτό το μηχάνημα, από άλλο, ή από εκτελεστή του GitHub — μαζί με τα ζητήματα που πήρε.',
  'runs.holds.nothing': 'δεν κρατά τίποτα',
  'runs.holds': 'κρατά {issues}',
  'runs.uptime': '{elapsed} σε λειτουργία · {lease}',
  'runs.lease.expired': 'έληξε',
  'runs.lease.left': 'απομένουν {elapsed}',
  'runs.wip.label': 'Δουλειά σε εξέλιξη',
  'runs.wip.empty.title': 'Κανένας κλάδος δεν κουβαλά δουλειά',
  'runs.wip.empty.body':
    'Μια εκτέλεση καταγράφει τον κλάδο της μόλις έχει commit πάνω του, ώστε αν πεθάνει, η επόμενη που θα πάρει το ζήτημα να πάρει τη δουλειά αντί να την ξαναρχίσει.',
  'runs.wip.orphaned': 'Ορφανός',
  'runs.wip.meta': {
    one: '{commits} commit · πριν από {elapsed}',
    other: '{commits} commit · πριν από {elapsed}',
  },
  'runs.recent.label': 'Πρόσφατα ολοκληρωμένες',
  'runs.recent.empty.title': 'Καμία εκτέλεση δεν έχει τελειώσει ακόμη',
  'runs.recent.empty.body':
    'Οι τελευταίες πενήντα εκτελέσεις κρατιούνται εδώ, μαζί με το πώς τελείωσε η καθεμία.',
  'runs.ago': 'πριν από {elapsed}',
  'runs.notCoordinator.title': 'Αυτή η εγκατάσταση δεν συντονίζει τον στόλο',
  'runs.notCoordinator.body':
    'Το μητρώο εκτελέσεων είναι δεμένο μόνο στο δοκιμαστικό περιβάλλον, και επίτηδες: ένα δεύτερο μητρώο θα άφηνε δύο στόλους να πιστεύουν ο καθένας ότι κρατά την ουρά, που είναι ακριβώς αυτό που υπάρχει για να εμποδίσει. Διαβάστε τον στόλο στο δοκιμαστικό περιβάλλον.',
  'nav.providers': 'Πάροχοι',
  'nav.providers.description': 'Εξερχόμενες κλήσεις και τα όριά τους',
  'providers.error.title':
    'Δεν ήταν δυνατή η ανάγνωση των μετρητών των παρόχων',
  'providers.list.label': 'Υπηρεσίες',
  'providers.status.planned': 'Χωρίς ενσωμάτωση',
  'providers.status.planned.description':
    'Τίποτα δεν καλεί ακόμη αυτή την υπηρεσία, οπότε δεν υπάρχει τι να μετρηθεί. Αναφέρεται εδώ ώστε να συμφωνηθεί όριο πριν από την πρώτη κλήση και όχι μετά το πρώτο τιμολόγιο.',
  'providers.policy.allow': 'Χρεώνει και πάνω από το όριο',
  'providers.policy.block': 'Αρνείται στο όριο',
  'providers.badge.blocked': {
    one: 'Μία κλήση απορρίφθηκε',
    other: '{calls} κλήσεις απορρίφθηκαν',
  },
  'providers.limit.none': 'Δεν συμφωνήθηκε όριο · {used} αυτόν τον μήνα',
  'providers.limit.value': '{used} από {limit}',
  'providers.limit.window.day': 'Σήμερα',
  'providers.limit.window.month': 'Αυτόν τον μήνα',
  'providers.measuring.none': 'Δεν έχει μετρηθεί τίποτα ακόμη',
  'providers.measuring.since': 'Μέτρηση από {date}',
  'providers.stat.calls': 'Κλήσεις αυτόν τον μήνα',
  'providers.stat.calls.caption': 'Σε όλες τις ενσωματωμένες υπηρεσίες',
  'providers.stat.errors': 'Αποτυχημένες κλήσεις',
  'providers.stat.errors.caption':
    'Μετρούν και ως κλήσεις, γιατί οι περισσότεροι πάροχοι τις χρεώνουν',
  'providers.stat.nearLimit': 'Κοντά σε όριο',
  'providers.stat.nearLimit.caption':
    'Υπηρεσίες πάνω από το κατώφλι προειδοποίησης',
  'providers.stat.blocked': 'Απορριφθείσες κλήσεις',
  'providers.stat.blocked.none': 'Δεν απορρίφθηκε τίποτα',
  'providers.stat.blocked.some': 'Ζήτηση που απέρριψε ένα όριο',
  'providers.forecast.label': 'Πρόβλεψη',
  'providers.forecast.provider': 'Υπηρεσία',
  'providers.forecast.monthEnd': 'Έως το τέλος του μήνα',
  'providers.forecast.runRate': 'Ανά μήνα με αυτόν τον ρυθμό',
  'providers.forecast.perWorkspace': 'Ανά χώρο εργασίας τον μήνα',
  'providers.forecast.noWorkspaceTraffic':
    'Δεν υπάρχει κίνηση χώρων εργασίας για μέσο όρο',
  'providers.forecast.window': {
    one: 'Προβολή από μία ώρα μέτρησης.',
    other: 'Προβολή από {hours} ώρες μέτρησης.',
  },
  'providers.forecast.tooEarly': {
    one: 'Έχει μετρηθεί μόλις μία ώρα — πολύ λίγο για πρόβλεψη. Να τεντώσεις λιγότερο από μία μέρα σε έναν μήνα είναι αριθμητική, όχι πρόβλεψη.',
    other:
      'Έχουν μετρηθεί μόλις {hours} ώρες — πολύ λίγο για πρόβλεψη. Να τεντώσεις λιγότερο από μία μέρα σε έναν μήνα είναι αριθμητική, όχι πρόβλεψη.',
  },
  'providers.forecast.atWorkspaces': 'Με πόσους χώρους εργασίας',
  'providers.forecast.callsEach': 'Κλήσεις ανά χώρο τον μήνα',
  'providers.forecast.projected': 'Περίπου {calls} κλήσεις τον μήνα.',
  'providers.workspaces.label': 'Πιο ενεργοί χώροι εργασίας',
  'providers.workspaces.platform': 'Πλατφόρμα (χωρίς χώρο εργασίας)',
  'providers.workspaces.empty.title': 'Δεν έχει αποδοθεί τίποτα ακόμη',
  'providers.workspaces.empty.description':
    'Μια κλήση που γίνεται για έναν χώρο εργασίας καταγράφεται σε αυτόν. Οι προγραμματισμένες εργασίες και η αλληλογραφία της πλατφόρμας δεν ανήκουν σε κανέναν και μετρούν χωριστά.',
  'providers.readOnly':
    'Μπορείς να διαβάσεις αυτούς τους μετρητές αλλά όχι να μετακινήσεις όριο. Η αλλαγή ορίου ή πολιτικής απαιτεί το δικαίωμα provider:configure.',
  'providers.status.planned.agreed.month':
    'Συμφωνημένο όριο: {limit} τον μήνα. Ισχύει από την πρώτη κλήση, μόλις υπάρξει πελάτης.',
  'providers.status.planned.agreed.day':
    'Συμφωνημένο όριο: {limit} την ημέρα. Ισχύει από την πρώτη κλήση, μόλις υπάρξει πελάτης.',
  'providers.edit.button': 'Επεξεργασία',
  'providers.edit.title': 'Όριο για {provider}',
  'providers.edit.body':
    'Τι έχει συμφωνήσει να ξοδεύει αυτή η εγκατάσταση στον πάροχο, και τι γίνεται όταν εξαντληθεί.',
  'providers.edit.confirm': 'Αποθήκευση ορίου',
  'providers.edit.done': 'Το όριο για {provider} αποθηκεύτηκε',
  'providers.edit.label': 'Όνομα',
  'providers.edit.ceiling': 'Κλήσεις που περιλαμβάνονται',
  'providers.edit.ceiling.hint':
    'Άφησέ το κενό αν δεν έχει συμφωνηθεί όριο. Το κενό και το μηδέν διαφέρουν: το μηδέν με «άρνηση» απορρίπτει κάθε κλήση.',
  'providers.edit.ceiling.placeholder': 'Χωρίς όριο',
  'providers.edit.window': 'Μετριέται σε',
  'providers.edit.window.month': 'Ημερολογιακό μήνα',
  'providers.edit.window.month.body':
    'Η συνήθης μορφή μιας συμπεριλαμβανόμενης ποσόστωσης.',
  'providers.edit.window.day': 'Ημέρα',
  'providers.edit.window.day.body':
    'Ορισμένοι πάροχοι μετρούν ημερησίως — το δωρεάν πρόγραμμα της Geoapify είναι 3.000 μονάδες την ημέρα.',
  'providers.edit.policy': 'Στο όριο',
  'providers.edit.policy.allow': 'Συνέχισε και πλήρωσε',
  'providers.edit.policy.allow.body':
    'Οι κλήσεις συνεχίζονται πάνω από το όριο και η κονσόλα προειδοποιεί. Τίποτα δεν σταματά.',
  'providers.edit.policy.block': 'Άρνηση επόμενων κλήσεων',
  'providers.edit.policy.block.body':
    'Οι κλήσεις απορρίπτονται μέχρι να μηδενιστεί το παράθυρο. Ό,τι εξαρτάται από αυτόν τον πάροχο σταματά — διάλεξέ το μόνο όπου αυτή είναι η φθηνότερη αστοχία.',
  'providers.edit.policy.block.refused':
    'Το {provider} δεν μπορεί να απορριφθεί: δεν έχει εναλλακτική, οπότε η άρνηση των κλήσεών του θα σταματούσε τη λειτουργία αντί να περιορίσει το κόστος. Ένα όριο που απλώς προειδοποιεί παραμένει διαθέσιμο.',
  'providers.edit.warn': 'Προειδοποίηση στο (%)',
  'providers.edit.critical': 'Συναγερμός στο (%)',
  'providers.edit.thresholds.hint':
    'Πού η ένδειξη γίνεται πορτοκαλί και κόκκινη. Η προειδοποίηση δεν πρέπει να ξεπερνά τον συναγερμό.',
} satisfies TranslationOf<typeof En>

export default messages
