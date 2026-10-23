/**
 * The costs tab's copy, in el.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Πληθυντικός.** `one` · `other`. Τα ελληνικά εισαγωγικά είναι «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Εσύ',
  'person.youTarget': 'εσένα',
  'person.removed': 'Ταξιδιώτης που αφαιρέθηκε',
  'person.removedTarget': 'ένας ταξιδιώτης που αφαιρέθηκε',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Να διαγραφεί αυτό το έξοδο;',
  'delete.description':
    '«{title}» και η μοιρασιά του φεύγουν από τον λογαριασμό. Αυτό δεν αναιρείται.',
  'delete.failed': 'Η διαγραφή δεν έγινε',
  'delete.failedBody': 'Το έξοδο δεν διαγράφηκε. Δοκίμασε ξανά σε λίγο.',
  'delete.noBalances':
    'Κανένα υπόλοιπο δεν αλλάζει: δεν ήταν μοιρασμένο τίποτα.',
  'delete.balancesChange': 'Αλλάζουν τα υπόλοιπα: {names}.',
  'delete.confirm': 'Διαγραφή εξόδου',
  'delete.working': 'Το έξοδο διαγράφεται',
  'delete.payment.title': 'Να διαγραφεί αυτή η πληρωμή;',
  'delete.payment.description':
    '«{title}» φεύγει από τον λογαριασμό. Αυτό δεν αναιρείται. Για να διορθώσεις μια πληρωμή, κατάγραψέ την ξανά.',
  'delete.payment.failedBody':
    'Η πληρωμή δεν διαγράφηκε. Δοκίμασε ξανά σε λίγο.',
  'delete.payment.confirm': 'Διαγραφή πληρωμής',
  'delete.payment.working': 'Η πληρωμή διαγράφεται',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Έξοδα',
  'toolbar.shownOf': '{shown} από {total}',
  'toolbar.searchPlaceholder': 'Αναζήτηση σε έξοδα, σημειώσεις ή πληρωτές…',
  'toolbar.searchLabel': 'Αναζήτηση εξόδων',
  'toolbar.allCategories': 'Όλες οι κατηγορίες',
  'toolbar.allDays': 'Όλες οι ημέρες',
  'toolbar.filterCategory': 'Φιλτράρισμα κατά κατηγορία',
  'toolbar.filterDay': 'Φιλτράρισμα κατά ημέρα',
  'toolbar.whose': 'Έξοδα ποιου',
  'toolbar.paidByMe': 'Πληρωμένα από εμένα',
  'toolbar.owedToMe': 'Μου οφείλουν',
  'toolbar.logged': {
    one: '{value} καταγεγραμμένο',
    other: '{value} καταγεγραμμένα',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Μοιρασιά μεταξύ των ταξιδιωτών',
  'split.label': 'Μοιρασιά μεταξύ',
  'split.everyone': 'Όλοι',
  'split.nobody': 'Κανείς',
  'split.departed': 'Έφυγε από το ταξίδι',
  'split.departedHint':
    'Αν αποεπιλέξετε κάποιον που έφυγε από το ταξίδι, το μερίδιό του αφαιρείται οριστικά.',
  'split.includeFor': 'Συμπερίληψη του {name} σε αυτόν τον διαχωρισμό',
  'split.how': 'Πώς μοιράζεται αυτό το έξοδο',
  'split.method.equal': 'Ισόποσα',
  'split.method.equalHint':
    'Όλοι όσοι συμμετέχουν πληρώνουν το ίδιο, και η περισσευούμενη ελάχιστη μονάδα πάει στον πρώτο της λίστας.',
  'split.method.exact': 'Ακριβώς',
  'split.method.exactHint':
    'Γράψε πόσα χρωστά πράγματι ο καθένας. Τα ποσά πρέπει να βγάζουν το σύνολο.',
  'split.method.shares': 'Μερίδες',
  'split.method.sharesHint':
    'Ζύγισε τη μοιρασιά: 2 μερίδες για ένα ζευγάρι, 1 για τους άλλους.',
  'split.method.percentage': 'Ποσοστό',
  'split.method.percentageHint':
    'Μοιρασιά κατά ποσοστό. Τα ποσοστά πρέπει να βγάζουν 100.',
  'split.exactFor': 'Ακριβές ποσό για {name}',
  'split.percentFor': 'Ποσοστό για {name}',
  'split.sharesFor': 'Μερίδες για {name}',
  'split.balanced': 'Βγαίνει',
  'split.allocated': '{allocated} από {total} μοιρασμένα',
  'split.over': '{amount} παραπάνω',
  'split.left': 'μένουν {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Ποσό',
  'field.currency': 'Νόμισμα',
  'field.date': 'Ημερομηνία',
  'field.paidBy': 'Πλήρωσε',
  'expense.editTitle': 'Επεξεργασία αυτού του εξόδου',
  'expense.addTitle': 'Προσθήκη εξόδου',
  'expense.editDescription':
    'Αν αλλάξεις το ποσό, μοιράζεται ξανά σε όλους όσοι συμμετέχουν παρακάτω.',
  'expense.addDescription':
    'Τα ποσά αυτού του ταξιδιού τηρούνται σε {currency}. Κατέγραψε μια απόδειξη στο δικό της νόμισμα και σημείωσε σε πόσα μετατράπηκε.',
  'expense.saveFailed': 'Η αποθήκευση δεν έγινε',
  'expense.what': 'Για ποιο πράγμα ήταν',
  'expense.whatPlaceholder': 'Δείπνο στο Kyubey',
  'expense.amountNotANumber': 'Γράψε το ποσό ως αριθμό.',
  'expense.convertedTo': 'Μετατράπηκε σε {currency}',
  'expense.convertedHint': 'Σε πόσα βγήκε {from} σε {to} στο αντίγραφό σου.',
  'expense.convertedSuggested':
    'Προτείνεται από την ισοτιμία που χρησιμοποιήθηκε σε αυτό το ταξίδι στις {date} ({rate}). Άλλαξέ το ώστε να ταιριάζει με το αντίγραφό σου.',
  'expense.convertedNotANumber': 'Γράψε το μετατραπέν ποσό ως αριθμό.',
  'expense.paidByHint':
    'Άφησέ το χωρίς πληρωτή αν καταγράφεις απόδειξη που δεν κάλυψε κανείς ακόμη.',
  'expense.nobodyYet': 'Κανείς ακόμη',
  'expense.notesHint': 'Προαιρετικό. Ό,τι δεν λέει η απόδειξη.',
  'expense.notesPlaceholder': 'Μοιρασμένο μενού γευσιγνωσίας, τα ποτά χωριστά.',
  'expense.noAmount': 'Χωρίς ποσό ακόμη',
  'expense.saving': 'Το έξοδο αποθηκεύεται',
  'expense.saveChanges': 'Αποθήκευση αλλαγών',
  'expense.add': 'Προσθήκη εξόδου',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Καταγραφή πληρωμής',
  'payment.description':
    'Μια καταγεγραμμένη μεταφορά φεύγει από τα δύο υπόλοιπα. Δεν μετακινεί χρήματα: το planned.travel κρατά τον λογαριασμό, τα χρήματα τα στέλνει η τράπεζά σου.',
  'payment.youSuffix': '{name} (εσύ)',
  'payment.pays': 'Ο/η {from} πληρώνει τον/την {to}',
  'payment.pickTwo': 'Διάλεξε δύο διαφορετικά πρόσωπα.',
  'payment.paidTo': 'Πληρώθηκε σε',
  'payment.needsTwo': 'Μια πληρωμή χρειάζεται δύο διαφορετικά πρόσωπα.',
  'payment.amountIn': 'Ποσό σε {currency}',
  'payment.amountPositive': 'Γράψε ποσό μεγαλύτερο από μηδέν.',
  'payment.how': 'Πώς',
  'payment.note': 'Σημείωση',
  'payment.noteHint': 'Προαιρετικό. Μια αναφορά, ή τι κάλυπτε.',
  'payment.notePlaceholder':
    'Καλύπτει το ξενοδοχείο στο Κιότο και τα εισιτήρια JR.',
  'payment.recording': 'Η πληρωμή καταγράφεται',
  'payment.confirm': 'Καταγραφή πληρωμής',
  'payment.failed': 'Η πληρωμή δεν καταγράφηκε. Δοκίμασε ξανά σε λίγο.',
  'payment.method.bankTransfer': 'Τραπεζική μεταφορά',
  'payment.method.cash': 'Μετρητά',
  'payment.method.card': 'Κάρτα',
  'payment.method.app': 'Εφαρμογή πληρωμών',
  'payment.method.other': 'Κάτι άλλο',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Τακτοποίηση',
  'settle.addPayment': 'Προσθήκη πληρωμής',
  'settle.action': 'Τακτοποίηση',
  'settle.empty.title': 'Είστε όλοι ίσοι',
  'settle.empty.body':
    'Δεν χρειάζεται καμία μεταφορά. Πρόσθεσε ένα έξοδο και κάθε ανισορροπία θα εμφανιστεί εδώ.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Υπόλοιπα',
  'balances.count': {
    one: '{travellers} ταξιδιώτης',
    other: '{travellers} ταξιδιώτες',
  },
  'balances.empty':
    'Τα υπόλοιπα εμφανίζονται όταν ένα έξοδο έχει πληρωτή και επιμερισμό.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Ανά κατηγορία',
  'categories.againstBudget': 'Έναντι του προϋπολογισμού του ταξιδιού',
  'categories.progressLabel': 'Δαπάνες έναντι του προϋπολογισμού του ταξιδιού',
  'categories.empty':
    'Οι γραμμές του προϋπολογισμού και τα έξοδα αναλύονται εδώ μόλις υπάρχει κάτι να αναλυθεί.',
  'categories.legendLabel': 'Δαπάνες ανά κατηγορία',
  'categories.planned': '{amount} προγραμματισμένα',
  'categories.nothingSpent':
    'Δεν έχει ξοδευτεί τίποτα ακόμα. Δείτε τι έχετε προγραμματίσει.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'λιγότερο από {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Για ποιον ξοδεύτηκαν τα χρήματα',
  'memberBar.others': {
    one: '{others} ακόμη ταξιδιώτης',
    other: '{others} ακόμη ταξιδιώτες',
  },
  'memberBar.notSplit': 'Δεν έχει ανατεθεί σε κανέναν',
  'totalTile.label': 'Συνολικά έξοδα ταξιδιού',
  'totalTile.captionPlanned':
    'Προγραμματισμένα {amount} για όλους τους ταξιδιώτες',
  'totalTile.captionBudget': '{amount} προϋπολογισμός για το ταξίδι',
  'totalTile.yourShare': 'Το μερίδιό σας',
  'totalTile.youPaid': 'Πληρώσατε',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Καταγεγραμμένες πληρωμές',
  'payments.empty.title': 'Καμία πληρωμή ακόμη',
  'payments.empty.body':
    'Μόλις κάποιος επιστρέψει ένα υπόλοιπο, η μεταφορά καταγράφεται εδώ.',
  'payments.delete': 'Διαγραφή της πληρωμής από {from} προς {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Αυτό το ταξίδι έχει αρχειοθετηθεί. Επαναφέρετέ το πριν αλλάξετε τα έξοδα.',
  'readOnly.title': 'Μπορείτε να δείτε τα έξοδα, όχι να τα αλλάξετε',
  'readOnly.body':
    'Μόνο οι ιδιοκτήτες του ταξιδιού και όσοι μπορούν να το επεξεργαστούν προσθέτουν, αλλάζουν ή διαγράφουν έξοδα και καταγράφουν πληρωμές. Ρωτήστε έναν ιδιοκτήτη αν κάτι πρέπει να αλλάξει.',
  'readOnly.empty':
    'Δεν έχει καταγραφεί ακόμη κανένα έξοδο σε αυτό το ταξίδι. Θα εμφανιστούν εδώ μόλις τα προσθέσει ιδιοκτήτης ή συντάκτης.',
  'readOnly.settleEmpty':
    'Προς το παρόν δεν χρειάζεται καμία μεταφορά. Οποιαδήποτε διαφορά θα εμφανιστεί εδώ.',
  'refusal.rebaseChanged':
    'Το ταξίδι άλλαξε ενώ επιβεβαιώνατε, γι’ αυτό δεν άλλαξε τίποτα. Ελέγξτε τα νέα ποσά και επιβεβαιώστε ξανά.',
  'refusal.tripCurrencyChanged':
    'Το νόμισμα προϋπολογισμού αυτού του ταξιδιού είναι τώρα {to}, γι’ αυτό δεν αποθηκεύτηκε. Η σελίδα ανανεώθηκε: ελέγξτε το ποσό και αποθηκεύστε ξανά.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Νόμισμα εμφάνισης',
  'display.indicator.perTrip': 'Δικό του νόμισμα',
  'display.indicator.fixed': 'Και σε {code}',
  'display.menu.perTrip': 'Κάθε ταξίδι στο δικό του νόμισμα',
  'display.menu.workspace': '{code} (προεπιλογή του χώρου εργασίας)',
  'display.menu.rateHint':
    'Χρησιμοποιεί ισοτιμία που έχει ήδη καταγραφεί σε ταξίδι',
  'display.menu.currentHint':
    'Επιλεγμένο, αλλά καμία καταγεγραμμένη ισοτιμία δεν το καλύπτει',
  'display.menu.needsLiveRate':
    'Απαιτεί ζωντανή ισοτιμία, που δεν είναι ακόμη διαθέσιμη',
  'display.menu.disabledHint':
    'Τα νομίσματα χωρίς καταγεγραμμένη ισοτιμία εμφανίζονται στη λίστα αλλά δεν μπορούν να επιλεγούν: χρειάζονται ισοτιμία σε πραγματικό χρόνο, που δεν είναι ακόμη διαθέσιμη.',
  'display.menu.saving': 'Αποθήκευση της επιλογής σας',
  'display.error.title': 'Το νόμισμα εμφάνισης δεν αποθηκεύτηκε',
  'display.error.body':
    'Η επιλογή σας δεν αποθηκεύτηκε. Δοκιμάστε ξανά σε λίγο.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Περίπου {amount} {code} στο νόμισμα εμφάνισής σας',
  'display.row.notConverted': 'Χωρίς μετατροπή',
  'display.alert.title': 'Ορισμένα ποσά δεν έχουν μετατραπεί',
  'display.alert.body':
    'Για αυτά τα ζεύγη νομισμάτων δεν υπάρχει καταγεγραμμένη ισοτιμία, επομένως τα ποσά μένουν στο νόμισμα του προϋπολογισμού:',
  'display.alert.pair': '{from} σε {to} στις {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Αλλαγή νομίσματος προϋπολογισμού',
  'rebase.title': 'Αλλαγή του νομίσματος προϋπολογισμού',
  'rebase.description':
    'Τα ποσά που πληκτρολογήσατε μένουν όπως τα πληκτρολογήσατε. Τα σύνολα και τα υπόλοιπα αυτού του ταξιδιού μετατρέπονται στο νέο νόμισμα.',
  'rebase.to': 'Νέο νόμισμα',
  'rebase.toPlaceholder': 'Επιλέξτε νόμισμα',
  'rebase.rateLabel': 'Ισοτιμία (1 {from} σε {to})',
  'rebase.rateInverse': 'Δηλαδή 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Εισαγάγετε ισοτιμία μεγαλύτερη από το μηδέν.',
  'rebase.rateOutOfRange':
    'Αυτή η ισοτιμία φαίνεται υπερβολικά μεγάλη ή μικρή. Ελέγξτε προς ποια κατεύθυνση ισχύει.',
  'rebase.source.recent':
    'Η τελευταία ισοτιμία που χρησιμοποιήθηκε σε αυτόν τον χώρο εργασίας',
  'rebase.source.manual': 'Η ισοτιμία που εισαγάγατε',
  'rebase.noRate':
    'Δεν υπάρχει καταγεγραμμένη ισοτιμία από {from} σε {to}. Εισαγάγετε την ισοτιμία που θέλετε να χρησιμοποιηθεί.',
  'rebase.waitingForRate':
    'Η προεπισκόπηση εμφανίζεται μόλις υπάρξει ισοτιμία.',
  'rebase.loading': 'Υπολογισμός της μετατροπής',
  'rebase.example':
    'Το {original} μένει όπως το πληκτρολογήσατε και υπολογίζεται ως {converted}.',
  'rebase.count.expenses': {
    one: '{count} έξοδο θα υπολογιστεί σε {to}.',
    other: '{count} έξοδα θα υπολογιστούν σε {to}.',
  },
  'rebase.count.payments': {
    one: '{count} πληρωμή θα υπολογιστεί σε {to}.',
    other: '{count} πληρωμές θα υπολογιστούν σε {to}.',
  },
  'rebase.count.planned': {
    one: '{count} προγραμματισμένο στοιχείο θα υπολογιστεί σε {to}.',
    other: '{count} προγραμματισμένα στοιχεία θα υπολογιστούν σε {to}.',
  },
  'rebase.pinned':
    'Οι τιμές σε μέρη, κρατήσεις, διαμονές και μετακινήσεις μένουν σε {from}.',
  'rebase.target': 'Ο προϋπολογισμός του ταξιδιού {before} γίνεται {after}.',
  'rebase.rounding':
    'Κάθε ποσό στρογγυλοποιείται μία φορά, οπότε ένα υπόλοιπο μπορεί να μετακινηθεί έως και κατά {amount}.',
  'rebase.leftover': 'Μετά την αλλαγή, {name} θα όφειλε {amount} σε {other}.',
  'rebase.someone': 'Κάποιος',
  'rebase.nothing':
    'Τίποτα σε αυτό το ταξίδι δεν έχει ακόμη τιμή, οπότε δεν χρειάζεται να μετατραπεί τίποτα.',
  'rebase.unconverted': {
    one: '{count} εγγραφή είναι σε νόμισμα διαφορετικό από {from} και δεν μπορεί να μετατραπεί αυτόματα. Συνήθως είναι έξοδο που δημιουργήθηκε από κράτηση με τιμή σε άλλο νόμισμα: επεξεργαστείτε το ή διαγράψτε το και δοκιμάστε ξανά.',
    other:
      '{count} εγγραφές είναι σε νόμισμα διαφορετικό από {from} και δεν μπορούν να μετατραπούν αυτόματα. Συνήθως είναι έξοδα που δημιουργήθηκαν από κρατήσεις με τιμή σε άλλο νόμισμα: επεξεργαστείτε τα ή διαγράψτε τα και δοκιμάστε ξανά.',
  },
  'rebase.unsplittable': {
    one: '{count} έξοδο έχει επιμερισμό που δεν μπορεί να μεταφερθεί, επειδή όλα τα μερίδια σε αυτό είναι μηδέν. Επεξεργαστείτε το ή διαγράψτε το και δοκιμάστε ξανά.',
    other:
      '{count} έξοδα έχουν επιμερισμό που δεν μπορεί να μεταφερθεί, επειδή όλα τα μερίδια σε αυτά είναι μηδέν. Επεξεργαστείτε τα ή διαγράψτε τα και δοκιμάστε ξανά.',
  },
  'rebase.outOfRange':
    'Με αυτή την ισοτιμία ένα ποσό του ταξιδιού θα ήταν πολύ μεγάλο για να αποθηκευτεί σε {to}. Ελέγξτε την ισοτιμία και προς ποια κατεύθυνση ισχύει.',
  'rebase.tooLarge':
    'Αυτό το ταξίδι έχει πάρα πολλές εγγραφές για να αλλάξουν με ένα βήμα: θα χρειάζονταν {changes} αλλαγές ταυτόχρονα και το όριο είναι {limit}. Προς το παρόν ο προϋπολογισμός μένει σε {from}.',
  'rebase.copyPending':
    'Αυτό το ταξίδι αντιγράφεται ακόμη. Δοκιμάστε ξανά σε λίγο.',
  'rebase.error': 'Η μετατροπή δεν φορτώθηκε. Δεν άλλαξε τίποτα.',
  'rebase.commitError':
    'Δεν μπορέσαμε να αλλάξουμε το νόμισμα προϋπολογισμού. Δεν άλλαξε τίποτα.',
  'rebase.stale':
    'Το νόμισμα προϋπολογισμού του ταξιδιού είναι τώρα {current}, όχι {from}. Κλείστε αυτό το παράθυρο και ανοίξτε το ξανά.',
  'rebase.sameCurrency':
    'Ο προϋπολογισμός είναι ήδη σε {to}. Επιλέξτε άλλο νόμισμα.',
  'rebase.commitUnknown':
    'Δεν μπορέσαμε να επιβεβαιώσουμε αν το νόμισμα του προϋπολογισμού άλλαξε σε {to}. Φορτώστε ξανά τη σελίδα για έλεγχο πριν δοκιμάσετε ξανά.',
  'rebase.retry': 'Δοκιμάστε ξανά',
  'rebase.confirm': 'Αλλαγή σε {to}',
  'rebase.committing': 'Αλλαγή του νομίσματος προϋπολογισμού',
  'rebase.done': 'Ο προϋπολογισμός είναι τώρα σε {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Δεν έχει δαπανηθεί τίποτα ακόμη',
  'screen.summary': '{expenses} · δαπανήθηκαν {spent}',
  'count.expenses': {
    one: '{expenses} έξοδο',
    other: '{expenses} έξοδα',
  },
  'screen.exportCsv': 'Εξαγωγή CSV',
  'screen.addFirst': 'Προσθήκη του πρώτου εξόδου',
  'screen.empty.title': 'Δεν υπάρχουν έξοδα ακόμη',
  'screen.empty.body':
    'Κατέγραφε όσα ξοδεύεις εν κινήσει. Το planned.travel τα μοιράζει σε όλους τους ταξιδιώτες και κρατά το τρέχον σύνολο σε {currency}.',
  'screen.filtered.title': 'Τίποτα δεν ταιριάζει με αυτά τα φίλτρα',
  'screen.filtered.body':
    'Διεύρυνε την αναζήτηση, διάλεξε άλλη ημέρα ή καθάρισε τα φίλτρα για να δεις ξανά ολόκληρο το ταξίδι.',
  'export.empty.title': 'Δεν υπάρχει τίποτα για εξαγωγή',
  'export.empty.body':
    'Κανένα έξοδο δεν ταιριάζει με τα φίλτρα που έχεις ενεργά.',
  'export.ready.title': 'Η εξαγωγή είναι έτοιμη',
  'export.ready.body': {
    one: 'Γράφτηκε {expenses} έξοδο στο CSV.',
    other: 'Γράφτηκαν {expenses} έξοδα στο CSV.',
  },
  'list.daySpent': 'δαπανήθηκαν {amount}',
  'skeleton.loading': 'Φόρτωση των εξόδων',
  'row.noPayer': 'Χωρίς πληρωτή ακόμη',
  'row.youPaid': 'Πλήρωσες εσύ',
  'row.paid': 'Πλήρωσε ο/η {name}',
  'row.notYourShare': 'δεν είναι το μερίδιό σου',
  'row.yourShare': '{amount} δικά σου',
  'row.noteOn': 'Σημείωση για το {title}',
  'row.edit': 'Επεξεργασία: {title}',
  'row.delete': 'Διαγραφή: {title}',
  'row.saving': 'Αποθήκευση',
  'tile.owe.label': 'Οφείλεις',
  'tile.owe.settled': 'Είσαι πλήρως εξοφλημένος',
  'tile.owe.pending': 'Ξεχρέωσε πριν γυρίσεις σπίτι',
  'tile.owe.to': 'Προς',
  'tile.owed.label': 'Σου οφείλουν',
  'tile.owed.none': 'Δεν σου οφείλεται τίποτα',
  'tile.owed.pending': 'Θα σου επιστραφούν ακόμη',
  'tile.owed.from': 'Από',
  'tile.outstanding.label': 'Εκκρεμή',
  'tile.outstanding.none': 'Κάθε έξοδο έχει πληρωτή',
  'tile.outstanding.some': {
    one: '{expenses} έξοδο χωρίς πληρωτή ακόμη',
    other: '{expenses} έξοδα χωρίς πληρωτή ακόμη',
  },
  'category.accommodation': 'Διαμονή',
  'category.transport': 'Μετακινήσεις',
  'category.food': 'Φαγητό και ποτό',
  'category.activities': 'Δραστηριότητες',
  'category.shopping': 'Αγορές',
  'category.fees': 'Τέλη και χρεώσεις',
  'category.insurance': 'Ασφάλιση',
  'category.other': 'Άλλα',
  'toolbar.summary.everything': 'Εμφανίζονται όλα',
  'toolbar.summary.filtered': 'Φιλτραρισμένα: {filters}',
  'toolbar.summary.search': 'που ταιριάζουν με «{term}»',
  'write.added': 'Το έξοδο προστέθηκε',
  'write.updated': 'Το έξοδο ενημερώθηκε',
  'write.deleted': 'Το έξοδο διαγράφηκε',
  'write.addFailed': 'Το έξοδο δεν προστέθηκε',
  'write.editFailed': 'Το έξοδο δεν αποθηκεύτηκε',
  'write.deleteFailed': 'Το έξοδο δεν διαγράφηκε',
  'write.paymentRecorded': 'Η πληρωμή καταγράφηκε',
  'write.paymentRecordedBody': 'Και τα δύο υπόλοιπα ενημερώθηκαν.',
  'write.paymentFailed': 'Η πληρωμή δεν καταγράφηκε',
  'write.paymentDeleted': 'Η πληρωμή διαγράφηκε',
  'write.paymentDeleteFailed': 'Η πληρωμή δεν διαγράφηκε',
  'write.rolledBack': 'Η αλλαγή αναιρέθηκε.',
  'expense.saveFallback': 'Το έξοδο δεν αποθηκεύτηκε. Δοκίμασε ξανά σε λίγο.',
} satisfies TranslationOf<typeof En>

export default messages
