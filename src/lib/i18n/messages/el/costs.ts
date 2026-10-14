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
  'expense.currencyLabel': 'Το νόμισμα στο οποίο είναι γραμμένη η απόδειξη',
  'expense.convertedTo': 'Μετατράπηκε σε {currency}',
  'expense.convertedHint': 'Σε πόσα βγήκε {from} σε {to} στο αντίγραφό σου.',
  'expense.convertedNotANumber': 'Γράψε το μετατραπέν ποσό ως αριθμό.',
  'expense.dateLabel': 'Ημερομηνία του εξόδου',
  'expense.paidByHint':
    'Άφησέ το χωρίς πληρωτή αν καταγράφεις απόδειξη που δεν κάλυψε κανείς ακόμη.',
  'expense.nobodyYet': 'Κανείς ακόμη',
  'expense.whoPaid': 'Ποιος πλήρωσε',
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
  'payment.whoPaying': 'Ποιος πληρώνει',
  'payment.whoPaid': 'Ποιος πληρώνεται',
  'payment.amountIn': 'Ποσό σε {currency}',
  'payment.amountPositive': 'Γράψε ποσό μεγαλύτερο από μηδέν.',
  'payment.currencyLabel': 'Νόμισμα στο οποίο έγινε η πληρωμή',
  'payment.how': 'Πώς',
  'payment.howMade': 'Πώς έγινε η πληρωμή',
  'payment.dateLabel': 'Ημερομηνία της πληρωμής',
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
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Μπορείτε να δείτε τα έξοδα, όχι να τα αλλάξετε',
  'readOnly.body':
    'Μόνο οι ιδιοκτήτες του ταξιδιού και όσοι μπορούν να το επεξεργαστούν προσθέτουν, αλλάζουν ή διαγράφουν έξοδα και καταγράφουν πληρωμές. Ρωτήστε έναν ιδιοκτήτη αν κάτι πρέπει να αλλάξει.',
  'readOnly.empty':
    'Δεν έχει καταγραφεί ακόμη κανένα έξοδο σε αυτό το ταξίδι. Θα εμφανιστούν εδώ μόλις τα προσθέσει ιδιοκτήτης ή συντάκτης.',
  'readOnly.settleEmpty':
    'Προς το παρόν δεν χρειάζεται καμία μεταφορά. Οποιαδήποτε διαφορά θα εμφανιστεί εδώ.',
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
} satisfies TranslationOf<typeof En>

export default messages
