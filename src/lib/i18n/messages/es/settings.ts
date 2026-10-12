/**
 * Everything the settings module says, in Spanish.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tú», as everywhere else in the Spanish catalogue.
 *
 * **Plural.** `Intl.PluralRules('es')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Length is load-bearing here.** Two controls on these screens truncate: the
 * hint under each section link, and the trigger of every regional select. Each
 * `nav.*.hint` therefore stays inside the English one's width, and
 * `regional.workspaceDefault` leads with a short word rather than a full
 * translation of «workspace default», which would push the currency name out of
 * the trigger.
 *
 * **Currency names are lower case**, which is how Spanish writes them, and the
 * ISO code beside them is derived in the route rather than translated.
 *
 * **Plan names are words, not proper nouns.** `Solo` and `Crew` name a way of
 * travelling, so Spanish says «En solitario» and «Grupo»; the stable identifier
 * is the plan id in `src/lib/plans.ts`, which no reader ever sees.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Cuenta',
  'page.title': 'Ajustes',
  'page.description':
    'Todo sobre ti, sobre tu espacio de trabajo y sobre cómo se comporta planned.travel',
  'page.error': 'Los ajustes no se han cargado',

  'nav.label': 'Secciones de los ajustes',
  'nav.profile': 'Perfil',
  'nav.profile.hint': 'Tú, las fechas y el dinero',
  'nav.language': 'Idioma',
  'nav.language.hint': 'El idioma de cada pantalla',
  'nav.appearance': 'Apariencia',
  'nav.appearance.hint': 'Tema, movimiento y el mapa',
  'nav.security': 'Seguridad',
  'nav.security.hint': 'Contraseña, dos pasos, claves',
  'nav.notifications': 'Notificaciones',
  'nav.notifications.hint': 'Bandeja, correo y móvil',
  'nav.workspace': 'Espacio de trabajo',
  'nav.workspace.hint': 'Miembros y valores comunes',
  'nav.billing': 'Facturación',
  'nav.billing.hint': 'Plan, plazas y facturas',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Guardar los cambios',
  'error.retryBody':
    'No se ha perdido nada. Revisa tu conexión e inténtalo otra vez.',
  'role.owner': 'Propietario',
  'role.admin': 'Administrador',
  'role.member': 'Miembro',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Predeterminado — {value}',
  'regional.currency.AUD': 'dólar australiano',
  'regional.currency.CAD': 'dólar canadiense',
  'regional.currency.CHF': 'franco suizo',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'libra esterlina',
  'regional.currency.JPY': 'yen japonés',
  'regional.currency.PLN': 'zloty polaco',
  'regional.currency.SEK': 'corona sueca',
  'regional.currency.USD': 'dólar estadounidense',
  'regional.distance.metric': 'Kilómetros',
  'regional.distance.imperial': 'Millas',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Tu perfil no se ha cargado',
  'profile.account.title': 'Tu cuenta',
  'profile.account.description':
    'Tu nombre y tu correo vienen de la cuenta con la que entras.',
  'profile.email.verified': 'Correo verificado',
  'profile.email.unverified': 'Correo sin verificar',
  'profile.twoFactor.on': 'Dos pasos activados',
  'profile.figure.workspace': 'Espacio de trabajo',
  'profile.figure.role': 'Rol',
  'profile.figure.joined': 'Miembro desde',
  'profile.figure.joinedUnknown': 'Sin registrar',
  'profile.regional.title': 'Fechas, dinero y unidades',
  'profile.regional.description':
    'Esto sustituye los valores del espacio de trabajo solo para ti. Si dejas uno como está, sigue al espacio.',
  'profile.regional.saving': 'Guardando tus preferencias',
  'profile.regional.saved': 'Tus preferencias están guardadas',
  'profile.regional.saveFailed': 'Tus preferencias no se han guardado',
  'profile.language.label': 'Idioma',
  'profile.language.hint':
    'Se elige en su propia pantalla, donde cada idioma está escrito en su propia grafía.',
  'profile.language.action': 'Cambiar',
  'profile.timezone.label': 'Zona horaria',
  'profile.timezone.hint':
    'Las horas de salida y de llegada se muestran con esta zona.',
  'profile.currency.label': 'Moneda',
  'profile.currency.hint':
    'Los viajes nuevos empiezan con esta moneda; cada viaje puede cambiarla.',
  'profile.dateFormat.label': 'Formato de fecha',
  'profile.weekStart.label': 'La semana empieza en',
  'profile.weekStart.hint':
    'Vale para todos los calendarios, incluida la rejilla anual de vacaciones.',
  'profile.distance.label': 'Distancia',

  /* --------------------------------------------------------------- language */
  'language.error': 'Tus ajustes de idioma no se han cargado',
  'language.section.title': 'Idioma',
  'language.section.description':
    'Cada pantalla, cada botón y cada fecha se leen en el idioma que elijas aquí: veintitrés, y cada uno escrito en su propia grafía.',
  'language.label': 'Elige un idioma',
  'language.followWorkspace': 'Seguir al espacio de trabajo',
  'language.state.yours': 'Tu idioma',
  'language.state.workspace': 'Lo pone el espacio de trabajo',
  'language.state.hint.override':
    'Es tu elección. Vale solo para ti, en todos los dispositivos desde los que entres.',
  'language.state.hint.workspace':
    'No tienes un idioma propio, así que lees el que tenga puesto el espacio de trabajo. Un propietario o un administrador puede cambiarlo en Espacio de trabajo.',
  'language.saved': 'planned.travel ya habla {language}',
  'language.saveFailed': 'Tu idioma no ha cambiado',
  'language.saveFailedBody':
    'No se ha perdido nada y sigues leyendo {language}. Revisa tu conexión y vuelve a elegir.',
  'language.reload.title': 'Tu idioma está guardado',
  'language.reload.body':
    'Esta página no ha podido terminar de cambiar a {language}. Recárgala para leer el producto en tu idioma nuevo.',
  'language.sample.title': 'Cómo se leerán las fechas y los números',
  'language.sample.description':
    'Los mismos tres valores, escritos como los escribe este idioma.',
  'language.sample.date': 'Una fecha',
  'language.sample.number': 'Un número',
  'language.sample.money': 'Un importe',
  'language.legal':
    'Las condiciones y el aviso de privacidad se publican solo en inglés. Todo lo demás del producto está traducido.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'La apariencia no se ha cargado',
  'appearance.theme.title': 'Tema',
  'appearance.theme.description':
    'Los dos temas están diseñados, no invertidos. Elige el que leas más a gusto.',
  'appearance.theme.light': 'Claro',
  'appearance.theme.lightHint': 'Papel cálido, todo el día',
  'appearance.theme.dark': 'Oscuro',
  'appearance.theme.darkHint': 'Carbón cálido, nunca negro',
  'appearance.theme.system': 'Sistema',
  'appearance.theme.systemHint': 'Seguir al dispositivo',
  'appearance.theme.showing': 'Ahora se ve la paleta {palette}.',
  'appearance.theme.showingSystem':
    'Ahora se ve la paleta {palette}, siguiendo a tu dispositivo.',
  'appearance.palette.light': 'clara',
  'appearance.palette.dark': 'oscura',
  'appearance.motion.title': 'Movimiento y mapas',
  'appearance.motion.label': 'Reducir el movimiento',
  'appearance.motion.hint':
    'Convierte las animaciones de entrada en un simple fundido. El ajuste de reducción de movimiento de tu sistema operativo se respeta siempre.',
  'appearance.map.label': 'Estilo del mapa',
  'appearance.map.hint': 'El mapa base del planificador y del mapa del mundo.',
  'appearance.map.workspace': 'Seguir al espacio de trabajo',
  'appearance.map.workspaceHint':
    'Lo que haya elegido el propietario del espacio de trabajo.',
  'appearance.map.auto': 'Automático',
  'appearance.map.autoHint': 'Sigue tu tema claro u oscuro.',
  'appearance.map.paper': 'Papel',
  'appearance.map.paperHint': 'Cálido y claro, sea cual sea tu tema.',
  'appearance.map.charcoal': 'Carbón',
  'appearance.map.charcoalHint': 'Cálido y oscuro, sea cual sea tu tema.',
  'appearance.map.quiet': 'Discreto',
  'appearance.map.quietHint':
    'Sin nombres de calles, para que tus chinchetas se lean primero.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'En una pantalla compartida',
  'appearance.privacy.codesLabel':
    'Ocultar los códigos de confirmación hasta que los pida',
  'appearance.privacy.codesHint':
    'Las referencias de reserva y los números de confirmación quedan enmascarados en el escritorio de reservas y en los transportes hasta que hagas clic en ellos o los toques, y vuelven a enmascararse cuando pasas a otra cosa. Los precios no se ocultan nunca.',
  'appearance.saveFailed': 'Ese cambio no se ha guardado',
  'appearance.saveFailedBody':
    'Aquí se ve, pero el próximo dispositivo desde el que entres no lo tendrá.',

  /* --------------------------------------------------------------- security */
  'security.error': 'La seguridad no se ha cargado',
  'security.unverified.title':
    'Tu correo electrónico todavía no está verificado',
  'security.unverified.body':
    'Los cambios de contraseña y las invitaciones a viajes se envían a {email}. Verificarlo es lo que demuestra que la dirección es tuya.',
  'security.unverified.action': 'Enviar el enlace otra vez',
  'security.signin.title': 'Acceso',
  'security.signin.description':
    'Cómo demuestras que eres tú. Los dos pasos y las claves de acceso son más fuertes que una contraseña sola.',
  'security.email.label': 'Correo electrónico',
  'security.email.verified': 'Verificado',
  'security.email.unverified': 'Sin verificar',
  'security.password.label': 'Contraseña',
  'security.password.hint':
    'Cámbiala cuando quieras: te enviaremos un enlace de un solo uso en vez de pedirte la anterior.',
  'security.password.action': 'Cambiar la contraseña',
  'security.twoFactor.label': 'Verificación en dos pasos',
  'security.twoFactor.onHint':
    'En cada acceso nuevo hace falta un código de tu aplicación de autenticación.',
  'security.twoFactor.offHint':
    'Añade un código de seis dígitos de una aplicación de autenticación por encima de la contraseña.',
  'security.twoFactor.on': 'Activada',
  'security.twoFactor.off': 'Desactivada',
  'security.twoFactor.manage': 'Gestionar',
  'security.twoFactor.enable': 'Activar',
  'security.passkeys.label': 'Claves de acceso',
  'security.passkeys.hint':
    'Entra con la huella, con Face ID o con una llave de seguridad, sin escribir nada.',
  'security.passkeys.action': 'Gestionar las claves',
  'security.session.title': 'Esta sesión',
  'security.session.description': 'El navegador en el que lees esto.',
  'security.session.label': 'Sesión iniciada como',
  'security.session.expires': 'Caduca {date}',
  'security.session.expiresSoon': 'pronto',
  'security.session.noExpiry': 'Sin caducidad registrada',
  'security.signOut.label': 'Cerrar sesión',
  'security.signOut.hint':
    'Termina esta sesión y te devuelve a la pantalla de acceso. Los demás dispositivos siguen dentro.',
  'security.signOut.pending': 'Cerrando la sesión',
  'security.signOut.failed': 'No se ha cerrado tu sesión',
  'security.signOut.failedBody': 'Revisa tu conexión e inténtalo otra vez.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Los ajustes de notificaciones no se han cargado',
  'notifications.title': 'Notificaciones',
  'notifications.description':
    'Cada interruptor vale solo para ti. Apagar uno nunca impide que la cosa pase: solo impide que te la contemos.',
  'notifications.caption': 'Qué notificaciones llegan a cada canal',
  'notifications.event': 'Evento',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Esa preferencia no se ha guardado',
  'notifications.saveFailedBody':
    'Hemos devuelto el interruptor a su sitio. Revisa tu conexión e inténtalo otra vez.',
  'notifications.channel.in_app': 'En la aplicación',
  'notifications.channel.in_app.hint': 'La campana de la barra superior',
  'notifications.channel.email': 'Correo',
  'notifications.channel.email.hint': 'A la dirección con la que entras',
  'notifications.channel.push': 'Aviso al móvil',
  'notifications.channel.push.hint':
    'En los dispositivos donde lo has permitido',
  'notifications.event.trip.invited': 'Invitaciones a viajes',
  'notifications.event.trip.invited.hint':
    'Alguien te añade a un viaje que está preparando.',
  'notifications.event.trip.updated': 'Cambios en el plan',
  'notifications.event.trip.updated.hint':
    'Se mueve un día, una parada o una fecha de un viaje en el que estás.',
  'notifications.event.trip.starting_soon': 'Recordatorios de salida',
  'notifications.event.trip.starting_soon.hint':
    'Un aviso en los días previos a un viaje.',
  'notifications.event.reservation.reminder': 'Recordatorios de reservas',
  'notifications.event.reservation.reminder.hint':
    'Se acerca un alojamiento, una mesa o una entrada.',
  'notifications.event.expense.added': 'Gastos nuevos',
  'notifications.event.expense.added.hint':
    'Alguien apunta dinero gastado en un viaje compartido.',
  'notifications.event.expense.settled': 'Cuentas saldadas',
  'notifications.event.expense.settled.hint':
    'Se ha pagado un saldo del que formabas parte.',
  'notifications.event.list.assigned': 'Tareas asignadas',
  'notifications.event.list.assigned.hint':
    'Algo de una lista de equipaje o de tareas pasa a ser tuyo.',
  'notifications.event.collab.message': 'Conversación del viaje',
  'notifications.event.collab.message.hint':
    'Mensajes nuevos en un viaje en el que participas.',
  'notifications.event.organization.invited': 'Invitaciones a espacios',
  'notifications.event.organization.invited.hint':
    'Te invitan a un espacio de trabajo.',

  'notifications.event.billing.plan_changed': 'Cambios de suscripción',
  'notifications.event.billing.plan_changed.hint':
    'Tu espacio de trabajo cambia de plan.',
  'notifications.event.billing.invoice_paid': 'Recibos de pago',
  'notifications.event.billing.invoice_paid.hint':
    'Se ha pagado una factura de tu espacio de trabajo.',
  'notifications.event.billing.payment_failed': 'Problemas de pago',
  'notifications.event.billing.payment_failed.hint':
    'Un cobro de tu espacio de trabajo no se ha completado.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'El espacio de trabajo no se ha cargado',
  'workspace.summary.description': 'Plan {plan} · creado el {date}',
  'workspace.summary.createdRecently': 'hace poco',
  'workspace.summary.billingAction': 'Plan y facturación',
  'workspace.seats.label': 'Plazas usadas',
  'workspace.seats.value': '{used} de {limit}',
  'workspace.seats.note':
    'Las invitaciones pendientes ocupan plaza, así que un espacio nunca puede pasarse del plan que paga.',
  'workspace.seatsFull.title': 'Todas las plazas de este plan están ocupadas',
  'workspace.seatsFull.body':
    '{members} y {invitations} llenan las {limit} plazas.',
  'workspace.seatsFull.action': 'Añadir plazas',
  'workspace.members.count': {
    one: '{value} miembro',
    many: '{value} miembros',
    other: '{value} miembros',
  },
  'workspace.invitations.count': {
    one: '{value} invitación pendiente',
    many: '{value} invitaciones pendientes',
    other: '{value} invitaciones pendientes',
  },
  'workspace.members.title': 'Miembros',
  'workspace.members.description':
    'Todo el mundo que ve los viajes, el dinero y los archivos de este espacio.',
  'workspace.members.tableLabel': 'Miembros de este espacio de trabajo',
  'workspace.members.person': 'Persona',
  'workspace.members.role': 'Rol',
  'workspace.members.joined': 'Se unió',
  'workspace.invitations.title': 'Invitaciones',
  'workspace.invitations.description':
    'Personas invitadas que todavía no han entrado.',
  'workspace.invitations.emptyTitle': 'No hay invitaciones pendientes',
  'workspace.invitations.emptyBody':
    'Todo el mundo a quien se invitó a este espacio ya ha entrado.',
  'workspace.invitations.expires': 'Caduca {date}',
  'workspace.invitations.expiresSoon': 'pronto',
  'workspace.defaults.title': 'Valores comunes',
  'workspace.defaults.description':
    'Con qué empiezan un viaje nuevo y un miembro nuevo. Cualquiera puede cambiarlos para sí mismo en su perfil.',
  'workspace.defaults.readOnly': 'Solo lectura',
  'workspace.defaults.saving': 'Guardando los valores del espacio',
  'workspace.defaults.saved': 'Los valores del espacio están guardados',
  'workspace.defaults.saveFailed': 'Los valores del espacio no se han guardado',
  'workspace.defaults.saveFailedBody':
    'Solo un propietario o un administrador puede cambiarlos. Revisa tu conexión y vuelve a intentarlo.',
  'workspace.currency.label': 'Moneda por defecto',
  'workspace.currency.hint': 'Los viajes nuevos se presupuestan en esta.',
  'workspace.language.label': 'Idioma',
  'workspace.language.hint': 'Lo que lee quien no ha elegido un idioma propio.',
  'workspace.timezone.label': 'Zona horaria',
  'workspace.dateFormat.label': 'Formato de fecha',
  'workspace.weekStart.label': 'La semana empieza en',
  'workspace.distance.label': 'Distancia',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'La facturación no se ha cargado',
  'billing.loading': 'Cargando el plan y sus recibos',
  'billing.status.none': 'Sin suscripción',
  'billing.status.trialing': 'Prueba',
  'billing.status.active': 'Activa',
  'billing.status.past_due': 'Pago fallido',
  'billing.status.unpaid': 'Sin pagar',
  'billing.status.paused': 'En pausa',
  'billing.status.canceled': 'Cancelada',
  'billing.status.incomplete': 'Incompleta',
  'billing.status.incomplete_expired': 'Caducada',

  'billing.checkout.completeTitle': 'Pago recibido',
  'billing.checkout.completeBody':
    'Tu plan nuevo se está aplicando. Aparece aquí en cuanto Polar lo confirma, normalmente en unos segundos.',
  'billing.checkout.cancelledTitle': 'Pago cancelado',
  'billing.checkout.cancelledBody':
    'No se ha cobrado nada y tu plan no ha cambiado.',
  'billing.portal.backTitle': 'De vuelta desde Polar',
  'billing.portal.backBody':
    'Lo que hayas cambiado allí llega aquí en cuanto Polar lo confirma.',
  'billing.refresh': 'Actualizar',
  'billing.readOnly.title': 'Eres miembro de este espacio de trabajo',
  'billing.readOnly.body':
    'Solo un propietario o un administrador puede cambiar la suscripción. Para ti, todo lo de abajo es de solo lectura.',

  'billing.hero.label': 'Plan actual',
  'billing.hero.endsAtPeriod': 'Termina al cerrar el periodo',
  'billing.hero.perYear': '/ año',
  'billing.hero.perMonth': '/ mes',
  'billing.hero.freeAllowance': '{trips} viajes, un viajero',
  'billing.hero.perSeatLine': '{seats} miembros × {price}',
  'billing.hero.singleTraveller': 'Un viajero',
  'billing.price.free': 'Gratis',
  'billing.provider.opening': 'Abriendo Polar',
  'billing.renewal.trialEndsToday':
    'Tu prueba termina hoy. El primer cargo llega después, salvo que canceles antes.',
  'billing.renewal.trialEndsIn': {
    one: 'Tu prueba termina en {value} día y después llega el primer cargo, salvo que canceles antes.',
    many: 'Tu prueba termina en {value} días y después llega el primer cargo, salvo que canceles antes.',
    other:
      'Tu prueba termina en {value} días y después llega el primer cargo, salvo que canceles antes.',
  },
  'billing.renewal.trialEnded': 'Tu prueba ha terminado.',
  'billing.renewal.endsNoDate':
    'Este plan está previsto que termine y no se renovará.',
  'billing.renewal.endsOn':
    'Este plan termina el {date}. No se borra nada: los módulos de pago simplemente se cierran.',
  'billing.renewal.pastDue':
    'El último pago no ha salido bien. Actualiza la tarjeta para no perder los módulos de pago.',
  'billing.renewal.unpaid':
    'Esta suscripción está sin pagar y los módulos de pago están cerrados.',
  'billing.renewal.paused':
    'Esta suscripción está en pausa. Reanúdala cuando quieras volver a viajar.',
  'billing.renewal.lapsed':
    'Elige un plan de abajo para volver a abrir las reservas, el diario y los mapas sin conexión.',
  'billing.renewal.incomplete':
    'Polar todavía espera la confirmación de este pago.',
  'billing.renewal.free':
    'Dos viajes a la vez, por la cara. Mejora el plan cuando se te quede pequeño.',
  'billing.renewal.auto': 'Se renueva solo.',
  'billing.renewal.renewsOn': 'Se renueva el {date}.',

  'billing.usage.title': 'Uso',
  'billing.usage.description':
    'Se cuenta en vivo, así que ningún medidor está desfasado. Los límites siguen al plan que esté en vigor ahora mismo.',
  'billing.quota.seats': 'Miembros',
  'billing.quota.trips': 'Viajes',
  'billing.quota.storageBytes': 'Almacenamiento',
  'billing.quota.unlimited': 'Sin límite',
  'billing.quota.noLimit': 'Este plan no pone límite',
  'billing.quota.used': '{quota} en uso',
  'billing.quota.over.seats': {
    one: '{value} plaza por encima del límite de este plan',
    many: '{value} plazas por encima del límite de este plan',
    other: '{value} plazas por encima del límite de este plan',
  },
  'billing.quota.over.trips': {
    one: '{value} hueco de viaje por encima del límite de este plan',
    many: '{value} huecos de viaje por encima del límite de este plan',
    other: '{value} huecos de viaje por encima del límite de este plan',
  },
  'billing.quota.over.storage': '{value} por encima del límite de este plan',
  'billing.quota.exhausted.seats':
    'Todas las plazas de este plan están ocupadas',
  'billing.quota.exhausted.trips':
    'Todos los huecos de viaje de este plan están en uso',
  'billing.quota.exhausted.storage':
    'El almacenamiento de este plan está lleno',
  'billing.quota.left': 'Queda {value}',

  'billing.plans.title': 'Planes',
  'billing.plans.description':
    'Cambia de plan cuando quieras. Las mejoras se prorratean al día; una bajada espera a que acabe el periodo que ya has pagado.',
  'billing.interval.label': 'Periodo de facturación',
  'billing.interval.monthly': 'Mensual',
  'billing.interval.yearly': 'Anual',
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Prepara tus dos próximos viajes',
  'billing.plan.free.feature.trips': 'Dos viajes a la vez',
  'billing.plan.free.feature.itinerary': 'Itinerario día a día y mapa',
  'billing.plan.free.feature.lists':
    'Listas de equipaje y presupuestos sencillos',
  'billing.plan.free.feature.atlas':
    'El mapa del mundo que marca dónde has estado',
  'billing.plan.solo.name': 'En solitario',
  'billing.plan.solo.tagline': 'Para quien lo planea todo',
  'billing.plan.solo.feature.trips': 'Viajes sin límite',
  'billing.plan.solo.feature.modules':
    'Todos los módulos: reservas, diario, presupuestos y equipaje',
  'billing.plan.solo.feature.offline':
    'Mapas sin conexión que te descargas antes de volar',
  'billing.plan.solo.feature.export': 'Exportación a PDF y al calendario',
  'billing.plan.crew.name': 'Grupo',
  'billing.plan.crew.tagline': 'Para familias, amigos y equipos pequeños',
  'billing.plan.crew.feature.members':
    'Hasta diez miembros, con pago por persona',
  'billing.plan.crew.feature.realtime':
    'Colaboración en vivo, con los cursores de todos',
  'billing.plan.crew.feature.everything':
    'Viajes sin límite y todos los módulos',
  'billing.plan.crew.feature.storage':
    'Sitio compartido para las fotos y los documentos de todos',

  'billing.plan.current': 'Plan actual',
  'billing.plan.currentBadge': 'Actual',
  'billing.plan.popular': 'El más elegido',
  'billing.plan.switchYearly': 'Cambiar a anual',
  'billing.plan.switchMonthly': 'Cambiar a mensual',
  'billing.plan.upgradeTo': 'Mejorar a {plan}',
  'billing.plan.changeTo': 'Cambiar a {plan}',
  'billing.plan.perMemberMonth': '/ miembro / mes',
  'billing.plan.perMonth': '/ mes',
  'billing.plan.alwaysFree': 'Siempre gratis, sin tarjeta',
  'billing.plan.billedYearly': '{amount} al año',
  'billing.plan.billedMonthly': '{amount} al mes',
  'billing.plan.members': 'Miembros',
  'billing.plan.membersHint': 'Cámbialo cuando quieras: la factura lo sigue.',
  'billing.plan.seatOption': {
    one: '{value} miembro',
    many: '{value} miembros',
    other: '{value} miembros',
  },

  'billing.invoices.number': 'Factura',
  'billing.invoices.date': 'Fecha',
  'billing.invoices.amount': 'Importe',
  'billing.invoices.status': 'Estado',
  'billing.invoice.paid': 'Pagada',
  'billing.invoice.draft': 'Borrador',
  'billing.invoice.void': 'Anulada',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'El proveedor de pagos rechazó esa solicitud. Inténtalo de nuevo en un momento.',
  'billing.planChanged.title': 'Plan actualizado',
  'billing.planChanged.body':
    'El cambio ya está en vigor en Polar, que facturará la diferencia. El resumen de abajo se pone al día en un minuto.',
  'billing.discount.toggle': '¿Tienes un código promocional?',
  'billing.discount.label': 'Código promocional',
  'billing.discount.hint': 'Se aplicará al plan que elijas a continuación.',
  'billing.discount.hintCurrent':
    'Aplícalo a tu plan actual o elige un plan a continuación.',
  'billing.discount.applyCurrent': 'Aplicar al plan actual',
  'billing.discount.applying': 'Aplicando el código…',
  'billing.discount.invalidFormat':
    'Los códigos tienen de 3 a 64 letras y cifras.',
  'billing.discount.rejected.invalid':
    'Ese código no es válido. Revísalo e inténtalo de nuevo.',
  'billing.discount.rejected.rateLimited':
    'Demasiados códigos probados. Inténtalo de nuevo dentro de una hora.',
  'billing.discount.rejected.notApplicable':
    'Ese código no se aplica a este plan.',
  'billing.discount.rejected.busy':
    'Ahora no se pueden comprobar los códigos. Inténtalo de nuevo dentro de un minuto.',
  'billing.discount.nextRenewal':
    'Tu código promocional se aplica a partir de tu próxima renovación.',
  'billing.discount.appliedTitle': 'Código promocional aplicado',
  'billing.hero.manage': 'Gestionar la facturación',
  'billing.hero.manageHint':
    'Las tarjetas, la dirección de facturación, el NIF, los recibos y la cancelación están en Polar, que emite la factura.',
  'billing.hero.manageHintNone':
    'Todavía no hay perfil de facturación. Al elegir un plan de pago abajo se crea uno, y a partir de entonces el portal se abre.',
  'billing.portal.opening': 'Abriendo el portal de facturación',
  'billing.plan.notApplied': 'Ese cambio no se aplicó',
  'billing.plan.cancelInPortal': 'Cancelar en el portal',
  'billing.plan.seatsOverMax': {
    one: 'Este espacio tiene {members} miembros y {plan} factura {max} como máximo. Quita {value} miembro antes de cambiar.',
    many: 'Este espacio tiene {members} miembros y {plan} factura {max} como máximo. Quita {value} miembros antes de cambiar.',
    other:
      'Este espacio tiene {members} miembros y {plan} factura {max} como máximo. Quita {value} miembros antes de cambiar.',
  },
  'billing.plan.seatsBelowMembers':
    'Tienes {members} miembros. Elige al menos esas plazas: Polar rechaza una suscripción con menos plazas que asignaciones.',
  'billing.orders.title': 'Pedidos',
  'billing.orders.description':
    'Todos los pedidos de este espacio, del más reciente al más antiguo.',
  'billing.orders.receipts': 'Todos los recibos',
  'billing.orders.unavailableTitle': 'Los pedidos no se cargan',
  'billing.orders.unavailableBody':
    'Polar no respondió a tiempo para el historial. Todo lo de arriba está al día: inténtalo en un momento o consulta el registro completo en el portal de facturación.',
  'billing.orders.emptyTitle': 'Todavía no hay pedidos',
  'billing.orders.emptyCustomer':
    'La primera factura aparece aquí en cuanto se cierra un periodo de facturación.',
  'billing.orders.emptyNoCustomer':
    'A este espacio nunca se le ha cobrado. Elige un plan de pago y las facturas se irán reuniendo aquí.',
  'billing.orders.tableLabel': 'Historial de pedidos',
  'billing.orders.document': 'Documento',
  'billing.orders.dateUnknown': 'Fecha desconocida',
  'billing.order.pending': 'Pendiente',
  'billing.order.refunded': 'Reembolsado',
  'billing.order.partiallyRefunded': 'Reembolsado en parte',
  'billing.order.noInvoiceDraft':
    'Sin factura mientras el pedido sea un borrador',
  'billing.order.preparing': 'Preparando',
  'billing.order.renderingHint':
    'Polar sigue generando la factura {number}. La descarga vuelve en unos segundos.',
  'billing.order.fetching': 'Obteniendo la factura',
  'billing.order.generating': 'Polar está preparando la factura',
  'billing.order.pdfLabel': 'Factura {number} en PDF',
  'billing.order.stillWritingTitle': 'Polar sigue redactando esa factura',
  'billing.order.stillWritingBody':
    'La factura {number} se está generando. La descarga vuelve por sí sola en unos segundos.',
  'billing.order.openFailed': 'Esa factura no se abrió',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Cuenta',
  'passkeys.page.title': 'Claves de acceso',
  'passkeys.page.description':
    'Una clave de acceso te permite entrar con tu huella, tu rostro o una llave de seguridad, sin escribir nada.',
  'passkeys.page.back': 'Volver a seguridad',
  'passkeys.list.label': 'Tus claves de acceso',
  'passkeys.add.action': 'Añadir una clave de acceso',
  'passkeys.add.loading': 'Esperando a tu dispositivo',
  'passkeys.add.added': 'Clave de acceso añadida',
  'passkeys.add.dismissed': 'No se añadió ninguna clave de acceso',
  'passkeys.add.exists':
    'Este dispositivo ya tiene una clave de acceso para tu cuenta',
  'passkeys.add.failed': 'No se añadió la clave de acceso. Inténtalo de nuevo.',
  'passkeys.add.stale':
    'Por tu seguridad, vuelve a iniciar sesión para continuar.',
  'passkeys.error.sessionEnded':
    'Tu sesión ha terminado. Vuelve a iniciar sesión para continuar.',
  'passkeys.signInAgain': 'Iniciar sesión de nuevo',
  'passkeys.add.limit':
    'Has alcanzado el límite de {value} claves de acceso. Elimina una para añadir otra.',
  'passkeys.add.unsupported':
    'Este navegador no puede crear claves de acceso. Prueba con otro navegador u otro dispositivo.',
  'passkeys.empty.title': 'Aún no hay claves de acceso',
  'passkeys.empty.body':
    'Añade una y podrás entrar con tu huella, tu rostro o una llave de seguridad, sin escribir nada.',
  'passkeys.row.fallbackName': 'Clave de acceso · añadida el {date}',
  'passkeys.row.added': 'Añadida el {date}',
  'passkeys.row.lastUsed': 'Último uso: {date}',
  'passkeys.row.neverUsed': 'Aún no se ha usado para entrar',
  'passkeys.badge.synced': 'Sincronizada',
  'passkeys.badge.singleDevice': 'Solo en un dispositivo',
  'passkeys.error.title': 'No se cargaron tus claves de acceso',
  'passkeys.error.retry': 'Reintentar',
  'passkeys.error.rateLimited':
    'Demasiados intentos. Inténtalo de nuevo en unos minutos.',
  'passkeys.error.generic': 'Comprueba tu conexión e inténtalo de nuevo.',
} satisfies TranslationOf<typeof En>

export default messages
