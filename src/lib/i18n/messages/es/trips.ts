/**
 * The trip tabs' own copy, in es.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`; `many` solo para números compactos grandes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'No encontramos este viaje',
  'notFound.body':
    'No está entre los viajes que puedes abrir en el espacio de trabajo actual. Puede que se haya eliminado o que no tengas acceso a él.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Añadir un lugar a este viaje',
  'plan.editor.editTitle': 'Editar este lugar',
  'plan.editor.createDescription':
    'Ponle un nombre ahora y una ubicación después - un lugar sin planificar espera en el panel de lugares hasta que lo asignes a un día.',
  'plan.editor.editDescription':
    'Los cambios se aplican en todas partes: el mapa, cada día asignado y la lista de lugares del viaje.',
  'plan.editor.nameRequired': 'El lugar necesita un nombre',
  'plan.editor.nameExample': 'p. ej., Fushimi Inari Taisha',
  'plan.editor.city': 'Ciudad',
  'plan.editor.cityExample': 'p. ej., Kioto',
  'plan.editor.addressExample': 'p. ej., 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Tiempo en el lugar',
  'plan.editor.rating': '¿Merece la pena?',
  'plan.editor.latitude': 'Latitud',
  'plan.editor.longitude': 'Longitud',
  'plan.editor.positionHint': 'O cierra esto y elige el punto en el mapa.',
  'plan.editor.latitudeError': 'Entre -90 y 90',
  'plan.editor.longitudeError': 'Entre -180 y 180',
  'plan.editor.positionError': 'La ubicación necesita ambos números',
  'plan.editor.day': 'Asignar a un día',
  'plan.editor.dayHint': 'Déjalo vacío para mantenerlo en el panel de lugares.',
  'plan.editor.unplanned': 'Dejar sin planificar',
  'plan.editor.dayNamed': 'Día {day} · {title}',
  'plan.editor.stopFallback': 'Esta parada',
  'plan.editor.dayNumber': 'Día {day}',
  'plan.editor.visited': 'Ya visitado',
  'plan.editor.visitedHint': 'Marca el pin con una señal de verificación.',
  'plan.editor.saving': 'Guardando el lugar',
  'plan.editor.save': 'Guardar cambios',
  'plan.editor.noCategory': 'Sin categoría',
  'plan.editor.arrive': 'Llegada',
  'plan.editor.leave': 'Salida',
  'plan.editor.timeError': 'La salida debe ser posterior a la llegada',
  'plan.editor.booking': 'Reserva',
  'plan.editor.note': 'Nota para esta parada',
  'plan.editor.noteExample':
    'Ve temprano - después de las 9, la cola dura una hora.',
  'plan.editor.savingTimes': 'Guardando los horarios',
  'plan.editor.saveTimes': 'Guardar',
  'plan.editor.duration0': 'Sin duración fija',
  'plan.editor.duration30': '30 minutos',
  'plan.editor.duration45': '45 minutos',
  'plan.editor.duration60': '1 hora',
  'plan.editor.duration90': '1½ horas',
  'plan.editor.duration120': '2 horas',
  'plan.editor.duration180': '3 horas',
  'plan.editor.duration240': 'Medio día',
  'plan.editor.duration480': 'Un día entero',
  'plan.editor.rating0': 'Sin valorar',
  'plan.editor.rating1': '★ 1 - mejor evitarlo',
  'plan.editor.rating2': '★ 2 - si hay tiempo',
  'plan.editor.rating3': '★ 3 - merece la pena',
  'plan.editor.rating4': '★ 4 - muy bueno',
  'plan.editor.rating5': '★ 5 - no te lo pierdas',
  'plan.editor.bookingNone': 'No hace falta reservar',
  'plan.editor.bookingPending': 'Pendiente de reservar',
  'plan.editor.bookingConfirmed': 'Reservado y confirmado',
  'plan.editor.bookingCompleted': 'Visita completada',
  'plan.editor.bookingCancelled': 'Cancelado',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'No se pudo cargar este viaje',
  'error.plan': 'No se pudo cargar el itinerario',
  'error.costs': 'No se pudieron cargar los gastos',
  'error.collab': 'No se pudo cargar la conversación',
  'error.book': 'No se pudieron cargar las reservas',
  'error.transports': 'Los trayectos no se cargaron',
  'error.people': 'No se pudieron cargar las personas',
  'header.length': {
    one: '{days} día',
    many: '{days} días',
    other: '{days} días',
  },
  'header.planned': {
    one: '{days} día planificado',
    many: '{days} días planificados',
    other: '{days} días planificados',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Itinerario',
  'plan.places': 'Lugares',
  'plan.readOnly.archived':
    'Este viaje está archivado, así que el plan es de solo lectura.',
  'plan.readOnly.role':
    'Puedes ver este plan. Solo el propietario del viaje y quienes pueden editar pueden cambiarlo.',
  'plan.day.empty': 'Nada planeado: arrastra aquí un lugar o una nota',
  'plan.move.refused.duplicate': '{name} ya está en ese día',
  'plan.move.refused.duplicateBody':
    'Un lugar solo puede aparecer una vez por día. Muévelo a otro día.',
  'plan.move.refused.notInIdeas': 'Una nota se queda en el día',
  'plan.move.refused.notInIdeasBody':
    'Las ideas son lugares que esperan un día. Una nota siempre pertenece a un día.',
  'plan.move.refused.journeyNotInIdeas': 'Un trayecto se queda en el día',
  'plan.move.refused.journeyNotInIdeasBody':
    'Las ideas son lugares que esperan un día. Un trayecto pertenece al día en que ocurre.',
  'plan.move.refused.journeyNotInAnotherDay': 'Un trayecto se queda en su día',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'El día de un trayecto viene de sus fechas. Cámbialas en la pestaña Trayectos.',
  'plan.move.refused.journeyTimed': '{name} sale a las {time}',
  'plan.move.refused.journeyTimedBody':
    'La hora de salida es del horario, no del plan. Coloca el trayecto donde marca su reloj.',
  'plan.move.spoken.duplicate': '{name} no se ha movido. Ese día ya lo tiene.',
  'plan.move.spoken.notInIdeas':
    '{name} no se ha movido. Una nota se queda en el día.',
  'plan.move.spoken.timed':
    '{name} tiene la hora {time}. Preguntamos si quitarla.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} no se ha movido. Un trayecto se queda en el día.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} no se ha movido. Un trayecto se queda en su día.',
  'plan.move.spoken.journeyTimed': '{name} no se ha movido. Sale a las {time}.',
  'plan.move.error.save': 'Ese movimiento no se ha guardado',
  'plan.move.error.retry': 'Inténtalo de nuevo en un momento.',
  'plan.move.dropTime.title': '¿Mover {name} y quitar las {time}?',
  'plan.move.dropTime.body':
    'Esta posición contradice la hora que tiene. Moverlo aquí borra la hora: el nuevo orden y la hora borrada se guardan juntos.',
  'plan.move.dropTime.confirm': 'Mover y quitar la hora',
  'plan.move.dropTime.cancel': 'Dejarlo donde está',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Añadir una nota',
  'plan.note.addForDay': 'Añadir una nota, {day}',
  'plan.addPlace.label': 'Añadir un lugar',
  'plan.addPlace.more': 'Más formas de añadir un lugar',
  'plan.addPlace.option.map': 'Colocarlo en el mapa',
  'plan.addPlace.forDayNamed': 'Añadir un lugar, {day}',
  'plan.addPlace.quota':
    'Has alcanzado el límite de lugares de tu plan. Mejora tu plan para añadir más.',
  'plan.addPlace.quotaAction': 'Ver planes',
  'plan.stay.checkIn': 'Entrada',
  'plan.stay.checkOut': 'Salida',
  'plan.day.addStay': 'Añadir un alojamiento, {day}',
  'plan.day.addStayShort': 'Añadir un alojamiento',
  'plan.handoff.stop':
    'Abrir {place} en {service} (se abre en una pestaña nueva)',
  'plan.handoff.day.directions': 'Cómo llegar en {service}',
  'plan.handoff.day.directionsName':
    'Cómo llegar en {service}: {day} (se abre en una pestaña nueva)',
  'plan.handoff.day.directionsPartial':
    'Paradas: las primeras {carried} de {total}',
  'plan.handoff.day.directionsPartialName':
    'Cómo llegar en {service}: {day}, paradas: las primeras {carried} de {total} (se abre en una pestaña nueva)',
  'plan.handoff.day.point': 'Ver en {service}',
  'plan.handoff.day.pointName':
    'Ver en {service}: la única parada con ubicación de {day} (se abre en una pestaña nueva)',
  'plan.drop.hint':
    'Haz clic derecho en el mapa, o mantén pulsado, para añadir un lugar justo ahí.',
  'plan.drop.armed':
    'Haz clic en el mapa donde va, o mueve el mapa y pulsa Intro para dejarlo en el centro.',
  'plan.drop.stop': 'Dejar de colocar un nuevo marcador',
  'plan.drop.pin': 'Lugar nuevo',
  'plan.drop.lookingUp': 'Buscando la dirección…',
  'plan.drop.error':
    'No se pudo colocar el pin. Vuelve a intentarlo en un momento.',
  'plan.place.pastedPosition': 'Leído como latitud {lat}, longitud {lng}',
  'plan.note.showMore': 'Mostrar más',
  'plan.note.showLess': 'Mostrar menos',
  'plan.note.moveUp': 'Subir',
  'plan.note.moveDown': 'Bajar',
  'plan.note.drag': 'Reordenar la nota',
  'plan.note.edit': 'Editar la nota',
  'plan.note.delete': 'Eliminar la nota',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Añadir una nota',
  'plan.note.dialog.editTitle': 'Editar la nota',
  'plan.note.field.body': 'Nota',
  'plan.note.field.bodyHint': 'Una línea. Es lo que muestra el día.',
  'plan.note.field.detail': 'Detalles',
  'plan.note.field.detailHint':
    'Títulos, listas, enlaces, citas, código y tablas.',
  'plan.note.field.time': 'Hora',
  'plan.note.field.timeHint': 'Opcional, en formato de 24 horas.',
  'plan.note.field.icon': 'Icono',
  'plan.note.tab.write': 'Escribir',
  'plan.note.tab.preview': 'Vista previa',
  'plan.note.previewEmpty': 'Todavía no hay nada que previsualizar',
  'plan.note.save': 'Guardar la nota',
  'plan.note.cancel': 'Cancelar',
  'plan.note.confirmDelete': '¿Eliminar esta nota?',
  'plan.note.confirmDeleteBody':
    'La nota y sus detalles desaparecen de este día.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Nota añadida',
  'plan.note.toast.updated': 'Nota guardada',
  'plan.note.toast.deleted': 'Nota eliminada',
  'plan.note.error.save': 'La nota no se ha guardado',
  'plan.note.error.delete': 'La nota no se ha eliminado',
  'plan.note.error.retry': 'Inténtalo de nuevo en un momento.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Recordatorio',
  'plan.note.icon.clock': 'Hora',
  'plan.note.icon.flashlight': 'Linterna',
  'plan.note.icon.footprints': 'Paseo',
  'plan.note.icon.info': 'Información',
  'plan.note.icon.luggage': 'Equipaje',
  'plan.note.icon.package': 'Paquete',
  'plan.note.icon.ticket': 'Entradas',
  'plan.note.icon.trainFront': 'Tren',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Nota',
  'plan.note.icon.utensils': 'Comida',
  'plan.note.icon.bus': 'Transporte',
  'plan.note.icon.bedDouble': 'Alojamiento',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Lugar',
  'plan.note.icon.wallet': 'Dinero',
  'plan.note.icon.umbrella': 'Lluvia',
  'plan.note.icon.triangleAlert': 'Aviso',
  'plan.transport.phase.flight.departing': 'Despegue',
  'plan.transport.phase.flight.travelling': 'En vuelo',
  'plan.transport.phase.flight.arriving': 'Aterrizaje',
  'plan.transport.phase.hire.departing': 'Recogida',
  'plan.transport.phase.hire.travelling': 'De alquiler',
  'plan.transport.phase.hire.arriving': 'Devolución',
  'plan.transport.phase.journey.departing': 'Inicio',
  'plan.transport.phase.journey.travelling': 'En camino',
  'plan.transport.phase.journey.arriving': 'Fin',
  'plan.transport.label': 'De {from} a {to}',
  'plan.transport.drag': 'Reordenar, {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'En común',
  'collab.empty': 'Todavía no se ha compartido nada',
  'collab.conversation': 'Conversación',
  'collab.count.messages': {
    one: '{messages} mensaje',
    many: '{messages} mensajes',
    other: '{messages} mensajes',
  },
  'collab.count.notes': {
    one: '{notes} nota',
    many: '{notes} notas',
    other: '{notes} notas',
  },
  'collab.count.polls': {
    one: '{polls} encuesta',
    many: '{polls} encuestas',
    other: '{polls} encuestas',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Reservas',
  'book.empty': 'Todavía no hay nada reservado',
  'book.count.bookings': {
    one: '{bookings} reserva',
    many: '{bookings} reservas',
    other: '{bookings} reservas',
  },
  'book.count.confirmed': {
    one: '{confirmed} confirmada',
    many: '{confirmed} confirmadas',
    other: '{confirmed} confirmadas',
  },
  'book.progressLabel': {
    one: '{confirmed} de {total} reserva confirmada',
    many: '{confirmed} de {total} reservas confirmadas',
    other: '{confirmed} de {total} reservas confirmadas',
  },
  'book.ofTotal': 'de {total}',
  'book.confirmed': 'Confirmadas',
  'book.awaiting': 'A la espera de confirmación',
  'book.nothingHanging': 'Nada pendiente',
  'book.chase': 'Reclámalas antes de volar',
  'book.committed': 'Comprometido',
  'book.committedCaption': 'De todas las reservas de este viaje',
  'book.onItinerary': 'En el itinerario',
  'book.pinnedCaption': 'Fijado a un día del plan',
  'book.readOnly.archived':
    'Este viaje está archivado, así que las reservas y los alojamientos son de solo lectura. Restaura el viaje para cambiarlos.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Este cambio se ha rechazado. Revisa el estado actual del viaje antes de hacer más cambios.',
  'transports.recovery.failed':
    'No se ha podido actualizar el viaje. Inténtalo de nuevo antes de hacer cambios.',
  'transports.readOnly.archived':
    'Este viaje está archivado. Restáuralo para cambiar los transportes.',
  'transports.title': 'Trayectos',
  'transports.empty': 'Nada registrado aún',
  'transports.count.transports': {
    one: '{transports} trayecto',
    many: '{transports} trayectos',
    other: '{transports} trayectos',
  },
  'transports.distance': 'Distancia recorrida',
  'transports.equator': '≈ {times}× la vuelta al ecuador',
  'transports.noGrouping': 'Nada agrupado aún',
  'transports.mostly': 'sobre todo {mode}',
  'transports.confirmed': 'Confirmados',
  'transports.stillPending': {
    one: '{pending} sigue pendiente',
    many: '{pending} siguen pendientes',
    other: '{pending} siguen pendientes',
  },
  'transports.spent': 'Gastado en viajes',
  'transports.noPrices': 'Sin precios registrados',
  'transports.priced': {
    one: 'en {priced} trayecto con precio',
    many: 'en {priced} trayectos con precio',
    other: 'en {priced} trayectos con precio',
  },
  'people.title': 'Personas',
  'people.description': 'Quién está en este viaje y quién puede encontrarlo',
  'people.members.title': 'En este viaje',
  'people.members.empty':
    'Ya no queda nadie de este viaje en este espacio de trabajo',
  'people.role.label': 'Rol',
  'people.role.owner': 'Propietario',
  'people.role.editor': 'Puede editar',
  'people.role.viewer': 'Puede ver',
  'people.you': 'Tú',
  'people.owner.hint': 'Un viaje siempre conserva al menos un propietario',
  'people.remove.action': 'Quitar a {name} de este viaje',
  'people.remove.title': '¿Quitar a {name} de este viaje?',
  'people.remove.body':
    'Pierde el acceso al itinerario de inmediato. Lo que añadió se queda en el viaje.',
  'people.remove.confirm': 'Quitar',
  'people.leave.action': 'Salir de este viaje',
  'people.leave.title': '¿Salir de este viaje?',
  'people.leave.body':
    'Pierdes el acceso al itinerario hasta que alguien del viaje vuelva a añadirte.',
  'people.leave.confirm': 'Salir',
  'people.cancel': 'Cancelar',
  'people.invite.title': 'Añadir a alguien',
  'people.invite.placeholder': 'Busca personas de este espacio de trabajo',
  'people.invite.action': 'Añadir al viaje',
  'people.invite.role': 'Se une como',
  'people.invite.empty':
    'Todas las personas de este espacio ya están en este viaje',
  'people.invite.emptyHint':
    'Primero alguien nuevo entra en el espacio, en Ajustes',
  'people.visibility.title': 'Quién puede encontrar este viaje',
  'people.visibility.switch': 'Visible para todo el espacio de trabajo',
  'people.visibility.private':
    'Solo las personas que aparecen aquí pueden ver este viaje',
  'people.visibility.organization':
    'Cualquier persona de este espacio puede abrir este viaje',
  'people.visibility.public': 'Este viaje se comparte con un enlace público',
  'people.error.lastOwner':
    'Un viaje conserva al menos un propietario. Haz propietario a otra persona primero.',
  'people.error.notInWorkspace':
    'Esa persona no está en este espacio de trabajo',
  'people.error.alreadyOnTrip': 'Esa persona ya está en este viaje',
  'people.guests.title': 'Viajan contigo',
  'people.guests.description': 'Personas de este viaje que no tienen cuenta',
  'people.guests.empty': 'Nadie todavía',
  'people.guests.emptyHint':
    'Un invitado es alguien que viaja contigo y no necesita cuenta. Añádelo por su nombre.',
  'people.guest.badge': 'Invitado',
  'people.guest.add.label': 'Su nombre',
  'people.guest.add.placeholder': 'Lucía',
  'people.guest.add.action': 'Añadir un invitado',
  'people.guest.rename.action': 'Cambiar el nombre de {name}',
  'people.guest.rename.title': 'Cambiar el nombre de {name}',
  'people.guest.rename.confirm': 'Cambiar nombre',
  'people.guest.remove.action': 'Quitar a {name} de este viaje',
  'people.guest.remove.title': '¿Quitar a {name} de este viaje?',
  'people.guest.remove.body':
    'El invitado desaparece. Nada más cambia en el viaje.',
  'people.guest.remove.confirm': 'Quitar',
  'people.guest.merge.action': '{name} ahora es…',
  'people.guest.merge.title':
    '{name} ahora es una de las personas de este viaje',
  'people.guest.merge.body':
    'Todo lo asignado a {name} pasa a la persona que elijas y el invitado desaparece. No se puede deshacer.',
  'people.guest.merge.inherits': '{member} hereda todo lo asignado a {name}.',
  'people.guest.merge.placeholder': 'Elige a alguien de este viaje',
  'people.guest.merge.confirm': 'Fusionar',
  'people.guest.merge.done': '{name} ahora es {member}',
  'people.guest.merge.nothingMoved': 'Todavía no tenía nada asignado',
  'people.error.guestNameTaken':
    'Ya hay un invitado llamado {name} en este viaje',
  'people.error.guestLimit':
    'Un viaje admite como máximo {limit} invitados, porque una lista más larga hace difíciles de leer la selección de participantes y el reparto de gastos',
  'people.error.guestMergeTarget': 'Elige a alguien que ya esté en este viaje',
  'plan.weather.badge.forecast':
    'Previsión: {condition}, máxima {max}, mínima {min}',
  'plan.weather.badge.forecastNoCondition':
    'Previsión: máxima {max}, mínima {min}',
  'plan.weather.badge.unavailable':
    'El tiempo no está disponible para este día',
  'plan.weather.badge.loading': 'Cargando el tiempo',
  'plan.weather.badge.recorded': 'Registrado: máxima {max}, mínima {min}',
  'plan.weather.badge.recordedHigh': 'Registrado: máxima {max}',
  'plan.weather.badge.recordedLow': 'Registrado: mínima {min}',
  'plan.weather.badge.estimate':
    'Estimación: máxima habitual {max}, mínima habitual {min}',
  'plan.weather.badge.estimateHigh': 'Estimación: máxima habitual {max}',
  'plan.weather.badge.estimateLow': 'Estimación: mínima habitual {min}',
  'plan.weather.badge.notYetRecorded': 'Aún no registrado',
  'plan.weather.condition.clear': 'Despejado',
  'plan.weather.condition.fair': 'Buen tiempo',
  'plan.weather.condition.partlyCloudy': 'Parcialmente nublado',
  'plan.weather.condition.cloudy': 'Nublado',
  'plan.weather.condition.fog': 'Niebla',
  'plan.weather.condition.rain': 'Lluvia',
  'plan.weather.condition.heavyRain': 'Lluvia intensa',
  'plan.weather.condition.sleet': 'Aguanieve',
  'plan.weather.condition.snow': 'Nieve',
  'plan.weather.condition.thunder': 'Tormenta',
  'plan.weather.panel.title': 'El tiempo del {date}',
  'plan.weather.panel.temperature': 'Máxima / mínima',
  'plan.weather.panel.precipitation': 'Precipitación',
  'plan.weather.panel.precipitationTypical': 'Precipitación diaria habitual',
  'plan.weather.panel.probability': '{percent} de probabilidad',
  'plan.weather.panel.wind': 'Viento',
  'plan.weather.panel.sunrise': 'Salida del sol',
  'plan.weather.panel.sunset': 'Puesta del sol',
  'plan.weather.panel.noSunrise': 'Sin salida del sol',
  'plan.weather.panel.noSunset': 'Sin puesta del sol',
  'plan.weather.panel.slots': 'A lo largo del día',
  'plan.weather.panel.slot.night': 'Madrugada',
  'plan.weather.panel.slot.morning': 'Mañana',
  'plan.weather.panel.slot.afternoon': 'Tarde',
  'plan.weather.panel.slot.evening': 'Noche',
  'plan.weather.panel.high': 'Máxima',
  'plan.weather.panel.low': 'Mínima',
  'plan.weather.panel.recordedNote': 'Valores medidos de este día.',
  'plan.weather.panel.temperatureTypical': 'Máxima / mínima habituales',
  'plan.weather.panel.estimateNote':
    'Promedio a largo plazo de este mes, no una previsión.',
  'plan.weather.attribution.metNorway':
    'Datos de la previsión: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Datos: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Cambiar el ancho del itinerario',
  'plan.workspace.resizePlaces': 'Cambiar el ancho de los lugares',
  'plan.workspace.toggleDay': 'Expandir o contraer {day}',
  'plan.workspace.days': 'Días',
  'plan.workspace.showPanel': 'Mostrar el panel {label}',
  'plan.workspace.hidePanel': 'Ocultar el panel {label}',
  'plan.workspace.narrowPanel': 'Estrechar {label}',
  'plan.workspace.widenPanel': 'Ampliar {label}',
  'collab.sections.tabsLabel': 'Secciones de colaboración',
  'collab.sections.trigger': 'Elegir secciones',
  'collab.sections.menuLabel': 'Mostrar a todos los participantes del viaje',
  'collab.sections.keepOne': 'Al menos una sección debe seguir activa.',
  'collab.sections.failed': 'No se guardó el cambio',
  'collab.sections.failedBody':
    'El menú muestra el estado guardado actualmente.',
  'collab.sections.someHidden':
    'Algunas secciones están ocultas en este viaje.',
  'collab.sections.turnedOff':
    'Esta sección se desactivó para el viaje. Se cerrará cuando envíes o borres lo que estás escribiendo.',
  'collab.sections.changed': 'Las secciones de este viaje han cambiado.',
  'collab.sections.savedHidden':
    'Guardado. Esta sección está oculta para el viaje y se cerrará ahora.',
  'plan.place.error.save':
    'No se pudo guardar el lugar. Inténtalo de nuevo en un momento.',
  'plan.stop.error.saveTimes':
    'No se pudieron guardar los horarios de la parada. Inténtalo de nuevo en un momento.',
  'plan.place.error.delete':
    'No se pudo eliminar el lugar. Inténtalo de nuevo en un momento.',
  'plan.pin.error.move':
    'No se pudo mover el marcador. Inténtalo de nuevo en un momento.',
  'plan.place.toast.created': 'Lugar añadido',
  'plan.place.toast.updated': 'Lugar actualizado',
  'plan.stop.toast.timesSaved': 'Horarios de la parada guardados',
  'plan.place.toast.deleted': 'Lugar eliminado',
  'plan.pin.toast.moved': '{name} fijado',
  'join.page.title': 'Enlace de invitación al viaje',
  'join.page.description':
    'Abre este enlace para unirte a un viaje compartido en planned.travel.',
  'join.title.invited': '{inviter} te ha invitado a un viaje',
  'join.requirement':
    'Este enlace funciona para quienes ya están en el espacio de trabajo de {inviter}.',
  'join.newHere':
    '¿Primera vez por aquí? Pide a {inviter} que te añada primero a su espacio de trabajo.',
  'join.trip.label': 'Viaje',
  'join.role.label': 'Te unirías como',
  'join.dates.label': 'Fechas',
  'join.destination.label': 'Destino',
  'join.action.signIn': 'Entrar',
  'join.action.join': 'Unirse al viaje',
  'join.action.joining': 'Uniéndote al viaje',
  'join.action.open': 'Abrir el viaje',
  'join.action.openIn': 'Abrir el viaje y cambiar de espacio de trabajo',
  'join.action.openIn.pending': 'Cambiando de espacio de trabajo',
  'join.loading': 'Cargando la invitación',
  'join.joined.title': 'Ya estás en el viaje',
  'join.joined.body': 'Ábrelo para ver el plan.',
  'join.member.title': 'Ya formas parte de este viaje',
  'join.needsWorkspace.title':
    'Este viaje está en un espacio de trabajo al que no perteneces',
  'join.needsWorkspace.body':
    'Pide a {inviter} que te añada primero a su espacio de trabajo y vuelve a abrir este enlace.',
  'join.needsWorkspace.signedInAs':
    'Has iniciado sesión como {email}. Dile a {inviter} que use esta dirección.',
  'join.needsWorkspace.acceptFirst':
    'Si ya tienes un correo de invitación a un espacio de trabajo, acéptalo primero y vuelve a abrir este enlace.',
  'join.needsWorkspace.otherAccount': 'Entrar con otra cuenta',
  'join.unavailable.title': 'Este enlace de invitación no está disponible',
  'join.unavailable.body':
    'Puede que el enlace se haya sustituido o desactivado. Pide uno nuevo a quien te lo envió.',
  'join.unavailable.signIn': 'Entrar',
  'join.unavailable.trips': 'Ir a tus viajes',
  'join.error.title': 'No pudimos cargar este enlace de invitación',
  'join.error.retry': 'Reintentar',
  'join.error.busy':
    'Esta página está ocupada. Vuelve a intentarlo en un minuto.',
  'join.error.join':
    'No se pudo unir al viaje. El enlace sigue funcionando; inténtalo de nuevo.',
  'join.error.switch':
    'No se pudo cambiar de espacio de trabajo. Inténtalo de nuevo.',

  'invite.title': 'Enlace de invitación',
  'invite.description':
    'Cualquier persona de este espacio que abra el enlace se une al viaje.',
  'invite.empty.title': 'Aún no hay enlace',
  'invite.empty.body':
    'Crea un enlace y compártelo en el chat del grupo para que las personas de este espacio puedan unirse.',
  'invite.action.create': 'Crear enlace',
  'invite.link.label': 'Enlace de invitación',
  'invite.copy': 'Copiar enlace',
  'invite.copied': 'Enlace copiado',
  'invite.copyFailed':
    'No se pudo copiar. Selecciona el enlace y cópialo manualmente.',
  'invite.switch.label':
    'Cualquiera de este espacio con el enlace puede unirse',
  'invite.switch.onHint':
    'Desactivarlo invalida el enlace para todos, incluidas las copias ya enviadas.',
  'invite.switch.offHint':
    'Al reactivarlo se crea un enlace nuevo. Los anteriores siguen sin funcionar.',
  'invite.off.body': 'El enlace está desactivado. Nadie puede unirse con él.',
  'invite.uses': {
    one: 'Personas que se unieron con este enlace: {count}',
    many: 'Personas que se unieron con este enlace: {count}',
    other: 'Personas que se unieron con este enlace: {count}',
  },
  'invite.uses.never': 'Nadie se ha unido con este enlace todavía.',
  'invite.lastUsed': 'Última incorporación: {when}',
  'invite.role.upgrade.title': '¿Dar permiso de edición?',
  'invite.role.upgrade.body':
    'Se aplica a todas las copias ya enviadas y a quienes se unan a partir de ahora.',
  'invite.role.upgrade.confirm': 'Dar permiso de edición',
  'invite.replace.action': 'Reemplazar enlace',
  'invite.replace.title': '¿Reemplazar este enlace?',
  'invite.replace.body':
    'El enlace anterior dejará de funcionar de inmediato para todos. Quienes ya se unieron seguirán en el viaje; elimínalos de la lista inferior si es necesario.',
  'invite.replace.deadBody':
    'El enlace anterior ya no funciona. Quienes ya se unieron siguen en el viaje.',
  'invite.replace.confirm': 'Reemplazar enlace',
  'invite.replace.pending': 'Reemplazando el enlace',
  'invite.stale': 'Este enlace ya no funciona. Reemplázalo.',
  'invite.creatorGone':
    'El enlace dejó de funcionar porque su creador ya no es propietario. Reemplázalo.',
  'invite.archived':
    'Este viaje está archivado. El enlace volverá a funcionar al restaurarlo.',
  'invite.announce.created': 'Enlace de invitación creado',
  'invite.announce.roleEditor': 'Quienes se unan podrán editar',
  'invite.announce.off': 'Enlace de invitación desactivado',
  'invite.announce.newLink':
    'El nuevo enlace está listo. Cópialo y envíalo de nuevo.',
  'invite.announce.roleViewer': 'Quienes se unan podrán ver el viaje',
  'invite.error.title': 'No se pudo cargar el enlace',
  'invite.error.retry': 'Reintentar',
  'invite.refusal.archived': 'Este viaje está archivado.',
  'invite.refusal.notOwner':
    'Solo un propietario del viaje puede cambiar el enlace.',
  'invite.refusal.changed': 'Alguien cambió el enlace. Se muestra el actual.',
  'invite.announce.recovered':
    'Se muestran los ajustes actuales del enlace. Revísalos antes de hacer otro cambio.',
} satisfies TranslationOf<typeof En>

export default messages
