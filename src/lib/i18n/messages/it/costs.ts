/**
 * The costs tab's copy, in it.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurale.** `one` · `many` · `other`; `many` serve solo ai numeri
 * compatti grandi.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Tu',
  'person.youTarget': 'te',
  'person.removed': 'Viaggiatore rimosso',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Eliminare questa spesa?',
  'delete.description':
    '«{title}» e la sua divisione escono dal conteggio. Non si può annullare.',
  'delete.failed': 'Eliminazione non riuscita',
  'delete.failedBody':
    'Non è stato possibile eliminare la spesa. Riprova tra un momento.',
  'delete.noBalances':
    'Nessun saldo cambia: non c’era niente diviso su questa spesa.',
  'delete.balancesChange': 'Cambiano i saldi di {names}.',
  'delete.confirm': 'Elimina spesa',
  'delete.working': 'Eliminazione della spesa',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Spese',
  'toolbar.shownOf': '{shown} di {total}',
  'toolbar.searchPlaceholder': 'Cerca tra spese, note o chi ha pagato…',
  'toolbar.searchLabel': 'Cerca nelle spese',
  'toolbar.allCategories': 'Tutte le categorie',
  'toolbar.allDays': 'Tutti i giorni',
  'toolbar.filterCategory': 'Filtra per categoria',
  'toolbar.filterDay': 'Filtra per giorno',
  'toolbar.whose': 'Spese di chi',
  'toolbar.paidByMe': 'Pagate da me',
  'toolbar.owedToMe': 'Mi devono',
  'toolbar.logged': {
    one: '{value} registrata',
    many: '{value} registrate',
    other: '{value} registrate',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Divisione tra i viaggiatori',
  'split.label': 'Dividi tra',
  'split.everyone': 'Tutti',
  'split.nobody': 'Nessuno',
  'split.how': 'Come si divide questa spesa',
  'split.method.equal': 'In parti uguali',
  'split.method.equalHint':
    'Tutti gli inclusi pagano lo stesso, e l’unità minima in eccesso va alla prima persona dell’elenco.',
  'split.method.exact': 'Esatto',
  'split.method.exactHint':
    'Scrivi quanto deve davvero ognuno. Gli importi devono fare il totale.',
  'split.method.shares': 'Quote',
  'split.method.sharesHint':
    'Pesa la divisione: 2 quote per una coppia, 1 per gli altri.',
  'split.method.percentage': 'Percentuale',
  'split.method.percentageHint':
    'Divisione per percentuale. Le percentuali devono fare 100.',
  'split.exactFor': 'Importo esatto per {name}',
  'split.percentFor': 'Percentuale per {name}',
  'split.sharesFor': 'Quote per {name}',
  'split.balanced': 'Torna',
  'split.allocated': '{allocated} di {total} assegnato',
  'split.over': '{amount} in più',
  'split.left': 'restano {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Importo',
  'field.currency': 'Valuta',
  'field.date': 'Data',
  'field.paidBy': 'Pagato da',
  'expense.editTitle': 'Modifica questa spesa',
  'expense.addTitle': 'Aggiungi una spesa',
  'expense.editDescription':
    'Cambiare l’importo lo ridivide tra tutti quelli inclusi qui sotto.',
  'expense.addDescription':
    'Gli importi di questo viaggio sono tenuti in {currency}. Registra una ricevuta nella sua valuta e indica a quanto è stata convertita.',
  'expense.saveFailed': 'Salvataggio non riuscito',
  'expense.what': 'Per cosa era',
  'expense.whatPlaceholder': 'Cena al Kyubey',
  'expense.amountNotANumber': 'Scrivi l’importo come numero.',
  'expense.currencyLabel': 'Valuta in cui è scritta questa ricevuta',
  'expense.convertedTo': 'Convertito in {currency}',
  'expense.convertedHint':
    'Quanto ha dato {from} in {to} sul tuo estratto conto.',
  'expense.convertedNotANumber': 'Scrivi l’importo convertito come numero.',
  'expense.dateLabel': 'Data della spesa',
  'expense.paidByHint':
    'Lascialo senza pagante se stai registrando una ricevuta che nessuno ha ancora coperto.',
  'expense.nobodyYet': 'Ancora nessuno',
  'expense.whoPaid': 'Chi ha pagato',
  'expense.notesHint': 'Facoltativo. Tutto ciò che la ricevuta non dice.',
  'expense.notesPlaceholder': 'Menu degustazione diviso, bevande a parte.',
  'expense.noAmount': 'Ancora senza importo',
  'expense.saving': 'Salvataggio della spesa',
  'expense.saveChanges': 'Salva le modifiche',
  'expense.add': 'Aggiungi spesa',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Registra un pagamento',
  'payment.description':
    'Registrare un bonifico lo toglie da entrambi i saldi. Non muove denaro: planned.travel tiene il conto, i soldi li muove la tua banca.',
  'payment.youSuffix': '{name} (tu)',
  'payment.pays': '{from} paga {to}',
  'payment.pickTwo': 'Scegli due persone diverse.',
  'payment.paidTo': 'Pagato a',
  'payment.needsTwo': 'Un pagamento richiede due persone diverse.',
  'payment.whoPaying': 'Chi paga',
  'payment.whoPaid': 'Chi riceve',
  'payment.amountIn': 'Importo in {currency}',
  'payment.amountPositive': 'Scrivi un importo maggiore di zero.',
  'payment.how': 'Come',
  'payment.howMade': 'Come è stato fatto il pagamento',
  'payment.dateLabel': 'Data del pagamento',
  'payment.note': 'Nota',
  'payment.noteHint': 'Facoltativo. Un riferimento, o cosa copriva.',
  'payment.notePlaceholder': 'Copre l’hotel di Kyoto e i pass JR.',
  'payment.recording': 'Registrazione del pagamento',
  'payment.confirm': 'Registra pagamento',
  'payment.failed':
    'Non è stato possibile registrare il pagamento. Riprova tra un momento.',
  'payment.method.bankTransfer': 'Bonifico bancario',
  'payment.method.cash': 'Contanti',
  'payment.method.card': 'Carta',
  'payment.method.app': 'App di pagamento',
  'payment.method.other': 'Altro',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Saldo conti',
  'settle.addPayment': 'Aggiungi pagamento',
  'settle.action': 'Salda',
  'settle.empty.title': 'Sono tutti in pari',
  'settle.empty.body':
    'Non serve alcun trasferimento. Aggiungi una spesa e ogni squilibrio comparirà qui.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldi',
  'balances.count': {
    one: '{travellers} viaggiatore',
    many: '{travellers} viaggiatori',
    other: '{travellers} viaggiatori',
  },
  'balances.empty':
    'I saldi compaiono quando una spesa ha un pagante e una divisione.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Per categoria',
  'categories.againstBudget': 'Rispetto al budget del viaggio',
  'categories.progressLabel': 'Speso rispetto al budget del viaggio',
  'categories.empty':
    'Le voci di budget e le spese si scompongono qui quando c’è qualcosa da scomporre.',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pagamenti registrati',
  'payments.empty.title': 'Nessun pagamento ancora',
  'payments.empty.body':
    'Quando qualcuno restituisce un saldo, il trasferimento viene registrato qui.',
} satisfies TranslationOf<typeof En>

export default messages
