/**
 * The public pages' copy, in it.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Tipografia.** L’italiano cita con «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Inizia gratis',
  'action.signIn': 'Accedi',
  'action.pricing': 'Prezzi',
  'action.seePricing': 'Vedi i prezzi',
  'action.skipToContent': 'Vai al contenuto',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — home',
  'nav.onThisPage': 'In questa pagina',
  'anchor.planner': 'Pianificatore',
  'anchor.modules': 'Moduli',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Rilascia sul giorno {day}',
  'legal.summaryNote':
    'Il riassunto è lì per essere letto. Quello che si applica davvero è sotto.',
  'visual.daysTravelled': 'Giorni in viaggio',
  'visual.acrossEveryTrip': 'su tutti i viaggi',
  'visual.mapFilled': '{percent}% della mappa completata',
  'visual.previewSummary':
    'Un’anteprima della bacheca di planned.travel: il prossimo viaggio con le date, i viaggiatori e il numero di luoghi; i totali di paesi visitati, viaggi e giorni in viaggio; una mappa del percorso; e le prossime due prenotazioni.',
  'visual.placesMapped': {
    one: '{value} luogo sulla mappa',
    many: '{value} luoghi sulla mappa',
    other: '{value} luoghi sulla mappa',
  },
  'visual.splitWays': {
    one: 'non diviso',
    many: 'diviso tra {value}',
    other: 'diviso tra {value}',
  },
  'visual.tripTotal': 'Totale del viaggio',
  'visual.paidSplit': 'ha pagato {who} · {split}',
  'visual.nextUp': 'Prossimo',
  'visual.ofTotal': '{done} di {total}',
  'visual.awaitingReply': 'In attesa di risposta',
  'visual.upcoming': 'In arrivo',
  'visual.days': {
    one: '{value} giorno',
    many: '{value} giorni',
    other: '{value} giorni',
  },
  'visual.places': {
    one: '{value} luogo',
    many: '{value} luoghi',
    other: '{value} luoghi',
  },
  'visual.transfersLeft': {
    one: 'resta {value} bonifico',
    many: 'restano {value} bonifici',
    other: 'restano {value} bonifici',
  },

  'legal.badge.version': 'Versione {version}',
  'legal.badge.effective': 'In vigore dal {updated}',
  'legal.notice.title': 'Questo è un modello, non una consulenza legale',
  'legal.notice.body':
    'È scritto in inglese semplice per essere un punto di partenza davvero utile per un piccolo servizio di organizzazione viaggi, e ogni lacuna che un’azienda deve colmare è evidenziata. Fallo esaminare e adattare da un legale qualificato nella tua giurisdizione prima di accettare un solo cliente. Niente qui afferma una certificazione, una verifica o uno standard di conformità che planned.travel possieda.',
  'legal.contents': 'Indice',
  'legal.shortVersion': 'La versione breve',
  'legal.both': 'I due documenti si applicano insieme.',

  'landing.plans.title': 'Inizia gratis. Paga solo quando se lo merita.',
  'landing.plans.lede':
    'Ogni piano include il programma giornaliero, la mappa, i budget e le liste per la valigia. I piani a pagamento - da {price} al mese - sbloccano viaggi illimitati, prenotazioni, il diario, le mappe offline e gli export.',
  'landing.plans.ledeFree':
    'Ogni piano include il programma giornaliero, la mappa, i budget e le liste per la valigia. I piani a pagamento sbloccano viaggi illimitati, prenotazioni, il diario, le mappe offline e gli export.',
  'landing.plans.compare': 'Confronta ogni limite, riga per riga',
  'landing.questions.title': 'Domande, risposte senza giri',
  'landing.questions.lede':
    'Le sei cose che le persone vogliono davvero sapere prima di iniziare.',
  'cta.heading':
    'Il tuo prossimo viaggio merita già di essere organizzato bene',
  'cta.lede':
    'Due viaggi, tutta la mappa, l’itinerario e le liste per la valigia: gratis, senza carta e senza conto alla rovescia.',
  'landing.faq.seats.q': 'Anche le persone con cui viaggio devono pagare?',
  'landing.faq.seats.a':
    'No. Tutti quelli che inviti in uno spazio di lavoro {crew} sono coperti dai suoi posti. Accedono con il proprio account e vedono solo i viaggi a cui li hai aggiunti.',
  'landing.faq.phone.q': 'Funziona bene sul telefono?',
  'landing.faq.phone.a':
    'Sì. I layout per telefono sono disegnati a parte, non compressi da quelli per desktop, ed è un sito web: non c’è niente da installare né da tenere aggiornato.',
  'landing.faq.offline.q': 'Posso usare la mappa senza segnale?',
  'landing.faq.offline.a':
    'Con {solo} e {crew} puoi scaricare una regione prima di partire, così la mappa si disegna anche quando atterri senza dati. Modificare il viaggio richiede una connessione.',
  'landing.faq.privacy.q': 'Chi può vedere il mio viaggio?',
  'landing.faq.privacy.a':
    'Un viaggio appartiene a un solo spazio di lavoro, e solo le persone invitate in quello spazio possono aprirlo. Niente è pubblico, non esiste alcun feed di scoperta e per impostazione predefinita niente viene condiviso con nessuno.',
  'landing.faq.stop.q': 'Cosa succede ai miei viaggi se smetto di pagare?',
  'landing.faq.stop.a':
    'Niente viene eliminato. I moduli a pagamento si bloccano, i tuoi viaggi restano esattamente dove sono e tutto si sblocca nel momento in cui ti abboni. {free} resta gratuito, senza conto alla rovescia.',

  'action.startPlanning': 'Inizia a organizzare gratis',
  'cta.comparePlans': 'Confronta i piani',
  'landing.hero.eyebrow': 'Organizzazione di viaggi in gruppo',
  'landing.hero.title': 'Organizza il viaggio.',
  'landing.hero.titleQuiet': 'Non il foglio di calcolo.',
  'landing.hero.lede':
    'Un itinerario su una mappa vera, condiviso dal vivo con tutti quelli che partono - con le prenotazioni, i soldi e la lista per la valigia attaccati.',
  'landing.hero.secondary': 'Guarda quanto costa',
  'landing.trust.noCard': 'Nessuna carta per iniziare',
  'landing.trust.noAds': 'Nessuna pubblicità, nessun link di affiliazione',
  'landing.trust.export': 'Esporta tutto, quando vuoi',

  'proof.eyebrow': 'Risposte dirette',
  'proof.title':
    'Nessuna testimonianza, perché non ce le siamo ancora meritate',
  'proof.lede':
    'planned.travel è nuovo. Invece di inventare una citazione o prendere in prestito il logo di qualcuno, qui c’è esattamente cosa fa, per chi è e cosa non ti farà mai.',
  'proof.who.label': 'Per chi è',
  'proof.who.heading': 'Per chi finisce per fare il foglio di calcolo',
  'proof.who.body':
    'Coppie, famiglie e gruppi di amici che vogliono un piano che vedano tutti, invece di sei screenshot, tre chat di gruppo e una nota condivisa che nessuno apre da marzo.',
  'proof.not.label': 'Cosa non è',
  'proof.not.heading':
    'Non è un sito di prenotazioni, e non è in vendita a uno',
  'proof.not.body':
    'Non prendiamo commissioni, non abbiamo pubblicità e non mettiamo link di affiliazione, quindi niente su una pagina ti spinge di nascosto verso un hotel in particolare. Ci paghi tu, quindi lavoriamo per te.',
  'proof.where.label': 'Dove stanno le tue cose',
  'proof.where.heading': 'Su Cloudflare, nel tuo spazio di lavoro',
  'proof.where.body':
    'I viaggi stanno in un database limitato al tuo spazio di lavoro e i file nel nostro archivio di oggetti, entrambi serviti dall’edge di Cloudflare. Polar, il nostro venditore ufficiale, gestisce il pagamento ed emette la fattura, così il numero della tua carta non arriva mai a noi.',
  'proof.promise.ads.title': 'Nessuna pubblicità, nessuna analisi di terzi',
  'proof.promise.ads.body':
    'Niente in questa pagina ti sta misurando per qualcun altro.',
  'proof.promise.sold.title':
    'I tuoi viaggi non vengono mai venduti né affittati',
  'proof.promise.sold.body':
    'Non agli inserzionisti, non alle aziende di viaggi, a nessuno.',
  'proof.promise.leave.title': 'Vai via quando vuoi, portando tutto',
  'proof.promise.leave.body':
    'Itinerari PDF, file di calendario e i tuoi luoghi in GeoJSON.',
  'proof.certification':
    'Oggi non abbiamo nessuna certificazione di sicurezza, e non lasceremo credere il contrario. Quando planned.travel sarà verificato rispetto a uno standard, qui scriveremo lo standard, il revisore e la data - non prima.',

  'feature.modules.title': 'Il resto del viaggio, sistemato',
  'feature.modules.lede':
    'Ogni modulo fa bene una cosa sola e passa il suo lavoro agli altri. Qui non c’è nessuna scheda segnaposto in attesa di una versione futura.',
  'feature.module.lists.benefit': 'Nessuno arriva senza l’adattatore.',
  'feature.module.lists.detail':
    'Valigia, cose da fare, spesa e documenti: un elenco per compito, condiviso con tutti quelli che partono e spuntato mentre succede.',
  'feature.module.journal.name': 'Diario',
  'feature.module.journal.benefit':
    'Il viaggio diventa un racconto, non una cartella.',
  'feature.module.journal.detail':
    'Voci in ordine di data con le foto che hai scattato, dov’eri, il meteo e com’è andata davvero la giornata.',
  'feature.module.atlas.benefit': 'Una mappa di ogni posto in cui sei stato.',
  'feature.module.atlas.detail':
    'Segna un paese come visitato ed entra nella tua mappa del mondo, con la prima visita, la più recente e quante volte ci sei tornato.',
  'feature.module.vacay.benefit': 'Chiedi le ferie prima di prenotare il volo.',
  'feature.module.vacay.detail':
    'Segna i giorni in cui sei via e l’anno si riempie: weekend, festività e le ferie di tutti gli altri nella stessa griglia.',
  'feature.module.collab.benefit': 'Le decisioni restano con il viaggio.',
  'feature.module.collab.detail':
    'Una conversazione per viaggio, note condivise per le cose che tutti devono ricordare e un sondaggio per quando il gruppo non si accorda sulla cena.',
  'feature.module.files.benefit': 'Le carte d’imbarco dove riesci a trovarle.',
  'feature.module.files.detail':
    'Conferme, biglietti, polizze e ricevute allegate al viaggio a cui appartengono, non sepolte in una casella di posta.',

  'feature.planner.title':
    'Un programma giorno per giorno disegnato su una mappa vera',
  'feature.planner.lede':
    'Raccogli i luoghi che vuoi vedere, poi trascinali su un giorno. La mappa ridisegna il percorso mentre lavori, così vedi subito quando una mattina ti fa attraversare la città due volte.',
  'feature.planner.point.days':
    'Una colonna per giorno, con la data, il meteo e il posto in cui dormi.',
  'feature.planner.point.unscheduled':
    'I luoghi senza data aspettano nella loro colonna finché non hanno un giorno.',
  'feature.planner.point.crew':
    'Con {crew} trascinano tutti insieme: cursori dal vivo, sincronizzazione istantanea, nessun ricaricamento.',
  'feature.planner.point.tiles':
    'Tasselli vettoriali serviti dal nostro archivio, così nessun fornitore di mappe guarda come organizzi.',
  'feature.costs.title': 'Spese condivise che si chiudono davvero',
  'feature.costs.lede':
    'Registra quello che spendi nella valuta del viaggio, dividi ogni spesa come vi siete accordati davvero e guarda la serie di bonifici più corta che chiude tutto.',
  'feature.costs.point.split':
    'In parti uguali, per quota o all’importo esatto: per spesa, non per viaggio.',
  'feature.costs.point.currency':
    'Tutto convertito in una sola valuta di viaggio, così il totale significa qualcosa.',
  'feature.costs.point.settle':
    'La vista di pareggio dice chi paga chi e registra il bonifico appena avviene.',
  'feature.costs.point.receipt':
    'Allega la ricevuta alla spesa, così la cifra ha sempre la sua prova.',
  'feature.book.title':
    'Ogni prenotazione, con il codice che ti serve all’ingresso',
  'feature.book.lede':
    'Alloggi, tavoli, visite e biglietti in un unico elenco, accanto ai voli, ai treni e ai traghetti che ti portano da uno all’altro: ognuno con il numero di conferma e il giorno a cui appartiene.',
  'feature.book.point.legs':
    'Le tratte portano il posto, il binario, il terminal e il codice di prenotazione.',
  'feature.book.point.day':
    'Una prenotazione è legata a un giorno, quindi compare nel programma senza riscriverla.',
  'feature.book.point.states':
    'Richiesta, confermata e annullata sono stati distinti, non una nota in un campo.',
  'feature.book.point.export':
    'Esporta tutto il viaggio come itinerario PDF o file di calendario prima di partire.',

  'pricing.faq.trial.q': 'Cosa succede quando finisce la prova?',
  'pricing.faq.trial.a':
    'La prova si trasforma nel piano a pagamento. Polar registra un metodo di pagamento all’inizio della prova e lo addebita il giorno in cui la prova finisce, quindi se disdici prima non paghi nulla. In nessun caso viene cancellato qualcosa: i moduli a pagamento si bloccano, i tuoi viaggi restano esattamente dove sono e tutto si sblocca nel momento in cui ti abboni.',
  'pricing.faq.seller.q': 'Da chi sto comprando in realtà?',
  'pricing.faq.seller.a':
    'Da Polar. È il nostro rivenditore ufficiale: ti vende l’abbonamento come reseller, incassa il pagamento, emette la fattura a proprio nome e determina, riscuote e versa l’imposta sulle vendite o l’IVA che chiede il tuo paese. Rimborsi e contestazioni della carta si risolvono con loro. Il servizio lo mandiamo avanti noi, e siamo noi a rispondere alle tue email.',
  'pricing.faq.change.q': 'Posso cambiare piano a metà di un viaggio?',
  'pricing.faq.change.a':
    'Sì. I passaggi a un piano superiore valgono subito e sono calcolati al giorno; quelli a un piano inferiore scattano alla fine del periodo che hai già pagato, così non perdi mai un accesso che hai pagato.',
  'pricing.faq.seats.q': 'Come funziona la fatturazione per persona su {crew}?',
  'pricing.faq.seats.a':
    'Paghi i posti che occupi davvero, e puoi cambiare il numero in qualsiasi momento. Gli inviti in sospeso contano sui tuoi posti, così uno spazio non supera mai il piano di nascosto.',
  'pricing.faq.guests.q':
    'Chi viaggia con me ha bisogno di un abbonamento proprio?',
  'pricing.faq.guests.a':
    'No. Chiunque inviti in uno spazio di lavoro {crew} è coperto dai suoi posti. Accede con il proprio account e vede i viaggi ai quali è stato aggiunto.',
  'pricing.faq.storage.q': 'Cosa conta per lo spazio?',
  'pricing.faq.storage.a':
    'Fotografie, biglietti, conferme e qualunque file alleghi a un viaggio. Le tessere della mappa e l’app stessa non contano mai. Nelle Impostazioni vedi esattamente cosa occupa spazio.',
  'pricing.faq.export.q': 'Posso riprendermi i miei dati?',
  'pricing.faq.export.a':
    'Sempre. Ogni viaggio si esporta come itinerario PDF e come file di calendario, e i tuoi luoghi come GeoJSON. Sono i tuoi viaggi, non i nostri.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Nessuna carta, nessuna scadenza, nessun countdown',
  'pricing.card.yearlyPerSeat':
    '{amount} all’anno per persona, addebitati una volta',
  'pricing.card.yearly': '{amount} addebitati una volta all’anno',
  'pricing.card.seatsUnlimited': 'Membri illimitati',
  'pricing.card.tripsUnlimited': 'viaggi illimitati',
  'pricing.card.startFree': 'Comincia gratis',
  'pricing.card.startTrial': 'Prova {plan}',
  'pricing.card.popular': 'Il più scelto',
  'pricing.card.noteYearly':
    'Addebitato una volta all’anno. Due mesi li offriamo noi.',
  'pricing.card.noteMonthly':
    'Addebitato al mese. Cambi o disdici quando vuoi.',
  'pricing.card.trial': {
    one: '{value} giorno di prova, carta in anticipo, addebito alla fine',
    many: '{value} giorni di prova, carta in anticipo, addebito alla fine',
    other: '{value} giorni di prova, carta in anticipo, addebito alla fine',
  },
  'pricing.card.seatsUpTo': {
    one: 'Fino a {value} membro',
    many: 'Fino a {value} membri',
    other: 'Fino a {value} membri',
  },
  'pricing.card.trips': {
    one: '{value} viaggio alla volta',
    many: '{value} viaggi alla volta',
    other: '{value} viaggi alla volta',
  },

  'pricing.feature.storage': '{size} per foto e documenti',
  'pricing.feature.storageShared': '{size} condivisi per foto e documenti',
  'pricing.feature.free.tripsDetail': 'Archivia uno per iniziarne un altro',
  'pricing.feature.solo.modules': 'Tutti i moduli di pianificazione',
  'pricing.feature.solo.modulesDetail': 'Prenotazioni, diario, budget, valigia',
  'pricing.feature.solo.offlineDetail': 'Scarica le regioni prima di partire',
  'pricing.feature.crew.membersDetail':
    'Fatturato per membro, modificabile quando vuoi',
  'pricing.feature.crew.realtimeDetail':
    'Cursori dal vivo e sincronizzazione istantanea',
  'pricing.feature.crew.supportDetail':
    'Risposta di una persona entro un giorno lavorativo',

  'pricing.hero.eyebrow': 'Due viaggi gratis, per sempre',
  'pricing.hero.title': 'Pianifica come si deve.',
  'pricing.hero.titleQuiet': 'Paga quello che usi.',
  'pricing.hero.lede':
    'Pianifica due viaggi gratis. Sblocca ogni modulo per un viaggiatore, o porta tutto il gruppo e modificate lo stesso itinerario insieme.',
  'pricing.hero.taxNote':
    'Prezzi in dollari statunitensi, esclusa imposta sulle vendite o IVA. Polar è il nostro rivenditore ufficiale: è lui che compare in fattura, calcola quanto chiede il tuo paese, lo aggiunge al pagamento e lo versa. Disdici quando vuoi, dal prodotto.',
  'pricing.compare.eyebrow': 'Fianco a fianco',
  'pricing.compare.title': 'Ogni limite, a confronto',
  'pricing.compare.lede':
    'Una tabella, generata dallo stesso catalogo che legge la fatturazione. Se una riga dice che un modulo è incluso, il controllo dei diritti è d’accordo.',
  'pricing.compare.caption':
    'Confronto di funzioni e limiti su tutti e tre i piani',
  'pricing.compare.feature': 'Funzione',
  'pricing.compare.limits': 'Limiti',
  'pricing.compare.included': 'Incluso',
  'pricing.compare.notIncluded': 'Non incluso',
  'pricing.compare.includedIn': 'Incluso in {plan}',
  'pricing.compare.notIn': 'Non in {plan}',
  'pricing.questions.eyebrow': 'Prima che tu chieda',
  'pricing.questions.title': 'Domande, con risposta',
  'pricing.questions.lede':
    'Fatturazione, prove e come riprenderti i tuoi dati.',
  'pricing.cta.secondary': 'Guarda come funziona',
  'pricing.module.itinerary': 'Itinerario giorno per giorno',
  'pricing.module.map': 'Mappa interattiva',
  'pricing.module.budget': 'Budget e divisione delle spese',
  'pricing.module.packing': 'Liste da preparare e da fare',
  'pricing.module.reservations': 'Prenotazioni',
  'pricing.module.journal': 'Diario di viaggio',
  'pricing.module.atlas': 'Mappa dei paesi visitati',
  'pricing.module.collaboration': 'Invita altri viaggiatori',
  'pricing.module.realtime': 'Collaborazione in tempo reale',
  'pricing.module.offlineMaps': 'Mappe offline',
  'pricing.module.pdfExport': 'Esportazione PDF e calendario',
  'pricing.module.prioritySupport': 'Supporto prioritario',

  'anchor.plans': 'Piani',
  'anchor.compare': 'Confronto',
  'anchor.questions': 'Domande',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Un unico posto per l’itinerario, la mappa, le prenotazioni, i soldi e la lista del bagaglio — condiviso con tutti quelli che partono.',
  'footer.attribution':
    'Gira su Cloudflare Workers. Dati cartografici © i collaboratori di OpenStreetMap. Vendita e fatturazione a cura di Polar, il nostro rivenditore ufficiale.',
  'footer.column.product': 'Prodotto',
  'footer.column.account': 'Profilo',
  'footer.link.overview': 'Panoramica',
  'footer.link.everyModule': 'Tutti i moduli',
  'footer.link.dayPlanner': 'Pianificatore giornaliero',
  'footer.link.sharedCosts': 'Spese condivise',
  'footer.link.reservations': 'Prenotazioni',
  'footer.link.atlasJournal': 'Atlante e diario',
  'footer.link.createAccount': 'Crea un account',
  'footer.link.terms': 'Termini di servizio',
  'footer.link.privacy': 'Informativa sulla privacy',
} satisfies TranslationOf<typeof En>

export default messages
