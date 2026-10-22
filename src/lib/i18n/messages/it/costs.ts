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
  'person.removedTarget': 'un viaggiatore rimosso',
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
  'split.departed': 'Ha lasciato il viaggio',
  'split.departedHint':
    'Deselezionare chi ha lasciato il viaggio elimina definitivamente la sua quota.',
  'split.includeFor': 'Includi {name} in questa divisione',
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
  'expense.convertedTo': 'Convertito in {currency}',
  'expense.convertedHint':
    'Quanto ha dato {from} in {to} sul tuo estratto conto.',
  'expense.convertedSuggested':
    'Suggerito dal tasso usato in questo viaggio il {date} ({rate}). Modificalo perché corrisponda al tuo estratto conto.',
  'expense.convertedNotANumber': 'Scrivi l’importo convertito come numero.',
  'expense.paidByHint':
    'Lascialo senza pagante se stai registrando una ricevuta che nessuno ha ancora coperto.',
  'expense.nobodyYet': 'Ancora nessuno',
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
  'payment.amountIn': 'Importo in {currency}',
  'payment.amountPositive': 'Scrivi un importo maggiore di zero.',
  'payment.how': 'Come',
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
  'categories.legendLabel': 'Spesa per categoria',
  'categories.planned': '{amount} previsti',
  'categories.nothingSpent':
    'Non è stato ancora speso nulla. Ecco cosa hai previsto.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'meno del {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Per chi è stata spesa',
  'memberBar.others': {
    one: '{others} altro viaggiatore',
    many: '{others} altri viaggiatori',
    other: '{others} altri viaggiatori',
  },
  'memberBar.notSplit': 'Non assegnato a nessuno',
  'totalTile.label': 'Spesa totale del viaggio',
  'totalTile.captionPlanned': '{amount} previsti per tutti i viaggiatori',
  'totalTile.captionBudget': '{amount} di budget per il viaggio',
  'totalTile.yourShare': 'La tua parte',
  'totalTile.youPaid': 'Hai pagato',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Pagamenti registrati',
  'payments.empty.title': 'Nessun pagamento ancora',
  'payments.empty.body':
    'Quando qualcuno restituisce un saldo, il trasferimento viene registrato qui.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Questo viaggio è archiviato. Ripristinalo prima di modificare le spese.',
  'readOnly.title': 'Puoi vedere i costi, ma non modificarli',
  'readOnly.body':
    'Solo i proprietari del viaggio e chi può modificarlo aggiungono, cambiano o eliminano spese e registrano pagamenti. Chiedi a un proprietario se qualcosa va cambiato.',
  'readOnly.empty':
    'In questo viaggio non è ancora stata registrata nessuna spesa. Appariranno qui quando un proprietario o un editor le aggiungerà.',
  'readOnly.settleEmpty':
    'Al momento non servono trasferimenti. Qualsiasi squilibrio apparirebbe qui.',
  'refusal.rebaseChanged':
    'Il viaggio è cambiato mentre confermavi, quindi non è stato modificato nulla. Controlla le nuove cifre e conferma di nuovo.',
  'refusal.tripCurrencyChanged':
    'La valuta del budget di questo viaggio ora è {to}, quindi non è stato salvato nulla. La pagina è stata aggiornata: controlla l’importo e salva di nuovo.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Valuta di visualizzazione',
  'display.indicator.perTrip': 'Valuta propria',
  'display.indicator.fixed': 'Anche in {code}',
  'display.menu.perTrip': 'Ogni viaggio nella sua valuta',
  'display.menu.workspace': '{code} (predefinita dello spazio)',
  'display.menu.rateHint': 'Usa un tasso già registrato su un viaggio',
  'display.menu.currentHint': 'Scelta, ma nessun tasso registrato la copre',
  'display.menu.needsLiveRate':
    'Richiede un tasso in tempo reale, non ancora disponibile',
  'display.menu.saving': 'Salvataggio della scelta',
  'display.error.title': 'La valuta di visualizzazione non è stata salvata',
  'display.error.body':
    'Non è stato possibile salvare la scelta. Riprova tra un momento.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel':
    'Circa {amount} {code} nella tua valuta di visualizzazione',
  'display.row.notConverted': 'Non convertito',
  'display.alert.title': 'Alcuni importi non sono convertiti',
  'display.alert.body':
    'Per queste coppie di valute non è registrato alcun tasso, quindi gli importi restano nella valuta del budget:',
  'display.alert.pair': '{from} in {to} il {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Cambia la valuta del budget',
  'rebase.title': 'Cambia la valuta del budget',
  'rebase.description':
    'Gli importi che hai scritto restano com’erano. I totali e i saldi di questo viaggio vengono convertiti nella nuova valuta.',
  'rebase.to': 'Nuova valuta',
  'rebase.toPlaceholder': 'Scegli una valuta',
  'rebase.rateLabel': 'Tasso di cambio (1 {from} in {to})',
  'rebase.rateInverse': 'Cioè 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Scrivi un tasso maggiore di zero.',
  'rebase.rateOutOfRange':
    'Questo tasso sembra decisamente troppo grande o troppo piccolo. Controlla in che verso va.',
  'rebase.source.recent': 'L’ultimo tasso usato in questo spazio',
  'rebase.source.manual': 'Il tasso che hai scritto',
  'rebase.noRate':
    'Non c’è alcun tasso registrato da {from} a {to}. Scrivi quello che vuoi usare.',
  'rebase.waitingForRate': 'L’anteprima appare appena c’è un tasso.',
  'rebase.loading': 'Calcolo della conversione',
  'rebase.example':
    '{original} resta com’è stato scritto e viene conteggiato come {converted}.',
  'rebase.count.expenses': {
    one: '{count} spesa verrà conteggiata in {to}.',
    many: '{count} di spese verranno conteggiate in {to}.',
    other: '{count} spese verranno conteggiate in {to}.',
  },
  'rebase.count.payments': {
    one: '{count} pagamento verrà conteggiato in {to}.',
    many: '{count} di pagamenti verranno conteggiati in {to}.',
    other: '{count} pagamenti verranno conteggiati in {to}.',
  },
  'rebase.count.planned': {
    one: '{count} voce prevista verrà conteggiata in {to}.',
    many: '{count} di voci previste verranno conteggiate in {to}.',
    other: '{count} voci previste verranno conteggiate in {to}.',
  },
  'rebase.pinned':
    'I prezzi di luoghi, prenotazioni, alloggi e trasporti restano in {from}.',
  'rebase.target': 'Il budget del viaggio {before} diventa {after}.',
  'rebase.rounding':
    'Ogni importo viene arrotondato una sola volta, quindi un saldo può spostarsi fino a {amount}.',
  'rebase.leftover': 'Dopo la modifica, {name} dovrebbe {amount} a {other}.',
  'rebase.someone': 'Qualcuno',
  'rebase.nothing':
    'In questo viaggio non c’è ancora nulla con un prezzo, quindi non c’è niente da convertire.',
  'rebase.unconverted': {
    one: '{count} voce è in una valuta diversa da {from} e non può essere convertita automaticamente. Di solito è una spesa creata da una prenotazione con il prezzo in un’altra valuta: modificala o eliminala, poi riprova.',
    many: '{count} di voci sono in una valuta diversa da {from} e non possono essere convertite automaticamente. Di solito sono spese create da prenotazioni con il prezzo in un’altra valuta: modificale o eliminale, poi riprova.',
    other:
      '{count} voci sono in una valuta diversa da {from} e non possono essere convertite automaticamente. Di solito sono spese create da prenotazioni con il prezzo in un’altra valuta: modificale o eliminale, poi riprova.',
  },
  'rebase.unsplittable': {
    one: '{count} spesa ha una divisione che non può essere riportata, perché tutte le sue quote sono zero. Modificala o eliminala, poi riprova.',
    many: '{count} di spese hanno una divisione che non può essere riportata, perché tutte le loro quote sono zero. Modificale o eliminale, poi riprova.',
    other:
      '{count} spese hanno una divisione che non può essere riportata, perché tutte le loro quote sono zero. Modificale o eliminale, poi riprova.',
  },
  'rebase.outOfRange':
    'Con questo tasso un importo del viaggio sarebbe troppo grande per essere salvato in {to}. Controlla il tasso e il suo verso.',
  'rebase.tooLarge':
    'Questo viaggio ha troppe voci per essere modificato in un solo passaggio: servirebbero {changes} modifiche in una volta e il limite è {limit}. Per ora il budget resta in {from}.',
  'rebase.copyPending':
    'Questo viaggio è ancora in fase di copia. Riprova tra un attimo.',
  'rebase.error':
    'Non è stato possibile caricare la conversione. Non è stato modificato nulla.',
  'rebase.commitError':
    'Non siamo riusciti a cambiare la valuta del budget. Non è stato modificato nulla.',
  'rebase.stale':
    'La valuta del budget del viaggio ora è {current}, non {from}. Chiudi questa finestra e riaprila.',
  'rebase.sameCurrency': "Il budget è già in {to}. Scegli un'altra valuta.",
  'rebase.commitUnknown':
    'Non siamo riusciti a confermare se la valuta del budget sia passata a {to}. Ricarica la pagina per verificare prima di riprovare.',
  'rebase.retry': 'Riprova',
  'rebase.confirm': 'Passa a {to}',
  'rebase.committing': 'Cambio della valuta del budget',
  'rebase.done': 'Il budget ora è in {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Ancora nulla di speso',
  'screen.summary': '{expenses} · {spent} spesi',
  'count.expenses': {
    one: '{expenses} spesa',
    many: '{expenses} spese',
    other: '{expenses} spese',
  },
  'screen.exportCsv': 'Esporta CSV',
  'screen.addFirst': 'Aggiungi la prima spesa',
  'screen.empty.title': 'Ancora nessuna spesa',
  'screen.empty.body':
    'Registra quello che spendi mentre viaggi. planned.travel lo divide tra tutti i viaggiatori e tiene il totale corrente in {currency}.',
  'screen.filtered.title': 'Nessuna spesa corrisponde a questi filtri',
  'screen.filtered.body':
    'Allarga la ricerca, scegli un altro giorno o azzera i filtri per rivedere tutto il viaggio.',
  'export.empty.title': 'Niente da esportare',
  'export.empty.body': 'Nessuna spesa corrisponde ai filtri attivi.',
  'export.ready.title': 'Esportazione pronta',
  'export.ready.body': {
    one: '{expenses} spesa scritta nel CSV.',
    many: '{expenses} spese scritte nel CSV.',
    other: '{expenses} spese scritte nel CSV.',
  },
  'list.daySpent': '{amount} spesi',
  'skeleton.loading': 'Caricamento delle spese',
  'row.noPayer': 'Ancora senza pagante',
  'row.youPaid': 'Hai pagato tu',
  'row.paid': 'Ha pagato {name}',
  'row.notYourShare': 'non è la tua quota',
  'row.yourShare': '{amount} tuoi',
  'row.noteOn': 'Nota su {title}',
  'row.edit': 'Modifica {title}',
  'row.delete': 'Elimina {title}',
  'row.saving': 'Salvataggio',
  'tile.owe.label': 'Devi',
  'tile.owe.settled': 'Sei in pari',
  'tile.owe.pending': 'Salda prima di tornare a casa',
  'tile.owe.to': 'A',
  'tile.owed.label': 'Ti devono',
  'tile.owed.none': 'Nessuno ti deve nulla',
  'tile.owed.pending': 'Devono ancora tornare a te',
  'tile.owed.from': 'Da',
  'tile.outstanding.label': 'In sospeso',
  'tile.outstanding.none': 'Ogni spesa ha un pagante',
  'tile.outstanding.some': {
    one: '{expenses} spesa ancora senza pagante',
    many: '{expenses} spese ancora senza pagante',
    other: '{expenses} spese ancora senza pagante',
  },
  'category.accommodation': 'Alloggio',
  'category.transport': 'Trasporti',
  'category.food': 'Cibo e bevande',
  'category.activities': 'Attività',
  'category.shopping': 'Acquisti',
  'category.fees': 'Tasse e commissioni',
  'category.insurance': 'Assicurazione',
  'category.other': 'Altro',
  'toolbar.summary.everything': 'Viene mostrato tutto',
  'toolbar.summary.filtered': 'Filtrato: {filters}',
  'toolbar.summary.search': 'che corrisponde a «{term}»',
  'write.added': 'Spesa aggiunta',
  'write.updated': 'Spesa aggiornata',
  'write.deleted': 'Spesa eliminata',
  'write.addFailed': 'La spesa non è stata aggiunta',
  'write.editFailed': 'La spesa non è stata salvata',
  'write.deleteFailed': 'La spesa non è stata eliminata',
  'write.paymentRecorded': 'Pagamento registrato',
  'write.paymentRecordedBody': 'Entrambi i saldi sono aggiornati.',
  'write.paymentFailed': 'Il pagamento non è stato registrato',
  'write.rolledBack': 'La modifica è stata annullata.',
  'expense.saveFallback':
    'Non è stato possibile salvare la spesa. Riprova tra un momento.',
} satisfies TranslationOf<typeof En>

export default messages
