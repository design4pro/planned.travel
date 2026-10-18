/**
 * Todo lo que dice la consola de la plataforma, en español.
 *
 * Escrito a partir de `../en/console.ts` (`docs/SPEC.md` §9). El archivo inglés es el esquema:
 * `TranslationOf<typeof En>` convierte una clave ausente o inventada en un error de compilación, y
 * `__tests__/parity.test.ts` comprueba los sustitutos, las ramas de plural y que aquí no quede
 * nada en inglés.
 *
 * **Registro.** «Tú», como en el resto del catálogo español.
 *
 * **Plural.** `Intl.PluralRules('es')` anuncia `one`, `many` y `other`; `many` es la rama CLDR de
 * los millones y se concuerda igual que `other`.
 *
 * **Dos escalas de roles que nunca se mezclan** (§5). En la plataforma: administrador, curador,
 * usuario. En el espacio de trabajo: propietario, administrador, miembro. La misma palabra cae en
 * las dos, así que la diferencia la lleva la frase de alrededor.
 *
 * **`audit.value.yes` y `audit.value.no` se escriben «verdadero» y «falso».** Son el valor de un
 * campo booleano del registro de auditoría — «Correo verificado  falso → verdadero» — y ese par
 * dice lo mismo que el inglés sin obligar a leer un «no» suelto entre dos flechas.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------ secciones -- */

  'nav.label': 'Secciones de la consola',
  'nav.overview': 'Resumen',
  'nav.overview.description': 'La plataforma de un vistazo',
  'nav.accounts': 'Cuentas',
  'nav.accounts.description': 'Roles, suspensiones y sesiones',
  'nav.runs': 'Ejecuciones de agentes',
  'nav.runs.description': 'Qué está construyendo la flota sandcastle',

  /* -------------------------------------------------------------- armazón -- */

  'shell.eyebrow': 'Plataforma',
  'shell.title': 'Consola',
  'shell.description':
    'El producto en sí — cuentas, potestades y el catálogo común',
  'shell.signedInAs': 'Sesión iniciada como',
  'shell.error.title': 'La consola no se cargó',
  'shell.notFound.title': 'No existe esa cuenta',
  'shell.notFound.body':
    'Nada en la plataforma lleva ese identificador. Puede que la cuenta se haya borrado desde que se creó el enlace, o que la dirección esté mal escrita.',
  'shell.allAccounts': 'Todas las cuentas',
  'shell.overview': 'Resumen de la consola',

  'failure.fallback': 'La acción no salió adelante. Inténtalo en un momento.',

  /* -------------------------------------------------------------- resumen -- */

  'overview.error.title': 'El resumen no se cargó',
  'overview.standing.title': 'Tus potestades en la plataforma',
  'overview.standing.body':
    'Las cuentas, las sesiones y actuar en nombre de otra persona son de un administrador de la plataforma, así que la consola te enseña el catálogo y nada más.',
  'overview.stat.accounts': 'Cuentas',
  'overview.stat.accounts.caption': {
    one: 'Una de ellas tiene un rol de plataforma',
    many: '{staff} de ellas tienen un rol de plataforma',
    other: '{staff} de ellas tienen un rol de plataforma',
  },
  'overview.stat.admins': 'Administradores',
  'overview.stat.admins.caption': 'Potestad completa sobre cuentas y sesiones',
  'overview.stat.curators': 'Curadores',
  'overview.stat.curators.caption': 'Solo el catálogo — nunca las cuentas',
  'overview.stat.suspended': 'Suspendidas',
  'overview.stat.suspended.none': 'Nadie está fuera',
  'overview.stat.suspended.some':
    'Con la sesión cerrada en todas partes hasta que se levante la suspensión',
  'overview.stat.suspended.review': 'Revisarlas',
  'overview.newest.label': 'Cuentas más recientes',
  'overview.newest.empty.title': 'Todavía no hay cuentas',
  'overview.newest.empty.body':
    'La primera persona que se registre aparecerá aquí.',
  'overview.catalogue.label': 'Catálogo por estado',
  'overview.catalogue.empty.title': 'El catálogo común aún no está abierto',
  'overview.catalogue.empty.body':
    'En cuanto aterrice la cadena de ingesta, este panel contará cada lugar del catálogo común como borrador, en revisión o publicado — y cada cifra abrirá la lista que hay detrás.',
  'overview.scraping.label': 'Pasadas de recolección',
  'overview.scraping.empty.title': 'No se ha ejecutado ninguna fuente',
  'overview.scraping.empty.body':
    'Las fuentes se recolectan cada semana. Cuando termine la primera pasada, aquí estarán las cinco últimas con lo que cada una ingirió, cambió y descartó.',

  /* --------------------------------------------------- la escala de roles -- */

  'role.admin': 'Administrador',
  'role.admin.summary':
    'Potestad completa en la plataforma: cuentas, roles, suspensiones, sesiones y actuar en nombre de otra persona.',
  'role.admin.holds.accounts': 'Crear cuentas y fijar roles de plataforma',
  'role.admin.holds.bans': 'Suspender cuentas y levantar suspensiones',
  'role.admin.holds.sessions': 'Revocar sesiones y fijar contraseñas',
  'role.admin.holds.impersonate':
    'Actuar en nombre de una cuenta durante quince minutos',
  'role.admin.holds.curation': 'Todo lo que puede hacer un curador',
  'role.admin.withheld.admins':
    'Actuar en nombre de otro administrador de la plataforma',
  'role.curator': 'Curador',
  'role.curator.summary':
    'El catálogo, las colecciones, las fuentes y la moderación de enlaces compartidos. Nada que toque las cuentas.',
  'role.curator.holds.places': 'Leer, escribir y publicar lugares del catálogo',
  'role.curator.holds.packs':
    'Leer, escribir y publicar colecciones de lugares',
  'role.curator.holds.sources': 'Leer y ejecutar fuentes del catálogo',
  'role.curator.holds.shares': 'Revisar y revocar enlaces compartidos',
  'role.curator.withheld.accounts':
    'Cualquier cosa que toque una cuenta o una sesión',
  'role.curator.withheld.tokens': 'Emitir o revocar credenciales de máquina',
  'role.user': 'Usuario',
  'role.user.summary':
    'Ninguna potestad en la plataforma. Es casi todo el mundo.',
  'role.user.withheld.everything':
    'Toda potestad de la plataforma, sin excepción',

  /* ---------------------------------------------------------- una cuenta -- */

  'identity.you': 'Eres tú',
  'status.active': 'Activa',
  'status.suspended': 'Suspendida',
  'status.permanent': 'Indefinida',
  'status.until': 'Hasta el {date}',
  'status.unverified': 'Sin verificar',
  'device.on': '{browser} en {platform}',
  'device.unrecognised': 'Dispositivo desconocido',

  /* ---------------------------------------------------- lista de cuentas -- */

  'users.error.title': 'La lista de cuentas no se cargó',
  'users.total': '{total} en total',
  'users.loading': 'Cargando cuentas',
  'users.table.label': 'Cuentas de la plataforma',
  'users.search.label': 'Buscar cuentas',
  'users.search.email': 'Buscar en las direcciones de correo',
  'users.search.name': 'Buscar en los nombres',
  'users.search.column': 'En qué columna buscar',
  'users.search.submit': 'Buscar',
  'users.field.email': 'Correo',
  'users.field.name': 'Nombre',
  'users.filter.role.label': 'Filtrar por rol de plataforma',
  'users.filter.role.any': 'Cualquier rol',
  'users.filter.role.admin': 'Administradores',
  'users.filter.role.curator': 'Curadores',
  'users.filter.status.label': 'Filtrar por estado de la cuenta',
  'users.filter.status.any': 'Cualquier estado',
  'users.filter.hint': 'Acota por rol o por estado — de uno en uno.',
  'users.column.account': 'Cuenta',
  'users.column.role': 'Rol de plataforma',
  'users.column.status': 'Estado',
  'users.column.joined': 'Alta',
  'users.column.actions': 'Acciones',
  'users.joined': 'Alta el {date}',
  'users.pastEnd.title': 'Esa página queda pasado el final',
  'users.pastEnd.body': {
    one: 'En esta vista hay una cuenta, y la página 1 es la única que tiene.',
    many: 'En esta vista hay {total} cuentas, o sea {pages}. La página {page} queda más allá.',
    other:
      'En esta vista hay {total} cuentas, o sea {pages}. La página {page} queda más allá.',
  },
  'users.pastEnd.pages': {
    one: 'una sola página',
    many: '{pages} páginas',
    other: '{pages} páginas',
  },
  'users.pastEnd.back': 'Volver a la primera página',
  'users.empty.filtered.title': 'Nada encaja con esos filtros',
  'users.empty.filtered.body':
    'Ninguna cuenta de la plataforma responde a esta búsqueda. Amplíala, o borra los filtros para verlas todas.',
  'users.empty.title': 'No hay cuentas que mostrar',
  'users.empty.body':
    'Esta vista está vacía. No hay nada filtrado, así que aquí no hay nada que ampliar.',

  /* ------------------------------------------------------ ficha de cuenta -- */

  'account.error.title': 'Esa cuenta no se cargó',
  'account.loading': 'Cargando la cuenta',
  'account.meta.lastChange': 'Último cambio',
  'account.meta.id': 'Identificador de la cuenta',
  'account.banned.title': 'Esta cuenta está suspendida',
  'account.banned.noReason': 'No se anotó ningún motivo con la suspensión.',
  'account.banned.permanent':
    ' Sigue en vigor hasta que un administrador la levante.',
  'account.banned.until': ' Se levanta sola el {date}.',
  'account.banned.untilUnknown': 'su fecha de vencimiento',
  'account.authority.label': 'Potestad en la plataforma',
  'account.authority.may': 'Puede',
  'account.authority.mayNot': 'No puede',
  'account.authority.none': 'Nada en la plataforma.',
  'account.workspaces.label': 'Espacios de trabajo',
  'account.workspaces.truncated':
    'Esta cuenta pertenece a más espacios de trabajo que los {listed} que se enumeran aquí.',
  'account.workspaces.empty.title': 'En ningún espacio de trabajo',
  'account.workspaces.empty.body':
    'Esta cuenta todavía no pertenece a ningún espacio de trabajo. Se le crea uno la primera vez que inicia sesión, y cualquiera al que la inviten aparecerá aquí.',
  'account.workspaces.column.workspace': 'Espacio de trabajo',
  'account.workspaces.column.role': 'Rol',
  'account.workspaces.column.plan': 'Tarifa',
  'account.subscription.label': 'Suscripción',
  'account.subscription.free.title': 'En la tarifa gratuita',
  'account.subscription.free.body':
    'El espacio de trabajo que posee esta cuenta nunca ha pasado por la caja, así que no lleva registro de suscripción y funciona con los cupos de la tarifa gratuita.',
  'account.subscription.none.title': 'A esta cuenta no se le cobra nada',
  'account.subscription.none.body':
    'Esta cuenta no posee ningún espacio de trabajo. Ser miembro del espacio de otra persona no es ser a quien ese espacio le factura, así que aquí no hay nada que recoger.',
  'account.subscription.endsAtClose': 'Termina al cerrar el periodo',
  'account.subscription.seats': 'Plazas',
  'account.subscription.seatsValue': '{used} de {limit}',
  'account.subscription.ends': 'Termina',
  'account.subscription.renews': 'Se renueva',
  'account.sessions.label': 'Sesiones vivas',
  'account.sessions.truncated':
    'Esta cuenta tiene más sesiones de las que enumera una llamada. Revoca todas las sesiones desde el menú de acciones para asegurarte de que no queda ninguna.',
  'account.sessions.empty.title': 'Con la sesión cerrada en todas partes',
  'account.sessions.empty.body':
    'Esta cuenta no tiene ninguna sesión sin caducar. Aparecerá aquí en cuanto vuelva a iniciar sesión.',
  'account.sessions.column.device': 'Dispositivo',
  'account.sessions.column.address': 'Dirección',
  'account.sessions.column.started': 'Inicio',
  'account.sessions.column.expires': 'Caduca',
  'account.sessions.impersonated': 'Nacida de actuar en nombre de la cuenta',
  'account.sessions.noAddress': 'Sin anotar',
  'account.sessions.noAddressLong': 'Dirección sin anotar',
  'account.sessions.when': 'Inicio {started} · caduca {expires}',
  'account.audit.label': 'Historial de auditoría',
  'account.audit.truncated':
    'El registro guarda más entradas que estas. El rastro de auditoría de la plataforma solo admite añadidos y se guarda cuatrocientos días.',
  'account.audit.empty.title': 'A esta cuenta no le han hecho nada',
  'account.audit.empty.body':
    'Cada cambio de rol, suspensión, contraseña fijada, sesión revocada y actuación en nombre de la cuenta se escribe aquí con el nombre de quien la hizo. A esta no la ha tocado nadie.',

  /* ------------------------------------- la escala del espacio de trabajo -- */

  'workspace.role.owner': 'Propietario',
  'workspace.role.admin': 'Administrador',
  'workspace.role.member': 'Miembro',
  'plan.free': 'Gratuita',
  'plan.starter': 'Inicial',
  'plan.pro': 'Profesional',
  'plan.business': 'Empresa',
  'subscription.trialing': 'En prueba',
  'subscription.active': 'Activa',
  'subscription.pastDue': 'Con pago vencido',
  'subscription.canceled': 'Cancelada',
  'subscription.incomplete': 'Incompleta',
  'subscription.expired': 'Caducada',
  'subscription.unpaid': 'Sin pagar',
  'subscription.paused': 'En pausa',

  /* -------------------------------------------------- registro de auditoría -- */

  'audit.action.created': 'Cuenta creada',
  'audit.action.updated': 'Datos de la cuenta cambiados',
  'audit.action.roleChanged': 'Rol de plataforma cambiado',
  'audit.action.banned': 'Cuenta suspendida',
  'audit.action.unbanned': 'Suspensión levantada',
  'audit.action.deleted': 'Cuenta borrada',
  'audit.action.passwordSet': 'Contraseña fijada por un administrador',
  'audit.action.emailSet': 'Dirección de correo cambiada',
  'audit.action.impersonationStarted':
    'Empieza a actuar en nombre de la cuenta',
  'audit.action.impersonationEnded': 'Deja de actuar en nombre de la cuenta',
  'audit.action.impersonationWorkspaceChanged':
    'Cambio de espacio mientras se actuaba en nombre de la cuenta',
  'audit.action.sessionRevoked': 'Se revocó una sesión',
  'audit.action.sessionRevokedAll': 'Se revocaron todas las sesiones',
  'audit.actor.system': 'La plataforma misma',
  'audit.actor.system.detail': 'automático',
  'audit.actor.agent': 'Una credencial de máquina',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Una cuenta borrada',
  'audit.actorBadge': 'Entonces: {role}',
  'audit.field.name': 'Nombre',
  'audit.field.email': 'Dirección de correo',
  'audit.field.emailVerified': 'Correo verificado',
  'audit.field.role': 'Rol de plataforma',
  'audit.field.banned': 'Suspendida',
  'audit.field.banReason': 'Motivo',
  'audit.field.banExpiresAt': 'Fin de la suspensión',
  'audit.field.revoked': 'Sesiones cerradas',
  'audit.field.impersonating': 'Actúa como',
  'audit.field.impersonatedBy': 'Actuada por',
  'audit.field.expiresAt': 'La sesión caduca',
  'audit.field.targetRole': 'Su rol de plataforma',
  'audit.field.sessionId': 'Sesión',
  'audit.field.organizationId': 'Espacio',
  'audit.value.yes': 'verdadero',
  'audit.value.no': 'falso',
  'audit.value.cleared': 'vaciado',
  'audit.became': 'pasó a ser',

  /* ------------------------------------------------------------- diálogos -- */

  'dialog.cancel': 'Cancelar',

  'create.button': 'Cuenta nueva',
  'create.title': 'Crear una cuenta',
  'create.body':
    'La dirección no se verifica y no sale ningún correo — entrega la contraseña tú mismo.',
  'create.confirm': 'Crear cuenta',
  'create.name.placeholder': 'Lucía Márquez',
  'create.email': 'Dirección de correo',
  'create.email.placeholder': 'lucia@planned.travel',
  'create.password': 'Contraseña',
  'create.password.hint':
    'Lo bastante larga para ser una frase. La cuenta podrá cambiarla después.',
  'create.done': 'Cuenta creada',
  'create.done.body':
    '{email} puede iniciar sesión con la contraseña que has fijado.',

  'action.menu.label': 'Acciones para {name}',
  'action.group.account': 'Cuenta',
  'action.group.credentials': 'Credenciales',

  'action.role.item': 'Cambiar el rol de plataforma',
  'action.role.self':
    'En tu propia cuenta no — degradarte a ti mismo puede dejar la plataforma sin administrador.',
  'action.role.body':
    'Lo que {name} puede hacer en la plataforma en sí. La pertenencia a un espacio de trabajo es un vocabulario aparte y no se mueve.',
  'action.role.confirm': 'Guardar el rol',
  'action.role.current': 'Actual',
  'action.role.done': 'Rol de plataforma actualizado',
  'action.role.done.body': '{name} tiene ahora el rol {role} en la plataforma.',

  'action.impersonate.item': 'Actuar en nombre de la cuenta',
  'action.impersonate.self':
    'No hay nadie en quien convertirse — esta es tu propia cuenta.',
  'action.impersonate.banned':
    'La cuenta está suspendida, así que no tiene ninguna sesión que ponerse.',
  'action.impersonate.admin':
    'Ningún rol de la plataforma puede actuar en nombre de un administrador, tampoco el tuyo.',
  'action.impersonate.title': 'Actuar como {name}',
  'action.impersonate.body':
    'Verás el producto exactamente como lo ve esta cuenta, durante quince minutos.',
  'action.impersonate.confirm': 'Empezar',
  'action.impersonate.note.bar':
    'Una barra de aviso se queda en todas las pantallas hasta que lo termines, y no se puede cerrar.',
  'action.impersonate.note.platform':
    'Las acciones de plataforma no están disponibles mientras actúas en nombre de otra persona — la consola incluida.',
  'action.impersonate.note.audit':
    'El principio y el final se escriben los dos en el rastro de auditoría de la plataforma, con tu nombre.',

  'action.password.item': 'Fijar una contraseña',
  'action.password.title': 'Fijar una contraseña para {name}',
  'action.password.body':
    'Úsalo para recuperar una cuenta bloqueada o para dejar fuera a un atacante en una cuenta comprometida.',
  'action.password.confirm': 'Fijar contraseña',
  'action.password.field': 'Contraseña nueva',
  'action.password.hint.self':
    'Al fijarla terminan todas las sesiones — la tuya también.',
  'action.password.hint':
    'Al fijarla terminan todas las sesiones que tenga la cuenta.',
  'action.password.done': 'Contraseña fijada',
  'action.password.done.body':
    'A {name} se le ha cerrado la sesión en todos sus dispositivos.',

  'action.sessions.item': 'Revocar todas las sesiones',
  'action.sessions.body.self':
    'Esto te cierra la sesión en todos los dispositivos, incluido aquel en el que estás leyendo esto.',
  'action.sessions.body':
    'A {name} se le cierra la sesión en todos los dispositivos y tendrá que volver a entrar.',
  'action.sessions.confirm': 'Revocar sesiones',
  'action.sessions.done': 'Sesiones revocadas',
  'action.sessions.done.body': {
    one: 'Se cerró una sesión.',
    many: 'Se cerraron {revoked} sesiones.',
    other: 'Se cerraron {revoked} sesiones.',
  },

  'action.ban.item': 'Suspender la cuenta',
  'action.ban.self':
    'En tu propia cuenta no — suspenderte a ti mismo te quita tu propia vuelta.',
  'action.ban.title': 'Suspender a {name}',
  'action.ban.body':
    'Todas las sesiones terminan de inmediato y la cuenta no podrá volver a entrar hasta que se levante la suspensión o caduque.',
  'action.ban.confirm': 'Suspender cuenta',
  'action.ban.reason': 'Motivo',
  'action.ban.reason.hint':
    'Se guarda trece meses en el rastro de auditoría de la plataforma y no se le enseña a nadie salvo a un administrador.',
  'action.ban.reason.placeholder':
    'Denuncias de abuso repetidas desde tres espacios de trabajo',
  'action.ban.duration': 'Duración',
  'action.ban.duration.label': 'Duración de la suspensión',
  'action.ban.duration.permanent.body':
    'Sigue en vigor hasta que un administrador la levante a propósito.',
  'action.ban.duration.day': '24 horas',
  'action.ban.duration.day.body':
    'Bastante para interrumpir, poco para dejar de ser una intervención.',
  'action.ban.duration.week': '7 días',
  'action.ban.duration.week.body': 'Una semana para responder a una queja.',
  'action.ban.duration.month': '30 días',
  'action.ban.duration.month.body': 'Un mes de silencio forzoso.',
  'action.ban.duration.quarter': '90 días',
  'action.ban.duration.quarter.body':
    'Lo más largo que ofrece la consola. Más allá, suspende de forma indefinida.',
  'action.ban.done': 'Cuenta suspendida',
  'action.ban.done.body':
    'A {name} se le ha cerrado la sesión en todas partes y no puede volver a entrar.',

  'action.unban.item': 'Levantar la suspensión',
  'action.unban.title': 'Levantar la suspensión de {name}',
  'action.unban.body':
    'La cuenta puede volver a entrar desde su siguiente intento. No se restaura ninguna sesión anterior.',
  'action.unban.confirm': 'Levantar suspensión',
  'action.unban.done': 'Suspensión levantada',
  'action.unban.done.body':
    '{name} puede volver a entrar. No se restauró ninguna sesión.',

  'action.delete.item': 'Borrar la cuenta',
  'action.delete.self': 'En tu propia cuenta no — de ahí no se vuelve.',
  'action.delete.title': 'Borrar a {name}',
  'action.delete.body':
    'La cuenta, sus sesiones y todas las credenciales que lleve enganchadas se retiran. Esto no se puede deshacer.',
  'action.delete.confirm': 'Borrar cuenta',
  'action.delete.note':
    'El contenido del espacio de trabajo que creó esta persona se queda con el espacio que lo posee. Suspender la cuenta en vez de borrarla conserva el registro y quita el acceso.',
  'action.delete.owners':
    'No se puede eliminar una cuenta que es la única propietaria de un espacio de trabajo al que pertenecen otras personas. Un propietario de ese espacio puede nombrar antes a otro desde su consola del espacio de trabajo, o se puede suspender la cuenta en su lugar.',
  'action.delete.done': 'Cuenta borrada',
  'action.delete.done.body':
    '{name} y todo lo que llevaba enganchado la cuenta han desaparecido.',

  'session.revoke.label': 'Cerrar la sesión de {device}',
  'session.revoke.title': 'Cerrar esta sesión',
  'session.revoke.body':
    '{device} tendrá que volver a entrar en su siguiente petición. Si es la sesión en la que estás leyendo esto, se te cierra a ti con ella.',
  'session.revoke.confirm': 'Cerrar sesión',
  'session.revoke.done': 'Sesión cerrada',
  'session.revoke.done.body':
    'El dispositivo tendrá que volver a entrar en su siguiente petición.',

  /* ------------------------------------------------ ejecuciones de agentes -- */

  'runs.error.title': 'El registro de ejecuciones no contestó',
  'runs.origin.local': 'En local',
  'runs.origin.githubActions': 'Acciones de GitHub',
  'runs.stat.live': 'Ejecuciones vivas',
  'runs.stat.live.none': 'Ahora mismo no se está construyendo nada',
  'runs.stat.live.some': 'Latiendo contra un arriendo de cinco minutos',
  'runs.stat.issues': 'Incidencias retenidas',
  'runs.stat.issues.caption':
    'Arrendadas a una sola ejecución cada una, con antecesoras y subincidencias',
  'runs.stat.orphans': 'Ramas huérfanas',
  'runs.stat.orphans.none': 'No hay trabajo sin dueño',
  'runs.stat.orphans.some':
    'Commits de una ejecución que se paró, a la espera de que alguien los adopte',
  'runs.live.empty.title': 'No hay ninguna ejecución registrada',
  'runs.live.empty.body':
    'Una ejecución aparece aquí en cuanto se registra — desde esta máquina, desde otra o desde un ejecutor de GitHub — con las incidencias que ha tomado.',
  'runs.holds.nothing': 'no retiene nada',
  'runs.holds': 'retiene {issues}',
  'runs.uptime': '{elapsed} en marcha · {lease}',
  'runs.lease.expired': 'caducado',
  'runs.lease.left': 'quedan {elapsed}',
  'runs.wip.label': 'Trabajo en curso',
  'runs.wip.empty.title': 'Ninguna rama lleva trabajo',
  'runs.wip.empty.body':
    'Una ejecución anota su rama en cuanto tiene commits en ella, para que si muere, a la siguiente que tome la incidencia se le ofrezca el trabajo en lugar de empezarlo otra vez.',
  'runs.wip.orphaned': 'Huérfana',
  'runs.wip.meta': {
    one: '{commits} commit · hace {elapsed}',
    many: '{commits} commits · hace {elapsed}',
    other: '{commits} commits · hace {elapsed}',
  },
  'runs.recent.label': 'Terminadas hace poco',
  'runs.recent.empty.title': 'Todavía no ha terminado ninguna ejecución',
  'runs.recent.empty.body':
    'Aquí se guardan las cincuenta últimas ejecuciones con el final que tuvo cada una.',
  'runs.ago': 'hace {elapsed}',
  'runs.notCoordinator.title': 'Este despliegue no coordina la flota',
  'runs.notCoordinator.body':
    'El registro de ejecuciones está enganchado solo en preproducción, y a propósito: un segundo registro dejaría que dos flotas creyeran cada una que tiene la lista pendiente, que es justo lo que existe para impedir. Lee la flota en preproducción.',
  'nav.providers': 'Proveedores',
  'nav.providers.description': 'Llamadas salientes y sus topes',
  'providers.error.title': 'No se pudieron leer los medidores de proveedores',
  'providers.list.label': 'Servicios',
  'providers.status.planned': 'Sin integrar',
  'providers.status.planned.description':
    'Nada llama todavía a este servicio, así que no hay nada que contar. Aparece aquí para poder acordar un tope antes de la primera llamada y no después de la primera factura.',
  'providers.policy.allow': 'Factura por encima',
  'providers.policy.block': 'Rechaza al llegar al tope',
  'providers.badge.blocked': {
    one: 'Una llamada rechazada',
    many: '{calls} llamadas rechazadas',
    other: '{calls} llamadas rechazadas',
  },
  'providers.limit.none': 'Sin tope acordado · {used} este mes',
  'providers.limit.value': '{used} de {limit}',
  'providers.limit.window.day': 'Hoy',
  'providers.limit.window.month': 'Este mes',
  'providers.measuring.none': 'Todavía no se ha medido nada',
  'providers.measuring.since': 'Midiendo desde el {date}',
  'providers.stat.calls': 'Llamadas este mes',
  'providers.stat.calls.caption': 'En todos los servicios integrados',
  'providers.stat.errors': 'Llamadas fallidas',
  'providers.stat.errors.caption':
    'Cuentan también como llamadas, porque casi todos los proveedores las cobran',
  'providers.stat.nearLimit': 'Cerca de un tope',
  'providers.stat.nearLimit.caption':
    'Servicios por encima de su umbral de aviso',
  'providers.stat.blocked': 'Llamadas rechazadas',
  'providers.stat.blocked.none': 'No se ha rechazado nada',
  'providers.stat.blocked.some': 'Demanda rechazada por un tope',
  'providers.forecast.label': 'Previsión',
  'providers.forecast.provider': 'Servicio',
  'providers.forecast.monthEnd': 'A fin de mes',
  'providers.forecast.runRate': 'Al mes a este ritmo',
  'providers.forecast.perWorkspace': 'Por espacio de trabajo y mes',
  'providers.forecast.noWorkspaceTraffic':
    'No hay tráfico de espacios que promediar',
  'providers.forecast.window': {
    one: 'Proyectado a partir de una hora de medición.',
    many: 'Proyectado a partir de {hours} horas de medición.',
    other: 'Proyectado a partir de {hours} horas de medición.',
  },
  'providers.forecast.tooEarly': {
    one: 'Solo una hora medida por ahora: insuficiente para proyectar. Extender menos de un día a un mes sería aritmética, no una previsión.',
    many: 'Solo {hours} horas medidas por ahora: insuficiente para proyectar. Extender menos de un día a un mes sería aritmética, no una previsión.',
    other:
      'Solo {hours} horas medidas por ahora: insuficiente para proyectar. Extender menos de un día a un mes sería aritmética, no una previsión.',
  },
  'providers.forecast.atWorkspaces': 'Con cuántos espacios de trabajo',
  'providers.forecast.callsEach': 'Llamadas por espacio al mes',
  'providers.forecast.projected': 'Unas {calls} llamadas al mes.',
  'providers.workspaces.label': 'Espacios más activos',
  'providers.workspaces.platform': 'Plataforma (sin espacio)',
  'providers.workspaces.empty.title': 'Nada atribuido todavía',
  'providers.workspaces.empty.description':
    'Una llamada hecha para un espacio de trabajo se le imputa. Las tareas programadas y el correo de la plataforma no son de ninguno y se cuentan aparte.',
  'providers.readOnly':
    'Puedes leer estos medidores pero no mover un tope. Cambiar un límite o su política requiere el permiso provider:configure.',
  'providers.status.planned.agreed.month':
    'Tope acordado: {limit} al mes. Se aplica desde la primera llamada, en cuanto exista un cliente.',
  'providers.status.planned.agreed.day':
    'Tope acordado: {limit} al día. Se aplica desde la primera llamada, en cuanto exista un cliente.',
  'providers.edit.button': 'Editar',
  'providers.edit.title': 'Tope de {provider}',
  'providers.edit.body':
    'Lo que este despliegue acordó gastar con el proveedor, y qué pasa cuando se agota.',
  'providers.edit.confirm': 'Guardar tope',
  'providers.edit.done': 'Tope guardado para {provider}',
  'providers.edit.label': 'Nombre',
  'providers.edit.ceiling': 'Llamadas incluidas',
  'providers.edit.ceiling.hint':
    'Déjalo vacío si no hay tope acordado. Vacío y cero no son lo mismo: cero con «rechazar» aparta todas las llamadas.',
  'providers.edit.ceiling.placeholder': 'Sin tope',
  'providers.edit.window': 'Medido en',
  'providers.edit.window.month': 'Un mes natural',
  'providers.edit.window.month.body':
    'La forma habitual de una cuota incluida.',
  'providers.edit.window.day': 'Un día',
  'providers.edit.window.day.body':
    'Algunos proveedores miden por día: el plan gratuito de Geoapify son 3.000 créditos diarios.',
  'providers.edit.policy': 'Al llegar al tope',
  'providers.edit.policy.allow': 'Seguir llamando y pagar',
  'providers.edit.policy.allow.body':
    'Las llamadas siguen por encima del tope y la consola avisa. Nada deja de funcionar.',
  'providers.edit.policy.block': 'Rechazar más llamadas',
  'providers.edit.policy.block.body':
    'Las llamadas se rechazan hasta que la ventana se reinicie. Lo que dependa de este proveedor deja de funcionar: elígelo solo donde ese fallo salga más barato.',
  'providers.edit.policy.block.refused':
    '{provider} no se puede rechazar: no tiene alternativa, así que apartar sus llamadas pararía la función en vez de acotar su coste. Un tope que solo avisa sigue disponible.',
  'providers.edit.warn': 'Avisar al (%)',
  'providers.edit.critical': 'Alarma al (%)',
  'providers.edit.thresholds.hint':
    'Dónde el medidor pasa a ámbar y a rojo. El aviso no puede superar a la alarma.',
} satisfies TranslationOf<typeof En>

export default messages
