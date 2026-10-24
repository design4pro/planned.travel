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
    'Les idees són llocs que esperen un dia. Una nota sempre pertany a un dia.',
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
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Edita el lloc',
  'plan.stop.menu.setTime': 'Defineix una hora',
  'plan.stop.menu.placeOnMap': 'Situa-ho al mapa',
  'plan.stop.menu.movePin': 'Mou-ne la xinxeta',
  'plan.stop.menu.moveToDay': 'Mou a un altre dia',
  'plan.stop.menu.backToUnplanned': 'Torna a sense planificar',
  'plan.stop.menu.delete': 'Elimina del viatge',
  'plan.stop.visited': 'Visitat',
  'plan.delete.title': 'Vols eliminar «{name}»?',
  'plan.delete.titleUnnamed': 'Vols eliminar aquest lloc?',
  'plan.delete.bodyUnplanned':
    'Desapareix del tot dels llocs del viatge. Aquesta acció no es pot desfer.',
  'plan.delete.bodyOnDays': {
    one: 'És en {count} dia d’aquest viatge i en desapareix. Aquesta acció no es pot desfer.',
    many: 'És en {count} dies d’aquest viatge i desapareix de tots. Aquesta acció no es pot desfer.',
    other:
      'És en {count} dies d’aquest viatge i desapareix de tots. Aquesta acció no es pot desfer.',
  },
  'plan.delete.error': 'No s’ha pogut eliminar',
  'plan.delete.confirm': 'Elimina el lloc',
  'plan.delete.deleting': 'S’està eliminant el lloc',
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
  'plan.handoff.day.part': 'Part {n} de {count}',
  'plan.handoff.day.directionsPartName':
    'Indicacions a {service}, part {n} de {count}, {day} (s’obre en una pestanya nova)',
  'plan.handoff.day.directionsPartialPartName':
    'Indicacions a {service}, part {n} de {count}, parades: les primeres {carried} de {total}, {day} (s’obre en una pestanya nova)',
  'plan.handoff.day.pointPartName':
    'Mostra a {service}, part {n} de {count}, {day} (s’obre en una pestanya nova)',
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
  'plan.note.moveToDay': 'Mou a un altre dia',
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
  'book.readOnly.archived':
    'Aquest viatge està arxivat, així que les reserves i les estades són només de lectura. Restaura el viatge per canviar-les.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Aquest canvi s’ha rebutjat. Revisa l’estat actual del viatge abans de fer més canvis.',
  'transports.recovery.failed':
    'No s’ha pogut actualitzar el viatge. Torna-ho a provar abans de fer canvis.',
  'transports.readOnly.archived':
    'Aquest viatge està arxivat. Restaura’l per modificar els transports.',
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
  'plan.place.error.save':
    'No s’ha pogut desar el lloc. Torneu-ho a provar d’aquí a un moment.',
  'plan.stop.error.saveTimes':
    'No s’han pogut desar els horaris de la parada. Torneu-ho a provar d’aquí a un moment.',
  'plan.place.error.delete':
    'No s’ha pogut eliminar el lloc. Torneu-ho a provar d’aquí a un moment.',
  'plan.pin.error.move':
    'No s’ha pogut moure el marcador. Torneu-ho a provar d’aquí a un moment.',
  'plan.place.toast.created': 'Lloc afegit',
  'plan.place.toast.updated': 'Lloc actualitzat',
  'plan.stop.toast.timesSaved': 'Horaris de la parada desats',
  'plan.place.toast.deleted': 'Lloc eliminat',
  'plan.pin.toast.moved': 'S’ha fixat {name}',
  'join.page.title': 'Enllaç d’invitació al viatge',
  'join.page.description':
    'Obre aquest enllaç per unir-te a un viatge compartit a planned.travel.',
  'join.title.invited': '{inviter} t’ha convidat a un viatge',
  'join.requirement':
    'Aquest enllaç funciona per a les persones que ja són a l’espai de treball de {inviter}.',
  'join.newHere':
    'Primera vegada aquí? Demana a {inviter} que primer t’afegeixi al seu espai de treball.',
  'join.trip.label': 'Viatge',
  'join.role.label': 'Hi entraries com a',
  'join.dates.label': 'Dates del viatge',
  'join.destination.label': 'Destinació',
  'join.action.signIn': 'Entra',
  'join.action.join': 'Uneix-te al viatge',
  'join.action.joining': 'Unint-te al viatge',
  'join.action.open': 'Obre el viatge',
  'join.action.openIn': 'Obre el viatge i canvia d’espai de treball',
  'join.action.openIn.pending': 'S’està canviant d’espai de treball',
  'join.loading': 'S’està carregant la invitació',
  'join.joined.title': 'Ja ets al viatge',
  'join.joined.body': 'Obre’l per veure el pla.',
  'join.member.title': 'Ja formes part d’aquest viatge',
  'join.needsWorkspace.title':
    'Aquest viatge és en un espai de treball del qual no formes part',
  'join.needsWorkspace.body':
    'Demana a {inviter} que primer t’afegeixi al seu espai de treball i torna a obrir aquest enllaç.',
  'join.needsWorkspace.signedInAs':
    'Has iniciat la sessió com a {email}. Digues a {inviter} que faci servir aquesta adreça.',
  'join.needsWorkspace.acceptFirst':
    'Si ja tens un correu d’invitació a un espai de treball, accepta’l primer i torna a obrir aquest enllaç.',
  'join.needsWorkspace.otherAccount': 'Entra amb un altre compte',
  'join.unavailable.title': 'Aquest enllaç d’invitació no està disponible',
  'join.unavailable.body':
    'És possible que l’enllaç s’hagi substituït o desactivat. Demana’n un de nou a qui te’l va enviar.',
  'join.unavailable.signIn': 'Entra',
  'join.unavailable.trips': 'Ves als teus viatges',
  'join.error.title': 'No hem pogut carregar aquest enllaç d’invitació',
  'join.error.retry': 'Torna-ho a provar',
  'join.error.busy':
    'Aquesta pàgina està saturada. Torna-ho a provar d’aquí a un minut.',
  'join.error.join':
    'No s’ha pogut entrar al viatge. L’enllaç encara funciona; torna-ho a provar.',
  'join.error.switch':
    'No s’ha pogut canviar d’espai de treball. Torna-ho a provar.',

  'invite.title': 'Enllaç d’invitació',
  'invite.description':
    'Qualsevol persona d’aquest espai que obri l’enllaç s’uneix al viatge.',
  'invite.empty.title': 'Encara no hi ha cap enllaç',
  'invite.empty.body':
    'Crea un enllaç i comparteix-lo al xat del grup perquè les persones d’aquest espai s’hi puguin unir.',
  'invite.action.create': 'Crea l’enllaç',
  'invite.link.label': 'Enllaç d’invitació',
  'invite.copy': 'Copia l’enllaç',
  'invite.copied': 'Enllaç copiat',
  'invite.copyFailed':
    'No s’ha pogut copiar. Selecciona l’enllaç i copia’l manualment.',
  'invite.switch.label':
    'Qualsevol persona d’aquest espai amb l’enllaç s’hi pot unir',
  'invite.switch.onHint':
    'Desactivar-lo invalida l’enllaç per a tothom, incloses les còpies ja enviades.',
  'invite.switch.offHint':
    'Reactivar-lo crea un enllaç nou. Els anteriors continuen sense funcionar.',
  'invite.off.body': 'L’enllaç està desactivat. Ningú no s’hi pot unir.',
  'invite.uses': {
    one: 'Persones que s’han unit amb aquest enllaç: {count}',
    many: 'Persones que s’han unit amb aquest enllaç: {count}',
    other: 'Persones que s’han unit amb aquest enllaç: {count}',
  },
  'invite.uses.never': 'Encara ningú no s’ha unit amb aquest enllaç.',
  'invite.lastUsed': 'Última incorporació: {when}',
  'invite.role.upgrade.title': 'Voleu donar permís d’edició?',
  'invite.role.upgrade.body':
    'S’aplica a totes les còpies ja enviades i a qui s’uneixi a partir d’ara.',
  'invite.role.upgrade.confirm': 'Dona permís d’edició',
  'invite.replace.action': 'Substitueix l’enllaç',
  'invite.replace.title': 'Voleu substituir aquest enllaç?',
  'invite.replace.body':
    'L’enllaç anterior deixarà de funcionar immediatament per a tothom. Qui ja s’ha unit continuarà al viatge; elimina’l de la llista inferior si cal.',
  'invite.replace.deadBody':
    'L’enllaç anterior ja no funciona. Qui ja s’ha unit continua al viatge.',
  'invite.replace.confirm': 'Substitueix l’enllaç',
  'invite.replace.pending': 'S’està substituint l’enllaç',
  'invite.stale': 'Aquest enllaç ja no funciona. Substitueix-lo.',
  'invite.creatorGone':
    'L’enllaç ja no funciona perquè qui el va crear ja no és propietari. Substitueix-lo.',
  'invite.archived':
    'Aquest viatge està arxivat. L’enllaç tornarà a funcionar quan es restauri.',
  'invite.announce.created': 'Enllaç d’invitació creat',
  'invite.announce.roleEditor': 'Qui s’uneixi podrà editar',
  'invite.announce.off': 'Enllaç d’invitació desactivat',
  'invite.announce.newLink':
    'El nou enllaç ja està llest. Copia’l i envia’l de nou.',
  'invite.announce.roleViewer': 'Qui s’uneixi podrà veure el viatge',
  'invite.error.title': 'No s’ha pogut carregar l’enllaç',
  'invite.error.retry': 'Torna-ho a provar',
  'invite.refusal.archived': 'Aquest viatge està arxivat.',
  'invite.refusal.notOwner':
    'Només un propietari del viatge pot canviar l’enllaç.',
  'invite.refusal.changed': 'Algú ha canviat l’enllaç. Es mostra l’actual.',
  'invite.announce.recovered':
    'Es mostren els ajustos actuals de l’enllaç. Revisa’ls abans de fer un altre canvi.',
} satisfies TranslationOf<typeof En>

export default messages
