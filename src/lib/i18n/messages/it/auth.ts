/**
 * Everything the authentication screens say, in Italian.
 *
 * Authored from `../en/auth.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** «Tu», as everywhere else in the Italian catalogue. These are
 * the only screens a traveller reaches with no session, so the language comes
 * from `Accept-Language` alone and every validation message has to read as
 * naturally as the headings do.
 *
 * **Plural.** `Intl.PluralRules('it')` reports `one`, `many` and `other`;
 * `many` is CLDR's branch for the millions and inflects like `other`.
 *
 * **Not translated, on purpose.** The `{provider}` of a social button is a
 * trademark; `planned.travel` is our own wordmark; and the reserved
 * `example.com` domain stays as it is while the local part becomes Italian.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/auth'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'shell.home': 'Pagina iniziale di planned.travel',
  'shell.legal':
    'Se continui accetti le condizioni del servizio e l’informativa sulla privacy di planned.travel.',

  'panel.eyebrow': 'Organizzate insieme',
  'panel.heading':
    'Ogni viaggio, dal primo segno sulla mappa all’ultima cartolina.',
  'panel.body':
    'Itinerari condivisi su una mappa vera, budget che tornano davvero, liste dei bagagli che si ricordano tutto e un diario che vale la pena tenere.',
  'panel.map.title': 'Una mappa, un programma',
  'panel.map.detail':
    'Ogni tappa, ogni alloggio e ogni trasferimento in un solo itinerario.',
  'panel.group.title': 'Tutti allo stesso passo',
  'panel.group.detail':
    'Modifiche, voti e commenti arrivano in tempo reale a tutto il gruppo.',
  'panel.costs.title': 'Conti che tornano',
  'panel.costs.detail':
    'Budget condivisi, saldi chiusi e nessun foglio di calcolo.',

  /* ------------------------------------------------------------ form pieces */
  'divider.or': 'oppure',
  'divider.orEmail': 'oppure usa la tua email',

  'social.continue': 'Continua con {provider}',
  'social.signUp': 'Iscriviti con {provider}',
  'social.opening': 'Apertura di {provider}',

  'passkey.action': 'Entra con una chiave d’accesso',
  'passkey.waiting': 'In attesa del tuo dispositivo',

  'password.show': 'Mostra la password',
  'password.hide': 'Nascondi la password',
  'password.showNew': 'Mostra la nuova password',
  'password.hideNew': 'Nascondi la nuova password',
  'password.showConfirm': 'Mostra la conferma della password',
  'password.hideConfirm': 'Nascondi la conferma della password',

  /* ----------------------------------------------------------------- fields */
  'field.email': 'Indirizzo email',
  'field.email.placeholder': 'tu@example.com',
  'field.password': 'La tua password',
  'field.password.placeholder': 'Scrivi la tua password',
  'field.newPassword': 'Nuova password',
  'field.newPassword.placeholder': 'Una frase che ricorderai',
  'field.confirmPassword': 'Conferma la password',
  'field.confirmNewPassword': 'Conferma la nuova password',
  'field.confirmPassword.placeholder': 'Scrivila ancora una volta',
  'field.name': 'Il tuo nome',
  'field.name.hint': 'Lo vedono le persone con cui organizzi i viaggi.',
  'field.name.placeholder': 'Giulia Moretti',

  /* ------------------------------------------------------------- validation */
  'validation.emailRequired': 'Scrivi il tuo indirizzo email.',
  'validation.emailTooLong': 'Questo indirizzo email è troppo lungo.',
  'validation.emailInvalid': 'Questo non sembra un indirizzo email.',
  'validation.passwordRequired': 'Scrivi la tua password.',
  'validation.passwordShort': {
    one: 'Servono almeno {value} carattere: una frase breve batte una parola furba.',
    many: 'Servono almeno {value} caratteri: una frase breve batte una parola furba.',
    other:
      'Servono almeno {value} caratteri: una frase breve batte una parola furba.',
  },
  'validation.passwordLong': {
    one: 'Resta sotto {value} carattere.',
    many: 'Resta sotto {value} caratteri.',
    other: 'Resta sotto {value} caratteri.',
  },
  'validation.passwordMismatch': 'Le due password non coincidono.',
  'validation.nameShort':
    'Scrivi il tuo nome, così i compagni di viaggio sanno chi sei.',
  'validation.nameTooLong': 'Questo nome è troppo lungo.',
  'validation.termsRequired': 'Accetta le condizioni per continuare.',
  'validation.codeLength':
    'I codici dell’app di autenticazione hanno sei cifre.',
  'validation.codeDigits':
    'I codici dell’app di autenticazione contengono solo cifre.',
  'validation.backupShort': 'Questo codice di riserva sembra troppo corto.',
  'validation.backupLong': 'Questo codice di riserva sembra troppo lungo.',

  /* ------------------------------------------------------------------ login */
  'login.eyebrow': 'Bentornato',
  'login.heading': 'Entra in planned.travel',
  'login.description':
    'Riprendi itinerari, budget e liste esattamente dove li avevi lasciati.',
  'login.newHere': 'È la prima volta?',
  'login.createAccount': 'Crea un account',
  'login.forgot': 'Hai dimenticato la password?',
  'login.remember': 'Resta collegato su questo dispositivo',
  'login.submit': 'Entra',
  'login.submitting': 'Accesso in corso',

  /* --------------------------------------------------------------- register */
  'register.eyebrow': 'Crea il tuo account',
  'register.heading': 'Comincia a organizzare in un paio di minuti',
  'register.description':
    'Un solo account per ogni viaggio, ogni compagno di strada e ogni lista.',
  'register.haveAccount': 'Hai già un account?',
  'register.signIn': 'Entra',
  'register.terms':
    'Accetto le condizioni del servizio e l’informativa sulla privacy.',
  'register.submit': 'Crea l’account',
  'register.submitting': 'Creazione del tuo account',

  'strength.hint': {
    one: 'Almeno {value} carattere. Una frase breve batte una parola furba.',
    many: 'Almeno {value} caratteri. Una frase breve batte una parola furba.',
    other: 'Almeno {value} caratteri. Una frase breve batte una parola furba.',
  },
  'strength.tooShort': 'Robustezza: troppo corta',
  'strength.weak': 'Robustezza: debole',
  'strength.fair': 'Robustezza: discreta',
  'strength.strong': 'Robustezza: solida',
  'strength.excellent': 'Robustezza: ottima',

  /* -------------------------------------------------------- forgot password */
  'forgot.eyebrow': 'Aiuto con la password',
  'forgot.heading': 'Reimposta la password',
  'forgot.description':
    'Dicci l’indirizzo del tuo account e ti mandiamo per email un link per scegliere una nuova password.',
  'forgot.submit': 'Mandami il link',
  'forgot.submitting': 'Invio del tuo link',
  'forgot.back': 'Torna all’accesso',
  'forgot.sent.eyebrow': 'Controlla la posta',
  'forgot.sent.heading': 'Il tuo link è in viaggio',
  'forgot.sent.description':
    'Se un account usa {email}, il link per scegliere una nuova password è già in quella casella.',
  'forgot.sent.title': 'Il link vale una volta sola, per un’ora',
  'forgot.sent.body':
    'Non è arrivato niente? Guarda nello spam, poi rimandalo. Chiedere un link nuovo ritira in silenzio quello precedente.',
  'forgot.sent.resend': 'Mandalo di nuovo',
  'forgot.sent.resending': 'Nuovo invio in corso',
  'forgot.sent.change': 'Usa un’altra email',

  /* --------------------------------------------------------- reset password */
  'reset.eyebrow': 'Reimpostazione della password',
  'reset.heading': 'Scegli una nuova password',
  'reset.description': {
    one: 'Scegli qualcosa di almeno {value} carattere. Una frase breve si ricorda meglio e si indovina peggio.',
    many: 'Scegli qualcosa di almeno {value} caratteri. Una frase breve si ricorda meglio e si indovina peggio.',
    other:
      'Scegli qualcosa di almeno {value} caratteri. Una frase breve si ricorda meglio e si indovina peggio.',
  },
  'reset.submit': 'Salva la nuova password',
  'reset.submitting': 'Salvataggio della password',
  'reset.back': 'Torna all’accesso',
  'reset.stale.heading': 'Questo link non si può più usare',
  'reset.stale.description':
    'I link scadono dopo un’ora e valgono una volta sola: il compromesso più sicuro possibile.',
  'reset.stale.action': 'Chiedi un link nuovo',
  'reset.done.heading': 'La tua nuova password è attiva',
  'reset.done.description':
    'Tutte le altre sessioni sono state chiuse, così chi aveva la vecchia password non ha più una porta d’ingresso.',
  'reset.done.title': 'Uscita da ogni altro dispositivo',
  'reset.done.body': 'Entra con la nuova password e riprendi a organizzare.',
  'reset.done.action': 'Entra',

  /* ------------------------------------------------------------- two-factor */
  'twoFactor.eyebrow': 'Verifica in due passaggi',
  'twoFactor.heading': 'Conferma che sei tu',
  'twoFactor.description':
    'Il tuo account è protetto da un secondo fattore. Scrivi il codice che l’app di autenticazione mostra adesso.',
  'twoFactor.back': 'Ricomincia dall’accesso',
  'twoFactor.methods': 'Metodo di verifica',
  'twoFactor.totp.tab': 'App',
  'twoFactor.totp.label': 'Codice di sei cifre',
  'twoFactor.totp.hint': 'I codici cambiano ogni 30 secondi.',
  'twoFactor.totp.submit': 'Verifica e continua',
  'twoFactor.backup.tab': 'Codice di riserva',
  'twoFactor.backup.label': 'Codice di riserva',
  'twoFactor.backup.hint':
    'Dalla lista che hai salvato quando hai attivato la verifica in due passaggi. Ogni codice vale una volta.',
  'twoFactor.backup.submit': 'Usa un codice di riserva',
  'twoFactor.submitting': 'Controllo del tuo codice',
  'twoFactor.trust.label': 'Fidati di questo dispositivo per 30 giorni',
  'twoFactor.trust.detail':
    'Fino ad allora salti questo passaggio su questo browser. Fallo solo su un dispositivo che è soltanto tuo.',

  /* ----------------------------------------------------------- verify email */
  'verify.done.eyebrow': 'Email confermata',
  'verify.done.heading': 'È tutto pronto',
  'verify.done.description':
    'Il tuo indirizzo è verificato, quindi inviti, promemoria e riepiloghi di viaggio ti arriveranno.',
  'verify.done.title': 'Verificato',
  'verify.done.body': '{email} è confermata su questo account.',
  'verify.done.bodyUnknown':
    'Il tuo indirizzo email è confermato su questo account.',
  'verify.done.action': 'Vai al tuo pannello',

  'verify.pending.eyebrow': 'Un’ultima cosa',
  'verify.pending.heading': 'Conferma il tuo indirizzo email',
  'verify.pending.description':
    'Abbiamo mandato un link di conferma a {email}. Aprirlo tiene recuperabile il tuo account e permette ai compagni di viaggio di invitarti.',
  'verify.pending.wrongAddress': 'Indirizzo sbagliato?',
  'verify.pending.changeIt': 'Cambialo nelle impostazioni',
  'verify.pending.title': 'Il link dura 24 ore',
  'verify.pending.body':
    'Niente nella posta? Guarda nello spam, poi rimandalo.',
  'verify.pending.resentTitle': 'Rimandato proprio adesso',
  'verify.pending.resentBody':
    'Dagli un minuto, poi controlla la posta — e la cartella spam.',
  'verify.pending.resend': 'Rimanda la conferma',
  'verify.pending.resending': 'Nuovo invio in corso',
  'verify.pending.continue': 'Continua lo stesso',

  'verify.request.eyebrow': 'Conferma dell’email',
  'verify.request.heading': 'Manda un nuovo link di conferma',
  'verify.request.description':
    'I link di conferma durano 24 ore e valgono una volta sola. Dicci il tuo indirizzo e ne parte uno nuovo.',
  'verify.request.submit': 'Manda il link di conferma',
  'verify.request.submitting': 'Invio del tuo link',
  'verify.request.sentTitle': 'È in viaggio',
  'verify.request.sentBody':
    'Se quell’indirizzo ha un account da confermare, il link è già nella sua casella.',
  'verify.request.change': 'Usa un’altra email',
  'verify.request.back': 'Torna all’accesso',

  /* ------------------------------------------------------------- invitation */
  'invitation.eyebrow': 'Invito a uno spazio di lavoro',
  'invitation.heading': 'Entra in {workspace}',
  'invitation.description':
    'Accettando entri in questo spazio di lavoro e condividi i suoi viaggi, i suoi budget e le sue liste.',
  'invitation.invitedAs': 'Invito per {email}',
  'invitation.role': 'Il tuo ruolo',
  'invitation.means': 'Vuol dire',
  'invitation.invitedBy': 'Invito da',
  'invitation.expires': 'Scade',
  'invitation.accept': 'Accetta l’invito',
  'invitation.accepting': 'Ingresso nello spazio di lavoro',
  'invitation.decline': 'Rifiuta',
  'invitation.declining': 'Rifiuto in corso',
  'invitation.reassurance':
    'Puoi lasciare uno spazio di lavoro quando vuoi dalle sue impostazioni, e niente di ciò che crei fuori viene mai condiviso.',

  'invitation.role.owner':
    'Proprietario — controllo completo, fatturazione inclusa',
  'invitation.role.admin':
    'Amministratore — gestisce viaggi, membri e impostazioni',
  'invitation.role.member': 'Membro — organizza i viaggi con tutti gli altri',
  'invitation.role.other':
    '{role} — accesso deciso dal proprietario dello spazio',
  'invitation.role.badge.owner': 'Proprietario',
  'invitation.role.badge.admin': 'Amministratore',
  'invitation.role.badge.member': 'Membro',

  'invitation.anonymous.heading': 'Entra per vedere il tuo invito',
  'invitation.anonymous.description':
    'Gli inviti sono legati all’indirizzo a cui sono stati mandati, quindi dobbiamo sapere chi sei prima di mostrarti questo.',
  'invitation.anonymous.body':
    'Usa l’indirizzo che ha ricevuto l’invito. Subito dopo ti riportiamo qui.',
  'invitation.anonymous.action': 'Entra per continuare',
  'invitation.anonymous.noAccount': 'Non hai ancora un account?',
  'invitation.anonymous.register': 'Creane uno con l’indirizzo invitato',

  'invitation.mismatch.heading': 'Questo invito è per un altro indirizzo',
  'invitation.mismatch.description':
    'Sei entrato con un altro account, quindi questo invito non è tuo.',
  'invitation.mismatch.title': 'Sei entrato come {email}',
  'invitation.mismatch.body':
    'Esci e rientra con l’indirizzo che ha ricevuto l’invito, oppure chiedi un invito nuovo per questo account.',
  'invitation.mismatch.action': 'Cambia account',
  'invitation.mismatch.back': 'Torna all’accesso',

  'invitation.unverified.heading': 'Conferma l’email per entrare',
  'invitation.unverified.description':
    'Gli spazi di lavoro accettano solo indirizzi confermati, così nessuno entra per un errore di battitura.',
  'invitation.unverified.title': '{email} non è ancora confermata',
  'invitation.unverified.body':
    'Apri il link di conferma nella tua posta, poi torna a questa pagina. L’invito sarà ancora qui.',
  'invitation.unverified.action': 'Conferma la mia email',
  'invitation.unverified.resend': 'Rimanda l’email di conferma',

  'invitation.unavailable.heading': 'Questo invito non è più disponibile',
  'invitation.unavailable.description':
    'Gli inviti durano sette giorni e si ritirano appena vengono usati o annullati.',
  'invitation.unavailable.title': 'Qui non c’è niente da accettare',
  'invitation.unavailable.body':
    'Chiedi a chi ti ha invitato di mandarne uno nuovo: questa pagina lo mostrerà subito.',
  'invitation.unavailable.dashboard': 'Vai al tuo pannello',

  'invitation.declined.eyebrow': 'Invito rifiutato',
  'invitation.declined.heading':
    'Nessun problema — non è stato condiviso nulla',
  'invitation.declined.description':
    'Il proprietario dello spazio di lavoro è stato avvisato e questo link non si può più usare.',
  'invitation.declined.action': 'Vai al tuo pannello',

  /* ----------------------------------------------------------------- errors */
  'error.unexpected.title': 'Qualcosa è andato storto',
  'error.unexpected.detail': 'Non ha funzionato. Riprova tra un momento.',
  'error.rateLimited.title': 'Troppi tentativi',
  'error.rateLimited.detail':
    'Per sicurezza abbiamo sospeso l’accesso da questo dispositivo per qualche minuto. Riprova a breve.',
  'error.offline.title': 'Nessuna connessione',
  'error.offline.detail':
    'Non siamo riusciti a raggiungere planned.travel. Controlla la connessione e riprova.',

  'error.credentials.title': 'Questi dati non coincidono',
  'error.credentials.detail':
    'Controlla indirizzo email e password e riprova. Se ti sei iscritto con Google o Apple, usa quel pulsante.',
  'error.password.title': 'Questi dati non coincidono',
  'error.password.detail': 'Controlla indirizzo email e password e riprova.',
  'error.noPassword.title': 'Questo account non ha una password',
  'error.noPassword.detail':
    'Questo account entra con un servizio esterno o con una passkey. Usa una delle opzioni qui sopra.',
  'error.unverified.title': 'Conferma prima la tua email',
  'error.unverified.detail':
    'Ti abbiamo mandato un link di conferma all’iscrizione. Aprilo e poi torna qui.',
  'error.emailTaken.title': 'Questa email è già registrata',
  'error.emailTaken.detail':
    'Entra invece di iscriverti, oppure reimposta la password se l’hai dimenticata.',
  'error.noAccount.title': 'Non troviamo questo account',
  'error.noAccount.detail': 'Controlla l’indirizzo, oppure creane uno nuovo.',
  'error.passwordTooShort.title': 'Password troppo corta',
  'error.passwordTooShort.detail': 'Scegli una frase più lunga e riprova.',
  'error.passwordTooLong.title': 'Password troppo lunga',
  'error.passwordTooLong.detail': 'Scegli una frase più corta e riprova.',
  'error.linkSpent.title': 'Questo link non vale più',
  'error.linkSpent.detail':
    'I link per la password valgono una volta sola. Chiedine uno nuovo e te lo mandiamo subito.',
  'error.linkExpired.title': 'Questo link è scaduto',
  'error.linkExpired.detail': 'Chiedine uno nuovo e te lo mandiamo subito.',
  'error.linkIncomplete.title': 'Questo link è incompleto',
  'error.linkIncomplete.detail':
    'I link per reimpostare la password portano un codice usa e getta. Apri l’email più recente, oppure chiedi un link nuovo.',
  'error.sessionExpired.title': 'La tua sessione è scaduta',
  'error.sessionExpired.detail': 'Entra di nuovo per riprendere da dove eri.',
  'error.alreadyVerified.title': 'Già confermata',
  'error.alreadyVerified.detail':
    'Questo indirizzo email è verificato. Puoi entrare normalmente.',
  'error.badCode.title': 'Questo codice non ha funzionato',
  'error.badCode.detail':
    'Un codice dura 30 secondi. Aspetta il prossimo e scrivi tutte e sei le cifre.',
  'error.badBackupCode.title': 'Questo codice di riserva non ha funzionato',
  'error.badBackupCode.detail':
    'Ogni codice di riserva vale una volta. Prova con il primo ancora inutilizzato della lista.',
  'error.locked.title': 'Account bloccato per un po’',
  'error.locked.detail':
    'Troppe verifiche fallite. Per sicurezza questo account resta bloccato qualche minuto.',
  'error.noTwoFactor.title': 'La verifica in due passaggi non è attiva',
  'error.noTwoFactor.detail':
    'Entra con la tua email e la tua password per continuare.',
  'error.twoFactorExpired.title': 'Ricomincia dall’accesso',
  'error.twoFactorExpired.detail':
    'Questo passaggio di verifica è scaduto. Scrivi di nuovo email e password.',
  'error.invitationGone.title': 'Questo invito non è più disponibile',
  'error.invitationGone.detail':
    'Può essere scaduto, annullato o già usato. Chiedi un invito nuovo.',
  'error.invitationOther.title': 'Questo invito è per qualcun altro',
  'error.invitationOther.detail':
    'È stato mandato a un altro indirizzo email. Entra con quello per accettarlo.',
  'error.alreadyMember.title': 'Sei già in questo spazio di lavoro',
  'error.alreadyMember.detail':
    'Non c’è niente da accettare — aprilo dal selettore degli spazi.',
  'error.workspaceFull.title': 'Questo spazio di lavoro è pieno',
  'error.workspaceFull.detail':
    'Ha raggiunto il limite di membri. Chiedi a un proprietario di liberare un posto o di cambiare piano.',
  'error.verifyBeforeJoin.title': 'Conferma prima la tua email',
  'error.verifyBeforeJoin.detail':
    'Apri il link di conferma che ti abbiamo mandato, poi torna a questo invito.',

  'passkeyNotice.added': 'È stata aggiunta una passkey al tuo account',
  'passkeyNotice.removed': 'È stata rimossa una passkey dal tuo account',
  'passkeyNotice.security': 'Sicurezza',
  'passkeyNotice.action': 'Gestisci le passkey',
  'passkeyNotice.recovery':
    'Se non riconosci questa modifica, cambia la password e termina le sessioni sconosciute. Reimpostare la password non rimuove le passkey. Controllale e rimuovi quelle che non riconosci.',
} satisfies TranslationOf<typeof En>

export default messages
