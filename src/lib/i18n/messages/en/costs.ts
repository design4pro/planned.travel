/**
 * The costs tab's copy, in the source locale.
 *
 * `docs/SPEC.md` §8 reserves this namespace by name and fixes the shape: one
 * flat object of keys, default-exported, under `messages/<locale>/<namespace>.ts`.
 * It was one of the five §8 named and nobody wrote, which is why the settle-up
 * rail rendered English to all twenty-three locales.
 *
 * **What belongs here.** Every word the costs screens say on their own behalf:
 * panel labels, the empty states, the accessible name on the budget bar. Money
 * itself never does — an amount comes from `formatMoney` and a date from
 * `formatDayLabel`, both of which take the locale and neither of which is a
 * message.
 *
 * **What does not.** `components/ui`'s own copy (`ui.*`), and anything the
 * shell says around the tab (`shell.*`).
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------------------------ people */
  /**
   * The viewer, as the *source* of a transfer: the rail renders "You → Mika".
   * Separate from `person.youTarget` because English capitalises only the
   * sentence-initial one, and a language whose two forms differ by case rather
   * than by capitalisation needs both slots to say so.
   */
  'person.you': 'You',
  /**
   * The viewer, as the *target* of a transfer: "Mika → you".
   */
  'person.youTarget': 'you',
  /**
   * Stands in for a traveller who has left the trip. Their expenses and
   * settlements survive them, so a name is still needed where they appear.
   */
  'person.removed': 'Removed traveller',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Delete this expense?',
  'delete.description':
    '“{title}” and its split come off the ledger. This cannot be undone.',
  'delete.failed': 'That did not delete',
  'delete.failedBody':
    'The expense could not be deleted. Try again in a moment.',
  'delete.noBalances': 'No balances change — nothing was split on it.',
  'delete.balancesChange': 'Balances change for {names}.',
  'delete.confirm': 'Delete expense',
  'delete.working': 'Deleting the expense',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Expenses',
  'toolbar.shownOf': '{shown} of {total}',
  'toolbar.searchPlaceholder': 'Search expenses, notes or payer…',
  'toolbar.searchLabel': 'Search expenses',
  'toolbar.allCategories': 'All categories',
  'toolbar.allDays': 'All days',
  'toolbar.filterCategory': 'Filter by category',
  'toolbar.filterDay': 'Filter by day',
  'toolbar.whose': 'Whose expenses',
  'toolbar.paidByMe': 'Paid by me',
  'toolbar.owedToMe': "I'm owed",
  'toolbar.logged': {
    one: '{value} logged',
    other: '{value} logged',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Split between travellers',
  'split.label': 'Split between',
  'split.everyone': 'Everyone',
  'split.nobody': 'Nobody',
  'split.how': 'How this expense divides',
  'split.method.equal': 'Equally',
  'split.method.equalHint':
    'Everyone included pays the same, and the odd minor unit goes to the first traveller in the list.',
  'split.method.exact': 'Exact',
  'split.method.exactHint':
    'Type what each traveller actually owes. The amounts have to add up to the total.',
  'split.method.shares': 'Shares',
  'split.method.sharesHint':
    'Weight the split — 2 shares for a couple, 1 for everyone else.',
  'split.method.percentage': 'Percent',
  'split.method.percentageHint':
    'Split by percentage. The percentages have to add up to 100.',
  'split.exactFor': 'Exact amount for {name}',
  'split.percentFor': 'Percentage for {name}',
  'split.sharesFor': 'Shares for {name}',
  'split.balanced': 'Balanced',
  'split.allocated': '{allocated} of {total} allocated',
  'split.over': '{amount} over',
  'split.left': '{amount} left',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Amount',
  'field.currency': 'Currency',
  'field.date': 'Date',
  'field.paidBy': 'Paid by',
  'expense.editTitle': 'Edit this expense',
  'expense.addTitle': 'Add an expense',
  'expense.editDescription':
    'Changing the amount re-splits it between everyone included below.',
  'expense.addDescription':
    'Amounts are held in {currency} for this trip. Log a receipt in its own currency and record what it converted to.',
  'expense.saveFailed': 'That did not save',
  'expense.what': 'What was it for',
  'expense.whatPlaceholder': 'Dinner at Kyubey',
  'expense.amountNotANumber': 'Enter the amount as a number.',
  'expense.currencyLabel': 'Currency this receipt was written in',
  'expense.convertedTo': 'Converted to {currency}',
  'expense.convertedHint': 'What {from} came to in {to} on your statement.',
  'expense.convertedNotANumber': 'Enter the converted amount as a number.',
  'expense.dateLabel': 'Date this was spent',
  'expense.paidByHint':
    'Leave it unclaimed if you are logging a receipt nobody has covered yet.',
  'expense.nobodyYet': 'Nobody yet',
  'expense.whoPaid': 'Who paid',
  'expense.notesHint': 'Optional. Anything the receipt does not say.',
  'expense.notesPlaceholder': 'Split the tasting menu, drinks were separate.',
  'expense.noAmount': 'No amount yet',
  'expense.saving': 'Saving the expense',
  'expense.saveChanges': 'Save changes',
  'expense.add': 'Add expense',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Record a payment',
  'payment.description':
    'Logging a transfer clears it from both balances. It does not move any money — planned.travel keeps the ledger, your bank moves the cash.',
  'payment.youSuffix': '{name} (you)',
  'payment.pays': '{from} pays {to}',
  'payment.pickTwo': 'Pick two different travellers.',
  'payment.paidTo': 'Paid to',
  'payment.needsTwo': 'A payment needs two different travellers.',
  'payment.whoPaying': 'Who is paying',
  'payment.whoPaid': 'Who is being paid',
  'payment.amountIn': 'Amount in {currency}',
  'payment.amountPositive': 'Enter an amount greater than zero.',
  'payment.how': 'How',
  'payment.howMade': 'How the payment was made',
  'payment.dateLabel': 'Date of the payment',
  'payment.note': 'Note',
  'payment.noteHint': 'Optional. A reference, or what it covered.',
  'payment.notePlaceholder': 'Covers the Kyoto hotel and the JR passes.',
  'payment.recording': 'Recording the payment',
  'payment.confirm': 'Record payment',
  'payment.failed': 'The payment could not be recorded. Try again in a moment.',
  'payment.method.bankTransfer': 'Bank transfer',
  'payment.method.cash': 'Cash',
  'payment.method.card': 'Card',
  'payment.method.app': 'Payment app',
  'payment.method.other': 'Something else',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Settle up',
  /**
   * Logs a transfer that happened outside the product — cash, a bank app.
   */
  'settle.addPayment': 'Add payment',
  /**
   * Accepts one proposed transfer. The repository's greedy matching means
   * every one of these is a step towards zero rather than a guess.
   */
  'settle.action': 'Settle',
  'settle.empty.title': 'Everyone is square',
  /**
   * Not an error: a trip whose expenses balance has nothing to settle.
   */
  'settle.empty.body':
    'No transfers are needed. Log an expense and any imbalance shows up here.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Balances',
  /**
   * The traveller count beside the panel label. `{travellers}` is already
   * grouped for the locale and is the only thing the reader sees; `count`
   * selects the plural branch and stops there.
   */
  'balances.count': {
    one: '{travellers} traveller',
    other: '{travellers} travellers',
  },
  'balances.empty': 'Balances appear once an expense has a payer and a split.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'By category',
  'categories.againstBudget': 'Against the trip budget',
  /**
   * The progress bar's accessible name. The visible row above it says the
   * same thing in two halves, which a screen reader would read as two
   * unrelated numbers.
   */
  'categories.progressLabel': 'Spent against the trip budget',
  'categories.empty':
    'Budget lines and expenses both break down here once there is something to break down.',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Payments recorded',
  'payments.empty.title': 'No payments yet',
  /**
   * The distinction the screen rests on: a *proposed* transfer lives in the
   * settle-up panel, a *recorded* one lives here.
   */
  'payments.empty.body':
    'Once someone pays a balance back, the transfer is logged here.',
} as const satisfies NamespaceMessages

export default messages
