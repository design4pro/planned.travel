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
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'No se pudo cargar este viaje',
  'error.plan': 'No se pudo cargar el itinerario',
  'error.costs': 'No se pudieron cargar los gastos',
  'error.collab': 'No se pudo cargar la conversación',
  'error.book': 'No se pudieron cargar las reservas',
  'error.transports': 'Los trayectos no se cargaron',
  'error.people': 'No se pudieron cargar las personas',
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
    'Las ideas son lugares que esperan un día. Una nota pertenece al día para el que se escribió.',
  'plan.move.refused.notInAnotherDay': 'Una nota se queda en su día',
  'plan.move.refused.notInAnotherDayBody':
    'Todavía no se pueden mover notas entre días. Edita la nota o escríbela en el otro día.',
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
  'plan.move.spoken.notInAnotherDay':
    '{name} no se ha movido. Una nota se queda en su día.',
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
  'plan.addPlace.forDay': 'Añadir un lugar a este día',
  'plan.addPlace.forDayNamed': 'Añadir un lugar, {day}',
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
  /* ---------------------------------------------- the transports tab */
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
} satisfies TranslationOf<typeof En>

export default messages
