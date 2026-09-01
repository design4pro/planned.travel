/**
 * The world tracker and the map chrome, in Italian.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** «Mappa del mondo» for the atlas module — the words
 * `it/shell.ts` already uses for `nav.atlas` — «viaggio» for a trip and «lista
 * dei desideri» for the bucket list. The traveller's log of visits is «il tuo
 * registro», one word chosen once and kept through the search, the stats and
 * the write actions. The address is «tu» throughout, matching the rest of the
 * catalogue.
 *
 * **Plural.** `Intl.PluralRules('it')` reports `one`, `many` and `other`;
 * `many` covers the million-scale round numbers and reads like `other`, the
 * same three branches the rest of the Italian catalogue writes.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Italian uses, and the parity suite exempts them
 * structurally. Italian spells three continents exactly as English does, so
 * `continent.africa` and `continent.asia` take the «Continente …» form and
 * `continent.oceania` the school-atlas grouping «Australia e Oceania», rather
 * than tripping the untranslated check with homographs.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Mappa del mondo. Nessun paese ancora segnato come visitato.',
  'screen.world.summary':
    'Mappa del mondo con {visited} paesi su {total} segnati come visitati.',
  'screen.error.title': 'La mappa del mondo non si è caricata',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Caricamento della mappa',
  'map.controls.label': 'Comandi della mappa',
  'map.controls.zoomIn': 'Ingrandisci',
  'map.controls.zoomOut': 'Riduci',
  'map.controls.north': 'Orienta a nord',
  'map.controls.locate': 'Trova la mia posizione',
  'map.controls.locateFailed':
    'Non siamo riusciti a ottenere la tua posizione.',
  'map.controls.locateFailedBody':
    'Controlla che l’accesso alla posizione sia consentito per questo sito, poi riprova.',

  'map.attribution.label': 'Dati della mappa di',

  'map.basemap.title': 'Mappa di base non disponibile',
  'map.basemap.body':
    'Il dettaglio delle strade è offline. Ogni luogo resta mostrato nella sua posizione reale, quindi distanze e raggruppamenti restano esatti.',
  'map.basemap.credit': 'Linee di costa di',
  'map.basemap.retry': 'Riprova',
  'map.basemap.retrying': 'Verifica della mappa di base',

  'map.engine.unsupported.title': 'Resa della mappa non disponibile',
  'map.engine.unsupported.body':
    'Questo browser non può eseguire la mappa interattiva: serve WebGL2, e qui non c’è nessun contesto WebGL2 disponibile. Nient’altro su questa schermata ne dipende.',
  'map.engine.stalled.title': 'La mappa non ha ancora disegnato nulla',
  'map.engine.stalled.body':
    'Non è apparso nulla nel tempo concesso alla mappa per partire. Potrebbe ancora riprendersi da sola; nient’altro su questa schermata ne dipende.',

  'map.coverage.partial.title': 'Dettaglio delle strade parziale',
  'map.coverage.partial.body': {
    one: 'I dati pubblicati della mappa non arrivano a {outside} luogo di questo viaggio. È disegnato nella sua posizione reale sulle nostre linee di costa.',
    many: 'I dati pubblicati della mappa non arrivano a {outside} luoghi di questo viaggio. Sono disegnati nelle loro posizioni reali sulle nostre linee di costa.',
    other:
      'I dati pubblicati della mappa non arrivano a {outside} luoghi di questo viaggio. Sono disegnati nelle loro posizioni reali sulle nostre linee di costa.',
  },
  'map.coverage.none.title': 'Qui nessun dettaglio delle strade',
  'map.coverage.none.body':
    'Le strade non sono ancora pubblicate per questa regione. Le linee di costa, i segnaposto e i percorsi che li collegano sono tutti reali — mancano solo edifici e strade.',
  'map.coverage.dismiss': 'Chiudi la nota sulla copertura della mappa',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': 'Comprimi {title}',
  'map.legend.expand': 'Espandi {title}',
  'map.legend.dayPin': 'Esempio di segnaposto di giornata',
  'map.legend.dayPinMeaning': 'Giorno dell’itinerario',
  'map.legend.clusterPin': 'Esempio di segnaposto raggruppato',
  'map.legend.clusterPinMeaning': 'Luoghi raggruppati',

  'map.filter.label': 'Filtra i luoghi per categoria',
  'map.filter.all': 'Tutti',
  'map.filter.category': {
    one: '{name} · {places} luogo',
    many: '{name} · {places} luoghi',
    other: '{name} · {places} luoghi',
  },

  'map.pin.day': 'Giorno {day}',
  'map.pin.cluster': {
    one: '{places} luogo — ingrandisci per isolarlo',
    many: '{places} luoghi — ingrandisci per separarli',
    other: '{places} luoghi — ingrandisci per separarli',
  },

  'map.place.rating': 'Valutato {rating} su {max}',
  'map.place.clause.day': 'giorno {day}',
  'map.place.clause.rating': 'valutato {rating} su {max}',
  'map.place.clause.visited': 'visitato',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Ultima visita',
  'legend.recent': {
    one: 'Nell’ultimo anno',
    many: 'Negli ultimi {years} anni',
    other: 'Negli ultimi {years} anni',
  },
  'legend.middle': '{from}–{to} anni fa, o senza data',
  'legend.distant': {
    one: 'Più di {years} anno fa',
    many: 'Più di {years} anni fa',
    other: 'Più di {years} anni fa',
  },
  'legend.unvisited': 'Non ancora visitato',
  'legend.note':
    'La tinta mostra solo quanto è recente — la scheda Paese scrive ogni data per esteso.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Copertura del mondo',
  'panel.coverage.unit': 'su {total}',
  'panel.coverage.caption': '{share} del mondo · {visits}',
  'panel.progress.label': 'Verso ogni paese del mondo',
  'panel.progress.remaining': 'Ancora {remaining}',
  'panel.toggle.hide': 'Nascondi i dettagli della mappa del mondo',
  'panel.toggle.show': 'Mostra i dettagli della mappa del mondo',
  'panel.tabs.label': 'Sezioni della mappa del mondo',
  'panel.tab.country': 'Paese',
  'panel.tab.stats': 'Statistiche',
  'panel.tab.bucket': 'Lista dei desideri',
  'panel.back': 'Tutti i paesi',
  'panel.list.label': 'Paesi visitati',
  'panel.loading': 'Caricamento della tua mappa del mondo',

  'panel.empty.blank.title': 'La tua mappa è ancora vuota',
  'panel.empty.blank.body':
    'Segna un paese come visitato e si colora qui sulla mappa, con la prima e l’ultima visita, quante volte ci sei stato e tutto quello che ci hai scritto.',
  'panel.empty.pick.title': 'Scegli un paese',
  'panel.empty.pick.body':
    'Scegline uno sulla mappa, nel campo di ricerca o nell’elenco, e la sua scheda completa si apre qui — prima visita, ultima visita, il conteggio e la tua nota.',

  'panel.stat.places': 'Luoghi',
  'panel.stat.placesNone': 'Ancora nulla fissato su un viaggio',
  'panel.stat.placesCaption': 'Attrazioni, alloggi e tappe salvati',
  'panel.stat.regions': 'Regioni',
  'panel.stat.regionsNone': 'Nessuna regione ancora segnata',
  'panel.stat.regionsCaption': 'Stati, province, prefetture',
  'panel.stat.visits': 'Visite',
  'panel.stat.visitsCaption': 'Ogni arrivo registrato',
  'panel.stat.trips': 'I tuoi viaggi',
  'panel.stat.tripsCaption': 'Tutti i viaggi a cui partecipi',
  'panel.stat.cities': 'Città',
  'panel.stat.citiesCaption': 'Città dove hai dormito o fatto tappa',
  'panel.stat.days': 'Giorni in viaggio',
  'panel.stat.daysCaption': 'Su tutti i viaggi del tuo registro',
  'panel.continents.label': 'Paesi per continente',

  'panel.bucket.empty.title': 'Niente in lista',
  'panel.bucket.empty.body':
    'Quel posto dove hai sempre voluto andare. Aggiungilo, e spuntalo quando ci arrivi.',
  'panel.bucket.label': 'Lista dei desideri',
  'panel.bucket.progress': '{done} su {total} spuntati',
  'panel.bucket.done': 'Fatti',
  'panel.bucket.toGo': 'Da fare',
  'panel.bucket.target': 'entro il {year}',
  'panel.bucket.hidden': {
    one: 'Ancora {entries} voce in lista, non mostrata qui.',
    many: 'Ancora {entries} voci in lista, non mostrate qui.',
    other: 'Ancora {entries} voci in lista, non mostrate qui.',
  },
  'panel.bucket.kind.country': 'Paese',
  'panel.bucket.kind.region': 'Regione',
  'panel.bucket.kind.place': 'Luogo',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Continente africano',
  'continent.antarctica': 'Antartide',
  'continent.asia': 'Continente asiatico',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'America del Nord',
  'continent.oceania': 'Australia e Oceania',
  'continent.southAmerica': 'America del Sud',
  'continent.unknown': 'Continente non registrato',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visitato',
  'record.firstVisit': 'Prima visita',
  'record.lastVisit': 'Ultima visita',
  'record.visitDates': 'Date delle visite',
  'record.notRecorded': 'Non registrato',
  'record.datesUnrecorded': 'Date non registrate',
  'record.visits': {
    one: '{visits} visita',
    many: '{visits} visite',
    other: '{visits} visite',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Prima visita {from}',
  'record.spanTo': 'Ultima visita {to}',
  'record.visitsUnit': { one: 'visita', many: 'visite', other: 'visite' },
  'record.gap.days': {
    one: 'a {gap} giorno di distanza',
    many: 'a {gap} giorni di distanza',
    other: 'a {gap} giorni di distanza',
  },
  'record.gap.months': {
    one: 'a {gap} mese di distanza',
    many: 'a {gap} mesi di distanza',
    other: 'a {gap} mesi di distanza',
  },
  'record.gap.years': {
    one: 'a {gap} anno di distanza',
    many: 'a {gap} anni di distanza',
    other: 'a {gap} anni di distanza',
  },
  'record.note.empty': 'Ancora nessuna nota',
  'record.noOutline':
    'I contorni del mondo che questa mappa disegna sono tagliati a 1:110m, una scala che accorpa questo territorio allo stato a cui fa capo — quindi sulla mappa non c’è nulla da inquadrare. La visita conta lo stesso.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordina i paesi',
  'list.sort.code': 'Codice del paese',
  'list.sort.codeStatement': 'In ordine di codice del paese, dalla A alla Z.',
  'list.sort.name': 'Nome del paese',
  'list.sort.nameStatement':
    'In ordine di nome del paese, dalla A alla Z, poi di codice.',
  'list.sort.recent': 'Visita più recente',
  'list.sort.recentStatement':
    'Prima la visita più recente, poi il codice del paese.',
  'list.sort.visits': 'Più visite',
  'list.sort.visitsStatement':
    'Prima il maggior numero di visite, poi il codice del paese.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Accorpato allo stato a cui fa capo dai contorni del mondo, quindi sulla mappa non c’è nulla da inquadrare.',
  'list.announce.selected': '{name} selezionato.',
  'list.announce.selectedUnframed': '{name} selezionato. {reason}',
  'list.empty.title': 'Ancora nessun paese sulla mappa',
  'list.empty.body':
    'Un paese compare qui non appena una visita viene registrata, con il primo arrivo, il più recente e quante volte ci sei stato.',
  'list.loading': 'Caricamento dei paesi visitati',
  'list.error.title': 'I tuoi paesi non si sono caricati',
  'list.error.body':
    'La mappa del mondo non è riuscita a leggere i tuoi paesi visitati in questo momento. Non è andato perso nulla — sono ancora registrati.',
  'list.error.retry': 'Riprova',
  'list.error.retrying': 'Caricamento dei tuoi paesi',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Trova un paese',
  'search.loading': 'Caricamento dei tuoi paesi',
  'search.placeholder': 'Nome del paese o codice',
  'search.entry.notVisited': 'Non ancora visitato',
  'search.entry.noOutline': 'nessun contorno sulla mappa',
  'search.entry.separator': ' · ',
  'search.cleared': 'Selezione annullata.',
  'search.unframed':
    '{name} non ha un contorno alla scala del mondo, quindi la mappa non ha nulla da inquadrare.',
  'search.unframedVisited':
    '{name} non ha un contorno alla scala del mondo, quindi la mappa non ha nulla da inquadrare. La sua scheda non ne risente.',
  'search.results.empty':
    'Ancora nessun paese nel tuo registro. Digita per cercare tra tutti i paesi del mondo.',
  'search.results.emptyPinned':
    '{name} è selezionato. Ancora nessun paese nel tuo registro — digita per cercare tra tutti i paesi del mondo.',
  'search.results.record': {
    one: '{countries} paese nel tuo registro.',
    many: '{countries} paesi nel tuo registro.',
    other: '{countries} paesi nel tuo registro.',
  },
  'search.results.capped': 'Sono mostrati i primi {shown}.',
  'search.results.pinned': '{name} è selezionato e compare per primo.',
  'search.results.none': 'Nessun paese corrisponde a {term}.',
  'search.results.matches': {
    one: '{countries} paese corrisponde a {term}.',
    many: '{countries} paesi corrispondono a {term}.',
    other: '{countries} paesi corrispondono a {term}.',
  },
  'search.announce.selected': '{name} selezionato.',
  'search.announce.framing': '{name} selezionato. La mappa lo sta inquadrando.',
  'search.announce.unframed': '{name} selezionato. {reason}',
  'search.empty.title': 'Ancora niente nel tuo registro',
  'search.empty.body':
    'Digita il nome di un paese, o il suo codice di due lettere, per trovarlo sulla mappa.',
  'search.empty.noMatchTitle': 'Nessun paese corrisponde a «{term}»',
  'search.empty.noMatchBody':
    'Controlla come l’hai scritto, o prova con il codice di due lettere — PT trova il Portogallo. Tutti i {countries} paesi si possono cercare, che tu ci sia stato o no.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Il tuo registro',
  'actions.visit.absent.title': 'Non visitato',
  'actions.visit.absent.caption': 'Una visita senza un viaggio alle spalle.',
  'actions.visit.title': 'Visitato',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Non in lista',
  'actions.goal.absent.caption': 'Un posto dove conti di andare.',
  'actions.goal.title': 'Nella lista dei desideri',
  'actions.goal.waiting': 'Aspetta il suo turno.',
  'actions.goal.target': 'Puntando al {year}.',
  'actions.goal.achieved.title': 'Spuntato dalla lista',
  'actions.goal.achieved.caption':
    'Ci sei arrivato. La voce resta come ricordo.',

  'actions.button.remove': 'Rimuovi',
  'actions.button.mark': 'Segna come visitato',
  'actions.button.add': 'Aggiungi alla lista',
  'actions.visit.remove.name': 'Rimuovi {name} dalla tua mappa del mondo',
  'actions.visit.remove.busy': 'Rimozione di {name} dalla tua mappa del mondo',
  'actions.visit.add.name': 'Segna come visitato, {name}',
  'actions.visit.add.busy': 'Segnando {name} come visitato',
  'actions.goal.remove.name': 'Rimuovi {name} dalla tua lista dei desideri',
  'actions.goal.remove.busy':
    'Rimozione di {name} dalla tua lista dei desideri',
  'actions.goal.add.name': 'Aggiungi alla lista, {name}',
  'actions.goal.add.busy': 'Aggiunta di {name} alla tua lista dei desideri',

  'actions.hint':
    'Entrambe hanno effetto subito, ed entrambe si possono annullare qui.',
  'actions.offline':
    'Il tuo dispositivo non ha raggiunto il server. Controlla la connessione e riprova.',
  'actions.toast.marked': 'Segnato come visitato',
  'actions.toast.markedBody': '{name} è sulla tua mappa del mondo.',
  'actions.toast.markFailed': '{name} non è stato segnato',
  'actions.toast.unmarked': 'Rimosso dalla tua mappa del mondo',
  'actions.toast.unmarkedBody': '{name} non è più segnato come visitato.',
  'actions.toast.unmarkFailed': '{name} non è stato rimosso',
  'actions.toast.listed': 'Aggiunto alla tua lista dei desideri',
  'actions.toast.listedBody': '{name} è un posto dove conti di andare.',
  'actions.toast.listFailed': '{name} non è stato aggiunto',
  'actions.toast.unlisted': 'Rimosso dalla tua lista dei desideri',
  'actions.toast.unlistedBody': '{name} non è più in lista.',
  'actions.toast.unlistFailed': '{name} non è stato rimosso',
  'actions.toast.fallback':
    'La modifica non ha raggiunto il server. Riprova tra un momento.',

  'actions.confirm.visit.title': 'Rimuovere {name} dalla tua mappa del mondo?',
  'actions.confirm.visit.body': {
    one: '{visits} visita registrata{dates} verrebbe cancellata{note}. I tuoi viaggi e i luoghi salvati non vengono toccati.',
    many: '{visits} visite registrate{dates} verrebbero cancellate{note}. I tuoi viaggi e i luoghi salvati non vengono toccati.',
    other:
      '{visits} visite registrate{dates} verrebbero cancellate{note}. I tuoi viaggi e i luoghi salvati non vengono toccati.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', insieme alla nota che ci avevi scritto',
  'actions.confirm.goal.title':
    'Rimuovere {name} dalla tua lista dei desideri?',
  'actions.confirm.goal.body':
    'È già spuntato, quindi sparisce anche il ricordo che ci sei arrivato. La tua mappa del mondo e i tuoi viaggi non vengono toccati.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Viaggio dello spazio di lavoro',
    many: 'Viaggi dello spazio di lavoro',
    other: 'Viaggi dello spazio di lavoro',
  },
  'card.visits': { one: 'Visita', many: 'Visite', other: 'Visite' },
  'card.places': { one: 'Luogo', many: 'Luoghi', other: 'Luoghi' },
  'card.firstTrip': 'Primo viaggio',
  'card.lastTrip': 'Ultimo viaggio',
  'card.firstVisit': 'Prima visita',
  'card.lastVisit': 'Ultima visita',
  'card.absent': 'Non registrato',
  'card.loading': 'Caricamento del paese',
  'card.loadingNamed': 'Caricamento di {name}',
  'card.error.body':
    'Questi numeri non si sono caricati. Non è andato perso nulla.',
  'card.error.retry': 'Riprova',
  'overlay.close': 'Chiudi {name}',
} satisfies TranslationOf<typeof En>

export default messages
