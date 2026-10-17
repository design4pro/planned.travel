/**
 * Everything the authentication screens say, in Catalan.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular with imperative actions, as everywhere
 * else in the Catalan catalogue. These are the only screens a traveller reaches
 * with no session, so the language comes from `Accept-Language` alone and every
 * validation message has to read as naturally as the headings do.
 *
 * **Plural.** `Intl.PluralRules('ca')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Not translated, on purpose.** The `{provider}` of a social button is a
 * trademark; `planned.travel` is our own wordmark; and the reserved
 * `example.com` domain stays as it is while the local part becomes Catalan.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Inici de planned.travel',
  'shell.legal':
    'Si continues, acceptes les condicions del servei i l’avís de privadesa de planned.travel.',

  'panel.eyebrow': 'Prepareu-ho junts',
  'panel.heading':
    'Cada viatge, des del primer punt al mapa fins a l’última postal.',
  'panel.body':
    'Itineraris compartits sobre un mapa de debò, pressupostos que quadren, llistes d’equipatge amb memòria i un diari que val la pena guardar.',
  'panel.map.title': 'Un mapa, un pla',
  'panel.map.detail':
    'Cada parada, cada allotjament i cada trasllat en un sol itinerari.',
  'panel.group.title': 'Tothom al mateix pas',
  'panel.group.detail':
    'Els canvis, els vots i els comentaris arriben a l’instant a tot el grup.',
  'panel.costs.title': 'Comptes que quadren',
  'panel.costs.detail':
    'Pressupostos compartits, saldos liquidats i cap full de càlcul.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'o',
  'divider.orEmail': 'o fes servir el correu',

  'social.continue': 'Continua amb {provider}',
  'social.signUp': 'Registra’t amb {provider}',
  'social.opening': 'S’està obrint {provider}',

  'passkey.action': 'Entra amb una clau d’accés',
  'passkey.waiting': 'S’està esperant el teu dispositiu',

  'password.show': 'Mostra la contrasenya',
  'password.hide': 'Amaga la contrasenya',
  'password.showNew': 'Mostra la contrasenya nova',
  'password.hideNew': 'Amaga la contrasenya nova',
  'password.showConfirm': 'Mostra la confirmació de la contrasenya',
  'password.hideConfirm': 'Amaga la confirmació de la contrasenya',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Adreça electrònica',
  'field.email.placeholder': 'tu@example.com',
  'field.password': 'Contrasenya',
  'field.password.placeholder': 'La teva contrasenya',
  'field.newPassword': 'Contrasenya nova',
  'field.newPassword.placeholder': 'Una frase que recordaràs',
  'field.confirmPassword': 'Confirma la contrasenya',
  'field.confirmNewPassword': 'Confirma la contrasenya nova',
  'field.confirmPassword.placeholder': 'Escriu-la un cop més',
  'field.name': 'El teu nom',
  'field.name.hint': 'El veuen les persones amb qui prepares viatges.',
  'field.name.placeholder': 'Marta Puig',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Escriu la teva adreça electrònica.',
  'validation.emailTooLong': 'Aquesta adreça és massa llarga.',
  'validation.emailInvalid': 'Això no sembla una adreça electrònica.',
  'validation.passwordRequired': 'Escriu la teva contrasenya.',
  'validation.passwordShort': {
    one: 'Fes servir com a mínim {value} caràcter: una frase curta guanya una paraula enginyosa.',
    many: 'Fes servir com a mínim {value} caràcters: una frase curta guanya una paraula enginyosa.',
    other:
      'Fes servir com a mínim {value} caràcters: una frase curta guanya una paraula enginyosa.',
  },
  'validation.passwordLong': {
    one: 'No passis de {value} caràcter.',
    many: 'No passis de {value} caràcters.',
    other: 'No passis de {value} caràcters.',
  },
  'validation.passwordMismatch': 'Aquestes contrasenyes no coincideixen.',
  'validation.nameShort':
    'Escriu el teu nom, perquè els companys de viatge sàpiguen qui ets.',
  'validation.nameTooLong': 'Aquest nom és massa llarg.',
  'validation.termsRequired': 'Accepta les condicions per continuar.',
  'validation.codeLength': 'Els codis de l’autenticador tenen sis xifres.',
  'validation.codeDigits': 'Els codis de l’autenticador només porten xifres.',
  'validation.backupShort': 'Aquest codi de reserva sembla massa curt.',
  'validation.backupLong': 'Aquest codi de reserva sembla massa llarg.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Ja tornes a ser aquí',
  'login.heading': 'Entra a planned.travel',
  'login.description':
    'Reprèn els itineraris, els pressupostos i les llistes just on els vas deixar.',
  'login.newHere': 'És el primer cop?',
  'login.createAccount': 'Crea un compte',
  'login.forgot': 'Has oblidat la contrasenya?',
  'login.remember': 'Mantén la sessió oberta en aquest dispositiu',
  'login.submit': 'Entra',
  'login.submitting': 'S’està entrant',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Crea el teu compte',
  'register.heading': 'Comença a preparar viatges en un parell de minuts',
  'register.description':
    'Un sol compte per a tots els viatges, tots els companys i totes les llistes.',
  'register.haveAccount': 'Ja tens compte?',
  'register.signIn': 'Entra',
  'register.terms': 'Accepto les condicions del servei i l’avís de privadesa.',
  'register.submit': 'Crea el compte',
  'register.submitting': 'S’està creant el teu compte',

  'strength.hint': {
    one: 'Com a mínim {value} caràcter. Una frase curta guanya una paraula enginyosa.',
    many: 'Com a mínim {value} caràcters. Una frase curta guanya una paraula enginyosa.',
    other:
      'Com a mínim {value} caràcters. Una frase curta guanya una paraula enginyosa.',
  },
  'strength.tooShort': 'Fortalesa: massa curta',
  'strength.weak': 'Fortalesa: fluixa',
  'strength.fair': 'Fortalesa: acceptable',
  'strength.strong': 'Fortalesa: bona',
  'strength.excellent': 'Fortalesa: excel·lent',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Ajuda amb la contrasenya',
  'forgot.heading': 'Canvia la contrasenya',
  'forgot.description':
    'Digue’ns l’adreça del teu compte i t’enviarem un enllaç per posar-ne una de nova.',
  'forgot.submit': 'Envia’m l’enllaç',
  'forgot.submitting': 'S’està enviant l’enllaç',
  'forgot.back': 'Torna a l’inici de sessió',
  'forgot.sent.eyebrow': 'Mira la bústia',
  'forgot.sent.heading': 'L’enllaç ja va de camí',
  'forgot.sent.description':
    'Si hi ha un compte amb {email}, l’enllaç per triar una contrasenya nova ja és en aquella bústia.',
  'forgot.sent.title': 'L’enllaç serveix un cop i dura una hora',
  'forgot.sent.body':
    'No ha arribat res? Mira a la carpeta de correu brossa i torna a enviar-lo. Demanar-ne un de nou retira l’anterior sense dir res.',
  'forgot.sent.resend': 'Torna a enviar-lo',
  'forgot.sent.resending': 'S’està enviant un altre cop',
  'forgot.sent.change': 'Fes servir un altre correu',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Canvi de contrasenya',
  'reset.heading': 'Tria una contrasenya nova',
  'reset.description': {
    one: 'Tria alguna cosa de com a mínim {value} caràcter. Una frase curta es recorda millor i s’endevina pitjor.',
    many: 'Tria alguna cosa de com a mínim {value} caràcters. Una frase curta es recorda millor i s’endevina pitjor.',
    other:
      'Tria alguna cosa de com a mínim {value} caràcters. Una frase curta es recorda millor i s’endevina pitjor.',
  },
  'reset.submit': 'Desa la contrasenya nova',
  'reset.submitting': 'S’està desant la contrasenya',
  'reset.back': 'Torna a l’inici de sessió',
  'reset.stale.heading': 'Aquest enllaç ja no es pot fer servir',
  'reset.stale.description':
    'Els enllaços caduquen al cap d’una hora i només funcionen un cop: el tracte més segur possible.',
  'reset.stale.action': 'Demana un enllaç nou',
  'reset.done.heading': 'La contrasenya nova ja hi és',
  'reset.done.description':
    'Hem tancat totes les altres sessions, així que qui tingués la contrasenya antiga ja no té cap porta d’entrada.',
  'reset.done.title': 'Sessió tancada a tota la resta',
  'reset.done.body':
    'Entra amb la contrasenya nova i continua preparant viatges.',
  'reset.done.action': 'Entra',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verificació en dos passos',
  'twoFactor.heading': 'Confirma que ets tu',
  'twoFactor.description':
    'El teu compte està protegit amb un segon factor. Escriu el codi que ara mateix mostra l’aplicació d’autenticació.',
  'twoFactor.back': 'Comença de nou des de l’inici de sessió',
  'twoFactor.methods': 'Mètode de verificació',
  'twoFactor.totp.tab': 'Aplicació',
  'twoFactor.totp.label': 'Codi de sis xifres',
  'twoFactor.totp.hint': 'Els codis canvien cada 30 segons.',
  'twoFactor.totp.submit': 'Verifica i continua',
  'twoFactor.backup.tab': 'Codi de reserva',
  'twoFactor.backup.label': 'Codi de reserva',
  'twoFactor.backup.hint':
    'De la llista que vas desar quan vas activar la verificació en dos passos. Cada codi serveix un cop.',
  'twoFactor.backup.submit': 'Fes servir un codi de reserva',
  'twoFactor.submitting': 'S’està comprovant el codi',
  'twoFactor.trust.label': 'Confia en aquest dispositiu 30 dies',
  'twoFactor.trust.detail':
    'Fins llavors et saltaràs aquest pas en aquest navegador. Fes-ho només en un dispositiu que sigui només teu.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Correu confirmat',
  'verify.done.heading': 'Ja està tot a punt',
  'verify.done.description':
    'La teva adreça està verificada, així que t’arribaran les invitacions, els recordatoris i els resums de viatge.',
  'verify.done.title': 'Verificada',
  'verify.done.body': '{email} està confirmada en aquest compte.',
  'verify.done.bodyUnknown':
    'La teva adreça electrònica està confirmada en aquest compte.',
  'verify.done.action': 'Ves al teu tauler',

  'verify.pending.eyebrow': 'Una última cosa',
  'verify.pending.heading': 'Confirma la teva adreça electrònica',
  'verify.pending.description':
    'Hem enviat un enllaç de confirmació a {email}. Obrir-lo manté el compte recuperable i deixa que els companys de viatge et convidin.',
  'verify.pending.wrongAddress': 'Adreça equivocada?',
  'verify.pending.changeIt': 'Canvia-la a la configuració',
  'verify.pending.title': 'L’enllaç dura 24 hores',
  'verify.pending.body':
    'No hi ha res a la bústia? Mira el correu brossa i torna a enviar-lo.',
  'verify.pending.resentTitle': 'Enviat un altre cop ara mateix',
  'verify.pending.resentBody':
    'Dona-li un minut i mira la bústia — i la carpeta de correu brossa.',
  'verify.pending.resend': 'Torna a enviar la confirmació',
  'verify.pending.resending': 'S’està enviant un altre cop',
  'verify.pending.continue': 'Continua igualment',

  'verify.request.eyebrow': 'Confirmació del correu',
  'verify.request.heading': 'Envia un enllaç de confirmació nou',
  'verify.request.description':
    'Els enllaços de confirmació duren 24 hores i només funcionen un cop. Digue’ns l’adreça i en surt un de nou.',
  'verify.request.submit': 'Envia l’enllaç de confirmació',
  'verify.request.submitting': 'S’està enviant l’enllaç',
  'verify.request.sentTitle': 'Ja va de camí',
  'verify.request.sentBody':
    'Si aquella adreça té un compte pendent de confirmar, l’enllaç ja és a la seva bústia.',
  'verify.request.change': 'Fes servir un altre correu',
  'verify.request.back': 'Torna a l’inici de sessió',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Invitació a un espai de treball',
  'invitation.heading': 'Uneix-te a {workspace}',
  'invitation.description':
    'Si l’acceptes entres en aquest espai de treball i en comparteixes els viatges, els pressupostos i les llistes.',
  'invitation.invitedAs': 'Invitació per a {email}',
  'invitation.role': 'El teu rol',
  'invitation.means': 'Vol dir',
  'invitation.invitedBy': 'T’ha convidat',
  'invitation.expires': 'Caduca',
  'invitation.accept': 'Accepta la invitació',
  'invitation.accepting': 'S’està entrant a l’espai',
  'invitation.decline': 'Rebutja',
  'invitation.declining': 'S’està rebutjant',
  'invitation.reassurance':
    'Pots sortir d’un espai de treball quan vulguis des de la seva configuració, i res del que crees fora mai no s’hi comparteix.',

  'invitation.role.owner': 'Propietari — control total, facturació inclosa',
  'invitation.role.admin':
    'Administrador — gestiona viatges, membres i configuració',
  'invitation.role.member': 'Membre — prepara viatges amb tots els altres',
  'invitation.role.other': '{role} — accés definit pel propietari de l’espai',
  'invitation.role.badge.owner': 'Propietari',
  'invitation.role.badge.admin': 'Administrador',
  'invitation.role.badge.member': 'Membre',

  'invitation.anonymous.heading': 'Entra per veure la teva invitació',
  'invitation.anonymous.description':
    'Les invitacions van lligades a l’adreça on es van enviar, així que hem de saber qui ets abans de mostrar-te aquesta.',
  'invitation.anonymous.body':
    'Fes servir l’adreça que va rebre la invitació. Després et tornem aquí mateix.',
  'invitation.anonymous.action': 'Entra per continuar',
  'invitation.anonymous.noAccount': 'Encara no tens compte?',
  'invitation.anonymous.register': 'Crea’n un amb l’adreça convidada',

  'invitation.mismatch.heading': 'Aquesta invitació és per a una altra adreça',
  'invitation.mismatch.description':
    'Has entrat amb un altre compte, així que aquesta invitació no és teva.',
  'invitation.mismatch.title': 'Has entrat com a {email}',
  'invitation.mismatch.body':
    'Tanca la sessió i entra amb l’adreça que va rebre la invitació, o demana’n una de nova per a aquest compte.',
  'invitation.mismatch.action': 'Canvia de compte',
  'invitation.mismatch.back': 'Torna a l’inici de sessió',

  'invitation.unverified.heading': 'Confirma el correu per entrar',
  'invitation.unverified.description':
    'Els espais de treball només admeten adreces confirmades, perquè ningú no hi entri per una errada.',
  'invitation.unverified.title': '{email} encara no està confirmada',
  'invitation.unverified.body':
    'Obre l’enllaç de confirmació de la bústia i torna a aquesta pàgina. La invitació encara hi serà.',
  'invitation.unverified.action': 'Confirma el meu correu',
  'invitation.unverified.resend': 'Torna a enviar el correu de confirmació',

  'invitation.unavailable.heading': 'Aquesta invitació ja no hi és',
  'invitation.unavailable.description':
    'Les invitacions duren set dies i es retiren així que es fan servir o s’anul·len.',
  'invitation.unavailable.title': 'Aquí no hi ha res per acceptar',
  'invitation.unavailable.body':
    'Demana a qui et va convidar que te’n mani una de nova i aquesta pàgina la mostrarà de seguida.',
  'invitation.unavailable.dashboard': 'Ves al teu tauler',

  'invitation.declined.eyebrow': 'Invitació rebutjada',
  'invitation.declined.heading': 'Cap problema — no s’ha compartit res',
  'invitation.declined.description':
    'Ho hem dit al propietari de l’espai de treball i aquest enllaç ja no es pot fer servir.',
  'invitation.declined.action': 'Ves al teu tauler',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Alguna cosa ha anat malament',
  'error.unexpected.detail':
    'Això no ha funcionat. Torna-ho a provar d’aquí a un moment.',
  'error.rateLimited.title': 'Massa intents',
  'error.rateLimited.detail':
    'Per seguretat hem aturat l’accés des d’aquest dispositiu uns minuts. Torna-ho a provar d’aquí a poc.',
  'error.offline.title': 'Sense connexió',
  'error.offline.detail':
    'No hem pogut arribar a planned.travel. Comprova la connexió i torna-ho a provar.',

  'error.credentials.title': 'Aquestes dades no coincideixen',
  'error.credentials.detail':
    'Comprova l’adreça i la contrasenya i torna-ho a provar. Si et vas registrar amb Google o Apple, fes servir aquell botó.',
  'error.password.title': 'Aquestes dades no coincideixen',
  'error.password.detail':
    'Comprova l’adreça electrònica i la contrasenya i torna-ho a provar.',
  'error.noPassword.title': 'Aquest compte no té contrasenya',
  'error.noPassword.detail':
    'Aquest compte entra amb un servei extern o amb una clau d’accés. Fes servir una de les opcions de dalt.',
  'error.unverified.title': 'Confirma abans el teu correu',
  'error.unverified.detail':
    'Et vam enviar un enllaç de confirmació quan et vas registrar. Obre’l i torna aquí.',
  'error.emailTaken.title': 'Aquest correu ja està registrat',
  'error.emailTaken.detail':
    'Entra-hi, o canvia la contrasenya si l’has oblidada.',
  'error.noAccount.title': 'No hem trobat aquest compte',
  'error.noAccount.detail': 'Comprova l’adreça, o crea un compte nou.',
  'error.passwordTooShort.title': 'Contrasenya massa curta',
  'error.passwordTooShort.detail':
    'Tria una frase més llarga i torna-ho a provar.',
  'error.passwordTooLong.title': 'Contrasenya massa llarga',
  'error.passwordTooLong.detail':
    'Tria una frase més curta i torna-ho a provar.',
  'error.linkSpent.title': 'Aquest enllaç ja no val',
  'error.linkSpent.detail':
    'Els enllaços de contrasenya només serveixen un cop. Demana’n un de nou i te l’enviem de seguida.',
  'error.linkExpired.title': 'Aquest enllaç ha caducat',
  'error.linkExpired.detail': 'Demana’n un de nou i te l’enviem de seguida.',
  'error.linkIncomplete.title': 'Aquest enllaç està incomplet',
  'error.linkIncomplete.detail':
    'Els enllaços per canviar la contrasenya porten un codi d’un sol ús. Obre el correu més recent, o demana un enllaç nou.',
  'error.sessionExpired.title': 'La teva sessió ha caducat',
  'error.sessionExpired.detail':
    'Entra de nou per reprendre-ho on ho vas deixar.',
  'error.alreadyVerified.title': 'Ja estava confirmada',
  'error.alreadyVerified.detail':
    'Aquesta adreça electrònica està verificada. Pots entrar amb normalitat.',
  'error.badCode.title': 'Aquest codi no ha funcionat',
  'error.badCode.detail':
    'Els codis duren 30 segons. Espera el següent i escriu les sis xifres.',
  'error.badBackupCode.title': 'Aquest codi de reserva no ha funcionat',
  'error.badBackupCode.detail':
    'Cada codi de reserva serveix un cop. Prova el següent sense fer servir de la llista.',
  'error.locked.title': 'Compte bloquejat una estona',
  'error.locked.detail':
    'Massa intents de verificació fallits. Per seguretat, aquest compte queda bloquejat uns minuts.',
  'error.noTwoFactor.title': 'No tens la verificació en dos passos',
  'error.noTwoFactor.detail':
    'Entra amb el teu correu i la teva contrasenya per continuar.',
  'error.twoFactorExpired.title': 'Comença de nou des de l’inici de sessió',
  'error.twoFactorExpired.detail':
    'Aquest pas de verificació ha caducat. Escriu un altre cop el correu i la contrasenya.',
  'error.invitationGone.title': 'Aquesta invitació ja no hi és',
  'error.invitationGone.detail':
    'Pot haver caducat, haver-se anul·lat o haver-se fet servir. Demana’n una de nova.',
  'error.invitationOther.title': 'Aquesta invitació és per a una altra persona',
  'error.invitationOther.detail':
    'Es va enviar a una altra adreça electrònica. Entra amb aquella per acceptar-la.',
  'error.alreadyMember.title': 'Ja ets en aquest espai de treball',
  'error.alreadyMember.detail':
    'No hi ha res per acceptar — obre’l des del selector d’espais.',
  'error.workspaceFull.title': 'Aquest espai de treball és ple',
  'error.workspaceFull.detail':
    'Ha arribat al límit de membres. Demana a un propietari que alliberi una plaça o que millori el pla.',
  'error.verifyBeforeJoin.title': 'Confirma abans el teu correu',
  'error.verifyBeforeJoin.detail':
    'Obre l’enllaç de confirmació que et vam enviar i torna a aquesta invitació.',

  'passkeyNotice.added': 'S’ha afegit una clau d’accés al teu compte',
  'passkeyNotice.removed': 'S’ha eliminat una clau d’accés del teu compte',
  'passkeyNotice.security': 'Seguretat',
  'passkeyNotice.action': 'Gestiona les claus d’accés',
  'passkeyNotice.recovery':
    'Si no reconeixes aquest canvi, canvia la contrasenya i tanca les sessions desconegudes. Restablir la contrasenya no elimina les claus d’accés. Revisa-les i elimina les que no reconeguis.',
} satisfies TranslationOf<typeof En>

export default messages
