/**
 * Everything the application shell says, in Italian.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tu» throughout, matching `./ui.ts` and `./settings.ts`.
 *
 * **Plural.** `Intl.PluralRules('it')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Feature names are translated, not borrowed.** «Atlas», «Vacay» and
 * «Journey» would be English words in an Italian nav, so each one says what its
 * screen is: la mappa del mondo, le vacanze, il diario. «File» stays, because
 * that is the Italian word for a file and not an untranslated one.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Sezioni principali',
  'nav.mobile': 'Sezioni',
  'nav.dashboardLink': 'Pannello di planned.travel',
  'nav.homeLink': 'Pagina iniziale di planned.travel',
  'nav.newTrip': 'Nuovo viaggio',

  'nav.trips': 'I miei viaggi',
  'nav.trips.short': 'Viaggi',
  'nav.vacay': 'Vacanze',
  'nav.vacay.short': 'Vacanze',
  'nav.atlas': 'Mappa del mondo',
  'nav.atlas.short': 'Mappa',
  'nav.journey': 'Diario',
  'nav.journey.short': 'Diario',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Sezioni del viaggio',
  'trip.nav.back': 'Viaggi',
  'trip.nav.share': 'Condividi',
  'trip.nav.shareLabel': 'Condividi questo viaggio',
  'trip.tab.plan': 'Programma',
  'trip.tab.transports': 'Spostamenti',
  'trip.tab.book': 'Prenotazioni',
  'trip.tab.lists': 'Liste',
  'trip.tab.costs': 'Spese',
  'trip.tab.files': 'File',
  'trip.tab.collab': 'Gruppo',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menu dell’account',
  'account.settings': 'Impostazioni',
  'account.billing': 'Piano e fatturazione',
  'account.admin': 'Amministrazione',
  'account.signOut': 'Esci',
  'account.signingOut': 'Uscita in corso…',
  'account.signOutFailed': 'Non è stato possibile uscire',
  'account.signOutFailedBody': 'Controlla la connessione e riprova.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Aspetto',
  'theme.light': 'Chiaro',
  'theme.dark': 'Scuro',
  'theme.system': 'Come il sistema',
  'theme.state.light': 'chiaro',
  'theme.state.dark': 'scuro',
  'theme.state.system': 'come il sistema',
  'theme.trigger': 'Tema: {state}. Cambia tema',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notifiche, nessuna da leggere',
  'bell.unread': {
    one: 'Notifiche, {unread} da leggere',
    many: 'Notifiche, {unread} da leggere',
    other: 'Notifiche, {unread} da leggere',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Posta in arrivo',
  'inbox.title': 'Notifiche',
  'inbox.error': 'La posta in arrivo non si è caricata',
  'inbox.allRead': 'È tutto letto',
  'inbox.unread': {
    one: '{unread} messaggio da leggere',
    many: '{unread} messaggi da leggere',
    other: '{unread} messaggi da leggere',
  },
  'inbox.markAll': 'Segna tutto come letto',
  'inbox.markingAll': 'Sto segnando tutto come letto',
  'inbox.cleared': 'Posta in arrivo in pari',
  'inbox.markAllFailed': 'Non è stato possibile segnare tutto come letto',
  'inbox.retryHint': 'Controlla la connessione e riprova.',
  'inbox.filter.all': 'Tutto',
  'inbox.filter.unread': 'Da leggere',
  'inbox.waiting': {
    one: '{invitations} invito in attesa',
    many: '{invitations} inviti in attesa',
    other: '{invitations} inviti in attesa',
  },
  'inbox.empty.title': 'La posta in arrivo è vuota',
  'inbox.empty.body':
    'Qui arrivano gli inviti ai viaggi, le modifiche al programma, i promemoria delle prenotazioni e i conti saldati.',
  'inbox.empty.action': 'Torna al pannello',
  'inbox.emptyUnread.title': 'Niente da leggere',
  'inbox.emptyUnread.body':
    'Hai letto tutto. Passa a Tutto per rivedere lo storico.',
  'inbox.emptyUnread.action': 'Mostra tutto',
  'inbox.row.new': 'Nuovo',
  'inbox.row.accepted': 'Accettato',
  'inbox.row.declined': 'Rifiutato',
  'inbox.row.open': 'Apri',
  'inbox.row.markRead': 'Letta',
  'inbox.row.markingRead': 'Sto segnando come letta',
  'inbox.row.markReadFailed': 'Non è stato possibile segnarla come letta',
  'inbox.preferences':
    'Scegli quali di queste arrivano nella posta, nella tua email e sul telefono.',
  'inbox.preferencesAction': 'Impostazioni delle notifiche',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Ti hanno invitato a {tripTitle}',
  'notification.trip.invited.body': '{actorName} ti ha aggiunto al viaggio.',
  'notification.trip.updated.title': '{tripTitle} è cambiato',
  'notification.trip.updated.body': '{actorName} ha modificato il programma.',
  'notification.trip.member_added.title':
    '{memberName} si è unito a {tripTitle}',
  'notification.trip.member_added.body':
    'Ora vede l’itinerario, le prenotazioni e le spese.',
  'notification.trip.member_removed.title':
    '{memberName} ha lasciato {tripTitle}',
  'notification.trip.member_removed.body':
    'Il suo accesso al viaggio è finito.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} inizia tra {days} giorno',
    many: '{tripTitle} inizia tra {days} giorni',
    other: '{tripTitle} inizia tra {days} giorni',
  },
  'notification.trip.starting_soon.body':
    'È il momento di rivedere la lista dei bagagli e le prenotazioni.',
  'notification.trip.copied.title': '{tripTitle} è pronto',
  'notification.trip.copied.body': {
    one: 'Copiato {days} giorno',
    many: 'Copiati {days} giorni',
    other: 'Copiati {days} giorni',
  },
  'notification.trip.copied.places': {
    one: '{places} luogo',
    many: '{places} luoghi',
    other: '{places} luoghi',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} nota scartata',
    many: '{dropped} note scartate',
    other: '{dropped} note scartate',
  },
  'notification.trip.copyFailed.title':
    'Non è stato possibile copiare {tripTitle}',
  'notification.trip.copyFailed.body':
    'Non è andato perso nulla. Riprova dall’originale.',
  'notification.reservation.reminder.title': 'Manca poco a {title}',
  'notification.reservation.reminder.body':
    'Controlla l’orario e il codice di conferma sulla prenotazione.',
  'notification.reservation.confirmed.title': '{title} è confermata',
  'notification.reservation.confirmed.body':
    'La prenotazione risulta confermata su {tripTitle}.',
  'notification.expense.added.title': '{actorName} ha aggiunto una spesa',
  'notification.expense.added.body': '{title}, su {tripTitle}.',
  'notification.expense.settled.title': '{actorName} ha saldato il conto',
  'notification.expense.settled.body': 'Il saldo di {tripTitle} è pagato.',
  'notification.list.assigned.title': '{actorName} ti ha assegnato una voce',
  'notification.list.assigned.body': '{title}, su {tripTitle}.',
  'notification.collab.message.title': '{actorName} ha scritto in {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'C’è un sondaggio aperto su {tripTitle}',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'Ti hanno invitato in {organizationName}',
  'notification.organization.invited.body':
    'Accetta per entrare nello spazio di lavoro e in tutto ciò che vi è condiviso.',
  'notification.journey.published.title': '{title} è stato pubblicato',
  'notification.journey.published.body':
    'Ora chiunque abbia il link può leggere il diario.',
  'notification.billing.plan_changed.title': 'Il tuo piano è cambiato',
  'notification.billing.plan_changed.body':
    '{organizationName} ora è sul piano {plan}.',
  'notification.billing.invoice_paid.title': 'Pagamento ricevuto',
  'notification.billing.invoice_paid.body':
    'L’ultima fattura di {organizationName} è stata pagata.',
  'notification.billing.payment_failed.title':
    'Un pagamento non è andato a buon fine',
  'notification.billing.payment_failed.body':
    '{organizationName} ha un pagamento in ritardo. Aggiorna il metodo di pagamento per mantenere il piano.',
  'notification.fallback.title': 'Qualcosa è cambiato nel tuo spazio di lavoro',
  'notification.fallback.body': 'Apri il viaggio per vedere che cosa.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Il pannello non si è caricato',
  'dashboard.blank.title': 'Il tuo prossimo viaggio comincia qui',
  'dashboard.blank.body':
    'Crea un viaggio, segna sulla mappa i posti che vuoi vedere e planned.travel costruirà il programma giorno per giorno intorno a loro.',
  'dashboard.blank.action': 'Organizza un viaggio',
  'dashboard.blank.secondary': 'Vedi la tua mappa del mondo',

  'dashboard.upNext': 'Prossima tappa',
  'dashboard.openPlan': 'Apri il programma',
  'dashboard.hero.travellers': 'Viaggiatori',
  'dashboard.hero.datesMissing': 'Aggiungi le date per creare i giorni',
  'dashboard.hero.startsIn': 'Inizia tra',
  'dashboard.hero.started': 'Iniziato da',
  'dashboard.hero.today': 'Oggi',
  'dashboard.hero.startUnknown': 'senza data di partenza',
  'dashboard.hero.startToday': 'buon viaggio',
  /**
   * The label over the numeral already says «da», so the unit under it is only
   * the word for a day — Italian would otherwise read the tile twice.
   */
  'dashboard.hero.startPast': {
    one: 'giorno',
    many: 'giorni',
    other: 'giorni',
  },
  'dashboard.hero.startFuture': {
    one: 'giorno',
    many: 'giorni',
    other: 'giorni',
  },
  'dashboard.hero.nights': 'Notti',
  'dashboard.hero.companionsHint': 'in questo viaggio',
  'dashboard.hero.progress': 'In corso',
  'dashboard.hero.places': 'Luoghi',
  'dashboard.hero.placesNone': 'ancora niente sulla mappa',
  'dashboard.hero.placesHint': 'sulla mappa',

  'dashboard.stat.countries': 'Paesi visitati',
  'dashboard.stat.countriesUnit': 'su {total}',
  'dashboard.stat.countriesNone': 'Segna un paese per aprire la tua mappa',
  'dashboard.stat.visits': {
    one: '{visits} visita registrata',
    many: '{visits} visite registrate',
    other: '{visits} visite registrate',
  },
  'dashboard.stat.trips': 'Viaggi in tutto',
  'dashboard.stat.tripsCaption':
    '{planning} in preparazione · {booked} con prenotazione',
  'dashboard.stat.places': 'Luoghi sulla mappa',
  'dashboard.stat.placesNone': 'Ancora niente sulla mappa',
  'dashboard.stat.placesAcross': {
    one: 'in {trips} viaggio',
    many: 'in {trips} viaggi',
    other: 'in {trips} viaggi',
  },
  'dashboard.stat.bookings': 'Prenotazioni confermate',
  'dashboard.stat.bookingsNone': 'Nessuna prenotazione in arrivo',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} prenotazione in arrivo',
    many: '{bookings} prenotazioni in arrivo',
    other: '{bookings} prenotazioni in arrivo',
  },

  'dashboard.trips.label': 'I tuoi viaggi',
  'dashboard.trips.all': 'Tutti i viaggi',
  'dashboard.trips.empty.title': 'Ancora nessun viaggio',
  'dashboard.trips.empty.body':
    'Tutto quello che organizzi comparirà qui, dal più recente.',
  'dashboard.trips.empty.action': 'Crea un viaggio',

  'dashboard.bookings.label': 'Prenotazioni in arrivo',
  'dashboard.bookings.empty.title': 'Ancora niente di prenotato',
  'dashboard.bookings.empty.body':
    'Soggiorni, tavoli e biglietti confermati compaiono qui mano a mano che si avvicina la data.',

  'dashboard.pipeline.label': 'Viaggi per fase',
  'dashboard.pipeline.empty':
    'Niente in corso. Il tuo primo viaggio riempirà queste fasi.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} preferito',
    many: '{favourites} preferiti',
    other: '{favourites} preferiti',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} viaggio archiviato',
    many: '{archived} viaggi archiviati',
    other: '{archived} viaggi archiviati',
  },

  'dashboard.storage.label': 'Spazio',
  'dashboard.storage.count': '{used} di {limit}',
  'dashboard.storage.files': {
    one: '{files} file su tutti i viaggi, foto e biglietti compresi.',
    many: '{files} file su tutti i viaggi, foto e biglietti compresi.',
    other: '{files} file su tutti i viaggi, foto e biglietti compresi.',
  },
  'dashboard.storage.more': 'Ti serve più spazio?',
  'dashboard.storage.plans': 'Vedi i piani',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Riferimento',
  'dashboard.widgets.choose': 'Scegli i widget',
  'dashboard.widgets.description':
    'I widget che tieni accanto alla tua dashboard.',
  'dashboard.clock.label': 'Orologio mondiale',
  'dashboard.clock.add': 'Aggiungi un fuso orario',
  'dashboard.clock.search': 'Cerca città e regioni',
  'dashboard.clock.noMatches': 'Nessun fuso orario con questo nome',
  'dashboard.clock.remove': 'Rimuovi {zone}',
  'dashboard.clock.offset': '{offset} rispetto alla tua ora',
  'dashboard.clock.here': 'La tua ora',
  'dashboard.clock.empty.title': 'Nessun fuso orario fissato',
  'dashboard.clock.empty.body':
    'Fissa un luogo e leggine l’ora accanto alla tua.',
  'dashboard.clock.unknown.title': 'Questo dispositivo non conosce {zone}',
  'dashboard.clock.unknown.body':
    'Qui non se ne può leggere l’ora. Rimuovi la riga per risolvere.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'La console di amministrazione non si è caricata',
  'admin.denied.title': 'Qui entrano solo gli amministratori dello spazio',
  'admin.denied.body':
    'Se ti serve, chiedi a un proprietario o a un amministratore di questo spazio di cambiare il tuo ruolo.',
  'admin.denied.action': 'Torna al pannello',
  'admin.eyebrow': 'Amministrazione dello spazio',
  'admin.description': 'Piano {plan} · creazione {date}',
  'admin.createdUnknown': 'da poco',
  'admin.workspaceSettings': 'Impostazioni dello spazio',
  'admin.billing': 'Piano e fatturazione',

  'admin.invitations.title': {
    one: '{invitations} invito ancora in sospeso',
    many: '{invitations} inviti ancora in sospeso',
    other: '{invitations} inviti ancora in sospeso',
  },
  'admin.invitations.body':
    'Ogni invito in sospeso occupa uno dei posti che il tuo piano paga.',
  'admin.invitations.action': 'Rivedi gli inviti',

  'admin.stat.members': 'Membri',
  'admin.stat.membersCaption': {
    one: '{invitations} invito in sospeso',
    many: '{invitations} inviti in sospeso',
    other: '{invitations} inviti in sospeso',
  },
  'admin.stat.storage': 'Spazio',
  'admin.stat.storageUnit': 'di {limit}',
  'admin.stat.storageUnlimited': 'senza tetto',
  'admin.stat.storageCaption': 'File, foto ed esportazioni',
  'admin.stat.audit': 'Voci di registro',
  'admin.stat.auditCaption': 'Qui sotto trovi l’attività più recente',
  'admin.stat.plan': 'Piano',
  'admin.stat.planCaption': 'Le quote si applicano al livello dei dati',

  'admin.quotas.label': 'Quote',
  'admin.quotas.count': {
    one: '{metrics} metrica',
    many: '{metrics} metriche',
    other: '{metrics} metriche',
  },
  'admin.quotas.unlimited': 'Illimitato',
  'admin.quotas.value': '{used} su {limit}',

  'admin.members.label': 'Membri',
  'admin.members.table': 'Membri di questo spazio di lavoro',
  'admin.members.person': 'Persona',
  'admin.members.role': 'Ruolo',
  'admin.members.joined': 'Iscrizione',

  'admin.activity.label': 'Attività recente',
  'admin.activity.empty.title': 'Ancora niente di registrato',
  'admin.activity.empty.body':
    'Ogni scrittura che conta viene aggiunta al registro nel momento in cui avviene.',
  'admin.activity.workspace': 'lo spazio di lavoro stesso',
  'admin.actions.label': 'Azioni più frequenti',
  'admin.actions.count': {
    one: '{actions} azione',
    many: '{actions} azioni',
    other: '{actions} azioni',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Bozza',
  'tripStatus.planning': 'In preparazione',
  'tripStatus.booked': 'Prenotato',
  'tripStatus.active': 'In corso',
  'tripStatus.completed': 'Concluso',
  'tripStatus.archived': 'Archiviato',

  'bookingStatus.none': 'Non prenotata',
  'bookingStatus.pending': 'In attesa',
  'bookingStatus.confirmed': 'Confermata',
  'bookingStatus.cancelled': 'Annullata',
  'bookingStatus.completed': 'Conclusa',

  'bookingType.accommodation': 'Alloggio',
  'bookingType.restaurant': 'Tavolo',
  'bookingType.activity': 'Attività',
  'bookingType.tour': 'Escursione',
  'bookingType.ticket': 'Biglietto',
  'bookingType.transport': 'Trasporto',
  'bookingType.other': 'Prenotazione',

  'role.owner': 'Proprietario',
  'role.admin': 'Amministratore',
  'role.member': 'Membro',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} viaggio',
    many: '{value} viaggi',
    other: '{value} viaggi',
  },
  'trips.count.favourites': {
    one: '{value} preferito',
    many: '{value} preferiti',
    other: '{value} preferiti',
  },
  'trips.count.archived': {
    one: '{value} archiviato',
    many: '{value} archiviati',
    other: '{value} archiviati',
  },
  'trips.atLimit.body':
    'Il tuo piano copre {trips}. Archivia uno che hai finito, o passa a un piano superiore per tenerne aperti di più insieme.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nuovo diario',
  'newJourney.title': 'Comincia un diario',
  'newJourney.description':
    'Un diario è il lato scritto di un viaggio: voci in ordine di data, con le foto e il tempo che ricordi.',
  'newJourney.titlePlaceholder': 'Due settimane a Kyoto',
  'newJourney.subtitle': 'Sottotitolo',
  'newJourney.subtitleHint': 'Una riga sotto il titolo, in copertina.',
  'newJourney.subtitlePlaceholder': 'Templi, treni e troppo matcha',
  'newJourney.trip': 'Basato su un viaggio',
  'newJourney.tripHint': 'Facoltativo: lega il racconto al suo piano.',
  'newJourney.tripNone': 'Non legato a un viaggio',
  'newJourney.datesError': 'La data di fine precede l’inizio.',
  'newJourney.submit': 'Crea diario',
  'newJourney.creating': 'Creazione del diario',
  'newJourney.created': 'Diario cominciato',
  'newJourney.createdBody':
    'Aggiungi la prima voce per cominciare il racconto.',
  'newJourney.error':
    'Non è stato possibile creare il diario. Riprova tra un momento.',
  'newCollection.trigger': 'Nuova raccolta',
  'newCollection.title': 'Comincia una raccolta',
  'newCollection.description':
    'Un posto per i luoghi che trovi prima di sapere a quale viaggio appartengono.',
  'newCollection.namePlaceholder': 'Un caffè che vale attraversare la città',
  'newCollection.descriptionHint': 'Cosa ci va dentro e cosa no.',
  'newCollection.submit': 'Crea raccolta',
  'newCollection.creating': 'Creazione della raccolta',
  'newCollection.created': 'Raccolta creata',
  'newCollection.createdBody': 'Comincia a salvarci dei luoghi.',
  'newCollection.error':
    'Non è stato possibile creare la raccolta. Riprova tra un momento.',

  'newTrip.title': 'Comincia un nuovo viaggio',
  'newTrip.description':
    'Basta un titolo. Le date costruiscono il piano giorno per giorno, e il resto può attendere che tu lo sappia.',
  'newTrip.name': 'Nome del viaggio',
  'newTrip.namePlaceholder': 'Kyoto nella stagione dei ciliegi',
  'newTrip.destination': 'Destinazione',
  'newTrip.destinationHint': 'Una città, una regione o tutto il percorso.',
  'newTrip.destinationPlaceholder': 'Kyoto, Giappone',
  'newTrip.departure': 'Partenza',
  'newTrip.return': 'Ritorno',
  'newTrip.returnError': 'La data di ritorno precede la partenza.',
  'newTrip.currency': 'Valuta del budget',
  'newTrip.currencyHint': 'In essa viene sommata ogni spesa di questo viaggio.',
  'newTrip.submit': 'Crea viaggio',
  'newTrip.creating': 'Creazione del viaggio',
  'newTrip.error':
    'Non è stato possibile creare il viaggio. Riprova tra un momento.',
  'newTrip.created': 'Viaggio creato',
  'newTrip.createdBody': 'Comincia a mettere luoghi sulla mappa.',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Azioni per {title}',
  'tripActions.copy': 'Copia',
  'tripActions.favourite': 'Aggiungi ai preferiti',
  'tripActions.unfavourite': 'Rimuovi dai preferiti',
  'tripActions.edit': 'Modifica',
  'tripActions.archive': 'Archivia',
  'tripActions.restore': 'Ripristina',
  'tripActions.delete': 'Elimina',
  'tripActions.deleteForGood': 'Elimina definitivamente',
  'tripActions.starFailed': 'Il preferito non è stato salvato',
  'tripActions.starFallback': 'Il viaggio è tornato com’era.',
  'tripActions.archived': 'Viaggio archiviato',
  'tripActions.archiveFailed': 'Non è stato possibile archiviare il viaggio',
  'tripActions.restored': 'Viaggio ripristinato',
  'tripActions.restoreFailed': 'Non è stato possibile ripristinare il viaggio',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Modifica viaggio',
  'editTrip.submit': 'Salva modifiche',
  'editTrip.saving': 'Salvataggio del viaggio',
  'editTrip.cancel': 'Annulla',
  'editTrip.saved': 'Viaggio aggiornato',
  'editTrip.errorTitle': 'Non è stato salvato',
  'editTrip.retry': 'Riprova',
  'editTrip.error':
    'Non è stato possibile salvare il viaggio. Riprova tra un momento.',
  'editTrip.currencyLocked':
    'Questo viaggio ha già dei prezzi, quindi la valuta del budget non si può cambiare da qui. Rimetti {current} per salvare le altre modifiche.',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Eliminare «{title}» per sempre?',
  'deleteTrip.description':
    'Non c’è annulla né cestino. L’archivio toglie un viaggio dall’elenco senza perderlo.',
  'deleteTrip.reading': 'Lettura di ciò che contiene questo viaggio',
  'deleteTrip.errorTitle': 'Non è stato caricato',
  'deleteTrip.summaryError':
    'Non è stato possibile leggere ciò che contiene questo viaggio.',
  'deleteTrip.confirmLabel': 'Digita il nome del viaggio per confermare',
  'deleteTrip.deleting': 'Eliminazione del viaggio',
  'deleteTrip.deleted': 'Viaggio eliminato',
  'deleteTrip.failed': 'Non è stato possibile eliminare il viaggio',
  'deleteTrip.carried.reservations': {
    one: 'prenotazione',
    many: 'prenotazioni',
    other: 'prenotazioni',
  },
  'deleteTrip.carried.transports': {
    one: 'spostamento',
    many: 'spostamenti',
    other: 'spostamenti',
  },
  'deleteTrip.carried.expenses': {
    one: 'spesa',
    many: 'spese',
    other: 'spese',
  },
  'deleteTrip.carried.files': {
    one: 'file',
    many: 'file',
    other: 'file',
  },
  'deleteTrip.carried.members': {
    one: 'persona',
    many: 'persone',
    other: 'persone',
  },
  'copyTrip.title': 'Copia «{title}»',
  'copyTrip.nameLabel': 'Nome della copia',
  'copyTrip.titleRequired': 'Dai un nome alla copia.',
  'copyTrip.datesLabel': 'Date',
  'copyTrip.datesTogether':
    'Imposta entrambe le date oppure cancellale tutte e due.',
  'copyTrip.clearDates': 'Copia senza date',
  'copyTrip.carries':
    'Giorni, luoghi e note passano nella copia. Prenotazioni, spese, file e persone no.',
  'copyTrip.shorter':
    'È più corto dell’originale. I luoghi dei giorni in eccesso finiscono tra le idee e le loro note vengono scartate.',
  'copyTrip.submit': 'Copia il viaggio',
  'copyTrip.copying': 'Copia del viaggio in corso',
  'copyTrip.cancel': 'Annulla',
  'copyTrip.started': 'Copia di «{title}» in corso',
  'copyTrip.errorTitle': 'Non è stato copiato',
  'copyTrip.error': 'Il viaggio non è stato copiato. Riprova tra un momento.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'Chi può vederlo',
  'visibility.private': 'Solo io',
  'visibility.organization': 'Tutti nello spazio',
  'visibility.public': 'Chiunque abbia il link',

  'trips.error': 'I tuoi viaggi non si sono caricati',
  'trips.eyebrow': 'Spazio',
  'trips.nothingPlanned': 'Ancora niente in programma',
  'trips.search': 'Cerca viaggi',
  'trips.atLimit.title': 'Hai occupato tutti i viaggi che il piano consente',
  'trips.atLimit.action': 'Confronta i piani',
  'trips.noMatch.title': 'Niente corrisponde a questo filtro',
  'trips.noMatch.body':
    "Prova un'altra fase, svuota la ricerca o guarda nell'archivio.",
  'trips.noMatch.action': 'Reimposta i filtri',
  'trips.empty.body':
    "Un viaggio tiene l'itinerario, la mappa, le prenotazioni, le liste da preparare e i soldi. Comincia uno e il resto segue.",
  'trips.next.title': 'Da qualche parte poi',
  'trips.next.body':
    'Comincia un viaggio e planned.travel costruisce un giorno per data, pronto per quello che hai salvato.',
  'trips.savedPlaces': 'Luoghi salvati',
  'trips.filter.all': 'Tutti',
  'trips.filter.favourites': 'Preferiti',
  'trips.view.label': 'Visualizzazione',
  'trips.view.grid': 'Griglia',
  'trips.view.list': 'Elenco',
  'trips.card.favourite': 'Preferito',
  'trips.card.noDestination': 'Destinazione ancora da scegliere',
  'trips.card.noDates': 'Date da fissare',
  'trips.card.startsIn': 'fra {days} g',
  'trips.card.days': '{days} g',
  'trips.card.copying': 'In copia',
  'trips.card.copyingLabel': '{title} è ancora in copia',
  'trips.card.copyingReason': 'Aspetta che la copia finisca.',
  'metric.trips': 'Viaggi',
  'metric.places': 'Luoghi',
  'metric.members': 'Membri',
  'metric.files': 'File',
  'metric.storage_bytes': 'Spazio',
  'metric.collections': 'Raccolte',
  'metric.journeys': 'Diari',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Questo non si è caricato',
  'error.body':
    'Non è andato perso niente. Riprova e, se continua, mandaci il dettaglio qui sotto.',
  'error.retry': 'Riprova',
  'error.dashboard': 'Torna al pannello',
  'error.reported': 'Siamo stati avvisati e stiamo controllando.',
  'error.reference': 'Riferimento',
  'error.feedback.open': 'Raccontaci che cosa è successo',
  'error.feedback.label': 'Che cosa stavi facendo quando è successo?',
  'error.feedback.send': 'Invia',
  'error.feedback.sent': 'Grazie, ci è di grande aiuto.',
  'error.feedback.failed':
    'Non è stato inviato. Il riferimento qui sopra ci arriva comunque.',
  'error.root': 'Siamo usciti di rotta',
  'error.session': 'Il tuo accesso allo spazio di lavoro è cambiato',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Segnala un problema',
  'feedback.formTitle': 'Segnala un problema',
  'feedback.messageLabel': 'Cosa non va, o cosa andrebbe cambiato?',
  'feedback.messagePlaceholder': 'Cosa ti aspettavi e cosa è successo invece?',
  'feedback.emailLabel': 'Indirizzo email',
  'feedback.emailPlaceholder': 'tu@example.com',
  'feedback.isRequiredLabel': '(obbligatorio)',
  'feedback.submitButtonLabel': 'Invia la segnalazione',
  'feedback.cancelButtonLabel': 'Annulla',
  'feedback.confirmButtonLabel': 'Conferma',
  'feedback.addScreenshotButtonLabel': 'Aggiungi uno screenshot',
  'feedback.removeScreenshotButtonLabel': 'Rimuovi lo screenshot',
  'feedback.highlightToolText': 'Evidenzia',
  'feedback.hideToolText': 'Nascondi',
  'feedback.successMessageText': 'Grazie — la tua segnalazione è arrivata.',
  'feedback.errorEmptyMessageText':
    'Scrivi prima una frase — una segnalazione vuota non ci dice nulla.',
  'feedback.errorTimeoutText':
    'Ci sta mettendo troppo e non possiamo confermare che la segnalazione sia partita.',
  'feedback.errorForbiddenText':
    'Questa pagina non è autorizzata a inviare segnalazioni.',
  'feedback.errorGenericText':
    'Non è partita. Controlla la connessione e se c’è un blocco pubblicità di mezzo.',

  'notFound.eyebrow': 'Errore 404',
  'notFound.title': 'Questa pagina non è sulla mappa',
  'notFound.body':
    'Il link potrebbe essere vecchio, oppure il viaggio a cui puntava è stato spostato o eliminato.',
  'notFound.trips': 'Tutti i viaggi',
  'notFound.rootBody':
    'Abbiamo cercato lungo tutta la rotta. L’indirizzo potrebbe avere un refuso, oppure la pagina si è spostata.',
  'notFound.home': 'Torna alla pagina iniziale',
  'notFound.plans': 'Vedi i piani',

  'session.noWorkspace':
    'Il tuo account non è ancora collegato a uno spazio di lavoro. Esci e rientra per finire di configurarlo.',
  'session.membershipRemoved':
    'La tua appartenenza a questo spazio di lavoro è stata revocata.',
} satisfies TranslationOf<typeof En>

export default messages
