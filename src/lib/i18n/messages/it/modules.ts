/**
 * The trip modules' own copy, in it.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurale.** `one` · `many` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Non impostato',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Connessione',
  'presence.connecting.body':
    'Stiamo entrando nella stanza dal vivo di questo viaggio.',
  'presence.live.title': 'Dal vivo',
  'presence.live.body':
    'Messaggi, note e voti arrivano qui man mano che nascono.',
  'presence.reconnecting.title': 'Riconnessione',
  'presence.reconnecting.body':
    'La connessione è caduta. Riproviamo: tutto quello che invii viene comunque salvato.',
  'presence.offline.title': 'Non dal vivo',
  'presence.offline.body':
    'Gli aggiornamenti dal vivo sono spenti. Si salva ancora tutto; ricarica o riprova per recuperare.',
  'presence.reconnect': 'Riconnetti',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Tutti gli spostamenti',
  'transports.empty.title': 'Ancora nessuno spostamento',
  'transports.empty.body':
    'Voli, treni, traghetti e il tragitto dall’aeroporto vivono qui, con i codici di prenotazione e i numeri di posto a portata di mano il giorno stesso — e ogni coincidenza verificata rispetto a quella prima.',
  'transports.empty.action': 'Aggiungi il primo spostamento',
  'transports.filtered.title': 'Nessuno spostamento di quel tipo',
  'transports.filtered.body':
    'Ogni spostamento di questo viaggio va in modo diverso. Torna a «{label}» per vederli tutti.',
  'transports.filtered.action': 'Mostra tutti gli spostamenti',
  'transports.alert.impossible.title': {
    one: 'Una coincidenza è impossibile',
    many: '{value} coincidenze sono impossibili',
    other: '{value} coincidenze sono impossibili',
  },
  'transports.alert.impossible.body':
    'Uno spostamento parte prima che arrivi quello precedente. I nodi qui sotto dicono quali e di quanto.',
  'transports.alert.tight.title': {
    one: 'Una coincidenza è stretta',
    many: '{value} coincidenze sono strette',
    other: '{value} coincidenze sono strette',
  },
  'transports.alert.tight.body':
    'Il tempo c’è, ma poco per il mezzo che devi prendere. I nodi qui sotto mostrano quanto ne lascia ciascuno.',
  'transports.badge.impossible': {
    one: '{value} coincidenza rotta',
    many: '{value} coincidenze rotte',
    other: '{value} coincidenze rotte',
  },
  'transports.badge.tight': {
    one: '{value} coincidenza stretta',
    many: '{value} coincidenze strette',
    other: '{value} coincidenze strette',
  },
  'transports.badge.ok': 'Ogni coincidenza tiene',
  'transports.remove.body':
    'Lo spostamento esce da questo viaggio per sempre, insieme al riferimento della prenotazione e al posto. Se è solo annullato, imposta invece il suo stato su Annullata.',
  'transports.remove.confirm': 'Rimuovi lo spostamento',
  'transports.menu.edit': 'Modifica lo spostamento…',
  'transports.field.service': 'Servizio',
  'transports.field.bookingRef': 'Riferimento prenotazione',
  'transports.field.seat': 'Posto',
  'transports.field.distance': 'Distanza',
  'transports.noTime': 'Ancora senza orario',
  'transports.toast.statusFailed.title': 'Lo stato non è cambiato',
  'transports.toast.statusFailed.body':
    'Lo spostamento è rimasto nello stato precedente.',
  'transports.toast.removed': 'Spostamento rimosso',
  'transports.toast.removeFailed': 'Lo spostamento non è stato rimosso',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Aggiungi uno spostamento',
  'transports.dialog.editTitle': 'Modifica questo spostamento',
  'transports.dialog.description':
    'Voli, treni, traghetti e il tragitto dall’aeroporto. Gli orari sono quelli locali stampati sul biglietto.',
  'transports.form.modeLegend': 'Come viaggi',
  'transports.form.timingError': 'Controlla gli orari',
  'transports.field.namePlaceholder': 'ITA da FCO a HND',
  'transports.field.place': 'Luogo',
  'transports.field.code': 'Codice',
  'transports.field.date': 'Data',
  'transports.field.time': 'Partenza dopo le',
  'transports.field.departurePlaceholder': 'Roma Fiumicino',
  'transports.field.arrivalPlaceholder': 'Aeroporto di Tokyo-Haneda',
  'transports.field.carrier': 'Vettore',
  'transports.field.serviceNumber': 'Numero del servizio',
  'transports.field.bookingRefHint': 'Il codice che leggerai al banco.',
  'transports.field.notesPlaceholder':
    'Richiesto posto corridoio. Bagagli imbarcati fino a Kyoto.',
  'transports.action.add': 'Aggiungi lo spostamento',
  'transports.action.save': 'Salva lo spostamento',
  'transports.action.saving': 'Salvataggio dello spostamento',
  'transports.toast.added': 'Spostamento aggiunto',
  'transports.toast.addedBody': 'Ora è nell’ordine del viaggio.',
  'transports.toast.addFailed': 'Lo spostamento non è stato aggiunto',
  'transports.toast.updated': 'Spostamento aggiornato',
  'transports.toast.updateFailed': 'Lo spostamento non è stato aggiornato',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Nome',
  'field.time': 'Ora',
  'field.price': 'Prezzo',
  'field.notes': 'Note',
  'field.status': 'Stato',
  'form.saveError': 'Non è stato salvato',
  'action.cancel': 'Annulla',
  'action.showCode': 'Mostra {label}',
  'book.status.none': 'Senza stato',
  'book.status.pending': 'In attesa',
  'book.status.confirmed': 'Confermata',
  'book.status.completed': 'Conclusa',
  'book.status.cancelled': 'Annullata',
  'book.toast.statusFailed': 'Lo stato non è cambiato',
  'book.toast.statusFailedBody':
    'La prenotazione è rimasta nello stato precedente.',
  'book.toast.removed': 'Prenotazione rimossa',
  'book.toast.removeFailed': 'La prenotazione non è stata rimossa',
  'book.empty.title': 'Non è ancora stato prenotato nulla',
  'book.empty.body':
    'Alloggi, tavoli, visite e biglietti stanno qui — con il numero di conferma dove lo ritrovi alla porta, e la data che li mette sulla linea del tempo.',
  'book.empty.action': 'Aggiungi la prima prenotazione',
  'book.filtered.title': 'Ancora niente di quel tipo',
  'book.filtered.body':
    'Non c’è nulla prenotato tra i tipi che hai scelto. Togli il filtro per vedere il resto del banco.',
  'book.filtered.action': 'Togli il filtro',
  'book.panel.outstanding': 'Ancora da sistemare',
  'book.panel.outstandingEmpty':
    'Non resta nulla in sospeso — qui è tutto sistemato.',
  'book.panel.settled': 'Sistemato',
  'book.panel.settledEmpty':
    'Niente di sistemato ancora — è tutto ancora da rincorrere.',
  'book.import.badge': 'Importazione non controllata',
  'book.import.hint':
    'Importato da una conferma. Aprilo e salvalo per segnarlo come controllato.',
  'book.import.action': 'Importa',
  'book.import.title': 'Importa prenotazioni da un file',
  'book.import.description':
    'Lascia qui una conferma e la leggiamo noi. Niente entra nel viaggio prima che tu l’abbia vista.',
  'book.import.drop.idle': 'Lascia i file qui, oppure scegli',
  'book.import.drop.active': 'Rilascia per aggiungere',
  'book.import.drop.formats':
    'PDF, email salvata, pagina web, foto, Word, Excel, file di calendario o export JSON.',
  'book.import.drop.limits':
    'Fino a {files} file per volta, ciascuno fino a {size}.',
  'book.import.drop.browse': 'Scegli i file',
  'book.import.refused.format':
    '«{filename}» non è un file che questa importazione sa leggere. Legge un PDF, un’email salvata, una pagina web, una foto, un documento Word o Excel, un file di calendario o un export JSON.',
  'book.import.refused.tooMany':
    'Solo {files} file per volta. Il resto non è stato aggiunto.',
  'book.import.refused.tooLarge':
    '«{filename}» pesa {size}. Un’importazione legge file fino a {limit}.',
  'book.import.refused.empty':
    '«{filename}» è vuoto, quindi non c’è niente da leggere.',
  'book.import.ceiling.title':
    'Questo spazio ha letto tutte le sue conferme per questo mese',
  'book.import.ceiling.body':
    'Il piano include {ceiling} letture di file al mese e il credito si rinnova il primo. Una prenotazione a mano la puoi sempre aggiungere.',
  'book.import.ceiling.none':
    'Leggere un file di conferma non fa parte del piano di questo spazio',
  'book.import.ceiling.noneBody':
    'Passa a un piano superiore per farti leggere una conferma. Aggiungere una prenotazione a mano c’è sempre.',
  'book.import.widget.title': 'Stiamo leggendo le conferme',
  'book.import.widget.working': '{done} di {total} letti',
  'book.import.widget.file': 'Sto leggendo «{filename}»',
  'book.import.widget.done': {
    one: 'Una prenotazione pronta da controllare',
    many: '{count} prenotazioni pronte da controllare',
    other: '{count} prenotazioni pronte da controllare',
  },
  'book.import.widget.review': 'Controlla',
  'book.import.widget.failed': '«{filename}» non si è potuto leggere',
  'book.import.widget.stalled': 'Ci sta mettendo più del previsto',
  'book.import.widget.check': 'Guarda di nuovo',
  'book.import.widget.dismiss': 'Chiudi',
  'book.import.review.title': 'Cosa abbiamo letto',
  'book.import.review.from': 'Da «{filename}»',
  'book.import.review.selectAll': 'Seleziona tutto',
  'book.import.review.selectNone': 'Non selezionare niente',
  'book.import.review.confirm': {
    one: 'Aggiungi {count} prenotazione',
    many: 'Aggiungi {count} prenotazioni',
    other: 'Aggiungi {count} prenotazioni',
  },
  'book.import.review.confirmNone': 'Seleziona una prenotazione da aggiungere',
  'book.import.review.cancel': 'Annulla',
  'book.import.review.needsReview': 'Da guardare',
  'book.import.review.needsReviewHint':
    'Alcuni campi non erano nel documento. Apri la prenotazione dopo averla aggiunta.',
  'book.import.review.noPrice': 'Nessun prezzo letto',
  'book.import.review.noPriceHint':
    'Il documento non ne indicava uno chiaro, quindi è rimasto vuoto invece di essere indovinato.',
  'book.import.review.untitled': 'Prenotazione senza titolo',
  'book.import.empty.title':
    'In quel file non abbiamo trovato nessuna prenotazione',
  'book.import.empty.body':
    '«{filename}» non conteneva niente che somigli a una conferma. Prova un altro file, o aggiungi la prenotazione a mano.',
  'book.import.failed.title': '«{filename}» non si è potuto leggere',
  'book.import.failed.body':
    'Il file si è aperto ma non se n’è ricavato niente. Prova un altro file, o aggiungi la prenotazione a mano.',
  'book.import.failed.retry': 'Prova un altro file',
  'book.import.uploadFailed': '«{filename}» non è stato caricato',
  'book.import.uploadRetry': 'Riprova',
  'book.import.actionFailed': 'Riprova tra un momento.',
  'book.import.toast.added': {
    one: 'Una prenotazione aggiunta',
    many: '{count} prenotazioni aggiunte',
    other: '{count} prenotazioni aggiunte',
  },
  'book.import.partial.title':
    'Sono state aggiunte {written} prenotazioni su {total}',
  'book.import.partial.body':
    'Le altre restano selezionate. Aggiungendo di nuovo si scrivono solo quelle.',
  'book.import.partial.retry': 'Aggiungi le altre',
  'book.journeyLink': 'Nella scheda trasporti',
  'filter.all': 'Tutto',
  'book.remove.body':
    'Esce dalla linea del tempo per sempre. Se è solo annullata, imposta invece il suo stato su Annullata per conservare il record.',
  'book.remove.confirm': 'Rimuovi la prenotazione',
  'book.menu.edit': 'Modifica la prenotazione…',
  'book.menu.open': 'Apri la prenotazione',
  'book.noDate': 'Ancora senza data',
  'book.until': 'Fino al',
  'book.provider': 'Fornitore',
  'book.where': 'Dove',
  'book.guests': 'Persone',
  'book.confirmation': 'Conferma',
  'book.undated': 'Dai loro una data ed entrano nella linea del tempo',
  statusOf: 'Stato di {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Ancora senza stato',
  'book.statusChoice.pending': 'In attesa — tocca a loro',
  'book.dialog.addTitle': 'Aggiungi una prenotazione',
  'book.dialog.editTitle': 'Modifica questa prenotazione',
  'book.dialog.typeLegend': 'Che tipo di prenotazione',
  'book.field.namePlaceholder': 'Via Roma 15',
  'book.field.priceHint': 'Lascialo vuoto se non è ancora saldato.',
  'book.field.confirmation': 'Numero di conferma',
  'book.field.confirmationHint': 'Il codice che ti chiederanno al banco.',
  'book.field.day': 'Aggancia a un giorno',
  'book.field.dayHint': 'La fissa all’itinerario così compare nel programma.',
  'book.field.noDay': 'Fuori dall’itinerario',
  'book.field.link': 'Collegamento',
  'book.field.notesPlaceholder':
    'Concordato arrivo tardivo. Chiedere una camera lontano dall’ascensore.',
  'book.action.add': 'Aggiungi la prenotazione',
  'book.action.save': 'Salva la prenotazione',
  'book.action.saving': 'Salvataggio della prenotazione',
  'book.toast.added': 'Prenotazione aggiunta',
  'book.toast.addedBody': 'Ora è sulla linea del tempo.',
  'book.toast.addFailed': 'La prenotazione non è stata aggiunta',
  'book.toast.updated': 'Prenotazione aggiornata',
  'book.toast.updateFailed': 'La prenotazione non è stata aggiornata',

  'book.emptyFacts':
    'A parte il nome non c’è ancora nulla. Aprilo per aggiungere l’ora, il prezzo e il numero di conferma.',
  'book.onItinerary': 'Nell’itinerario: {day}',
  'book.dayNumber': 'Giorno {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Altro',
  'book.field.host': 'Hotel o host',
  'book.field.restaurant': 'Nome del ristorante',
  'book.field.operator': 'Operatore',
  'book.field.issuer': 'Emesso da',
  'book.field.carrier': 'Vettore',
  'book.field.address': 'Indirizzo',
  'book.field.meetingPoint': 'Punto d’incontro',
  'book.field.venue': 'Sede',
  'book.field.fromTo': 'Da e a',
  'book.field.checkIn': 'Check-in',
  'book.field.date': 'Data',
  'book.field.validOn': 'Valido il',
  'book.field.departs': 'Partenza',
  'book.field.checkOut': 'Check-out',
  'book.field.ends': 'Finisce',
  'book.field.arrives': 'Arrivo',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Museo Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Chi lo tiene per te',
  'book.example.accommodationTitle': 'Hotel Gracery Shinjuku · 2 camere twin',
  'book.example.restaurantTitle': 'Cena al Den',
  'book.example.activityTitle': 'teamLab Planets, 4 biglietti',
  'book.example.tourTitle': 'Passeggiata nel bosco di bambù di Arashiyama',
  'book.example.ticketTitle': 'Museo Ghibli, ingresso alle 10:00',
  'book.example.transportTitle': 'Nozomi 21 per Kyoto',
  'book.example.otherTitle': 'Cosa hai prenotato',
  'book.hint.accommodation':
    'Un hotel, un ryokan, un appartamento — dove dormi.',
  'book.hint.restaurant':
    'Un tavolo prenotato. L’ora è ciò su cui ti aspettano.',
  'book.hint.activity': 'Un corso, un bagno pubblico, un’esperienza prenotata.',
  'book.hint.tour': 'Un posto, un’ora e una guida che aspetta.',
  'book.hint.ticket':
    'Un ingresso a orario, un pass per il museo, una partita. Tieni il codice a portata.',
  'book.hint.transport':
    'Un posto prenotato. Gli spostamenti completi con i codici vanno in {module}.',
  'book.hint.other': 'Qualsiasi cosa a tuo nome che non rientri nelle altre.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Valigia',
  'lists.kind.todo': 'Da fare',
  'lists.kind.shopping': 'Spesa',
  'lists.kind.documents': 'Documenti',
  'lists.kind.fallback': 'Lista',
  'colour.none': 'Nessun colore',
  'colour.pine': 'Pino',
  'colour.inkBlue': 'Blu inchiostro',
  'colour.amber': 'Ambra',
  'colour.green': 'Verde',
  'colour.red': 'Rosso',
  'colour.slate': 'Ardesia',
  'lists.toast.created': 'Lista creata',
  'lists.toast.createdBody': 'Aggiungi la prima cosa che non devi dimenticare.',
  'lists.toast.createFailed': 'La lista non è stata creata',
  'lists.toast.updated': 'Lista aggiornata',
  'lists.toast.updateFailed': 'La lista non è stata aggiornata',
  'lists.error.weightLimit': 'Un limite di peso è un numero intero di grammi.',
  'lists.dialog.editTitle': 'Modifica questa lista',
  'lists.dialog.editBody':
    'Rinominala, cambia il tipo di lista o affidala a un solo viaggiatore.',
  'lists.dialog.addBody':
    'Valigia, cose da fare, spesa e i documenti da non dimenticare: ognuno ha la sua lista.',
  'lists.action.new': 'Nuova lista',
  'lists.field.namePlaceholder': 'Bagaglio a mano',
  'lists.field.kind': 'Tipo',
  'lists.field.kindAria': 'Tipo di lista',
  'lists.field.owner': 'Appartiene a',
  'lists.field.ownerHint': 'Le liste condivise le spunta chiunque.',
  'lists.field.everyone': 'Tutti quelli in viaggio',
  'lists.field.weightLimit': 'Limite di peso',
  'lists.field.weightLimitHint':
    'Grammi. Lascia vuoto se non c’è alcun limite da rispettare.',
  'colour.legend': 'Colore',
  'lists.action.saving': 'Salvataggio della lista',
  'lists.action.save': 'Salva la lista',
  'lists.action.create': 'Crea la lista',
  'lists.item.toast.added': 'Voce aggiunta',
  'lists.item.toast.addFailed': 'La voce non è stata aggiunta',
  'lists.item.toast.updated': 'Voce aggiornata',
  'lists.item.toast.updateFailed': 'La voce non è stata aggiornata',
  'lists.item.error.quantity': 'Una quantità è un numero intero da 1 a 999.',
  'lists.item.error.weight': 'Un peso è un numero intero di grammi.',
  'lists.item.dialog.editTitle': 'Modifica questa voce',
  'lists.item.dialog.addTitle': 'Aggiungi una voce',
  'lists.item.field.label': 'Voce',
  'lists.item.field.placeholder': 'Passaporto',
  'field.category': 'Categoria',
  'lists.item.field.categoryHint':
    'Raggruppa la lista sotto un titolo. Facoltativo.',
  'lists.item.field.categoryPlaceholder': 'Documenti',
  'lists.item.field.priority': 'Priorità',
  'lists.priorityChoice.high': 'Alta — da non dimenticare',
  'lists.priorityChoice.low': 'Bassa — se c’è spazio',
  'lists.priorityChoice.normal': 'Normale',
  'lists.item.field.quantity': 'Quantità',
  'lists.item.field.weight': 'Peso',
  'lists.item.field.weightHint': 'Grammi, per unità.',
  'lists.item.field.owner': 'Di chi è questo compito',
  'lists.item.owner.nobody': 'Nessuno in particolare',
  'lists.item.action.saving': 'Salvataggio della voce',
  'lists.item.action.save': 'Salva la voce',
  'lists.item.action.add': 'Aggiungi alla lista',
  'lists.template.loadError':
    'Al momento non è stato possibile caricare i modelli.',
  'lists.template.toast.added': 'Lista aggiunta da un modello',
  'lists.template.toast.addFailed': 'Il modello non è stato applicato',
  'lists.template.error.apply': 'Non è stato possibile applicarlo',
  'lists.template.error.load': 'I modelli non si sono caricati',
  'lists.template.empty.title': 'Ancora nessun modello',
  'lists.template.empty.body':
    'Salva una lista come modello quando ne hai una che rifaresti uguale, e comparirà qui per ogni viaggio futuro.',
  'lists.template.applying': 'Applicazione del modello',
  'lists.template.dialogTitle': 'Parti da un modello',
  'lists.template.loading': 'Caricamento dei modelli',
  'lists.template.apply': 'Applica il modello',
  'lists.template.from': 'Da un modello',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Non assegnato',
  'lists.toast.listRemoved': 'Lista rimossa',
  'lists.toast.listRemoveFailed': 'La lista non è stata rimossa',
  'lists.toast.itemRemoved': 'Voce rimossa',
  'lists.toast.itemRemoveFailed': 'La voce non è stata rimossa',
  'lists.toast.reset': 'Lista azzerata',
  'lists.toast.resetBody':
    'Tutto è dispuntato e pronto per il prossimo viaggio.',
  'lists.toast.resetFailed': 'La lista non è stata azzerata',
  'lists.toast.tickFailed': 'La spunta non è stata salvata',
  'lists.toast.tickFailedBody': 'La voce è tornata com’era.',
  'lists.toast.assignFailed': 'L’assegnazione non è stata salvata',
  'lists.toast.orderFailed': 'Il nuovo ordine non è stato salvato',
  'lists.toast.orderFailedBody': 'La lista è tornata com’era.',
  'lists.filter.todo': 'Ancora da fare',
  'lists.filter.done': 'Fatto',
  'lists.scope.all': 'Tutte le liste',
  'lists.scope.shared': 'Condivise',
  'lists.scope.mine': 'Mie',
  'lists.empty.mine.title': 'Ancora nessuna lista tua',
  'lists.empty.shared.title': 'Ancora nessuna lista condivisa',
  'lists.empty.mine.body':
    'Una lista tua la spunti solo tu: utile per le cose che nessun altro deve vedere.',
  'lists.empty.shared.body':
    'Una lista condivisa la spunta chiunque, così due persone non mettono in valigia lo stesso adattatore.',
  'lists.remove.list': 'Rimuovi la lista',
  'lists.remove.item': 'Rimuovi la voce',
  'lists.remove.itemBody': 'Esce da questa lista. Nient’altro cambia.',
  'lists.menu.editList': 'Modifica la lista…',
  'lists.menu.tickAll': 'Spunta tutto',
  'lists.menu.untickAll': 'Dispunta tutto',
  'lists.menu.reset': 'Azzera per il prossimo viaggio',
  'lists.menu.dragOrderLong': 'Passa a un ordine che puoi trascinare',
  'lists.menu.groupAgain': 'Raggruppa di nuovo per categoria',
  'lists.menu.dragOrder': 'Passa a un ordine trascinabile',
  'lists.menu.groupByCategory': 'Raggruppa per categoria',
  'lists.weight.packed': '{weight} in valigia',
  'lists.weight.packedOver': '{weight} in valigia — oltre il limite',
  'lists.weight.packedOf': '{weight} in valigia su {limit} consentiti',
  'lists.weight.packedOfOver':
    '{weight} in valigia su {limit} consentiti — oltre il limite',
  'lists.progress.ticked': '{done} su {total} spuntati',
  'lists.items.empty.title': 'Questa lista è vuota',
  'lists.items.empty.body':
    'Aggiungi la prima cosa che non devi dimenticare: il campo qui sotto è la via più rapida.',
  'lists.items.doneEmpty.title': 'Ancora nulla di spuntato',
  'lists.items.doneEmpty.body': 'Spunta qualcosa e comparirà qui.',
  'lists.items.todoEmpty.title': 'Qui è tutto fatto',
  'lists.items.todoEmpty.body':
    'Ogni voce di questa lista è spuntata. Passa a «{label}» per vederle.',
  'lists.category.other': 'Tutto il resto',
  'lists.dnd.fallbackName': 'questa voce',
  'lists.dnd.picked': '{name} preso.',
  'lists.dnd.dropped': '{name} lasciato. Il nuovo ordine è in salvataggio.',
  'lists.dnd.cancelled': 'Annullato. L’ordine resta invariato.',
  'lists.menu.editItem': 'Modifica la voce…',
  'lists.quickAdd.placeholder': 'Scrivi una voce e premi Invio',
  'lists.quickAdd.aria': 'Aggiungi una voce a questa lista',
  'lists.quickAdd.detailsHint':
    'Aggiungi con un peso, una categoria o una persona',
  'lists.quickAdd.detailsAria': 'Aggiungi una voce con tutti i dettagli',
  'lists.show': 'Mostra',
  'lists.priority.high': 'Alta',
  'lists.action.add': 'Aggiungi',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} voce',
    many: '{count} voci',
    other: '{count} voci',
  },
  'lists.template.copiedIn': {
    one: '{count} voce copiata, pronta da spuntare.',
    many: '{count} voci copiate, pronte da spuntare.',
    other: '{count} voci copiate, pronte da spuntare.',
  },
  'lists.remove.listBody': {
    one: 'La lista e la sua {count} voce escono da questo viaggio. I modelli salvati restano intatti.',
    many: 'La lista e le sue {count} voci escono da questo viaggio. I modelli salvati restano intatti.',
    other:
      'La lista e le sue {count} voci escono da questo viaggio. I modelli salvati restano intatti.',
  },

  'lists.item.dialog.body':
    'Tutto tranne il nome è facoltativo — un peso rende reale il totale della valigia, e una categoria raggruppa la lista.',
  'lists.template.dialogBody':
    'Un modello è una lista che hai già salvato. Applicarlo la copia come nuova lista in questo viaggio — l’originale resta com’è.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Rimuovere «{name}»?',
  actionsFor: 'Azioni per {name}',
  'lists.dnd.reorder': 'Riordina {name}',
  'lists.action.untickItem': 'Dispunta {name}',
  'lists.action.tickOffItem': 'Spunta {name}',
  'lists.item.assignAria': 'Assegna {name} a qualcuno',
  'lists.item.reassignAria': '{item} è di {owner} — riassegna',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Dai a questa prenotazione un nome che riconoscerai in un elenco.',
  'error.titleLong': 'Tieni il nome sotto i 160 caratteri.',
  'book.error.required': 'A questa prenotazione manca: {field}.',
  'book.error.timeNeedsDate': 'Un’ora ha bisogno del giorno in cui cade.',
  'book.error.endTimeNeedsDate':
    'Un’ora di fine ha bisogno del giorno in cui cade.',
  'book.error.endsBeforeStart': 'Questo finisce prima di iniziare.',
  'book.fieldName.checkInDay': 'giorno di check-in',
  'book.fieldName.checkOutDay': 'giorno di check-out',
  'book.stay.pickDay': 'Scegli un giorno',
  'book.stay.nights': {
    one: '{count} notte',
    many: '{count} notti',
    other: '{count} notti',
  },
  'book.stay.range': 'da {from} a {to}',
  'book.stay.label': 'Soggiorno',
  'book.remove.keepsNights':
    'Le notti restano nel viaggio. Viene rimossa solo la prenotazione.',
  'book.menu.removeWithStay': 'Rimuovi prenotazione e soggiorno',
  'book.removeStay.body':
    'Vengono rimosse sia la prenotazione sia le notti che paga.',
  'book.toast.stayRemoved': 'Prenotazione e soggiorno rimossi',
  'book.error.endTimeBeforeStart': 'L’ora di fine è prima dell’ora di inizio.',
  'book.error.guests':
    'Il numero di persone deve essere un intero fino a 1000.',
  'error.price': 'Questo importo non riusciamo a leggerlo.',
  'book.error.url': 'Un collegamento deve iniziare con http:// o https://.',
  'book.error.confirmationLong':
    'Questo numero di conferma è troppo lungo da salvare.',
  'book.error.stopGone': 'Quella fermata non fa più parte di questo viaggio.',
  'book.ledger.unlinked':
    'La voce di costo di questa prenotazione resterà nei costi del viaggio, ma non sarà più collegata alla prenotazione.',
  'book.ledger.updated':
    'La voce di costo di questa prenotazione diventerà {money}.',
  'book.ledger.needsDate':
    'Dai una data a questa prenotazione e il suo costo finirà nei costi del viaggio.',
  'book.ledger.added':
    'Ai costi di questo viaggio verrà aggiunta una voce da {money}.',
  'book.fieldName.provider': 'operatore',
  'book.fieldName.location': 'luogo',
  'book.fieldName.confirmationNumber': 'numero di conferma',
  'book.fieldName.link': 'collegamento',
  'book.fieldName.date': 'data',
  'book.fieldName.time': 'ora',
  'book.fieldName.endDate': 'data di fine',
  'book.fieldName.endTime': 'ora di fine',
  'book.fieldName.guests': 'numero di persone',
  'book.fieldName.price': 'prezzo',
  'book.fieldName.stop': 'fermata',
  'book.field.stop': 'Fermata collegata',
  'book.field.stopHint':
    'A quale fermata del piano si riferisce questa prenotazione.',
  'book.field.stopHintEmpty':
    'Aggiungi prima un luogo a un giorno, poi potrai collegarci questa prenotazione',
  'book.field.stopPlaceholder': 'Non legata a una fermata',
  'book.field.stopSearch': 'Cerca fra fermate e giorni',
  'book.field.stopEmpty': 'Nessuna fermata corrisponde',
  'book.ledger.refused.title': 'Salvato, ma non aggiunto ai costi',
  'book.ledger.refused.body':
    'La prenotazione è sul viaggio. Aggiungere la sua voce ai costi del viaggio non è andata a buon fine — riprova quella metà.',
  'book.action.ledgerRetry': 'Aggiungilo ai costi',
  'book.ledger.splitStale.title': 'Salvato, ma la divisione non torna più',
  'book.ledger.splitStale.body':
    'La prenotazione e il suo nuovo prezzo sono salvati, ma la divisione di questa voce di costo non ha potuto seguire il nuovo totale. Apri la voce in Costi e correggi la divisione.',
  'book.action.done': 'Fatto',
  'book.copyConfirmation': 'il numero di conferma di {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Volo',
  'transports.mode.train': 'Treno',
  'transports.mode.bus': 'Autobus',
  'transports.mode.ferry': 'Traghetto',
  'transports.mode.car': 'Auto',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Mezzi',
  'transports.mode.metro': 'Metro',
  'transports.mode.tram': 'Tram',
  'transports.mode.bike': 'Bici',
  'transports.mode.walk': 'A piedi',
  'transports.mode.other': 'Altro',
  'transports.mode.fallback': 'Spostamento',
  'transports.rank.earliest': 'Arrivo più presto',
  'transports.rank.fewestChanges': 'Meno cambi',
  'transports.connection.findStop': 'Trova una fermata',
  'transports.connection.findStopSearch': 'FCO, Termini, Roma…',
  'transports.connection.findStopEmpty':
    'Nessuna fermata con quel nome nel catalogo.',
  'transports.connection.hideStops': 'Nascondi le fermate',
  'transports.connection.seeStops': 'Vedi le fermate',
  'transports.connection.saving': 'Salvataggio della connessione',
  'transports.connection.use': 'Prendi questa',
  'transports.connection.onFoot': 'A piedi',
  'transports.connection.service': 'Servizio',
  'transports.connection.direct': 'diretto',
  'transports.connection.changes': {
    one: '{changes} cambio',
    many: '{changes} cambi',
    other: '{changes} cambi',
  },
  'transports.connection.tooLong':
    'Questa connessione ha più di {max} tratte, più di quante ne tenga un singolo record di viaggio. Cerca un salto più corto e annota il resto a parte.',
  'transports.connection.refusal.ceiling':
    'Nessuna ricerca rimasta questo mese',
  'transports.connection.refusal.unconfigured':
    'La ricerca di connessioni è spenta su questo deployment',
  'transports.connection.refusal.provider': 'Il servizio orari non ha risposto',
  'transports.connection.refusal.plan':
    'La ricerca di connessioni non fa parte di questo piano',
  'transports.connection.refusal.planBody':
    'Passa a un altro piano per cercare gli orari da dentro un viaggio. Uno spostamento si può sempre annotare a mano.',
  'transports.connection.refusal.ceilingBody':
    'Il monte mensile di {ceiling} è esaurito e si rinnova il primo del mese prossimo. Uno spostamento si può sempre annotare a mano.',
  'transports.connection.refusal.unconfiguredBody':
    'Qui non è configurato nessun servizio orari, quindi non è stato cercato niente. Annota lo spostamento a mano.',
  'transports.connection.refusal.providerBody':
    'Non è tornato niente da mostrare. Riprova tra poco, oppure annota lo spostamento a mano.',
  'transports.connection.invitation':
    'Due fermate e una data, e l’orario risponde. Niente viene salvato finché non ne scegli una.',
  'transports.connection.empty':
    'Nessuna connessione trovata fra quelle due fermate in quella data. Prova una stazione vicina, o allarga il filtro dei modi.',
  'transports.connection.credit': 'Dati sugli orari forniti da',
  'transports.connection.searchFailed': 'La ricerca non è partita',
  'transports.connection.searchFailedBody': 'Riprova fra un momento.',
  'transports.connection.saved': 'Connessione salvata',
  'transports.connection.replaced': 'Percorso sostituito',
  'transports.connection.replacedBody':
    'Il codice di prenotazione e il posto restano intatti.',
  'transports.connection.saveFailed': 'La connessione non è stata salvata',
  'transports.connection.saveError': 'Non è stato salvato',
  'transports.connection.fromHint':
    'Scegli una fermata — a un orario si chiede dove, non come si chiama.',
  'transports.connection.toHint': 'Scegli una fermata dal catalogo.',
  'transports.connection.timeHint':
    'Un orario risponde con le prossime partenze, quindi questo decide quali.',
  'transports.connection.onlyModes': 'Solo questi modi',
  'transports.connection.searching': 'Cerco negli orari',
  'transports.connection.search': 'Cerca connessioni',
  'transports.connection.title': 'Da {from} a {to}',
  'transports.status.idea': 'Idea',
  'transports.status.pending': 'In attesa',
  'transports.status.confirmed': 'Confermata',
  'transports.status.completed': 'Fatta',
  'transports.status.cancelled': 'Annullata',
  'transports.end.fromAirport': 'Aeroporto di partenza',
  'transports.end.toAirport': 'Aeroporto di arrivo',
  'transports.end.fromPort': 'Porto di partenza',
  'transports.end.toPort': 'Porto di arrivo',
  'transports.end.fromStation': 'Stazione di partenza',
  'transports.end.toStation': 'Stazione di arrivo',
  'transports.end.from': 'Da',
  'transports.end.to': 'A',
  'transports.end.pickUp': 'Ritiro',
  'transports.end.dropOff': 'Riconsegna',
  'transports.end.departureDay': 'Giorno di partenza',
  'transports.end.arrivalDay': 'Giorno di arrivo',
  'transports.end.pickUpDay': 'Giorno di ritiro',
  'transports.end.returnDay': 'Giorno di riconsegna',
  'transports.dayNumber': 'Giorno {n}',
  'transports.error.titleEmpty':
    'Dai a questo spostamento un nome che riconoscerai in un elenco.',
  'transports.error.date': 'Una data si scrive AAAA-MM-GG.',
  'transports.error.time': 'Un’ora si scrive HH:MM su 24 ore.',
  'transports.error.departureNeedsDate':
    'Un’ora di partenza ha bisogno del giorno in cui cade.',
  'transports.error.arrivalNeedsDate':
    'Un’ora di arrivo ha bisogno del giorno in cui cade.',
  'transports.error.code': 'Un codice ha da 2 a 8 lettere o cifre.',
  'transports.error.distance':
    'Una distanza è un numero di chilometri, fino a 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Questo spostamento arriva prima di partire.',
  'transports.error.timingHint':
    'Sposta uno dei due orari, così lo spostamento si può davvero prendere.',
  'transports.error.arrivalDayBeforeDeparture':
    'Il giorno di arrivo precede il giorno di partenza.',
  'transports.error.returnDayBeforePickUp':
    'Il giorno di riconsegna precede il giorno di ritiro.',
  'transports.field.noDay': 'Ancora nessun giorno',
  'transports.fill.legend': 'Come compilare questo',
  'transports.fill.manual': 'Inseriscilo tu',
  'transports.fill.searchAgain': 'Cerca di nuovo',
  'transports.fill.search': 'Cerca coincidenze',
  'transports.chain.unsplit': 'Rimettilo come un unico viaggio',
  'transports.field.arrivalDayHint':
    'Un viaggio che arriva la mattina dopo lo dice qui.',
  'transports.chain.splitHint':
    'Cambio lungo il percorso? Registra ogni parte con il suo numero di servizio, binario, posto e orari.',
  'transports.chain.split': 'Dividi in tratte',
  'transports.chain.stopNumber': 'fermata {n}',
  'transports.chain.change': 'Cambio {n}',
  'transports.chain.removeStation': 'Rimuovi {label}',
  'transports.chain.findStation': 'Trova un aeroporto o una stazione',
  'transports.chain.findStationFor':
    'Trova un aeroporto o una stazione per {label}',
  'transports.chain.findPlaceholder': 'FCO, Fiumicino, Roma…',
  'transports.chain.findEmpty':
    'Nessuna corrispondenza — scrivi tu la fermata qui sotto.',
  'transports.chain.stopLabel': 'Fermata',
  'transports.chain.stopPlaceholder': 'Roma Termini',
  'transports.chain.timezoneHint': 'Su quale orologio va questa fermata',
  'transports.chain.timezoneAt': 'Fuso orario a {label}',
  'transports.chain.timezonePlaceholder': 'Non indicato',
  'transports.chain.timezoneSearch': 'Tokyo, Lisbona, UTC…',
  'transports.chain.acrossClocks': '{gap} fra due orologi',
  'transports.chain.addStopAfter': 'Aggiungi una fermata dopo {label}',
  'transports.chain.servicePlaceholder': 'FR 9512',
  'transports.chain.leaves': 'Parte da {label}',
  'transports.chain.reaches': 'Arriva a {label}',
  'transports.chain.dayOfLeg': '{label} della tratta {n}',
  'transports.chain.formError': 'Questa catena non si può salvare',
  'transports.chain.atCap':
    'Una catena tiene al massimo {max} tratte — è un limite di quel che un salvataggio porta, non di quanti cambi può avere un viaggio.',
  'transports.chain.hint':
    'Aggiungi una fermata su qualsiasi tratta per registrare un cambio di treno; ogni tratta tiene il suo numero, binario e posto.',
  'transports.field.timezone': 'Fuso orario',
  'transports.field.platform': 'Binario',
  'transports.chain.legNumber': 'Tratta {n}',
  'transports.chain.platform': 'Binario {value}',
  'transports.chain.seat': 'Posto {value}',
  'transports.chain.error.stopName':
    'Ogni fermata ha bisogno di un nome — è qui che cambi.',
  'transports.chain.error.stopNameLong':
    'Il nome di una fermata deve restare sotto i 200 caratteri.',
  'transports.chain.error.timezone': 'Scegli un fuso orario dall’elenco.',
  'transports.chain.error.tooManyLegs':
    'Una catena contiene al massimo {max} tratte.',
  'transports.bookingRefFor': 'il codice di prenotazione di {title}',
  'transports.doorToDoor': 'Sono {gap} porta a porta.',
  'transports.title.fromTo': '{operator} da {from} a {to}',
  'transports.title.from': '{operator} da {from}',
  'transports.title.to': '{operator} per {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Nessun orario da confrontare',
  'transports.junction.unknown.detail':
    'Metti data e ora su entrambi gli spostamenti e questo cambio verrà controllato per te.',
  'transports.junction.impossible.headline':
    'Parte {gap} prima che arrivi lo spostamento precedente',
  'transports.junction.impossible.detail':
    '«{to}» parte prima che arrivi «{from}», quindi non si possono prendere entrambe. Spostane una.',
  'transports.junction.tight.headline': '{gap} per il cambio',
  'transports.junction.tight.detail':
    'Per {mode} di solito serve circa {required}. Qui è stretto.',
  'transports.junction.tight.detailAt':
    'Per {mode} a {place} di solito serve circa {required}. Qui è stretto.',
  'transports.junction.ok.headline': '{gap} di margine',
  'transports.junction.ok.detail':
    'Arriva a {landing} ma lo spostamento successivo parte da {boarding} — bisognerà raggiungerlo.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Nota condivisa',
  'collab.note.toast.sharedBody': 'Tutti quelli in viaggio ora la vedono.',
  'collab.note.toast.shareFailed': 'La nota non è stata condivisa',
  'collab.note.toast.updated': 'Nota aggiornata',
  'collab.note.toast.updateFailed': 'La nota non è stata aggiornata',
  'collab.note.dialog.editTitle': 'Modifica questa nota',
  'collab.note.dialog.addTitle': 'Nuova nota condivisa',
  'collab.note.dialog.body':
    'Ristoranti consigliati, regole sui visti, il codice del portone: tutto quello che il viaggio intero deve ricordare, in un posto solo.',
  'collab.note.field.title': 'Titolo',
  'collab.note.field.titlePlaceholder': 'Codice del portone',
  'collab.note.field.body': 'Nota',
  'collab.note.field.bodyPlaceholder':
    '4821, poi il cancelletto. La cassetta delle chiavi è a sinistra della porta.',
  'collab.note.field.categoryHint':
    'Raggruppa la bacheca sotto un filtro. Facoltativo.',
  'collab.note.field.categoryPlaceholder': 'Logistica',
  'collab.note.field.pin': 'Fissa in cima alla bacheca',
  'collab.note.field.pinHint':
    'Le note fissate stanno davanti, qualunque cosa si aggiunga.',
  'collab.note.action.saving': 'Salvataggio della nota',
  'collab.note.action.save': 'Salva la nota',
  'collab.note.action.share': 'Condividi la nota',
  'collab.poll.toast.opened': 'Sondaggio aperto',
  'collab.poll.toast.openedBody': 'Tutti quelli in viaggio possono votare.',
  'collab.poll.toast.openFailed': 'Il sondaggio non è stato aperto',
  'collab.poll.dialog.addTitle': 'Nuovo sondaggio',
  'collab.poll.field.question': 'Domanda',
  'collab.poll.field.questionPlaceholder': 'Dove mangiamo l’ultima sera?',
  'collab.poll.field.optionsLegend': 'Scelte',
  'collab.poll.field.option': 'Risposta {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Un’altra risposta',
  'collab.poll.action.addOption': 'Aggiungi una risposta',
  'collab.poll.action.removeOption': 'Rimuovi la risposta {n}',
  'collab.poll.field.multi': 'Permetti di scegliere più di una',
  'collab.poll.field.multiHint':
    'Spento vuol dire un voto a testa, e cambiare idea lo sposta.',
  'collab.poll.action.opening': 'Apertura del sondaggio',
  'collab.poll.action.open': 'Apri il sondaggio',
  'collab.poll.error.tooFew':
    'Un sondaggio ha bisogno di almeno due cose fra cui scegliere.',
  'collab.poll.error.duplicate':
    'Due risposte dicono la stessa cosa. Dai a ognuna la sua formulazione.',
  'collab.presence.viewingNow': 'stanno guardando ora',
  'collab.presence.unnamed': 'Membro senza nome',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} scheda aperta',
    many: '{name} — {count} schede aperte',
    other: '{name} — {count} schede aperte',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'D’accordo',
  'collab.reaction.love': 'Mi piace',
  'collab.reaction.funny': 'Divertente',
  'collab.reaction.celebrate': 'Si festeggia',
  'collab.reaction.thanks': 'Grazie',
  'collab.reaction.looking': 'Sto guardando',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, te compreso',
  'collab.thread.today': 'Oggi',
  'collab.thread.empty': 'Ancora nessun messaggio',
  'collab.toast.reactionFailed': 'La reazione non è stata salvata',
  'collab.toast.messageDeleted': 'Messaggio eliminato',
  'collab.toast.deleteFailed': 'Il messaggio non è stato eliminato',
  'collab.toast.notSent': 'Non inviato',
  'collab.toast.notSentBody':
    'Il messaggio non è stato inviato. Riprova fra un momento.',
  'collab.toast.messageUpdated': 'Messaggio aggiornato',
  'collab.toast.editFailed': 'La modifica non è stata salvata',
  'collab.message.deleteTitle': 'Eliminare questo messaggio?',
  'collab.message.deleteBody':
    'Il testo sparisce dal filo. Le risposte restano al loro posto.',
  'collab.message.delete': 'Elimina il messaggio',
  'collab.message.reply': 'Rispondi',
  'collab.message.menuEdit': 'Modifica il messaggio…',
  'collab.message.react': 'Reagisci a questo messaggio',
  'collab.message.edited': 'modificato',
  'collab.message.actionsFor': 'Azioni per il messaggio di {name}',
  'collab.compose.editingYours': 'Stai modificando il tuo messaggio',
  'collab.compose.replyingTo': 'Risposta a {name}',
  'collab.compose.cancelReply': 'Annulla la risposta',
  'collab.compose.cancelEdit': 'Annulla la modifica',
  'collab.compose.placeholder': 'Scrivi al viaggio',
  'collab.compose.placeholderText': 'Scrivi qualcosa al gruppo…',
  'collab.compose.editPlaceholder': 'Modifica il tuo messaggio',
  'collab.compose.editPlaceholderText': 'Cambia quello che hai detto…',
  'collab.compose.send': 'Invia il messaggio',
  'collab.compose.savingEdit': 'Salvataggio della modifica',
  'collab.compose.save': 'Salva',
  'collab.hint.sends': 'invia',
  'collab.hint.addsLine': 'va a capo',
  'collab.hint.cancels': 'annulla',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Nota rimossa',
  'collab.toast.noteRemoveFailed': 'La nota non è stata rimossa',
  'collab.notes.empty.title': 'Nessuna nota condivisa',
  'collab.notes.empty.body':
    'Ristoranti consigliati, regole sui visti, il codice del portone: tutto quello che il viaggio intero deve ricordare.',
  'collab.notes.empty.action': 'Scrivi la prima nota',
  'collab.note.menu.edit': 'Modifica la nota…',
  'collab.note.menu.unpin': 'Sblocca',
  'collab.note.menu.pin': 'Fissa in cima',
  'collab.note.remove': 'Rimuovi la nota',
  'collab.note.removeBody':
    'La nota sparisce dalla bacheca per tutti quelli in viaggio.',
  'collab.note.new': 'Nuova nota',
  'collab.poll.toast.voteFailed': 'Il tuo voto non è stato salvato',
  'collab.poll.toast.voteFailedBody': 'Il conteggio resta invariato.',
  'collab.poll.toast.closed': 'Sondaggio chiuso',
  'collab.poll.toast.closeFailed': 'Il sondaggio non è stato chiuso',
  'collab.poll.toast.removed': 'Sondaggio rimosso',
  'collab.poll.toast.removeFailed': 'Il sondaggio non è stato rimosso',
  'collab.polls.heading': 'Sondaggi',
  'collab.polls.empty.title': 'Nessun sondaggio aperto',
  'collab.polls.empty.body':
    "Quando il gruppo non riesce a mettersi d'accordo su un ristorante, mettetelo ai voti e lasciate che la risposta si decida da sé.",
  'collab.polls.empty.action': 'Chiedi al gruppo',
  'collab.poll.menu.close': 'Chiudi il sondaggio',
  'collab.poll.remove': 'Rimuovi il sondaggio',
  'collab.poll.removeTitle': 'Rimuovere questo sondaggio?',
  'collab.poll.actionsFor': 'Azioni per il sondaggio «{question}»',
  'collab.badge.pinned': 'Fissata',
  'collab.badge.closed': 'Chiuso',
  'collab.badge.open': 'Aperto',
  'collab.badge.multi': 'Scelta multipla',
  'collab.badge.leading': 'In testa',
  'collab.poll.removeBody': {
    one: '«{question}» e il suo {count} voto spariscono per tutti.',
    many: '«{question}» e i suoi {count} voti spariscono per tutti.',
    other: '«{question}» e i suoi {count} voti spariscono per tutti.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} su {count} voto',
    many: '{label} — {votes} su {count} voti',
    other: '{label} — {votes} su {count} voti',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} su {count} voto, il tuo compreso',
    many: '{label} — {votes} su {count} voti, il tuo compreso',
    other: '{label} — {votes} su {count} voti, il tuo compreso',
  },
  'collab.poll.voteCount': {
    one: '{count} voto',
    many: '{count} voti',
    other: '{count} voti',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Documento',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Biglietto',
  'files.kind.receipt': 'Ricevuta',
  'files.kind.map': 'Mappa',
  'files.kind.other': 'Altro',
  'files.kindChoice.ticket': 'Biglietto o pass',
  'files.kindChoice.map': 'Mappa o percorso',
  'files.toast.removed': 'File rimosso',
  'files.toast.removeFailed': 'Il file non è stato rimosso',
  'files.toast.downloadFailed': 'Il download non è partito',
  'files.toast.gone': 'Il file non è più disponibile in questa scheda.',
  'files.toast.uploadFailed': 'Il caricamento è fallito. Riprova.',
  'files.toast.updated': 'File aggiornato',
  'files.toast.updateFailed': 'Il file non è stato aggiornato',
  'files.storage.full': 'Questo spazio di lavoro ha esaurito l’archiviazione',
  'files.storage.used':
    'Usati {used} su {limit}. Rimuovi un file qui sotto, o passa a un piano superiore, prima di aggiungere altro.',
  'files.storage.perFile': 'fino a {size} ciascuno',
  'files.action.add': 'Aggiungi file',
  'files.action.choose': 'Scegli i file',
  'files.action.upload': 'Carica i file',
  'files.drop.active': 'Rilascia per caricare',
  'files.drop.pasteHint': 'incolla un’immagine copiata o uno screenshot',
  'files.reject.blockedType':
    '«{name}» non è stato aggiunto: qui i file XML e SVG compressi non vengono conservati, per sicurezza. Salvalo come PDF o come immagine e aggiungi quello al suo posto.',
  'files.drop.idle': 'Trascina i file qui',
  'files.empty.title': 'Nessun file in questo viaggio',
  'files.empty.body':
    'Tutto quello che altrimenti dovresti pescare da una casella di posta al banco del check-in sta qui, attaccato al viaggio a cui serve.',
  'files.empty.hint':
    'Carte d’imbarco, conferme d’albergo, biglietti, documenti dell’assicurazione e le ricevute che sostengono le tue spese.',
  'files.heading': 'Allegati',
  'files.tableCaption': 'File allegati a questo viaggio',
  'files.menu.download': 'Scarica',
  'files.menu.rename': 'Rinomina e descrivi…',
  'files.menu.remove': 'Rimuovi il file',
  'files.remove.body':
    'Il file viene cancellato dall’archiviazione oltre che dal viaggio, e si liberano {size}. Non si può annullare.',
  'files.queue.clear': 'Pulisci i completati',
  'files.column.file': 'File',
  'files.column.size': 'Dimensione',
  'files.column.addedBy': 'Aggiunto da',
  'files.column.when': 'Quando',
  'files.status.uploaded': 'Caricato',
  'files.status.failed': 'Fallito',
  'files.status.cancelled': 'Annullato',
  'files.status.uploading': 'In caricamento',
  'files.status.waiting': 'In attesa',
  'files.error.nameEmpty': 'Un file ha bisogno di un nome con cui ritrovarlo.',
  'files.field.kindHint':
    'Decide sotto quale filtro sta e quale simbolo riceve.',
  'files.field.kindAria': 'Tipo di file',
  'files.field.description': 'Descrizione',
  'files.field.descriptionPlaceholder':
    'Polizza assicurativa — copre tutto il gruppo, numero sinistri a pagina 2.',
  'files.dialog.title': 'Dettagli del file',
  'files.action.saving': 'Salvataggio del file',
  'files.action.save': 'Salva i dettagli',
  'files.queue.someFailed': {
    one: '{count} file non è stato caricato. Il motivo è su ogni riga — nient’altro del gruppo è stato toccato.',
    many: '{count} file non sono stati caricati. Il motivo è su ogni riga — nient’altro del gruppo è stato toccato.',
    other:
      '{count} file non sono stati caricati. Il motivo è su ogni riga — nient’altro del gruppo è stato toccato.',
  },

  'files.action.cancelUploadOf': 'Annulla il caricamento di {name}',
  'files.action.dismissOf': 'Ignora {name}',
  'files.status.downloadingOf': 'Download di {name}',
  'files.status.uploadingOf': 'Caricamento di {name}',
  'files.status.uploadingCount': {
    one: 'Caricamento di {count} file',
    many: 'Caricamento di {count} file',
    other: 'Caricamento di {count} file',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - generato il {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': 'Pronto: {title}',
  'files.export.email.body': {
    one: 'L’esportazione del viaggio è pronta. Viene conservata per {count} giorno.',
    many: 'L’esportazione del viaggio è pronta. Viene conservata per {count} giorni.',
    other:
      'L’esportazione del viaggio è pronta. Viene conservata per {count} giorni.',
  },
  'files.export.email.action': 'Apri {title}',
  'files.export.email.text': 'L’esportazione del viaggio è pronta: {url}',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Caricamento annullato.',
  'files.error.badAnswer':
    'Il server ha mandato una risposta che questo browser non ha saputo leggere.',
  'files.error.connection':
    'La connessione è caduta durante il caricamento. Controlla la rete e riprova.',
  'files.error.timeout': 'Il caricamento è scaduto. Riprova.',
  'files.error.refused': 'Il server ha rifiutato il caricamento ({status}).',
  'files.error.downloadShape':
    'Il download è tornato in una forma che non potevamo salvare.',
  'files.error.downloadFailed': 'Il download è fallito ({status}).',
  'files.toast.uploadedOne': 'File caricato',
  'files.toast.uploadedManyBody': '{size} aggiunti a questo viaggio.',
  'files.toast.failedOne': 'Quel file non è stato caricato',
  'files.toast.failedManyBody': 'La coda qui sotto dice il perché di ciascuno.',
  'files.error.tooMany': {
    one: 'Si può aggiungere solo {count} file alla volta, quindi «{name}» è rimasto fuori. Rimettilo da solo.',
    many: 'Si possono aggiungere solo {count} file alla volta, quindi «{name}» è rimasto fuori. Rimettilo da solo.',
    other:
      'Si possono aggiungere solo {count} file alla volta, quindi «{name}» è rimasto fuori. Rimettilo da solo.',
  },
  'files.toast.uploadedMany': {
    one: '{count} file caricato',
    many: '{count} file caricati',
    other: '{count} file caricati',
  },
  'files.toast.failedMany': {
    one: '{count} file non è stato caricato',
    many: '{count} file non sono stati caricati',
    other: '{count} file non sono stati caricati',
  },
} satisfies TranslationOf<typeof En>

export default messages
