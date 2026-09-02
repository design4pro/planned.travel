/**
 * The costs tab's copy, in nl.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Jij',
  'person.youTarget': 'jou',
  'person.removed': 'Verwijderde reiziger',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Deze uitgave verwijderen?',
  'delete.description':
    '‘{title}’ en de verdeling ervan gaan uit de afrekening. Dit kun je niet terugdraaien.',
  'delete.failed': 'Verwijderen is mislukt',
  'delete.failedBody':
    'De uitgave kon niet worden verwijderd. Probeer het straks nog eens.',
  'delete.noBalances': 'Geen enkel saldo verandert - er was niets op verdeeld.',
  'delete.balancesChange': 'De saldi van {names} veranderen.',
  'delete.confirm': 'Uitgave verwijderen',
  'delete.working': 'Uitgave wordt verwijderd',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Uitgaven',
  'toolbar.shownOf': '{shown} van {total}',
  'toolbar.searchPlaceholder': 'Zoek in uitgaven, notities of betalers…',
  'toolbar.searchLabel': 'Uitgaven zoeken',
  'toolbar.allCategories': 'Alle categorieën',
  'toolbar.allDays': 'Alle dagen',
  'toolbar.filterCategory': 'Filteren op categorie',
  'toolbar.filterDay': 'Filteren op dag',
  'toolbar.whose': 'Wiens uitgaven',
  'toolbar.paidByMe': 'Door mij betaald',
  'toolbar.owedToMe': 'Mij verschuldigd',
  'toolbar.logged': {
    one: '{value} vastgelegd',
    other: '{value} vastgelegd',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Verdeling tussen reisgenoten',
  'split.label': 'Verdelen tussen',
  'split.everyone': 'Iedereen',
  'split.nobody': 'Niemand',
  'split.how': 'Hoe deze uitgave verdeeld wordt',
  'split.method.equal': 'Gelijk',
  'split.method.equalHint':
    'Iedereen die meedoet betaalt hetzelfde, en de overgebleven kleinste eenheid gaat naar de eerste in de lijst.',
  'split.method.exact': 'Exact',
  'split.method.exactHint':
    'Vul in wat ieder werkelijk verschuldigd is. De bedragen moeten samen het totaal zijn.',
  'split.method.shares': 'Delen',
  'split.method.sharesHint':
    'Weeg de verdeling - 2 delen voor een koppel, 1 voor de rest.',
  'split.method.percentage': 'Procent',
  'split.method.percentageHint':
    'Verdelen op procent. De percentages moeten samen 100 zijn.',
  'split.exactFor': 'Exact bedrag voor {name}',
  'split.percentFor': 'Percentage voor {name}',
  'split.sharesFor': 'Delen voor {name}',
  'split.balanced': 'Klopt',
  'split.allocated': '{allocated} van {total} verdeeld',
  'split.over': '{amount} te veel',
  'split.left': '{amount} over',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Bedrag',
  'field.currency': 'Valuta',
  'field.date': 'Datum',
  'field.paidBy': 'Betaald door',
  'expense.editTitle': 'Deze uitgave bewerken',
  'expense.addTitle': 'Een uitgave toevoegen',
  'expense.editDescription':
    'Als je het bedrag wijzigt, wordt het opnieuw verdeeld over iedereen die hieronder meedoet.',
  'expense.addDescription':
    'Bedragen worden voor deze reis in {currency} bijgehouden. Leg een bon vast in zijn eigen valuta en noteer waar hij op uitkwam.',
  'expense.saveFailed': 'Opslaan is mislukt',
  'expense.what': 'Waar was het voor',
  'expense.whatPlaceholder': 'Diner bij Kyubey',
  'expense.amountNotANumber': 'Vul het bedrag in als getal.',
  'expense.currencyLabel': 'Valuta waarin deze bon is opgemaakt',
  'expense.convertedTo': 'Omgerekend naar {currency}',
  'expense.convertedHint': 'Waar {from} op je afschrift in {to} op uitkwam.',
  'expense.convertedNotANumber': 'Vul het omgerekende bedrag in als getal.',
  'expense.dateLabel': 'Datum van de uitgave',
  'expense.paidByHint':
    'Laat het zonder betaler als je een bon vastlegt die nog niemand heeft voorgeschoten.',
  'expense.nobodyYet': 'Nog niemand',
  'expense.whoPaid': 'Wie heeft betaald',
  'expense.notesHint': 'Optioneel. Alles wat de bon niet zegt.',
  'expense.notesPlaceholder': 'Menu gedeeld, drankjes apart.',
  'expense.noAmount': 'Nog geen bedrag',
  'expense.saving': 'Uitgave wordt opgeslagen',
  'expense.saveChanges': 'Wijzigingen opslaan',
  'expense.add': 'Uitgave toevoegen',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Een betaling vastleggen',
  'payment.description':
    'Een vastgelegde overboeking verdwijnt uit beide saldi. Er wordt geen geld verplaatst - planned.travel houdt de afrekening bij, jouw bank maakt het over.',
  'payment.youSuffix': '{name} (jij)',
  'payment.pays': '{from} betaalt {to}',
  'payment.pickTwo': 'Kies twee verschillende mensen.',
  'payment.paidTo': 'Betaald aan',
  'payment.needsTwo': 'Een betaling heeft twee verschillende mensen nodig.',
  'payment.whoPaying': 'Wie betaalt',
  'payment.whoPaid': 'Wie betaald wordt',
  'payment.amountIn': 'Bedrag in {currency}',
  'payment.amountPositive': 'Vul een bedrag groter dan nul in.',
  'payment.how': 'Hoe',
  'payment.howMade': 'Hoe de betaling is gedaan',
  'payment.dateLabel': 'Datum van de betaling',
  'payment.note': 'Notitie',
  'payment.noteHint': 'Optioneel. Een referentie, of waar het voor was.',
  'payment.notePlaceholder': 'Dekt het hotel in Kyoto en de JR-passen.',
  'payment.recording': 'Betaling wordt vastgelegd',
  'payment.confirm': 'Betaling vastleggen',
  'payment.failed':
    'De betaling kon niet worden vastgelegd. Probeer het straks nog eens.',
  'payment.method.bankTransfer': 'Bankoverboeking',
  'payment.method.cash': 'Contant',
  'payment.method.card': 'Kaart',
  'payment.method.app': 'Betaalapp',
  'payment.method.other': 'Iets anders',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Afrekenen',
  'settle.addPayment': 'Betaling toevoegen',
  'settle.action': 'Afrekenen',
  'settle.empty.title': 'Iedereen staat quitte',
  'settle.empty.body':
    'Er zijn geen overboekingen nodig. Voeg een uitgave toe en elk verschil komt hier te staan.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldi',
  'balances.count': {
    one: '{travellers} reiziger',
    other: '{travellers} reizigers',
  },
  'balances.empty':
    'Saldi verschijnen zodra een uitgave een betaler en een verdeling heeft.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Per categorie',
  'categories.againstBudget': 'Ten opzichte van het reisbudget',
  'categories.progressLabel': 'Besteed ten opzichte van het reisbudget',
  'categories.empty':
    'Budgetregels en uitgaven worden hier uitgesplitst zodra er iets uit te splitsen valt.',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Vastgelegde betalingen',
  'payments.empty.title': 'Nog geen betalingen',
  'payments.empty.body':
    'Zodra iemand een saldo terugbetaalt, wordt de overboeking hier vastgelegd.',
} satisfies TranslationOf<typeof En>

export default messages
