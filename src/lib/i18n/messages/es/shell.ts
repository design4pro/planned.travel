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

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Espacio',
  'workspace.switchFailed': 'No se pudo cambiar de espacio',
  'workspace.switchFailedBody': 'Revisa tu conexión e inténtalo otra vez.',

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
  'notification.trip.copied.title': '{tripTitle} está listo',
  'notification.trip.copied.body': {
    one: 'Se copió {days} día',
    many: 'Se copiaron {days} días',
    other: 'Se copiaron {days} días',
  },
  'notification.trip.copied.places': {
    one: '{places} lugar',
    many: '{places} lugares',
    other: '{places} lugares',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} nota descartada',
    many: '{dropped} notas descartadas',
    other: '{dropped} notas descartadas',
  },
  'notification.trip.copyFailed.title': 'No se pudo copiar {tripTitle}',
  'notification.trip.copyFailed.body':
    'No se perdió nada. Vuelve a intentarlo desde el original.',
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
  'notification.billing.invoice_paid.title': 'Pago recibido',
  'notification.billing.invoice_paid.body':
    'La última factura de {organizationName} está pagada.',
  'notification.billing.payment_failed.title': 'Un pago no se ha completado',
  'notification.billing.payment_failed.body':
    '{organizationName} tiene un pago pendiente. Actualiza el método de pago para mantener el plan.',
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
  'dashboard.hero.nights': 'Noches',
  'dashboard.hero.companionsHint': 'en este viaje',
  'dashboard.hero.progress': 'En curso',
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
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Referencia',
  'dashboard.widgets.choose': 'Elegir widgets',
  'dashboard.widgets.description':
    'Los widgets que mantienes junto a tu panel.',
  'dashboard.clock.label': 'Reloj mundial',
  'dashboard.clock.add': 'Añadir una zona horaria',
  'dashboard.clock.search': 'Buscar ciudades y regiones',
  'dashboard.clock.noMatches': 'Ninguna zona horaria con ese nombre',
  'dashboard.clock.remove': 'Quitar {zone}',
  'dashboard.clock.offset': '{offset} respecto a tu hora',
  'dashboard.clock.here': 'Tu propia hora',
  'dashboard.clock.empty.title': 'No hay zonas horarias fijadas',
  'dashboard.clock.empty.body': 'Fija un lugar y lee su reloj junto al tuyo.',
  'dashboard.clock.unknown.title': 'Este dispositivo no conoce {zone}',
  'dashboard.clock.unknown.body':
    'Aquí no se puede leer su hora. Quita la fila para resolverlo.',

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
  'newTrip.currencySearch': 'Buscar por código o nombre',
  'newTrip.currencyEmpty': 'Ninguna moneda coincide.',
  'newTrip.currencyFavourites': 'Favoritas',
  'newTrip.currencyAll': 'Todas las monedas',
  'newTrip.summary': 'Resumen',
  'newTrip.summaryPlaceholder': 'Dos semanas de templos, trenes y ramen.',
  'newTrip.duration': 'Duración en días',
  'newTrip.durationHint':
    'Sin fechas, el viaje empieza con este número de días sin fecha.',
  'newTrip.durationDerived': 'Se calcula a partir de las dos fechas.',
  'newTrip.reminder': 'Recordatorio antes de la salida',
  'newTrip.reminderNone': 'Ninguno',
  'newTrip.reminderBefore': {
    one: '{count} día antes',
    many: '{count} de días antes',
    other: '{count} días antes',
  },
  'newTrip.reminderCustom': 'Personalizado',
  'newTrip.reminderCustomDays': 'Días antes de la salida',
  'newTrip.reminderOn': 'Recordatorio el {date}',
  'newTrip.reminderNoDeparture': 'Elige una fecha de salida para ver el día.',
  'newTrip.submit': 'Crear viaje',
  'newTrip.creating': 'Creando el viaje',
  'newTrip.error':
    'No se pudo crear el viaje. Inténtalo de nuevo en un momento.',
  'newTrip.created': 'Viaje creado',
  'newTrip.createdBody': 'Empieza a poner lugares en el mapa.',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Acciones para {title}',
  'tripActions.copy': 'Copiar',
  'tripActions.favourite': 'Añadir a favoritos',
  'tripActions.unfavourite': 'Quitar de favoritos',
  'tripActions.edit': 'Editar',
  'tripActions.archive': 'Archivar',
  'tripActions.restore': 'Restaurar',
  'tripActions.delete': 'Eliminar',
  'tripActions.deleteForGood': 'Eliminar definitivamente',
  'tripActions.starFailed': 'El favorito no se guardó',
  'tripActions.starFallback': 'El viaje ha vuelto a como estaba.',
  'tripActions.archived': 'Viaje archivado',
  'tripActions.archiveFailed': 'No se pudo archivar el viaje',
  'tripActions.restored': 'Viaje restaurado',
  'tripActions.restoreFailed': 'No se pudo restaurar el viaje',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Editar viaje',
  'editTrip.submit': 'Guardar cambios',
  'editTrip.saving': 'Guardando el viaje',
  'editTrip.cancel': 'Cancelar',
  'editTrip.saved': 'Viaje actualizado',
  'editTrip.errorTitle': 'Eso no se guardó',
  'editTrip.retry': 'Reintentar',
  'editTrip.error':
    'No se pudo guardar el viaje. Inténtalo de nuevo en un momento.',
  'editTrip.currencyLocked':
    'Este viaje ya tiene precios, así que su moneda del presupuesto no se puede cambiar aquí. Vuelve a poner {current} para guardar tus otros cambios.',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': '¿Eliminar «{title}» para siempre?',
  'deleteTrip.description':
    'No hay deshacer ni papelera. Archivar saca un viaje de la lista sin perderlo.',
  'deleteTrip.reading': 'Leyendo lo que contiene este viaje',
  'deleteTrip.errorTitle': 'Eso no se cargó',
  'deleteTrip.summaryError': 'No se pudo leer lo que contiene este viaje.',
  'deleteTrip.confirmLabel': 'Escribe el nombre del viaje para confirmar',
  'deleteTrip.deleting': 'Eliminando el viaje',
  'deleteTrip.deleted': 'Viaje eliminado',
  'deleteTrip.failed': 'No se pudo eliminar el viaje',
  'deleteTrip.carried.reservations': {
    one: 'reserva',
    many: 'reservas',
    other: 'reservas',
  },
  'deleteTrip.carried.transports': {
    one: 'trayecto',
    many: 'trayectos',
    other: 'trayectos',
  },
  'deleteTrip.carried.expenses': {
    one: 'gasto',
    many: 'gastos',
    other: 'gastos',
  },
  'deleteTrip.carried.files': {
    one: 'archivo',
    many: 'archivos',
    other: 'archivos',
  },
  'deleteTrip.carried.members': {
    one: 'persona',
    many: 'personas',
    other: 'personas',
  },
  'copyTrip.title': 'Copiar «{title}»',
  'copyTrip.nameLabel': 'Nombre de la copia',
  'copyTrip.titleRequired': 'Ponle un nombre a la copia.',
  'copyTrip.datesLabel': 'Fechas',
  'copyTrip.datesTogether': 'Pon las dos fechas o borra ambas.',
  'copyTrip.clearDates': 'Copiar sin fechas',
  'copyTrip.carries':
    'Los días, los lugares y las notas pasan a la copia. Las reservas, el dinero, los archivos y las personas no.',
  'copyTrip.shorter':
    'Es más corto que el original. Los lugares de los días sobrantes pasan a ideas y sus notas se descartan.',
  'copyTrip.submit': 'Copiar viaje',
  'copyTrip.copying': 'Copiando el viaje',
  'copyTrip.cancel': 'Cancelar',
  'copyTrip.started': 'Copiando «{title}»',
  'copyTrip.errorTitle': 'Eso no se copió',
  'copyTrip.error':
    'El viaje no se pudo copiar. Inténtalo de nuevo en un momento.',

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
  'trips.view.label': 'Vista',
  'trips.view.grid': 'Cuadrícula',
  'trips.view.list': 'Lista',
  'trips.card.favourite': 'Favorito',
  'trips.card.noDestination': 'Destino aún sin definir',
  'trips.card.noDates': 'Fechas por definir',
  'trips.card.startsIn': 'en {days} d',
  'trips.card.days': '{days} d',
  'trips.card.copying': 'Copiando',
  'trips.card.copyingLabel': '{title} todavía se está copiando',
  'trips.card.copyingReason': 'Espera a que termine la copia.',
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

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Informar de un problema',
  'feedback.formTitle': 'Informar de un problema',
  'feedback.messageLabel': '¿Qué falla o qué habría que cambiar?',
  'feedback.messagePlaceholder': '¿Qué esperabas y qué pasó en su lugar?',
  'feedback.emailLabel': 'Correo electrónico',
  'feedback.emailPlaceholder': 'tu@example.com',
  'feedback.isRequiredLabel': '(obligatorio)',
  'feedback.submitButtonLabel': 'Enviar el informe',
  'feedback.cancelButtonLabel': 'Cancelar',
  'feedback.confirmButtonLabel': 'Confirmar',
  'feedback.addScreenshotButtonLabel': 'Añadir una captura',
  'feedback.removeScreenshotButtonLabel': 'Quitar la captura',
  'feedback.highlightToolText': 'Resaltar',
  'feedback.hideToolText': 'Ocultar',
  'feedback.successMessageText': 'Gracias — ya tenemos tu informe.',
  'feedback.errorEmptyMessageText':
    'Escribe una frase primero — un informe vacío no nos dice nada.',
  'feedback.errorTimeoutText':
    'Está tardando demasiado y no podemos confirmar que el informe se haya enviado.',
  'feedback.errorForbiddenText':
    'Esta página no tiene permiso para enviar informes.',
  'feedback.errorGenericText':
    'No se pudo enviar. Comprueba la conexión y si hay un bloqueador de anuncios de por medio.',

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
