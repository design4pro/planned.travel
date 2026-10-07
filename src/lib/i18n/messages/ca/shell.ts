/**
 * Everything the application shell says, in Catalan.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular, with an action written as an
 * imperative — «Comparteix», «Obre», «Torna-ho a provar» — matching `./ui.ts`
 * and `./settings.ts`.
 *
 * **Plural.** `Intl.PluralRules('ca')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Feature names are translated, not borrowed.** «Atlas», «Vacay» and
 * «Journey» would be English words in a Catalan nav, so each says what its
 * screen is: el mapa del món, les vacances, el diari.
 *
 * **Dates.** Nothing here restates a date format: the Catalan month, weekday
 * and short-date forms are frozen in `src/lib/format-tables.ts`, where they
 * were pinned because workerd and WebKit disagreed about them.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Seccions principals',
  'nav.mobile': 'Seccions',
  'nav.dashboardLink': 'Tauler de planned.travel',
  'nav.homeLink': 'Inici de planned.travel',
  'nav.newTrip': 'Viatge nou',

  'nav.trips': 'Els meus viatges',
  'nav.trips.short': 'Viatges',
  'nav.vacay': 'Vacances',
  'nav.vacay.short': 'Vacances',
  'nav.atlas': 'Mapa del món',
  'nav.atlas.short': 'Mapa',
  'nav.journey': 'Diari',
  'nav.journey.short': 'Diari',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Seccions del viatge',
  'trip.nav.back': 'Viatges',
  'trip.nav.share': 'Comparteix',
  'trip.nav.shareLabel': 'Comparteix aquest viatge',
  'trip.tab.plan': 'Itinerari',
  'trip.tab.transports': 'Trajectes',
  'trip.tab.book': 'Reserves',
  'trip.tab.lists': 'Llistes',
  'trip.tab.costs': 'Despeses',
  'trip.tab.files': 'Fitxers',
  'trip.tab.collab': 'Grup',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menú del compte',
  'account.settings': 'Configuració',
  'account.billing': 'Pla i facturació',
  'account.admin': 'Administració',
  'account.signOut': 'Tanca la sessió',
  'account.signingOut': 'S’està tancant la sessió…',
  'account.signOutFailed': 'No s’ha pogut tancar la sessió',
  'account.signOutFailedBody': 'Comprova la connexió i torna-ho a provar.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Espai',
  'workspace.switchFailed': 'No s’ha pogut canviar d’espai',
  'workspace.switchFailedBody': 'Comprova la connexió i torna-ho a provar.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Aparença',
  'theme.light': 'Clar',
  'theme.dark': 'Fosc',
  'theme.system': 'Com el sistema',
  'theme.state.light': 'clar',
  'theme.state.dark': 'fosc',
  'theme.state.system': 'com el sistema',
  'theme.trigger': 'Tema: {state}. Canvia el tema',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notificacions, cap per llegir',
  'bell.unread': {
    one: 'Notificacions, {unread} per llegir',
    many: 'Notificacions, {unread} per llegir',
    other: 'Notificacions, {unread} per llegir',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Safata d’entrada',
  'inbox.title': 'Notificacions',
  'inbox.error': 'La safata no s’ha carregat',
  'inbox.allRead': 'Està tot llegit',
  'inbox.unread': {
    one: '{unread} missatge per llegir',
    many: '{unread} missatges per llegir',
    other: '{unread} missatges per llegir',
  },
  'inbox.markAll': 'Marca-ho tot com a llegit',
  'inbox.markingAll': 'S’està marcant tot com a llegit',
  'inbox.cleared': 'Safata al dia',
  'inbox.markAllFailed': 'No s’ha pogut marcar tot com a llegit',
  'inbox.retryHint': 'Comprova la connexió i torna-ho a provar.',
  'inbox.filter.all': 'Tot',
  'inbox.filter.unread': 'Per llegir',
  'inbox.waiting': {
    one: '{invitations} invitació esperant',
    many: '{invitations} invitacions esperant',
    other: '{invitations} invitacions esperant',
  },
  'inbox.empty.title': 'La safata és buida',
  'inbox.empty.body':
    'Aquí arriben les invitacions a viatges, els canvis de pla, els recordatoris de reserva i els comptes saldats.',
  'inbox.empty.action': 'Torna al tauler',
  'inbox.emptyUnread.title': 'Res per llegir',
  'inbox.emptyUnread.body':
    'Ho has llegit tot. Passa a Tot per repassar l’historial.',
  'inbox.emptyUnread.action': 'Mostra-ho tot',
  'inbox.row.new': 'Nova',
  'inbox.row.accepted': 'Acceptada',
  'inbox.row.declined': 'Rebutjada',
  'inbox.row.open': 'Obre',
  'inbox.row.markRead': 'Llegida',
  'inbox.row.markingRead': 'S’està marcant com a llegida',
  'inbox.row.markReadFailed': 'No s’ha pogut marcar com a llegida',
  'inbox.preferences':
    'Tria quines d’aquestes arriben a la safata, al correu i al telèfon.',
  'inbox.preferencesAction': 'Configuració de les notificacions',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'T’han convidat a {tripTitle}',
  'notification.trip.invited.body': '{actorName} t’ha afegit al viatge.',
  'notification.trip.updated.title': '{tripTitle} ha canviat',
  'notification.trip.updated.body': '{actorName} ha canviat el pla.',
  'notification.trip.member_added.title':
    '{memberName} s’ha unit a {tripTitle}',
  'notification.trip.member_added.body':
    'Ja pot veure l’itinerari, les reserves i els diners.',
  'notification.trip.member_removed.title':
    '{memberName} ha deixat {tripTitle}',
  'notification.trip.member_removed.body':
    'El seu accés al viatge s’ha acabat.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} comença d’aquí a {days} dia',
    many: '{tripTitle} comença d’aquí a {days} dies',
    other: '{tripTitle} comença d’aquí a {days} dies',
  },
  'notification.trip.starting_soon.body':
    'Bon moment per repassar la llista d’equipatge i les reserves.',
  'notification.trip.copied.title': '{tripTitle} ja està a punt',
  'notification.trip.copied.body': {
    one: 'S’ha copiat {days} dia',
    many: 'S’han copiat {days} dies',
    other: 'S’han copiat {days} dies',
  },
  'notification.trip.copied.places': {
    one: '{places} lloc',
    many: '{places} llocs',
    other: '{places} llocs',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} nota descartada',
    many: '{dropped} notes descartades',
    other: '{dropped} notes descartades',
  },
  'notification.trip.copyFailed.title': 'No s’ha pogut copiar {tripTitle}',
  'notification.trip.copyFailed.body':
    'No s’ha perdut res. Torna-ho a provar des de l’original.',
  'notification.reservation.reminder.title': '{title} és a tocar',
  'notification.reservation.reminder.body':
    'Comprova l’hora i el codi de confirmació a la reserva.',
  'notification.reservation.confirmed.title': '{title} està confirmada',
  'notification.reservation.confirmed.body':
    'La reserva consta com a confirmada a {tripTitle}.',
  'notification.expense.added.title': '{actorName} ha afegit una despesa',
  'notification.expense.added.body': '{title}, a {tripTitle}.',
  'notification.expense.settled.title': '{actorName} ha saldat el compte',
  'notification.expense.settled.body': 'El saldo de {tripTitle} està pagat.',
  'notification.list.assigned.title': '{actorName} t’ha assignat una tasca',
  'notification.list.assigned.body': '{title}, a {tripTitle}.',
  'notification.collab.message.title': '{actorName} ha escrit a {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'Hi ha una votació oberta a {tripTitle}',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'T’han convidat a {organizationName}',
  'notification.organization.invited.body':
    'Accepta per entrar a l’espai de treball i a tot el que s’hi comparteix.',
  'notification.journey.published.title': '{title} ja està publicat',
  'notification.journey.published.body':
    'Qualsevol que tingui l’enllaç ja pot llegir el diari.',
  'notification.billing.plan_changed.title': 'El teu pla ha canviat',
  'notification.billing.plan_changed.body':
    '{organizationName} ara té el pla {plan}.',
  'notification.billing.invoice_paid.title': 'Pagament rebut',
  'notification.billing.invoice_paid.body':
    'S’ha pagat la darrera factura de {organizationName}.',
  'notification.billing.payment_failed.title': 'Un pagament no s’ha pogut fer',
  'notification.billing.payment_failed.body':
    '{organizationName} té un pagament pendent. Actualitza el mètode de pagament per mantenir el pla.',
  'notification.fallback.title':
    'Alguna cosa ha canviat al teu espai de treball',
  'notification.fallback.body': 'Obre el viatge per veure què ha estat.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'El tauler no s’ha carregat',
  'dashboard.blank.title': 'El teu pròxim viatge comença aquí',
  'dashboard.blank.body':
    'Crea un viatge, marca al mapa els llocs que vols veure i planned.travel muntarà el pla dia a dia al seu voltant.',
  'dashboard.blank.action': 'Prepara un viatge',
  'dashboard.blank.secondary': 'Mira el teu mapa del món',

  'dashboard.upNext': 'A continuació',
  'dashboard.openPlan': 'Obre el pla',
  'dashboard.hero.travellers': 'Viatgers',
  'dashboard.hero.datesMissing': 'Afegeix dates per crear els dies',
  'dashboard.hero.startsIn': 'Comença en',
  'dashboard.hero.started': 'Començat fa',
  'dashboard.hero.today': 'Avui',
  'dashboard.hero.startUnknown': 'sense data d’inici',
  'dashboard.hero.startToday': 'bon viatge',
  /**
   * The label over the numeral already carries «fa», so the unit under it is
   * only the word for a day — Catalan would otherwise say it twice.
   */
  'dashboard.hero.startPast': {
    one: 'dia',
    many: 'dies',
    other: 'dies',
  },
  'dashboard.hero.startFuture': {
    one: 'dia',
    many: 'dies',
    other: 'dies',
  },
  'dashboard.hero.nights': 'Nits',
  'dashboard.hero.companionsHint': 'en aquest viatge',
  'dashboard.hero.progress': 'En curs',
  'dashboard.hero.places': 'Llocs',
  'dashboard.hero.placesNone': 'encara no hi ha res al mapa',
  'dashboard.hero.placesHint': 'al mapa',

  'dashboard.stat.countries': 'Països visitats',
  'dashboard.stat.countriesUnit': 'de {total}',
  'dashboard.stat.countriesNone': 'Marca un país per començar el teu mapa',
  'dashboard.stat.visits': {
    one: '{visits} visita registrada',
    many: '{visits} visites registrades',
    other: '{visits} visites registrades',
  },
  'dashboard.stat.trips': 'Viatges en total',
  'dashboard.stat.tripsCaption':
    '{planning} en preparació · {booked} amb reserva',
  'dashboard.stat.places': 'Llocs al mapa',
  'dashboard.stat.placesNone': 'Encara no hi ha res al mapa',
  'dashboard.stat.placesAcross': {
    one: 'en {trips} viatge',
    many: 'en {trips} viatges',
    other: 'en {trips} viatges',
  },
  'dashboard.stat.bookings': 'Reserves confirmades',
  'dashboard.stat.bookingsNone': 'No hi ha reserves pròximes',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} reserva en camí',
    many: '{bookings} reserves en camí',
    other: '{bookings} reserves en camí',
  },

  'dashboard.trips.label': 'Els teus viatges',
  'dashboard.trips.all': 'Tots els viatges',
  'dashboard.trips.empty.title': 'Encara no hi ha viatges',
  'dashboard.trips.empty.body':
    'Tot el que preparis apareixerà aquí, primer el més recent.',
  'dashboard.trips.empty.action': 'Crea un viatge',

  'dashboard.bookings.label': 'Pròximes reserves',
  'dashboard.bookings.empty.title': 'Encara no hi ha res reservat',
  'dashboard.bookings.empty.body':
    'Els allotjaments, les taules i les entrades confirmades apareixen aquí a mesura que s’acosta la data.',

  'dashboard.pipeline.label': 'Viatges per etapa',
  'dashboard.pipeline.empty':
    'No hi ha res en marxa. El teu primer viatge repartirà això per etapes.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} preferit',
    many: '{favourites} preferits',
    other: '{favourites} preferits',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} viatge arxivat',
    many: '{archived} viatges arxivats',
    other: '{archived} viatges arxivats',
  },

  'dashboard.storage.label': 'Emmagatzematge',
  'dashboard.storage.count': '{used} de {limit}',
  'dashboard.storage.files': {
    one: '{files} fitxer entre tots els viatges, fotos i bitllets inclosos.',
    many: '{files} fitxers entre tots els viatges, fotos i bitllets inclosos.',
    other: '{files} fitxers entre tots els viatges, fotos i bitllets inclosos.',
  },
  'dashboard.storage.more': 'Necessites més espai?',
  'dashboard.storage.plans': 'Mira els plans',
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Referència',
  'dashboard.widgets.choose': 'Tria els ginys',
  'dashboard.widgets.description':
    'Els ginys que mantens al costat del tauler.',
  'dashboard.clock.label': 'Rellotge mundial',
  'dashboard.clock.add': 'Afegeix un fus horari',
  'dashboard.clock.search': 'Cerca ciutats i regions',
  'dashboard.clock.noMatches': 'Cap fus horari amb aquest nom',
  'dashboard.clock.remove': 'Elimina {zone}',
  'dashboard.clock.offset': '{offset} respecte a la teva hora',
  'dashboard.clock.here': 'La teva hora',
  'dashboard.clock.empty.title': 'Cap fus horari fixat',
  'dashboard.clock.empty.body':
    'Fixa un lloc i llegeix-ne el rellotge al costat del teu.',
  'dashboard.clock.unknown.title': 'Aquest dispositiu no coneix {zone}',
  'dashboard.clock.unknown.body':
    'Aquí no se’n pot llegir l’hora. Elimina la fila per resoldre-ho.',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'La consola d’administració no s’ha carregat',
  'admin.denied.title': 'Això només ho obren els administradors de l’espai',
  'admin.denied.body':
    'Si ho necessites, demana a un propietari o a un administrador d’aquest espai que et canviï el rol.',
  'admin.denied.action': 'Torna al tauler',
  'admin.eyebrow': 'Administració de l’espai',
  'admin.description': 'Pla {plan} · creat {date}',
  'admin.createdUnknown': 'fa poc',
  'admin.workspaceSettings': 'Configuració de l’espai',
  'admin.billing': 'Pla i facturació',

  'admin.invitations.title': {
    one: '{invitations} invitació sense resposta',
    many: '{invitations} invitacions sense resposta',
    other: '{invitations} invitacions sense resposta',
  },
  'admin.invitations.body':
    'Cada invitació pendent ocupa una de les places que paga el teu pla.',
  'admin.invitations.action': 'Revisa les invitacions',

  'admin.stat.members': 'Membres',
  'admin.stat.membersCaption': {
    one: '{invitations} invitació pendent',
    many: '{invitations} invitacions pendents',
    other: '{invitations} invitacions pendents',
  },
  'admin.stat.storage': 'Emmagatzematge',
  'admin.stat.storageUnit': 'de {limit}',
  'admin.stat.storageUnlimited': 'sense sostre',
  'admin.stat.storageCaption': 'Fitxers, fotos i exportacions',
  'admin.stat.audit': 'Entrades d’auditoria',
  'admin.stat.auditCaption': 'Aquí sota tens l’activitat més recent',
  'admin.stat.plan': 'Pla',
  'admin.stat.planCaption': 'Les quotes s’apliquen a la capa de dades',

  'admin.quotas.label': 'Quotes',
  'admin.quotas.count': {
    one: '{metrics} mètrica',
    many: '{metrics} mètriques',
    other: '{metrics} mètriques',
  },
  'admin.quotas.unlimited': 'Sense límit',
  'admin.quotas.value': '{used} de {limit}',

  'admin.members.label': 'Membres',
  'admin.members.table': 'Membres d’aquest espai de treball',
  'admin.members.person': 'Persona',
  'admin.members.role': 'Rol',
  'admin.members.joined': 'S’hi va unir',

  'admin.activity.label': 'Activitat recent',
  'admin.activity.empty.title': 'Encara no hi ha res registrat',
  'admin.activity.empty.body':
    'Cada canvi que compta s’afegeix al registre en el moment que passa.',
  'admin.activity.workspace': 'el mateix espai de treball',
  'admin.actions.label': 'Accions més freqüents',
  'admin.actions.count': {
    one: '{actions} acció',
    many: '{actions} accions',
    other: '{actions} accions',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Esborrany',
  'tripStatus.planning': 'En preparació',
  'tripStatus.booked': 'Reservat',
  'tripStatus.active': 'En marxa',
  'tripStatus.completed': 'Acabat',
  'tripStatus.archived': 'Arxivat',

  'bookingStatus.none': 'Sense reserva',
  'bookingStatus.pending': 'Pendent',
  'bookingStatus.confirmed': 'Confirmada',
  'bookingStatus.cancelled': 'Cancel·lada',
  'bookingStatus.completed': 'Feta',

  'bookingType.accommodation': 'Allotjament',
  'bookingType.restaurant': 'Taula',
  'bookingType.activity': 'Activitat',
  'bookingType.tour': 'Excursió',
  'bookingType.ticket': 'Entrada',
  'bookingType.transport': 'Trajecte',
  'bookingType.other': 'Reserva',

  'role.owner': 'Propietari',
  'role.admin': 'Administrador',
  'role.member': 'Membre',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} viatge',
    many: '{value} viatges',
    other: '{value} viatges',
  },
  'trips.count.favourites': {
    one: '{value} preferit',
    many: '{value} preferits',
    other: '{value} preferits',
  },
  'trips.count.archived': {
    one: '{value} arxivat',
    many: '{value} arxivats',
    other: '{value} arxivats',
  },
  'trips.atLimit.body':
    'El teu pla cobreix {trips}. Arxiva’n un que hagis acabat, o puja de pla per tenir-ne més oberts a la vegada.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nou diari',
  'newJourney.title': 'Comença un diari',
  'newJourney.description':
    'Un diari és la cara escrita d’un viatge: entrades per data, amb les fotos i el temps que en recordes.',
  'newJourney.titlePlaceholder': 'Dues setmanes a Kyoto',
  'newJourney.subtitle': 'Subtítol',
  'newJourney.subtitleHint': 'Una línia sota el títol, a la coberta.',
  'newJourney.subtitlePlaceholder': 'Temples, trens i massa matcha',
  'newJourney.trip': 'A partir d’un viatge',
  'newJourney.tripHint': 'Opcional — lliga el relat amb el seu pla.',
  'newJourney.tripNone': 'Sense viatge associat',
  'newJourney.datesError': 'La data de fi és anterior a l’inici.',
  'newJourney.submit': 'Crea el diari',
  'newJourney.creating': 'S’està creant el diari',
  'newJourney.created': 'Diari començat',
  'newJourney.createdBody': 'Afegeix la primera entrada per començar el relat.',
  'newJourney.error':
    'No s’ha pogut crear el diari. Torna-ho a provar en un moment.',
  'newCollection.trigger': 'Nova col·lecció',
  'newCollection.title': 'Comença una col·lecció',
  'newCollection.description':
    'Un lloc per als llocs que trobes abans de saber a quin viatge pertanyen.',
  'newCollection.namePlaceholder':
    'Un cafè que val la pena travessar la ciutat',
  'newCollection.descriptionHint': 'Què hi va a dins i què no.',
  'newCollection.submit': 'Crea la col·lecció',
  'newCollection.creating': 'S’està creant la col·lecció',
  'newCollection.created': 'Col·lecció creada',
  'newCollection.createdBody': 'Comença a guardar-hi llocs.',
  'newCollection.error':
    'No s’ha pogut crear la col·lecció. Torna-ho a provar en un moment.',

  'newTrip.title': 'Comença un viatge nou',
  'newTrip.description':
    'Amb un títol n’hi ha prou. Les dates construeixen el pla dia a dia, i la resta pot esperar que ho sàpigues.',
  'newTrip.name': 'Nom del viatge',
  'newTrip.namePlaceholder': 'Kyoto en temporada de cirerers',
  'newTrip.destination': 'Destinació',
  'newTrip.destinationHint': 'Una ciutat, una regió o tot l’itinerari.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japó',
  'newTrip.departure': 'Sortida',
  'newTrip.return': 'Tornada',
  'newTrip.returnError': 'La data de tornada és anterior a la sortida.',
  'newTrip.currency': 'Moneda del pressupost',
  'newTrip.currencyHint': 'Hi sumem cada despesa d’aquest viatge.',
  'newTrip.currencySearch': 'Cerca per codi o nom',
  'newTrip.currencyEmpty': 'Cap moneda coincideix.',
  'newTrip.currencyFavourites': 'Preferides',
  'newTrip.currencyAll': 'Totes les monedes',
  'newTrip.summary': 'Resum',
  'newTrip.summaryPlaceholder': 'Dues setmanes de temples, trens i ramen.',
  'newTrip.duration': 'Durada en dies',
  'newTrip.durationHint':
    'Sense dates, el viatge comença amb aquest nombre de dies sense data.',
  'newTrip.durationDerived': 'Es calcula a partir de les dues dates.',
  'newTrip.reminder': 'Recordatori abans de la sortida',
  'newTrip.reminderNone': 'Cap',
  'newTrip.reminderBefore': {
    one: '{count} dia abans',
    many: '{count} de dies abans',
    other: '{count} dies abans',
  },
  'newTrip.reminderCustom': 'Personalitzat',
  'newTrip.reminderCustomDays': 'Dies abans de la sortida',
  'newTrip.reminderOn': 'Recordatori el {date}',
  'newTrip.reminderNoDeparture': 'Tria una data de sortida per veure el dia.',
  'newTrip.submit': 'Crea el viatge',
  'newTrip.creating': 'S’està creant el viatge',
  'newTrip.error':
    'No s’ha pogut crear el viatge. Torna-ho a provar en un moment.',
  'newTrip.created': 'Viatge creat',
  'newTrip.createdBody': 'Comença a posar llocs al mapa.',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Accions per a {title}',
  'tripActions.copy': 'Copia',
  'tripActions.favourite': 'Afegeix als preferits',
  'tripActions.unfavourite': 'Treu dels preferits',
  'tripActions.edit': 'Edita',
  'tripActions.archive': 'Arxiva',
  'tripActions.restore': 'Restaura',
  'tripActions.delete': 'Elimina',
  'tripActions.deleteForGood': 'Elimina definitivament',
  'tripActions.starFailed': 'El preferit no s’ha desat',
  'tripActions.starFallback': 'El viatge ha tornat a com era.',
  'tripActions.archived': 'Viatge arxivat',
  'tripActions.archiveFailed': 'No s’ha pogut arxivar el viatge',
  'tripActions.restored': 'Viatge restaurat',
  'tripActions.restoreFailed': 'No s’ha pogut restaurar el viatge',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Edita el viatge',
  'editTrip.submit': 'Desa els canvis',
  'editTrip.saving': 'S’està desant el viatge',
  'editTrip.cancel': 'Cancel·la',
  'editTrip.saved': 'Viatge actualitzat',
  'editTrip.errorTitle': 'Això no s’ha desat',
  'editTrip.retry': 'Torna-ho a provar',
  'editTrip.error':
    'No s’ha pogut desar el viatge. Torna-ho a provar d’aquí a un moment.',
  'editTrip.currencyLocked':
    'Aquest viatge ja té preus, per això la moneda del pressupost no es pot canviar aquí. Torna a posar {current} per desar els altres canvis.',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Vols eliminar «{title}» per sempre?',
  'deleteTrip.description':
    'No hi ha desfés ni paperera. Arxivar treu un viatge de la llista sense perdre’l.',
  'deleteTrip.reading': 'S’està llegint què conté aquest viatge',
  'deleteTrip.errorTitle': 'Això no s’ha carregat',
  'deleteTrip.summaryError': 'No s’ha pogut llegir què conté aquest viatge.',
  'deleteTrip.confirmLabel': 'Escriu el nom del viatge per confirmar',
  'deleteTrip.deleting': 'S’està eliminant el viatge',
  'deleteTrip.deleted': 'Viatge eliminat',
  'deleteTrip.failed': 'No s’ha pogut eliminar el viatge',
  'deleteTrip.carried.reservations': {
    one: 'reserva',
    many: 'reserves',
    other: 'reserves',
  },
  'deleteTrip.carried.transports': {
    one: 'trajecte',
    many: 'trajectes',
    other: 'trajectes',
  },
  'deleteTrip.carried.expenses': {
    one: 'despesa',
    many: 'despeses',
    other: 'despeses',
  },
  'deleteTrip.carried.files': {
    one: 'fitxer',
    many: 'fitxers',
    other: 'fitxers',
  },
  'deleteTrip.carried.members': {
    one: 'persona',
    many: 'persones',
    other: 'persones',
  },
  'copyTrip.title': 'Copia «{title}»',
  'copyTrip.nameLabel': 'Nom de la còpia',
  'copyTrip.titleRequired': 'Posa un nom a la còpia.',
  'copyTrip.datesLabel': 'Dates del viatge',
  'copyTrip.datesTogether': 'Posa-hi les dues dates, o esborra-les totes dues.',
  'copyTrip.clearDates': 'Copia sense dates',
  'copyTrip.carries':
    'Els dies, els llocs i les notes passen a la còpia. Les reserves, els diners, els fitxers i les persones no.',
  'copyTrip.shorter':
    'Això és més curt que l’original. Els llocs dels dies sobrants van a les idees i les seves notes es descarten.',
  'copyTrip.submit': 'Copia el viatge',
  'copyTrip.copying': 'S’està copiant el viatge',
  'copyTrip.cancel': 'Cancel·la',
  'copyTrip.started': 'S’està copiant «{title}»',
  'copyTrip.errorTitle': 'Això no s’ha copiat',
  'copyTrip.error':
    'El viatge no s’ha pogut copiar. Torna-ho a provar d’aquí a un moment.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'Qui ho pot veure',
  'visibility.private': 'Només jo',
  'visibility.organization': 'Tothom de l’espai',
  'visibility.public': 'Qualsevol amb l’enllaç',

  'trips.error': 'Els teus viatges no s’han carregat',
  'trips.eyebrow': 'Espai',
  'trips.nothingPlanned': 'Encara no hi ha res planificat',
  'trips.search': 'Cerca viatges',
  'trips.atLimit.title': 'Has omplert tots els viatges que permet el teu pla',
  'trips.atLimit.action': 'Compara els plans',
  'trips.noMatch.title': 'Res no coincideix amb aquest filtre',
  'trips.noMatch.body':
    'Prova una altra etapa, buida la cerca o mira a l’arxiu.',
  'trips.noMatch.action': 'Reinicia els filtres',
  'trips.empty.body':
    'Un viatge aplega l’itinerari, el mapa, les reserves, les llistes d’equipatge i els diners. Comença’n un i la resta ve sola.',
  'trips.next.title': 'A algun lloc després',
  'trips.next.body':
    'Comença un viatge i planned.travel crea un dia per data, a punt per al que has guardat.',
  'trips.savedPlaces': 'Llocs guardats',
  'trips.filter.all': 'Tots',
  'trips.filter.favourites': 'Preferits',
  'trips.view.label': 'Disposició',
  'trips.view.grid': 'Quadrícula',
  'trips.view.list': 'Llista',
  'trips.card.favourite': 'Preferit',
  'trips.card.noDestination': 'Destinació encara per decidir',
  'trips.card.noDates': 'Dates per decidir',
  'trips.card.startsIn': 'en {days} d',
  'trips.card.days': '{days} d',
  'trips.card.copying': 'S’està copiant',
  'trips.card.copyingLabel': '{title} encara s’està copiant',
  'trips.card.copyingReason': 'Espera que acabi la còpia.',
  'metric.trips': 'Viatges',
  'metric.places': 'Llocs',
  'metric.members': 'Membres',
  'metric.files': 'Fitxers',
  'metric.storage_bytes': 'Emmagatzematge',
  'metric.collections': 'Col·leccions',
  'metric.journeys': 'Diaris',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Això no s’ha carregat',
  'error.body':
    'No s’ha perdut res. Torna-ho a provar i, si continua passant, envia’ns el detall de sota.',
  'error.retry': 'Torna-ho a provar',
  'error.dashboard': 'Torna al tauler',
  'error.reported': 'Ens n’han avisat i ho estem mirant.',
  'error.reference': 'Referència',
  'error.feedback.open': 'Explica’ns què ha passat',
  'error.feedback.label': 'Què estaves fent quan ha passat?',
  'error.feedback.send': 'Envia',
  'error.feedback.sent': 'Gràcies — ens ajuda molt.',
  'error.feedback.failed':
    'No s’ha pogut enviar. La referència de dalt encara ens arriba.',
  'error.root': 'Ens hem sortit de la ruta',
  'error.session': 'El teu accés a l’espai de treball ha canviat',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Informa d’un problema',
  'feedback.formTitle': 'Informa d’un problema',
  'feedback.messageLabel': 'Què falla, o què caldria canviar?',
  'feedback.messagePlaceholder': 'Què esperaves i què ha passat en lloc seu?',
  'feedback.emailLabel': 'Adreça electrònica',
  'feedback.emailPlaceholder': 'tu@example.com',
  'feedback.isRequiredLabel': '(obligatori)',
  'feedback.submitButtonLabel': 'Envia l’informe',
  'feedback.cancelButtonLabel': 'Cancel·la',
  'feedback.confirmButtonLabel': 'Confirma',
  'feedback.addScreenshotButtonLabel': 'Afegeix una captura',
  'feedback.removeScreenshotButtonLabel': 'Suprimeix la captura',
  'feedback.highlightToolText': 'Ressalta',
  'feedback.hideToolText': 'Amaga',
  'feedback.successMessageText': 'Gràcies — ja tenim el teu informe.',
  'feedback.errorEmptyMessageText':
    'Escriu una frase primer — un informe buit no ens diu res.',
  'feedback.errorTimeoutText':
    'Està trigant massa i no podem confirmar que l’informe s’hagi enviat.',
  'feedback.errorForbiddenText':
    'Aquesta pàgina no té permís per enviar informes.',
  'feedback.errorGenericText':
    'No s’ha pogut enviar. Comprova la connexió i si hi ha un bloquejador d’anuncis pel mig.',

  'notFound.eyebrow': 'Pàgina 404',
  'notFound.title': 'Aquesta pàgina no és al mapa',
  'notFound.body':
    'Pot ser que l’enllaç sigui antic, o que el viatge que assenyalava s’hagi mogut o esborrat.',
  'notFound.trips': 'Tots els viatges',
  'notFound.rootBody':
    'Hem mirat per tota la ruta. Pot ser que l’adreça tingui una errada, o que la pàgina hagi canviat de lloc.',
  'notFound.home': 'Torna a l’inici',
  'notFound.plans': 'Mira els plans',

  'session.noWorkspace':
    'El teu compte encara no està lligat a cap espai de treball. Tanca la sessió i torna a entrar per acabar de configurar-lo.',
  'session.membershipRemoved':
    'S’ha retirat la teva pertinença a aquest espai de treball.',
} satisfies TranslationOf<typeof En>

export default messages
