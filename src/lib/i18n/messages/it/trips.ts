/**
 * The trip tabs' own copy, in it.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plurale.** `one` · `many` · `other`; `many` solo per i numeri compatti grandi.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Aggiungi un luogo a questo viaggio',
  'plan.editor.editTitle': 'Modifica questo luogo',
  'plan.editor.createDescription':
    'Dagli un nome ora e una posizione più tardi - un luogo non pianificato resta nel pannello dei luoghi finché non lo assegni a un giorno.',
  'plan.editor.editDescription':
    'Le modifiche valgono ovunque: sulla mappa, in ogni giorno assegnato e nell’elenco dei luoghi del viaggio.',
  'plan.editor.nameRequired': 'Il luogo deve avere un nome',
  'plan.editor.nameExample': 'ad es. Fushimi Inari Taisha',
  'plan.editor.city': 'Città',
  'plan.editor.cityExample': 'ad es. Kyoto',
  'plan.editor.addressExample': 'ad es. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Tempo sul posto',
  'plan.editor.rating': 'Ne vale la pena?',
  'plan.editor.latitude': 'Latitudine',
  'plan.editor.longitude': 'Longitudine',
  'plan.editor.positionHint': 'Oppure chiudi e scegli il punto sulla mappa.',
  'plan.editor.latitudeError': 'Tra -90 e 90',
  'plan.editor.longitudeError': 'Tra -180 e 180',
  'plan.editor.positionError': 'La posizione richiede entrambi i numeri',
  'plan.editor.day': 'Assegna a un giorno',
  'plan.editor.dayHint': 'Lascia vuoto per tenerlo nel pannello dei luoghi.',
  'plan.editor.unplanned': 'Lascia non pianificato',
  'plan.editor.dayNamed': 'Giorno {day} · {title}',
  'plan.editor.stopFallback': 'Questa tappa',
  'plan.editor.dayNumber': 'Giorno {day}',
  'plan.editor.visited': 'Già visitato',
  'plan.editor.visitedHint': 'Segna il pin con una spunta.',
  'plan.editor.saving': 'Salvataggio del luogo',
  'plan.editor.save': 'Salva modifiche',
  'plan.editor.noCategory': 'Nessuna categoria',
  'plan.editor.arrive': 'Arrivo',
  'plan.editor.leave': 'Partenza',
  'plan.editor.timeError': 'La partenza deve seguire l’arrivo',
  'plan.editor.booking': 'Prenotazione',
  'plan.editor.note': 'Nota per questa tappa',
  'plan.editor.noteExample': 'Vai presto - dopo le 9 la coda dura un’ora.',
  'plan.editor.savingTimes': 'Salvataggio degli orari',
  'plan.editor.saveTimes': 'Salva',
  'plan.editor.duration0': 'Nessuna durata fissa',
  'plan.editor.duration30': '30 minuti',
  'plan.editor.duration45': '45 minuti',
  'plan.editor.duration60': '1 ora',
  'plan.editor.duration90': '1½ ore',
  'plan.editor.duration120': '2 ore',
  'plan.editor.duration180': '3 ore',
  'plan.editor.duration240': 'Mezza giornata',
  'plan.editor.duration480': 'Una giornata intera',
  'plan.editor.rating0': 'Senza voto',
  'plan.editor.rating1': '★ 1 - da saltare',
  'plan.editor.rating2': '★ 2 - se resta tempo',
  'plan.editor.rating3': '★ 3 - ne vale la pena',
  'plan.editor.rating4': '★ 4 - davvero bello',
  'plan.editor.rating5': '★ 5 - da non perdere',
  'plan.editor.bookingNone': 'Prenotazione non necessaria',
  'plan.editor.bookingPending': 'Da prenotare',
  'plan.editor.bookingConfirmed': 'Prenotato e confermato',
  'plan.editor.bookingCompleted': 'Visita completata',
  'plan.editor.bookingCancelled': 'Annullato',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Non è stato possibile caricare questo viaggio',
  'error.plan': 'Non è stato possibile caricare l’itinerario',
  'error.costs': 'Non è stato possibile caricare le spese',
  'error.collab': 'Non è stato possibile caricare la conversazione',
  'error.book': 'Non è stato possibile caricare le prenotazioni',
  'error.transports': 'Gli spostamenti non sono stati caricati',
  'error.people': 'Non è stato possibile caricare le persone',
  'header.length': {
    one: '{days} giorno',
    many: '{days} giorni',
    other: '{days} giorni',
  },
  'header.planned': {
    one: '{days} giorno pianificato',
    many: '{days} giorni pianificati',
    other: '{days} giorni pianificati',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerario',
  'plan.places': 'Luoghi',
  'plan.readOnly.archived':
    'Questo viaggio è archiviato, quindi il programma è di sola lettura.',
  'plan.readOnly.role':
    'Puoi visualizzare questo programma. Solo il proprietario del viaggio e chi può modificare possono cambiarlo.',
  'plan.day.empty': 'Niente in programma: trascina qui un luogo o una nota',
  'plan.move.refused.duplicate': '{name} è già in quel giorno',
  'plan.move.refused.duplicateBody':
    'Un luogo può comparire una sola volta al giorno. Spostalo in un altro giorno.',
  'plan.move.refused.notInIdeas': 'Una nota resta nel giorno',
  'plan.move.refused.notInIdeasBody':
    'Le idee sono luoghi in attesa di un giorno. Una nota appartiene al giorno per cui è stata scritta.',
  'plan.move.refused.notInAnotherDay': 'Una nota resta nel suo giorno',
  'plan.move.refused.notInAnotherDayBody':
    'Le note non si possono ancora spostare tra i giorni. Modifica la nota, oppure scrivila nell’altro giorno.',
  'plan.move.refused.journeyNotInIdeas': 'Uno spostamento resta nel giorno',
  'plan.move.refused.journeyNotInIdeasBody':
    'Le idee sono luoghi in attesa di un giorno. Uno spostamento appartiene al giorno in cui avviene.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Uno spostamento resta nel suo giorno',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Il giorno di uno spostamento nasce dalle sue date. Modificale nella scheda Spostamenti.',
  'plan.move.refused.journeyTimed': '{name} parte alle {time}',
  'plan.move.refused.journeyTimedBody':
    'Un orario di partenza è dell’orario ufficiale, non del piano. Metti lo spostamento dove lo colloca il suo orologio.',
  'plan.move.spoken.duplicate':
    '{name} non è stato spostato. Quel giorno lo contiene già.',
  'plan.move.spoken.notInIdeas':
    '{name} non è stato spostato. Una nota resta nel giorno.',
  'plan.move.spoken.notInAnotherDay':
    '{name} non è stato spostato. Una nota resta nel suo giorno.',
  'plan.move.spoken.timed':
    '{name} porta l’orario {time}. Chiediamo se lasciarlo andare.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} non è stato spostato. Uno spostamento resta nel giorno.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} non è stato spostato. Uno spostamento resta nel suo giorno.',
  'plan.move.spoken.journeyTimed':
    '{name} non è stato spostato. Parte alle {time}.',
  'plan.move.error.save': 'Questo spostamento non è stato salvato',
  'plan.move.error.retry': 'Riprova tra un momento.',
  'plan.move.dropTime.title': 'Spostare {name} e rimuovere le {time}?',
  'plan.move.dropTime.body':
    'Questa posizione contraddice l’orario che porta. Spostarlo qui cancella l’orario: il nuovo ordine e l’orario cancellato si salvano insieme.',
  'plan.move.dropTime.confirm': 'Sposta e rimuovi l’orario',
  'plan.move.dropTime.cancel': 'Lascialo dov’è',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Aggiungi una nota',
  'plan.note.addForDay': 'Aggiungi una nota, {day}',
  'plan.addPlace.label': 'Aggiungi un luogo',
  'plan.addPlace.more': 'Altri modi per aggiungere un luogo',
  'plan.addPlace.option.map': 'Posizionalo sulla mappa',
  'plan.addPlace.forDayNamed': 'Aggiungi un luogo, {day}',
  'plan.addPlace.quota':
    'Hai raggiunto il limite di luoghi del tuo piano. Passa a un piano superiore per aggiungerne altri.',
  'plan.addPlace.quotaAction': 'Vedi i piani',
  'plan.stay.checkIn': 'Check-in',
  'plan.stay.checkOut': 'Check-out',
  'plan.day.addStay': 'Aggiungi un alloggio, {day}',
  'plan.day.addStayShort': 'Aggiungi un alloggio',
  'plan.handoff.stop':
    'Apri {place} in {service} (si apre in una nuova scheda)',
  'plan.handoff.day.directions': 'Indicazioni in {service}',
  'plan.handoff.day.directionsName':
    'Indicazioni in {service}: {day} (si apre in una nuova scheda)',
  'plan.handoff.day.directionsPartial': 'Tappe: le prime {carried} su {total}',
  'plan.handoff.day.directionsPartialName':
    'Indicazioni in {service}: {day}, tappe: le prime {carried} su {total} (si apre in una nuova scheda)',
  'plan.handoff.day.point': 'Mostra in {service}',
  'plan.handoff.day.pointName':
    'Mostra in {service}: l’unica tappa con posizione di {day} (si apre in una nuova scheda)',
  'plan.drop.hint':
    'Fai clic destro sulla mappa, o tieni premuto, per aggiungere un luogo proprio lì.',
  'plan.drop.armed':
    'Fai clic sulla mappa dove va, oppure sposta la mappa e premi Invio per lasciarlo al centro.',
  'plan.drop.stop': 'Smetti di posizionare un nuovo segnaposto',
  'plan.drop.pin': 'Nuovo luogo',
  'plan.drop.lookingUp': 'Ricerca dell’indirizzo…',
  'plan.drop.error':
    'Non è stato possibile inserire il segnaposto. Riprova tra un momento.',
  'plan.place.pastedPosition': 'Letto come latitudine {lat}, longitudine {lng}',
  'plan.note.showMore': 'Mostra di più',
  'plan.note.showLess': 'Mostra di meno',
  'plan.note.moveUp': 'Sposta su',
  'plan.note.moveDown': 'Sposta giù',
  'plan.note.drag': 'Riordina la nota',
  'plan.note.edit': 'Modifica la nota',
  'plan.note.delete': 'Elimina la nota',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Aggiungi una nota',
  'plan.note.dialog.editTitle': 'Modifica la nota',
  'plan.note.field.body': 'Nota',
  'plan.note.field.bodyHint': 'Una riga. È ciò che mostra il giorno.',
  'plan.note.field.detail': 'Dettagli',
  'plan.note.field.detailHint':
    'Titoli, elenchi, link, citazioni, codice e tabelle.',
  'plan.note.field.time': 'Ora',
  'plan.note.field.timeHint': 'Facoltativa, in formato 24 ore.',
  'plan.note.field.icon': 'Icona',
  'plan.note.tab.write': 'Scrivi',
  'plan.note.tab.preview': 'Anteprima',
  'plan.note.previewEmpty': 'Non c’è ancora nulla da vedere in anteprima',
  'plan.note.save': 'Salva la nota',
  'plan.note.cancel': 'Annulla',
  'plan.note.confirmDelete': 'Eliminare questa nota?',
  'plan.note.confirmDeleteBody':
    'La nota e i suoi dettagli spariscono da questo giorno.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Nota aggiunta',
  'plan.note.toast.updated': 'Nota salvata',
  'plan.note.toast.deleted': 'Nota eliminata',
  'plan.note.error.save': 'La nota non è stata salvata',
  'plan.note.error.delete': 'La nota non è stata eliminata',
  'plan.note.error.retry': 'Riprova tra un momento.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Promemoria',
  'plan.note.icon.clock': 'Ora',
  'plan.note.icon.flashlight': 'Torcia',
  'plan.note.icon.footprints': 'Camminata',
  'plan.note.icon.info': 'Informazioni',
  'plan.note.icon.luggage': 'Bagagli',
  'plan.note.icon.package': 'Pacco',
  'plan.note.icon.ticket': 'Biglietti',
  'plan.note.icon.trainFront': 'Treno',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Nota',
  'plan.note.icon.utensils': 'Cibo',
  'plan.note.icon.bus': 'Trasporti',
  'plan.note.icon.bedDouble': 'Pernottamento',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Luogo',
  'plan.note.icon.wallet': 'Denaro',
  'plan.note.icon.umbrella': 'Pioggia',
  'plan.note.icon.triangleAlert': 'Avviso',
  'plan.transport.phase.flight.departing': 'Decollo',
  'plan.transport.phase.flight.travelling': 'In volo',
  'plan.transport.phase.flight.arriving': 'Atterraggio',
  'plan.transport.phase.hire.departing': 'Ritiro',
  'plan.transport.phase.hire.travelling': 'A noleggio',
  'plan.transport.phase.hire.arriving': 'Riconsegna',
  'plan.transport.phase.journey.departing': 'Inizio',
  'plan.transport.phase.journey.travelling': 'In viaggio',
  'plan.transport.phase.journey.arriving': 'Fine',
  'plan.transport.label': 'Da {from} a {to}',
  'plan.transport.drag': 'Riordina, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Insieme',
  'collab.empty': 'Non è ancora stato condiviso nulla',
  'collab.conversation': 'Conversazione',
  'collab.count.messages': {
    one: '{messages} messaggio',
    many: '{messages} messaggi',
    other: '{messages} messaggi',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} note',
    other: '{notes} note',
  },
  'collab.count.polls': {
    one: '{polls} sondaggio',
    many: '{polls} sondaggi',
    other: '{polls} sondaggi',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Prenotazioni',
  'book.empty': 'Non è ancora stato prenotato nulla',
  'book.count.bookings': {
    one: '{bookings} prenotazione',
    many: '{bookings} prenotazioni',
    other: '{bookings} prenotazioni',
  },
  'book.count.confirmed': {
    one: '{confirmed} confermata',
    many: '{confirmed} confermate',
    other: '{confirmed} confermate',
  },
  'book.progressLabel': {
    one: '{confirmed} prenotazione confermata su {total}',
    many: '{confirmed} prenotazioni confermate su {total}',
    other: '{confirmed} prenotazioni confermate su {total}',
  },
  'book.ofTotal': 'su {total}',
  'book.confirmed': 'Confermate',
  'book.awaiting': 'In attesa di conferma',
  'book.nothingHanging': 'Niente in sospeso',
  'book.chase': 'Sollecitale prima di partire',
  'book.committed': 'Impegnato',
  'book.committedCaption': 'Su tutte le prenotazioni di questo viaggio',
  'book.onItinerary': 'Nell’itinerario',
  'book.pinnedCaption': 'Fissato a un giorno del piano',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Spostamenti',
  'transports.empty': 'Ancora nulla registrato',
  'transports.count.transports': {
    one: '{transports} spostamento',
    many: '{transports} spostamenti',
    other: '{transports} spostamenti',
  },
  'transports.distance': 'Distanza percorsa',
  'transports.equator': '≈ {times}× il giro dell’equatore',
  'transports.noGrouping': 'Ancora nulla raggruppato',
  'transports.mostly': 'soprattutto {mode}',
  'transports.confirmed': 'Confermati',
  'transports.stillPending': {
    one: '{pending} ancora in attesa',
    many: '{pending} ancora in attesa',
    other: '{pending} ancora in attesa',
  },
  'transports.spent': 'Speso in viaggi',
  'transports.noPrices': 'Nessun prezzo registrato',
  'transports.priced': {
    one: 'su {priced} spostamento con prezzo',
    many: 'su {priced} spostamenti con prezzo',
    other: 'su {priced} spostamenti con prezzo',
  },
  'people.title': 'Persone',
  'people.description': 'Chi partecipa a questo viaggio e chi può trovarlo',
  'people.members.title': 'In questo viaggio',
  'people.members.empty':
    'Nessuno di questo viaggio fa più parte di questo spazio di lavoro',
  'people.role.label': 'Ruolo',
  'people.role.owner': 'Proprietario',
  'people.role.editor': 'Può modificare',
  'people.role.viewer': 'Può visualizzare',
  'people.you': 'Tu',
  'people.owner.hint': 'Un viaggio mantiene sempre almeno un proprietario',
  'people.remove.action': 'Rimuovi {name} da questo viaggio',
  'people.remove.title': 'Rimuovere {name} da questo viaggio?',
  'people.remove.body':
    'Perde subito l’accesso all’itinerario. Quello che ha aggiunto resta nel viaggio.',
  'people.remove.confirm': 'Rimuovi',
  'people.leave.action': 'Esci da questo viaggio',
  'people.leave.title': 'Uscire da questo viaggio?',
  'people.leave.body':
    'Perdi l’accesso all’itinerario finché qualcuno del viaggio non ti aggiunge di nuovo.',
  'people.leave.confirm': 'Esci',
  'people.cancel': 'Annulla',
  'people.invite.title': 'Aggiungi qualcuno',
  'people.invite.placeholder': 'Cerca le persone di questo spazio di lavoro',
  'people.invite.action': 'Aggiungi al viaggio',
  'people.invite.role': 'Partecipa come',
  'people.invite.empty': 'Tutti in questo spazio sono già in questo viaggio',
  'people.invite.emptyHint':
    'Prima qualcuno di nuovo entra nello spazio, in Impostazioni',
  'people.visibility.title': 'Chi può trovare questo viaggio',
  'people.visibility.switch': 'Visibile a tutti nello spazio di lavoro',
  'people.visibility.private':
    'Solo le persone elencate qui vedono questo viaggio',
  'people.visibility.organization':
    'Chiunque in questo spazio può aprire questo viaggio',
  'people.visibility.public': 'Questo viaggio è condiviso con un link pubblico',
  'people.error.lastOwner':
    'Un viaggio mantiene almeno un proprietario. Rendi prima proprietario qualcun altro.',
  'people.error.notInWorkspace':
    'Questa persona non è in questo spazio di lavoro',
  'people.error.alreadyOnTrip': 'Questa persona è già in questo viaggio',
  'people.guests.title': 'Viaggiano con te',
  'people.guests.description':
    'Persone di questo viaggio che non hanno un account',
  'people.guests.empty': 'Ancora nessuno',
  'people.guests.emptyHint':
    'Un ospite è qualcuno che viaggia con te e non ha bisogno di un account. Aggiungilo per nome.',
  'people.guest.badge': 'Ospite',
  'people.guest.add.label': 'Il suo nome',
  'people.guest.add.placeholder': 'Giulia',
  'people.guest.add.action': 'Aggiungi un ospite',
  'people.guest.rename.action': 'Rinomina {name}',
  'people.guest.rename.title': 'Rinomina {name}',
  'people.guest.rename.confirm': 'Rinomina',
  'people.guest.remove.action': 'Rimuovi {name} da questo viaggio',
  'people.guest.remove.title': 'Rimuovere {name} da questo viaggio?',
  'people.guest.remove.body':
    'L’ospite viene rimosso. Nient’altro cambia nel viaggio.',
  'people.guest.remove.confirm': 'Rimuovi',
  'people.guest.merge.action': '{name} ora è…',
  'people.guest.merge.title':
    '{name} ora è una delle persone di questo viaggio',
  'people.guest.merge.body':
    'Tutto ciò che è assegnato a {name} passa alla persona che scegli e l’ospite viene rimosso. L’operazione non si può annullare.',
  'people.guest.merge.inherits':
    '{member} eredita tutto ciò che è assegnato a {name}.',
  'people.guest.merge.placeholder': 'Scegli qualcuno di questo viaggio',
  'people.guest.merge.confirm': 'Unisci',
  'people.guest.merge.done': '{name} ora è {member}',
  'people.guest.merge.nothingMoved': 'Non gli era ancora stato assegnato nulla',
  'people.error.guestNameTaken':
    'In questo viaggio c’è già un ospite di nome {name}',
  'people.error.guestLimit':
    'Un viaggio accoglie al massimo {limit} ospiti, perché un elenco più lungo rende difficili da leggere la scelta dei partecipanti e la divisione delle spese',
  'people.error.guestMergeTarget':
    'Scegli qualcuno che è già in questo viaggio',
  'plan.weather.badge.forecast':
    'Previsione: {condition}, massima {max}, minima {min}',
  'plan.weather.badge.forecastNoCondition':
    'Previsione: massima {max}, minima {min}',
  'plan.weather.badge.unavailable': 'Meteo non disponibile per questo giorno',
  'plan.weather.badge.loading': 'Caricamento del meteo',
  'plan.weather.badge.recorded': 'Registrato: massima {max}, minima {min}',
  'plan.weather.badge.recordedHigh': 'Registrato: massima {max}',
  'plan.weather.badge.recordedLow': 'Registrato: minima {min}',
  'plan.weather.badge.estimate':
    'Stima: massima tipica {max}, minima tipica {min}',
  'plan.weather.badge.estimateHigh': 'Stima: massima tipica {max}',
  'plan.weather.badge.estimateLow': 'Stima: minima tipica {min}',
  'plan.weather.badge.notYetRecorded': 'Non ancora registrato',
  'plan.weather.condition.clear': 'Sereno',
  'plan.weather.condition.fair': 'Poco nuvoloso',
  'plan.weather.condition.partlyCloudy': 'Parzialmente nuvoloso',
  'plan.weather.condition.cloudy': 'Nuvoloso',
  'plan.weather.condition.fog': 'Nebbia',
  'plan.weather.condition.rain': 'Pioggia',
  'plan.weather.condition.heavyRain': 'Pioggia forte',
  'plan.weather.condition.sleet': 'Nevischio',
  'plan.weather.condition.snow': 'Neve',
  'plan.weather.condition.thunder': 'Temporale',
  'plan.weather.panel.title': 'Meteo del {date}',
  'plan.weather.panel.temperature': 'Massima / minima',
  'plan.weather.panel.precipitation': 'Precipitazioni',
  'plan.weather.panel.precipitationTypical':
    'Precipitazioni giornaliere tipiche',
  'plan.weather.panel.probability': '{percent} di probabilità',
  'plan.weather.panel.wind': 'Vento',
  'plan.weather.panel.sunrise': 'Alba',
  'plan.weather.panel.sunset': 'Tramonto',
  'plan.weather.panel.noSunrise': 'Nessuna alba',
  'plan.weather.panel.noSunset': 'Nessun tramonto',
  'plan.weather.panel.slots': 'Nel corso della giornata',
  'plan.weather.panel.slot.night': 'Notte',
  'plan.weather.panel.slot.morning': 'Mattina',
  'plan.weather.panel.slot.afternoon': 'Pomeriggio',
  'plan.weather.panel.slot.evening': 'Sera',
  'plan.weather.panel.high': 'Massima',
  'plan.weather.panel.low': 'Minima',
  'plan.weather.panel.recordedNote': 'Valori misurati per questo giorno.',
  'plan.weather.panel.temperatureTypical': 'Massima / minima tipiche',
  'plan.weather.panel.estimateNote':
    'Una media di lungo periodo per questo mese, non una previsione.',
  'plan.weather.attribution.metNorway':
    'Dati della previsione: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Dati: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Ridimensiona l’itinerario',
  'plan.workspace.resizePlaces': 'Ridimensiona i luoghi',
  'plan.workspace.toggleDay': 'Espandi o comprimi {day}',
  'plan.workspace.days': 'Giorni',
  'plan.workspace.showPanel': 'Mostra il pannello {label}',
  'plan.workspace.hidePanel': 'Nascondi il pannello {label}',
  'plan.workspace.narrowPanel': 'Restringi {label}',
  'plan.workspace.widenPanel': 'Allarga {label}',
} satisfies TranslationOf<typeof En>

export default messages
