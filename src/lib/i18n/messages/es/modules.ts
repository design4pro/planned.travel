/**
 * The trip modules' own copy, in es.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `many` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Sin definir',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Conectando',
  'presence.connecting.body': 'Entrando en la sala en directo de este viaje.',
  'presence.live.title': 'En directo',
  'presence.live.body':
    'Los mensajes, las notas y los votos llegan aquí en el momento.',
  'presence.reconnecting.title': 'Reconectando',
  'presence.reconnecting.body':
    'Se cayó la conexión. Reintentando: todo lo que envíes se guarda igual.',
  'presence.offline.title': 'Sin directo',
  'presence.offline.body':
    'Las actualizaciones en directo están apagadas. Todo se sigue guardando; recarga o reinténtalo para ponerte al día.',
  'presence.reconnect': 'Reconectar',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Todos los trayectos',
  'transports.empty.title': 'Todavía no hay trayectos',
  'transports.empty.body':
    'Vuelos, trenes, ferris y el trayecto desde el aeropuerto viven aquí, con sus códigos de reserva y números de asiento a mano el día señalado, y cada enlace comprobado contra el anterior.',
  'transports.empty.action': 'Añadir el primer trayecto',
  'transports.filtered.title': 'No hay trayectos de ese tipo',
  'transports.filtered.body':
    'Cada trayecto de este viaje va de otra manera. Vuelve a «{label}» para verlos todos.',
  'transports.filtered.action': 'Mostrar todos los trayectos',
  'transports.alert.impossible.title': {
    one: 'Un enlace es imposible',
    many: '{value} enlaces son imposibles',
    other: '{value} enlaces son imposibles',
  },
  'transports.alert.impossible.body':
    'Un trayecto sale antes de que llegue el anterior. Los enlaces de abajo dicen cuáles y por cuánto.',
  'transports.alert.tight.title': {
    one: 'Un enlace va justo',
    many: '{value} enlaces van justos',
    other: '{value} enlaces van justos',
  },
  'transports.alert.tight.body':
    'Hay tiempo, pero poco para el medio que vas a coger. Los enlaces de abajo muestran cuánto deja cada uno.',
  'transports.badge.impossible': {
    one: '{value} enlace roto',
    many: '{value} enlaces rotos',
    other: '{value} enlaces rotos',
  },
  'transports.badge.tight': {
    one: '{value} enlace justo',
    many: '{value} enlaces justos',
    other: '{value} enlaces justos',
  },
  'transports.badge.ok': 'Todos los enlaces funcionan',
  'transports.remove.body':
    'El trayecto sale de este viaje para siempre, junto con su referencia de reserva y su asiento. Si solo está cancelado, ponle el estado Cancelado en su lugar.',
  'transports.remove.confirm': 'Eliminar el trayecto',
  'transports.menu.edit': 'Editar el trayecto…',
  'transports.field.service': 'Servicio',
  'transports.field.bookingRef': 'Referencia de reserva',
  'transports.field.seat': 'Asiento',
  'transports.field.distance': 'Distancia',
  'transports.noTime': 'Todavía sin hora',
  'transports.toast.statusFailed.title': 'El estado no cambió',
  'transports.toast.statusFailed.body':
    'El trayecto sigue en su estado anterior.',
  'transports.toast.removed': 'Trayecto eliminado',
  'transports.toast.removeFailed': 'El trayecto no se eliminó',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Añadir un trayecto',
  'transports.dialog.editTitle': 'Editar este trayecto',
  'transports.dialog.description':
    'Vuelos, trenes, ferris y el trayecto desde el aeropuerto. Las horas son las locales impresas en el billete.',
  'transports.form.modeLegend': 'Cómo viajas',
  'transports.form.timingError': 'Revisa las horas',
  'transports.field.namePlaceholder': 'Iberia de MAD a HND',
  'transports.field.place': 'Lugar',
  'transports.field.code': 'Código',
  'transports.field.date': 'Fecha',
  'transports.field.time': 'Salida a partir de',
  'transports.field.departurePlaceholder': 'Madrid Barajas',
  'transports.field.arrivalPlaceholder': 'Tokio Haneda',
  'transports.field.carrier': 'Compañía',
  'transports.field.serviceNumber': 'Número de servicio',
  'transports.field.bookingRefHint': 'El código que dirás en el mostrador.',
  'transports.field.notesPlaceholder':
    'Pedido asiento de pasillo. Maletas facturadas hasta Kioto.',
  'transports.action.add': 'Añadir el trayecto',
  'transports.action.save': 'Guardar el trayecto',
  'transports.action.saving': 'Guardando el trayecto',
  'transports.toast.added': 'Trayecto añadido',
  'transports.toast.addedBody': 'Ya está en el orden del viaje.',
  'transports.toast.addFailed': 'El trayecto no se añadió',
  'transports.toast.updated': 'Trayecto actualizado',
  'transports.toast.updateFailed': 'El trayecto no se actualizó',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Nombre',
  'field.time': 'Hora',
  'field.price': 'Precio',
  'field.notes': 'Notas',
  'field.status': 'Estado',
  'form.saveError': 'Eso no se guardó',
  'action.cancel': 'Cancelar',
  'action.showCode': 'Muestra {label}',
  'book.status.none': 'Sin estado',
  'book.status.pending': 'Pendiente',
  'book.status.confirmed': 'Confirmada',
  'book.status.completed': 'Hecha',
  'book.status.cancelled': 'Cancelada',
  'book.toast.statusFailed': 'El estado no cambió',
  'book.toast.statusFailedBody': 'La reserva sigue en su estado anterior.',
  'book.toast.removed': 'Reserva eliminada',
  'book.toast.removeFailed': 'La reserva no se eliminó',
  'book.empty.title': 'Todavía no hay nada reservado',
  'book.empty.body':
    'Alojamientos, mesas, visitas y entradas van aquí — con el número de confirmación donde lo encontrarás en la puerta, y la fecha que las coloca en la línea de tiempo.',
  'book.empty.action': 'Añadir la primera reserva',
  'book.filtered.title': 'Todavía no hay nada de ese tipo',
  'book.filtered.body':
    'No hay nada reservado de los tipos que has elegido. Quita el filtro para ver el resto del mostrador.',
  'book.filtered.action': 'Quitar el filtro',
  'book.panel.outstanding': 'Aún por resolver',
  'book.panel.outstandingEmpty':
    'No queda nada pendiente — todo lo de aquí está resuelto.',
  'book.panel.settled': 'Resuelto',
  'book.panel.settledEmpty':
    'Todavía no hay nada resuelto — está todo por perseguir.',
  'book.import.badge': 'Importación sin revisar',
  'book.import.hint':
    'Importado de una confirmación. Ábrelo y guárdalo para marcarlo como revisado.',
  'book.import.action': 'Importar',
  'book.import.title': 'Importar reservas desde un archivo',
  'book.import.description':
    'Suelta una confirmación y la leeremos. No se añade nada al viaje hasta que la hayas visto.',
  'book.import.drop.idle': 'Suelta los archivos aquí, o búscalos',
  'book.import.drop.active': 'Suelta para añadir',
  'book.import.drop.formats':
    'PDF, correo guardado, página web, foto, Word, Excel, archivo de calendario o exportación JSON.',
  'book.import.drop.limits':
    'Hasta {files} archivos a la vez, cada uno hasta {size}.',
  'book.import.drop.browse': 'Buscar archivos',
  'book.import.refused.format':
    '«{filename}» no es un archivo que esta importación pueda leer. Lee un PDF, un correo guardado, una página web, una foto, un documento de Word o Excel, un archivo de calendario o una exportación JSON.',
  'book.import.refused.tooMany':
    'Solo {files} archivos a la vez. El resto no se añadió.',
  'book.import.refused.tooLarge':
    '«{filename}» pesa {size}. Una importación lee archivos de hasta {limit}.',
  'book.import.refused.empty':
    '«{filename}» está vacío, así que no hay nada que leer.',
  'book.import.ceiling.title':
    'Este espacio ya ha leído todas sus confirmaciones este mes',
  'book.import.ceiling.body':
    'El plan incluye {ceiling} lecturas de archivo al mes y el cupo se renueva el día uno. Siempre puedes añadir una reserva a mano.',
  'book.import.ceiling.none':
    'Leer un archivo de confirmación no entra en el plan de este espacio',
  'book.import.ceiling.noneBody':
    'Mejora el plan para que te lean una confirmación. Añadir una reserva a mano está siempre disponible.',
  'book.import.widget.title': 'Leyendo confirmaciones',
  'book.import.widget.working': '{done} de {total} leídos',
  'book.import.widget.file': 'Leyendo «{filename}»',
  'book.import.widget.done': {
    one: 'Una reserva lista para revisar',
    many: '{count} reservas listas para revisar',
    other: '{count} reservas listas para revisar',
  },
  'book.import.widget.review': 'Revisar',
  'book.import.widget.failed': 'No se pudo leer «{filename}»',
  'book.import.widget.stalled': 'Esto tarda más de lo previsto',
  'book.import.widget.check': 'Volver a mirar',
  'book.import.widget.dismiss': 'Descartar',
  'book.import.review.title': 'Lo que hemos leído',
  'book.import.review.from': 'De «{filename}»',
  'book.import.review.selectAll': 'Seleccionar todo',
  'book.import.review.selectNone': 'No seleccionar nada',
  'book.import.review.confirm': {
    one: 'Añadir {count} reserva',
    many: 'Añadir {count} reservas',
    other: 'Añadir {count} reservas',
  },
  'book.import.review.confirmNone': 'Selecciona una reserva para añadirla',
  'book.import.review.cancel': 'Cancelar',
  'book.import.review.needsReview': 'Conviene mirarlo',
  'book.import.review.needsReviewHint':
    'Algunos campos no estaban en el documento. Abre la reserva después de añadirla.',
  'book.import.review.noPrice': 'Sin precio leído',
  'book.import.review.noPriceHint':
    'El documento no indicaba ninguno con claridad, así que se dejó vacío en lugar de adivinarlo.',
  'book.import.review.untitled': 'Reserva sin título',
  'book.import.empty.title':
    'No hemos encontrado ninguna reserva en ese archivo',
  'book.import.empty.body':
    '«{filename}» no tenía nada que se parezca a una confirmación. Prueba otro archivo, o añade la reserva a mano.',
  'book.import.failed.title': 'No se pudo leer «{filename}»',
  'book.import.failed.body':
    'El archivo se abrió pero no se pudo sacar nada de él. Prueba otro archivo, o añade la reserva a mano.',
  'book.import.failed.retry': 'Probar otro archivo',
  'book.import.uploadFailed': '«{filename}» no se subió',
  'book.import.uploadRetry': 'Volver a intentarlo',
  'book.import.actionFailed': 'Vuelve a intentarlo en un momento.',
  'book.import.toast.added': {
    one: 'Una reserva añadida',
    many: '{count} reservas añadidas',
    other: '{count} reservas añadidas',
  },
  'book.import.partial.title': 'Se añadieron {written} de {total} reservas',
  'book.import.partial.body':
    'El resto sigue seleccionado. Volver a añadir escribe solo esas.',
  'book.import.partial.retry': 'Añadir el resto',
  'book.journeyLink': 'En la pestaña de transportes',
  'filter.all': 'Todo',
  'book.remove.body':
    'Sale de la línea de tiempo para siempre. Si solo está cancelada, ponle el estado Cancelada para conservar el registro.',
  'book.remove.confirm': 'Eliminar la reserva',
  'book.menu.edit': 'Editar la reserva…',
  'book.menu.open': 'Abrir la reserva',
  'book.noDate': 'Todavía sin fecha',
  'book.until': 'Hasta',
  'book.provider': 'Proveedor',
  'book.where': 'Dónde',
  'book.guests': 'Personas',
  'book.confirmation': 'Confirmación',
  'book.undated': 'Ponles fecha y entran en la línea de tiempo',
  statusOf: 'Estado de {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Todavía sin estado',
  'book.statusChoice.pending': 'Pendiente — a la espera de ellos',
  'book.dialog.addTitle': 'Añadir una reserva',
  'book.dialog.editTitle': 'Editar esta reserva',
  'book.dialog.typeLegend': 'Qué clase de reserva',
  'book.field.namePlaceholder': 'Calle Mayor 15',
  'book.field.priceHint': 'Déjalo vacío si aún no está pagado.',
  'book.field.confirmation': 'Número de confirmación',
  'book.field.confirmationHint': 'El código que te pedirán en el mostrador.',
  'book.field.day': 'Asignar a un día',
  'book.field.dayHint': 'La fija al itinerario para que salga en el plan.',
  'book.field.noDay': 'Fuera del itinerario',
  'book.field.link': 'Enlace',
  'book.field.notesPlaceholder':
    'Llegada tardía acordada. Pedir habitación lejos del ascensor.',
  'book.action.add': 'Añadir la reserva',
  'book.action.save': 'Guardar la reserva',
  'book.action.saving': 'Guardando la reserva',
  'book.toast.added': 'Reserva añadida',
  'book.toast.addedBody': 'Ya está en la línea de tiempo.',
  'book.toast.addFailed': 'La reserva no se añadió',
  'book.toast.updated': 'Reserva actualizada',
  'book.toast.updateFailed': 'La reserva no se actualizó',

  'book.emptyFacts':
    'Aparte del nombre todavía no hay nada. Ábrelo para añadir la hora, el precio y el número de confirmación.',
  'book.onItinerary': 'En el itinerario: {day}',
  'book.dayNumber': 'Día {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Otro',
  'book.field.host': 'Hotel o anfitrión',
  'book.field.restaurant': 'Nombre del restaurante',
  'book.field.operator': 'Operador',
  'book.field.issuer': 'Emitido por',
  'book.field.carrier': 'Compañía',
  'book.field.address': 'Dirección',
  'book.field.meetingPoint': 'Punto de encuentro',
  'book.field.venue': 'Recinto',
  'book.field.fromTo': 'Desde y hasta',
  'book.field.checkIn': 'Entrada',
  'book.field.date': 'Fecha',
  'book.field.validOn': 'Válido el',
  'book.field.departs': 'Sale',
  'book.field.checkOut': 'Salida',
  'book.field.ends': 'Termina',
  'book.field.arrives': 'Llega',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Museo Ghibli',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Quién te lo está guardando',
  'book.example.accommodationTitle':
    'Hotel Gracery Shinjuku · 2 habitaciones twin',
  'book.example.restaurantTitle': 'Cena en Den',
  'book.example.activityTitle': 'teamLab Planets, 4 entradas',
  'book.example.tourTitle': 'Paseo por el bosque de bambú de Arashiyama',
  'book.example.ticketTitle': 'Museo Ghibli, entrada a las 10:00',
  'book.example.transportTitle': 'Nozomi 21 a Kioto',
  'book.example.otherTitle': 'Qué has reservado',
  'book.hint.accommodation':
    'Un hotel, un ryokan, un apartamento — donde sea que duermas.',
  'book.hint.restaurant':
    'Una mesa reservada. La hora es lo que te van a exigir.',
  'book.hint.activity': 'Una clase, unos baños, una experiencia reservada.',
  'book.hint.tour': 'Un sitio, una hora y un guía esperando.',
  'book.hint.ticket':
    'Una entrada con hora, un pase de museo, un partido. Ten el código a mano.',
  'book.hint.transport':
    'Un asiento reservado. Los trayectos completos con códigos van en {module}.',
  'book.hint.other': 'Cualquier cosa a tu nombre que no encaje en las demás.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Equipaje',
  'lists.kind.todo': 'Pendientes',
  'lists.kind.shopping': 'Compras',
  'lists.kind.documents': 'Documentos',
  'lists.kind.fallback': 'Lista',
  'colour.none': 'Sin color',
  'colour.pine': 'Pino',
  'colour.inkBlue': 'Azul tinta',
  'colour.amber': 'Ámbar',
  'colour.green': 'Verde',
  'colour.red': 'Rojo',
  'colour.slate': 'Pizarra',
  'lists.toast.created': 'Lista creada',
  'lists.toast.createdBody': 'Añade lo primero que no puedes olvidar.',
  'lists.toast.createFailed': 'La lista no se creó',
  'lists.toast.updated': 'Lista actualizada',
  'lists.toast.updateFailed': 'La lista no se actualizó',
  'lists.error.weightLimit': 'Un límite de peso es un número entero de gramos.',
  'lists.dialog.editTitle': 'Editar esta lista',
  'lists.dialog.editBody':
    'Cámbiale el nombre, el tipo, o pásala a un solo viajero.',
  'lists.dialog.addBody':
    'Equipaje, tareas, compras y los documentos que no puedes olvidar: cada cosa con su propia lista.',
  'lists.action.new': 'Nueva lista',
  'lists.field.namePlaceholder': 'Equipaje de mano',
  'lists.field.kind': 'Tipo',
  'lists.field.kindAria': 'Tipo de lista',
  'lists.field.owner': 'Pertenece a',
  'lists.field.ownerHint': 'Las listas compartidas las marca cualquiera.',
  'lists.field.everyone': 'Todos los del viaje',
  'lists.field.weightLimit': 'Límite de peso',
  'lists.field.weightLimitHint':
    'Gramos. Déjalo vacío si no hay ningún límite que respetar.',
  'colour.legend': 'Color',
  'lists.action.saving': 'Guardando la lista',
  'lists.action.save': 'Guardar la lista',
  'lists.action.create': 'Crear la lista',
  'lists.item.toast.added': 'Elemento añadido',
  'lists.item.toast.addFailed': 'El elemento no se añadió',
  'lists.item.toast.updated': 'Elemento actualizado',
  'lists.item.toast.updateFailed': 'El elemento no se actualizó',
  'lists.item.error.quantity': 'Una cantidad es un número entero del 1 al 999.',
  'lists.item.error.weight': 'Un peso es un número entero de gramos.',
  'lists.item.dialog.editTitle': 'Editar este elemento',
  'lists.item.dialog.addTitle': 'Añadir un elemento',
  'lists.item.field.label': 'Elemento',
  'lists.item.field.placeholder': 'Pasaporte',
  'field.category': 'Categoría',
  'lists.item.field.categoryHint':
    'Agrupa la lista bajo un encabezado. Opcional.',
  'lists.item.field.categoryPlaceholder': 'Documentos',
  'lists.item.field.priority': 'Prioridad',
  'lists.priorityChoice.high': 'Alta: no lo olvides',
  'lists.priorityChoice.low': 'Baja: si queda sitio',
  'lists.priorityChoice.normal': 'Media',
  'lists.item.field.quantity': 'Cantidad',
  'lists.item.field.weight': 'Peso',
  'lists.item.field.weightHint': 'Gramos, por unidad.',
  'lists.item.field.owner': 'De quién es esta tarea',
  'lists.item.owner.nobody': 'Nadie en concreto',
  'lists.item.action.saving': 'Guardando el elemento',
  'lists.item.action.save': 'Guardar el elemento',
  'lists.item.action.add': 'Añadir a la lista',
  'lists.template.loadError':
    'Ahora mismo no se han podido cargar las plantillas.',
  'lists.template.toast.added': 'Lista añadida desde una plantilla',
  'lists.template.toast.addFailed': 'La plantilla no se aplicó',
  'lists.template.error.apply': 'Eso no se pudo aplicar',
  'lists.template.error.load': 'Las plantillas no se cargaron',
  'lists.template.empty.title': 'Todavía no hay plantillas',
  'lists.template.empty.body':
    'Guarda una lista como plantilla en cuanto tengas una que volverías a montar igual, y aparecerá aquí en cada viaje futuro.',
  'lists.template.applying': 'Aplicando la plantilla',
  'lists.template.dialogTitle': 'Empezar desde una plantilla',
  'lists.template.loading': 'Cargando plantillas',
  'lists.template.apply': 'Aplicar la plantilla',
  'lists.template.from': 'Desde una plantilla',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Sin asignar',
  'lists.toast.listRemoved': 'Lista eliminada',
  'lists.toast.listRemoveFailed': 'La lista no se eliminó',
  'lists.toast.itemRemoved': 'Elemento eliminado',
  'lists.toast.itemRemoveFailed': 'El elemento no se eliminó',
  'lists.toast.reset': 'Lista reiniciada',
  'lists.toast.resetBody':
    'Todo está desmarcado y listo para el próximo viaje.',
  'lists.toast.resetFailed': 'La lista no se reinició',
  'lists.toast.tickFailed': 'La marca no se guardó',
  'lists.toast.tickFailedBody': 'El elemento ha vuelto a como estaba.',
  'lists.toast.assignFailed': 'La asignación no se guardó',
  'lists.toast.orderFailed': 'El nuevo orden no se guardó',
  'lists.toast.orderFailedBody': 'La lista ha vuelto a como estaba.',
  'lists.filter.todo': 'Aún por hacer',
  'lists.filter.done': 'Hecho',
  'lists.scope.all': 'Todas las listas',
  'lists.scope.shared': 'Compartidas',
  'lists.scope.mine': 'Mías',
  'lists.empty.mine.title': 'Todavía no tienes listas propias',
  'lists.empty.shared.title': 'Todavía no hay listas compartidas',
  'lists.empty.mine.body':
    'Una lista propia solo la marcas tú: útil para las cosas que nadie más necesita ver.',
  'lists.empty.shared.body':
    'Una lista compartida la marca cualquiera, así dos personas no meten el mismo adaptador.',
  'lists.remove.list': 'Eliminar la lista',
  'lists.remove.item': 'Eliminar el elemento',
  'lists.remove.itemBody': 'Sale de esta lista. Nada más cambia.',
  'lists.menu.editList': 'Editar la lista…',
  'lists.menu.tickAll': 'Marcar todo',
  'lists.menu.untickAll': 'Desmarcar todo',
  'lists.menu.reset': 'Reiniciar para el próximo viaje',
  'lists.menu.dragOrderLong': 'Cambiar a un orden que puedas arrastrar',
  'lists.menu.groupAgain': 'Volver a agrupar por categoría',
  'lists.menu.dragOrder': 'Cambiar a un orden arrastrable',
  'lists.menu.groupByCategory': 'Agrupar por categoría',
  'lists.weight.packed': '{weight} en la maleta',
  'lists.weight.packedOver': '{weight} en la maleta: por encima del límite',
  'lists.weight.packedOf': '{weight} en la maleta de {limit} permitidos',
  'lists.weight.packedOfOver':
    '{weight} en la maleta de {limit} permitidos: por encima del límite',
  'lists.progress.ticked': '{done} de {total} marcados',
  'lists.items.empty.title': 'Esta lista está vacía',
  'lists.items.empty.body':
    'Añade lo primero que no puedes olvidar: el campo de abajo es la vía más rápida.',
  'lists.items.doneEmpty.title': 'Todavía nada marcado',
  'lists.items.doneEmpty.body': 'Marca algo y aparecerá aquí.',
  'lists.items.todoEmpty.title': 'Aquí ya está todo hecho',
  'lists.items.todoEmpty.body':
    'Todos los elementos de esta lista están marcados. Cambia a «{label}» para verlos.',
  'lists.category.other': 'Todo lo demás',
  'lists.dnd.fallbackName': 'este elemento',
  'lists.dnd.picked': '{name} levantado.',
  'lists.dnd.dropped': '{name} soltado. Se está guardando el nuevo orden.',
  'lists.dnd.cancelled': 'Cancelado. El orden no ha cambiado.',
  'lists.menu.editItem': 'Editar el elemento…',
  'lists.quickAdd.placeholder': 'Escribe un elemento y pulsa Enter',
  'lists.quickAdd.aria': 'Añadir un elemento a esta lista',
  'lists.quickAdd.detailsHint':
    'Añadir con un peso, una categoría o una persona',
  'lists.quickAdd.detailsAria': 'Añadir un elemento con todos sus detalles',
  'lists.show': 'Mostrar',
  'lists.priority.high': 'Alta',
  'lists.action.add': 'Añadir',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} elemento',
    many: '{count} elementos',
    other: '{count} elementos',
  },
  'lists.template.copiedIn': {
    one: '{count} elemento copiado, listo para marcar.',
    many: '{count} elementos copiados, listos para marcar.',
    other: '{count} elementos copiados, listos para marcar.',
  },
  'lists.remove.listBody': {
    one: 'La lista y su {count} elemento salen de este viaje. Las plantillas guardadas no se tocan.',
    many: 'La lista y sus {count} elementos salen de este viaje. Las plantillas guardadas no se tocan.',
    other:
      'La lista y sus {count} elementos salen de este viaje. Las plantillas guardadas no se tocan.',
  },

  'lists.item.dialog.body':
    'Todo excepto el nombre es opcional: un peso hace real el total de la maleta, y una categoría agrupa la lista.',
  'lists.template.dialogBody':
    'Una plantilla es una lista que ya has guardado. Aplicarla la copia como una lista nueva en este viaje: el original se queda igual.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': '¿Eliminar «{name}»?',
  actionsFor: 'Acciones para {name}',
  'lists.dnd.reorder': 'Reordenar {name}',
  'lists.action.untickItem': 'Desmarcar {name}',
  'lists.action.tickOffItem': 'Marcar {name}',
  'lists.item.assignAria': 'Asignar {name} a alguien',
  'lists.item.reassignAria': '{item} es de {owner}: reasignar',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Dale a esta reserva un nombre que reconozcas en una lista.',
  'error.titleLong': 'Deja el nombre por debajo de 160 caracteres.',
  'book.error.required': 'A esta reserva le falta: {field}.',
  'book.error.timeNeedsDate': 'Una hora necesita el día en que cae.',
  'book.error.endTimeNeedsDate': 'Una hora de fin necesita el día en que cae.',
  'book.error.endsBeforeStart': 'Esto acaba antes de empezar.',
  'book.fieldName.checkInDay': 'día de entrada',
  'book.fieldName.checkOutDay': 'día de salida',
  'book.stay.pickDay': 'Elige un día',
  'book.stay.nights': {
    one: '{count} noche',
    many: '{count} noches',
    other: '{count} noches',
  },
  'book.stay.range': 'del {from} al {to}',
  'book.stay.label': 'Estancia',
  'book.remove.keepsNights':
    'Las noches se quedan en el viaje. Solo se elimina la reserva.',
  'book.menu.removeWithStay': 'Eliminar la reserva y la estancia',
  'book.removeStay.body': 'Se eliminan la reserva y las noches que paga.',
  'book.toast.stayRemoved': 'Reserva y estancia eliminadas',
  'book.error.endTimeBeforeStart': 'La hora de fin es anterior a la de inicio.',
  'book.error.guests':
    'El número de personas tiene que ser un entero hasta 1000.',
  'error.price': 'Ese importe no lo sabemos leer.',
  'book.error.url': 'Un enlace tiene que empezar por http:// o https://.',
  'book.error.confirmationLong':
    'Ese número de confirmación es demasiado largo para guardarlo.',
  'book.error.stopGone': 'Esa parada ya no está en este viaje.',
  'book.ledger.unlinked':
    'La línea de coste de esta reserva seguirá en los costes del viaje, pero ya no estará vinculada a ella.',
  'book.ledger.updated': 'La línea de coste de esta reserva pasará a {money}.',
  'book.ledger.needsDate':
    'Dale una fecha a esta reserva y su coste se añadirá a los costes del viaje.',
  'book.ledger.added':
    'Se añadirá una línea de {money} a los costes de este viaje.',
  'book.fieldName.provider': 'operador',
  'book.fieldName.location': 'lugar',
  'book.fieldName.confirmationNumber': 'número de confirmación',
  'book.fieldName.link': 'enlace',
  'book.fieldName.date': 'fecha',
  'book.fieldName.time': 'hora',
  'book.fieldName.endDate': 'fecha de fin',
  'book.fieldName.endTime': 'hora de fin',
  'book.fieldName.guests': 'número de personas',
  'book.fieldName.price': 'precio',
  'book.fieldName.stop': 'parada',
  'book.field.stop': 'Parada vinculada',
  'book.field.stopHint': 'A qué parada del plan corresponde esta reserva.',
  'book.field.stopHintEmpty':
    'Añade primero un lugar a un día y luego podrás vincular esta reserva a él',
  'book.field.stopPlaceholder': 'Sin parada',
  'book.field.stopSearch': 'Busca paradas y días',
  'book.field.stopEmpty': 'Ninguna parada coincide',
  'book.ledger.refused.title': 'Guardado, pero no añadido a los gastos',
  'book.ledger.refused.body':
    'La reserva está en el viaje. Añadir su línea de gasto a los gastos del viaje no funcionó — vuelve a intentar esa mitad.',
  'book.action.ledgerRetry': 'Añádelo a los gastos',
  'book.ledger.splitStale.title': 'Guardado, pero el reparto ya no cuadra',
  'book.ledger.splitStale.body':
    'La reserva y su nuevo precio se han guardado, pero el reparto de este gasto no ha podido seguir el nuevo total. Abre el gasto en Gastos y corrige el reparto.',
  'book.action.done': 'Hecho',
  'book.copyConfirmation': 'el número de confirmación de {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Vuelo',
  'transports.mode.train': 'Tren',
  'transports.mode.bus': 'Autobús',
  'transports.mode.ferry': 'Ferri',
  'transports.mode.car': 'Coche',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Transporte',
  'transports.mode.metro': 'Metro',
  'transports.mode.tram': 'Tranvía',
  'transports.mode.bike': 'Bici',
  'transports.mode.walk': 'A pie',
  'transports.mode.other': 'Otro',
  'transports.mode.fallback': 'Trayecto',
  'transports.rank.earliest': 'Llegada más temprana',
  'transports.rank.fewestChanges': 'Menos transbordos',
  'transports.connection.findStop': 'Busca una parada',
  'transports.connection.findStopSearch': 'MAD, Atocha, Madrid…',
  'transports.connection.findStopEmpty':
    'Ninguna parada con ese nombre en el catálogo.',
  'transports.connection.hideStops': 'Oculta las paradas',
  'transports.connection.seeStops': 'Ver las paradas',
  'transports.connection.saving': 'Guardando la conexión',
  'transports.connection.use': 'Elige esta',
  'transports.connection.onFoot': 'A pie',
  'transports.connection.service': 'Servicio',
  'transports.connection.direct': 'directo',
  'transports.connection.changes': {
    one: '{changes} transbordo',
    many: '{changes} transbordos',
    other: '{changes} transbordos',
  },
  'transports.connection.tooLong':
    'Esta conexión tiene más de {max} tramos, más de lo que cabe en un registro de viaje. Busca un salto más corto y anota el resto aparte.',
  'transports.connection.refusal.ceiling': 'No quedan búsquedas este mes',
  'transports.connection.refusal.unconfigured':
    'La búsqueda de conexiones está apagada en este despliegue',
  'transports.connection.refusal.provider':
    'El servicio de horarios no respondió',
  'transports.connection.refusal.plan':
    'La búsqueda de conexiones no entra en este plan',
  'transports.connection.refusal.planBody':
    'Cambia de plan para consultar horarios desde dentro de un viaje. Un trayecto siempre se puede anotar a mano.',
  'transports.connection.refusal.ceilingBody':
    'El cupo mensual de {ceiling} está agotado y se renueva el primero del mes que viene. Un trayecto siempre se puede anotar a mano.',
  'transports.connection.refusal.unconfiguredBody':
    'Aquí no hay ningún servicio de horarios configurado, así que no se buscó nada. Anota el trayecto a mano.',
  'transports.connection.refusal.providerBody':
    'No volvió nada que mostrar. Inténtalo en un momento o anota el trayecto a mano.',
  'transports.connection.invitation':
    'Dos paradas y una fecha, y los horarios responden. No se guarda nada hasta que elijas una.',
  'transports.connection.empty':
    'No se encontró ninguna conexión entre esas dos paradas en esa fecha. Prueba una estación vecina o amplía el filtro de modos.',
  'transports.connection.credit': 'Datos de horarios de',
  'transports.connection.searchFailed': 'La búsqueda no se hizo',
  'transports.connection.searchFailedBody':
    'Vuelve a intentarlo en un momento.',
  'transports.connection.saved': 'Conexión guardada',
  'transports.connection.replaced': 'Ruta sustituida',
  'transports.connection.replacedBody':
    'El código de reserva y el asiento quedan intactos.',
  'transports.connection.saveFailed': 'La conexión no se guardó',
  'transports.connection.saveError': 'Eso no se guardó',
  'transports.connection.fromHint':
    'Elige una parada — a un horario se le pregunta dónde, no cómo se llama.',
  'transports.connection.toHint': 'Elige una parada del catálogo.',
  'transports.connection.timeHint':
    'Un horario responde con las próximas salidas, así que esto decide cuáles.',
  'transports.connection.onlyModes': 'Solo estos modos',
  'transports.connection.searching': 'Buscando en los horarios',
  'transports.connection.search': 'Busca conexiones',
  'transports.connection.title': 'De {from} a {to}',
  'transports.status.idea': 'Idea',
  'transports.status.pending': 'Pendiente',
  'transports.status.confirmed': 'Confirmado',
  'transports.status.completed': 'Hecho',
  'transports.status.cancelled': 'Anulado',
  'transports.end.fromAirport': 'Aeropuerto de salida',
  'transports.end.toAirport': 'Aeropuerto de llegada',
  'transports.end.fromPort': 'Puerto de salida',
  'transports.end.toPort': 'Puerto de llegada',
  'transports.end.fromStation': 'Estación de salida',
  'transports.end.toStation': 'Estación de llegada',
  'transports.end.from': 'Desde',
  'transports.end.to': 'Hasta',
  'transports.end.pickUp': 'Recogida',
  'transports.end.dropOff': 'Devolución',
  'transports.end.departureDay': 'Día de salida',
  'transports.end.arrivalDay': 'Día de llegada',
  'transports.end.pickUpDay': 'Día de recogida',
  'transports.end.returnDay': 'Día de devolución',
  'transports.dayNumber': 'Día {n}',
  'transports.error.titleEmpty':
    'Dale a este trayecto un nombre que reconozcas en una lista.',
  'transports.error.date': 'Una fecha se escribe AAAA-MM-DD.',
  'transports.error.time': 'Una hora se escribe HH:MM en formato de 24 horas.',
  'transports.error.departureNeedsDate':
    'Una hora de salida necesita el día en que cae.',
  'transports.error.arrivalNeedsDate':
    'Una hora de llegada necesita el día en que cae.',
  'transports.error.code': 'Un código tiene de 2 a 8 letras o dígitos.',
  'transports.error.distance':
    'Una distancia es un número de kilómetros, hasta 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Este trayecto llega antes de salir.',
  'transports.error.timingHint':
    'Mueve una de las dos horas para que el trayecto se pueda coger de verdad.',
  'transports.error.arrivalDayBeforeDeparture':
    'El día de llegada es anterior al día de salida.',
  'transports.error.returnDayBeforePickUp':
    'El día de devolución es anterior al día de recogida.',
  'transports.field.noDay': 'Todavía sin día',
  'transports.fill.legend': 'Cómo rellenar esto',
  'transports.fill.manual': 'Escríbelo tú',
  'transports.fill.searchAgain': 'Buscar otra vez',
  'transports.fill.search': 'Buscar conexiones',
  'transports.chain.unsplit': 'Volver a dejarlo como un solo viaje',
  'transports.field.arrivalDayHint':
    'Un viaje que llega a la mañana siguiente lo dice aquí.',
  'transports.chain.splitHint':
    '¿Transbordo por el camino? Anota cada parte con su número de servicio, andén, asiento y horas.',
  'transports.chain.split': 'Dividir en tramos',
  'transports.chain.stopNumber': 'parada {n}',
  'transports.chain.change': 'Transbordo {n}',
  'transports.chain.removeStation': 'Elimina {label}',
  'transports.chain.findStation': 'Busca un aeropuerto o una estación',
  'transports.chain.findStationFor':
    'Busca un aeropuerto o una estación para {label}',
  'transports.chain.findPlaceholder': 'MAD, Barajas, Madrid…',
  'transports.chain.findEmpty':
    'Sin coincidencias — escribe la parada tú mismo abajo.',
  'transports.chain.stopLabel': 'Parada',
  'transports.chain.stopPlaceholder': 'Madrid Atocha',
  'transports.chain.timezoneHint': 'Con qué reloj va esta parada',
  'transports.chain.timezoneAt': 'Zona horaria en {label}',
  'transports.chain.timezonePlaceholder': 'Sin indicar',
  'transports.chain.timezoneSearch': 'Tokio, Lisboa, UTC…',
  'transports.chain.acrossClocks': '{gap} entre dos relojes',
  'transports.chain.addStopAfter': 'Añade una parada después de {label}',
  'transports.chain.servicePlaceholder': 'AVE 3092',
  'transports.chain.leaves': 'Sale de {label}',
  'transports.chain.reaches': 'Llega a {label}',
  'transports.chain.dayOfLeg': '{label} del tramo {n}',
  'transports.chain.formError': 'Esta cadena no se puede guardar',
  'transports.chain.atCap':
    'Una cadena admite como máximo {max} tramos — es un límite de lo que puede llevar un guardado, no de cuántos transbordos puede tener un viaje.',
  'transports.chain.hint':
    'Añade una parada en cualquier tramo para registrar un cambio de tren; cada tramo guarda su número de servicio, andén y asiento.',
  'transports.field.timezone': 'Zona horaria',
  'transports.field.platform': 'Andén',
  'transports.chain.legNumber': 'Tramo {n}',
  'transports.chain.platform': 'Andén {value}',
  'transports.chain.seat': 'Asiento {value}',
  'transports.chain.error.stopName':
    'Cada parada necesita un nombre — aquí es donde haces transbordo.',
  'transports.chain.error.stopNameLong':
    'El nombre de una parada debe tener menos de 200 caracteres.',
  'transports.chain.error.timezone': 'Elige una zona horaria de la lista.',
  'transports.chain.error.tooManyLegs':
    'Una cadena admite como máximo {max} tramos.',
  'transports.bookingRefFor': 'la referencia de reserva de {title}',
  'transports.doorToDoor': 'Son {gap} de puerta a puerta.',
  'transports.title.fromTo': '{operator} de {from} a {to}',
  'transports.title.from': '{operator} desde {from}',
  'transports.title.to': '{operator} a {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'No hay horas que comparar',
  'transports.junction.unknown.detail':
    'Pon fecha y hora en los dos trayectos y esta conexión se comprobará por ti.',
  'transports.junction.impossible.headline':
    'Sale {gap} antes de que llegue el trayecto anterior',
  'transports.junction.impossible.detail':
    '«{to}» sale antes de que llegue «{from}», así que no se pueden coger los dos. Mueve uno.',
  'transports.junction.tight.headline': '{gap} para enlazar',
  'transports.junction.tight.detail':
    'Para {mode} suele hacer falta unos {required}. Esto va justo.',
  'transports.junction.tight.detailAt':
    'Para {mode} suele hacer falta unos {required} en {place}. Esto va justo.',
  'transports.junction.ok.headline': '{gap} de margen',
  'transports.junction.ok.detail':
    'Llega a {landing} pero el trayecto siguiente sale de {boarding}: habrá que cruzar.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Nota compartida',
  'collab.note.toast.sharedBody': 'Todos los del viaje ya la ven.',
  'collab.note.toast.shareFailed': 'La nota no se compartió',
  'collab.note.toast.updated': 'Nota actualizada',
  'collab.note.toast.updateFailed': 'La nota no se actualizó',
  'collab.note.dialog.editTitle': 'Editar esta nota',
  'collab.note.dialog.addTitle': 'Nueva nota compartida',
  'collab.note.dialog.body':
    'Restaurantes recomendados, normas de visado, el código del portal: todo lo que el viaje entero necesita recordar, en un solo sitio.',
  'collab.note.field.title': 'Título',
  'collab.note.field.titlePlaceholder': 'Código del portal',
  'collab.note.field.body': 'Nota',
  'collab.note.field.bodyPlaceholder':
    '4821 y luego la almohadilla. La caja de llaves está a la izquierda de la puerta.',
  'collab.note.field.categoryHint':
    'Agrupa el tablero bajo un filtro. Opcional.',
  'collab.note.field.categoryPlaceholder': 'Logística',
  'collab.note.field.pin': 'Fijar arriba del tablero',
  'collab.note.field.pinHint':
    'Las notas fijadas van primero, se añada lo que se añada.',
  'collab.note.action.saving': 'Guardando la nota',
  'collab.note.action.save': 'Guardar la nota',
  'collab.note.action.share': 'Compartir la nota',
  'collab.poll.toast.opened': 'Votación abierta',
  'collab.poll.toast.openedBody': 'Todos los del viaje ya pueden votar.',
  'collab.poll.toast.openFailed': 'La votación no se abrió',
  'collab.poll.dialog.addTitle': 'Nueva votación',
  'collab.poll.field.question': 'Pregunta',
  'collab.poll.field.questionPlaceholder': '¿Dónde cenamos la última noche?',
  'collab.poll.field.optionsLegend': 'Opciones de voto',
  'collab.poll.field.option': 'Respuesta {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Otra respuesta',
  'collab.poll.action.addOption': 'Añadir una respuesta',
  'collab.poll.action.removeOption': 'Eliminar la respuesta {n}',
  'collab.poll.field.multi': 'Permitir elegir más de una',
  'collab.poll.field.multiHint':
    'Desactivado es un voto por persona, y cambiar de idea lo mueve.',
  'collab.poll.action.opening': 'Abriendo la votación',
  'collab.poll.action.open': 'Abrir la votación',
  'collab.poll.error.tooFew':
    'Una votación necesita al menos dos cosas entre las que elegir.',
  'collab.poll.error.duplicate':
    'Dos respuestas dicen lo mismo. Dale a cada una su propia redacción.',
  'collab.presence.viewingNow': 'están mirando ahora',
  'collab.presence.unnamed': 'Miembro sin nombre',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} pestaña abierta',
    many: '{name} — {count} pestañas abiertas',
    other: '{name} — {count} pestañas abiertas',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'De acuerdo',
  'collab.reaction.love': 'Me encanta',
  'collab.reaction.funny': 'Gracioso',
  'collab.reaction.celebrate': 'A celebrar',
  'collab.reaction.thanks': 'Gracias',
  'collab.reaction.looking': 'Mirando',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, contigo incluido',
  'collab.thread.today': 'Hoy',
  'collab.thread.emptyBody':
    'Todas las personas de este viaje comparten una conversación. Las decisiones que se toman aquí se quedan con el viaje en lugar de dispersarse por chats de grupo.',
  'collab.thread.empty': 'Todavía no hay mensajes',
  'collab.toast.reactionFailed': 'La reacción no se guardó',
  'collab.toast.messageDeleted': 'Mensaje eliminado',
  'collab.toast.deleteFailed': 'El mensaje no se eliminó',
  'collab.toast.notSent': 'No enviado',
  'collab.toast.notSentBody':
    'El mensaje no se pudo enviar. Inténtalo dentro de un momento.',
  'collab.toast.messageUpdated': 'Mensaje actualizado',
  'collab.toast.editFailed': 'El cambio no se guardó',
  'collab.message.deleteTitle': '¿Eliminar este mensaje?',
  'collab.message.deleteBody':
    'El texto desaparece del hilo. Las respuestas se quedan donde están.',
  'collab.message.delete': 'Eliminar el mensaje',
  'collab.message.reply': 'Responder',
  'collab.message.menuEdit': 'Editar el mensaje…',
  'collab.message.react': 'Reaccionar a este mensaje',
  'collab.message.edited': 'editado',
  'collab.message.actionsFor': 'Acciones para el mensaje de {name}',
  'collab.compose.editingYours': 'Estás editando tu mensaje',
  'collab.compose.replyingTo': 'Respondiendo a {name}',
  'collab.compose.cancelReply': 'Cancelar la respuesta',
  'collab.compose.cancelEdit': 'Cancelar la edición',
  'collab.compose.placeholder': 'Escribe al viaje',
  'collab.compose.placeholderText': 'Dile algo al grupo…',
  'collab.compose.editPlaceholder': 'Editar tu mensaje',
  'collab.compose.editPlaceholderText': 'Cambia lo que dijiste…',
  'collab.compose.send': 'Enviar el mensaje',
  'collab.compose.savingEdit': 'Guardando el cambio',
  'collab.compose.save': 'Guardar',
  'collab.hint.sends': 'envía',
  'collab.hint.addsLine': 'añade una línea',
  'collab.hint.cancels': 'cancela',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Nota eliminada',
  'collab.toast.noteRemoveFailed': 'La nota no se eliminó',
  'collab.notes.empty.title': 'No hay notas compartidas',
  'collab.notes.empty.body':
    'Restaurantes recomendados, normas de visado, el código del portal: todo lo que el viaje entero necesita recordar.',
  'collab.notes.empty.action': 'Escribe la primera nota',
  'collab.note.menu.edit': 'Editar la nota…',
  'collab.note.menu.unpin': 'Dejar de fijar',
  'collab.note.menu.pin': 'Fijar arriba',
  'collab.note.remove': 'Eliminar la nota',
  'collab.note.removeBody':
    'La nota desaparece del tablero para todos los del viaje.',
  'collab.note.new': 'Nota nueva',
  'collab.poll.toast.voteFailed': 'Tu voto no se guardó',
  'collab.poll.toast.voteFailedBody': 'El recuento no ha cambiado.',
  'collab.poll.toast.closed': 'Votación cerrada',
  'collab.poll.toast.closeFailed': 'La votación no se cerró',
  'collab.poll.toast.removed': 'Votación eliminada',
  'collab.poll.toast.removeFailed': 'La votación no se eliminó',
  'collab.polls.heading': 'Votaciones',
  'collab.polls.empty.title': 'No hay votaciones abiertas',
  'collab.polls.empty.body':
    'Cuando el grupo no se pone de acuerdo en un restaurante, sometedlo a votación y dejad que la respuesta se resuelva sola.',
  'collab.polls.empty.action': 'Pregunta al grupo',
  'collab.poll.menu.close': 'Cerrar la votación',
  'collab.poll.remove': 'Eliminar la votación',
  'collab.poll.removeTitle': '¿Eliminar esta votación?',
  'collab.poll.actionsFor': 'Acciones para la votación «{question}»',
  'collab.badge.pinned': 'Fijada',
  'collab.badge.closed': 'Cerrada',
  'collab.badge.open': 'Abierta',
  'collab.badge.multi': 'Elección múltiple',
  'collab.badge.leading': 'Va ganando',
  'collab.poll.removeBody': {
    one: '«{question}» y su {count} voto desaparecen para todos.',
    many: '«{question}» y sus {count} votos desaparecen para todos.',
    other: '«{question}» y sus {count} votos desaparecen para todos.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} de {count} voto',
    many: '{label} — {votes} de {count} votos',
    other: '{label} — {votes} de {count} votos',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} de {count} voto, el tuyo incluido',
    many: '{label} — {votes} de {count} votos, el tuyo incluido',
    other: '{label} — {votes} de {count} votos, el tuyo incluido',
  },
  'collab.poll.voteCount': {
    one: '{count} voto',
    many: '{count} votos',
    other: '{count} votos',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Documento',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Entrada',
  'files.kind.receipt': 'Recibo',
  'files.kind.map': 'Mapa',
  'files.kind.other': 'Otro',
  'files.kindChoice.ticket': 'Entrada o pase',
  'files.kindChoice.map': 'Mapa o ruta',
  'files.toast.removed': 'Archivo eliminado',
  'files.toast.removeFailed': 'El archivo no se eliminó',
  'files.toast.downloadFailed': 'La descarga no arrancó',
  'files.toast.gone': 'El archivo ya no está disponible en esta pestaña.',
  'files.toast.uploadFailed': 'La subida falló. Inténtalo otra vez.',
  'files.toast.updated': 'Archivo actualizado',
  'files.toast.updateFailed': 'El archivo no se actualizó',
  'files.storage.full': 'Este espacio se ha quedado sin almacenamiento',
  'files.storage.used':
    'Se usan {used} de {limit}. Elimina un archivo de abajo, o sube de plan, antes de añadir nada más.',
  'files.storage.perFile': 'hasta {size} cada uno',
  'files.action.add': 'Añadir archivos',
  'files.action.choose': 'Elegir archivos',
  'files.action.upload': 'Subir archivos',
  'files.calendar.title': 'Calendario',
  'files.calendar.description':
    'Lleva este viaje a la aplicación de calendario que ya usas.',
  'files.calendar.download.action': 'Descargar archivo de calendario (.ics)',
  'files.calendar.download.hint':
    'Una instantánea del viaje tal como está ahora. No se actualiza.',
  'files.calendar.undated':
    'Este viaje aún no tiene fechas, así que solo aparecerán las reservas y los trayectos con fecha.',
  'files.calendar.download.error':
    'No hemos podido preparar el archivo. Inténtalo de nuevo.',
  'files.calendar.timesNote':
    'Los trayectos con zona horaria se muestran en el mismo instante en todas partes. Todo lo demás se muestra a la hora prevista del reloj, esté donde esté tu calendario.',
  'files.drop.active': 'Suelta para subir',
  'files.drop.pasteHint': 'pega una imagen copiada o una captura de pantalla',
  'files.reject.blockedType':
    '«{name}» no se añadió: aquí no se guardan archivos XML ni SVG comprimidos, por seguridad. Guárdalo como PDF o como imagen y añade eso en su lugar.',
  'files.drop.idle': 'Arrastra archivos aquí',
  'files.empty.title': 'No hay archivos en este viaje',
  'files.empty.body':
    'Todo lo que si no tendrías que rebuscar en un correo en el mostrador de facturación está aquí, junto al viaje al que pertenece.',
  'files.empty.hint':
    'Tarjetas de embarque, confirmaciones de hotel, entradas, documentos del seguro y los recibos que respaldan tus gastos.',
  'files.heading': 'Adjuntos',
  'files.tableCaption': 'Archivos adjuntos a este viaje',
  'files.menu.download': 'Descargar',
  'files.menu.rename': 'Cambiar nombre y descripción…',
  'files.menu.remove': 'Eliminar el archivo',
  'files.remove.body':
    'El archivo se borra del almacenamiento y del viaje, y se liberan {size}. Esto no se puede deshacer.',
  'files.queue.clear': 'Limpiar los terminados',
  'files.column.file': 'Archivo',
  'files.column.size': 'Tamaño',
  'files.column.addedBy': 'Añadido por',
  'files.column.when': 'Cuándo',
  'files.status.uploaded': 'Subido',
  'files.status.failed': 'Fallido',
  'files.status.cancelled': 'Cancelado',
  'files.status.uploading': 'Subiendo',
  'files.status.waiting': 'Esperando',
  'files.error.nameEmpty':
    'Un archivo necesita un nombre por el que lo encuentres.',
  'files.field.kindHint':
    'Decide bajo qué filtro se queda y qué icono le toca.',
  'files.field.kindAria': 'Tipo de archivo',
  'files.field.description': 'Descripción',
  'files.field.descriptionPlaceholder':
    'Póliza de seguro: cubre a todo el grupo, línea de siniestros en la página 2.',
  'files.dialog.title': 'Detalles del archivo',
  'files.action.saving': 'Guardando el archivo',
  'files.action.save': 'Guardar los detalles',
  'files.queue.someFailed': {
    one: '{count} archivo no se subió. El motivo está en cada fila: nada más del lote se vio afectado.',
    many: '{count} archivos no se subieron. El motivo está en cada fila: nada más del lote se vio afectado.',
    other:
      '{count} archivos no se subieron. El motivo está en cada fila: nada más del lote se vio afectado.',
  },

  'files.action.cancelUploadOf': 'Cancelar la subida de {name}',
  'files.action.dismissOf': 'Descartar {name}',
  'files.status.downloadingOf': 'Descargando {name}',
  'files.status.uploadingOf': 'Subiendo {name}',
  'files.status.uploadingCount': {
    one: 'Subiendo {count} archivo',
    many: 'Subiendo {count} archivos',
    other: 'Subiendo {count} archivos',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - generado el {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': 'Listo: {title}',
  'files.export.email.body': {
    one: 'La exportación del viaje está lista. Se conserva durante {count} día.',
    many: 'La exportación del viaje está lista. Se conserva durante {count} días.',
    other:
      'La exportación del viaje está lista. Se conserva durante {count} días.',
  },
  'files.export.email.action': 'Abrir {title}',
  'files.export.email.text': 'La exportación del viaje está lista: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Exportar el viaje',
  'files.export.description':
    'Una copia imprimible del viaje: días, paradas, reservas, transporte y alojamientos. Entrégala a alguien que no tenga cuenta.',
  'files.export.kept': {
    one: 'Cada exportación se conserva durante {count} día.',
    many: 'Cada exportación se conserva durante {count} días.',
    other: 'Cada exportación se conserva durante {count} días.',
  },
  'files.export.empty.title': 'Aún no hay exportaciones',
  'files.export.empty.body':
    'Haz una copia imprimible del viaje para enviarla a alguien que no tenga cuenta.',
  'files.export.empty.bodyViewer':
    'El propietario o un editor del viaje puede hacer una.',
  'files.export.format.pdf': 'Archivo PDF',
  'files.export.format.html': 'Página imprimible',
  'files.export.artifact': 'Exportación del viaje, {date}',
  'files.export.download': 'Descargar',
  'files.export.downloadLabelPdf': 'Descargar el PDF creado el {date}',
  'files.export.downloadLabelHtml':
    'Descargar la página imprimible creada el {date}',
  'files.export.error.list': 'La lista de exportaciones no se cargó.',
  'files.export.retry': 'Reintentar',
  'files.export.error.missing':
    'Esa exportación ya no se conserva. Exporta el viaje de nuevo.',
  'files.export.error.missingViewer': 'Esa exportación ya no se conserva.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Subida cancelada.',
  'files.error.badAnswer':
    'El servidor mandó una respuesta que este navegador no supo leer.',
  'files.error.connection':
    'La conexión se cortó durante la subida. Revisa tu red e inténtalo otra vez.',
  'files.error.timeout': 'La subida agotó el tiempo. Inténtalo otra vez.',
  'files.error.refused': 'El servidor rechazó la subida ({status}).',
  'files.error.downloadShape':
    'La descarga volvió en una forma que no pudimos guardar.',
  'files.error.downloadFailed': 'La descarga falló ({status}).',
  'files.toast.uploadedOne': 'Archivo subido',
  'files.toast.uploadedManyBody': 'Se añadieron {size} a este viaje.',
  'files.toast.failedOne': 'Ese archivo no se subió',
  'files.toast.failedManyBody': 'La cola de abajo dice el motivo de cada uno.',
  'files.error.tooMany': {
    one: 'Solo se puede añadir {count} archivo a la vez, así que «{name}» se quedó fuera. Vuelve a soltarlo él solo.',
    many: 'Solo se pueden añadir {count} archivos a la vez, así que «{name}» se quedó fuera. Vuelve a soltarlo él solo.',
    other:
      'Solo se pueden añadir {count} archivos a la vez, así que «{name}» se quedó fuera. Vuelve a soltarlo él solo.',
  },
  'files.toast.uploadedMany': {
    one: '{count} archivo subido',
    many: '{count} archivos subidos',
    other: '{count} archivos subidos',
  },
  'files.toast.failedMany': {
    one: '{count} archivo no se subió',
    many: '{count} archivos no se subieron',
    other: '{count} archivos no se subieron',
  },

  'files.export.request': 'Exportar el viaje',
  'files.export.includeReferences': 'Incluir códigos de confirmación',
  'files.export.includeReferencesHint':
    'No marques esta opción si enviarás el archivo a alguien ajeno a tu espacio.',
  'files.export.pending':
    'Preparando la exportación. Puedes salir de esta página; el archivo aparecerá en esta lista cuando esté listo.',
  'files.export.slow':
    'Está tardando más de lo habitual. El archivo aparecerá aquí cuando esté listo. Si no aparece, vuelve a exportar.',
  'files.export.refresh': 'Actualizar',
  'files.export.ready': 'Tu exportación está lista',
  'files.export.quota': {
    one: 'Se ha agotado el cupo mensual de este espacio de {count} exportaciones. El contador se reinicia el {date}.',
    many: 'Se ha agotado el cupo mensual de este espacio de {count} exportaciones. El contador se reinicia el {date}.',
    other:
      'Se ha agotado el cupo mensual de este espacio de {count} exportaciones. El contador se reinicia el {date}.',
  },
  'files.export.error.request': 'No se inició la exportación',
  'files.export.error.requestBody':
    'Este intento no se ha contabilizado. Vuelve a intentarlo en un momento.',
  'files.export.doc.overview': 'Resumen',
  'files.export.doc.timezone': 'Zona horaria',
  'files.export.doc.days': 'Días',
  'files.export.doc.day': {
    one: 'Día {count} - {date}',
    many: 'Día {count} - {date}',
    other: 'Día {count} - {date}',
  },
  'files.export.doc.dayUndated': {
    one: 'Día {count}',
    many: 'Día {count}',
    other: 'Día {count}',
  },
  'files.export.doc.dayEmpty': 'Aún no hay planes.',
  'files.export.doc.reservations': 'Reservas',
  'files.export.doc.transport': 'Transporte',
  'files.export.doc.reference': 'Referencia {code}',
  'files.export.doc.route': '{from} a {to}',
  'files.export.doc.stays': 'Dónde nos alojamos',
  'files.export.doc.nights': {
    one: 'Noches: {count}',
    many: 'Noches: {count}',
    other: 'Noches: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'No caben todos los días en un documento. Se muestran los primeros {count} días.',
    many: 'No caben todos los días en un documento. Se muestran los primeros {count} días.',
    other:
      'No caben todos los días en un documento. Se muestran los primeros {count} días.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Se muestran los primeros {count} de {total}.',
    many: 'Se muestran los primeros {count} de {total}.',
    other: 'Se muestran los primeros {count} de {total}.',
  },
} satisfies TranslationOf<typeof En>

export default messages
