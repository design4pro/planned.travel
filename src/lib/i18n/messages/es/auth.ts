/**
 * Everything the authentication screens say, in Spanish.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tú», as everywhere else in the Spanish catalogue. These are
 * the only screens a traveller reaches with no session, so the language comes
 * from `Accept-Language` alone and every validation message has to read as
 * naturally as the headings do.
 *
 * **Plural.** `Intl.PluralRules('es')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Not translated, on purpose.** The `{provider}` of a social button is a
 * trademark; `planned.travel` is our own wordmark and is written out rather
 * than inflected; and the reserved `example.com` domain in the email
 * placeholder stays as it is, while the local part is Spanish.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Inicio de planned.travel',
  'shell.legal':
    'Al continuar aceptas las condiciones del servicio y el aviso de privacidad de planned.travel.',

  'panel.eyebrow': 'Planificad juntos',
  'panel.heading':
    'Cada viaje, desde el primer punto en el mapa hasta la última postal.',
  'panel.body':
    'Itinerarios compartidos sobre un mapa de verdad, presupuestos que cuadran, listas de equipaje con memoria y un diario que merece la pena guardar.',
  'panel.map.title': 'Un mapa, un plan',
  'panel.map.detail':
    'Cada parada, cada alojamiento y cada traslado en un solo itinerario.',
  'panel.group.title': 'Todo el grupo al día',
  'panel.group.detail':
    'Los cambios, los votos y los comentarios llegan al instante a todo el grupo.',
  'panel.costs.title': 'Cuentas que cuadran',
  'panel.costs.detail':
    'Presupuestos compartidos, saldos liquidados y ninguna hoja de cálculo.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'o',
  'divider.orEmail': 'o usa tu correo',

  'social.continue': 'Continuar con {provider}',
  'social.signUp': 'Registrarte con {provider}',
  'social.opening': 'Abriendo {provider}',

  'passkey.action': 'Entrar con una clave de acceso',
  'passkey.waiting': 'Esperando a tu dispositivo',

  'password.show': 'Mostrar la contraseña',
  'password.hide': 'Ocultar la contraseña',
  'password.showNew': 'Mostrar la contraseña nueva',
  'password.hideNew': 'Ocultar la contraseña nueva',
  'password.showConfirm': 'Mostrar la confirmación de la contraseña',
  'password.hideConfirm': 'Ocultar la confirmación de la contraseña',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Correo electrónico',
  'field.email.placeholder': 'tu@example.com',
  'field.password': 'Contraseña',
  'field.password.placeholder': 'Tu contraseña',
  'field.newPassword': 'Contraseña nueva',
  'field.newPassword.placeholder': 'Una frase que vayas a recordar',
  'field.confirmPassword': 'Confirmar la contraseña',
  'field.confirmNewPassword': 'Confirmar la contraseña nueva',
  'field.confirmPassword.placeholder': 'Escríbela una vez más',
  'field.name': 'Tu nombre',
  'field.name.hint': 'Lo verán las personas con las que planees viajes.',
  'field.name.placeholder': 'Alejandra Moreno',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Escribe tu correo electrónico.',
  'validation.emailTooLong': 'Ese correo es demasiado largo.',
  'validation.emailInvalid': 'Eso no parece un correo electrónico.',
  'validation.passwordRequired': 'Escribe tu contraseña.',
  'validation.passwordShort': {
    one: 'Usa al menos {value} carácter: una frase corta gana a una palabra ingeniosa.',
    many: 'Usa al menos {value} caracteres: una frase corta gana a una palabra ingeniosa.',
    other:
      'Usa al menos {value} caracteres: una frase corta gana a una palabra ingeniosa.',
  },
  'validation.passwordLong': {
    one: 'No pases de {value} carácter.',
    many: 'No pases de {value} caracteres.',
    other: 'No pases de {value} caracteres.',
  },
  'validation.passwordMismatch': 'Esas contraseñas no coinciden.',
  'validation.nameShort':
    'Escribe tu nombre, para que tus compañeros de viaje sepan quién eres.',
  'validation.nameTooLong': 'Ese nombre es demasiado largo.',
  'validation.termsRequired': 'Acepta las condiciones para continuar.',
  'validation.codeLength': 'Los códigos del autenticador tienen seis dígitos.',
  'validation.codeDigits': 'Los códigos del autenticador solo llevan dígitos.',
  'validation.backupShort': 'Ese código de reserva parece demasiado corto.',
  'validation.backupLong': 'Ese código de reserva parece demasiado largo.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Otra vez por aquí',
  'login.heading': 'Entra en planned.travel',
  'login.description':
    'Retoma tus itinerarios, tus presupuestos y tus listas justo donde los dejaste.',
  'login.newHere': '¿Es tu primera vez?',
  'login.createAccount': 'Crear una cuenta',
  'login.forgot': '¿Has olvidado la contraseña?',
  'login.remember': 'Mantener la sesión abierta en este dispositivo',
  'login.submit': 'Entrar',
  'login.submitting': 'Entrando',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Crea tu cuenta',
  'register.heading': 'Empieza a planear en un par de minutos',
  'register.description':
    'Una sola cuenta para todos tus viajes, todos tus compañeros y todas tus listas.',
  'register.haveAccount': '¿Ya tienes cuenta?',
  'register.signIn': 'Entrar',
  'register.terms':
    'Acepto las condiciones del servicio y el aviso de privacidad.',
  'register.submit': 'Crear la cuenta',
  'register.submitting': 'Creando tu cuenta',

  'strength.hint': {
    one: 'Al menos {value} carácter. Una frase corta gana a una palabra ingeniosa.',
    many: 'Al menos {value} caracteres. Una frase corta gana a una palabra ingeniosa.',
    other:
      'Al menos {value} caracteres. Una frase corta gana a una palabra ingeniosa.',
  },
  'strength.tooShort': 'Seguridad: demasiado corta',
  'strength.weak': 'Seguridad: floja',
  'strength.fair': 'Seguridad: aceptable',
  'strength.strong': 'Seguridad: buena',
  'strength.excellent': 'Seguridad: excelente',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Ayuda con la contraseña',
  'forgot.heading': 'Cambia tu contraseña',
  'forgot.description':
    'Dinos la dirección de tu cuenta y te enviaremos un enlace para poner una contraseña nueva.',
  'forgot.submit': 'Enviarme el enlace',
  'forgot.submitting': 'Enviando tu enlace',
  'forgot.back': 'Volver al inicio de sesión',
  'forgot.sent.eyebrow': 'Mira tu buzón',
  'forgot.sent.heading': 'Tu enlace ya va de camino',
  'forgot.sent.description':
    'Si hay una cuenta con {email}, el enlace para elegir una contraseña nueva ya está en ese buzón.',
  'forgot.sent.title': 'El enlace sirve una vez y dura una hora',
  'forgot.sent.body':
    '¿No ha llegado nada? Mira en la carpeta de spam y vuelve a enviarlo. Pedir un enlace nuevo retira el anterior sin más.',
  'forgot.sent.resend': 'Enviarlo otra vez',
  'forgot.sent.resending': 'Enviándolo otra vez',
  'forgot.sent.change': 'Usar otro correo',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Cambio de contraseña',
  'reset.heading': 'Elige una contraseña nueva',
  'reset.description': {
    one: 'Elige algo de al menos {value} carácter. Una frase corta se recuerda mejor y se adivina peor.',
    many: 'Elige algo de al menos {value} caracteres. Una frase corta se recuerda mejor y se adivina peor.',
    other:
      'Elige algo de al menos {value} caracteres. Una frase corta se recuerda mejor y se adivina peor.',
  },
  'reset.submit': 'Guardar la contraseña',
  'reset.submitting': 'Guardando tu contraseña',
  'reset.back': 'Volver al inicio de sesión',
  'reset.stale.heading': 'Ese enlace ya no se puede usar',
  'reset.stale.description':
    'Los enlaces caducan a la hora y solo funcionan una vez: el trato más seguro posible.',
  'reset.stale.action': 'Pedir un enlace nuevo',
  'reset.done.heading': 'Tu contraseña nueva está lista',
  'reset.done.description':
    'Hemos cerrado todas las demás sesiones, así que quien tuviera la contraseña antigua ya no puede entrar.',
  'reset.done.title': 'Sesión cerrada en todo lo demás',
  'reset.done.body': 'Entra con tu contraseña nueva y sigue planeando.',
  'reset.done.action': 'Entrar',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verificación en dos pasos',
  'twoFactor.heading': 'Confirma que eres tú',
  'twoFactor.description':
    'Tu cuenta está protegida con un segundo factor. Escribe el código que muestra ahora tu aplicación de autenticación.',
  'twoFactor.back': 'Empezar otra vez desde el inicio de sesión',
  'twoFactor.methods': 'Método de verificación',
  'twoFactor.totp.tab': 'Aplicación',
  'twoFactor.totp.label': 'Código de seis dígitos',
  'twoFactor.totp.hint': 'Los códigos cambian cada 30 segundos.',
  'twoFactor.totp.submit': 'Verificar y continuar',
  'twoFactor.backup.tab': 'Código de reserva',
  'twoFactor.backup.label': 'Código de reserva',
  'twoFactor.backup.hint':
    'De la lista que guardaste al activar la verificación en dos pasos. Cada código sirve una vez.',
  'twoFactor.backup.submit': 'Usar un código de reserva',
  'twoFactor.submitting': 'Comprobando tu código',
  'twoFactor.trust.label': 'Confiar en este dispositivo durante 30 días',
  'twoFactor.trust.detail':
    'Hasta entonces te saltarás este paso en este navegador. Hazlo solo en un dispositivo que sea solo tuyo.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Correo confirmado',
  'verify.done.heading': 'Ya está todo listo',
  'verify.done.description':
    'Tu dirección está verificada, así que te llegarán las invitaciones, los recordatorios y los resúmenes de viaje.',
  'verify.done.title': 'Verificado',
  'verify.done.body': '{email} está confirmado en esta cuenta.',
  'verify.done.bodyUnknown':
    'Tu correo electrónico está confirmado en esta cuenta.',
  'verify.done.action': 'Ir a tu panel',

  'verify.pending.eyebrow': 'Una última cosa',
  'verify.pending.heading': 'Confirma tu correo electrónico',
  'verify.pending.description':
    'Hemos enviado un enlace de confirmación a {email}. Abrirlo mantiene tu cuenta recuperable y permite que te inviten a viajes.',
  'verify.pending.wrongAddress': '¿Dirección equivocada?',
  'verify.pending.changeIt': 'Cámbiala en los ajustes',
  'verify.pending.title': 'El enlace dura 24 horas',
  'verify.pending.body':
    '¿No hay nada en tu buzón? Mira en la carpeta de spam y vuelve a enviarlo.',
  'verify.pending.resentTitle': 'Enviado otra vez ahora mismo',
  'verify.pending.resentBody':
    'Dale un minuto y mira tu buzón, y también la carpeta de spam.',
  'verify.pending.resend': 'Reenviar la confirmación',
  'verify.pending.resending': 'Enviándolo otra vez',
  'verify.pending.continue': 'Continuar de todos modos',

  'verify.request.eyebrow': 'Confirmación del correo',
  'verify.request.heading': 'Enviar un enlace de confirmación nuevo',
  'verify.request.description':
    'Los enlaces de confirmación duran 24 horas y solo funcionan una vez. Dinos tu dirección y sale uno nuevo.',
  'verify.request.submit': 'Enviar el enlace',
  'verify.request.submitting': 'Enviando tu enlace',
  'verify.request.sentTitle': 'Ya va de camino',
  'verify.request.sentBody':
    'Si esa dirección tiene una cuenta pendiente de confirmar, el enlace ya está en su buzón.',
  'verify.request.change': 'Usar otro correo',
  'verify.request.back': 'Volver al inicio de sesión',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Invitación a un espacio de trabajo',
  'invitation.heading': 'Únete a {workspace}',
  'invitation.description':
    'Al aceptar entras en este espacio de trabajo y compartes sus viajes, sus presupuestos y sus listas.',
  'invitation.invitedAs': 'Invitación para {email}',
  'invitation.role': 'Tu rol',
  'invitation.means': 'Significa',
  'invitation.invitedBy': 'Te ha invitado',
  'invitation.expires': 'Caduca',
  'invitation.accept': 'Aceptar la invitación',
  'invitation.accepting': 'Entrando en el espacio',
  'invitation.decline': 'Rechazar',
  'invitation.declining': 'Rechazando',
  'invitation.reassurance':
    'Puedes salir de un espacio de trabajo cuando quieras desde sus ajustes, y nada de lo que crees fuera de él se comparte nunca.',

  'invitation.role.owner': 'Propietario: control total, facturación incluida',
  'invitation.role.admin': 'Administrador: gestiona viajes, miembros y ajustes',
  'invitation.role.member': 'Miembro: planea viajes con todos los demás',
  'invitation.role.other':
    '{role}: el acceso lo define el propietario del espacio',
  'invitation.role.badge.owner': 'Propietario',
  'invitation.role.badge.admin': 'Administrador',
  'invitation.role.badge.member': 'Miembro',

  'invitation.anonymous.heading': 'Entra para ver tu invitación',
  'invitation.anonymous.description':
    'Las invitaciones van ligadas al correo al que se enviaron, así que necesitamos saber quién eres antes de enseñarte esta.',
  'invitation.anonymous.body':
    'Usa la dirección a la que llegó la invitación. Después te traemos de vuelta aquí mismo.',
  'invitation.anonymous.action': 'Entrar para continuar',
  'invitation.anonymous.noAccount': '¿Todavía no tienes cuenta?',
  'invitation.anonymous.register': 'Crea una con la dirección invitada',

  'invitation.mismatch.heading': 'Esta invitación es para otra dirección',
  'invitation.mismatch.description':
    'Has entrado con otra cuenta, así que esta invitación no es tuya.',
  'invitation.mismatch.title': 'Sesión iniciada como {email}',
  'invitation.mismatch.body':
    'Cierra la sesión y entra con la dirección a la que llegó la invitación, o pide una invitación nueva para esta cuenta.',
  'invitation.mismatch.action': 'Cambiar de cuenta',
  'invitation.mismatch.back': 'Volver al inicio de sesión',

  'invitation.unverified.heading': 'Confirma tu correo para entrar',
  'invitation.unverified.description':
    'Los espacios de trabajo solo admiten direcciones confirmadas, para que nadie entre por una errata.',
  'invitation.unverified.title': '{email} todavía no está confirmado',
  'invitation.unverified.body':
    'Abre el enlace de confirmación de tu buzón y vuelve a esta página. La invitación seguirá esperando.',
  'invitation.unverified.action': 'Confirmar mi correo',
  'invitation.unverified.resend': 'Reenviar el correo de confirmación',

  'invitation.unavailable.heading': 'Esta invitación ya no está disponible',
  'invitation.unavailable.description':
    'Las invitaciones duran siete días y se retiran en cuanto se usan o se anulan.',
  'invitation.unavailable.title': 'Aquí no hay nada que aceptar',
  'invitation.unavailable.body':
    'Pide a quien te invitó que te mande una invitación nueva y esta página la mostrará enseguida.',
  'invitation.unavailable.dashboard': 'Ir a tu panel',

  'invitation.declined.eyebrow': 'Invitación rechazada',
  'invitation.declined.heading': 'Sin problema: no se ha compartido nada',
  'invitation.declined.description':
    'Se lo hemos dicho al propietario del espacio y este enlace ya no se puede usar.',
  'invitation.declined.action': 'Ir a tu panel',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Algo ha salido mal',
  'error.unexpected.detail':
    'Eso no ha funcionado. Vuelve a intentarlo en un momento.',
  'error.rateLimited.title': 'Demasiados intentos',
  'error.rateLimited.detail':
    'Por seguridad hemos pausado el acceso desde este dispositivo unos minutos. Inténtalo un poco más tarde.',
  'error.offline.title': 'Sin conexión',
  'error.offline.detail':
    'No hemos podido llegar a planned.travel. Revisa tu conexión y vuelve a intentarlo.',

  'error.credentials.title': 'Esos datos no coinciden',
  'error.credentials.detail':
    'Revisa el correo y la contraseña e inténtalo otra vez. Si te registraste con Google o Apple, usa ese botón.',
  'error.password.title': 'Esos datos no coinciden',
  'error.password.detail':
    'Revisa el correo y la contraseña e inténtalo otra vez.',
  'error.noPassword.title': 'Esta cuenta no tiene contraseña',
  'error.noPassword.detail':
    'Esta cuenta entra con un proveedor social o con una clave de acceso. Usa una de las opciones de arriba.',
  'error.unverified.title': 'Confirma antes tu correo',
  'error.unverified.detail':
    'Te enviamos un enlace de confirmación al registrarte. Ábrelo y vuelve aquí.',
  'error.emailTaken.title': 'Ese correo ya está registrado',
  'error.emailTaken.detail':
    'Entra con él, o cambia la contraseña si la has olvidado.',
  'error.noAccount.title': 'No hemos encontrado esa cuenta',
  'error.noAccount.detail': 'Revisa la dirección o crea una cuenta nueva.',
  'error.passwordTooShort.title': 'Contraseña demasiado corta',
  'error.passwordTooShort.detail':
    'Elige una frase más larga e inténtalo otra vez.',
  'error.passwordTooLong.title': 'Contraseña demasiado larga',
  'error.passwordTooLong.detail':
    'Elige una frase más corta e inténtalo otra vez.',
  'error.linkSpent.title': 'Este enlace ya no vale',
  'error.linkSpent.detail':
    'Los enlaces de contraseña solo sirven una vez. Pide uno nuevo y te lo enviamos al momento.',
  'error.linkExpired.title': 'Este enlace ha caducado',
  'error.linkExpired.detail': 'Pide uno nuevo y te lo enviamos al momento.',
  'error.linkIncomplete.title': 'Este enlace está incompleto',
  'error.linkIncomplete.detail':
    'Los enlaces para cambiar la contraseña llevan un código de un solo uso. Abre el correo más reciente, o pide un enlace nuevo.',
  'error.sessionExpired.title': 'Tu sesión ha caducado',
  'error.sessionExpired.detail': 'Entra otra vez para seguir donde lo dejaste.',
  'error.alreadyVerified.title': 'Ya estaba confirmado',
  'error.alreadyVerified.detail':
    'Este correo está verificado. Puedes entrar con normalidad.',
  'error.badCode.title': 'Ese código no ha funcionado',
  'error.badCode.detail':
    'Los códigos duran 30 segundos. Espera al siguiente y escribe los seis dígitos.',
  'error.badBackupCode.title': 'Ese código de reserva no ha funcionado',
  'error.badBackupCode.detail':
    'Cada código de reserva sirve una vez. Prueba con el siguiente sin usar de tu lista.',
  'error.locked.title': 'Cuenta bloqueada un rato',
  'error.locked.detail':
    'Demasiados intentos de verificación fallidos. Por seguridad, esta cuenta queda bloqueada unos minutos.',
  'error.noTwoFactor.title': 'No tienes verificación en dos pasos',
  'error.noTwoFactor.detail':
    'Entra con tu correo y tu contraseña para continuar.',
  'error.twoFactorExpired.title': 'Empieza otra vez desde el inicio de sesión',
  'error.twoFactorExpired.detail':
    'Este paso de verificación ha caducado. Escribe otra vez tu correo y tu contraseña.',
  'error.invitationGone.title': 'Esta invitación ya no está disponible',
  'error.invitationGone.detail':
    'Puede haber caducado, haberse anulado o haberse usado ya. Pide una invitación nueva.',
  'error.invitationOther.title': 'Esta invitación es para otra persona',
  'error.invitationOther.detail':
    'Se envió a otro correo electrónico. Entra con esa dirección para aceptarla.',
  'error.alreadyMember.title': 'Ya estás en este espacio de trabajo',
  'error.alreadyMember.detail':
    'No hay nada que aceptar: ábrelo desde el selector de espacios.',
  'error.workspaceFull.title': 'Este espacio de trabajo está lleno',
  'error.workspaceFull.detail':
    'Ha llegado a su límite de miembros. Pide a un propietario que libere una plaza o que mejore el plan.',
  'error.verifyBeforeJoin.title': 'Confirma antes tu correo',
  'error.verifyBeforeJoin.detail':
    'Abre el enlace de confirmación que te enviamos y vuelve a esta invitación.',

  'passkeyNotice.added': 'Se añadió una clave de acceso a tu cuenta',
  'passkeyNotice.removed': 'Se eliminó una clave de acceso de tu cuenta',
  'passkeyNotice.security': 'Seguridad',
  'passkeyNotice.action': 'Gestionar claves de acceso',
  'passkeyNotice.recovery':
    'Si no reconoces este cambio, cambia tu contraseña y cierra las sesiones desconocidas. Restablecer la contraseña no elimina las claves de acceso. Revísalas y elimina las que no reconozcas.',
} satisfies TranslationOf<typeof En>

export default messages
