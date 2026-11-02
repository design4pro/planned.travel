/**
 * Everything the settings module says, in Italian.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tu», as everywhere else in the Italian catalogue.
 *
 * **Plural.** `Intl.PluralRules('it')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Length is load-bearing here.** Two controls on these screens truncate: the
 * hint under each section link, and the trigger of every regional select. Each
 * `nav.*.hint` therefore stays inside the English one's width, and
 * `regional.workspaceDefault` leads with «Predefinito» rather than a full
 * translation of «workspace default».
 *
 * **Currency names are lower case**, as Italian writes them, and the ISO code
 * beside them is derived in the route rather than translated.
 *
 * **Plan names are words, not proper nouns.** `Solo` and `Crew` name a way of
 * travelling, so Italian says «In solitaria» and «In gruppo»; the stable
 * identifier is the plan id in `src/lib/plans.ts`, which no reader ever sees.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  'workspace.invite.invite': 'Invita',
  'workspace.invite.resend': 'Invia di nuovo',
  'workspace.invite.revoke': 'Revoca',
  'workspace.invite.confirm': 'Revoca l’invito',
  'workspace.invite.expired': 'Scaduto',
  'workspace.invite.by': 'Invito da {name}',
  'workspace.invite.sent': 'Invito inviato',
  'workspace.invite.revoked': 'Invito revocato',
  'workspace.invite.delivery':
    'Invito salvato, ma l’invio non è riuscito. Invialo di nuovo.',
  'workspace.invite.duplicate':
    'Esiste già un invito in sospeso. Invialo di nuovo.',
  'workspace.invite.existing':
    'Questa persona fa già parte dello spazio di lavoro.',
  'workspace.invite.failed':
    'Invito non disponibile. Aggiorna la lista e riprova.',
  'workspace.invite.reload': 'Aggiorna gli inviti',

  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Account personale',
  'page.title': 'Impostazioni',
  'page.description':
    'Tutto su di te, sul tuo spazio di lavoro e su come si comporta planned.travel',
  'page.error': 'Le impostazioni non si sono caricate',

  'nav.label': 'Sezioni delle impostazioni',
  'nav.profile': 'Profilo',
  'nav.profile.hint': 'Tu, le date e il denaro',
  'nav.language': 'Lingua',
  'nav.language.hint': 'La lingua di ogni schermata',
  'nav.appearance': 'Aspetto',
  'nav.appearance.hint': 'Tema, movimento e mappa',
  'nav.security': 'Sicurezza',
  'nav.security.hint': 'Password, due passaggi, chiavi',
  'nav.notifications': 'Notifiche',
  'nav.notifications.hint': 'Posta, e-mail e telefono',
  'nav.workspace': 'Spazio di lavoro',
  'nav.workspace.hint': 'Membri e valori comuni',
  'nav.billing': 'Fatturazione',
  'nav.billing.hint': 'Piano, posti e fatture',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Salva le modifiche',
  'error.retryBody':
    'Non è andato perso niente. Controlla la connessione e riprova.',
  'role.owner': 'Proprietario',
  'role.admin': 'Amministratore',
  'role.member': 'Membro',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Predefinito — {value}',
  'regional.currency.AUD': 'dollaro australiano',
  'regional.currency.CAD': 'dollaro canadese',
  'regional.currency.CHF': 'franco svizzero',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'sterlina britannica',
  'regional.currency.JPY': 'yen giapponese',
  'regional.currency.PLN': 'zloty polacco',
  'regional.currency.SEK': 'corona svedese',
  'regional.currency.USD': 'dollaro statunitense',
  'regional.distance.metric': 'Chilometri',
  'regional.distance.imperial': 'Miglia',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Il tuo profilo non si è caricato',
  'profile.account.title': 'Il tuo account',
  'profile.account.description':
    'Il nome e l’email arrivano dall’account con cui entri.',
  'profile.email.verified': 'Email verificata',
  'profile.email.unverified': 'Email non verificata',
  'profile.twoFactor.on': 'Due passaggi attivi',
  'profile.figure.workspace': 'Spazio di lavoro',
  'profile.figure.role': 'Ruolo',
  'profile.figure.joined': 'Membro dal',
  'profile.figure.joinedUnknown': 'Non registrato',
  'profile.regional.title': 'Date, denaro e unità',
  'profile.regional.description':
    'Queste scelte valgono per te soltanto e hanno la meglio su quelle dello spazio di lavoro. Se ne lasci una com’è, segue lo spazio.',
  'profile.regional.saving': 'Salvataggio delle tue preferenze',
  'profile.regional.saved': 'Le tue preferenze sono salvate',
  'profile.regional.saveFailed': 'Le tue preferenze non sono state salvate',
  'profile.language.label': 'Lingua',
  'profile.language.hint':
    'Si sceglie su una schermata sua, dove ogni lingua è scritta nel proprio alfabeto.',
  'profile.language.action': 'Cambia',
  'profile.timezone.label': 'Fuso orario',
  'profile.timezone.hint':
    'Gli orari di partenza e di arrivo sono mostrati su questo fuso.',
  'profile.currency.label': 'Valuta',
  'profile.currency.hint':
    'I viaggi nuovi partono con questa valuta; ogni viaggio può cambiarla.',
  'profile.dateFormat.label': 'Formato della data',
  'profile.weekStart.label': 'La settimana comincia di',
  'profile.weekStart.hint':
    'Vale per ogni calendario, compresa la griglia annuale delle vacanze.',
  'profile.distance.label': 'Distanza',

  /* --------------------------------------------------------------- language */
  'language.error': 'Le tue impostazioni di lingua non si sono caricate',
  'language.section.title': 'Lingua',
  'language.section.description':
    'Ogni schermata, ogni pulsante e ogni data si leggono nella lingua che scegli qui — ventitré, ognuna scritta nel proprio alfabeto.',
  'language.label': 'Scegli una lingua',
  'language.followWorkspace': 'Segui lo spazio di lavoro',
  'language.state.yours': 'La tua lingua',
  'language.state.workspace': 'La dà lo spazio di lavoro',
  'language.state.hint.override':
    'È una tua scelta. Vale solo per te, su ogni dispositivo da cui entri.',
  'language.state.hint.workspace':
    'Non hai una lingua tua, quindi leggi quella impostata sullo spazio di lavoro. Un proprietario o un amministratore può cambiarla in Spazio di lavoro.',
  'language.saved': 'planned.travel adesso parla {language}',
  'language.saveFailed': 'La tua lingua non è cambiata',
  'language.saveFailedBody':
    'Non è andato perso niente e stai ancora leggendo {language}. Controlla la connessione, poi scegli di nuovo.',
  'language.reload.title': 'La tua lingua è salvata',
  'language.reload.body':
    'Questa pagina non è riuscita a passare del tutto a {language}. Ricaricala per leggere il prodotto nella lingua nuova.',
  'language.sample.title': 'Come si leggeranno date e numeri',
  'language.sample.description':
    'Gli stessi tre valori, scritti come li scrive questa lingua.',
  'language.sample.date': 'Una data',
  'language.sample.number': 'Un numero',
  'language.sample.money': 'Un importo',
  'language.legal':
    'Le condizioni e l’informativa sulla privacy sono pubblicate solo in inglese. Tutto il resto del prodotto è tradotto.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'L’aspetto non si è caricato',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Tutti e due i temi sono disegnati, non invertiti. Scegli quello che leggi più comodamente.',
  'appearance.theme.light': 'Chiaro',
  'appearance.theme.lightHint': 'Carta calda, tutto il giorno',
  'appearance.theme.dark': 'Scuro',
  'appearance.theme.darkHint': 'Carbone caldo, mai nero',
  'appearance.theme.system': 'Sistema',
  'appearance.theme.systemHint': 'Segui il dispositivo',
  'appearance.theme.showing': 'Adesso vedi la tavolozza {palette}.',
  'appearance.theme.showingSystem':
    'Adesso vedi la tavolozza {palette}, come il tuo dispositivo.',
  'appearance.palette.light': 'chiara',
  'appearance.palette.dark': 'scura',
  'appearance.motion.title': 'Movimento e mappe',
  'appearance.motion.label': 'Riduci il movimento',
  'appearance.motion.hint':
    'Riduce le animazioni di ingresso a una semplice dissolvenza. L’impostazione di riduzione del movimento del tuo sistema è sempre rispettata.',
  'appearance.map.label': 'Stile della mappa',
  'appearance.map.hint':
    'La mappa di base usata dal pianificatore e dalla mappa del mondo.',
  'appearance.map.workspace': 'Segui lo spazio di lavoro',
  'appearance.map.workspaceHint':
    'La scelta del proprietario dello spazio di lavoro.',
  'appearance.map.auto': 'Automatico',
  'appearance.map.autoHint': 'Segue il tuo tema chiaro o scuro.',
  'appearance.map.paper': 'Carta',
  'appearance.map.paperHint': 'Calda e chiara, qualunque tema tu stia usando.',
  'appearance.map.charcoal': 'Carbone',
  'appearance.map.charcoalHint':
    'Calda e scura, qualunque tema tu stia usando.',
  'appearance.map.quiet': 'Discreta',
  'appearance.map.quietHint':
    'Senza nomi di strade, così i tuoi segnaposti si leggono per primi.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Su uno schermo condiviso',
  'appearance.privacy.codesLabel':
    'Nascondi i codici di conferma finché non li chiedo',
  'appearance.privacy.codesHint':
    'I riferimenti di prenotazione e i numeri di conferma restano mascherati nella scrivania delle prenotazioni e nei trasporti finché non ci fai clic o non li tocchi, e tornano mascherati quando passi ad altro. I prezzi non vengono mai nascosti.',
  'appearance.saveFailed': 'Questa modifica non è stata salvata',
  'appearance.saveFailedBody':
    'Qui si vede, ma il prossimo dispositivo da cui entri non ce l’avrà.',

  /* --------------------------------------------------------------- security */
  'security.error': 'La sicurezza non si è caricata',
  'security.unverified.title': 'Il tuo indirizzo email non è ancora verificato',
  'security.unverified.body':
    'Le reimpostazioni della password e gli inviti ai viaggi vanno a {email}. Verificarlo è ciò che dimostra che l’indirizzo è tuo.',
  'security.unverified.action': 'Manda di nuovo il link',
  'security.signin.title': 'Accesso',
  'security.signin.description':
    'Come dimostri che sei tu. La verifica in due passaggi e le chiavi d’accesso sono entrambe più solide di una password da sola.',
  'security.email.label': 'Indirizzo email',
  'security.email.verified': 'Verificato',
  'security.email.unverified': 'Non verificato',
  'security.password.label': 'La tua password',
  'security.password.hint':
    'Cambiala quando vuoi — ti mandiamo un link usa e getta invece di chiederti quella vecchia.',
  'security.password.action': 'Cambia la password',
  'security.twoFactor.label': 'Verifica in due passaggi',
  'security.twoFactor.onHint':
    'Viene chiesto un codice dall’app quando accedi con e-mail e password, a meno che questo browser sia attendibile.',
  'security.twoFactor.offHint':
    'Aggiungi un codice di sei cifre da un’app di autenticazione sopra alla password.',
  'security.twoFactor.on': 'Attiva',
  'security.twoFactor.off': 'Non attiva',
  'security.twoFactor.manage': 'Gestisci',
  'security.twoFactor.enable': 'Attiva ora',
  'security.passkeys.label': 'Chiavi d’accesso',
  'security.passkeys.hint':
    'Entra con l’impronta, il volto o una chiave di sicurezza, senza scrivere niente.',
  'security.passkeys.action': 'Gestisci le chiavi d’accesso',
  'security.session.title': 'Questa sessione',
  'security.session.description': 'Il browser in cui stai leggendo.',
  'security.session.label': 'Sei entrato come',
  'security.session.expires': 'Scade {date}',
  'security.session.expiresSoon': 'a breve',
  'security.session.noExpiry': 'Nessuna scadenza registrata',
  'security.signOut.label': 'Esci',
  'security.signOut.hint':
    'Chiude questa sessione e ti riporta alla pagina di accesso. Gli altri dispositivi restano collegati.',
  'security.signOut.pending': 'Uscita in corso',
  'security.signOut.failed': 'Non sei uscito',
  'security.signOut.failedBody': 'Controlla la connessione e riprova.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Le impostazioni delle notifiche non si sono caricate',
  'notifications.title': 'Notifiche',
  'notifications.description':
    'Ogni interruttore vale solo per te. Spegnerne uno non impedisce mai che la cosa accada: impedisce solo che te la raccontiamo.',
  'notifications.caption': 'Quali notifiche arrivano su quale canale',
  'notifications.event': 'Evento',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Questa preferenza non è stata salvata',
  'notifications.saveFailedBody':
    'L’interruttore è tornato dov’era. Controlla la connessione e riprova.',
  'notifications.channel.in_app': 'Nell’app',
  'notifications.channel.in_app.hint': 'La campanella della barra in alto',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'All’indirizzo con cui entri',
  'notifications.channel.push': 'Sul telefono',
  'notifications.channel.push.hint': 'Sui dispositivi dove l’hai permesso',
  'notifications.event.trip.invited': 'Inviti ai viaggi',
  'notifications.event.trip.invited.hint':
    'Qualcuno ti aggiunge a un viaggio che sta organizzando.',
  'notifications.event.trip.updated': 'Modifiche al programma',
  'notifications.event.trip.updated.hint':
    'Un giorno, una tappa o una data si sposta su un viaggio in cui sei.',
  'notifications.event.trip.starting_soon': 'Promemoria di partenza',
  'notifications.event.trip.starting_soon.hint':
    'Un richiamo nei giorni prima che il viaggio cominci.',
  'notifications.event.reservation.reminder': 'Promemoria delle prenotazioni',
  'notifications.event.reservation.reminder.hint':
    'Si avvicina un soggiorno, un tavolo o un biglietto.',
  'notifications.event.expense.added': 'Spese nuove',
  'notifications.event.expense.added.hint':
    'Qualcuno registra soldi spesi su un viaggio condiviso.',
  'notifications.event.expense.settled': 'Conti saldati',
  'notifications.event.expense.settled.hint':
    'Un saldo di cui facevi parte è stato pagato.',
  'notifications.event.list.assigned': 'Voci assegnate',
  'notifications.event.list.assigned.hint':
    'Qualcosa di una lista dei bagagli o delle cose da fare diventa tuo.',
  'notifications.event.collab.message': 'Conversazione del viaggio',
  'notifications.event.collab.message.hint':
    'Nuovi messaggi in un viaggio che stai facendo.',
  'notifications.event.organization.invited': 'Inviti agli spazi',
  'notifications.event.organization.invited.hint':
    'Ti invitano in uno spazio di lavoro.',

  'notifications.event.billing.plan_changed': 'Modifiche all’abbonamento',
  'notifications.event.billing.plan_changed.hint':
    'Il tuo spazio di lavoro passa a un altro piano.',
  'notifications.event.billing.invoice_paid': 'Ricevute di pagamento',
  'notifications.event.billing.invoice_paid.hint':
    'Una fattura del tuo spazio di lavoro è stata pagata.',
  'notifications.event.billing.payment_failed': 'Problemi di pagamento',
  'notifications.event.billing.payment_failed.hint':
    'Un addebito per il tuo spazio di lavoro non è riuscito.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Lo spazio di lavoro non si è caricato',
  'workspace.summary.description': 'Piano {plan} · creazione {date}',
  'workspace.summary.createdRecently': 'da poco',
  'workspace.summary.billingAction': 'Piano e fatturazione',
  'workspace.seats.label': 'Posti usati',
  'workspace.seats.value': '{used} su {limit}',
  'workspace.seats.note':
    'Gli inviti in sospeso occupano un posto, così uno spazio non può mai superare il piano che paga.',
  'workspace.seatsFull.title': 'Tutti i posti di questo piano sono occupati',
  'workspace.seatsFull.body':
    '{members} e {invitations} riempiono tutti i {limit} posti.',
  'workspace.seatsFull.action': 'Aggiungi posti',
  'workspace.members.count': {
    one: '{value} membro',
    many: '{value} membri',
    other: '{value} membri',
  },
  'workspace.invitations.count': {
    one: '{value} invito in sospeso',
    many: '{value} inviti in sospeso',
    other: '{value} inviti in sospeso',
  },
  'workspace.members.title': 'Membri',
  'workspace.members.description':
    'Tutte le persone che vedono i viaggi, le spese e i file di questo spazio.',
  'workspace.members.tableLabel': 'Membri di questo spazio di lavoro',
  'workspace.members.person': 'Persona',
  'workspace.members.role': 'Ruolo',
  'workspace.members.joined': 'Iscrizione',
  'workspace.invitations.title': 'Inviti',
  'workspace.invitations.description':
    'Persone invitate che non sono ancora entrate.',
  'workspace.invitations.emptyTitle': 'Nessun invito in sospeso',
  'workspace.invitations.emptyBody':
    'Tutte le persone invitate in questo spazio sono già entrate.',
  'workspace.invitations.expires': 'Scade {date}',
  'workspace.invitations.expiresSoon': 'a breve',
  'workspace.defaults.title': 'Valori comuni',
  'workspace.defaults.description':
    'Con che cosa partono un viaggio nuovo e un membro nuovo. Chiunque può cambiarli per sé nel proprio profilo.',
  'workspace.defaults.readOnly': 'Sola lettura',
  'workspace.defaults.saving': 'Salvataggio dei valori comuni',
  'workspace.defaults.saved': 'I valori comuni sono salvati',
  'workspace.defaults.saveFailed': 'I valori comuni non sono stati salvati',
  'workspace.defaults.saveFailedBody':
    'Possono cambiarli solo un proprietario o un amministratore. Controlla la connessione, poi riprova.',
  'workspace.currency.label': 'Valuta predefinita',
  'workspace.currency.hint': 'I viaggi nuovi vengono messi a budget in questa.',
  'workspace.language.label': 'Lingua',
  'workspace.language.hint':
    'Che cosa legge un membro che non ha scelto una lingua sua.',
  'workspace.timezone.label': 'Fuso orario',
  'workspace.dateFormat.label': 'Formato della data',
  'workspace.weekStart.label': 'La settimana comincia di',
  'workspace.distance.label': 'Distanza',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'La fatturazione non si è caricata',
  'billing.loading': 'Caricamento del piano e delle ricevute',
  'billing.status.none': 'Nessun abbonamento',
  'billing.status.trialing': 'Prova',
  'billing.status.active': 'Attivo',
  'billing.status.past_due': 'Pagamento non riuscito',
  'billing.status.unpaid': 'Non pagato',
  'billing.status.paused': 'In pausa',
  'billing.status.canceled': 'Disdetto',
  'billing.status.incomplete': 'Incompleto',
  'billing.status.incomplete_expired': 'Scaduto',

  'billing.return.pending': 'Verifica della modifica del piano',
  'billing.return.checking': 'Verifica dello stato di fatturazione',
  'billing.return.confirmed': 'Piano confermato',
  'billing.return.scheduled': 'Modifica del piano programmata',
  'billing.return.delayed': 'La conferma richiede più tempo',
  'billing.return.body':
    'Aggiorna per verificare di nuovo. Se la modifica resta senza conferma, contatta l’assistenza.',
  'billing.return.scheduledBody':
    'La modifica sarà effettiva dal {date}. Fino ad allora resta attivo il piano attuale. Questo non conferma le modifiche al numero di posti.',

  'billing.checkout.cancelledTitle': 'Pagamento annullato',
  'billing.checkout.cancelledBody':
    'Non è stato addebitato niente e il tuo piano non è cambiato.',
  'billing.portal.backTitle': 'Di ritorno da Polar',
  'billing.portal.backBody':
    'Quello che hai cambiato lì arriva qui appena Polar lo conferma.',
  'billing.refresh': 'Aggiorna',
  'billing.readOnly.title': 'Sei un membro di questo spazio di lavoro',
  'billing.readOnly.body':
    'Solo un proprietario o un amministratore può cambiare l’abbonamento. Per te, qui sotto è tutto in sola lettura.',

  'billing.hero.label': 'Piano attuale',
  'billing.hero.endsAtPeriod': 'Finisce alla chiusura del periodo',
  'billing.hero.perYear': '/ anno',
  'billing.hero.perMonth': '/ mese',
  'billing.hero.freeAllowance': '{trips} viaggi, un viaggiatore',
  'billing.hero.perSeatLine': '{seats} membri × {price}',
  'billing.hero.singleTraveller': 'Un viaggiatore',
  'billing.price.free': 'Gratis',
  'billing.provider.opening': 'Apertura di Polar',
  'billing.renewal.trialEndsToday':
    'La prova finisce oggi. Il primo addebito segue, a meno che non disdica prima.',
  'billing.renewal.trialEndsIn': {
    one: 'La prova finisce fra {value} giorno e poi arriva il primo addebito, a meno che non disdica prima.',
    many: 'La prova finisce fra {value} giorni e poi arriva il primo addebito, a meno che non disdica prima.',
    other:
      'La prova finisce fra {value} giorni e poi arriva il primo addebito, a meno che non disdica prima.',
  },
  'billing.renewal.trialEnded': 'La prova è finita.',
  'billing.renewal.endsNoDate':
    'Questo piano è impostato per finire e non si rinnoverà.',
  'billing.renewal.endsOn':
    'Questo piano finisce in data {date}. Non viene cancellato niente: i moduli a pagamento si bloccano, tutto qui.',
  'billing.renewal.pastDue':
    'L’ultimo pagamento non è andato a buon fine. Aggiorna la carta per non perdere i moduli a pagamento.',
  'billing.renewal.unpaid':
    'Questo abbonamento non è pagato e i moduli a pagamento sono chiusi.',
  'billing.renewal.paused':
    'Questo abbonamento è in pausa. Riprendilo quando sei di nuovo pronto a partire.',
  'billing.renewal.lapsed':
    'Scegli un piano qui sotto per riaprire prenotazioni e diario.',
  'billing.renewal.incomplete':
    'Polar aspetta ancora la conferma di questo pagamento.',
  'billing.renewal.free':
    'Due viaggi alla volta, offerti. Cambia piano quando ti staranno stretti.',
  'billing.renewal.auto': 'Si rinnova da solo.',
  'billing.renewal.renewsOn': 'Prossimo rinnovo: {date}.',

  'billing.usage.title': 'Utilizzo',
  'billing.usage.description':
    'Contato in tempo reale, così nessun indicatore è vecchio. I limiti seguono il piano in vigore adesso.',
  'billing.quota.seats': 'Membri',
  'billing.quota.trips': 'Viaggi',
  'billing.quota.storageBytes': 'Spazio',
  'billing.quota.unlimited': 'Illimitato',
  'billing.quota.places': 'Luoghi',
  'billing.quota.placesHint': 'In tutti i viaggi di questo spazio di lavoro',
  'billing.quota.exhausted.places': 'La quota di luoghi è esaurita',
  'billing.quota.over.places': 'Limite di luoghi superato di {value}',
  'billing.quota.noLimit': 'Questo piano non pone limiti',
  'billing.quota.used': '{quota} in uso',
  'billing.quota.over.seats': {
    one: '{value} posto oltre il limite di questo piano',
    many: '{value} posti oltre il limite di questo piano',
    other: '{value} posti oltre il limite di questo piano',
  },
  'billing.quota.over.trips': {
    one: '{value} viaggio oltre il limite di questo piano',
    many: '{value} viaggi oltre il limite di questo piano',
    other: '{value} viaggi oltre il limite di questo piano',
  },
  'billing.quota.over.storage': '{value} oltre il limite di questo piano',
  'billing.quota.exhausted.seats':
    'Tutti i posti di questo piano sono occupati',
  'billing.quota.exhausted.trips':
    'Tutti gli spazi per i viaggi di questo piano sono in uso',
  'billing.quota.exhausted.storage': 'Lo spazio di questo piano è pieno',
  'billing.quota.left': 'Restano {value}',

  'billing.plans.title': 'Piani',
  'billing.plans.description':
    'Cambia piano quando vuoi. Un passaggio a un piano superiore si calcola al giorno; una riduzione aspetta la fine del periodo già pagato.',
  'billing.interval.label': 'Periodo di fatturazione',
  'billing.interval.monthly': 'Mensile',
  'billing.interval.yearly': 'Annuale',
  'billing.plan.free.name': 'Gratuito',
  'billing.plan.free.tagline': 'Organizza i tuoi prossimi due viaggi',
  'billing.plan.free.feature.trips':
    'Due viaggi alla volta e fino a 150 luoghi',
  'billing.plan.free.feature.itinerary': 'Itinerario giorno per giorno e mappa',
  'billing.plan.free.feature.lists': 'Liste dei bagagli e budget semplici',
  'billing.plan.free.feature.atlas':
    'La mappa del mondo che segna dove sei stato',
  'billing.plan.solo.name': 'In solitaria',
  'billing.plan.solo.tagline': 'Per chi organizza tutto da sé',
  'billing.plan.solo.feature.trips': 'Viaggi e luoghi illimitati',
  'billing.plan.solo.feature.modules':
    'Tutti i moduli — prenotazioni, diario, budget, bagagli',
  'billing.plan.solo.feature.storage': '5 GB per foto e documenti',
  'billing.plan.solo.feature.export': 'Esportazione in PDF e nel calendario',
  'billing.plan.crew.name': 'In gruppo',
  'billing.plan.crew.tagline': 'Per famiglie, amici e squadre piccole',
  'billing.plan.crew.feature.members': 'Fino a dieci membri, pagati a persona',
  'billing.plan.crew.feature.realtime':
    'Collaborazione in tempo reale, cursori compresi',
  'billing.plan.crew.feature.everything':
    'Viaggi e luoghi illimitati e tutti i moduli',
  'billing.plan.crew.feature.storage':
    'Spazio condiviso per le foto e i documenti di tutti',

  'billing.plan.current': 'Piano attuale',
  'billing.plan.currentBadge': 'Attuale',
  'billing.plan.popular': 'Il più scelto',
  'billing.plan.switchYearly': 'Passa all’annuale',
  'billing.plan.switchMonthly': 'Passa al mensile',
  'billing.plan.upgradeTo': 'Sali a {plan}',
  'billing.plan.changeTo': 'Cambia in {plan}',
  'billing.plan.perMemberMonth': '/ membro / mese',
  'billing.plan.perMonth': '/ mese',
  'billing.plan.alwaysFree': 'Sempre gratuito, senza carta',
  'billing.plan.billedYearly': '{amount} fatturati all’anno',
  'billing.plan.billedMonthly': '{amount} fatturati al mese',
  'billing.plan.members': 'Membri',
  'billing.plan.membersHint': 'Cambialo quando vuoi — la fattura segue.',
  'billing.plan.seatOption': {
    one: '{value} membro',
    many: '{value} membri',
    other: '{value} membri',
  },

  'billing.invoices.number': 'Fattura',
  'billing.invoices.date': 'Data',
  'billing.invoices.amount': 'Importo',
  'billing.invoices.status': 'Stato',
  'billing.invoice.paid': 'Pagata',
  'billing.invoice.draft': 'Bozza',
  'billing.invoice.void': 'Annullata',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Il fornitore di pagamento ha rifiutato la richiesta. Riprova tra un momento.',
  'billing.failure.reference': 'Riferimento per l’assistenza: {reference}',
  'billing.failure.forbidden':
    'Il tuo ruolo non consente questa operazione sulla fatturazione di questo spazio di lavoro. Chiedi a un proprietario o a un amministratore.',
  'billing.failure.providerRefused':
    'Polar non ha accettato la modifica. Confronta il numero di posti con i tuoi membri, poi riprova o usa il portale di fatturazione.',
  'billing.failure.rateLimited':
    'Polar è molto occupato in questo momento. Non è stato modificato nulla. Riprova tra un minuto.',
  'billing.failure.notConnected':
    'La fatturazione non è ancora collegata in questa distribuzione, quindi non è stato modificato nulla. Contatta l’assistenza.',
  'billing.failure.orderNotInvoiceable':
    'Polar non può emettere una fattura per questo ordine. Se mancano il nome o l’indirizzo di fatturazione, aggiungili nel portale di fatturazione e riprova; altrimenti contatta l’assistenza.',
  'billing.discount.toggle': 'Hai un codice promozionale?',
  'billing.discount.label': 'Codice promozionale',
  'billing.discount.hint': 'Verrà applicato al piano che sceglierai.',
  'billing.discount.hintCurrent':
    'Applicalo al tuo piano attuale o scegli un piano qui sotto.',
  'billing.discount.applyCurrent': 'Applica al piano attuale',
  'billing.discount.applying': 'Applicazione del codice…',
  'billing.discount.invalidFormat': 'I codici hanno da 3 a 64 lettere e cifre.',
  'billing.discount.rejected.invalid':
    'Questo codice non è valido. Controllalo e riprova.',
  'billing.discount.rejected.rateLimited':
    'Troppi codici provati. Riprova tra un’ora.',
  'billing.discount.rejected.notApplicable':
    'Questo codice non si applica a questo piano.',
  'billing.discount.rejected.busy':
    'Al momento non è possibile verificare i codici. Riprova tra un minuto.',
  'billing.discount.nextRenewal':
    'Il codice promozionale si applica dal prossimo rinnovo.',
  'billing.discount.appliedTitle': 'Codice promozionale applicato',
  'billing.hero.manage': 'Gestisci la fatturazione',
  'billing.hero.manageHint':
    'Carte, indirizzo di fatturazione, partita IVA, ricevute e disdetta stanno su Polar, che emette la fattura.',
  'billing.hero.manageHintNone':
    'Non esiste ancora un profilo di fatturazione. Scegliendo un piano a pagamento qui sotto se ne crea uno, e da allora il portale si apre.',
  'billing.portal.opening': 'Apertura del portale di fatturazione',
  'billing.plan.notApplied': 'Questa modifica non è stata applicata',
  'billing.plan.cancelInPortal': 'Disdici nel portale',
  'billing.plan.seatsOverMax': {
    one: 'Questo spazio ha {members} membri e {plan} ne fattura al massimo {max}. Rimuovi {value} membro prima di cambiare.',
    many: 'Questo spazio ha {members} membri e {plan} ne fattura al massimo {max}. Rimuovi {value} membri prima di cambiare.',
    other:
      'Questo spazio ha {members} membri e {plan} ne fattura al massimo {max}. Rimuovi {value} membri prima di cambiare.',
  },
  'billing.plan.seatsBelowMembers':
    'Hai {members} membri. Scegli almeno altrettanti posti: Polar rifiuta un abbonamento con meno posti che assegnazioni.',
  'billing.orders.title': 'Ordini',
  'billing.orders.description':
    'Ogni ordine di questo spazio, dal più recente.',
  'billing.orders.receipts': 'Tutte le ricevute',
  'billing.orders.unavailableTitle': 'Gli ordini non si caricano',
  'billing.orders.unavailableBody':
    'Polar non ha risposto in tempo per lo storico. Tutto quanto sopra è aggiornato: riprova tra un momento o leggi il registro completo nel portale di fatturazione.',
  'billing.orders.emptyTitle': 'Nessun ordine',
  'billing.orders.emptyCustomer':
    'La prima fattura compare qui appena si chiude un periodo di fatturazione.',
  'billing.orders.emptyNoCustomer':
    'A questo spazio non è mai stato addebitato nulla. Scegli un piano a pagamento e le fatture si raccoglieranno qui.',
  'billing.orders.tableLabel': 'Storico degli ordini',
  'billing.orders.document': 'Documento',
  'billing.orders.dateUnknown': 'Data ignota',
  'billing.order.pending': 'In sospeso',
  'billing.order.refunded': 'Rimborsato',
  'billing.order.partiallyRefunded': 'Rimborsato in parte',
  'billing.order.noInvoiceDraft': 'Nessuna fattura finché l’ordine è una bozza',
  'billing.order.preparing': 'In preparazione',
  'billing.order.renderingHint':
    'Polar sta ancora generando la fattura {number}. Il download torna tra pochi secondi.',
  'billing.order.fetching': 'Recupero della fattura',
  'billing.order.generating': 'Polar sta preparando la fattura',
  'billing.order.pdfLabel': 'Fattura {number} in PDF',
  'billing.order.stillWritingTitle':
    'Polar sta ancora scrivendo quella fattura',
  'billing.order.stillWritingBody':
    'La fattura {number} è in generazione. Il download torna da sé tra pochi secondi.',
  'billing.order.openFailed': 'Quella fattura non si è aperta',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Account personale',
  'passkeys.page.title': 'Chiavi d’accesso',
  'passkeys.page.description':
    'Una chiave d’accesso ti permette di entrare con l’impronta, il volto o una chiave di sicurezza, senza scrivere niente.',
  'passkeys.page.back': 'Torna a sicurezza',
  'passkeys.list.label': 'Le tue chiavi d’accesso',
  'passkeys.add.action': 'Aggiungi una chiave d’accesso',
  'passkeys.add.loading': 'In attesa del tuo dispositivo',
  'passkeys.add.added': 'Chiave d’accesso aggiunta',
  'passkeys.add.dismissed': 'Nessuna chiave d’accesso è stata aggiunta',
  'passkeys.add.exists':
    'Questo dispositivo ha già una chiave d’accesso per il tuo account',
  'passkeys.add.failed': 'La chiave d’accesso non è stata aggiunta. Riprova.',
  'passkeys.add.stale':
    'Per la tua sicurezza, gestire le chiavi d’accesso richiede un accesso recente. Se scegli «Accedi di nuovo», la sessione corrente verrà chiusa e poi ti porteremo alla pagina di accesso.',
  'passkeys.error.sessionEnded':
    'La tua sessione è terminata. Accedi di nuovo per continuare a gestire le tue chiavi d’accesso.',
  'passkeys.signInAgain': 'Accedi di nuovo',
  'passkeys.add.limit':
    'Hai raggiunto il limite di {value} chiavi d’accesso. Rimuovine una per aggiungerne un’altra.',
  'passkeys.add.unsupported':
    'Questo browser non può creare chiavi d’accesso. Prova con un altro browser o dispositivo.',
  'passkeys.empty.title': 'Ancora nessuna chiave d’accesso',
  'passkeys.empty.body':
    'Aggiungine una e potrai entrare con l’impronta, il volto o una chiave di sicurezza, senza scrivere niente.',
  'passkeys.row.fallbackName': 'Chiave d’accesso · aggiunta il {date}',
  'passkeys.row.added': 'Aggiunta il {date}',
  'passkeys.row.lastUsed': 'Ultimo utilizzo: {date}',
  'passkeys.row.neverUsed': 'Non ancora usata per entrare',
  'passkeys.badge.synced': 'Sincronizzata',
  'passkeys.badge.singleDevice': 'Solo su un dispositivo',
  'passkeys.error.title': 'Le tue chiavi d’accesso non si sono caricate',
  'passkeys.error.retry': 'Riprova',
  'passkeys.error.rateLimited': 'Troppi tentativi. Riprova tra qualche minuto.',
  'passkeys.error.generic': 'Controlla la connessione e riprova.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': 'Rinomina {name}',
  'passkeys.rename.fieldLabel': 'Dai un nome a questa chiave d’accesso',
  'passkeys.rename.placeholder': 'Dalle un nome, ad esempio Telefono di lavoro',
  'passkeys.rename.saving': 'Salvataggio del nome',
  'passkeys.rename.saved': 'Nome salvato',
  'passkeys.rename.failed': 'Il nome non è stato salvato',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': 'Rimuovi {name}',
  'passkeys.delete.title': 'Rimuovere questa chiave d’accesso?',
  'passkeys.delete.body': 'Non potrai più accedere con {name}.',
  'passkeys.delete.password': 'La tua password',
  'passkeys.delete.passwordHint': 'Inserisci la tua password per confermare.',
  'passkeys.delete.confirmOnly':
    'Il tuo account non ha una password. Conferma di voler rimuovere questa chiave d’accesso.',
  'passkeys.delete.confirm': 'Rimuovi la chiave d’accesso',
  'passkeys.delete.cancel': 'Annulla',
  'passkeys.delete.wrongPassword': 'Questa password non è corretta.',
  'passkeys.delete.stale':
    'Per la tua sicurezza, rimuovere una chiave d’accesso richiede un accesso recente. Se scegli «Accedi di nuovo», la sessione corrente verrà chiusa e poi ti porteremo alla pagina di accesso.',
  'passkeys.delete.removed': 'Chiave d’accesso rimossa',
  'passkeys.delete.failed': 'La chiave d’accesso non è stata rimossa. Riprova.',
  'passkeys.delete.removing': 'Rimozione della chiave d’accesso',
  'passkeys.delete.passwordRequired':
    'Inserisci la tua password per rimuovere questa chiave d’accesso.',
  'workspace.departure.leave': 'Lascia lo spazio di lavoro',
  'workspace.departure.remove': 'Rimuovi membro',
  'workspace.departure.title': 'Terminare l’appartenenza a {workspace}?',
  'workspace.departure.body':
    '{name} perderà l’accesso a {workspace}. Il suo account e i viaggi e i registri dei costi conservati rimarranno.',
  'workspace.departure.cancel': 'Annulla',
  'workspace.departure.pending': 'Chiusura dell’appartenenza…',
  'workspace.departure.lastOwner':
    'Assegna il ruolo di proprietario a un altro membro prima di uscire o rimuovere questo proprietario.',
  'workspace.departure.notPermitted':
    'Il tuo ruolo attuale non consente di rimuovere questo membro. Aggiorna l’elenco dei membri prima di riprovare.',
  'workspace.departure.notFound':
    'Questa persona non è più membro di questo spazio di lavoro.',
  'workspace.departure.impersonated':
    'Interrompi la rappresentazione di un altro utente prima di modificare l’appartenenza allo spazio di lavoro.',
  'workspace.departure.failed':
    'Non è stato possibile confermare il risultato. Ricarica lo spazio di lavoro prima di riprovare.',
  'workspace.departure.removed': 'Membro rimosso',
  'workspace.departure.reload': 'Ricarica spazio di lavoro',
  'workspace.departure.activationFailed':
    'Hai lasciato questo spazio di lavoro. Apri il prossimo per continuare.',
  'workspace.departure.recover': 'Apri il prossimo spazio',
  'twoFactor.back': 'Torna alla sicurezza',
  'twoFactor.title': 'Autenticazione a due fattori',
  'twoFactor.description':
    'Aggiungi un secondo passaggio quando accedi con e-mail e password.',
  'twoFactor.error':
    'Non è stato possibile caricare le impostazioni dei due fattori.',
  'twoFactor.steps.label': 'Configura i due fattori',
  'twoFactor.steps.password': 'Conferma la tua identità',
  'twoFactor.steps.key': 'Aggiungila alla tua app di autenticazione',
  'twoFactor.steps.confirm': 'Inserisci un codice',
  'twoFactor.steps.state.done': 'Completato',
  'twoFactor.steps.state.current': 'Passaggio attuale',
  'twoFactor.steps.state.todo': 'Non iniziato',
  'twoFactor.password.label': 'La tua password',
  'twoFactor.password.hint':
    'La chiediamo di nuovo prima di cambiare il modo in cui accedi.',
  'twoFactor.password.submit': 'Continua',
  'twoFactor.password.pending': 'Configurazione in corso',
  'twoFactor.password.invalid': 'La password non è corretta.',
  'twoFactor.key.intro':
    'Serve un’app di autenticazione sul telefono. Aggiungi questa chiave e torna qui. I due fattori non sono ancora attivi.',
  'twoFactor.key.matrixLabel':
    'Codice di configurazione. La stessa chiave è disponibile come testo',
  'twoFactor.key.matrixFailed':
    'Non è stato possibile generare un codice per questa chiave. Inserisci la chiave di configurazione nella tua app.',
  'twoFactor.key.label': 'Chiave di configurazione',
  'twoFactor.key.copy': 'Copia chiave',
  'twoFactor.key.copied': 'Chiave copiata',
  'twoFactor.key.copyFailed':
    'Il browser non ha copiato la chiave. Selezionala e copiala manualmente.',
  'twoFactor.key.open': 'Apri nella tua app di autenticazione',
  'twoFactor.key.startOver': 'Ricomincia',
  'twoFactor.key.startOverHint':
    'Ricominciare crea una nuova chiave. Una chiave già aggiunta a un’app smetterà di funzionare.',
  'twoFactor.key.next': 'L’ho aggiunta',
  'twoFactor.code.label': 'Codice dell’app',
  'twoFactor.code.hint': 'Le sei cifre mostrate ora dall’app.',
  'twoFactor.code.submit': 'Attiva i due fattori',
  'twoFactor.code.pending': 'Verifica in corso',
  'twoFactor.code.invalid':
    'Il codice non corrisponde. Controlla l’ora sul telefono e inserisci il codice più recente dell’app.',
  'twoFactor.code.unclear':
    'Non sappiamo se l’operazione è riuscita. Inserisci il codice più recente per riprovare.',
  'twoFactor.rateLimited.title': 'Troppi tentativi ravvicinati',
  'twoFactor.rateLimited.password':
    'Attendi circa dieci secondi e riprova. I dati inseriti sono conservati.',
  'twoFactor.rateLimited.code':
    'Attendi fino a un minuto e riprova. I dati inseriti sono conservati.',
  'twoFactor.codes.title': 'I tuoi codici di riserva',
  'twoFactor.codes.body':
    'Ogni codice funziona una volta se perdi il telefono. Vengono mostrati solo ora: conservali al sicuro.',
  'twoFactor.codes.copyAll': 'Copia tutti',
  'twoFactor.codes.copied': 'Codici di riserva copiati',
  'twoFactor.codes.download': 'Scarica come file di testo',
  'twoFactor.codes.copyFailed':
    'Il browser non ha copiato i codici. Selezionali e copiali manualmente.',
  'twoFactor.codes.stored': 'Ho conservato questi codici di riserva',
  'twoFactor.codes.done': 'Fatto',
  'twoFactor.codes.gate': 'Seleziona la casella per continuare.',
  'twoFactor.codes.lost':
    'Se lasci prima questa pagina, puoi creare un nuovo gruppo qui e quello precedente smetterà di funzionare.',
  'twoFactor.codes.leave.title': 'Uscire senza conservare i codici?',
  'twoFactor.codes.leave.body':
    'I codici di riserva vengono mostrati una sola volta. Se esci ora, puoi crearne un nuovo gruppo qui e quello precedente smetterà di funzionare.',
  'twoFactor.codes.leave.stay': 'Resta qui',
  'twoFactor.codes.leave.go': 'Esci',
  'twoFactor.on.title': 'I due fattori sono attivi',
  'twoFactor.on.badge': 'Attivi',
  'twoFactor.on.body':
    'Chiediamo un codice dall’app quando accedi con e-mail e password, a meno che questo browser sia attendibile. L’accesso con Google, Apple o una passkey non richiede un codice.',
  'twoFactor.replace.action': 'Sostituisci i codici di riserva',
  'twoFactor.replace.title': 'Sostituire i tuoi codici di riserva?',
  'twoFactor.replace.body':
    'Riceverai un nuovo gruppo. Quello attuale smetterà di funzionare appena continui.',
  'twoFactor.replace.confirm': 'Sostituisci',
  'twoFactor.replace.pending': 'Sostituzione in corso',
  'twoFactor.nopassword.title': 'Prima imposta una password',
  'twoFactor.nopassword.body':
    'I due fattori richiedono una password per questo account. La pagina seguente chiede l’e-mail e invia un link per impostarla. Verrai disconnesso ovunque. Accedi di nuovo e torna qui.',
  'twoFactor.nopassword.action': 'Imposta una password',
  'twoFactor.setup.action': 'Mostra di nuovo la chiave di configurazione',
  'twoFactor.setup.title': 'Chiave di configurazione',
  'twoFactor.setup.body':
    'Aggiungi questa chiave su un altro dispositivo. La chiave sugli altri dispositivi continuerà a funzionare.',
  'twoFactor.setup.done': 'Fatto',
  'twoFactor.setup.confirm': 'Mostra chiave',
  'twoFactor.setup.pending': 'Verifica in corso',
  'twoFactor.off.action': 'Disattiva l’autenticazione a due fattori',
  'twoFactor.off.title': 'Disattivare l’autenticazione a due fattori?',
  'twoFactor.off.body':
    'Chiunque conosca la tua password potrà accedere senza un codice. Gli altri dispositivi connessi resteranno connessi.',
  'twoFactor.off.confirm': 'Disattiva',
  'twoFactor.off.pending': 'Disattivazione',
  'twoFactor.off.cancel': 'Mantieni attiva',
  'twoFactor.off.done': 'L’autenticazione a due fattori è disattivata',
} satisfies TranslationOf<typeof En>

export default messages
