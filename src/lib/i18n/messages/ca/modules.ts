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
  'transports.field.time': 'Sortida a partir de',
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
  'action.showCode': 'Mostra {label}',
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
  'book.filtered.title': 'Encara no hi ha res d’aquest tipus',
  'book.filtered.body':
    'Aquí no hi ha res reservat dels tipus que has triat. Neteja el filtre per veure la resta del taulell.',
  'book.filtered.action': 'Neteja el filtre',
  'book.panel.outstanding': 'Encara per resoldre',
  'book.panel.outstandingEmpty':
    'No queda res pendent — tot el que hi ha aquí està resolt.',
  'book.panel.settled': 'Resolt',
  'book.panel.settledEmpty':
    'Encara no hi ha res resolt — tot està per perseguir.',
  'book.import.badge': 'Importació sense revisar',
  'book.import.hint':
    'Importat d’una confirmació. Obre’l i desa’l per marcar-lo com a revisat.',
  'book.import.action': 'Importa',
  'book.import.title': 'Importa reserves des d’un fitxer',
  'book.import.description':
    'Deixa-hi una confirmació i la llegirem. No s’afegeix res al viatge fins que no ho hagis vist.',
  'book.import.drop.idle': 'Deixa els fitxers aquí, o cerca’ls',
  'book.import.drop.active': 'Deixa anar per afegir',
  'book.import.drop.formats':
    'PDF, correu desat, pàgina web, foto, Word, Excel, fitxer de calendari o exportació JSON.',
  'book.import.drop.limits':
    'Fins a {files} fitxers alhora, cadascun fins a {size}.',
  'book.import.drop.browse': 'Cerca fitxers',
  'book.import.refused.format':
    '«{filename}» no és un fitxer que aquesta importació pugui llegir. Llegeix un PDF, un correu desat, una pàgina web, una foto, un document de Word o d’Excel, un fitxer de calendari o una exportació JSON.',
  'book.import.refused.tooMany':
    'Només {files} fitxers alhora. La resta no s’han afegit.',
  'book.import.refused.tooLarge':
    '«{filename}» fa {size}. Una importació llegeix fitxers de fins a {limit}.',
  'book.import.refused.empty':
    '«{filename}» és buit, així que no hi ha res a llegir.',
  'book.import.ceiling.title':
    'Aquest espai ja ha llegit totes les confirmacions d’aquest mes',
  'book.import.ceiling.body':
    'El pla inclou {ceiling} lectures de fitxer al mes i la quota es renova l’u. Encara pots afegir una reserva a mà.',
  'book.import.ceiling.none':
    'Llegir un fitxer de confirmació no forma part del pla d’aquest espai',
  'book.import.ceiling.noneBody':
    'Millora el pla per fer que et llegeixin una confirmació. Afegir una reserva a mà sempre hi és.',
  'book.import.widget.title': 'Llegint confirmacions',
  'book.import.widget.working': '{done} de {total} llegits',
  'book.import.widget.file': 'Llegint «{filename}»',
  'book.import.widget.done': {
    one: 'Una reserva a punt de revisar',
    many: '{count} reserves a punt de revisar',
    other: '{count} reserves a punt de revisar',
  },
  'book.import.widget.review': 'Revisa',
  'book.import.widget.failed': 'No s’ha pogut llegir «{filename}»',
  'book.import.widget.stalled': 'Això triga més del que esperàvem',
  'book.import.widget.check': 'Torna-ho a comprovar',
  'book.import.widget.dismiss': 'Descarta',
  'book.import.review.title': 'Què hem llegit',
  'book.import.review.from': 'De «{filename}»',
  'book.import.review.selectAll': 'Selecciona-ho tot',
  'book.import.review.selectNone': 'No seleccionis res',
  'book.import.review.confirm': {
    one: 'Afegeix {count} reserva',
    many: 'Afegeix {count} reserves',
    other: 'Afegeix {count} reserves',
  },
  'book.import.review.confirmNone': 'Selecciona una reserva per afegir-la',
  'book.import.review.cancel': 'Cancel·la',
  'book.import.review.needsReview': 'Cal mirar-ho',
  'book.import.review.needsReviewHint':
    'Alguns camps no eren al document. Obre la reserva després d’afegir-la.',
  'book.import.review.noPrice': 'Cap preu llegit',
  'book.import.review.noPriceHint':
    'El document no en deia cap amb claredat, així que s’ha deixat buit en lloc d’endevinar-lo.',
  'book.import.review.untitled': 'Reserva sense títol',
  'book.import.empty.title': 'No hem trobat cap reserva en aquest fitxer',
  'book.import.empty.body':
    '«{filename}» no tenia res que sembli una confirmació. Prova un altre fitxer, o afegeix la reserva a mà.',
  'book.import.failed.title': 'No s’ha pogut llegir «{filename}»',
  'book.import.failed.body':
    'El fitxer s’ha obert però no se n’ha pogut treure res. Prova un altre fitxer, o afegeix la reserva a mà.',
  'book.import.failed.retry': 'Prova un altre fitxer',
  'book.import.uploadFailed': '«{filename}» no s’ha pujat',
  'book.import.uploadRetry': 'Torna-ho a provar',
  'book.import.actionFailed': 'Torna-ho a provar d’aquí a un moment.',
  'book.import.toast.added': {
    one: 'Una reserva afegida',
    many: '{count} reserves afegides',
    other: '{count} reserves afegides',
  },
  'book.import.partial.title': 'S’han afegit {written} de {total} reserves',
  'book.import.partial.body':
    'La resta continuen seleccionades. Tornar-hi només escriu aquestes.',
  'book.import.partial.retry': 'Afegeix la resta',
  'book.journeyLink': 'A la pestanya de transports',
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
  'book.fieldName.checkInDay': 'dia d’entrada',
  'book.fieldName.checkOutDay': 'dia de sortida',
  'book.stay.pickDay': 'Tria un dia',
  'book.stay.nights': {
    one: '{count} nit',
    many: '{count} nits',
    other: '{count} nits',
  },
  'book.stay.range': 'del {from} al {to}',
  'book.stay.label': 'Estada',
  'book.remove.keepsNights':
    'Les nits es queden al viatge. Només s’elimina la reserva.',
  'book.menu.removeWithStay': 'Elimina la reserva i l’estada',
  'book.removeStay.body': 'S’eliminen la reserva i les nits que paga.',
  'book.toast.stayRemoved': 'Reserva i estada eliminades',
  'book.error.endTimeBeforeStart': 'L’hora de fi és anterior a la d’inici.',
  'book.error.guests': 'El nombre de persones ha de ser un enter fins a 1000.',
  'error.price': 'Aquest import no el sabem llegir.',
  'book.error.url': 'Un enllaç ha de començar per http:// o https://.',
  'book.error.confirmationLong':
    'Aquest número de confirmació és massa llarg per desar-lo.',
  'book.error.stopGone': 'Aquesta parada ja no és en aquest viatge.',
  'book.ledger.unlinked':
    'La línia de cost d’aquesta reserva es quedarà als costos del viatge, però ja no hi estarà vinculada.',
  'book.ledger.updated':
    'La línia de cost d’aquesta reserva passarà a {money}.',
  'book.ledger.needsDate':
    'Dona una data a aquesta reserva i el seu cost s’afegirà als costos del viatge.',
  'book.ledger.added':
    'S’afegirà una línia de {money} als costos d’aquest viatge.',
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
  'book.fieldName.stop': 'parada',
  'book.field.stop': 'Parada vinculada',
  'book.field.stopHint': 'A quina parada del pla correspon aquesta reserva.',
  'book.field.stopHintEmpty':
    'Afegeix primer un lloc a un dia i després hi podràs vincular aquesta reserva',
  'book.field.stopPlaceholder': 'Sense parada',
  'book.field.stopSearch': 'Cerca parades i dies',
  'book.field.stopEmpty': 'Cap parada coincideix',
  'book.ledger.refused.title': 'Desat, però no afegit a les despeses',
  'book.ledger.refused.body':
    'La reserva és al viatge. Afegir-ne la línia de despesa a les despeses del viatge no ha funcionat — torna a provar aquesta meitat.',
  'book.action.ledgerRetry': 'Afegeix-ho a les despeses',
  'book.ledger.splitStale.title': 'Desat, però el repartiment ja no quadra',
  'book.ledger.splitStale.body':
    'La reserva i el nou preu s’han desat, però el repartiment d’aquesta despesa no ha pogut seguir el nou total. Obre la despesa a Despeses i corregeix el repartiment.',
  'book.action.done': 'Fet',
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
  'transports.rank.earliest': 'Arribada més aviat',
  'transports.rank.fewestChanges': 'Menys transbordaments',
  'transports.connection.findStop': 'Cerca una parada',
  'transports.connection.findStopSearch': 'BCN, Sants, Barcelona…',
  'transports.connection.findStopEmpty':
    'Cap parada amb aquest nom al catàleg.',
  'transports.connection.hideStops': 'Amaga les parades',
  'transports.connection.seeStops': 'Mostra les parades',
  'transports.connection.saving': 'Desant la connexió',
  'transports.connection.use': 'Tria aquesta',
  'transports.connection.onFoot': 'A peu',
  'transports.connection.service': 'Servei',
  'transports.connection.direct': 'directe',
  'transports.connection.changes': {
    one: '{changes} transbordament',
    many: '{changes} transbordaments',
    other: '{changes} transbordaments',
  },
  'transports.connection.tooLong':
    'Aquesta connexió té més de {max} trams, més del que cap en un sol registre de viatge. Cerca un salt més curt i registra la resta a part.',
  'transports.connection.refusal.ceiling': 'No queden cerques aquest mes',
  'transports.connection.refusal.unconfigured':
    'La cerca de connexions està desactivada en aquest desplegament',
  'transports.connection.refusal.provider': 'El servei d’horaris no ha respost',
  'transports.connection.refusal.plan':
    'La cerca de connexions no entra en aquest pla',
  'transports.connection.refusal.planBody':
    'Canvia de pla per consultar horaris des de dins d’un viatge. Un trajecte sempre es pot anotar a mà.',
  'transports.connection.refusal.ceilingBody':
    'La quota mensual de {ceiling} s’ha exhaurit i es renova l’u del mes que ve. Un trajecte sempre es pot anotar a mà.',
  'transports.connection.refusal.unconfiguredBody':
    'Aquí no hi ha cap servei d’horaris configurat, així que no s’ha cercat res. Anota el trajecte a mà.',
  'transports.connection.refusal.providerBody':
    'No ha tornat res per mostrar. Torna-ho a provar d’aquí a un moment, o anota el trajecte a mà.',
  'transports.connection.invitation':
    'Dues parades i una data, i els horaris responen. No es desa res fins que en triïs una.',
  'transports.connection.empty':
    'No s’ha trobat cap connexió entre aquestes dues parades en aquesta data. Prova una estació veïna o amplia el filtre de modes.',
  'transports.connection.credit': "Dades d'horaris de",
  'transports.connection.searchFailed': 'La cerca no s’ha fet',
  'transports.connection.searchFailedBody':
    'Torna-ho a provar d’aquí a un moment.',
  'transports.connection.saved': 'Connexió desada',
  'transports.connection.replaced': 'Ruta substituïda',
  'transports.connection.replacedBody':
    'El codi de reserva i el seient queden intactes.',
  'transports.connection.saveFailed': 'La connexió no s’ha desat',
  'transports.connection.saveError': 'Això no s’ha desat',
  'transports.connection.fromHint':
    'Tria una parada — a un horari se li pregunta on, no com es diu.',
  'transports.connection.toHint': 'Tria una parada del catàleg.',
  'transports.connection.timeHint':
    'Un horari respon amb les properes sortides, així que això decideix quines.',
  'transports.connection.onlyModes': 'Només aquests modes',
  'transports.connection.searching': 'Cercant als horaris',
  'transports.connection.search': 'Cerca connexions',
  'transports.connection.title': 'De {from} a {to}',
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
  'transports.end.pickUp': 'Recollida',
  'transports.end.dropOff': 'Devolució',
  'transports.end.departureDay': 'Dia de sortida',
  'transports.end.arrivalDay': 'Dia d’arribada',
  'transports.end.pickUpDay': 'Dia de recollida',
  'transports.end.returnDay': 'Dia de devolució',
  'transports.dayNumber': 'Dia {n}',
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
  'transports.error.arrivalDayBeforeDeparture':
    'El dia d’arribada és anterior al dia de sortida.',
  'transports.error.returnDayBeforePickUp':
    'El dia de devolució és anterior al dia de recollida.',
  'transports.field.noDay': 'Encara sense dia',
  'transports.fill.legend': 'Com omplir això',
  'transports.fill.manual': 'Escriu-ho tu',
  'transports.fill.searchAgain': 'Torna a cercar',
  'transports.fill.search': 'Cerca connexions',
  'transports.chain.unsplit': 'Torna a deixar-ho com un sol viatge',
  'transports.field.arrivalDayHint':
    'Un viatge que arriba l’endemà al matí ho diu aquí.',
  'transports.chain.splitHint':
    'Transbord pel camí? Anota cada part amb el seu número de servei, andana, seient i hores.',
  'transports.chain.split': 'Divideix en trams',
  'transports.chain.stopNumber': 'parada {n}',
  'transports.chain.change': 'Transbord {n}',
  'transports.chain.removeStation': 'Elimina {label}',
  'transports.chain.findStation': 'Cerca un aeroport o una estació',
  'transports.chain.findStationFor':
    'Cerca un aeroport o una estació per a {label}',
  'transports.chain.findPlaceholder': 'BCN, el Prat, Barcelona…',
  'transports.chain.findEmpty':
    'Cap coincidència — escriu la parada tu mateix a sota.',
  'transports.chain.stopLabel': 'Parada',
  'transports.chain.stopPlaceholder': 'Barcelona Sants',
  'transports.chain.timezoneHint': 'A quin rellotge va aquesta parada',
  'transports.chain.timezoneAt': 'Fus horari a {label}',
  'transports.chain.timezonePlaceholder': 'Sense indicar',
  'transports.chain.timezoneSearch': 'Tòquio, Lisboa, UTC…',
  'transports.chain.acrossClocks': '{gap} entre dos rellotges',
  'transports.chain.addStopAfter': 'Afegeix una parada després de {label}',
  'transports.chain.servicePlaceholder': 'AVE 3092',
  'transports.chain.leaves': 'Surt de {label}',
  'transports.chain.reaches': 'Arriba a {label}',
  'transports.chain.dayOfLeg': '{label} del tram {n}',
  'transports.chain.formError': 'Aquesta cadena no es pot desar',
  'transports.chain.atCap':
    'Una cadena admet com a màxim {max} trams — és un límit del que pot carregar un desat, no de quants transbordaments pot tenir un viatge.',
  'transports.chain.hint':
    'Afegeix una parada a qualsevol tram per registrar un canvi de tren, i cada tram manté el seu número de servei, andana i seient.',
  'transports.field.timezone': 'Fus horari',
  'transports.field.platform': 'Andana',
  'transports.chain.legNumber': 'Tram {n}',
  'transports.chain.platform': 'Andana {value}',
  'transports.chain.seat': 'Seient {value}',
  'transports.chain.error.stopName':
    'Cada parada necessita un nom — aquí és on fas transbord.',
  'transports.chain.error.stopNameLong':
    'El nom d’una parada ha de tenir menys de 200 caràcters.',
  'transports.chain.error.timezone': 'Tria un fus horari de la llista.',
  'transports.chain.error.tooManyLegs':
    'Una cadena admet com a màxim {max} trams.',
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
  'collab.presence.unnamed': 'Membre sense nom',
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
  'collab.thread.emptyBody':
    'Tothom d’aquest viatge comparteix un sol fil. Les decisions que es prenen aquí es queden amb el viatge en lloc de dispersar-se pels xats de grup.',
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
  'collab.compose.placeholderText': 'Digues alguna cosa al grup…',
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
  'files.calendar.live.action': 'Enllaç de calendari actualitzat',
  'files.calendar.live.title': 'Enllaç de calendari actualitzat',
  'files.calendar.warning':
    'Qualsevol persona amb aquest enllaç pot llegir els llocs, horaris, adreces i notes del viatge sense compte. Protegeix-lo com una contrasenya.',
  'files.calendar.enable.action': 'Crea un enllaç',
  'files.calendar.link.once':
    'Copia’l ara - només el mostrem una vegada. Si el perds, desactiva’l i crea’n un altre; l’antic deixarà de funcionar.',
  'files.calendar.link.address': 'Adreça de l’enllaç',
  'files.calendar.link.copy': 'Copia l’enllaç',
  'files.calendar.link.copied': 'Enllaç copiat',
  'files.calendar.link.copyFailed':
    'No s’ha pogut copiar. Selecciona l’adreça i copia-la manualment.',
  'files.calendar.link.open': 'Obre a l’aplicació de calendari',
  'files.calendar.link.google': 'Afegeix a Google Calendar',
  'files.calendar.link.outlook': 'Afegeix a l’Outlook',
  'files.calendar.link.done': 'Fet',
  'files.calendar.link.stays':
    'Els números de confirmació, preus i fitxers es queden a planned.travel.',
  'files.calendar.freshness':
    'Les aplicacions de calendari poden trigar unes quantes hores, de vegades més, a mostrar un canvi.',
  'files.calendar.state.on': 'L’enllaç de calendari està activat',
  'files.calendar.state.lastFetched':
    'Un calendari ha consultat aquest enllaç per darrera vegada {when}',
  'files.calendar.state.neverFetched': 'Encara no s’ha consultat',
  'files.calendar.off.action': 'Desactiva',
  'files.calendar.off.confirmTitle':
    'Vols desactivar aquest enllaç de calendari?',
  'files.calendar.off.confirmBody':
    'L’enllaç deixa de funcionar immediatament. Els calendaris conserven els esdeveniments rebuts, però deixen d’actualitzar-los.',
  'files.calendar.off.confirm': 'Desactiva',
  'files.calendar.off.busy': 'S’està desactivant…',
  'files.calendar.closeGuard.title': 'Vols tancar sense copiar l’enllaç?',
  'files.calendar.closeGuard.body':
    'No el podem tornar a mostrar. Hauràs de crear-ne un altre.',
  'files.calendar.closeGuard.confirm': 'Tanca igualment',
  'files.calendar.closeGuard.cancel': 'Mantén obert',
  'files.calendar.error.enable':
    'No s’ha pogut confirmar la creació de l’enllaç. L’estat actual es mostra a sota. Si està activat però no l’has vist, desactiva’l i torna’l a crear.',
  'files.calendar.error.off':
    'No s’ha pogut confirmar la desactivació de l’enllaç. L’estat actual es mostra a sota; torna-ho a provar si cal.',
  'files.calendar.error.load':
    'No s’ha pogut comprovar l’enllaç de calendari d’aquest viatge. Torna-ho a provar.',
  'files.calendar.retry': 'Torna-ho a provar',
  'files.calendar.off.confirmBodyUnused':
    'Aquest enllaç encara no s’ha fet servir. Deixa de funcionar immediatament.',
  'files.calendar.link.fallback':
    'Si no el pots afegir des del telèfon, obre aquesta pàgina en un ordinador.',
  'files.calendar.link.newTab': 's’obre en una pestanya nova',
  'files.calendar.title': 'Calendari',
  'files.calendar.description':
    'Porta aquest viatge a l’aplicació de calendari que ja fas servir.',
  'files.calendar.download.action': 'Baixa el fitxer de calendari (.ics)',
  'files.calendar.download.hint':
    'Una instantània del viatge tal com és ara. No s’actualitza.',
  'files.calendar.undated':
    'Aquest viatge encara no té dates, així que només hi apareixeran les reserves i els trajectes amb data.',
  'files.calendar.download.error':
    'No hem pogut preparar el fitxer. Torna-ho a provar.',
  'files.calendar.timesNote':
    'Els trajectes amb fus horari es mostren al mateix moment a tot arreu. La resta es mostra a l’hora prevista, estigui on estigui el teu calendari.',
  'files.drop.active': 'Deixa-ho anar per pujar',
  'files.drop.pasteHint': 'enganxa una imatge o captura de pantalla copiada',
  'files.reject.blockedType':
    '«{name}» no s’ha afegit: aquí no es desen fitxers XML ni SVG comprimits, per seguretat. Desa’l com a PDF o com a imatge i afegeix això en lloc seu.',
  'files.drop.idle': 'Arrossega fitxers aquí',
  'files.empty.title': 'No hi ha fitxers en aquest viatge',
  'files.empty.body':
    'Tot allò que altrament hauries de remenar en una safata d’entrada al taulell de facturació és aquí, lligat al viatge a què pertany.',
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

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - generat el {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': 'A punt: {title}',
  'files.export.email.body': {
    one: 'L’exportació del viatge és a punt. Es conserva durant {count} dia.',
    many: 'L’exportació del viatge és a punt. Es conserva durant {count} dies.',
    other:
      'L’exportació del viatge és a punt. Es conserva durant {count} dies.',
  },
  'files.export.email.action': 'Obre {title}',
  'files.export.email.text': 'L’exportació del viatge és a punt: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Exporta el viatge',
  'files.export.description':
    'Una còpia imprimible del viatge: dies, parades, reserves, transport i allotjaments. Lliura-la a algú que no tingui compte.',
  'files.export.kept': {
    one: 'Cada exportació es conserva durant {count} dia.',
    many: 'Cada exportació es conserva durant {count} dies.',
    other: 'Cada exportació es conserva durant {count} dies.',
  },
  'files.export.empty.title': 'Encara no hi ha exportacions',
  'files.export.empty.body':
    'Fes una còpia imprimible del viatge per enviar-la a algú que no tingui compte.',
  'files.export.empty.bodyViewer':
    'El propietari o un editor del viatge en pot fer una.',
  'files.export.format.pdf': 'Fitxer PDF',
  'files.export.format.html': 'Pàgina imprimible',
  'files.export.artifact': 'Exportació del viatge, {date}',
  'files.export.download': 'Baixa',
  'files.export.downloadLabelPdf': 'Baixa el PDF fet el {date}',
  'files.export.downloadLabelHtml': 'Baixa la pàgina imprimible feta el {date}',
  'files.export.error.list': 'No s’ha pogut carregar la llista d’exportacions.',
  'files.export.retry': 'Torna-ho a provar',
  'files.export.error.missing':
    'Aquesta exportació ja no es conserva. Exporta el viatge un altre cop.',
  'files.export.error.missingViewer': 'Aquesta exportació ja no es conserva.',

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

  'files.export.request': 'Exporta el viatge',
  'files.export.includeReferences': 'Inclou els codis de confirmació',
  'files.export.includeReferencesHint':
    'No ho marquis si enviaràs el fitxer a algú de fora de l’espai.',
  'files.export.pending':
    'S’està preparant l’exportació. Pots sortir de la pàgina; el fitxer apareixerà a la llista quan estigui llest.',
  'files.export.slow':
    'Triga més del normal. El fitxer apareixerà aquí quan estigui llest. Si no apareix, torna a exportar.',
  'files.export.refresh': 'Actualitza',
  'files.export.ready': 'L’exportació està llesta',
  'files.export.quota': {
    one: 'S’ha esgotat la quota mensual de {count} exportacions de l’espai. El recompte es reinicia el {date}.',
    many: 'S’ha esgotat la quota mensual de {count} exportacions de l’espai. El recompte es reinicia el {date}.',
    other:
      'S’ha esgotat la quota mensual de {count} exportacions de l’espai. El recompte es reinicia el {date}.',
  },
  'files.export.error.request': 'L’exportació no s’ha iniciat',
  'files.export.error.requestBody':
    'Aquest intent no s’ha comptabilitzat. Torna-ho a provar d’aquí a un moment.',
  'files.export.doc.overview': 'Resum',
  'files.export.doc.timezone': 'Zona horària',
  'files.export.doc.days': 'Dies',
  'files.export.doc.day': {
    one: 'Dia {count} - {date}',
    many: 'Dia {count} - {date}',
    other: 'Dia {count} - {date}',
  },
  'files.export.doc.dayUndated': {
    one: 'Dia {count}',
    many: 'Dia {count}',
    other: 'Dia {count}',
  },
  'files.export.doc.dayEmpty': 'Encara no hi ha plans.',
  'files.export.doc.reservations': 'Reserves',
  'files.export.doc.transport': 'Mitjans de transport',
  'files.export.doc.reference': 'Referència {code}',
  'files.export.doc.route': '{from} a {to}',
  'files.export.doc.stays': 'On ens allotgem',
  'files.export.doc.nights': {
    one: 'Nits: {count}',
    many: 'Nits: {count}',
    other: 'Nits: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'No caben tots els dies en un document. Es mostren els primers {count} dies.',
    many: 'No caben tots els dies en un document. Es mostren els primers {count} dies.',
    other:
      'No caben tots els dies en un document. Es mostren els primers {count} dies.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Es mostren els primers {count} de {total}.',
    many: 'Es mostren els primers {count} de {total}.',
    other: 'Es mostren els primers {count} de {total}.',
  },
  'files.export.notify': 'Envia’m un correu quan estigui llest',
  'files.export.viewer':
    'Només els propietaris i editors poden crear una exportació. Pots descarregar les existents.',
  'files.export.jump': 'Ves a les exportacions',
  'files.export.fromLink': 'Des del teu enllaç',
  'files.export.linkGone':
    'Aquesta exportació ja no es conserva. Crea’n una de nova a continuació.',
  'files.export.allowance': {
    one: '{used} de {count} exportació utilitzades aquest mes',
    many: '{used} de {count} exportacions utilitzades aquest mes',
    other: '{used} de {count} exportacions utilitzades aquest mes',
  },
  'files.export.allowanceUnlimited': {
    one: '{count} exportació aquest mes',
    many: '{count} exportacions aquest mes',
    other: '{count} exportacions aquest mes',
  },
  'files.export.linkGoneViewer': 'Aquesta exportació ja no es conserva.',
} satisfies TranslationOf<typeof En>

export default messages
