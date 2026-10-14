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
  'split.departed': 'Left the trip',
  'split.departedHint':
    'Unticking someone who left the trip removes their share for good.',
  'split.includeFor': 'Include {name} in this split',
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
  'expense.convertedSuggested':
    'Suggested from the rate used on this trip on {date} ({rate}). Change it to match your statement.',
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
  'payment.currencyLabel': 'Currency the payment was made in',
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
  'categories.legendLabel': 'Spend by category',
  'categories.planned': '{amount} planned',
  'categories.nothingSpent':
    'Nothing spent yet. Here is what you have planned.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'less than {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Who it was spent on',
  'memberBar.others': {
    one: '{others} other traveller',
    other: '{others} other travellers',
  },
  'memberBar.notSplit': 'Not assigned to anyone',
  'totalTile.label': 'Total trip spend',
  'totalTile.captionPlanned': 'Planned {amount} across all travellers',
  'totalTile.captionBudget': '{amount} budgeted for the trip',
  'totalTile.yourShare': 'Your share',
  'totalTile.youPaid': 'You paid',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Payments recorded',
  'payments.empty.title': 'No payments yet',
  /**
   * The distinction the screen rests on: a *proposed* transfer lives in the
   * settle-up panel, a *recorded* one lives here.
   */
  'payments.empty.body':
    'Once someone pays a balance back, the transfer is logged here.',
  /* ---------------------------------------- display currency (#844) */
  /**
   * The reader's display currency: a second figure beside the budget-currency one, never a
   * replacement for it. "Budget currency" is the glossary's word; "accounting currency" and
   * "trip currency" are not used in copy.
   */
  'display.label': 'Display currency',
  /** The indicator while the reader has chosen no currency: every trip stays in its own. */
  'display.indicator.perTrip': 'Own currency',
  /** The indicator once a code is chosen; the totals above stay in the budget currency. */
  'display.indicator.fixed': 'Also in {code}',
  'display.menu.perTrip': 'Each trip in its own currency',
  /** The workspace default, named with the code it will store. */
  'display.menu.workspace': '{code} (workspace default)',
  'display.menu.rateHint': 'Uses a rate already recorded on a trip',
  'display.menu.currentHint': 'Chosen, but no recorded rate answers for it yet',
  /** The reason a code cannot be picked, in words rather than by colour alone. */
  'display.menu.needsLiveRate': 'Needs a live rate, which is not available yet',
  'display.menu.saving': 'Saving your choice',
  'display.error.title': 'The display currency was not saved',
  'display.error.body':
    'Your choice could not be saved. Try again in a moment.',
  /** The converted figure on a row: the amount without a symbol, then the code, so two dollars never look alike. */
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'About {amount} {code} in your display currency',
  'display.row.notConverted': 'Not converted',
  'display.alert.title': 'Some figures are not converted',
  'display.alert.body':
    'No rate is recorded for these currency pairs, so those figures stay in the budget currency:',
  /** One pair the alert lists: "EUR to GBP on 14 Oct". */
  'display.alert.pair': '{from} to {to} on {date}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'You can read the costs, not change them',
  'readOnly.body':
    'Only the trip’s owners and the people who can edit it add, change or delete expenses and record payments. Ask an owner if something needs changing.',
  'readOnly.empty':
    'No expenses have been logged on this trip yet. They appear here once an owner or an editor adds them.',
  'readOnly.settleEmpty':
    'No transfers are needed right now. Any imbalance would show up here.',
  /* ------------------------------- a money change refused (#840) */
  'refusal.rebaseChanged':
    'The trip changed while you were confirming, so nothing was changed. Check the new figures and confirm again.',
  'refusal.tripCurrencyChanged':
    'The budget currency of this trip is now {to}, so this was not saved. The page has been refreshed: check the amount and save again.',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Change budget currency',
  'rebase.title': 'Change the budget currency',
  'rebase.description':
    'The amounts you typed stay as you typed them. The totals and balances of this trip are converted to the new currency.',
  'rebase.to': 'New currency',
  'rebase.toPlaceholder': 'Choose a currency',
  'rebase.rateLabel': 'Exchange rate (1 {from} in {to})',
  'rebase.rateInverse': 'That is 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Enter a rate greater than zero.',
  'rebase.rateOutOfRange':
    'That rate looks far too large or too small. Check which way round it is.',
  'rebase.source.recent': 'The last rate used in this workspace',
  'rebase.source.manual': 'The rate you entered',
  'rebase.noRate':
    'There is no rate on record for {from} to {to}. Enter the rate you want to use.',
  'rebase.waitingForRate': 'The preview appears as soon as there is a rate.',
  'rebase.loading': 'Working out the conversion',
  'rebase.example':
    '{original} stays as you typed it and is counted as {converted}.',
  'rebase.count.expenses': {
    one: '{count} expense will be counted in {to}.',
    other: '{count} expenses will be counted in {to}.',
  },
  'rebase.count.payments': {
    one: '{count} payment will be counted in {to}.',
    other: '{count} payments will be counted in {to}.',
  },
  'rebase.count.planned': {
    one: '{count} planned item will be counted in {to}.',
    other: '{count} planned items will be counted in {to}.',
  },
  'rebase.pinned':
    'Prices on places, reservations, stays and transport stay in {from}.',
  'rebase.target': 'The trip budget {before} becomes {after}.',
  'rebase.rounding':
    'Each amount is rounded once, so a balance can move by up to {amount}.',
  'rebase.leftover': 'After the change, {name} would owe {other} {amount}.',
  'rebase.someone': 'Someone',
  'rebase.nothing':
    'Nothing on this trip is priced yet, so nothing needs converting.',
  'rebase.unconverted': {
    one: '{count} entry is in a currency other than {from} and cannot be converted automatically. It is usually an expense created from a reservation priced in another currency: edit or delete it, then try again.',
    other:
      '{count} entries are in a currency other than {from} and cannot be converted automatically. They are usually expenses created from reservations priced in another currency: edit or delete them, then try again.',
  },
  'rebase.unsplittable': {
    one: '{count} expense has a split that cannot be carried over, because every share in it is zero. Edit or delete it, then try again.',
    other:
      '{count} expenses have a split that cannot be carried over, because every share in them is zero. Edit or delete them, then try again.',
  },
  'rebase.outOfRange':
    'With this rate an amount on the trip would be too large to store in {to}. Check the rate and which way round it is.',
  'rebase.tooLarge':
    'This trip has too many entries to change in one step: it would need {changes} changes at once and the limit is {limit}. The budget stays in {from} for now.',
  'rebase.copyPending':
    'This trip is still being copied. Try again in a moment.',
  'rebase.error': 'The conversion could not be loaded. Nothing was changed.',
  'rebase.commitError':
    "We couldn't change the budget currency. Nothing was changed.",
  'rebase.stale':
    "The trip's budget currency is now {current}, not {from}. Close this dialog and open it again.",
  'rebase.sameCurrency':
    'The budget is already in {to}. Pick a different currency.',
  'rebase.commitUnknown':
    "We couldn't confirm whether the budget currency changed to {to}. Reload the page to check before trying again.",
  'rebase.retry': 'Try again',
  'rebase.confirm': 'Change to {to}',
  'rebase.committing': 'Changing the budget currency',
  'rebase.done': 'The budget is now in {to}.',
} as const satisfies NamespaceMessages

export default messages
