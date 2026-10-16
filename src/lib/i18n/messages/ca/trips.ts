/**
 * The trip tabs' own copy, in ca.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` només per a nombres compactes grans.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'No trobem aquest viatge',
  'notFound.body':
    'No és entre els viatges que pots obrir a l’espai de treball actual. Potser s’ha suprimit o no hi tens accés.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Afegeix un lloc a aquest viatge',
  'plan.editor.editTitle': 'Edita aquest lloc',
  'plan.editor.createDescription':
    'Posa-hi un nom ara i una ubicació després - un lloc sense planificar espera al tauler de llocs fins que l’assignis a un dia.',
  'plan.editor.editDescription':
    'Els canvis s’apliquen a tot arreu: mapa, dies assignats i llista de llocs del viatge.',
  'plan.editor.nameRequired': 'El lloc necessita un nom',
  'plan.editor.nameExample': 'p. ex., Fushimi Inari Taisha',
  'plan.editor.city': 'Ciutat',
  'plan.editor.cityExample': 'p. ex., Kyoto',
  'plan.editor.addressExample': 'p. ex., 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Temps al lloc',
  'plan.editor.rating': 'Val la pena?',
  'plan.editor.latitude': 'Latitud',
  'plan.editor.longitude': 'Longitud',
  'plan.editor.positionHint': 'O tanca això i tria el punt al mapa.',
  'plan.editor.latitudeError': 'Entre -90 i 90',
  'plan.editor.longitudeError': 'Entre -180 i 180',
  'plan.editor.positionError': 'La ubicació necessita tots dos nombres',
  'plan.editor.day': 'Assigna a un dia',
  'plan.editor.dayHint': 'Deixa-ho buit per mantenir-lo al tauler de llocs.',
  'plan.editor.unplanned': 'Deixa sense planificar',
  'plan.editor.dayNamed': 'Dia {day} · {title}',
  'plan.editor.stopFallback': 'Aquesta parada',
  'plan.editor.dayNumber': 'Dia {day}',
  'plan.editor.visited': 'Ja visitat',
  'plan.editor.visitedHint': 'Marca el pin amb una marca de verificació.',
  'plan.editor.saving': 'S’està desant el lloc',
  'plan.editor.save': 'Desa els canvis',
  'plan.editor.noCategory': 'Sense categoria',
  'plan.editor.arrive': 'Arribada',
  'plan.editor.leave': 'Sortida',
  'plan.editor.timeError': 'La sortida ha de ser posterior a l’arribada',
  'plan.editor.booking': 'Reserva',
  'plan.editor.note': 'Nota per a aquesta parada',
  'plan.editor.noteExample':
    'Ves-hi d’hora - després de les 9 la cua dura una hora.',
  'plan.editor.savingTimes': 'S’estan desant els horaris',
  'plan.editor.saveTimes': 'Desa',
  'plan.editor.duration0': 'Sense durada fixa',
  'plan.editor.duration30': '30 minuts',
  'plan.editor.duration45': '45 minuts',
  'plan.editor.duration60': '1 hora',
  'plan.editor.duration90': '1½ hores',
  'plan.editor.duration120': '2 hores',
  'plan.editor.duration180': '3 hores',
  'plan.editor.duration240': 'Mig dia',
  'plan.editor.duration480': 'Un dia sencer',
  'plan.editor.rating0': 'Sense valorar',
  'plan.editor.rating1': '★ 1 - millor evitar-lo',
  'plan.editor.rating2': '★ 2 - si hi ha temps',
  'plan.editor.rating3': '★ 3 - val la pena',
  'plan.editor.rating4': '★ 4 - molt bo',
  'plan.editor.rating5': '★ 5 - no te’l perdis',
  'plan.editor.bookingNone': 'No cal reservar',
  'plan.editor.bookingPending': 'Pendent de reservar',
  'plan.editor.bookingConfirmed': 'Reservat i confirmat',
  'plan.editor.bookingCompleted': 'Visita completada',
  'plan.editor.bookingCancelled': 'Cancel·lat',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'No s’ha pogut carregar aquest viatge',
  'error.plan': 'No s’ha pogut carregar l’itinerari',
  'error.costs': 'No s’han pogut carregar les despeses',
  'error.collab': 'No s’ha pogut carregar la conversa',
  'error.book': 'No s’han pogut carregar les reserves',
  'error.transports': 'Els trajectes no s’han carregat',
  'error.people': 'No s’han pogut carregar les persones',
  'header.length': {
    one: '{days} dia',
    many: '{days} dies',
    other: '{days} dies',
  },
  'header.planned': {
    one: '{days} dia planificat',
    many: '{days} dies planificats',
    other: '{days} dies planificats',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerari',
  'plan.places': 'Llocs',
  'plan.readOnly.archived':
    'Aquest viatge està arxivat, així que el pla és només de lectura.',
  'plan.readOnly.role':
    'Pots veure aquest pla. Només el propietari del viatge i qui pot editar el poden canviar.',
  'plan.day.empty': 'Res planificat: arrossega aquí un lloc o una nota',
  'plan.move.refused.duplicate': '{name} ja és en aquell dia',
  'plan.move.refused.duplicateBody':
    'Un lloc només pot aparèixer un cop per dia. Mou-lo a un altre dia.',
  'plan.move.refused.notInIdeas': 'Una nota es queda dins del dia',
  'plan.move.refused.notInIdeasBody':
    'Les idees són llocs que esperen un dia. Una nota pertany al dia per al qual es va escriure.',
  'plan.move.refused.notInAnotherDay': 'Una nota es queda al seu dia',
  'plan.move.refused.notInAnotherDayBody':
    'Encara no es poden moure notes entre dies. Editeu la nota o escriviu-la a l’altre dia.',
  'plan.move.refused.journeyNotInIdeas': 'Un trajecte es queda dins del dia',
  'plan.move.refused.journeyNotInIdeasBody':
    'Les idees són llocs que esperen un dia. Un trajecte pertany al dia en què passa.',
  'plan.move.refused.journeyNotInAnotherDay': 'Un trajecte es queda al seu dia',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'El dia d’un trajecte ve de les seves dates. Canvieu-les a la pestanya Trajectes.',
  'plan.move.refused.journeyTimed': '{name} surt a les {time}',
  'plan.move.refused.journeyTimedBody':
    'L’hora de sortida és de l’horari, no del pla. Poseu el trajecte on li toca pel rellotge.',
  'plan.move.spoken.duplicate': '{name} no s’ha mogut. Aquell dia ja el té.',
  'plan.move.spoken.notInIdeas':
    '{name} no s’ha mogut. Una nota es queda dins del dia.',
  'plan.move.spoken.notInAnotherDay':
    '{name} no s’ha mogut. Una nota es queda al seu dia.',
  'plan.move.spoken.timed':
    '{name} porta l’hora {time}. Us preguntem si voleu deixar-la anar.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} no s’ha mogut. Un trajecte es queda dins del dia.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} no s’ha mogut. Un trajecte es queda al seu dia.',
  'plan.move.spoken.journeyTimed': '{name} no s’ha mogut. Surt a les {time}.',
  'plan.move.error.save': 'Aquest moviment no s’ha desat',
  'plan.move.error.retry': 'Torneu-ho a provar d’aquí a un moment.',
  'plan.move.dropTime.title': 'Voleu moure {name} i deixar anar les {time}?',
  'plan.move.dropTime.body':
    'Aquesta posició contradiu l’hora que té. Moure’l aquí esborra l’hora: el nou ordre i l’hora esborrada es desen alhora.',
  'plan.move.dropTime.confirm': 'Mou-lo i esborra l’hora',
  'plan.move.dropTime.cancel': 'Deixa’l on és',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Afegeix una nota',
  'plan.note.addForDay': 'Afegeix una nota, {day}',
  'plan.addPlace.label': 'Afegeix un lloc',
  'plan.addPlace.more': 'Més maneres d’afegir un lloc',
  'plan.addPlace.option.map': 'Col·loca’l al mapa',
  'plan.addPlace.forDayNamed': 'Afegeix un lloc, {day}',
  'plan.addPlace.quota':
    'Has arribat al límit de llocs del teu pla. Millora’l per afegir-ne més.',
  'plan.addPlace.quotaAction': 'Veure els plans',
  'plan.stay.checkIn': 'Entrada',
  'plan.stay.checkOut': 'Sortida',
  'plan.day.addStay': 'Afegeix una estada, {day}',
  'plan.day.addStayShort': 'Afegeix una estada',
  'plan.handoff.stop': 'Obre {place} a {service} (s’obre en una pestanya nova)',
  'plan.handoff.day.directions': 'Indicacions a {service}',
  'plan.handoff.day.directionsName':
    'Indicacions a {service}: {day} (s’obre en una pestanya nova)',
  'plan.handoff.day.directionsPartial':
    'Parades: les primeres {carried} de {total}',
  'plan.handoff.day.directionsPartialName':
    'Indicacions a {service}: {day}, parades: les primeres {carried} de {total} (s’obre en una pestanya nova)',
  'plan.handoff.day.point': 'Mostra a {service}',
  'plan.handoff.day.pointName':
    'Mostra a {service}: l’única parada amb ubicació de {day} (s’obre en una pestanya nova)',
  'plan.drop.hint':
    'Fes clic amb el botó dret al mapa, o mantén-lo premut, per afegir-hi un lloc just allà.',
  'plan.drop.armed':
    'Fes clic al mapa on va, o mou el mapa i prem Retorn per deixar-lo al centre.',
  'plan.drop.stop': 'Deixa de col·locar una agulla nova',
  'plan.drop.pin': 'Lloc nou',
  'plan.drop.lookingUp': 'S’està cercant l’adreça…',
  'plan.drop.error':
    'No s’ha pogut deixar l’agulla. Torna-ho a provar d’aquí a una estona.',
  'plan.place.pastedPosition': 'Llegit com a latitud {lat}, longitud {lng}',
  'plan.note.showMore': 'Mostra’n més',
  'plan.note.showLess': 'Mostra’n menys',
  'plan.note.moveUp': 'Mou amunt',
  'plan.note.moveDown': 'Mou avall',
  'plan.note.drag': 'Reordena la nota',
  'plan.note.edit': 'Edita la nota',
  'plan.note.delete': 'Suprimeix la nota',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Afegeix una nota',
  'plan.note.dialog.editTitle': 'Edita la nota',
  'plan.note.field.body': 'Nota',
  'plan.note.field.bodyHint': 'Una línia. És el que mostra el dia.',
  'plan.note.field.detail': 'Detalls',
  'plan.note.field.detailHint':
    'Títols, llistes, enllaços, cites, codi i taules.',
  'plan.note.field.time': 'Hora',
  'plan.note.field.timeHint': 'Opcional, en format de 24 hores.',
  'plan.note.field.icon': 'Icona',
  'plan.note.tab.write': 'Escriu',
  'plan.note.tab.preview': 'Previsualització',
  'plan.note.previewEmpty': 'Encara no hi ha res per previsualitzar',
  'plan.note.save': 'Desa la nota',
  'plan.note.cancel': 'Cancel·la',
  'plan.note.confirmDelete': 'Voleu suprimir aquesta nota?',
  'plan.note.confirmDeleteBody':
    'La nota i els seus detalls desapareixen d’aquest dia.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Nota afegida',
  'plan.note.toast.updated': 'Nota desada',
  'plan.note.toast.deleted': 'Nota suprimida',
  'plan.note.error.save': 'La nota no s’ha desat',
  'plan.note.error.delete': 'La nota no s’ha suprimit',
  'plan.note.error.retry': 'Torneu-ho a provar d’aquí a un moment.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Recordatori',
  'plan.note.icon.clock': 'Hora',
  'plan.note.icon.flashlight': 'Llanterna',
  'plan.note.icon.footprints': 'Caminada',
  'plan.note.icon.info': 'Informació',
  'plan.note.icon.luggage': 'Equipatge',
  'plan.note.icon.package': 'Paquet',
  'plan.note.icon.ticket': 'Entrades',
  'plan.note.icon.trainFront': 'Tren',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Nota',
  'plan.note.icon.utensils': 'Menjar',
  'plan.note.icon.bus': 'Transport públic',
  'plan.note.icon.bedDouble': 'Allotjament',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Lloc',
  'plan.note.icon.wallet': 'Diners',
  'plan.note.icon.umbrella': 'Pluja',
  'plan.note.icon.triangleAlert': 'Avís',
  'plan.transport.phase.flight.departing': 'Enlairament',
  'plan.transport.phase.flight.travelling': 'En vol',
  'plan.transport.phase.flight.arriving': 'Aterratge',
  'plan.transport.phase.hire.departing': 'Recollida',
  'plan.transport.phase.hire.travelling': 'De lloguer',
  'plan.transport.phase.hire.arriving': 'Devolució',
  'plan.transport.phase.journey.departing': 'Inici',
  'plan.transport.phase.journey.travelling': 'En camí',
  'plan.transport.phase.journey.arriving': 'Final',
  'plan.transport.label': 'De {from} a {to}',
  'plan.transport.drag': 'Reordena, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Plegats',
  'collab.empty': 'Encara no s’ha compartit res',
  'collab.conversation': 'Conversa',
  'collab.count.messages': {
    one: '{messages} missatge',
    many: '{messages} missatges',
    other: '{messages} missatges',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} notes',
    other: '{notes} notes',
  },
  'collab.count.polls': {
    one: '{polls} enquesta',
    many: '{polls} enquestes',
    other: '{polls} enquestes',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Reserves',
  'book.empty': 'Encara no hi ha res reservat',
  'book.count.bookings': {
    one: '{bookings} reserva',
    many: '{bookings} reserves',
    other: '{bookings} reserves',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmada',
    many: '{confirmed} confirmades',
    other: '{confirmed} confirmades',
  },
  'book.progressLabel': {
    one: '{confirmed} de {total} reserva confirmada',
    many: '{confirmed} de {total} reserves confirmades',
    other: '{confirmed} de {total} reserves confirmades',
  },
  'book.ofTotal': 'de {total}',
  'book.confirmed': 'Confirmades',
  'book.awaiting': 'Pendent de confirmació',
  'book.nothingHanging': 'Res pendent',
  'book.chase': 'Reclama-les abans de volar',
  'book.committed': 'Compromès',
  'book.committedCaption': 'De totes les reserves d’aquest viatge',
  'book.onItinerary': 'A l’itinerari',
  'book.pinnedCaption': 'Fixat a un dia del pla',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Trajectes',
  'transports.empty': 'Encara no s’ha registrat res',
  'transports.count.transports': {
    one: '{transports} trajecte',
    many: '{transports} trajectes',
    other: '{transports} trajectes',
  },
  'transports.distance': 'Distància recorreguda',
  'transports.equator': '≈ {times}× la volta a l’equador',
  'transports.noGrouping': 'Encara no s’ha agrupat res',
  'transports.mostly': 'sobretot {mode}',
  'transports.confirmed': 'Confirmats',
  'transports.stillPending': {
    one: '{pending} encara pendent',
    many: '{pending} encara pendents',
    other: '{pending} encara pendents',
  },
  'transports.spent': 'Gastat en desplaçaments',
  'transports.noPrices': 'Cap preu registrat',
  'transports.priced': {
    one: 'en {priced} trajecte amb preu',
    many: 'en {priced} trajectes amb preu',
    other: 'en {priced} trajectes amb preu',
  },
  'people.title': 'Persones',
  'people.description': 'Qui és en aquest viatge i qui el pot trobar',
  'people.members.title': 'En aquest viatge',
  'people.members.empty': 'Ja no queda ningú d’aquest viatge en aquest espai',
  'people.role.label': 'Rol',
  'people.role.owner': 'Propietari',
  'people.role.editor': 'Pot editar',
  'people.role.viewer': 'Pot veure',
  'people.you': 'Tu',
  'people.owner.hint': 'Un viatge sempre manté almenys un propietari',
  'people.remove.action': 'Treu {name} d’aquest viatge',
  'people.remove.title': 'Vols treure {name} d’aquest viatge?',
  'people.remove.body':
    'Perd l’accés a l’itinerari immediatament. El que va afegir es queda al viatge.',
  'people.remove.confirm': 'Treu',
  'people.leave.action': 'Surt d’aquest viatge',
  'people.leave.title': 'Vols sortir d’aquest viatge?',
  'people.leave.body':
    'Perdràs l’accés a l’itinerari fins que algú del viatge et torni a afegir.',
  'people.leave.confirm': 'Surt',
  'people.cancel': 'Cancel·la',
  'people.invite.title': 'Afegeix algú',
  'people.invite.placeholder': 'Cerca les persones d’aquest espai',
  'people.invite.action': 'Afegeix al viatge',
  'people.invite.role': 'S’hi uneix com a',
  'people.invite.empty': 'Tothom d’aquest espai ja és en aquest viatge',
  'people.invite.emptyHint':
    'Primer cal que algú nou entri a l’espai, a Configuració',
  'people.visibility.title': 'Qui pot trobar aquest viatge',
  'people.visibility.switch': 'Visible per a tothom de l’espai',
  'people.visibility.private':
    'Només les persones que apareixen aquí poden veure aquest viatge',
  'people.visibility.organization':
    'Qualsevol persona d’aquest espai pot obrir aquest viatge',
  'people.visibility.public':
    'Aquest viatge es comparteix amb un enllaç públic',
  'people.error.lastOwner':
    'Un viatge manté almenys un propietari. Fes propietari algú altre primer.',
  'people.error.notInWorkspace': 'Aquesta persona no és en aquest espai',
  'people.error.alreadyOnTrip': 'Aquesta persona ja és en aquest viatge',
  'people.guests.title': 'Viatgen amb tu',
  'people.guests.description': 'Persones d’aquest viatge que no tenen compte',
  'people.guests.empty': 'Encara ningú',
  'people.guests.emptyHint':
    'Un convidat és algú que viatja amb tu i no necessita compte. Afegeix-lo pel nom.',
  'people.guest.badge': 'Convidat',
  'people.guest.add.label': 'El seu nom',
  'people.guest.add.placeholder': 'Laia',
  'people.guest.add.action': 'Afegeix un convidat',
  'people.guest.rename.action': 'Canvia el nom de {name}',
  'people.guest.rename.title': 'Canvia el nom de {name}',
  'people.guest.rename.confirm': 'Canvia el nom',
  'people.guest.remove.action': 'Treu {name} d’aquest viatge',
  'people.guest.remove.title': 'Vols treure {name} d’aquest viatge?',
  'people.guest.remove.body':
    'El convidat desapareix. No canvia res més del viatge.',
  'people.guest.remove.confirm': 'Treu',
  'people.guest.merge.action': '{name} ara és…',
  'people.guest.merge.title':
    '{name} ara és una de les persones d’aquest viatge',
  'people.guest.merge.body':
    'Tot el que està assignat a {name} passa a la persona que triïs i el convidat desapareix. No es pot desfer.',
  'people.guest.merge.inherits':
    '{member} hereta tot el que s’ha assignat a {name}.',
  'people.guest.merge.placeholder': 'Tria algú d’aquest viatge',
  'people.guest.merge.confirm': 'Fusiona',
  'people.guest.merge.done': '{name} ara és {member}',
  'people.guest.merge.nothingMoved': 'Encara no tenia res assignat',
  'people.error.guestNameTaken':
    'Ja hi ha un convidat anomenat {name} en aquest viatge',
  'people.error.guestLimit':
    'Un viatge admet com a màxim {limit} convidats, perquè una llista més llarga fa difícils de llegir la tria de participants i el repartiment de despeses',
  'people.error.guestMergeTarget': 'Tria algú que ja sigui en aquest viatge',
  'plan.weather.badge.forecast':
    'Previsió: {condition}, màxima {max}, mínima {min}',
  'plan.weather.badge.forecastNoCondition':
    'Previsió: màxima {max}, mínima {min}',
  'plan.weather.badge.unavailable':
    'El temps no està disponible per a aquest dia',
  'plan.weather.badge.loading': "S'està carregant el temps",
  'plan.weather.badge.recorded': 'Registrat: màxima {max}, mínima {min}',
  'plan.weather.badge.recordedHigh': 'Registrat: màxima {max}',
  'plan.weather.badge.recordedLow': 'Registrat: mínima {min}',
  'plan.weather.badge.estimate':
    'Estimació: màxima habitual {max}, mínima habitual {min}',
  'plan.weather.badge.estimateHigh': 'Estimació: màxima habitual {max}',
  'plan.weather.badge.estimateLow': 'Estimació: mínima habitual {min}',
  'plan.weather.badge.notYetRecorded': 'Encara no registrat',
  'plan.weather.condition.clear': 'Serè',
  'plan.weather.condition.fair': 'Bon temps',
  'plan.weather.condition.partlyCloudy': 'Parcialment ennuvolat',
  'plan.weather.condition.cloudy': 'Ennuvolat',
  'plan.weather.condition.fog': 'Boira',
  'plan.weather.condition.rain': 'Pluja',
  'plan.weather.condition.heavyRain': 'Pluja intensa',
  'plan.weather.condition.sleet': 'Aiguaneu',
  'plan.weather.condition.snow': 'Neu',
  'plan.weather.condition.thunder': 'Tempesta',
  'plan.weather.panel.title': 'Temps del {date}',
  'plan.weather.panel.temperature': 'Màxima / mínima',
  'plan.weather.panel.precipitation': 'Precipitació',
  'plan.weather.panel.precipitationTypical': 'Precipitació diària habitual',
  'plan.weather.panel.probability': '{percent} de probabilitat',
  'plan.weather.panel.wind': 'Vent',
  'plan.weather.panel.sunrise': 'Sortida del sol',
  'plan.weather.panel.sunset': 'Posta de sol',
  'plan.weather.panel.noSunrise': 'Sense sortida del sol',
  'plan.weather.panel.noSunset': 'Sense posta de sol',
  'plan.weather.panel.slots': 'Al llarg del dia',
  'plan.weather.panel.slot.night': 'Nit',
  'plan.weather.panel.slot.morning': 'Matí',
  'plan.weather.panel.slot.afternoon': 'Tarda',
  'plan.weather.panel.slot.evening': 'Vespre',
  'plan.weather.panel.high': 'Màxima',
  'plan.weather.panel.low': 'Mínima',
  'plan.weather.panel.recordedNote': "Valors mesurats d'aquest dia.",
  'plan.weather.panel.temperatureTypical': 'Màxima / mínima habituals',
  'plan.weather.panel.estimateNote':
    "Mitjana a llarg termini d'aquest mes, no una previsió.",
  'plan.weather.attribution.metNorway':
    'Dades de la previsió: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Dades: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Canvia l’amplada de l’itinerari',
  'plan.workspace.resizePlaces': 'Canvia l’amplada dels llocs',
  'plan.workspace.toggleDay': 'Desplega o plega {day}',
  'plan.workspace.days': 'Dies',
  'plan.workspace.showPanel': 'Mostra el tauler {label}',
  'plan.workspace.hidePanel': 'Amaga el tauler {label}',
  'plan.workspace.narrowPanel': 'Estreny {label}',
  'plan.workspace.widenPanel': 'Eixampla {label}',
  'collab.sections.tabsLabel': 'Seccions de col·laboració',
  'collab.sections.trigger': 'Tria les seccions',
  'collab.sections.menuLabel': 'Mostra a tothom d’aquest viatge',
  'collab.sections.keepOne': 'Com a mínim una secció ha de continuar activa.',
  'collab.sections.failed': 'El canvi no s’ha desat',
  'collab.sections.failedBody': 'El menú mostra l’estat desat actualment.',
  'collab.sections.someHidden':
    'Algunes seccions estan ocultes en aquest viatge.',
  'collab.sections.turnedOff':
    'Aquesta secció s’ha desactivat per al viatge. Es tancarà quan enviïs o esborris el que estàs escrivint.',
  'collab.sections.changed': 'Les seccions d’aquest viatge han canviat.',
  'collab.sections.savedHidden':
    'Desat. Aquesta secció està oculta per al viatge i ara es tancarà.',
} satisfies TranslationOf<typeof En>

export default messages
