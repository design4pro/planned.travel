/**
 * Everything the settings module says, in Greek.
 *
 * Made from `../en/settings.ts` and from nothing else. `docs/SPEC.md` §1 and
 * §8.9 forbid deriving a catalogue from the reference project's AGPL
 * translations, so every sentence here was written against our English source.
 *
 * **A plan's name is a word, not a mark.** `billing.plan.<id>.name` is
 * translated like any other noun here, because the id — `free`, `solo`, `crew`
 * — is what `src/lib/plans.ts`, Polar and the invoice carry, and no reader ever
 * sees it. `Polar`, `PDF` and `Face ID` stay as they are: a company, a format
 * and a trademark.
 *
 * **A language is never named in English**, and never named here either: all
 * twenty-three come from the frozen registry in `src/lib/i18n/locales.ts`, so no
 * key below spells one. Currency *names* are translated; the ISO code beside
 * them is derived in the route.
 */

import type En from '../en/settings'
import type { TranslationOf } from '../../types'

const messages = {
  'workspace.invite.invite': 'Πρόσκληση',
  'workspace.invite.resend': 'Επαναποστολή',
  'workspace.invite.revoke': 'Ανάκληση',
  'workspace.invite.confirm': 'Ανάκληση πρόσκλησης',
  'workspace.invite.expired': 'Έληξε',
  'workspace.invite.by': 'Πρόσκληση από {name}',
  'workspace.invite.sent': 'Η πρόσκληση στάλθηκε',
  'workspace.invite.revoked': 'Η πρόσκληση ανακλήθηκε',
  'workspace.invite.delivery':
    'Η πρόσκληση αποθηκεύτηκε, αλλά η αποστολή email απέτυχε. Στείλτε την ξανά.',
  'workspace.invite.duplicate':
    'Υπάρχει ήδη εκκρεμής πρόσκληση. Στείλτε την ξανά.',
  'workspace.invite.existing':
    'Αυτό το άτομο είναι ήδη μέλος του χώρου εργασίας.',
  'workspace.invite.failed':
    'Η πρόσκληση δεν είναι διαθέσιμη. Ανανεώστε τη λίστα και δοκιμάστε ξανά.',
  'workspace.invite.reload': 'Ανανέωση προσκλήσεων',

  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Λογαριασμός',
  'page.title': 'Ρυθμίσεις',
  'page.description':
    'Όλα για εσάς, τον χώρο εργασίας σας και τη συμπεριφορά του planned.travel',
  'page.error': 'Οι ρυθμίσεις δεν φόρτωσαν',

  'nav.label': 'Ενότητες ρυθμίσεων',
  'nav.profile': 'Προφίλ',
  'nav.profile.hint': 'Εσείς, ημερομηνίες και ποσά',
  'nav.language': 'Γλώσσα',
  'nav.language.hint': 'Η γλώσσα που μιλά κάθε οθόνη',
  'nav.appearance': 'Εμφάνιση',
  'nav.appearance.hint': 'Θέμα, κίνηση και χάρτης',
  'nav.security': 'Ασφάλεια',
  'nav.security.hint': 'Κωδικός, δύο παράγοντες, κλειδιά',
  'nav.notifications': 'Ειδοποιήσεις',
  'nav.notifications.hint': 'Εισερχόμενα, email και κινητό',
  'nav.workspace': 'Χώρος εργασίας',
  'nav.workspace.hint': 'Μέλη και κοινές προεπιλογές',
  'nav.billing': 'Χρεώσεις',
  'nav.billing.hint': 'Πλάνο, θέσεις και αποδείξεις',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Αποθήκευση αλλαγών',
  'error.retryBody':
    'Τίποτα δεν χάθηκε. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
  'role.owner': 'Ιδιοκτήτης',
  'role.admin': 'Διαχειριστής',
  'role.member': 'Μέλος',

  /* -------------------------------------------------- regional option labels */
  /* The trigger this sits in truncates at 206px. Measured against its own
     computed font: the literal genitive «Του χώρου εργασίας» reached 220px on
     the longest sample date, past even English's own 217px. «Κοινή προεπιλογή»
     is the phrase this catalogue already uses for the same idea in
     `nav.workspace.hint`, and it lands at 206px. */
  'regional.workspaceDefault': 'Κοινή προεπιλογή — {value}',
  'regional.currency.AUD': 'Δολάριο Αυστραλίας',
  'regional.currency.CAD': 'Δολάριο Καναδά',
  'regional.currency.CHF': 'Φράγκο Ελβετίας',
  'regional.currency.EUR': 'Ευρώ',
  'regional.currency.GBP': 'Λίρα Αγγλίας',
  'regional.currency.JPY': 'Γιεν Ιαπωνίας',
  'regional.currency.PLN': 'Ζλότι Πολωνίας',
  'regional.currency.SEK': 'Κορόνα Σουηδίας',
  'regional.currency.USD': 'Δολάριο ΗΠΑ',
  'regional.distance.metric': 'Χιλιόμετρα',
  'regional.distance.imperial': 'Μίλια',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Το προφίλ σας δεν φόρτωσε',
  'profile.account.title': 'Ο λογαριασμός σας',
  'profile.account.description':
    'Το όνομα και το email σας έρχονται από τον λογαριασμό με τον οποίο συνδέεστε.',
  'profile.email.verified': 'Email επιβεβαιωμένο',
  'profile.email.unverified': 'Email μη επιβεβαιωμένο',
  'profile.twoFactor.on': 'Δύο παράγοντες ενεργοί',
  'profile.figure.workspace': 'Χώρος εργασίας',
  'profile.figure.role': 'Ρόλος',
  'profile.figure.joined': 'Μέλος από',
  'profile.figure.joinedUnknown': 'Δεν έχει καταγραφεί',
  'profile.regional.title': 'Ημερομηνίες, ποσά και μονάδες',
  'profile.regional.description':
    'Αυτά υπερισχύουν των προεπιλογών του χώρου εργασίας μόνο για εσάς. Αφήστε ένα στην προεπιλογή και ακολουθεί τον χώρο εργασίας.',
  'profile.regional.saving': 'Αποθηκεύονται οι προτιμήσεις σας',
  'profile.regional.saved': 'Οι προτιμήσεις σας αποθηκεύτηκαν',
  'profile.regional.saveFailed': 'Οι προτιμήσεις σας δεν αποθηκεύτηκαν',
  'profile.language.label': 'Γλώσσα',
  'profile.language.hint':
    'Επιλέγεται σε δική της οθόνη, όπου κάθε γλώσσα είναι γραμμένη στη δική της γραφή.',
  'profile.language.action': 'Αλλαγή',
  'profile.timezone.label': 'Ζώνη ώρας',
  'profile.timezone.hint':
    'Οι ώρες αναχώρησης και άφιξης εμφανίζονται με βάση αυτήν.',
  'profile.currency.label': 'Νόμισμα',
  'profile.currency.hint':
    'Τα νέα ταξίδια ξεκινούν σε αυτό το νόμισμα· κάθε ταξίδι μπορεί να το αλλάξει.',
  'profile.dateFormat.label': 'Μορφή ημερομηνίας',
  'profile.weekStart.label': 'Η εβδομάδα ξεκινά',
  'profile.weekStart.hint':
    'Ισχύει για κάθε ημερολόγιο, μαζί με το ετήσιο πλέγμα των αδειών.',
  'profile.distance.label': 'Απόσταση',

  /* --------------------------------------------------------------- language */
  'language.error': 'Οι ρυθμίσεις γλώσσας δεν φόρτωσαν',
  'language.section.title': 'Γλώσσα',
  'language.section.description':
    'Κάθε οθόνη, κάθε κουμπί και κάθε ημερομηνία διαβάζεται στη γλώσσα που διαλέγετε εδώ — είκοσι τρεις γλώσσες, καθεμιά γραμμένη στη δική της γραφή.',
  'language.label': 'Διαλέξτε γλώσσα',
  'language.followWorkspace': 'Ακολούθησε τον χώρο εργασίας',
  'language.state.yours': 'Η γλώσσα σας',
  'language.state.workspace': 'Από τον χώρο εργασίας',
  'language.state.hint.override':
    'Δική σας επιλογή. Ισχύει μόνο για εσάς, σε κάθε συσκευή από την οποία συνδέεστε.',
  'language.state.hint.workspace':
    'Δεν έχετε δική σας γλώσσα, οπότε διαβάζετε ό,τι έχει ρυθμιστεί στον χώρο εργασίας. Ένας ιδιοκτήτης ή διαχειριστής μπορεί να το αλλάξει από την ενότητα Χώρος εργασίας.',
  'language.saved': 'Το planned.travel μιλά τώρα {language}',
  'language.saveFailed': 'Η γλώσσα σας δεν άλλαξε',
  'language.saveFailedBody':
    'Τίποτα δεν χάθηκε και συνεχίζετε να διαβάζετε {language}. Ελέγξτε τη σύνδεσή σας και διαλέξτε ξανά.',
  'language.reload.title': 'Η γλώσσα σας αποθηκεύτηκε',
  'language.reload.body':
    'Αυτή η σελίδα δεν πρόλαβε να γυρίσει στα {language}. Φορτώστε την ξανά για να διαβάσετε το προϊόν στη νέα σας γλώσσα.',
  'language.sample.title': 'Πώς θα διαβάζονται ημερομηνίες και αριθμοί',
  'language.sample.description':
    'Οι ίδιες τρεις τιμές, γραμμένες όπως τις γράφει αυτή η γλώσσα.',
  'language.sample.date': 'Μια ημερομηνία',
  'language.sample.number': 'Ένας αριθμός',
  'language.sample.money': 'Ένα ποσό',
  'language.legal':
    'Οι όροι και η δήλωση απορρήτου δημοσιεύονται μόνο στα αγγλικά. Όλα τα άλλα στο προϊόν είναι μεταφρασμένα.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Η εμφάνιση δεν φόρτωσε',
  'appearance.theme.title': 'Θέμα',
  'appearance.theme.description':
    'Και τα δύο θέματα είναι σχεδιασμένα, όχι αντεστραμμένα. Διαλέξτε αυτό που διαβάζετε πιο άνετα.',
  'appearance.theme.light': 'Φωτεινό',
  'appearance.theme.lightHint': 'Ζεστό χαρτί, όλη μέρα',
  'appearance.theme.dark': 'Σκούρο',
  'appearance.theme.darkHint': 'Ζεστό ανθρακί, ποτέ μαύρο',
  'appearance.theme.system': 'Σύστημα',
  'appearance.theme.systemHint': 'Ακολουθεί τη συσκευή',
  'appearance.theme.showing': 'Τώρα εμφανίζεται η {palette} παλέτα.',
  'appearance.theme.showingSystem':
    'Τώρα εμφανίζεται η {palette} παλέτα, ακολουθώντας τη συσκευή σας.',
  'appearance.palette.light': 'φωτεινή',
  'appearance.palette.dark': 'σκούρα',
  'appearance.motion.title': 'Κίνηση και χάρτες',
  'appearance.motion.label': 'Λιγότερη κίνηση',
  'appearance.motion.hint':
    'Περιορίζει τις κινήσεις εισόδου σε ένα απλό σβήσιμο. Η αντίστοιχη ρύθμιση του λειτουργικού σας τηρείται πάντα κι αυτή.',
  'appearance.map.label': 'Στιλ χάρτη',
  'appearance.map.hint': 'Ο βασικός χάρτης στον σχεδιασμό και στον άτλαντα.',
  'appearance.map.workspace': 'Ακολούθησε τον χώρο εργασίας',
  'appearance.map.workspaceHint':
    'Ό,τι έχει επιλέξει ο ιδιοκτήτης του χώρου εργασίας.',
  'appearance.map.auto': 'Αυτόματο',
  'appearance.map.autoHint': 'Ακολουθεί το φωτεινό ή σκούρο θέμα σου.',
  'appearance.map.paper': 'Χαρτί',
  'appearance.map.paperHint': 'Ζεστό και φωτεινό, σε όποιο θέμα κι αν είσαι.',
  'appearance.map.charcoal': 'Ανθρακί',
  'appearance.map.charcoalHint': 'Ζεστό και σκούρο, σε όποιο θέμα κι αν είσαι.',
  'appearance.map.quiet': 'Ήσυχο',
  'appearance.map.quietHint':
    'Χωρίς ονόματα δρόμων, ώστε να ξεχωρίζουν πρώτες οι πινέζες σου.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Σε κοινόχρηστη οθόνη',
  'appearance.privacy.codesLabel':
    'Απόκρυψη των κωδικών επιβεβαίωσης μέχρι να τους ζητήσω',
  'appearance.privacy.codesHint':
    'Οι κωδικοί κράτησης και οι αριθμοί επιβεβαίωσης παραμένουν καλυμμένοι στις κρατήσεις και στις μετακινήσεις, μέχρι να κάνετε κλικ ή να τους πατήσετε, και καλύπτονται ξανά μόλις προχωρήσετε αλλού. Οι τιμές δεν κρύβονται ποτέ.',
  'appearance.saveFailed': 'Η αλλαγή δεν αποθηκεύτηκε',
  'appearance.saveFailedBody':
    'Φαίνεται εδώ, αλλά η επόμενη συσκευή από την οποία θα συνδεθείτε δεν θα την έχει.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Η ασφάλεια δεν φόρτωσε',
  'security.unverified.title': 'Το email σας δεν έχει επιβεβαιωθεί ακόμη',
  'security.unverified.body':
    'Οι επαναφορές κωδικού και οι προσκλήσεις σε ταξίδια στέλνονται στο {email}. Η επιβεβαίωση είναι αυτό που αποδεικνύει ότι η διεύθυνση είναι δική σας.',
  'security.unverified.action': 'Στείλτε ξανά τον σύνδεσμο',
  'security.signin.title': 'Σύνδεση',
  'security.signin.description':
    'Πώς αποδεικνύετε ότι είστε εσείς. Οι δύο παράγοντες και τα κλειδιά πρόσβασης είναι και τα δύο ισχυρότερα από έναν κωδικό μόνο.',
  'security.email.label': 'Διεύθυνση email',
  'security.email.verified': 'Επιβεβαιωμένη',
  'security.email.unverified': 'Μη επιβεβαιωμένη',
  'security.password.label': 'Κωδικός',
  'security.password.hint':
    'Αλλάξτε τον όποτε θέλετε — θα λάβετε σύνδεσμο μιας χρήσης αντί να σας ζητηθεί ο παλιός.',
  'security.password.action': 'Αλλαγή κωδικού',
  'security.twoFactor.label': 'Ταυτοποίηση δύο παραγόντων',
  'security.twoFactor.onHint':
    'Σε κάθε νέα σύνδεση χρειάζεται κωδικός από την εφαρμογή ταυτοποίησης.',
  'security.twoFactor.offHint':
    'Προσθέστε έναν εξαψήφιο κωδικό από εφαρμογή ταυτοποίησης πάνω από τον κωδικό σας.',
  'security.twoFactor.on': 'Ενεργό',
  'security.twoFactor.off': 'Ανενεργό',
  'security.twoFactor.manage': 'Διαχείριση',
  'security.twoFactor.enable': 'Ενεργοποίηση',
  'security.passkeys.label': 'Κλειδιά πρόσβασης',
  'security.passkeys.hint':
    'Συνδεθείτε με το δακτυλικό αποτύπωμα, το Face ID ή ένα κλειδί ασφαλείας, χωρίς να πληκτρολογήσετε τίποτα.',
  'security.passkeys.action': 'Διαχείριση κλειδιών πρόσβασης',
  'security.session.title': 'Αυτή η συνεδρία',
  'security.session.description':
    'Το πρόγραμμα περιήγησης στο οποίο τα διαβάζετε αυτά.',
  'security.session.label': 'Συνδεδεμένοι ως',
  'security.session.expires': 'Λήγει {date}',
  'security.session.expiresSoon': 'σύντομα',
  'security.session.noExpiry': 'Δεν έχει καταγραφεί λήξη',
  'security.signOut.label': 'Αποσύνδεση',
  'security.signOut.hint':
    'Τερματίζει αυτή τη συνεδρία και σας γυρίζει στη σελίδα σύνδεσης. Οι άλλες συσκευές μένουν συνδεδεμένες.',
  'security.signOut.pending': 'Αποσυνδέεστε',
  'security.signOut.failed': 'Δεν αποσυνδεθήκατε',
  'security.signOut.failedBody': 'Ελέγξτε τη σύνδεσή σας και ξαναδοκιμάστε.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Οι ρυθμίσεις ειδοποιήσεων δεν φόρτωσαν',
  'notifications.title': 'Ειδοποιήσεις',
  'notifications.description':
    'Κάθε διακόπτης ισχύει μόνο για εσάς. Κλείνοντας έναν δεν σταματά το γεγονός — σταματά μόνο το να σας το πούμε.',
  'notifications.caption': 'Ποιες ειδοποιήσεις φτάνουν σε κάθε κανάλι',
  'notifications.event': 'Γεγονός',
  'notifications.switch': '{event} μέσω {channel}',
  'notifications.saveFailed': 'Η προτίμηση δεν αποθηκεύτηκε',
  'notifications.saveFailedBody':
    'Ο διακόπτης γύρισε πίσω. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
  'notifications.channel.in_app': 'Στην εφαρμογή',
  'notifications.channel.in_app.hint': 'Το κουδούνι στην πάνω μπάρα',
  'notifications.channel.email': 'Ηλ. ταχυδρομείο',
  'notifications.channel.email.hint': 'Στέλνεται στη διεύθυνση σύνδεσής σας',
  'notifications.channel.push': 'Στη συσκευή',
  'notifications.channel.push.hint': 'Στις συσκευές όπου το επιτρέψατε',
  'notifications.event.trip.invited': 'Προσκλήσεις σε ταξίδια',
  'notifications.event.trip.invited.hint':
    'Κάποιος σας προσθέτει σε ταξίδι που σχεδιάζει.',
  'notifications.event.trip.updated': 'Αλλαγές προγράμματος',
  'notifications.event.trip.updated.hint':
    'Μια ημέρα, μια στάση ή μια ημερομηνία μετακινείται σε ταξίδι σας.',
  'notifications.event.trip.starting_soon': 'Υπενθυμίσεις αναχώρησης',
  'notifications.event.trip.starting_soon.hint':
    'Ένα σκούντημα τις ημέρες πριν ξεκινήσει ένα ταξίδι.',
  'notifications.event.reservation.reminder': 'Υπενθυμίσεις κρατήσεων',
  'notifications.event.reservation.reminder.hint':
    'Μια διαμονή, ένα τραπέζι ή ένα εισιτήριο πλησιάζει.',
  'notifications.event.expense.added': 'Νέα έξοδα',
  'notifications.event.expense.added.hint':
    'Κάποιος καταγράφει χρήματα σε κοινό ταξίδι.',
  'notifications.event.expense.settled': 'Εξοφλημένα υπόλοιπα',
  'notifications.event.expense.settled.hint':
    'Ένα υπόλοιπο στο οποίο συμμετείχατε πληρώθηκε.',
  'notifications.event.list.assigned': 'Ανατεθειμένα στοιχεία',
  'notifications.event.list.assigned.hint':
    'Κάτι σε λίστα αποσκευών ή εκκρεμοτήτων γίνεται δικό σας.',
  'notifications.event.collab.message': 'Συνομιλία ταξιδιού',
  'notifications.event.collab.message.hint':
    'Νέα μηνύματα σε ταξίδι στο οποίο ταξιδεύετε.',
  'notifications.event.organization.invited': 'Προσκλήσεις σε χώρο εργασίας',
  'notifications.event.organization.invited.hint':
    'Σας προσκαλούν σε χώρο εργασίας.',

  'notifications.event.billing.plan_changed': 'Αλλαγές συνδρομής',
  'notifications.event.billing.plan_changed.hint':
    'Ο χώρος εργασίας σας αλλάζει πλάνο.',
  'notifications.event.billing.invoice_paid': 'Αποδείξεις πληρωμής',
  'notifications.event.billing.invoice_paid.hint':
    'Εξοφλήθηκε τιμολόγιο του χώρου εργασίας σας.',
  'notifications.event.billing.payment_failed': 'Προβλήματα πληρωμής',
  'notifications.event.billing.payment_failed.hint':
    'Μια χρέωση του χώρου εργασίας σας δεν ολοκληρώθηκε.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Ο χώρος εργασίας δεν φόρτωσε',
  'workspace.summary.description': 'Πλάνο {plan} · δημιουργήθηκε {date}',
  'workspace.summary.createdRecently': 'πρόσφατα',
  'workspace.summary.billingAction': 'Πλάνο και χρεώσεις',
  'workspace.seats.label': 'Θέσεις σε χρήση',
  'workspace.seats.value': '{used} από {limit}',
  'workspace.seats.note':
    'Οι ανοιχτές προσκλήσεις μετρούν στις θέσεις σας, ώστε ένας χώρος εργασίας να μην ξεπερνά ποτέ το πλάνο που πληρώνει.',
  'workspace.seatsFull.title':
    'Όλες οι θέσεις αυτού του πλάνου είναι πιασμένες',
  'workspace.seatsFull.body':
    '{members} και {invitations} γεμίζουν και τις {limit} θέσεις.',
  'workspace.seatsFull.action': 'Προσθήκη θέσεων',
  'workspace.members.count': {
    one: '{value} μέλος',
    other: '{value} μέλη',
  },
  'workspace.invitations.count': {
    one: '{value} πρόσκληση σε εκκρεμότητα',
    other: '{value} προσκλήσεις σε εκκρεμότητα',
  },
  'workspace.members.title': 'Μέλη',
  'workspace.members.description':
    'Όλοι όσοι βλέπουν τα ταξίδια, τα χρήματα και τα αρχεία αυτού του χώρου εργασίας.',
  'workspace.members.tableLabel': 'Μέλη αυτού του χώρου εργασίας',
  'workspace.members.person': 'Πρόσωπο',
  'workspace.members.role': 'Ρόλος',
  'workspace.members.joined': 'Εντάχθηκε',
  'workspace.invitations.title': 'Προσκλήσεις',
  'workspace.invitations.description':
    'Όσοι έχουν προσκληθεί αλλά δεν έχουν μπει ακόμη.',
  'workspace.invitations.emptyTitle': 'Καμία ανοιχτή πρόσκληση',
  'workspace.invitations.emptyBody':
    'Όλοι όσοι προσκλήθηκαν σε αυτόν τον χώρο έχουν ήδη μπει.',
  'workspace.invitations.expires': 'Λήγει {date}',
  'workspace.invitations.expiresSoon': 'σύντομα',
  'workspace.defaults.title': 'Κοινές προεπιλογές',
  'workspace.defaults.description':
    'Με τι ξεκινά ένα νέο ταξίδι και ένα νέο μέλος. Ο καθένας μπορεί να τις αλλάξει για τον εαυτό του στο προφίλ του.',
  'workspace.defaults.readOnly': 'Μόνο ανάγνωση',
  'workspace.defaults.saving': 'Αποθηκεύονται οι προεπιλογές του χώρου',
  'workspace.defaults.saved': 'Οι προεπιλογές του χώρου αποθηκεύτηκαν',
  'workspace.defaults.saveFailed': 'Οι προεπιλογές του χώρου δεν αποθηκεύτηκαν',
  'workspace.defaults.saveFailedBody':
    'Μόνο ιδιοκτήτης ή διαχειριστής μπορεί να τις αλλάξει. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
  'workspace.currency.label': 'Προεπιλεγμένο νόμισμα',
  'workspace.currency.hint': 'Τα νέα ταξίδια προϋπολογίζονται σε αυτό.',
  'workspace.language.label': 'Γλώσσα',
  'workspace.language.hint':
    'Τι διαβάζει ένα μέλος που δεν έχει διαλέξει δική του γλώσσα.',
  'workspace.timezone.label': 'Ζώνη ώρας',
  'workspace.dateFormat.label': 'Μορφή ημερομηνίας',
  'workspace.weekStart.label': 'Η εβδομάδα ξεκινά',
  'workspace.distance.label': 'Απόσταση',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Οι χρεώσεις δεν φόρτωσαν',
  'billing.loading': 'Φορτώνει το πλάνο και οι αποδείξεις του',
  'billing.status.none': 'Καμία συνδρομή',
  'billing.status.trialing': 'Δοκιμή',
  'billing.status.active': 'Ενεργή',
  'billing.status.past_due': 'Η πληρωμή απέτυχε',
  'billing.status.unpaid': 'Απλήρωτη',
  'billing.status.paused': 'Σε παύση',
  'billing.status.canceled': 'Ακυρωμένη',
  'billing.status.incomplete': 'Ημιτελής',
  'billing.status.incomplete_expired': 'Έληξε',

  'billing.checkout.completeTitle': 'Η πληρωμή ελήφθη',
  'billing.checkout.completeBody':
    'Το νέο σας πλάνο εφαρμόζεται. Εμφανίζεται εδώ τη στιγμή που το επιβεβαιώνει το Polar — συνήθως σε δευτερόλεπτα.',
  'billing.checkout.cancelledTitle': 'Η πληρωμή ακυρώθηκε',
  'billing.checkout.cancelledBody':
    'Δεν χρεώθηκε τίποτα και το πλάνο σας δεν άλλαξε.',
  'billing.portal.backTitle': 'Επιστροφή από το Polar',
  'billing.portal.backBody':
    'Ό,τι αλλάξατε εκεί φτάνει εδώ μόλις το επιβεβαιώσει το Polar.',
  'billing.refresh': 'Ανανέωση',
  'billing.readOnly.title': 'Είστε μέλος αυτού του χώρου εργασίας',
  'billing.readOnly.body':
    'Μόνο ιδιοκτήτης ή διαχειριστής αλλάζει τη συνδρομή. Όλα τα παρακάτω είναι μόνο για ανάγνωση για εσάς.',

  'billing.hero.label': 'Τρέχον πλάνο',
  'billing.hero.endsAtPeriod': 'Λήγει στο κλείσιμο της περιόδου',
  'billing.hero.perYear': '/ έτος',
  'billing.hero.perMonth': '/ μήνα',
  'billing.hero.freeAllowance': '{trips} ταξίδια, ένας ταξιδιώτης',
  'billing.hero.perSeatLine': '{seats} μέλη × {price}',
  'billing.hero.singleTraveller': 'Ένας ταξιδιώτης',
  'billing.price.free': 'Δωρεάν',
  'billing.provider.opening': 'Ανοίγει το Polar',
  'billing.renewal.trialEndsToday':
    'Η δοκιμαστική περίοδος λήγει σήμερα. Η πρώτη χρέωση ακολουθεί, εκτός αν ακυρώσεις πριν από τότε.',
  'billing.renewal.trialEndsIn': {
    one: 'Η δοκιμαστική περίοδος λήγει σε {value} ημέρα και μετά ακολουθεί η πρώτη χρέωση, εκτός αν ακυρώσεις πριν.',
    other:
      'Η δοκιμαστική περίοδος λήγει σε {value} ημέρες και μετά ακολουθεί η πρώτη χρέωση, εκτός αν ακυρώσεις πριν.',
  },
  'billing.renewal.trialEnded': 'Η δοκιμή σας έληξε.',
  'billing.renewal.endsNoDate':
    'Αυτό το πλάνο είναι ρυθμισμένο να λήξει και δεν θα ανανεωθεί.',
  'billing.renewal.endsOn':
    'Αυτό το πλάνο λήγει στις {date}. Τίποτα δεν διαγράφεται — οι επί πληρωμή ενότητες απλώς κλειδώνουν.',
  'billing.renewal.pastDue':
    'Η τελευταία πληρωμή δεν πέρασε. Ενημερώστε την κάρτα σας για να μη χάσετε τις επί πληρωμή ενότητες.',
  'billing.renewal.unpaid':
    'Αυτή η συνδρομή είναι απλήρωτη και οι επί πληρωμή ενότητες είναι κλειδωμένες.',
  'billing.renewal.paused':
    'Αυτή η συνδρομή είναι σε παύση. Συνεχίστε την όποτε είστε έτοιμοι να ταξιδέψετε ξανά.',
  'billing.renewal.lapsed':
    'Διαλέξτε πλάνο παρακάτω για να ξεκλειδώσετε ξανά κρατήσεις, χρονικό και χάρτες εκτός σύνδεσης.',
  'billing.renewal.incomplete':
    'Το Polar περιμένει ακόμη επιβεβαίωση αυτής της πληρωμής.',
  'billing.renewal.free':
    'Δύο ταξίδια μαζί, κερασμένα. Αναβαθμίστε όποτε σας μικρύνει.',
  'billing.renewal.auto': 'Ανανεώνεται αυτόματα.',
  'billing.renewal.renewsOn': 'Ανανεώνεται στις {date}.',

  'billing.usage.title': 'Χρήση',
  'billing.usage.description':
    'Μετριέται ζωντανά, ώστε κανένας δείκτης να μην είναι παλιός. Τα όρια ακολουθούν το πλάνο που ισχύει τώρα.',
  'billing.quota.seats': 'Μέλη',
  'billing.quota.trips': 'Ταξίδια',
  'billing.quota.storageBytes': 'Αποθηκευτικός χώρος',
  'billing.quota.unlimited': 'Χωρίς όριο',
  'billing.quota.places': 'Μέρη',
  'billing.quota.placesHint': 'Σε όλα τα ταξίδια αυτού του χώρου εργασίας',
  'billing.quota.exhausted.places': 'Το όριο μερών έχει εξαντληθεί',
  'billing.quota.over.places': 'Υπέρβαση του ορίου μερών κατά {value}',
  'billing.quota.noLimit': 'Κανένα όριο σε αυτό το πλάνο',
  'billing.quota.used': '{quota} σε χρήση',
  'billing.quota.over.seats': {
    one: '{value} θέση πάνω από το όριο αυτού του πλάνου',
    other: '{value} θέσεις πάνω από το όριο αυτού του πλάνου',
  },
  'billing.quota.over.trips': {
    one: '{value} θυρίδα ταξιδιού πάνω από το όριο αυτού του πλάνου',
    other: '{value} θυρίδες ταξιδιού πάνω από το όριο αυτού του πλάνου',
  },
  'billing.quota.over.storage': '{value} πάνω από το όριο αυτού του πλάνου',
  'billing.quota.exhausted.seats':
    'Όλες οι θέσεις αυτού του πλάνου είναι πιασμένες',
  'billing.quota.exhausted.trips':
    'Όλες οι θυρίδες ταξιδιών αυτού του πλάνου είναι σε χρήση',
  'billing.quota.exhausted.storage':
    'Ο αποθηκευτικός χώρος αυτού του πλάνου είναι γεμάτος',
  'billing.quota.left': 'απομένουν {value}',

  'billing.plans.title': 'Πλάνα',
  'billing.plans.description':
    'Αλλάξτε πλάνο όποτε θέλετε. Οι αναβαθμίσεις υπολογίζονται αναλογικά με την ημέρα· μια υποβάθμιση περιμένει να τελειώσει η περίοδος που έχετε πληρώσει.',
  'billing.interval.label': 'Περίοδος χρέωσης',
  'billing.interval.monthly': 'Μηνιαία',
  'billing.interval.yearly': 'Ετήσια',
  'billing.plan.free.name': 'Δωρεάν',
  'billing.plan.free.tagline': 'Σχεδιάστε τα δύο επόμενα ταξίδια σας',
  'billing.plan.free.feature.trips': 'Δύο ταξίδια μαζί και έως 150 μέρη',
  'billing.plan.free.feature.itinerary':
    'Πρόγραμμα ημέρα προς ημέρα και χάρτης',
  'billing.plan.free.feature.lists':
    'Λίστες αποσκευών και απλοί προϋπολογισμοί',
  'billing.plan.free.feature.atlas':
    'Ο παγκόσμιος χάρτης που κρατά πού έχετε πάει',
  'billing.plan.solo.name': 'Ατομικό',
  'billing.plan.solo.tagline': 'Για τον ταξιδιώτη που σχεδιάζει τα πάντα',
  'billing.plan.solo.feature.trips': 'Απεριόριστα ταξίδια και μέρη',
  'billing.plan.solo.feature.modules':
    'Κάθε ενότητα σχεδιασμού — κρατήσεις, χρονικό, προϋπολογισμοί, αποσκευές',
  'billing.plan.solo.feature.offline':
    'Χάρτες εκτός σύνδεσης που κατεβάζετε πριν πετάξετε',
  'billing.plan.solo.feature.export': 'Εξαγωγή σε PDF και σε ημερολόγιο',
  'billing.plan.crew.name': 'Ομαδικό',
  'billing.plan.crew.tagline': 'Για οικογένειες, φίλους και μικρές ομάδες',
  'billing.plan.crew.feature.members': 'Έως δέκα μέλη, με χρέωση κατά άτομο',
  'billing.plan.crew.feature.realtime':
    'Συνεργασία σε πραγματικό χρόνο με ζωντανούς δείκτες',
  'billing.plan.crew.feature.everything':
    'Απεριόριστα ταξίδια και μέρη και όλες οι ενότητες',
  'billing.plan.crew.feature.storage':
    'Κοινός χώρος για τις φωτογραφίες και τα έγγραφα όλων',

  'billing.plan.current': 'Τρέχον πλάνο',
  'billing.plan.currentBadge': 'Τρέχον',
  'billing.plan.popular': 'Δημοφιλές',
  'billing.plan.switchYearly': 'Αλλαγή σε ετήσιο',
  'billing.plan.switchMonthly': 'Αλλαγή σε μηνιαίο',
  'billing.plan.upgradeTo': 'Αναβάθμιση σε {plan}',
  'billing.plan.changeTo': 'Αλλαγή σε {plan}',
  'billing.plan.perMemberMonth': '/ μέλος / μήνα',
  'billing.plan.perMonth': '/ μήνα',
  'billing.plan.alwaysFree': 'Πάντα δωρεάν, χωρίς κάρτα',
  'billing.plan.billedYearly': '{amount} με ετήσια χρέωση',
  'billing.plan.billedMonthly': '{amount} με μηνιαία χρέωση',
  'billing.plan.members': 'Μέλη',
  'billing.plan.membersHint': 'Αλλάξτε τα όποτε θέλετε — η χρέωση ακολουθεί.',
  'billing.plan.seatOption': {
    one: '{value} μέλος',
    other: '{value} μέλη',
  },

  'billing.invoices.number': 'Τιμολόγιο',
  'billing.invoices.date': 'Ημερομηνία',
  'billing.invoices.amount': 'Ποσό',
  'billing.invoices.status': 'Κατάσταση',
  'billing.invoice.paid': 'Πληρωμένο',
  'billing.invoice.draft': 'Πρόχειρο',
  'billing.invoice.void': 'Άκυρο',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Ο πάροχος πληρωμών απέρριψε το αίτημα. Δοκίμασε ξανά σε λίγο.',
  'billing.failure.reference': 'Αναφορά για την υποστήριξη: {reference}',
  'billing.failure.forbidden':
    'Ο ρόλος σας δεν το επιτρέπει στην τιμολόγηση αυτού του χώρου εργασίας. Ζητήστε το από έναν ιδιοκτήτη ή διαχειριστή.',
  'billing.failure.providerRefused':
    'Το Polar δεν δέχτηκε αυτή την αλλαγή. Συγκρίνετε τον αριθμό θέσεων με τα μέλη σας και δοκιμάστε ξανά ή χρησιμοποιήστε την πύλη τιμολόγησης.',
  'billing.failure.rateLimited':
    'Το Polar είναι πολυάσχολο αυτή τη στιγμή. Τίποτα δεν άλλαξε. Δοκιμάστε ξανά σε ένα λεπτό.',
  'billing.failure.notConnected':
    'Η τιμολόγηση δεν έχει συνδεθεί ακόμη σε αυτή την εγκατάσταση, οπότε τίποτα δεν άλλαξε. Επικοινωνήστε με την υποστήριξη.',
  'billing.failure.orderNotInvoiceable':
    'Το Polar δεν μπορεί να εκδώσει τιμολόγιο για αυτή την παραγγελία. Αν λείπει το όνομα ή η διεύθυνση τιμολόγησης, προσθέστε τα στην πύλη τιμολόγησης και δοκιμάστε ξανά· διαφορετικά επικοινωνήστε με την υποστήριξη.',
  'billing.planChanged.title': 'Το πρόγραμμα ενημερώθηκε',
  'billing.planChanged.body':
    'Η αλλαγή ισχύει ήδη στην Polar, που θα χρεώσει τη διαφορά. Η σύνοψη παρακάτω προλαβαίνει μέσα σε ένα λεπτό.',
  'billing.discount.toggle': 'Έχετε κωδικό προσφοράς;',
  'billing.discount.label': 'Κωδικός προσφοράς',
  'billing.discount.hint': 'Εφαρμόζεται στο πρόγραμμα που θα επιλέξετε.',
  'billing.discount.hintCurrent':
    'Εφαρμόστε τον στο τρέχον πρόγραμμά σας ή επιλέξτε ένα πρόγραμμα παρακάτω.',
  'billing.discount.applyCurrent': 'Εφαρμογή στο τρέχον πρόγραμμα',
  'billing.discount.applying': 'Εφαρμογή κωδικού…',
  'billing.discount.invalidFormat':
    'Οι κωδικοί έχουν 3 έως 64 γράμματα και ψηφία.',
  'billing.discount.rejected.invalid':
    'Ο κωδικός δεν είναι έγκυρος. Ελέγξτε τον και δοκιμάστε ξανά.',
  'billing.discount.rejected.rateLimited':
    'Δοκιμάστηκαν πάρα πολλοί κωδικοί. Δοκιμάστε ξανά σε μία ώρα.',
  'billing.discount.rejected.notApplicable':
    'Ο κωδικός δεν ισχύει για αυτό το πρόγραμμα.',
  'billing.discount.rejected.busy':
    'Οι κωδικοί δεν μπορούν να ελεγχθούν τώρα. Δοκιμάστε ξανά σε ένα λεπτό.',
  'billing.discount.nextRenewal':
    'Ο κωδικός προσφοράς ισχύει από την επόμενη ανανέωση.',
  'billing.discount.appliedTitle': 'Ο κωδικός προσφοράς εφαρμόστηκε',
  'billing.hero.manage': 'Διαχείριση χρεώσεων',
  'billing.hero.manageHint':
    'Κάρτες, διεύθυνση χρέωσης, ΑΦΜ, αποδείξεις και ακύρωση βρίσκονται στην Polar, που εκδίδει το παραστατικό.',
  'billing.hero.manageHintNone':
    'Δεν υπάρχει ακόμη προφίλ χρέωσης. Επιλέγοντας ένα πληρωμένο πρόγραμμα παρακάτω δημιουργείται ένα, και από τότε ανοίγει η πύλη.',
  'billing.portal.opening': 'Ανοίγει η πύλη χρεώσεων',
  'billing.plan.notApplied': 'Η αλλαγή δεν εφαρμόστηκε',
  'billing.plan.cancelInPortal': 'Ακύρωση στην πύλη',
  'billing.plan.seatsOverMax': {
    one: 'Αυτός ο χώρος έχει {members} μέλη και το {plan} χρεώνει το πολύ {max}. Αφαίρεσε {value} μέλος πριν αλλάξεις.',
    other:
      'Αυτός ο χώρος έχει {members} μέλη και το {plan} χρεώνει το πολύ {max}. Αφαίρεσε {value} μέλη πριν αλλάξεις.',
  },
  'billing.plan.seatsBelowMembers':
    'Έχεις {members} μέλη. Διάλεξε τουλάχιστον τόσες θέσεις — η Polar απορρίπτει συνδρομή με λιγότερες θέσεις από αναθέσεις.',
  'billing.orders.title': 'Παραγγελίες',
  'billing.orders.description':
    'Κάθε παραγγελία αυτού του χώρου, από την πιο πρόσφατη.',
  'billing.orders.receipts': 'Όλες οι αποδείξεις',
  'billing.orders.unavailableTitle': 'Οι παραγγελίες δεν φορτώνουν',
  'billing.orders.unavailableBody':
    'Η Polar δεν απάντησε εγκαίρως για το ιστορικό. Όλα τα παραπάνω είναι ενημερωμένα — δοκίμασε σε λίγο ή δες το πλήρες αρχείο στην πύλη χρεώσεων.',
  'billing.orders.emptyTitle': 'Καμία παραγγελία ακόμη',
  'billing.orders.emptyCustomer':
    'Το πρώτο παραστατικό εμφανίζεται εδώ μόλις κλείσει μια περίοδος χρέωσης.',
  'billing.orders.emptyNoCustomer':
    'Αυτός ο χώρος δεν χρεώθηκε ποτέ. Διάλεξε ένα πληρωμένο πρόγραμμα και τα παραστατικά θα συγκεντρώνονται εδώ.',
  'billing.orders.tableLabel': 'Ιστορικό παραγγελιών',
  'billing.orders.document': 'Έγγραφο',
  'billing.orders.dateUnknown': 'Άγνωστη ημερομηνία',
  'billing.order.pending': 'Σε εκκρεμότητα',
  'billing.order.refunded': 'Επιστράφηκε',
  'billing.order.partiallyRefunded': 'Επιστράφηκε εν μέρει',
  'billing.order.noInvoiceDraft':
    'Κανένα παραστατικό όσο η παραγγελία είναι πρόχειρη',
  'billing.order.preparing': 'Ετοιμάζεται',
  'billing.order.renderingHint':
    'Η Polar δημιουργεί ακόμη το παραστατικό {number}. Η λήψη επιστρέφει σε λίγα δευτερόλεπτα.',
  'billing.order.fetching': 'Λήψη του παραστατικού',
  'billing.order.generating': 'Η Polar ετοιμάζει το παραστατικό',
  'billing.order.pdfLabel': 'Παραστατικό {number} σε PDF',
  'billing.order.stillWritingTitle': 'Η Polar γράφει ακόμη αυτό το παραστατικό',
  'billing.order.stillWritingBody':
    'Το παραστατικό {number} δημιουργείται. Η λήψη επιστρέφει από μόνη της σε λίγα δευτερόλεπτα.',
  'billing.order.openFailed': 'Αυτό το παραστατικό δεν άνοιξε',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Λογαριασμός',
  'passkeys.page.title': 'Κλειδιά πρόσβασης',
  'passkeys.page.description':
    'Ένα κλειδί πρόσβασης σάς επιτρέπει να συνδεθείτε με το δακτυλικό αποτύπωμα, το πρόσωπό σας ή ένα κλειδί ασφαλείας, χωρίς να πληκτρολογήσετε τίποτα.',
  'passkeys.page.back': 'Πίσω στην ασφάλεια',
  'passkeys.list.label': 'Τα κλειδιά πρόσβασής σας',
  'passkeys.add.action': 'Προσθήκη κλειδιού πρόσβασης',
  'passkeys.add.loading': 'Αναμονή για τη συσκευή σας',
  'passkeys.add.added': 'Το κλειδί πρόσβασης προστέθηκε',
  'passkeys.add.dismissed': 'Δεν προστέθηκε κανένα κλειδί πρόσβασης',
  'passkeys.add.exists':
    'Αυτή η συσκευή έχει ήδη κλειδί πρόσβασης για τον λογαριασμό σας',
  'passkeys.add.failed': 'Το κλειδί πρόσβασης δεν προστέθηκε. Δοκιμάστε ξανά.',
  'passkeys.add.stale':
    'Για την ασφάλειά σας, συνδεθείτε ξανά για να συνεχίσετε.',
  'passkeys.error.sessionEnded':
    'Η συνεδρία σας έληξε. Συνδεθείτε ξανά για να συνεχίσετε.',
  'passkeys.signInAgain': 'Σύνδεση ξανά',
  'passkeys.add.limit':
    'Φτάσατε το όριο των {value} κλειδιών πρόσβασης. Αφαιρέστε ένα για να προσθέσετε άλλο.',
  'passkeys.add.unsupported':
    'Αυτό το πρόγραμμα περιήγησης δεν μπορεί να δημιουργήσει κλειδιά πρόσβασης. Δοκιμάστε άλλο πρόγραμμα ή άλλη συσκευή.',
  'passkeys.empty.title': 'Κανένα κλειδί πρόσβασης ακόμη',
  'passkeys.empty.body':
    'Προσθέστε ένα και θα συνδέεστε με το δακτυλικό αποτύπωμα, το πρόσωπό σας ή ένα κλειδί ασφαλείας, χωρίς να πληκτρολογείτε τίποτα.',
  'passkeys.row.fallbackName': 'Κλειδί πρόσβασης · προστέθηκε στις {date}',
  'passkeys.row.added': 'Προστέθηκε στις {date}',
  'passkeys.row.lastUsed': 'Τελευταία χρήση: {date}',
  'passkeys.row.neverUsed': 'Δεν έχει χρησιμοποιηθεί ακόμη για σύνδεση',
  'passkeys.badge.synced': 'Συγχρονισμένο',
  'passkeys.badge.singleDevice': 'Μόνο σε μία συσκευή',
  'passkeys.error.title': 'Τα κλειδιά πρόσβασής σας δεν φορτώθηκαν',
  'passkeys.error.retry': 'Δοκιμή ξανά',
  'passkeys.error.rateLimited':
    'Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.',
  'passkeys.error.generic': 'Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Μετονομασία του {name}',
  'passkeys.rename.fieldLabel': 'Δώστε όνομα σε αυτό το κλειδί πρόσβασης',
  'passkeys.rename.placeholder': 'Δώστε του όνομα, π.χ. Κινητό εργασίας',
  'passkeys.rename.saving': 'Αποθήκευση του ονόματος',
  'passkeys.rename.saved': 'Το όνομα αποθηκεύτηκε',
  'passkeys.rename.failed': 'Το όνομα δεν αποθηκεύτηκε',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Αφαίρεση του {name}',
  'passkeys.delete.title': 'Να αφαιρεθεί αυτό το κλειδί πρόσβασης;',
  'passkeys.delete.body': 'Δεν θα μπορείτε πια να συνδέεστε με το {name}.',
  'passkeys.delete.password': 'Κωδικός πρόσβασης',
  'passkeys.delete.passwordHint':
    'Εισαγάγετε τον κωδικό πρόσβασής σας για επιβεβαίωση.',
  'passkeys.delete.confirmOnly':
    'Ο λογαριασμός σας δεν έχει κωδικό πρόσβασης. Επιβεβαιώστε ότι θέλετε να αφαιρέσετε αυτό το κλειδί πρόσβασης.',
  'passkeys.delete.confirm': 'Αφαίρεση κλειδιού πρόσβασης',
  'passkeys.delete.cancel': 'Ακύρωση',
  'passkeys.delete.wrongPassword':
    'Αυτός ο κωδικός πρόσβασης δεν είναι σωστός.',
  'passkeys.delete.stale':
    'Για την ασφάλειά σας, συνδεθείτε ξανά πριν αφαιρέσετε ένα κλειδί πρόσβασης.',
  'passkeys.delete.removed': 'Το κλειδί πρόσβασης αφαιρέθηκε',
  'passkeys.delete.failed':
    'Το κλειδί πρόσβασης δεν αφαιρέθηκε. Δοκιμάστε ξανά.',
  'passkeys.delete.removing': 'Αφαίρεση του κλειδιού πρόσβασης',
  'passkeys.delete.passwordRequired':
    'Εισαγάγετε τον κωδικό πρόσβασής σας για να αφαιρέσετε αυτό το κλειδί πρόσβασης.',
  'workspace.departure.leave': 'Αποχώρηση από τον χώρο εργασίας',
  'workspace.departure.remove': 'Αφαίρεση μέλους',
  'workspace.departure.title': 'Λήξη συμμετοχής στο {workspace};',
  'workspace.departure.body':
    'Το μέλος {name} θα χάσει την πρόσβαση στο {workspace}. Ο λογαριασμός του και τα διατηρημένα ταξίδια και αρχεία εξόδων θα παραμείνουν.',
  'workspace.departure.cancel': 'Ακύρωση',
  'workspace.departure.pending': 'Λήξη συμμετοχής…',
  'workspace.departure.lastOwner':
    'Ορίστε άλλο μέλος ως ιδιοκτήτη πριν αποχωρήσετε ή αφαιρέσετε αυτόν τον ιδιοκτήτη.',
  'workspace.departure.notPermitted':
    'Ο τρέχων ρόλος σας δεν επιτρέπει την αφαίρεση αυτού του μέλους. Ανανεώστε τη λίστα μελών πριν προσπαθήσετε ξανά.',
  'workspace.departure.notFound':
    'Αυτό το άτομο δεν είναι πλέον μέλος αυτού του χώρου εργασίας.',
  'workspace.departure.impersonated':
    'Σταματήστε την προσωποποίηση πριν αλλάξετε τη συμμετοχή στον χώρο εργασίας.',
  'workspace.departure.failed':
    'Δεν ήταν δυνατή η επιβεβαίωση του αποτελέσματος. Φορτώστε ξανά τον χώρο εργασίας πριν προσπαθήσετε ξανά.',
  'workspace.departure.removed': 'Το μέλος αφαιρέθηκε',
  'workspace.departure.reload': 'Επαναφόρτωση χώρου εργασίας',
  'workspace.departure.activationFailed':
    'Αποχωρήσατε από αυτόν τον χώρο εργασίας. Ανοίξτε τον επόμενο για να συνεχίσετε.',
  'workspace.departure.recover': 'Άνοιγμα επόμενου χώρου',
} satisfies TranslationOf<typeof En>

export default messages
