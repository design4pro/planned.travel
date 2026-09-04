/**
 * The trip modules' own copy, in ca.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`. Cometes «…».
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Sense definir',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'S’està connectant',
  'presence.connecting.body':
    'Estem entrant a la sala en directe d’aquest viatge.',
  'presence.live.title': 'En directe',
  'presence.live.body':
    'Els missatges, les notes i els vots arriben aquí a mesura que es fan.',
  'presence.reconnecting.title': 'S’està reconnectant',
  'presence.reconnecting.body':
    'La connexió ha caigut. Ho tornem a provar: tot el que enviïs es desa igualment.',
  'presence.offline.title': 'Sense directe',
  'presence.offline.body':
    'Les actualitzacions en directe estan apagades. Tot es continua desant; recarrega o torna-ho a provar per posar-te al dia.',
  'presence.reconnect': 'Reconnecta',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Tots els trajectes',
  'transports.empty.title': 'Encara no hi ha trajectes',
  'transports.empty.body':
    'Vols, trens, ferris i el trajecte des de l’aeroport viuen aquí, amb els codis de reserva i els números de seient a mà el dia bo — i cada enllaç comprovat contra l’anterior.',
  'transports.empty.action': 'Afegeix el primer trajecte',
  'transports.filtered.title': 'No hi ha trajectes d’aquesta mena',
  'transports.filtered.body':
    'Cada trajecte d’aquest viatge va d’una manera diferent. Torna a «{label}» per veure’ls tots.',
  'transports.filtered.action': 'Mostra tots els trajectes',
  'transports.alert.impossible.title': {
    one: 'Un enllaç no es pot fer',
    many: '{value} enllaços no es poden fer',
    other: '{value} enllaços no es poden fer',
  },
  'transports.alert.impossible.body':
    'Un trajecte surt abans que arribi l’anterior. Els nusos de sota diuen quins i per quant.',
  'transports.alert.tight.title': {
    one: 'Un enllaç va just',
    many: '{value} enllaços van justos',
    other: '{value} enllaços van justos',
  },
  'transports.alert.tight.body':
    'Hi ha temps, però poc per al mitjà que has d’agafar. Els nusos de sota mostren quant en deixa cadascun.',
  'transports.badge.impossible': {
    one: '{value} enllaç trencat',
    many: '{value} enllaços trencats',
    other: '{value} enllaços trencats',
  },
  'transports.badge.tight': {
    one: '{value} enllaç just',
    many: '{value} enllaços justos',
    other: '{value} enllaços justos',
  },
  'transports.badge.ok': 'Tots els enllaços funcionen',
  'transports.remove.body':
    'El trajecte surt d’aquest viatge per sempre, amb la referència de la reserva i el seient. Si només està cancel·lat, posa-li l’estat «Cancel·lat» en comptes d’això.',
  'transports.remove.confirm': 'Elimina el trajecte',
  'transports.menu.edit': 'Edita el trajecte…',
  'transports.field.service': 'Servei',
  'transports.field.bookingRef': 'Referència de reserva',
  'transports.field.seat': 'Seient',
  'transports.field.distance': 'Distància',
  'transports.noTime': 'Encara sense hora',
  'transports.toast.statusFailed.title': 'L’estat no ha canviat',
  'transports.toast.statusFailed.body':
    'El trajecte s’ha quedat en el seu estat anterior.',
  'transports.toast.removed': 'Trajecte eliminat',
  'transports.toast.removeFailed': 'El trajecte no s’ha eliminat',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Afegeix un trajecte',
  'transports.dialog.editTitle': 'Edita aquest trajecte',
  'transports.dialog.description':
    'Vols, trens, ferris i el trajecte des de l’aeroport. Les hores són les locals impreses al bitllet.',
  'transports.form.modeLegend': 'Com viatges',
  'transports.form.timingError': 'Comprova les hores',
  'transports.field.namePlaceholder': 'Vueling de BCN a HND',
  'transports.field.place': 'Lloc',
  'transports.field.code': 'Codi',
  'transports.field.date': 'Data',
  'transports.field.departurePlaceholder': 'Barcelona el Prat',
  'transports.field.arrivalPlaceholder': 'Tòquio Haneda',
  'transports.field.carrier': 'Companyia',
  'transports.field.serviceNumber': 'Número de servei',
  'transports.field.bookingRefHint': 'El codi que diràs al taulell.',
  'transports.field.notesPlaceholder':
    'Demanat seient de passadís. Equipatge facturat fins a Kyoto.',
  'transports.action.add': 'Afegeix el trajecte',
  'transports.action.save': 'Desa el trajecte',
  'transports.action.saving': 'S’està desant el trajecte',
  'transports.toast.added': 'Trajecte afegit',
  'transports.toast.addedBody': 'Ja és a l’ordre del viatge.',
  'transports.toast.addFailed': 'El trajecte no s’ha afegit',
  'transports.toast.updated': 'Trajecte actualitzat',
  'transports.toast.updateFailed': 'El trajecte no s’ha actualitzat',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Nom',
  'field.time': 'Hora',
  'field.price': 'Preu',
  'field.notes': 'Observacions',
  'field.status': 'Estat',
  'form.saveError': 'Això no s’ha desat',
  'action.cancel': 'Cancel·la',
  'book.status.none': 'Sense estat',
  'book.status.pending': 'Pendent',
  'book.status.confirmed': 'Confirmada',
  'book.status.completed': 'Feta',
  'book.status.cancelled': 'Cancel·lada',
  'book.toast.statusFailed': 'L’estat no ha canviat',
  'book.toast.statusFailedBody':
    'La reserva s’ha quedat en el seu estat anterior.',
  'book.toast.removed': 'Reserva eliminada',
  'book.toast.removeFailed': 'La reserva no s’ha eliminat',
  'book.empty.title': 'Encara no hi ha res reservat',
  'book.empty.body':
    'Allotjaments, taules, visites i entrades van aquí — amb el número de confirmació allà on el trobaràs a la porta, i la data que les col·loca a la línia de temps.',
  'book.empty.action': 'Afegeix la primera reserva',
  'book.filtered.title': 'Res en aquest estat',
  'book.filtered.body':
    'Cada reserva d’aquest viatge està en una fase diferent. Torna a «{label}» per veure-les totes.',
  'book.filtered.action': 'Mostra-ho tot',
  'filter.all': 'Tot',
  'book.remove.body':
    'Surt de la línia de temps per sempre. Si només està cancel·lada, posa-li l’estat «Cancel·lada» per conservar-ne el registre.',
  'book.remove.confirm': 'Elimina la reserva',
  'book.menu.edit': 'Edita la reserva…',
  'book.menu.open': 'Obre la reserva',
  'book.noDate': 'Encara sense data',
  'book.until': 'Fins',
  'book.provider': 'Proveïdor',
  'book.where': 'On',
  'book.guests': 'Persones',
  'book.confirmation': 'Confirmació',
  'book.undated': 'Dona’ls una data i entren a la línia de temps',
  statusOf: 'Estat de {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Encara sense estat',
  'book.statusChoice.pending': 'Pendent — depèn d’ells',
  'book.dialog.addTitle': 'Afegeix una reserva',
  'book.dialog.editTitle': 'Edita aquesta reserva',
  'book.dialog.typeLegend': 'Quina mena de reserva',
  'book.field.namePlaceholder': 'Carrer de Mallorca 15',
  'book.field.priceHint': 'Deixa-ho buit si encara no està pagat.',
  'book.field.confirmation': 'Número de confirmació',
  'book.field.confirmationHint': 'El codi que et demanaran al taulell.',
  'book.field.day': 'Vincula a un dia',
  'book.field.dayHint': 'La fixa a l’itinerari perquè surti al pla.',
  'book.field.noDay': 'Fora de l’itinerari',
  'book.field.link': 'Enllaç',
  'book.field.notesPlaceholder':
    'Arribada tardana acordada. Demana una habitació lluny de l’ascensor.',
  'book.action.add': 'Afegeix la reserva',
  'book.action.save': 'Desa la reserva',
  'book.action.saving': 'S’està desant la reserva',
  'book.toast.added': 'Reserva afegida',
  'book.toast.addedBody': 'Ja és a la línia de temps.',
  'book.toast.addFailed': 'La reserva no s’ha afegit',
  'book.toast.updated': 'Reserva actualitzada',
  'book.toast.updateFailed': 'La reserva no s’ha actualitzat',

  'book.emptyFacts':
    'A part del nom encara no hi ha res. Obre-ho per afegir l’hora, el preu i el número de confirmació.',
  'book.onItinerary': 'A l’itinerari: {day}',
  'book.dayNumber': 'Dia {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Altre',
  'book.field.host': 'Hotel o amfitrió',
  'book.field.restaurant': 'Nom del restaurant',
  'book.field.operator': 'Organitzador',
  'book.field.issuer': 'Emès per',
  'book.field.carrier': 'Transportista',
  'book.field.address': 'Adreça',
  'book.field.meetingPoint': 'Punt de trobada',
  'book.field.venue': 'Recinte',
  'book.field.fromTo': 'Des d’on i cap a on',
  'book.field.checkIn': 'Entrada',
  'book.field.date': 'Data',
  'book.field.validOn': 'Vàlid el',
  'book.field.departs': 'Surt',
  'book.field.checkOut': 'Sortida',
  'book.field.ends': 'Acaba',
  'book.field.arrives': 'Arriba',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Museu Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Qui t’ho està guardant',
  'book.example.accommodationTitle':
    'Hotel Gracery Shinjuku · 2 habitacions twin',
  'book.example.restaurantTitle': 'Sopar al Den',
  'book.example.activityTitle': 'teamLab Planets, 4 entrades',
  'book.example.tourTitle': 'Passejada pel bosc de bambú d’Arashiyama',
  'book.example.ticketTitle': 'Museu Ghibli, entrada a les 10:00',
  'book.example.transportTitle': 'Nozomi 21 cap a Kyoto',
  'book.example.otherTitle': 'Què has reservat',
  'book.hint.accommodation':
    'Un hotel, un ryokan, un apartament — onsevulla que dormis.',
  'book.hint.restaurant':
    'Una taula reservada. L’hora és el que et reclamaran.',
  'book.hint.activity': 'Una classe, uns banys, una experiència reservada.',
  'book.hint.tour': 'Un lloc, una hora i un guia esperant.',
  'book.hint.ticket':
    'Una entrada amb hora, un passi de museu, un partit. Tingues el codi a mà.',
  'book.hint.transport':
    'Un seient reservat. Els trajectes sencers amb codis van a {module}.',
  'book.hint.other': 'Qualsevol cosa al teu nom que no encaixi a les altres.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Equipatge',
  'lists.kind.todo': 'Per fer',
  'lists.kind.shopping': 'Compres',
  'lists.kind.documents': 'Documentació',
  'lists.kind.fallback': 'Llista',
  'colour.none': 'Sense color',
  'colour.pine': 'Pi',
  'colour.inkBlue': 'Blau tinta',
  'colour.amber': 'Ambre',
  'colour.green': 'Verd',
  'colour.red': 'Vermell',
  'colour.slate': 'Pissarra',
  'lists.toast.created': 'Llista creada',
  'lists.toast.createdBody': 'Afegeix la primera cosa que no pots oblidar.',
  'lists.toast.createFailed': 'La llista no s’ha creat',
  'lists.toast.updated': 'Llista actualitzada',
  'lists.toast.updateFailed': 'La llista no s’ha actualitzat',
  'lists.error.weightLimit': 'Un límit de pes és un nombre enter de grams.',
  'lists.dialog.editTitle': 'Edita aquesta llista',
  'lists.dialog.editBody':
    'Canvia-li el nom, el tipus, o passa-la a un sol viatger.',
  'lists.dialog.addBody':
    'Equipatge, coses per fer, compres i els documents que no pots oblidar: cada cosa amb la seva llista.',
  'lists.action.new': 'Llista nova',
  'lists.field.namePlaceholder': 'Equipatge de mà',
  'lists.field.kind': 'Tipus',
  'lists.field.kindAria': 'Tipus de llista',
  'lists.field.owner': 'Pertany a',
  'lists.field.ownerHint': 'Les llistes compartides les marca qualsevol.',
  'lists.field.everyone': 'Tothom del viatge',
  'lists.field.weightLimit': 'Límit de pes',
  'lists.field.weightLimitHint':
    'Grams. Deixa-ho buit si no hi ha cap límit a respectar.',
  'colour.legend': 'Color',
  'lists.action.saving': 'S’està desant la llista',
  'lists.action.save': 'Desa la llista',
  'lists.action.create': 'Crea la llista',
  'lists.item.toast.added': 'Element afegit',
  'lists.item.toast.addFailed': 'L’element no s’ha afegit',
  'lists.item.toast.updated': 'Element actualitzat',
  'lists.item.toast.updateFailed': 'L’element no s’ha actualitzat',
  'lists.item.error.quantity': 'Una quantitat és un nombre enter d’1 a 999.',
  'lists.item.error.weight': 'Un pes és un nombre enter de grams.',
  'lists.item.dialog.editTitle': 'Edita aquest element',
  'lists.item.dialog.addTitle': 'Afegeix un element',
  'lists.item.field.label': 'Element',
  'lists.item.field.placeholder': 'Passaport',
  'field.category': 'Categoria',
  'lists.item.field.categoryHint':
    'Agrupa la llista sota un encapçalament. Opcional.',
  'lists.item.field.categoryPlaceholder': 'Documentació',
  'lists.item.field.priority': 'Prioritat',
  'lists.priorityChoice.high': 'Alta: no ho oblidis',
  'lists.priorityChoice.low': 'Baixa: si hi queda lloc',
  'lists.priorityChoice.normal': 'Mitjana',
  'lists.item.field.quantity': 'Quantitat',
  'lists.item.field.weight': 'Pes',
  'lists.item.field.weightHint': 'Grams, per unitat.',
  'lists.item.field.owner': 'De qui és aquesta feina',
  'lists.item.owner.nobody': 'Ningú en concret',
  'lists.item.action.saving': 'S’està desant l’element',
  'lists.item.action.save': 'Desa l’element',
  'lists.item.action.add': 'Afegeix a la llista',
  'lists.template.loadError':
    'Ara mateix no s’han pogut carregar les plantilles.',
  'lists.template.toast.added': 'Llista afegida des d’una plantilla',
  'lists.template.toast.addFailed': 'La plantilla no s’ha aplicat',
  'lists.template.error.apply': 'Això no s’ha pogut aplicar',
  'lists.template.error.load': 'Les plantilles no s’han carregat',
  'lists.template.empty.title': 'Encara no hi ha plantilles',
  'lists.template.empty.body':
    'Desa una llista com a plantilla quan en tinguis una que tornaries a muntar igual, i sortirà aquí a cada viatge futur.',
  'lists.template.applying': 'S’està aplicant la plantilla',
  'lists.template.dialogTitle': 'Comença des d’una plantilla',
  'lists.template.loading': 'S’estan carregant les plantilles',
  'lists.template.apply': 'Aplica la plantilla',
  'lists.template.from': 'Des d’una plantilla',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Sense assignar',
  'lists.toast.listRemoved': 'Llista eliminada',
  'lists.toast.listRemoveFailed': 'La llista no s’ha eliminat',
  'lists.toast.itemRemoved': 'Element eliminat',
  'lists.toast.itemRemoveFailed': 'L’element no s’ha eliminat',
  'lists.toast.reset': 'Llista reiniciada',
  'lists.toast.resetBody': 'Tot està desmarcat i a punt per al viatge següent.',
  'lists.toast.resetFailed': 'La llista no s’ha reiniciat',
  'lists.toast.tickFailed': 'La marca no s’ha desat',
  'lists.toast.tickFailedBody': 'L’element ha tornat com era.',
  'lists.toast.assignFailed': 'L’assignació no s’ha desat',
  'lists.toast.orderFailed': 'El nou ordre no s’ha desat',
  'lists.toast.orderFailedBody': 'La llista ha tornat com era.',
  'lists.filter.todo': 'Encara per fer',
  'lists.filter.done': 'Fet',
  'lists.scope.all': 'Totes les llistes',
  'lists.scope.shared': 'Compartides',
  'lists.scope.mine': 'Meves',
  'lists.empty.mine.title': 'Encara no tens llistes pròpies',
  'lists.empty.shared.title': 'Encara no hi ha llistes compartides',
  'lists.empty.mine.body':
    'Una llista teva només la marques tu: útil per a les coses que ningú més no ha de veure.',
  'lists.empty.shared.body':
    'Una llista compartida la marca qualsevol, així dues persones no s’emporten el mateix adaptador.',
  'lists.remove.list': 'Elimina la llista',
  'lists.remove.item': 'Elimina l’element',
  'lists.remove.itemBody': 'Surt d’aquesta llista. Res més no canvia.',
  'lists.menu.editList': 'Edita la llista…',
  'lists.menu.tickAll': 'Marca-ho tot',
  'lists.menu.untickAll': 'Desmarca-ho tot',
  'lists.menu.reset': 'Reinicia per al viatge següent',
  'lists.menu.dragOrderLong': 'Canvia a un ordre que puguis arrossegar',
  'lists.menu.groupAgain': 'Torna a agrupar per categoria',
  'lists.menu.dragOrder': 'Canvia a un ordre arrossegable',
  'lists.menu.groupByCategory': 'Agrupa per categoria',
  'lists.weight.packed': '{weight} a la maleta',
  'lists.weight.packedOver': '{weight} a la maleta: per damunt del límit',
  'lists.weight.packedOf': '{weight} a la maleta de {limit} permesos',
  'lists.weight.packedOfOver':
    '{weight} a la maleta de {limit} permesos: per damunt del límit',
  'lists.progress.ticked': '{done} de {total} marcats',
  'lists.items.empty.title': 'Aquesta llista és buida',
  'lists.items.empty.body':
    'Afegeix la primera cosa que no pots oblidar: el camp de sota és la via més ràpida.',
  'lists.items.doneEmpty.title': 'Encara no hi ha res marcat',
  'lists.items.doneEmpty.body': 'Marca alguna cosa i sortirà aquí.',
  'lists.items.todoEmpty.title': 'Aquí ja està tot fet',
  'lists.items.todoEmpty.body':
    'Tots els elements d’aquesta llista estan marcats. Canvia a «{label}» per veure’ls.',
  'lists.category.other': 'Tota la resta',
  'lists.dnd.fallbackName': 'aquest element',
  'lists.dnd.picked': '{name} agafat.',
  'lists.dnd.dropped': '{name} deixat. S’està desant el nou ordre.',
  'lists.dnd.cancelled': 'Cancel·lat. L’ordre no ha canviat.',
  'lists.menu.editItem': 'Edita l’element…',
  'lists.quickAdd.placeholder': 'Escriu un element i prem Retorn',
  'lists.quickAdd.aria': 'Afegeix un element a aquesta llista',
  'lists.quickAdd.detailsHint':
    'Afegeix amb un pes, una categoria o una persona',
  'lists.quickAdd.detailsAria': 'Afegeix un element amb tots els detalls',
  'lists.show': 'Mostra',
  'lists.priority.high': 'Alta',
  'lists.action.add': 'Afegeix',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} element',
    many: '{count} elements',
    other: '{count} elements',
  },
  'lists.template.copiedIn': {
    one: '{count} element copiat, a punt per marcar.',
    many: '{count} elements copiats, a punt per marcar.',
    other: '{count} elements copiats, a punt per marcar.',
  },
  'lists.remove.listBody': {
    one: 'La llista i el seu {count} element surten d’aquest viatge. Les plantilles desades no es toquen.',
    many: 'La llista i els seus {count} elements surten d’aquest viatge. Les plantilles desades no es toquen.',
    other:
      'La llista i els seus {count} elements surten d’aquest viatge. Les plantilles desades no es toquen.',
  },

  'lists.item.dialog.body':
    'Tot excepte el nom és opcional: un pes fa real el total de la maleta, i una categoria agrupa la llista.',
  'lists.template.dialogBody':
    'Una plantilla és una llista que ja has desat. Aplicar-ne una la copia com a llista nova en aquest viatge: l’original es queda igual.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': 'Vols eliminar «{name}»?',
  actionsFor: 'Accions per a {name}',
  'lists.dnd.reorder': 'Reordena {name}',
  'lists.action.untickItem': 'Desmarca {name}',
  'lists.action.tickOffItem': 'Marca {name}',
  'lists.item.assignAria': 'Assigna {name} a algú',
  'lists.item.reassignAria': '{item} és de {owner}: reassigna-ho',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Posa-li a aquesta reserva un nom que reconeguis en una llista.',
  'error.titleLong': 'Mantén el nom per sota de 160 caràcters.',
  'book.error.required': 'A aquesta reserva li falta: {field}.',
  'book.error.timeNeedsDate': 'Una hora necessita el dia en què cau.',
  'book.error.endTimeNeedsDate': 'Una hora de fi necessita el dia en què cau.',
  'book.error.endsBeforeStart': 'Això acaba abans de començar.',
  'book.error.endTimeBeforeStart': 'L’hora de fi és anterior a la d’inici.',
  'book.error.guests': 'El nombre de persones ha de ser un enter fins a 1000.',
  'error.price': 'Aquest import no el sabem llegir.',
  'book.error.url': 'Un enllaç ha de començar per http:// o https://.',
  'book.error.confirmationLong':
    'Aquest número de confirmació és massa llarg per desar-lo.',
  'book.fieldName.provider': 'operador',
  'book.fieldName.location': 'lloc',
  'book.fieldName.confirmationNumber': 'número de confirmació',
  'book.fieldName.link': 'enllaç',
  'book.fieldName.date': 'data',
  'book.fieldName.time': 'hora',
  'book.fieldName.endDate': 'data de fi',
  'book.fieldName.endTime': 'hora de fi',
  'book.fieldName.guests': 'nombre de persones',
  'book.fieldName.price': 'preu',
  'book.copyConfirmation': 'el número de confirmació de {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Vol',
  'transports.mode.train': 'Tren',
  'transports.mode.bus': 'Autobús',
  'transports.mode.ferry': 'Ferri',
  'transports.mode.car': 'Cotxe',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Transport',
  'transports.mode.metro': 'Metro',
  'transports.mode.tram': 'Tramvia',
  'transports.mode.bike': 'Bici',
  'transports.mode.walk': 'A peu',
  'transports.mode.other': 'Altre',
  'transports.mode.fallback': 'Trajecte',
  'transports.status.idea': 'Idea',
  'transports.status.pending': 'Pendent',
  'transports.status.confirmed': 'Confirmat',
  'transports.status.completed': 'Fet',
  'transports.status.cancelled': 'Anul·lat',
  'transports.end.fromAirport': 'Aeroport de sortida',
  'transports.end.toAirport': 'Aeroport d’arribada',
  'transports.end.fromPort': 'Port de sortida',
  'transports.end.toPort': 'Port d’arribada',
  'transports.end.fromStation': 'Estació de sortida',
  'transports.end.toStation': 'Estació d’arribada',
  'transports.end.from': 'Des de',
  'transports.end.to': 'Fins a',
  'transports.error.titleEmpty':
    'Posa-li a aquest trajecte un nom que reconeguis en una llista.',
  'transports.error.date': 'Una data s’escriu AAAA-MM-DD.',
  'transports.error.time': 'Una hora s’escriu HH:MM en format de 24 hores.',
  'transports.error.departureNeedsDate':
    'Una hora de sortida necessita el dia en què cau.',
  'transports.error.arrivalNeedsDate':
    'Una hora d’arribada necessita el dia en què cau.',
  'transports.error.code': 'Un codi té de 2 a 8 lletres o dígits.',
  'transports.error.distance':
    'Una distància és un nombre de quilòmetres, fins a 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Aquest trajecte arriba abans de sortir.',
  'transports.error.timingHint':
    'Mou-ne un dels dos perquè el trajecte es pugui agafar de debò.',
  'transports.bookingRefFor': 'la referència de reserva de {title}',
  'transports.doorToDoor': 'Són {gap} de porta a porta.',
  'transports.title.fromTo': '{operator} de {from} a {to}',
  'transports.title.from': '{operator} des de {from}',
  'transports.title.to': '{operator} cap a {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'No hi ha hores per comparar',
  'transports.junction.unknown.detail':
    'Posa data i hora als dos trajectes i aquesta connexió es comprovarà per tu.',
  'transports.junction.impossible.headline':
    'Surt {gap} abans que arribi el trajecte anterior',
  'transports.junction.impossible.detail':
    '«{to}» surt abans que arribi «{from}», així que no es poden agafar tots dos. Mou-ne un.',
  'transports.junction.tight.headline': '{gap} per enllaçar',
  'transports.junction.tight.detail':
    'Per a {mode} normalment cal una {required}. Aquest va just.',
  'transports.junction.tight.detailAt':
    'Per a {mode} a {place} normalment cal una {required}. Aquest va just.',
  'transports.junction.ok.headline': '{gap} de marge',
  'transports.junction.ok.detail':
    'Arriba a {landing} però el trajecte següent surt de {boarding}: caldrà travessar.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Nota compartida',
  'collab.note.toast.sharedBody': 'Tothom del viatge ja la veu.',
  'collab.note.toast.shareFailed': 'La nota no s’ha compartit',
  'collab.note.toast.updated': 'Nota actualitzada',
  'collab.note.toast.updateFailed': 'La nota no s’ha actualitzat',
  'collab.note.dialog.editTitle': 'Edita aquesta nota',
  'collab.note.dialog.addTitle': 'Nota compartida nova',
  'collab.note.dialog.body':
    'Restaurants recomanats, normes de visat, el codi del portal: tot allò que el viatge sencer ha de recordar, en un sol lloc.',
  'collab.note.field.title': 'Títol',
  'collab.note.field.titlePlaceholder': 'Codi del portal',
  'collab.note.field.body': 'Nota',
  'collab.note.field.bodyPlaceholder':
    '4821 i després el coixinet. La caixa de claus és a l’esquerra de la porta.',
  'collab.note.field.categoryHint':
    'Agrupa el tauler sota un filtre. Opcional.',
  'collab.note.field.categoryPlaceholder': 'Logística',
  'collab.note.field.pin': 'Fixa a dalt del tauler',
  'collab.note.field.pinHint':
    'Les notes fixades van primer, s’hi afegeixi el que s’hi afegeixi.',
  'collab.note.action.saving': 'S’està desant la nota',
  'collab.note.action.save': 'Desa la nota',
  'collab.note.action.share': 'Comparteix la nota',
  'collab.poll.toast.opened': 'Votació oberta',
  'collab.poll.toast.openedBody': 'Tothom del viatge ja pot votar.',
  'collab.poll.toast.openFailed': 'La votació no s’ha obert',
  'collab.poll.dialog.addTitle': 'Votació nova',
  'collab.poll.field.question': 'Pregunta',
  'collab.poll.field.questionPlaceholder': 'On sopem l’última nit?',
  'collab.poll.field.optionsLegend': 'Opcions de vot',
  'collab.poll.field.option': 'Resposta {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Una altra resposta',
  'collab.poll.action.addOption': 'Afegeix una resposta',
  'collab.poll.action.removeOption': 'Elimina la resposta {n}',
  'collab.poll.field.multi': 'Permet triar-ne més d’una',
  'collab.poll.field.multiHint':
    'Desactivat vol dir un vot per persona, i canviar d’opinió el mou.',
  'collab.poll.action.opening': 'S’està obrint la votació',
  'collab.poll.action.open': 'Obre la votació',
  'collab.poll.error.tooFew':
    'Una votació necessita com a mínim dues coses per triar.',
  'collab.poll.error.duplicate':
    'Dues respostes diuen el mateix. Dona a cadascuna la seva redacció.',
  'collab.presence.viewingNow': 'ho estan veient ara',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} pestanya oberta',
    many: '{name} — {count} pestanyes obertes',
    other: '{name} — {count} pestanyes obertes',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Hi estic d’acord',
  'collab.reaction.love': 'M’encanta',
  'collab.reaction.funny': 'Divertit',
  'collab.reaction.celebrate': 'Celebrem-ho',
  'collab.reaction.thanks': 'Gràcies',
  'collab.reaction.looking': 'Ho miro',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, tu inclòs',
  'collab.thread.today': 'Avui',
  'collab.thread.empty': 'Encara no hi ha missatges',
  'collab.toast.reactionFailed': 'La reacció no s’ha desat',
  'collab.toast.messageDeleted': 'Missatge eliminat',
  'collab.toast.deleteFailed': 'El missatge no s’ha eliminat',
  'collab.toast.notSent': 'No s’ha enviat',
  'collab.toast.notSentBody':
    'El missatge no s’ha pogut enviar. Torna-ho a provar d’aquí a un moment.',
  'collab.toast.messageUpdated': 'Missatge actualitzat',
  'collab.toast.editFailed': 'El canvi no s’ha desat',
  'collab.message.deleteTitle': 'Vols eliminar aquest missatge?',
  'collab.message.deleteBody':
    'El text desapareix del fil. Les respostes es queden on són.',
  'collab.message.delete': 'Elimina el missatge',
  'collab.message.reply': 'Respon',
  'collab.message.menuEdit': 'Edita el missatge…',
  'collab.message.react': 'Reacciona a aquest missatge',
  'collab.message.edited': 'editat',
  'collab.message.actionsFor': 'Accions per al missatge de {name}',
  'collab.compose.editingYours': 'Estàs editant el teu missatge',
  'collab.compose.replyingTo': 'Responent a {name}',
  'collab.compose.cancelReply': 'Cancel·la la resposta',
  'collab.compose.cancelEdit': 'Cancel·la l’edició',
  'collab.compose.placeholder': 'Escriu al viatge',
  'collab.compose.editPlaceholder': 'Edita el teu missatge',
  'collab.compose.editPlaceholderText': 'Canvia el que has dit…',
  'collab.compose.send': 'Envia el missatge',
  'collab.compose.savingEdit': 'S’està desant el canvi',
  'collab.compose.save': 'Desa',
  'collab.hint.sends': 'envia',
  'collab.hint.addsLine': 'afegeix una línia',
  'collab.hint.cancels': 'cancel·la',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Nota eliminada',
  'collab.toast.noteRemoveFailed': 'La nota no s’ha eliminat',
  'collab.notes.empty.title': 'No hi ha notes compartides',
  'collab.notes.empty.body':
    'Restaurants recomanats, normes de visat, el codi del portal: tot allò que el viatge sencer ha de recordar.',
  'collab.notes.empty.action': 'Escriu la primera nota',
  'collab.note.menu.edit': 'Edita la nota…',
  'collab.note.menu.unpin': 'Deixa de fixar',
  'collab.note.menu.pin': 'Fixa a dalt',
  'collab.note.remove': 'Elimina la nota',
  'collab.note.removeBody':
    'La nota desapareix del tauler per a tothom del viatge.',
  'collab.note.new': 'Nota nova',
  'collab.poll.toast.voteFailed': 'El teu vot no s’ha desat',
  'collab.poll.toast.voteFailedBody': 'El recompte no ha canviat.',
  'collab.poll.toast.closed': 'Votació tancada',
  'collab.poll.toast.closeFailed': 'La votació no s’ha tancat',
  'collab.poll.toast.removed': 'Votació eliminada',
  'collab.poll.toast.removeFailed': 'La votació no s’ha eliminat',
  'collab.polls.heading': 'Votacions',
  'collab.polls.empty.title': 'No hi ha votacions obertes',
  'collab.polls.empty.body':
    "Quan el grup no es posa d'acord en un restaurant, sotmeteu-ho a votació i deixeu que la resposta es resolgui sola.",
  'collab.polls.empty.action': 'Pregunta-ho al grup',
  'collab.poll.menu.close': 'Tanca la votació',
  'collab.poll.remove': 'Elimina la votació',
  'collab.poll.removeTitle': 'Vols eliminar aquesta votació?',
  'collab.poll.actionsFor': 'Accions per a la votació «{question}»',
  'collab.badge.pinned': 'Fixada',
  'collab.badge.closed': 'Tancada',
  'collab.badge.open': 'Oberta',
  'collab.badge.multi': 'Tria diverses',
  'collab.badge.leading': 'Va al davant',
  'collab.poll.removeBody': {
    one: '«{question}» i el seu {count} vot desapareixen per a tothom.',
    many: '«{question}» i els seus {count} vots desapareixen per a tothom.',
    other: '«{question}» i els seus {count} vots desapareixen per a tothom.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} de {count} vot',
    many: '{label} — {votes} de {count} vots',
    other: '{label} — {votes} de {count} vots',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} de {count} vot, el teu inclòs',
    many: '{label} — {votes} de {count} vots, el teu inclòs',
    other: '{label} — {votes} de {count} vots, el teu inclòs',
  },
  'collab.poll.voteCount': {
    one: '{count} vot',
    many: '{count} vots',
    other: '{count} vots',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Document',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Entrada',
  'files.kind.receipt': 'Rebut',
  'files.kind.map': 'Mapa',
  'files.kind.other': 'Altre',
  'files.kindChoice.ticket': 'Entrada o passi',
  'files.kindChoice.map': 'Mapa o ruta',
  'files.toast.removed': 'Fitxer eliminat',
  'files.toast.removeFailed': 'El fitxer no s’ha eliminat',
  'files.toast.downloadFailed': 'La baixada no ha arrencat',
  'files.toast.gone':
    'Aquest fitxer ja no està disponible en aquesta pestanya.',
  'files.toast.uploadFailed': 'La pujada ha fallat. Torna-ho a provar.',
  'files.toast.updated': 'Fitxer actualitzat',
  'files.toast.updateFailed': 'El fitxer no s’ha actualitzat',
  'files.storage.full':
    'Aquest espai de treball s’ha quedat sense emmagatzematge',
  'files.storage.used':
    'Se’n fan servir {used} de {limit}. Elimina un fitxer de sota, o puja de pla, abans d’afegir res més.',
  'files.storage.perFile': 'fins a {size} cadascun',
  'files.action.add': 'Afegeix fitxers',
  'files.action.choose': 'Tria fitxers',
  'files.action.upload': 'Puja els fitxers',
  'files.drop.active': 'Deixa-ho anar per pujar',
  'files.drop.idle': 'Arrossega fitxers aquí',
  'files.empty.title': 'No hi ha fitxers en aquest viatge',
  'files.empty.body':
    'Tot allò que altrajecteent hauries de remenar en una safata d’entrada al taulell de facturació és aquí, lligat al viatge a què pertany.',
  'files.empty.hint':
    'Targetes d’embarcament, confirmacions d’hotel, entrades, documents d’assegurança i els rebuts que avalen les teves despeses.',
  'files.heading': 'Adjunts',
  'files.tableCaption': 'Fitxers adjunts a aquest viatge',
  'files.menu.download': 'Baixa',
  'files.menu.rename': 'Canvia el nom i descriu…',
  'files.menu.remove': 'Elimina el fitxer',
  'files.remove.body':
    'El fitxer s’esborra de l’emmagatzematge i també del viatge, i s’alliberen {size}. Això no es pot desfer.',
  'files.queue.clear': 'Neteja els acabats',
  'files.column.file': 'Fitxer',
  'files.column.size': 'Mida',
  'files.column.addedBy': 'Afegit per',
  'files.column.when': 'Quan',
  'files.status.uploaded': 'Pujat',
  'files.status.failed': 'Fallit',
  'files.status.cancelled': 'Cancel·lat',
  'files.status.uploading': 'Pujant',
  'files.status.waiting': 'Esperant',
  'files.error.nameEmpty': 'Un fitxer necessita un nom pel qual el trobis.',
  'files.field.kindHint':
    'Decideix sota quin filtre es col·loca i quin símbol rep.',
  'files.field.kindAria': 'Tipus de fitxer',
  'files.field.description': 'Descripció',
  'files.field.descriptionPlaceholder':
    'Pòlissa d’assegurança — cobreix tot el grup, línia de sinistres a la pàgina 2.',
  'files.dialog.title': 'Detalls del fitxer',
  'files.action.saving': 'S’està desant el fitxer',
  'files.action.save': 'Desa els detalls',
  'files.queue.someFailed': {
    one: '{count} fitxer no s’ha pujat. El motiu és a cada fila: res més del lot no s’ha vist afectat.',
    many: '{count} fitxers no s’han pujat. El motiu és a cada fila: res més del lot no s’ha vist afectat.',
    other:
      '{count} fitxers no s’han pujat. El motiu és a cada fila: res més del lot no s’ha vist afectat.',
  },

  'files.action.cancelUploadOf': 'Cancel·la la pujada de {name}',
  'files.action.dismissOf': 'Descarta {name}',
  'files.status.downloadingOf': 'S’està baixant {name}',
  'files.status.uploadingOf': 'S’està pujant {name}',
  'files.status.uploadingCount': {
    one: 'S’està pujant {count} fitxer',
    many: 'S’estan pujant {count} fitxers',
    other: 'S’estan pujant {count} fitxers',
  },

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Pujada cancel·lada.',
  'files.error.badAnswer':
    'El servidor ha enviat una resposta que aquest navegador no ha sabut llegir.',
  'files.error.connection':
    'La connexió ha caigut durant la pujada. Comprova la xarxa i torna-ho a provar.',
  'files.error.timeout': 'La pujada ha esgotat el temps. Torna-ho a provar.',
  'files.error.refused': 'El servidor ha rebutjat la pujada ({status}).',
  'files.error.downloadShape':
    'La baixada ha tornat en una forma que no hem pogut desar.',
  'files.error.downloadFailed': 'La baixada ha fallat ({status}).',
  'files.toast.uploadedOne': 'Fitxer pujat',
  'files.toast.uploadedManyBody': 'S’han afegit {size} a aquest viatge.',
  'files.toast.failedOne': 'Aquest fitxer no s’ha pujat',
  'files.toast.failedManyBody': 'La cua de sota diu el motiu de cadascun.',
  'files.error.tooMany': {
    one: 'Només es pot afegir {count} fitxer alhora, així que «{name}» s’ha quedat fora. Torna a deixar-lo anar tot sol.',
    many: 'Només es poden afegir {count} fitxers alhora, així que «{name}» s’ha quedat fora. Torna a deixar-lo anar tot sol.',
    other:
      'Només es poden afegir {count} fitxers alhora, així que «{name}» s’ha quedat fora. Torna a deixar-lo anar tot sol.',
  },
  'files.toast.uploadedMany': {
    one: '{count} fitxer pujat',
    many: '{count} fitxers pujats',
    other: '{count} fitxers pujats',
  },
  'files.toast.failedMany': {
    one: '{count} fitxer no s’ha pujat',
    many: '{count} fitxers no s’han pujat',
    other: '{count} fitxers no s’han pujat',
  },
} satisfies TranslationOf<typeof En>

export default messages
