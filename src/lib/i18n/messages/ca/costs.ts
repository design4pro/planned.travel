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
  'person.removedTarget': 'un viatger eliminat',
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
  'delete.payment.title': 'Vols eliminar aquest pagament?',
  'delete.payment.description':
    '«{title}» surt del compte. Això no es pot desfer. Per corregir un pagament, torna a registrar-lo.',
  'delete.payment.failedBody':
    'No s’ha pogut eliminar el pagament. Torna-ho a provar en un moment.',
  'delete.payment.confirm': 'Elimina el pagament',
  'delete.payment.working': 'S’està eliminant el pagament',

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
  'split.departed': 'Ha deixat el viatge',
  'split.departedHint':
    "Si desmarques algú que ha deixat el viatge, la seva part s'elimina definitivament.",
  'split.includeFor': 'Inclou {name} en aquesta divisió',
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
  'expense.convertedTo': 'Convertit a {currency}',
  'expense.convertedHint': 'A quant va sortir {from} en {to} al teu extracte.',
  'expense.convertedSuggested':
    'Suggerit a partir de la taxa usada en aquest viatge el {date} ({rate}). Canvia-ho perquè coincideixi amb el teu extracte.',
  'expense.convertedNotANumber': 'Escriu l’import convertit com a número.',
  'expense.paidByHint':
    'Deixa-ho sense pagador si estàs anotant un rebut que encara ningú no ha cobert.',
  'expense.nobodyYet': 'Encara ningú',
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
  'payment.amountIn': 'Import en {currency}',
  'payment.amountPositive': 'Escriu un import més gran que zero.',
  'payment.how': 'Com',
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
  'payments.delete': 'Elimina el pagament de {from} a {to}, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Aquest viatge està arxivat. Restaura’l abans de canviar les despeses.',
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
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Moneda de visualització',
  'display.indicator.perTrip': 'Moneda pròpia',
  'display.indicator.fixed': 'També en {code}',
  'display.menu.perTrip': 'Cada viatge en la seva moneda',
  'display.menu.workspace': '{code} (predeterminada de l’espai)',
  'display.menu.rateHint': 'Fa servir un tipus ja registrat en un viatge',
  'display.menu.currentHint': 'Triada, però cap tipus registrat la cobreix',
  'display.menu.needsLiveRate':
    'Necessita un tipus en directe, que encara no està disponible',
  'display.menu.disabledHint':
    'Les divises sense un canvi registrat apareixen a la llista, però no es poden triar: necessiten un canvi en directe que encara no està disponible.',
  'display.menu.saving': 'Desant la teva elecció',
  'display.error.title': 'No s’ha desat la moneda de visualització',
  'display.error.body':
    'No s’ha pogut desar la teva elecció. Torna-ho a provar d’aquí a un moment.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Uns {amount} {code} a la teva moneda de visualització',
  'display.row.notConverted': 'Sense convertir',
  'display.alert.title': 'Algunes xifres no estan convertides',
  'display.alert.body':
    'No hi ha tipus registrat per a aquests parells de monedes, així que aquestes xifres es queden en la moneda del pressupost:',
  'display.alert.pair': '{from} a {to} el {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Canvia la moneda del pressupost',
  'rebase.title': 'Canvi de la moneda del pressupost',
  'rebase.description':
    'Els imports que has escrit es queden tal com els has escrit. Els totals i els saldos d’aquest viatge es converteixen a la moneda nova.',
  'rebase.to': 'Moneda nova',
  'rebase.toPlaceholder': 'Tria una moneda',
  'rebase.rateLabel': 'Tipus de canvi (1 {from} en {to})',
  'rebase.rateInverse': 'És a dir, 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Escriu un tipus major que zero.',
  'rebase.rateOutOfRange':
    'Aquest tipus sembla massa gran o massa petit. Comprova en quin sentit va.',
  'rebase.source.recent': 'L’últim tipus utilitzat en aquest espai',
  'rebase.source.manual': 'El tipus que has escrit',
  'rebase.noRate':
    'No hi ha cap tipus registrat de {from} a {to}. Escriu el tipus que vols fer servir.',
  'rebase.waitingForRate':
    'La previsualització apareix tan bon punt hi ha un tipus.',
  'rebase.loading': 'Calculant la conversió',
  'rebase.example':
    '{original} es queda tal com l’has escrit i es compta com a {converted}.',
  'rebase.count.expenses': {
    one: '{count} despesa es comptarà en {to}.',
    many: '{count} despeses es comptaran en {to}.',
    other: '{count} despeses es comptaran en {to}.',
  },
  'rebase.count.payments': {
    one: '{count} pagament es comptarà en {to}.',
    many: '{count} pagaments es comptaran en {to}.',
    other: '{count} pagaments es comptaran en {to}.',
  },
  'rebase.count.planned': {
    one: '{count} element previst es comptarà en {to}.',
    many: '{count} elements previstos es comptaran en {to}.',
    other: '{count} elements previstos es comptaran en {to}.',
  },
  'rebase.pinned':
    'Els preus dels llocs, les reserves, els allotjaments i els trajectes es queden en {from}.',
  'rebase.target': 'El pressupost del viatge {before} passa a ser {after}.',
  'rebase.rounding':
    'Cada import s’arrodoneix una sola vegada, així que un saldo pot variar fins a {amount}.',
  'rebase.leftover': 'Després del canvi, {name} deuria {amount} a {other}.',
  'rebase.someone': 'Algú',
  'rebase.nothing':
    'Encara no hi ha res amb preu en aquest viatge, així que no cal convertir res.',
  'rebase.unconverted': {
    one: '{count} entrada és en una moneda diferent de {from} i no es pot convertir automàticament. Normalment és una despesa creada a partir d’una reserva amb preu en una altra moneda: edita-la o elimina-la i torna-ho a provar.',
    many: '{count} entrades són en una moneda diferent de {from} i no es poden convertir automàticament. Normalment són despeses creades a partir de reserves amb preu en una altra moneda: edita-les o elimina-les i torna-ho a provar.',
    other:
      '{count} entrades són en una moneda diferent de {from} i no es poden convertir automàticament. Normalment són despeses creades a partir de reserves amb preu en una altra moneda: edita-les o elimina-les i torna-ho a provar.',
  },
  'rebase.unsplittable': {
    one: '{count} despesa té un repartiment que no es pot traslladar, perquè totes les parts hi són zero. Edita-la o elimina-la i torna-ho a provar.',
    many: '{count} despeses tenen un repartiment que no es pot traslladar, perquè totes les parts hi són zero. Edita-les o elimina-les i torna-ho a provar.',
    other:
      '{count} despeses tenen un repartiment que no es pot traslladar, perquè totes les parts hi són zero. Edita-les o elimina-les i torna-ho a provar.',
  },
  'rebase.outOfRange':
    'Amb aquest tipus un import del viatge seria massa gran per desar-lo en {to}. Comprova el tipus i en quin sentit va.',
  'rebase.tooLarge':
    'Aquest viatge té massa entrades per canviar-les d’una sola vegada: caldrien {changes} canvis alhora i el límit és {limit}. De moment el pressupost es queda en {from}.',
  'rebase.copyPending':
    'Aquest viatge encara s’està copiant. Torna-ho a provar d’aquí a un moment.',
  'rebase.error': 'No s’ha pogut carregar la conversió. No s’ha canviat res.',
  'rebase.commitError':
    'No hem pogut canviar la moneda del pressupost. No s’ha canviat res.',
  'rebase.stale':
    "La moneda del pressupost del viatge ara és {current}, no {from}. Tanca aquest diàleg i torna'l a obrir.",
  'rebase.sameCurrency': 'El pressupost ja és en {to}. Tria una altra moneda.',
  'rebase.commitUnknown':
    'No hem pogut confirmar si la moneda del pressupost ha canviat a {to}. Recarrega la pàgina per comprovar-ho abans de tornar-ho a provar.',
  'rebase.retry': 'Torna-ho a provar',
  'rebase.confirm': 'Canvia a {to}',
  'rebase.committing': 'Canviant la moneda del pressupost',
  'rebase.done': 'Ara el pressupost és en {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Encara no s’ha gastat res',
  'screen.summary': '{expenses} · {spent} gastats',
  'count.expenses': {
    one: '{expenses} despesa',
    many: '{expenses} despeses',
    other: '{expenses} despeses',
  },
  'screen.exportCsv': 'Exporta en CSV',
  'screen.addFirst': 'Afegeix la primera despesa',
  'screen.empty.title': 'Encara no hi ha despeses',
  'screen.empty.body':
    'Anota el que gastes a mesura que passa. planned.travel ho reparteix entre tots els viatgers i porta el total acumulat en {currency}.',
  'screen.filtered.title': 'Cap despesa coincideix amb aquests filtres',
  'screen.filtered.body':
    'Amplia la cerca, tria un altre dia o neteja els filtres per tornar a veure tot el viatge.',
  'export.empty.title': 'Res per exportar',
  'export.empty.body': 'Cap despesa coincideix amb els filtres activats.',
  'export.ready.title': 'Exportació llesta',
  'export.ready.body': {
    one: '{expenses} despesa escrita al CSV.',
    many: '{expenses} despeses escrites al CSV.',
    other: '{expenses} despeses escrites al CSV.',
  },
  'list.daySpent': '{amount} gastats',
  'skeleton.loading': 'Carregant les despeses',
  'row.noPayer': 'Encara sense pagador',
  'row.youPaid': 'Has pagat tu',
  'row.paid': 'Ha pagat {name}',
  'row.notYourShare': 'no és la teva part',
  'row.yourShare': '{amount} teus',
  'row.noteOn': 'Nota sobre {title}',
  'row.edit': 'Edita {title}',
  'row.delete': 'Elimina {title}',
  'row.saving': 'Desant',
  'tile.owe.label': 'Deus',
  'tile.owe.settled': 'Estàs en paus',
  'tile.owe.pending': 'Salda-ho abans de tornar a casa',
  'tile.owe.to': 'A',
  'tile.owed.label': 'Et deuen',
  'tile.owed.none': 'Ningú et deu res',
  'tile.owed.pending': 'Encara ha de tornar-te',
  'tile.owed.from': 'De',
  'tile.outstanding.label': 'Pendent',
  'tile.outstanding.none': 'Totes les despeses tenen pagador',
  'tile.outstanding.some': {
    one: '{expenses} despesa encara sense pagador',
    many: '{expenses} despeses encara sense pagador',
    other: '{expenses} despeses encara sense pagador',
  },
  'category.accommodation': 'Allotjament',
  'category.transport': 'Transport',
  'category.food': 'Menjar i beure',
  'category.activities': 'Activitats',
  'category.shopping': 'Compres',
  'category.fees': 'Taxes i càrrecs',
  'category.insurance': 'Assegurança',
  'category.other': 'Altres',
  'toolbar.summary.everything': 'Es mostra tot',
  'toolbar.summary.filtered': 'Filtrat: {filters}',
  'toolbar.summary.search': 'que coincideix amb «{term}»',
  'write.added': 'Despesa afegida',
  'write.updated': 'Despesa actualitzada',
  'write.deleted': 'Despesa eliminada',
  'write.addFailed': 'No s’ha afegit la despesa',
  'write.editFailed': 'No s’ha desat la despesa',
  'write.deleteFailed': 'No s’ha eliminat la despesa',
  'write.paymentRecorded': 'Pagament registrat',
  'write.paymentRecordedBody': 'Els dos saldos s’han actualitzat.',
  'write.paymentFailed': 'No s’ha registrat el pagament',
  'write.paymentDeleted': 'Pagament eliminat',
  'write.paymentDeleteFailed': 'No s’ha eliminat el pagament',
  'write.rolledBack': 'El canvi s’ha desfet.',
  'expense.saveFallback':
    'No s’ha pogut desar la despesa. Torna-ho a provar d’aquí a un moment.',
} satisfies TranslationOf<typeof En>

export default messages
