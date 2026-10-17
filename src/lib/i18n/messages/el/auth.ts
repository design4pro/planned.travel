/**
 * Everything the authentication screens say, in Greek.
 *
 * Made from `../en/auth.ts` and from nothing else. `docs/SPEC.md` §1 and §8.9
 * forbid deriving a catalogue from the reference project's AGPL translations, so
 * every sentence here was written against our English source.
 *
 * These are the only screens a traveller reaches with no session, so their
 * language comes purely from `Accept-Language` and there is no stored preference
 * to correct a bad guess with. Two thirds of the keys are validation messages
 * and failure alerts, which appear exactly when a reader can least afford a
 * sentence in a language they do not read.
 *
 * **What is not translated.** `{provider}` is a trademark, `planned.travel` is
 * our own wordmark and `example.com` is the reserved example domain — only the
 * local part of the sample address and the sample person's name are localised,
 * so a Greek reader sees a name that reads as a name.
 */

import type En from '../en/auth'
import type { TranslationOf } from '../../types'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Αρχική του planned.travel',
  'shell.legal':
    'Συνεχίζοντας συμφωνείτε με τους όρους χρήσης και τη δήλωση απορρήτου του planned.travel.',

  'panel.eyebrow': 'Σχεδιάστε μαζί',
  'panel.heading':
    'Κάθε ταξίδι, από την πρώτη πινέζα ως την τελευταία καρτ ποστάλ.',
  'panel.body':
    'Κοινά προγράμματα σε αληθινό χάρτη, προϋπολογισμοί που όντως βγαίνουν, λίστες αποσκευών που θυμούνται, και ένα χρονικό που αξίζει να κρατήσετε.',
  'panel.map.title': 'Ένας χάρτης, ένα πρόγραμμα',
  'panel.map.detail': 'Κάθε στάση, διαμονή και μεταφορά σε ένα πρόγραμμα.',
  'panel.group.title': 'Όλοι στο ίδιο βήμα',
  'panel.group.detail':
    'Αλλαγές, ψήφοι και σχόλια φτάνουν ζωντανά σε όλη την ομάδα.',
  'panel.costs.title': 'Κόστη που βγαίνουν',
  'panel.costs.detail':
    'Κοινοί προϋπολογισμοί, εξοφλημένα υπόλοιπα, κανένα λογιστικό φύλλο.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'ή',
  'divider.orEmail': 'ή με το email σας',

  'social.continue': 'Συνέχεια με {provider}',
  'social.signUp': 'Εγγραφή με {provider}',
  'social.opening': 'Ανοίγει το {provider}',

  'passkey.action': 'Σύνδεση με κλειδί πρόσβασης',
  'passkey.waiting': 'Αναμονή για τη συσκευή σας',

  'password.show': 'Εμφάνιση κωδικού',
  'password.hide': 'Απόκρυψη κωδικού',
  'password.showNew': 'Εμφάνιση νέου κωδικού',
  'password.hideNew': 'Απόκρυψη νέου κωδικού',
  'password.showConfirm': 'Εμφάνιση επιβεβαίωσης κωδικού',
  'password.hideConfirm': 'Απόκρυψη επιβεβαίωσης κωδικού',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Διεύθυνση email',
  'field.email.placeholder': 'giorgos@example.com',
  'field.password': 'Κωδικός',
  'field.password.placeholder': 'Ο κωδικός σας',
  'field.newPassword': 'Νέος κωδικός',
  'field.newPassword.placeholder': 'Μια φράση που θα θυμάστε',
  'field.confirmPassword': 'Επιβεβαίωση κωδικού',
  'field.confirmNewPassword': 'Επιβεβαίωση νέου κωδικού',
  'field.confirmPassword.placeholder': 'Γράψτε τον ξανά',
  'field.name': 'Το όνομά σας',
  'field.name.hint': 'Το βλέπουν όσοι σχεδιάζουν ταξίδια μαζί σας.',
  'field.name.placeholder': 'Γιώργος Παπαδάκης',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Συμπληρώστε τη διεύθυνση email σας.',
  'validation.emailTooLong': 'Αυτή η διεύθυνση email είναι πολύ μεγάλη.',
  'validation.emailInvalid': 'Αυτό δεν μοιάζει με διεύθυνση email.',
  'validation.passwordRequired': 'Συμπληρώστε τον κωδικό σας.',
  'validation.passwordShort': {
    one: 'Βάλτε τουλάχιστον {value} χαρακτήρα — μια σύντομη φράση κερδίζει από μια έξυπνη λέξη.',
    other:
      'Βάλτε τουλάχιστον {value} χαρακτήρες — μια σύντομη φράση κερδίζει από μια έξυπνη λέξη.',
  },
  'validation.passwordLong': {
    one: 'Κρατήστε τον κάτω από {value} χαρακτήρα.',
    other: 'Κρατήστε τον κάτω από {value} χαρακτήρες.',
  },
  'validation.passwordMismatch': 'Οι κωδικοί δεν ταιριάζουν.',
  'validation.nameShort':
    'Γράψτε το όνομά σας, να ξέρουν οι συνταξιδιώτες ποιος είστε.',
  'validation.nameTooLong': 'Αυτό το όνομα είναι πολύ μεγάλο.',
  'validation.termsRequired': 'Αποδεχτείτε τους όρους για να συνεχίσετε.',
  'validation.codeLength': 'Οι κωδικοί ταυτοποίησης έχουν έξι ψηφία.',
  'validation.codeDigits': 'Οι κωδικοί ταυτοποίησης έχουν μόνο ψηφία.',
  'validation.backupShort': 'Αυτός ο κωδικός ασφαλείας φαίνεται πολύ μικρός.',
  'validation.backupLong': 'Αυτός ο κωδικός ασφαλείας φαίνεται πολύ μεγάλος.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Καλώς ήρθατε πάλι',
  'login.heading': 'Συνδεθείτε στο planned.travel',
  'login.description':
    'Πιάστε τα προγράμματα, τους προϋπολογισμούς και τις λίστες σας εκεί που τα αφήσατε.',
  'login.newHere': 'Πρώτη φορά εδώ;',
  'login.createAccount': 'Δημιουργήστε λογαριασμό',
  'login.forgot': 'Ξεχάσατε τον κωδικό;',
  'login.remember': 'Να μένω συνδεδεμένος σε αυτή τη συσκευή',
  'login.submit': 'Σύνδεση',
  'login.submitting': 'Συνδέεστε',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Δημιουργήστε τον λογαριασμό σας',
  'register.heading': 'Ξεκινήστε τον σχεδιασμό σε δύο λεπτά',
  'register.description':
    'Ένας λογαριασμός καλύπτει κάθε ταξίδι, κάθε συνταξιδιώτη και κάθε λίστα.',
  'register.haveAccount': 'Έχετε ήδη λογαριασμό;',
  'register.signIn': 'Σύνδεση',
  'register.terms': 'Συμφωνώ με τους όρους χρήσης και τη δήλωση απορρήτου.',
  'register.submit': 'Δημιουργία λογαριασμού',
  'register.submitting': 'Δημιουργείται ο λογαριασμός σας',

  'strength.hint': {
    one: 'Τουλάχιστον {value} χαρακτήρας. Μια σύντομη φράση κερδίζει από μια έξυπνη λέξη.',
    other:
      'Τουλάχιστον {value} χαρακτήρες. Μια σύντομη φράση κερδίζει από μια έξυπνη λέξη.',
  },
  'strength.tooShort': 'Ισχύς: Πολύ μικρός',
  'strength.weak': 'Ισχύς: Αδύναμος',
  'strength.fair': 'Ισχύς: Μέτριος',
  'strength.strong': 'Ισχύς: Δυνατός',
  'strength.excellent': 'Ισχύς: Εξαιρετικός',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Βοήθεια με τον κωδικό',
  'forgot.heading': 'Επαναφέρετε τον κωδικό σας',
  'forgot.description':
    'Πείτε μας τη διεύθυνση του λογαριασμού σας και θα σας στείλουμε σύνδεσμο για νέο κωδικό.',
  'forgot.submit': 'Στείλτε μου σύνδεσμο επαναφοράς',
  'forgot.submitting': 'Στέλνεται ο σύνδεσμός σας',
  'forgot.back': 'Πίσω στη σύνδεση',
  'forgot.sent.eyebrow': 'Δείτε τα εισερχόμενά σας',
  'forgot.sent.heading': 'Ο σύνδεσμος επαναφοράς έφυγε',
  'forgot.sent.description':
    'Αν κάποιος λογαριασμός χρησιμοποιεί το {email}, ο σύνδεσμος για νέο κωδικό βρίσκεται τώρα σε εκείνα τα εισερχόμενα.',
  'forgot.sent.title': 'Ο σύνδεσμος δουλεύει μία φορά, για μία ώρα',
  'forgot.sent.body':
    'Δεν ήρθε τίποτα; Δείτε τα ανεπιθύμητα και στείλτε τον ξανά. Ένας νέος σύνδεσμος αποσύρει αθόρυβα τον προηγούμενο.',
  'forgot.sent.resend': 'Στείλτε τον ξανά',
  'forgot.sent.resending': 'Στέλνεται ξανά',
  'forgot.sent.change': 'Χρησιμοποιήστε άλλο email',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Επαναφορά κωδικού',
  'reset.heading': 'Διαλέξτε νέο κωδικό',
  'reset.description': {
    one: 'Διαλέξτε κάτι με τουλάχιστον {value} χαρακτήρα. Μια σύντομη φράση είναι πιο εύκολη να θυμηθείτε και πιο δύσκολη να μαντέψει κανείς.',
    other:
      'Διαλέξτε κάτι με τουλάχιστον {value} χαρακτήρες. Μια σύντομη φράση είναι πιο εύκολη να θυμηθείτε και πιο δύσκολη να μαντέψει κανείς.',
  },
  'reset.submit': 'Ορισμός νέου κωδικού',
  'reset.submitting': 'Αποθηκεύεται ο κωδικός σας',
  'reset.back': 'Πίσω στη σύνδεση',
  'reset.stale.heading': 'Αυτός ο σύνδεσμος δεν μπορεί να χρησιμοποιηθεί',
  'reset.stale.description':
    'Οι σύνδεσμοι επαναφοράς λήγουν μετά από μία ώρα και δουλεύουν μόνο μία φορά — η ασφαλέστερη δυνατή συναλλαγή.',
  'reset.stale.action': 'Ζητήστε νέο σύνδεσμο',
  'reset.done.heading': 'Ο νέος κωδικός σας ορίστηκε',
  'reset.done.description':
    'Κάθε άλλη συνεδρία αποσυνδέθηκε, ώστε όποιος είχε τον παλιό κωδικό να μην έχει πια τρόπο να μπει.',
  'reset.done.title': 'Αποσυνδεθήκατε από όλα τα άλλα',
  'reset.done.body':
    'Συνδεθείτε με τον νέο κωδικό σας για να συνεχίσετε τον σχεδιασμό.',
  'reset.done.action': 'Σύνδεση',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Ταυτοποίηση δύο παραγόντων',
  'twoFactor.heading': 'Επιβεβαιώστε ότι είστε εσείς',
  'twoFactor.description':
    'Ο λογαριασμός σας προστατεύεται από δεύτερο παράγοντα. Βάλτε τον τρέχοντα κωδικό από την εφαρμογή ταυτοποίησης.',
  'twoFactor.back': 'Ξεκινήστε πάλι από τη σύνδεση',
  'twoFactor.methods': 'Μέθοδος επιβεβαίωσης',
  'twoFactor.totp.tab': 'Εφαρμογή ταυτοποίησης',
  'twoFactor.totp.label': 'Εξαψήφιος κωδικός',
  'twoFactor.totp.hint': 'Οι κωδικοί ανανεώνονται κάθε τριάντα δευτερόλεπτα.',
  'twoFactor.totp.submit': 'Επιβεβαίωση και συνέχεια',
  'twoFactor.backup.tab': 'Κωδικός ασφαλείας',
  'twoFactor.backup.label': 'Κωδικός ασφαλείας',
  'twoFactor.backup.hint':
    'Από τη λίστα που κρατήσατε όταν ενεργοποιήσατε τους δύο παράγοντες. Κάθε κωδικός δουλεύει μία φορά.',
  'twoFactor.backup.submit': 'Χρήση κωδικού ασφαλείας',
  'twoFactor.submitting': 'Ελέγχεται ο κωδικός σας',
  'twoFactor.trust.label': 'Εμπιστεύσου αυτή τη συσκευή για τριάντα ημέρες',
  'twoFactor.trust.detail':
    'Παράλειψη αυτού του βήματος σε αυτό το πρόγραμμα περιήγησης μέχρι τότε. Κάντε το μόνο σε συσκευή που είναι αποκλειστικά δική σας.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Το email επιβεβαιώθηκε',
  'verify.done.heading': 'Είστε έτοιμοι',
  'verify.done.description':
    'Η διεύθυνσή σας επιβεβαιώθηκε, ώστε προσκλήσεις, υπενθυμίσεις και συνόψεις ταξιδιών να σας φτάνουν.',
  'verify.done.title': 'Επιβεβαιωμένη',
  'verify.done.body': 'Το {email} επιβεβαιώθηκε σε αυτόν τον λογαριασμό.',
  'verify.done.bodyUnknown':
    'Η διεύθυνση email σας επιβεβαιώθηκε σε αυτόν τον λογαριασμό.',
  'verify.done.action': 'Πηγαίνετε στον πίνακά σας',

  'verify.pending.eyebrow': 'Ένα τελευταίο πράγμα',
  'verify.pending.heading': 'Επιβεβαιώστε το email σας',
  'verify.pending.description':
    'Στείλαμε σύνδεσμο επιβεβαίωσης στο {email}. Ανοίγοντάς τον, ο λογαριασμός σας μένει ανακτήσιμος και οι συνταξιδιώτες μπορούν να σας προσκαλέσουν.',
  'verify.pending.wrongAddress': 'Λάθος διεύθυνση;',
  'verify.pending.changeIt': 'Αλλάξτε τη στις ρυθμίσεις',
  'verify.pending.title': 'Ο σύνδεσμος κρατά 24 ώρες',
  'verify.pending.body':
    'Τίποτα στα εισερχόμενα; Δείτε τα ανεπιθύμητα και στείλτε τον ξανά.',
  'verify.pending.resentTitle': 'Στάλθηκε ξανά μόλις τώρα',
  'verify.pending.resentBody':
    'Δώστε του ένα λεπτό και δείτε τα εισερχόμενα — και τα ανεπιθύμητα.',
  'verify.pending.resend': 'Επαναποστολή επιβεβαίωσης',
  'verify.pending.resending': 'Στέλνεται ξανά',
  'verify.pending.continue': 'Συνέχεια πάντως',

  'verify.request.eyebrow': 'Επιβεβαίωση email',
  'verify.request.heading': 'Στείλτε νέο σύνδεσμο επιβεβαίωσης',
  'verify.request.description':
    'Οι σύνδεσμοι επιβεβαίωσης κρατούν 24 ώρες και δουλεύουν μόνο μία φορά. Πείτε μας τη διεύθυνσή σας και φεύγει καινούριος.',
  'verify.request.submit': 'Αποστολή συνδέσμου επιβεβαίωσης',
  'verify.request.submitting': 'Στέλνεται ο σύνδεσμός σας',
  'verify.request.sentTitle': 'Καθ’ οδόν',
  'verify.request.sentBody':
    'Αν αυτή η διεύθυνση έχει λογαριασμό που περιμένει επιβεβαίωση, ο σύνδεσμος είναι τώρα στα εισερχόμενά της.',
  'verify.request.change': 'Χρησιμοποιήστε άλλο email',
  'verify.request.back': 'Πίσω στη σύνδεση',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Πρόσκληση σε χώρο εργασίας',
  'invitation.heading': 'Μπείτε στο {workspace}',
  'invitation.description':
    'Η αποδοχή σας προσθέτει σε αυτόν τον χώρο εργασίας και σας μοιράζεται τα ταξίδια, τους προϋπολογισμούς και τις λίστες του.',
  'invitation.invitedAs': 'Προσκλήθηκε ως {email}',
  'invitation.role': 'Ο ρόλος σας',
  'invitation.means': 'Σημαίνει',
  'invitation.invitedBy': 'Πρόσκληση από',
  'invitation.expires': 'Λήγει',
  'invitation.accept': 'Αποδοχή πρόσκλησης',
  'invitation.accepting': 'Μπαίνετε στον χώρο εργασίας',
  'invitation.decline': 'Απόρριψη',
  'invitation.declining': 'Απορρίπτεται',
  'invitation.reassurance':
    'Μπορείτε να φύγετε από έναν χώρο εργασίας όποτε θέλετε από τις ρυθμίσεις του, και ό,τι φτιάχνετε έξω από αυτόν δεν μοιράζεται ποτέ.',

  'invitation.role.owner': 'Ιδιοκτήτης — πλήρης έλεγχος, μαζί με τις χρεώσεις',
  'invitation.role.admin':
    'Διαχειριστής — διαχείριση ταξιδιών, μελών και ρυθμίσεων',
  'invitation.role.member': 'Μέλος — σχεδιάζει ταξίδια μαζί με όλους',
  'invitation.role.other':
    '{role} — η πρόσβαση ορίζεται από τον ιδιοκτήτη του χώρου',
  'invitation.role.badge.owner': 'Ιδιοκτήτης',
  'invitation.role.badge.admin': 'Διαχειριστής',
  'invitation.role.badge.member': 'Μέλος',

  'invitation.anonymous.heading': 'Συνδεθείτε για να δείτε την πρόσκλησή σας',
  'invitation.anonymous.description':
    'Οι προσκλήσεις είναι δεμένες με τη διεύθυνση στην οποία στάλθηκαν, οπότε πρέπει να ξέρουμε ποιος είστε πριν σας τη δείξουμε.',
  'invitation.anonymous.body':
    'Χρησιμοποιήστε τη διεύθυνση στην οποία στάλθηκε η πρόσκληση. Θα σας φέρουμε αμέσως πίσω εδώ.',
  'invitation.anonymous.action': 'Συνδεθείτε για να συνεχίσετε',
  'invitation.anonymous.noAccount': 'Δεν έχετε λογαριασμό;',
  'invitation.anonymous.register':
    'Φτιάξτε έναν με τη διεύθυνση της πρόσκλησης',

  'invitation.mismatch.heading': 'Αυτή η πρόσκληση είναι για άλλη διεύθυνση',
  'invitation.mismatch.description':
    'Είστε συνδεδεμένοι ως κάποιος άλλος, οπότε αυτή δεν είναι δική σας για να την αποδεχτείτε.',
  'invitation.mismatch.title': 'Συνδεδεμένοι ως {email}',
  'invitation.mismatch.body':
    'Αποσυνδεθείτε και μπείτε με τη διεύθυνση στην οποία στάλθηκε η πρόσκληση, ή ζητήστε νέα πρόσκληση σε αυτόν τον λογαριασμό.',
  'invitation.mismatch.action': 'Αλλαγή λογαριασμού',
  'invitation.mismatch.back': 'Πίσω στη σύνδεση',

  'invitation.unverified.heading': 'Επιβεβαιώστε το email σας για να μπείτε',
  'invitation.unverified.description':
    'Οι χώροι εργασίας δέχονται μόνο επιβεβαιωμένες διευθύνσεις, ώστε κανείς να μην μπαίνει από τυπογραφικό λάθος.',
  'invitation.unverified.title': 'Το {email} δεν έχει επιβεβαιωθεί ακόμη',
  'invitation.unverified.body':
    'Ανοίξτε τον σύνδεσμο επιβεβαίωσης στα εισερχόμενά σας και γυρίστε σε αυτή τη σελίδα. Η πρόσκληση θα σας περιμένει.',
  'invitation.unverified.action': 'Επιβεβαίωση του email μου',
  'invitation.unverified.resend': 'Επαναποστολή του email επιβεβαίωσης',

  'invitation.unavailable.heading': 'Αυτή η πρόσκληση δεν είναι πια διαθέσιμη',
  'invitation.unavailable.description':
    'Οι προσκλήσεις κρατούν επτά ημέρες και αποσύρονται τη στιγμή που χρησιμοποιούνται ή ανακαλούνται.',
  'invitation.unavailable.title': 'Τίποτα για αποδοχή εδώ',
  'invitation.unavailable.body':
    'Ζητήστε από όποιον σας προσκάλεσε να στείλει καινούρια πρόσκληση, και αυτή η σελίδα θα τη δείξει αμέσως.',
  'invitation.unavailable.dashboard': 'Πηγαίνετε στον πίνακά σας',

  'invitation.declined.eyebrow': 'Η πρόσκληση απορρίφθηκε',
  'invitation.declined.heading': 'Κανένα πρόβλημα — τίποτα δεν μοιράστηκε',
  'invitation.declined.description':
    'Ο ιδιοκτήτης του χώρου ενημερώθηκε, και αυτός ο σύνδεσμος δεν μπορεί πια να χρησιμοποιηθεί.',
  'invitation.declined.action': 'Πηγαίνετε στον πίνακά σας',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Κάτι πήγε λάθος',
  'error.unexpected.detail': 'Αυτό δεν δούλεψε. Δοκιμάστε ξανά σε λίγο.',
  'error.rateLimited.title': 'Πάρα πολλές προσπάθειες',
  'error.rateLimited.detail':
    'Για την ασφάλειά σας σταματήσαμε τη σύνδεση από αυτή τη συσκευή για λίγα λεπτά. Δοκιμάστε σύντομα.',
  'error.offline.title': 'Καμία σύνδεση',
  'error.offline.detail':
    'Δεν φτάσαμε στο planned.travel. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',

  'error.credentials.title': 'Αυτά τα στοιχεία δεν ταιριάζουν',
  'error.credentials.detail':
    'Ελέγξτε τη διεύθυνση email και τον κωδικό και δοκιμάστε ξανά. Αν εγγραφήκατε με Google ή Apple, χρησιμοποιήστε εκείνο το κουμπί.',
  'error.password.title': 'Αυτά τα στοιχεία δεν ταιριάζουν',
  'error.password.detail':
    'Ελέγξτε τη διεύθυνση email και τον κωδικό και δοκιμάστε ξανά.',
  'error.noPassword.title': 'Κανένας κωδικός σε αυτόν τον λογαριασμό',
  'error.noPassword.detail':
    'Αυτός ο λογαριασμός συνδέεται με πάροχο ή με κλειδί πρόσβασης. Χρησιμοποιήστε μια από τις επιλογές πιο πάνω.',
  'error.unverified.title': 'Επιβεβαιώστε πρώτα το email σας',
  'error.unverified.detail':
    'Σας στείλαμε σύνδεσμο επιβεβαίωσης όταν εγγραφήκατε. Ανοίξτε τον και γυρίστε εδώ.',
  'error.emailTaken.title': 'Αυτό το email είναι ήδη εγγεγραμμένο',
  'error.emailTaken.detail':
    'Συνδεθείτε αντ’ αυτού, ή επαναφέρετε τον κωδικό σας αν τον ξεχάσατε.',
  'error.noAccount.title': 'Δεν βρήκαμε αυτόν τον λογαριασμό',
  'error.noAccount.detail': 'Ελέγξτε τη διεύθυνση, ή φτιάξτε νέο λογαριασμό.',
  'error.passwordTooShort.title': 'Ο κωδικός είναι πολύ μικρός',
  'error.passwordTooShort.detail':
    'Διαλέξτε μεγαλύτερη φράση και δοκιμάστε ξανά.',
  'error.passwordTooLong.title': 'Ο κωδικός είναι πολύ μεγάλος',
  'error.passwordTooLong.detail':
    'Διαλέξτε μικρότερη φράση και δοκιμάστε ξανά.',
  'error.linkSpent.title': 'Αυτός ο σύνδεσμος δεν ισχύει πια',
  'error.linkSpent.detail':
    'Οι σύνδεσμοι κωδικού χρησιμοποιούνται μόνο μία φορά. Ζητήστε καινούριο και θα σας τον στείλουμε αμέσως.',
  'error.linkExpired.title': 'Αυτός ο σύνδεσμος έληξε',
  'error.linkExpired.detail':
    'Ζητήστε καινούριο και θα σας τον στείλουμε αμέσως.',
  'error.linkIncomplete.title': 'Αυτός ο σύνδεσμος είναι ελλιπής',
  'error.linkIncomplete.detail':
    'Οι σύνδεσμοι επαναφοράς κωδικού φέρουν έναν κωδικό μιας χρήσης. Ανοίξτε το πιο πρόσφατο email, ή ζητήστε καινούριο σύνδεσμο.',
  'error.sessionExpired.title': 'Η συνεδρία σας έληξε',
  'error.sessionExpired.detail':
    'Συνδεθείτε ξανά για να συνεχίσετε από εκεί που μείνατε.',
  'error.alreadyVerified.title': 'Ήδη επιβεβαιωμένο',
  'error.alreadyVerified.detail':
    'Αυτή η διεύθυνση email είναι επιβεβαιωμένη. Μπορείτε να συνδεθείτε κανονικά.',
  'error.badCode.title': 'Αυτός ο κωδικός δεν δούλεψε',
  'error.badCode.detail':
    'Οι κωδικοί ταυτοποίησης κρατούν τριάντα δευτερόλεπτα. Περιμένετε τον επόμενο και βάλτε και τα έξι ψηφία.',
  'error.badBackupCode.title': 'Αυτός ο κωδικός ασφαλείας δεν δούλεψε',
  'error.badBackupCode.detail':
    'Κάθε κωδικός ασφαλείας δουλεύει μία φορά. Δοκιμάστε τον επόμενο αχρησιμοποίητο από τη λίστα σας.',
  'error.locked.title': 'Ο λογαριασμός κλείδωσε προσωρινά',
  'error.locked.detail':
    'Πάρα πολλές αποτυχημένες προσπάθειες επιβεβαίωσης. Για την ασφάλειά σας ο λογαριασμός κλειδώνει για λίγα λεπτά.',
  'error.noTwoFactor.title': 'Οι δύο παράγοντες δεν έχουν ρυθμιστεί',
  'error.noTwoFactor.detail':
    'Συνδεθείτε με το email και τον κωδικό σας για να συνεχίσετε.',
  'error.twoFactorExpired.title': 'Ξεκινήστε πάλι από τη σύνδεση',
  'error.twoFactorExpired.detail':
    'Αυτό το βήμα επιβεβαίωσης έληξε. Βάλτε ξανά το email και τον κωδικό σας.',
  'error.invitationGone.title': 'Αυτή η πρόσκληση δεν είναι πια διαθέσιμη',
  'error.invitationGone.detail':
    'Μπορεί να έληξε, να ανακλήθηκε ή να χρησιμοποιήθηκε ήδη. Ζητήστε καινούρια πρόσκληση.',
  'error.invitationOther.title': 'Αυτή η πρόσκληση είναι για κάποιον άλλο',
  'error.invitationOther.detail':
    'Στάλθηκε σε άλλη διεύθυνση email. Συνδεθείτε με εκείνη για να την αποδεχτείτε.',
  'error.alreadyMember.title': 'Είστε ήδη σε αυτόν τον χώρο εργασίας',
  'error.alreadyMember.detail':
    'Τίποτα για αποδοχή — ανοίξτε τον από τον εναλλάκτη χώρων εργασίας.',
  'error.workspaceFull.title': 'Αυτός ο χώρος εργασίας είναι γεμάτος',
  'error.workspaceFull.detail':
    'Έφτασε στο όριο μελών του. Ζητήστε από έναν ιδιοκτήτη να ελευθερώσει θέση ή να αναβαθμίσει το πλάνο.',
  'error.verifyBeforeJoin.title': 'Επιβεβαιώστε πρώτα το email σας',
  'error.verifyBeforeJoin.detail':
    'Ανοίξτε τον σύνδεσμο επιβεβαίωσης που σας στείλαμε και γυρίστε σε αυτή την πρόσκληση.',

  'passkeyNotice.added': 'Προστέθηκε ένα κλειδί πρόσβασης στον λογαριασμό σας',
  'passkeyNotice.removed':
    'Αφαιρέθηκε ένα κλειδί πρόσβασης από τον λογαριασμό σας',
  'passkeyNotice.security': 'Ασφάλεια',
  'passkeyNotice.action': 'Διαχείριση κλειδιών πρόσβασης',
  'passkeyNotice.recovery':
    'Αν δεν αναγνωρίζετε αυτή την αλλαγή, αλλάξτε τον κωδικό σας και τερματίστε τις άγνωστες συνεδρίες. Η επαναφορά κωδικού δεν αφαιρεί τα κλειδιά πρόσβασης. Ελέγξτε τα και αφαιρέστε όσα δεν αναγνωρίζετε.',
} satisfies TranslationOf<typeof En>

export default messages
