/**
 * Everything the application shell says, in Spanish.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tú» throughout, matching `./ui.ts` and `./settings.ts`.
 *
 * **Plural.** `Intl.PluralRules('es')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Feature names are translated, not borrowed.** «Atlas», «Vacay» and
 * «Journey» are English words a Spanish reader would have to decode, so the nav
 * says what each screen is: el mapa del mundo, las vacaciones, el diario. The
 * short forms are the one-word versions the 360px tab bar has room for.
 *
 * **Stored notification copy.** `src/server/repos/notifications.ts` keeps a
 * notification as `titleKey` + `bodyKey` + params, so these keys are read
 * months after the row was written, in whatever language the reader has set.
 * They are phrased so that a proper noun can land in the middle of the sentence
 * without breaking its grammar.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Secciones principales',
  'nav.mobile': 'Secciones',
  'nav.dashboardLink': 'Panel de planned.travel',
  'nav.homeLink': 'Inicio de planned.travel',
  'nav.newTrip': 'Viaje nuevo',

  'nav.trips': 'Mis viajes',
  'nav.trips.short': 'Viajes',
  'nav.vacay': 'Vacaciones',
  'nav.vacay.short': 'Vacaciones',
  'nav.atlas': 'Mapa del mundo',
  'nav.atlas.short': 'Mapa',
  'nav.journey': 'Diario',
  'nav.journey.short': 'Diario',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Secciones del viaje',
  'trip.nav.back': 'Viajes',
  'trip.nav.share': 'Compartir',
  'trip.nav.shareLabel': 'Compartir este viaje',
  'trip.tab.plan': 'Itinerario',
  'trip.tab.transports': 'Transportes',
  'trip.tab.book': 'Reservas',
  'trip.tab.lists': 'Listas',
  'trip.tab.costs': 'Gastos',
  'trip.tab.files': 'Archivos',
  'trip.tab.collab': 'Grupo',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Menú de la cuenta',
  'account.settings': 'Ajustes',
  'account.billing': 'Plan y facturación',
  'account.admin': 'Administración',
  'account.signOut': 'Cerrar sesión',
  'account.signingOut': 'Cerrando la sesión…',
  'account.signOutFailed': 'No se pudo cerrar la sesión',
  'account.signOutFailedBody': 'Revisa tu conexión e inténtalo otra vez.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Apariencia',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.system': 'Seguir al sistema',
  'theme.state.light': 'claro',
  'theme.state.dark': 'oscuro',
  'theme.state.system': 'siguiendo al sistema',
  'theme.trigger': 'Tema: {state}. Cambiar el tema',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Notificaciones, ninguna sin leer',
  'bell.unread': {
    one: 'Notificaciones, {unread} sin leer',
    many: 'Notificaciones, {unread} sin leer',
    other: 'Notificaciones, {unread} sin leer',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Bandeja de entrada',
  'inbox.title': 'Notificaciones',
  'inbox.error': 'Tu bandeja no se ha cargado',
  'inbox.allRead': 'Está todo leído',
  'inbox.unread': {
    one: '{unread} mensaje sin leer',
    many: '{unread} mensajes sin leer',
    other: '{unread} mensajes sin leer',
  },
  'inbox.markAll': 'Marcar todo como leído',
  'inbox.markingAll': 'Marcando todo como leído',
  'inbox.cleared': 'Bandeja al día',
  'inbox.markAllFailed': 'No se pudo marcar todo como leído',
  'inbox.retryHint': 'Revisa tu conexión e inténtalo otra vez.',
  'inbox.filter.all': 'Todo',
  'inbox.filter.unread': 'Sin leer',
  'inbox.waiting': {
    one: '{invitations} invitación esperando',
    many: '{invitations} invitaciones esperando',
    other: '{invitations} invitaciones esperando',
  },
  'inbox.empty.title': 'Tu bandeja está vacía',
  'inbox.empty.body':
    'Aquí llegan las invitaciones a viajes, los cambios de plan, los recordatorios de reservas y las cuentas saldadas.',
  'inbox.empty.action': 'Volver al panel',
  'inbox.emptyUnread.title': 'Nada sin leer',
  'inbox.emptyUnread.body':
    'Lo has leído todo. Cambia a Todo para repasar el historial.',
  'inbox.emptyUnread.action': 'Mostrarlo todo',
  'inbox.row.new': 'Nuevo',
  'inbox.row.accepted': 'Aceptada',
  'inbox.row.declined': 'Rechazada',
  'inbox.row.open': 'Abrir',
  'inbox.row.markRead': 'Leída',
  'inbox.row.markingRead': 'Marcando como leída',
  'inbox.row.markReadFailed': 'No se pudo marcar como leída',
  'inbox.preferences':
    'Elige cuáles de estas llegan a tu bandeja, a tu correo y a tu teléfono.',
  'inbox.preferencesAction': 'Ajustes de notificaciones',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Te han invitado a {tripTitle}',
  'notification.trip.invited.body': '{actorName} te ha añadido al viaje.',
  'notification.trip.updated.title': '{tripTitle} ha cambiado',
  'notification.trip.updated.body': '{actorName} ha cambiado el plan.',
  'notification.trip.member_added.title':
    '{memberName} se ha unido a {tripTitle}',
  'notification.trip.member_added.body':
    'Ya puede ver el itinerario, las reservas y el dinero.',
  'notification.trip.member_removed.title':
    '{memberName} ha dejado {tripTitle}',
  'notification.trip.member_removed.body': 'Su acceso al viaje ha terminado.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} empieza dentro de {days} día',
    many: '{tripTitle} empieza dentro de {days} días',
    other: '{tripTitle} empieza dentro de {days} días',
  },
  'notification.trip.starting_soon.body':
    'Buen momento para repasar la lista de equipaje y las reservas.',
  'notification.reservation.reminder.title': '{title} está al caer',
  'notification.reservation.reminder.body':
    'Comprueba la hora y el código de confirmación en la reserva.',
  'notification.reservation.confirmed.title': '{title} está confirmada',
  'notification.reservation.confirmed.body':
    'La reserva figura como confirmada en {tripTitle}.',
  'notification.expense.added.title': '{actorName} ha añadido un gasto',
  'notification.expense.added.body': '{title}, en {tripTitle}.',
  'notification.expense.settled.title': '{actorName} ha saldado la cuenta',
  'notification.expense.settled.body': 'El saldo de {tripTitle} está pagado.',
  'notification.list.assigned.title': '{actorName} te ha asignado una tarea',
  'notification.list.assigned.body': '{title}, en {tripTitle}.',
  'notification.collab.message.title': '{actorName} ha escrito en {tripTitle}',
  'notification.collab.message.body': '«{preview}»',
  'notification.collab.poll.title': 'Hay una votación abierta en {tripTitle}',
  'notification.collab.poll.body': '«{question}»',
  'notification.organization.invited.title':
    'Te han invitado a {organizationName}',
  'notification.organization.invited.body':
    'Acepta para entrar en el espacio de trabajo y en todo lo que se comparte allí.',
  'notification.journey.published.title': '{title} ya está publicado',
  'notification.journey.published.body':
    'Cualquiera que tenga el enlace puede leer el diario.',
  'notification.billing.plan_changed.title': 'Tu plan ha cambiado',
  'notification.billing.plan_changed.body':
    '{organizationName} ya está en el plan {plan}.',
  'notification.fallback.title': 'Algo ha cambiado en tu espacio de trabajo',
  'notification.fallback.body': 'Abre el viaje para ver qué ha sido.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'El panel no se ha cargado',
  'dashboard.blank.title': 'Tu próximo viaje empieza aquí',
  'dashboard.blank.body':
    'Crea un viaje, marca en el mapa los sitios que quieres ver y planned.travel armará el plan día a día a su alrededor.',
  'dashboard.blank.action': 'Planear un viaje',
  'dashboard.blank.secondary': 'Ver tu mapa del mundo',

  'dashboard.upNext': 'Lo siguiente',
  'dashboard.openPlan': 'Abrir el plan',
  'dashboard.hero.travellers': 'Viajeros',
  'dashboard.hero.travellersHint': 'en este espacio',
  'dashboard.hero.dates': 'Fechas',
  'dashboard.hero.datesUnset': 'Sin definir',
  'dashboard.hero.datesHint': {
    one: '{days} día',
    many: '{days} días',
    other: '{days} días',
  },
  'dashboard.hero.datesMissing': 'Añade fechas para crear los días',
  'dashboard.hero.startsIn': 'Empieza en',
  'dashboard.hero.started': 'Empezó hace',
  'dashboard.hero.today': 'Hoy',
  'dashboard.hero.startUnknown': 'sin fecha de inicio',
  'dashboard.hero.startToday': '¡buen viaje!',
  /**
   * The label above the numeral already says «hace», so the unit below it is
   * only the word for a day. Spanish would otherwise read the tile twice.
   */
  'dashboard.hero.startPast': {
    one: 'día',
    many: 'días',
    other: 'días',
  },
  'dashboard.hero.startFuture': {
    one: 'día',
    many: 'días',
    other: 'días',
  },
  'dashboard.hero.places': 'Lugares',
  'dashboard.hero.placesNone': 'aún no hay nada en el mapa',
  'dashboard.hero.placesHint': 'en el mapa',

  'dashboard.stat.countries': 'Países visitados',
  'dashboard.stat.countriesUnit': 'de {total}',
  'dashboard.stat.countriesNone': 'Marca un país para empezar tu mapa',
  'dashboard.stat.visits': {
    one: '{visits} visita registrada',
    many: '{visits} visitas registradas',
    other: '{visits} visitas registradas',
  },
  'dashboard.stat.trips': 'Viajes en total',
  'dashboard.stat.tripsCaption':
    '{planning} en preparación · {booked} con reserva',
  'dashboard.stat.places': 'Lugares en el mapa',
  'dashboard.stat.placesNone': 'Todavía no hay nada en el mapa',
  'dashboard.stat.placesAcross': {
    one: 'en {trips} viaje',
    many: 'en {trips} viajes',
    other: 'en {trips} viajes',
  },
  'dashboard.stat.bookings': 'Reservas confirmadas',
  'dashboard.stat.bookingsNone': 'No hay reservas próximas',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} reserva en camino',
    many: '{bookings} reservas en camino',
    other: '{bookings} reservas en camino',
  },

  'dashboard.trips.label': 'Tus viajes',
  'dashboard.trips.all': 'Todos los viajes',
  'dashboard.trips.empty.title': 'Aún no hay viajes',
  'dashboard.trips.empty.body':
    'Todo lo que planees aparecerá aquí, lo más reciente primero.',
  'dashboard.trips.empty.action': 'Crear un viaje',

  'dashboard.bookings.label': 'Próximas reservas',
  'dashboard.bookings.empty.title': 'Todavía no hay nada reservado',
  'dashboard.bookings.empty.body':
    'Los alojamientos, las mesas y las entradas confirmadas aparecen aquí a medida que se acerca su fecha.',

  'dashboard.pipeline.label': 'Viajes por etapa',
  'dashboard.pipeline.empty':
    'No hay nada en marcha. Tu primer viaje repartirá esto por etapas.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favorito',
    many: '{favourites} favoritos',
    other: '{favourites} favoritos',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} viaje archivado',
    many: '{archived} viajes archivados',
    other: '{archived} viajes archivados',
  },

  'dashboard.storage.label': 'Almacenamiento',
  'dashboard.storage.count': '{used} de {limit}',
  'dashboard.storage.files': {
    one: '{files} archivo entre todos tus viajes, fotos y billetes incluidos.',
    many: '{files} archivos entre todos tus viajes, fotos y billetes incluidos.',
    other:
      '{files} archivos entre todos tus viajes, fotos y billetes incluidos.',
  },
  'dashboard.storage.more': '¿Necesitas más sitio?',
  'dashboard.storage.plans': 'Ver los planes',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'La consola de administración no se ha cargado',
  'admin.denied.title': 'Esto solo lo abren los administradores del espacio',
  'admin.denied.body':
    'Si lo necesitas, pide a un propietario o a un administrador de este espacio que cambie tu rol.',
  'admin.denied.action': 'Volver al panel',
  'admin.eyebrow': 'Administración del espacio',
  'admin.description': 'Plan {plan} · creado el {date}',
  'admin.createdUnknown': 'hace poco',
  'admin.workspaceSettings': 'Ajustes del espacio',
  'admin.billing': 'Plan y facturación',

  'admin.invitations.title': {
    one: '{invitations} invitación sin responder',
    many: '{invitations} invitaciones sin responder',
    other: '{invitations} invitaciones sin responder',
  },
  'admin.invitations.body':
    'Cada invitación pendiente ocupa una de las plazas que paga tu plan.',
  'admin.invitations.action': 'Revisar las invitaciones',

  'admin.stat.members': 'Miembros',
  'admin.stat.membersCaption': {
    one: '{invitations} invitación pendiente',
    many: '{invitations} invitaciones pendientes',
    other: '{invitations} invitaciones pendientes',
  },
  'admin.stat.storage': 'Almacenamiento',
  'admin.stat.storageUnit': 'de {limit}',
  'admin.stat.storageUnlimited': 'sin tope',
  'admin.stat.storageCaption': 'Archivos, fotos y exportaciones',
  'admin.stat.audit': 'Registros de auditoría',
  'admin.stat.auditCaption': 'Debajo tienes la actividad más reciente',
  'admin.stat.plan': 'Plan contratado',
  'admin.stat.planCaption': 'Las cuotas se aplican en la capa de datos',

  'admin.quotas.label': 'Cuotas',
  'admin.quotas.count': {
    one: '{metrics} métrica',
    many: '{metrics} métricas',
    other: '{metrics} métricas',
  },
  'admin.quotas.unlimited': 'Sin límite',
  'admin.quotas.value': '{used} de {limit}',

  'admin.members.label': 'Miembros',
  'admin.members.table': 'Miembros de este espacio de trabajo',
  'admin.members.person': 'Persona',
  'admin.members.role': 'Rol',
  'admin.members.joined': 'Se unió',

  'admin.activity.label': 'Actividad reciente',
  'admin.activity.empty.title': 'Aún no hay nada registrado',
  'admin.activity.empty.body':
    'Cada cambio que importa se añade al registro en cuanto ocurre.',
  'admin.activity.workspace': 'el propio espacio de trabajo',
  'admin.actions.label': 'Acciones más frecuentes',
  'admin.actions.count': {
    one: '{actions} acción',
    many: '{actions} acciones',
    other: '{actions} acciones',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Borrador',
  'tripStatus.planning': 'En preparación',
  'tripStatus.booked': 'Reservado',
  'tripStatus.active': 'En marcha',
  'tripStatus.completed': 'Terminado',
  'tripStatus.archived': 'Archivado',

  'bookingStatus.none': 'Sin reservar',
  'bookingStatus.pending': 'Pendiente',
  'bookingStatus.confirmed': 'Confirmada',
  'bookingStatus.cancelled': 'Cancelada',
  'bookingStatus.completed': 'Finalizada',

  'bookingType.accommodation': 'Alojamiento',
  'bookingType.restaurant': 'Mesa',
  'bookingType.activity': 'Actividad',
  'bookingType.tour': 'Excursión',
  'bookingType.ticket': 'Entrada',
  'bookingType.transport': 'Transporte',
  'bookingType.other': 'Reserva',

  'role.owner': 'Propietario',
  'role.admin': 'Administrador',
  'role.member': 'Miembro',

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} viaje',
    many: '{value} viajes',
    other: '{value} viajes',
  },
  'trips.count.favourites': {
    one: '{value} favorito',
    many: '{value} favoritos',
    other: '{value} favoritos',
  },
  'trips.count.archived': {
    one: '{value} archivado',
    many: '{value} archivados',
    other: '{value} archivados',
  },
  'trips.atLimit.body':
    'Tu plan cubre {trips}. Archiva alguno que hayas terminado o pasa a un plan superior para tener más abiertos a la vez.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nuevo diario',
  'newJourney.title': 'Empieza un diario',
  'newJourney.description':
    'Un diario es la cara escrita de un viaje: entradas en orden de fecha, con las fotos y el tiempo que recuerdas.',
  'newJourney.titlePlaceholder': 'Dos semanas en Kioto',
  'newJourney.subtitle': 'Subtítulo',
  'newJourney.subtitleHint': 'Una línea bajo el título, en la portada.',
  'newJourney.subtitlePlaceholder': 'Templos, trenes y demasiado matcha',
  'newJourney.trip': 'A partir de un viaje',
  'newJourney.tripHint': 'Opcional: enlaza el relato con su plan.',
  'newJourney.tripNone': 'Sin viaje asociado',
  'newJourney.datesError': 'La fecha de fin es anterior al inicio.',
  'newJourney.submit': 'Crear diario',
  'newJourney.creating': 'Creando el diario',
  'newJourney.created': 'Diario empezado',
  'newJourney.createdBody': 'Añade tu primera entrada para empezar el relato.',
  'newJourney.error':
    'No se pudo crear el diario. Inténtalo de nuevo en un momento.',
  'newCollection.trigger': 'Nueva colección',
  'newCollection.title': 'Empieza una colección',
  'newCollection.description':
    'Un sitio para los lugares que encuentras antes de saber a qué viaje pertenecen.',
  'newCollection.namePlaceholder': 'Un café que merece cruzar la ciudad',
  'newCollection.descriptionHint': 'Qué entra aquí y qué no.',
  'newCollection.submit': 'Crear colección',
  'newCollection.creating': 'Creando la colección',
  'newCollection.created': 'Colección creada',
  'newCollection.createdBody': 'Empieza a guardar lugares en ella.',
  'newCollection.error':
    'No se pudo crear la colección. Inténtalo de nuevo en un momento.',

  'newTrip.title': 'Empieza un viaje nuevo',
  'newTrip.description':
    'Con un título es suficiente. Las fechas construyen el plan día a día, y lo demás puede esperar a que lo sepas.',
  'newTrip.name': 'Nombre del viaje',
  'newTrip.namePlaceholder': 'Kioto en temporada de cerezos',
  'newTrip.destination': 'Destino',
  'newTrip.destinationHint': 'Una ciudad, una región o toda la ruta.',
  'newTrip.destinationPlaceholder': 'Kioto, Japón',
  'newTrip.departure': 'Salida',
  'newTrip.return': 'Regreso',
  'newTrip.returnError': 'La fecha de regreso es anterior a la salida.',
  'newTrip.currency': 'Moneda del presupuesto',
  'newTrip.currencyHint': 'En ella se suma cada gasto de este viaje.',
  'newTrip.submit': 'Crear viaje',
  'newTrip.creating': 'Creando el viaje',
  'newTrip.error':
    'No se pudo crear el viaje. Inténtalo de nuevo en un momento.',
  'newTrip.created': 'Viaje creado',
  'newTrip.createdBody': 'Empieza a poner lugares en el mapa.',

  /* ------------------------------------ who can see a thing */
  'visibility.label': 'Quién puede verlo',
  'visibility.private': 'Solo yo',
  'visibility.organization': 'Todos en el espacio',
  'visibility.public': 'Cualquiera con el enlace',

  'trips.error': 'Tus viajes no se cargaron',
  'trips.eyebrow': 'Espacio',
  'trips.nothingPlanned': 'Nada planeado todavía',
  'trips.search': 'Buscar viajes',
  'trips.atLimit.title': 'Has ocupado todos los viajes que permite tu plan',
  'trips.atLimit.action': 'Comparar planes',
  'trips.noMatch.title': 'Nada coincide con ese filtro',
  'trips.noMatch.body':
    'Prueba otra etapa, borra la búsqueda o mira en el archivo.',
  'trips.noMatch.action': 'Restablecer filtros',
  'trips.empty.body':
    'Un viaje reúne el itinerario, el mapa, las reservas, las listas de equipaje y el dinero. Empieza uno y lo demás llega solo.',
  'trips.next.title': 'A algún sitio después',
  'trips.next.body':
    'Empieza un viaje y planned.travel crea un día por fecha, listo para lo que has guardado.',
  'trips.savedPlaces': 'Lugares guardados',
  'trips.filter.all': 'Todos',
  'trips.filter.favourites': 'Favoritos',
  'trips.card.favourite': 'Favorito',
  'trips.card.noDestination': 'Destino aún sin definir',
  'trips.card.noDates': 'Fechas por definir',
  'trips.card.startsIn': 'en {days} d',
  'trips.card.days': '{days} d',
  'metric.trips': 'Viajes',
  'metric.places': 'Lugares',
  'metric.members': 'Miembros',
  'metric.files': 'Archivos',
  'metric.storage_bytes': 'Almacenamiento',
  'metric.collections': 'Colecciones',
  'metric.journeys': 'Diarios',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Esto no se ha cargado',
  'error.body':
    'No se ha perdido nada. Inténtalo otra vez y, si sigue pasando, mándanos el detalle de abajo.',
  'error.retry': 'Intentarlo otra vez',
  'error.dashboard': 'Volver al panel',
  'error.reported': 'Nos ha llegado el aviso y lo estamos revisando.',
  'error.reference': 'Referencia',
  'error.feedback.open': 'Cuéntanos qué ha pasado',
  'error.feedback.label': '¿Qué estabas haciendo cuando ocurrió?',
  'error.feedback.send': 'Enviar',
  'error.feedback.sent': 'Gracias, nos ayuda mucho.',
  'error.feedback.failed':
    'No se ha enviado. La referencia de arriba nos llega igualmente.',
  'error.root': 'Nos hemos salido de la ruta',
  'error.session': 'Tu acceso al espacio de trabajo ha cambiado',

  'notFound.eyebrow': 'Página 404',
  'notFound.title': 'Esta página no está en el mapa',
  'notFound.body':
    'Puede que el enlace esté anticuado, o que el viaje al que apuntaba se moviera o se borrara.',
  'notFound.trips': 'Todos los viajes',
  'notFound.rootBody':
    'Hemos mirado por toda la ruta. Puede que la dirección tenga una errata, o que la página se haya mudado.',
  'notFound.home': 'Volver al inicio',
  'notFound.plans': 'Ver los planes',

  'session.noWorkspace':
    'Tu cuenta todavía no está en ningún espacio de trabajo. Cierra la sesión y vuelve a entrar para terminar de configurarla.',
  'session.membershipRemoved':
    'Se ha retirado tu pertenencia a este espacio de trabajo.',
} satisfies TranslationOf<typeof En>

export default messages
