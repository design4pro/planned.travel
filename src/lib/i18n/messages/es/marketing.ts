/**
 * The public pages' copy, in es.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Tipografía.** El español abre interrogación y exclamación.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Empieza gratis',
  'action.signIn': 'Iniciar sesión',
  'action.pricing': 'Precios',
  'action.seePricing': 'Ver precios',
  'action.skipToContent': 'Ir al contenido',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — inicio',
  'nav.onThisPage': 'En esta página',
  'anchor.planner': 'Planificador',
  'anchor.modules': 'Módulos',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Suelta en el día {day}',
  'legal.summaryNote':
    'El resumen está para leerse. Lo que se aplica de verdad es lo de abajo.',
  'visual.daysTravelled': 'Días de viaje',
  'visual.acrossEveryTrip': 'en todos los viajes',
  'visual.mapFilled': '{percent}% del mapa completado',
  'visual.previewSummary':
    'Una vista previa del panel de planned.travel: el próximo viaje con sus fechas, viajeros y número de lugares; totales de países visitados, viajes y días de viaje; un mapa de la ruta; y las dos próximas reservas.',
  'visual.placesMapped': {
    one: '{value} lugar en el mapa',
    many: '{value} lugares en el mapa',
    other: '{value} lugares en el mapa',
  },
  'visual.splitWays': {
    one: 'sin repartir',
    many: 'repartido entre {value}',
    other: 'repartido entre {value}',
  },
  'visual.tripTotal': 'Total del viaje',
  'visual.paidSplit': 'pagó {who} · {split}',
  'visual.nextUp': 'A continuación',
  'visual.ofTotal': '{done} de {total}',
  'visual.awaitingReply': 'Esperando respuesta',
  'visual.upcoming': 'Próximos',
  'visual.days': {
    one: '{value} día',
    many: '{value} días',
    other: '{value} días',
  },
  'visual.places': {
    one: '{value} lugar',
    many: '{value} lugares',
    other: '{value} lugares',
  },
  'visual.transfersLeft': {
    one: 'queda {value} transferencia',
    many: 'quedan {value} transferencias',
    other: 'quedan {value} transferencias',
  },

  'legal.badge.version': 'Versión {version}',
  'legal.badge.effective': 'En vigor desde {updated}',
  'legal.notice.title': 'Esto es una plantilla, no asesoramiento legal',
  'legal.notice.body':
    'Está escrita en inglés sencillo para ser un punto de partida realmente útil para un pequeño servicio de planificación de viajes, y cada hueco que una empresa debe rellenar está señalado. Que un abogado cualificado de tu jurisdicción la revise y la adapte antes de aceptar un solo cliente. Nada aquí afirma que planned.travel tenga ninguna certificación, auditoría ni estándar de cumplimiento.',
  'legal.contents': 'Contenido',
  'legal.shortVersion': 'La versión breve',
  'legal.both': 'Los dos documentos se aplican juntos.',

  'landing.plans.title': 'Empieza gratis. Paga solo cuando se lo gane.',
  'landing.plans.lede':
    'Todos los planes incluyen el planificador diario, el mapa, los presupuestos y las listas de equipaje. Los planes de pago - desde {price} al mes - desbloquean viajes ilimitados, reservas, el diario, mapas sin conexión y exportaciones.',
  'landing.plans.ledeFree':
    'Todos los planes incluyen el planificador diario, el mapa, los presupuestos y las listas de equipaje. Los planes de pago desbloquean viajes ilimitados, reservas, el diario, mapas sin conexión y exportaciones.',
  'landing.plans.compare': 'Compara cada límite, línea por línea',
  'landing.questions.title': 'Preguntas, respondidas sin rodeos',
  'landing.questions.lede':
    'Las seis cosas que la gente quiere saber de verdad antes de empezar.',
  'cta.heading': 'Tu próximo viaje ya merece planificarse bien',
  'cta.lede':
    'Dos viajes, el mapa entero, el itinerario y las listas de equipaje: gratis, sin tarjeta y sin cuenta atrás.',
  'landing.faq.seats.q': '¿La gente con la que viajo también tiene que pagar?',
  'landing.faq.seats.a':
    'No. Todos los que invites a un espacio de trabajo {crew} están cubiertos por sus plazas. Entran con su propia cuenta y ven solo los viajes a los que los añadiste.',
  'landing.faq.phone.q': '¿Funciona bien en el móvil?',
  'landing.faq.phone.a':
    'Sí. Los diseños móviles se dibujan aparte en lugar de comprimirse desde los de escritorio, y es una web, así que no hay nada que instalar ni que mantener actualizado.',
  'landing.faq.offline.q': '¿Puedo usar el mapa sin cobertura?',
  'landing.faq.offline.a':
    'Con {solo} y {crew} puedes descargar una región antes de volar, así que el mapa se dibuja igual cuando aterrizas sin datos. Editar el viaje sí necesita conexión.',
  'landing.faq.privacy.q': '¿Quién puede ver mi viaje?',
  'landing.faq.privacy.a':
    'Un viaje pertenece a un espacio de trabajo, y solo las personas invitadas a ese espacio pueden abrirlo. Nada es público, no hay ningún feed de descubrimiento y por defecto no se comparte nada con nadie.',
  'landing.faq.stop.q': '¿Qué pasa con mis viajes si dejo de pagar?',
  'landing.faq.stop.a':
    'No se borra nada. Los módulos de pago se bloquean, tus viajes se quedan exactamente donde están y todo se desbloquea en cuanto te suscribes. {free} sigue siendo gratis, sin cuenta atrás.',

  'action.startPlanning': 'Empieza a planificar gratis',
  'cta.comparePlans': 'Compara los planes',
  'landing.hero.eyebrow': 'Planificación de viajes en grupo',
  'landing.hero.title': 'Planifica el viaje.',
  'landing.hero.titleQuiet': 'No la hoja de cálculo.',
  'landing.hero.lede':
    'Un itinerario sobre un mapa de verdad, compartido en vivo con todos los que viajan, con las reservas, el dinero y la lista de equipaje unidos a él.',
  'landing.hero.secondary': 'Mira lo que cuesta',
  'landing.trust.noCard': 'Sin tarjeta para empezar',
  'landing.trust.noAds': 'Sin anuncios ni enlaces de afiliado',
  'landing.trust.export': 'Exporta todo, cuando quieras',

  'proof.eyebrow': 'Respuestas claras',
  'proof.title': 'Sin testimonios, porque todavía no nos los hemos ganado',
  'proof.lede':
    'planned.travel es nuevo. En lugar de inventar una cita o pedir prestado el logotipo de alguien, aquí está exactamente qué hace, para quién es y qué no te hará nunca.',
  'proof.who.label': 'Para quién es',
  'proof.who.heading': 'Para quien acaba montando la hoja de cálculo',
  'proof.who.body':
    'Parejas, familias y grupos de amigos que quieren un plan que todos vean, en lugar de seis capturas, tres grupos de chat y una nota compartida que nadie ha abierto desde marzo.',
  'proof.not.label': 'Qué no es',
  'proof.not.heading': 'No es un buscador de reservas, ni está en venta a uno',
  'proof.not.body':
    'No cobramos comisión, no llevamos anuncios y no ponemos enlaces de afiliado, así que nada en una página te empuja en silencio hacia un hotel concreto. Nos pagas tú, o sea que trabajamos para ti.',
  'proof.where.label': 'Dónde viven tus cosas',
  'proof.where.heading': 'En Cloudflare, en tu propio espacio de trabajo',
  'proof.where.body':
    'Los viajes están en una base de datos limitada a tu espacio de trabajo y los archivos en nuestro propio almacenamiento de objetos, ambos servidos desde el borde de Cloudflare. Polar, nuestro comerciante registrado, gestiona el pago y emite la factura, así que el número de tu tarjeta nunca llega hasta nosotros.',
  'proof.promise.ads.title': 'Sin publicidad, sin analítica de terceros',
  'proof.promise.ads.body':
    'Nada de esta página te está midiendo para otra persona.',
  'proof.promise.sold.title': 'Tus viajes no se venden ni se alquilan nunca',
  'proof.promise.sold.body':
    'Ni a anunciantes, ni a empresas de viajes, ni a nadie.',
  'proof.promise.leave.title': 'Vete cuando quieras, con todo',
  'proof.promise.leave.body':
    'Itinerarios en PDF, archivos de calendario y tus lugares en GeoJSON.',
  'proof.certification':
    'Hoy no tenemos ninguna certificación de seguridad, y no vamos a insinuar que la tengamos. Cuando planned.travel se audite contra un estándar, aquí diremos el estándar, el auditor y la fecha - y no antes.',

  'feature.modules.title': 'El resto del viaje, resuelto',
  'feature.modules.lede':
    'Cada módulo hace bien una sola cosa y le pasa su trabajo a los demás. Aquí no hay pestañas de relleno esperando una versión futura.',
  'feature.module.lists.benefit': 'Nadie llega sin el adaptador.',
  'feature.module.lists.detail':
    'Equipaje, tareas, compras y documentos: una lista por trabajo, compartida con todos los que viajan y tachada a medida que pasa.',
  'feature.module.journal.name': 'Diario',
  'feature.module.journal.benefit':
    'El viaje se vuelve un relato, no una carpeta.',
  'feature.module.journal.detail':
    'Entradas por fecha con las fotos que hiciste, dónde estabas, el tiempo y cómo fue el día de verdad.',
  'feature.module.atlas.benefit':
    'Un mapa de todos los sitios donde has estado.',
  'feature.module.atlas.detail':
    'Marca un país como visitado y se suma a tu mapa del mundo, con la primera visita, la más reciente y cuántas veces has vuelto.',
  'feature.module.vacay.benefit': 'Pide los días antes de comprar el vuelo.',
  'feature.module.vacay.detail':
    'Marca los días que estás fuera y el año se completa: fines de semana, festivos y las vacaciones de los demás en la misma cuadrícula.',
  'feature.module.collab.benefit': 'Las decisiones se quedan con el viaje.',
  'feature.module.collab.detail':
    'Un hilo por viaje, notas compartidas para lo que todos deben recordar y una encuesta para cuando el grupo no se pone de acuerdo con la cena.',
  'feature.module.files.benefit':
    'Las tarjetas de embarque donde puedes encontrarlas.',
  'feature.module.files.detail':
    'Confirmaciones, entradas, pólizas y recibos adjuntos al viaje al que pertenecen, no enterrados en un correo.',

  'feature.planner.title': 'Un plan día a día dibujado sobre un mapa de verdad',
  'feature.planner.lede':
    'Reúne los lugares que quieres ver y arrástralos a un día. El mapa redibuja la ruta mientras trabajas, así que ves al instante cuando una mañana te hace cruzar la ciudad dos veces.',
  'feature.planner.point.days':
    'Una columna por día, con su fecha, su tiempo y el lugar donde duermes.',
  'feature.planner.point.unscheduled':
    'Los lugares sin fecha esperan en su propia columna hasta que tengan un día.',
  'feature.planner.point.crew':
    'En {crew} todos arrastran a la vez: cursores en vivo, sincronización instantánea, sin recargar.',
  'feature.planner.point.tiles':
    'Teselas vectoriales servidas desde nuestro propio almacenamiento, así ningún proveedor de mapas mira cómo planificas.',
  'feature.costs.title': 'Gastos compartidos que de verdad se liquidan',
  'feature.costs.lede':
    'Anota lo que gastas en la moneda del viaje, reparte cada gasto como lo acordasteis de verdad y mira el conjunto más corto de transferencias que lo cierra todo.',
  'feature.costs.point.split':
    'A partes iguales, por porcentaje o por importe exacto: por gasto, no por viaje.',
  'feature.costs.point.currency':
    'Todo convertido a una sola moneda del viaje para que el total signifique algo.',
  'feature.costs.point.settle':
    'La vista de liquidación dice quién paga a quién y registra la transferencia cuando se hace.',
  'feature.costs.point.receipt':
    'Adjunta el recibo al gasto, para que la cifra siempre tenga su prueba.',
  'feature.book.title':
    'Cada reserva, con el código que necesitas en la puerta',
  'feature.book.lede':
    'Alojamientos, mesas, visitas y entradas en una lista, junto a los vuelos, trenes y ferris que te llevan entre ellos: cada uno con su número de confirmación y el día al que pertenece.',
  'feature.book.point.legs':
    'Los trayectos llevan el asiento, el andén, la terminal y el código de reserva.',
  'feature.book.point.day':
    'Una reserva va unida a un día, así que aparece en el plan sin volver a escribirla.',
  'feature.book.point.states':
    'Solicitada, confirmada y cancelada son estados distintos, no una nota en un campo.',
  'feature.book.point.export':
    'Exporta el viaje entero como itinerario en PDF o archivo de calendario antes de volar.',

  'pricing.faq.trial.q': '¿Qué pasa cuando acaba la prueba?',
  'pricing.faq.trial.a':
    'La prueba se convierte en el plan de pago. Polar registra un método de pago al empezar la prueba y lo cobra el día en que la prueba acaba, así que si cancelas antes nunca se te cobra. En ningún caso se borra nada: los módulos de pago se bloquean, tus viajes se quedan exactamente donde están y todo se desbloquea en el momento en que te suscribes.',
  'pricing.faq.seller.q': '¿A quién le estoy comprando en realidad?',
  'pricing.faq.seller.a':
    'A Polar. Es nuestro comerciante registrado: te vende la suscripción como revendedor, cobra el pago, emite la factura en su propio nombre y determina, recauda y liquida el impuesto sobre las ventas o el IVA que cobra tu país. Las devoluciones y las disputas de tarjeta también se resuelven con ellos. El servicio lo seguimos llevando nosotros, y nosotros respondemos tus correos.',
  'pricing.faq.change.q': '¿Puedo cambiar de plan a mitad de un viaje?',
  'pricing.faq.change.a':
    'Sí. Las subidas de plan se aplican de inmediato y se prorratean al día; las bajadas surten efecto al final del periodo que ya has pagado, así que nunca pierdes un acceso que pagaste.',
  'pricing.faq.seats.q': '¿Cómo funciona la facturación por miembro en {crew}?',
  'pricing.faq.seats.a':
    'Pagas por las plazas que ocupas de verdad, y puedes cambiar el número en cualquier momento. Las invitaciones pendientes cuentan contra tus plazas, para que un espacio nunca supere el plan sin avisar.',
  'pricing.faq.guests.q':
    '¿La gente con la que viajo necesita su propia suscripción?',
  'pricing.faq.guests.a':
    'No. Todos los que invites a un espacio de trabajo {crew} están cubiertos por sus plazas. Entran con su propia cuenta y ven los viajes a los que se les ha añadido.',
  'pricing.faq.storage.q': '¿Qué cuenta para el almacenamiento?',
  'pricing.faq.storage.a':
    'Fotografías, billetes, confirmaciones y cualquier archivo que adjuntes a un viaje. Las teselas del mapa y la propia aplicación nunca cuentan. En Ajustes ves exactamente qué ocupa espacio.',
  'pricing.faq.export.q': '¿Puedo sacar mis datos?',
  'pricing.faq.export.a':
    'Siempre. Cada viaje se exporta como itinerario en PDF y como archivo de calendario, y tus lugares se exportan como GeoJSON. Son tus viajes, no los nuestros.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Sin tarjeta, sin plazo, sin cuenta atrás',
  'pricing.card.yearlyPerSeat': '{amount} al año por miembro, en un solo cargo',
  'pricing.card.yearly': '{amount} en un solo cargo al año',
  'pricing.card.seatsUnlimited': 'Miembros ilimitados',
  'pricing.card.tripsUnlimited': 'viajes ilimitados',
  'pricing.card.startFree': 'Empieza gratis',
  'pricing.card.startTrial': 'Prueba {plan}',
  'pricing.card.popular': 'El más elegido',
  'pricing.card.noteYearly': 'Un cargo al año. Dos meses invitamos nosotros.',
  'pricing.card.noteMonthly': 'Cargo mensual. Cambia o cancela cuando quieras.',
  'pricing.card.trial': {
    one: '{value} día de prueba, tarjeta por adelantado, cargo al terminar',
    many: '{value} días de prueba, tarjeta por adelantado, cargo al terminar',
    other: '{value} días de prueba, tarjeta por adelantado, cargo al terminar',
  },
  'pricing.card.seatsUpTo': {
    one: 'Hasta {value} miembro',
    many: 'Hasta {value} miembros',
    other: 'Hasta {value} miembros',
  },
  'pricing.card.trips': {
    one: '{value} viaje a la vez',
    many: '{value} viajes a la vez',
    other: '{value} viajes a la vez',
  },

  'pricing.feature.storage': '{size} para fotos y documentos',
  'pricing.feature.storageShared': '{size} compartidos para fotos y documentos',
  'pricing.feature.free.tripsDetail': 'Archiva uno para empezar otro',
  'pricing.feature.solo.modules': 'Todos los módulos de planificación',
  'pricing.feature.solo.modulesDetail':
    'Reservas, diario, presupuestos, equipaje',
  'pricing.feature.solo.offlineDetail': 'Descarga regiones antes de volar',
  'pricing.feature.crew.membersDetail':
    'Se factura por miembro, cámbialo cuando quieras',
  'pricing.feature.crew.realtimeDetail':
    'Cursores en vivo y sincronización instantánea',
  'pricing.feature.crew.supportDetail':
    'Respuesta de una persona en un día laborable',

  'pricing.hero.eyebrow': 'Dos viajes gratis, para siempre',
  'pricing.hero.title': 'Planifica como se debe.',
  'pricing.hero.titleQuiet': 'Paga por lo que usas.',
  'pricing.hero.lede':
    'Planifica dos viajes gratis. Desbloquea todos los módulos para un viajero, o llévate a todo el grupo y editad el mismo itinerario a la vez.',
  'pricing.hero.taxNote':
    'Precios en dólares estadounidenses, sin impuesto sobre las ventas ni IVA. Polar es nuestro comerciante registrado: es quien figura en tu factura, calcula lo que cobra tu país, lo añade al pagar y lo liquida. Cancela cuando quieras, desde el producto.',
  'pricing.compare.eyebrow': 'Lado a lado',
  'pricing.compare.title': 'Cada límite, comparado',
  'pricing.compare.lede':
    'Una tabla, generada desde el mismo catálogo que lee el sistema de facturación. Si una fila dice que un módulo está incluido, la comprobación de permisos está de acuerdo.',
  'pricing.compare.caption':
    'Comparación de funciones y límites entre los tres planes',
  'pricing.compare.feature': 'Función',
  'pricing.compare.limits': 'Límites',
  'pricing.compare.included': 'Incluido',
  'pricing.compare.notIncluded': 'No incluido',
  'pricing.compare.includedIn': 'Incluido en {plan}',
  'pricing.compare.notIn': 'No está en {plan}',
  'pricing.questions.eyebrow': 'Antes de que preguntes',
  'pricing.questions.title': 'Preguntas, respondidas',
  'pricing.questions.lede': 'Facturación, pruebas y cómo recuperar tus datos.',
  'pricing.cta.secondary': 'Mira cómo funciona',
  'pricing.module.itinerary': 'Itinerario día a día',
  'pricing.module.map': 'Mapa interactivo',
  'pricing.module.budget': 'Presupuestos y reparto de gastos',
  'pricing.module.packing': 'Listas de equipaje y tareas',
  'pricing.module.reservations': 'Reservas',
  'pricing.module.journal': 'Diario de viaje',
  'pricing.module.atlas': 'Mapa de países visitados',
  'pricing.module.collaboration': 'Invitar a otros viajeros',
  'pricing.module.realtime': 'Colaboración en directo',
  'pricing.module.offlineMaps': 'Mapas sin conexión',
  'pricing.module.pdfExport': 'Exportación a PDF y calendario',
  'pricing.module.prioritySupport': 'Soporte prioritario',

  'anchor.plans': 'Planes',
  'anchor.compare': 'Comparativa',
  'anchor.questions': 'Preguntas',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Un solo sitio para el itinerario, el mapa, las reservas, el dinero y la lista de equipaje — compartido con todos los que viajan.',
  'footer.attribution':
    'Funciona sobre Cloudflare Workers. Datos de mapas © colaboradores de OpenStreetMap. Venta y facturación a cargo de Polar, nuestro comerciante registrado.',
  'footer.column.product': 'Producto',
  'footer.column.account': 'Cuenta',
  'footer.link.overview': 'Resumen',
  'footer.link.everyModule': 'Todos los módulos',
  'footer.link.dayPlanner': 'Planificador de días',
  'footer.link.sharedCosts': 'Gastos compartidos',
  'footer.link.reservations': 'Reservas',
  'footer.link.atlasJournal': 'Atlas y diario',
  'footer.link.createAccount': 'Crear una cuenta',
  'footer.link.terms': 'Condiciones del servicio',
  'footer.link.privacy': 'Aviso de privacidad',
} satisfies TranslationOf<typeof En>

export default messages
