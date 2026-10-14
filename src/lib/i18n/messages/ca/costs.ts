/**
 * The costs tab's copy, in ca.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` només per a nombres compactes grans.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Tu',
  'person.youTarget': 'tu',
  'person.removed': 'Viatger eliminat',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Vols eliminar aquesta despesa?',
  'delete.description':
    '«{title}» i el seu repartiment surten del compte. Això no es pot desfer.',
  'delete.failed': 'No s’ha pogut eliminar',
  'delete.failedBody':
    'No s’ha pogut eliminar la despesa. Torna-ho a provar en un moment.',
  'delete.noBalances': 'Cap saldo no canvia: no hi havia res repartit.',
  'delete.balancesChange': 'Canvien els saldos de {names}.',
  'delete.confirm': 'Elimina la despesa',
  'delete.working': 'S’està eliminant la despesa',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Despeses',
  'toolbar.shownOf': '{shown} de {total}',
  'toolbar.searchPlaceholder': 'Cerca a despeses, notes o qui va pagar…',
  'toolbar.searchLabel': 'Cerca despeses',
  'toolbar.allCategories': 'Totes les categories',
  'toolbar.allDays': 'Tots els dies',
  'toolbar.filterCategory': 'Filtra per categoria',
  'toolbar.filterDay': 'Filtra per dia',
  'toolbar.whose': 'Despeses de qui',
  'toolbar.paidByMe': 'Pagades per mi',
  'toolbar.owedToMe': 'Em deuen',
  'toolbar.logged': {
    one: '{value} registrada',
    many: '{value} registrades',
    other: '{value} registrades',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Repartiment entre viatgers',
  'split.label': 'Reparteix entre',
  'split.everyone': 'Tothom',
  'split.nobody': 'Ningú',
  'split.how': 'Com es reparteix aquesta despesa',
  'split.method.equal': 'A parts iguals',
  'split.method.equalHint':
    'Tothom qui hi és inclòs paga el mateix, i la unitat mínima sobrant va a la primera persona de la llista.',
  'split.method.exact': 'Exacte',
  'split.method.exactHint':
    'Escriu què deu cadascú de debò. Els imports han de sumar el total.',
  'split.method.shares': 'Parts',
  'split.method.sharesHint':
    'Pondera el repartiment: 2 parts per a una parella, 1 per a la resta.',
  'split.method.percentage': 'Percentatge',
  'split.method.percentageHint':
    'Repartiment per percentatge. Els percentatges han de sumar 100.',
  'split.exactFor': 'Import exacte de {name}',
  'split.percentFor': 'Percentatge de {name}',
  'split.sharesFor': 'Parts de {name}',
  'split.balanced': 'Quadra',
  'split.allocated': '{allocated} de {total} assignat',
  'split.over': '{amount} de més',
  'split.left': 'queden {amount}',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Import',
  'field.currency': 'Moneda',
  'field.date': 'Data',
  'field.paidBy': 'Pagat per',
  'expense.editTitle': 'Edita aquesta despesa',
  'expense.addTitle': 'Afegeix una despesa',
  'expense.editDescription':
    'Canviar l’import el torna a repartir entre tothom qui hi és inclòs a sota.',
  'expense.addDescription':
    'Els imports d’aquest viatge es guarden en {currency}. Anota un rebut en la seva pròpia moneda i indica a quant es va convertir.',
  'expense.saveFailed': 'No s’ha pogut desar',
  'expense.what': 'Per a què era',
  'expense.whatPlaceholder': 'Sopar al Kyubey',
  'expense.amountNotANumber': 'Escriu l’import com a número.',
  'expense.currencyLabel': 'Moneda en què està escrit aquest rebut',
  'expense.convertedTo': 'Convertit a {currency}',
  'expense.convertedHint': 'A quant va sortir {from} en {to} al teu extracte.',
  'expense.convertedSuggested':
    'Suggerit a partir de la taxa usada en aquest viatge el {date} ({rate}). Canvia-ho perquè coincideixi amb el teu extracte.',
  'expense.convertedNotANumber': 'Escriu l’import convertit com a número.',
  'expense.dateLabel': 'Data de la despesa',
  'expense.paidByHint':
    'Deixa-ho sense pagador si estàs anotant un rebut que encara ningú no ha cobert.',
  'expense.nobodyYet': 'Encara ningú',
  'expense.whoPaid': 'Qui ha pagat',
  'expense.notesHint': 'Opcional. Allò que el rebut no digui.',
  'expense.notesPlaceholder':
    'Menú de degustació compartit, les begudes a part.',
  'expense.noAmount': 'Encara sense import',
  'expense.saving': 'S’està desant la despesa',
  'expense.saveChanges': 'Desa els canvis',
  'expense.add': 'Afegeix la despesa',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Registra un pagament',
  'payment.description':
    'Anotar una transferència la treu dels dos saldos. No mou diners: planned.travel porta el compte, els diners els mou el teu banc.',
  'payment.youSuffix': '{name} (tu)',
  'payment.pays': '{from} paga a {to}',
  'payment.pickTwo': 'Tria dues persones diferents.',
  'payment.paidTo': 'Pagat a',
  'payment.needsTwo': 'Un pagament necessita dues persones diferents.',
  'payment.whoPaying': 'Qui paga',
  'payment.whoPaid': 'Qui rep',
  'payment.amountIn': 'Import en {currency}',
  'payment.amountPositive': 'Escriu un import més gran que zero.',
  'payment.currencyLabel': 'Moneda en què s’ha fet el pagament',
  'payment.how': 'Com',
  'payment.howMade': 'Com es va fer el pagament',
  'payment.dateLabel': 'Data del pagament',
  'payment.note': 'Nota',
  'payment.noteHint': 'Opcional. Una referència, o què cobria.',
  'payment.notePlaceholder': 'Cobreix l’hotel de Kyoto i els passis JR.',
  'payment.recording': 'S’està registrant el pagament',
  'payment.confirm': 'Registra el pagament',
  'payment.failed':
    'No s’ha pogut registrar el pagament. Torna-ho a provar en un moment.',
  'payment.method.bankTransfer': 'Transferència bancària',
  'payment.method.cash': 'Efectiu',
  'payment.method.card': 'Targeta',
  'payment.method.app': 'App de pagament',
  'payment.method.other': 'Una altra cosa',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Liquidació',
  'settle.addPayment': 'Afegeix un pagament',
  'settle.action': 'Liquida',
  'settle.empty.title': 'Tothom està en paus',
  'settle.empty.body':
    'No cal cap transferència. Afegeix una despesa i qualsevol desequilibri apareixerà aquí.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Saldos',
  'balances.count': {
    one: '{travellers} viatger',
    many: '{travellers} viatgers',
    other: '{travellers} viatgers',
  },
  'balances.empty':
    'Els saldos apareixen quan una despesa té pagador i repartiment.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Per categoria',
  'categories.againstBudget': 'Respecte al pressupost del viatge',
  'categories.progressLabel': 'Gastat respecte al pressupost del viatge',
  'categories.empty':
    'Les línies de pressupost i les despeses es desglossen aquí quan hi ha alguna cosa a desglossar.',
  'categories.legendLabel': 'Despesa per categoria',
  'categories.planned': '{amount} previst',
  'categories.nothingSpent':
    "Encara no s'ha gastat res. Això és el que has previst.",
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'menys de {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Per a qui s’ha gastat',
  'memberBar.others': {
    one: '{others} altre viatger',
    many: '{others} altres viatgers',
    other: '{others} altres viatgers',
  },
  'memberBar.notSplit': 'Sense assignar a ningú',
  'totalTile.label': 'Despesa total del viatge',
  'totalTile.captionPlanned': 'Previst {amount} entre tots els viatgers',
  'totalTile.captionBudget': '{amount} de pressupost per al viatge',
  'totalTile.yourShare': 'La teva part',
  'totalTile.youPaid': 'Has pagat',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pagaments registrats',
  'payments.empty.title': 'Encara cap pagament',
  'payments.empty.body':
    'Quan algú retorna un saldo, la transferència queda registrada aquí.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Pots veure els costos, però no canviar-los',
  'readOnly.body':
    'Només els propietaris del viatge i les persones que el poden editar afegeixen, modifiquen o eliminen despeses i registren pagaments. Demana-ho a un propietari si cal canviar alguna cosa.',
  'readOnly.empty':
    'Encara no s’ha registrat cap despesa en aquest viatge. Apareixeran aquí quan un propietari o un editor les afegeixi.',
  'readOnly.settleEmpty':
    'Ara no cal cap transferència. Qualsevol desequilibri apareixerà aquí.',
  'refusal.rebaseChanged':
    'El viatge ha canviat mentre ho confirmaves, així que no s’ha canviat res. Revisa les xifres noves i torna a confirmar.',
  'refusal.tripCurrencyChanged':
    'La moneda del pressupost d’aquest viatge ara és {to}, així que no s’ha desat. La pàgina s’ha actualitzat: revisa l’import i torna a desar.',
} satisfies TranslationOf<typeof En>

export default messages
