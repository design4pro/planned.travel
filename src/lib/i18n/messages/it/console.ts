/**
 * Tutto ciò che dice la console di piattaforma, in italiano.
 *
 * Scritto a partire da `../en/console.ts` (`docs/SPEC.md` §9). Il file inglese è lo schema:
 * `TranslationOf<typeof En>` rende una chiave mancante o inventata un errore di compilazione, e
 * `__tests__/parity.test.ts` controlla i segnaposto, i rami del plurale e che qui non resti nulla
 * in inglese.
 *
 * **Registro.** «Tu», come nel resto del catalogo italiano.
 *
 * **Plurale.** `Intl.PluralRules('it')` riporta `one`, `many` e `other`; `many` è il ramo CLDR dei
 * milioni e si accorda come `other`.
 *
 * **Due scale di ruoli che non si mescolano mai** (§5). Sulla piattaforma: amministratore,
 * curatore, utente. Nello spazio di lavoro: proprietario, amministratore, membro. La stessa parola
 * cade in entrambe, quindi la differenza la porta la frase intorno.
 *
 * **`audit.value.yes` e `audit.value.no` sono «vero» e «falso»**: sono il valore di un campo
 * booleano nel registro di controllo — «E-mail verificata  falso → vero» — e la coppia dice la
 * stessa cosa dell'inglese senza lasciare un «no» solo fra due frecce.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- sezioni -- */

  'nav.label': 'Sezioni della console',
  'nav.overview': 'Panoramica',
  'nav.overview.description': 'La piattaforma a colpo d’occhio',
  'nav.accounts': 'Account',
  'nav.accounts.description': 'Ruoli, sospensioni e sessioni',
  'nav.runs': 'Esecuzioni degli agenti',
  'nav.runs.description': 'Che cosa sta costruendo la flotta sandcastle',

  /* -------------------------------------------------------------- guscio -- */

  'shell.eyebrow': 'Piattaforma',
  'shell.title': 'Console della piattaforma',
  'shell.description':
    'Il prodotto in sé — account, poteri e il catalogo comune',
  'shell.signedInAs': 'Sei entrato come',
  'shell.error.title': 'La console non si è caricata',
  'shell.notFound.title': 'Nessun account con questo identificativo',
  'shell.notFound.body':
    'Nulla sulla piattaforma porta quell’identificativo. L’account può essere stato eliminato dopo che il collegamento è nato, oppure l’indirizzo è stato ricopiato male.',
  'shell.allAccounts': 'Tutti gli account',
  'shell.overview': 'Panoramica della console',

  'failure.fallback': 'L’azione non è andata a buon fine. Riprova fra poco.',

  /* ----------------------------------------------------------- panoramica -- */

  'overview.error.title': 'La panoramica non si è caricata',
  'overview.standing.title': 'I tuoi poteri sulla piattaforma',
  'overview.standing.body':
    'Account, sessioni e l’agire per conto di qualcun altro appartengono a un amministratore di piattaforma, quindi la console ti mostra il catalogo e nient’altro.',
  'overview.stat.accounts': 'Account',
  'overview.stat.accounts.caption': {
    one: 'Uno di essi porta un ruolo di piattaforma',
    many: '{staff} di essi portano un ruolo di piattaforma',
    other: '{staff} di essi portano un ruolo di piattaforma',
  },
  'overview.stat.admins': 'Amministratori',
  'overview.stat.admins.caption': 'Potere pieno su account e sessioni',
  'overview.stat.curators': 'Curatori',
  'overview.stat.curators.caption': 'Solo il catalogo — mai gli account',
  'overview.stat.suspended': 'Sospesi',
  'overview.stat.suspended.none': 'Nessuno è tagliato fuori',
  'overview.stat.suspended.some':
    'Disconnessi ovunque finché una sospensione non viene tolta',
  'overview.stat.suspended.review': 'Guardali',
  'overview.newest.label': 'Account più recenti',
  'overview.newest.empty.title': 'Ancora nessun account',
  'overview.newest.empty.body':
    'La prima persona che si registra comparirà qui.',
  'overview.catalogue.label': 'Catalogo per stato',
  'overview.catalogue.empty.title': 'Il catalogo comune non è ancora aperto',
  'overview.catalogue.empty.body':
    'Appena la catena di acquisizione sarà pronta, questo pannello conterà ogni luogo del catalogo comune come bozza, in revisione o pubblicato — e ogni cifra aprirà l’elenco che le sta dietro.',
  'overview.scraping.label': 'Passaggi di raccolta',
  'overview.scraping.empty.title': 'Nessuna fonte è stata eseguita',
  'overview.scraping.empty.body':
    'Le fonti si raccolgono ogni settimana. Quando il primo passaggio sarà finito, qui compariranno gli ultimi cinque con ciò che ognuno ha acquisito, cambiato e scartato.',

  /* -------------------------------------------------- la scala dei ruoli -- */

  'role.admin': 'Amministratore',
  'role.admin.summary':
    'Potere pieno sulla piattaforma: account, ruoli, sospensioni, sessioni e l’agire per conto di qualcun altro.',
  'role.admin.holds.accounts':
    'Creare account e assegnare i ruoli di piattaforma',
  'role.admin.holds.bans': 'Sospendere account e togliere le sospensioni',
  'role.admin.holds.sessions': 'Revocare sessioni e impostare password',
  'role.admin.holds.impersonate':
    'Agire per conto di un account per quindici minuti',
  'role.admin.holds.curation': 'Tutto ciò che può fare un curatore',
  'role.admin.withheld.admins':
    'Agire per conto di un altro amministratore di piattaforma',
  'role.curator': 'Curatore',
  'role.curator.summary':
    'Il catalogo, le raccolte, le fonti e la moderazione dei collegamenti condivisi. Nulla che tocchi gli account.',
  'role.curator.holds.places':
    'Leggere, scrivere e pubblicare i luoghi del catalogo',
  'role.curator.holds.packs':
    'Leggere, scrivere e pubblicare le raccolte di luoghi',
  'role.curator.holds.sources': 'Leggere ed eseguire le fonti del catalogo',
  'role.curator.holds.shares': 'Esaminare e revocare i collegamenti condivisi',
  'role.curator.withheld.accounts':
    'Qualunque cosa tocchi un account o una sessione',
  'role.curator.withheld.tokens': 'Emettere o revocare credenziali di macchina',
  'role.user': 'Utente',
  'role.user.summary': 'Nessun potere sulla piattaforma. È quasi chiunque.',
  'role.user.withheld.everything':
    'Ogni potere della piattaforma, senza eccezioni',

  /* --------------------------------------------------------- un account -- */

  'identity.you': 'Sei tu',
  'status.active': 'Attivo',
  'status.suspended': 'Sospeso',
  'status.permanent': 'A tempo indeterminato',
  'status.until': 'Fino al {date}',
  'status.unverified': 'Non verificata',
  'device.on': '{browser} su {platform}',
  'device.unrecognised': 'Dispositivo non riconosciuto',

  /* ---------------------------------------------------- elenco degli account -- */

  'users.error.title': 'L’elenco degli account non si è caricato',
  'users.total': '{total} in tutto',
  'users.loading': 'Caricamento degli account',
  'users.table.label': 'Account della piattaforma',
  'users.search.label': 'Cerca fra gli account',
  'users.search.email': 'Cerca negli indirizzi e-mail',
  'users.search.name': 'Cerca nei nomi',
  'users.search.column': 'In quale colonna cercare',
  'users.search.submit': 'Cerca',
  'users.field.email': 'E-mail',
  'users.field.name': 'Nome',
  'users.filter.role.label': 'Filtra per ruolo di piattaforma',
  'users.filter.role.any': 'Qualsiasi ruolo',
  'users.filter.role.admin': 'Amministratori',
  'users.filter.role.curator': 'Curatori',
  'users.filter.status.label': 'Filtra per stato dell’account',
  'users.filter.status.any': 'Qualsiasi stato',
  'users.filter.hint': 'Restringi per ruolo o per stato — uno alla volta.',
  'users.column.account': 'Utenza',
  'users.column.role': 'Ruolo di piattaforma',
  'users.column.status': 'Stato',
  'users.column.joined': 'Iscrizione',
  'users.column.actions': 'Azioni',
  'users.joined': 'Iscritto il {date}',
  'users.pastEnd.title': 'Quella pagina sta oltre la fine',
  'users.pastEnd.body': {
    one: 'In questa vista c’è un account, e la pagina 1 è l’unica che ha.',
    many: 'In questa vista ci sono {total} account, cioè {pages}. La pagina {page} sta oltre.',
    other:
      'In questa vista ci sono {total} account, cioè {pages}. La pagina {page} sta oltre.',
  },
  'users.pastEnd.pages': {
    one: 'una sola pagina',
    many: '{pages} pagine',
    other: '{pages} pagine',
  },
  'users.pastEnd.back': 'Torna alla prima pagina',
  'users.empty.filtered.title': 'Nulla corrisponde a questi filtri',
  'users.empty.filtered.body':
    'Nessun account della piattaforma risponde a questa ricerca. Allargala, oppure azzera i filtri per vederli tutti.',
  'users.empty.title': 'Nessun account da mostrare',
  'users.empty.body':
    'Questa vista è vuota. Non c’è nulla di filtrato, quindi qui non c’è nulla da allargare.',

  /* --------------------------------------------------- scheda dell’account -- */

  'account.error.title': 'Quell’account non si è caricato',
  'account.loading': 'Caricamento dell’account',
  'account.meta.lastChange': 'Ultima modifica',
  'account.meta.id': 'Identificativo dell’account',
  'account.banned.title': 'Questo account è sospeso',
  'account.banned.noReason':
    'Con la sospensione non è stato annotato alcun motivo.',
  'account.banned.permanent':
    ' Resta in vigore finché un amministratore non la toglie.',
  'account.banned.until': ' Si toglie da sola il {date}.',
  'account.banned.untilUnknown': 'la sua data di scadenza',
  'account.authority.label': 'Poteri sulla piattaforma',
  'account.authority.may': 'Può',
  'account.authority.mayNot': 'Non può',
  'account.authority.none': 'Nulla sulla piattaforma.',
  'account.workspaces.label': 'Spazi di lavoro',
  'account.workspaces.truncated':
    'Questo account appartiene a più spazi di lavoro dei {listed} elencati qui.',
  'account.workspaces.empty.title': 'In nessuno spazio di lavoro',
  'account.workspaces.empty.body':
    'Questo account non appartiene ancora ad alcuno spazio di lavoro. Ne nasce uno al primo accesso, e ogni spazio a cui viene invitato comparirà qui.',
  'account.workspaces.column.workspace': 'Spazio di lavoro',
  'account.workspaces.column.role': 'Ruolo',
  'account.workspaces.column.plan': 'Piano',
  'account.subscription.label': 'Abbonamento',
  'account.subscription.free.title': 'Sul piano gratuito',
  'account.subscription.free.body':
    'Lo spazio di lavoro di cui questo account è proprietario non è mai passato dalla cassa, quindi non porta alcuna registrazione di abbonamento e gira sui limiti del piano gratuito.',
  'account.subscription.none.title':
    'A questo account non viene fatturato nulla',
  'account.subscription.none.body':
    'Questo account non possiede alcuno spazio di lavoro. Essere membro dello spazio di qualcun altro non vuol dire essere colui a cui quello spazio fattura, quindi qui non c’è nulla da raccogliere.',
  'account.subscription.endsAtClose': 'Finisce alla chiusura del periodo',
  'account.subscription.seats': 'Posti',
  'account.subscription.seatsValue': '{used} su {limit}',
  'account.subscription.ends': 'Finisce',
  'account.subscription.renews': 'Si rinnova',
  'account.sessions.label': 'Sessioni vive',
  'account.sessions.truncated':
    'Questo account tiene più sessioni di quante ne elenchi una chiamata. Revoca tutte le sessioni dal menu delle azioni per essere sicuro che non ne resti nessuna.',
  'account.sessions.empty.title': 'Disconnesso ovunque',
  'account.sessions.empty.body':
    'Questo account non tiene alcuna sessione non scaduta. Comparirà qui appena rientrerà.',
  'account.sessions.column.device': 'Dispositivo',
  'account.sessions.column.address': 'Indirizzo',
  'account.sessions.column.started': 'Inizio',
  'account.sessions.column.expires': 'Scade',
  'account.sessions.impersonated': 'Nata da un agire per conto dell’account',
  'account.sessions.noAddress': 'Non annotato',
  'account.sessions.noAddressLong': 'Indirizzo non annotato',
  'account.sessions.when': 'Inizio {started} · scade {expires}',
  'account.audit.label': 'Storico di controllo',
  'account.audit.truncated':
    'Il registro tiene più voci di queste. La traccia di controllo della piattaforma accetta solo aggiunte e si conserva quattrocento giorni.',
  'account.audit.empty.title': 'A questo account non è stato fatto nulla',
  'account.audit.empty.body':
    'Ogni cambio di ruolo, sospensione, password impostata, sessione revocata e agire per conto dell’account si scrive qui, con sopra il nome di chi l’ha fatto. Questo non l’ha toccato nessuno.',

  /* -------------------------------------- la scala dello spazio di lavoro -- */

  'workspace.role.owner': 'Proprietario',
  'workspace.role.admin': 'Amministratore',
  'workspace.role.member': 'Membro',
  'plan.free': 'Gratuito',
  'plan.starter': 'Base',
  'plan.pro': 'Professionale',
  'plan.business': 'Azienda',
  'subscription.trialing': 'In prova',
  'subscription.pastDue': 'In ritardo di pagamento',
  'subscription.active': 'Attivo',
  'subscription.canceled': 'Disdetto',
  'subscription.incomplete': 'Incompleto',
  'subscription.expired': 'Scaduto',
  'subscription.unpaid': 'Non pagato',
  'subscription.paused': 'In pausa',

  /* -------------------------------------------------- registro di controllo -- */

  'audit.action.created': 'Account creato',
  'audit.action.updated': 'Dati dell’account cambiati',
  'audit.action.roleChanged': 'Ruolo di piattaforma cambiato',
  'audit.action.banned': 'Account sospeso',
  'audit.action.unbanned': 'Sospensione tolta',
  'audit.action.deleted': 'Account eliminato',
  'audit.action.passwordSet': 'Password impostata da un amministratore',
  'audit.action.emailSet': 'Indirizzo e-mail cambiato',
  'audit.action.impersonationStarted':
    'Inizio dell’agire per conto dell’account',
  'audit.action.impersonationEnded': 'Fine dell’agire per conto dell’account',
  'audit.action.impersonationWorkspaceChanged':
    'Cambio di spazio durante l’agire per conto dell’account',
  'audit.action.sessionRevoked': 'Una sessione è stata revocata',
  'audit.action.sessionRevokedAll': 'Tutte le sessioni sono state revocate',
  'audit.actor.system': 'La piattaforma stessa',
  'audit.actor.system.detail': 'automatico',
  'audit.actor.agent': 'Una credenziale di macchina',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Un account eliminato',
  'audit.actorBadge': 'Allora: {role}',
  'audit.field.name': 'Nome',
  'audit.field.email': 'Indirizzo e-mail',
  'audit.field.emailVerified': 'E-mail verificata',
  'audit.field.role': 'Ruolo di piattaforma',
  'audit.field.banned': 'Sospeso',
  'audit.field.banReason': 'Motivo',
  'audit.field.banExpiresAt': 'Fine della sospensione',
  'audit.field.revoked': 'Sessioni chiuse',
  'audit.field.impersonating': 'Agisce come',
  'audit.field.impersonatedBy': 'Agito da',
  'audit.field.expiresAt': 'La sessione scade',
  'audit.field.targetRole': 'Il loro ruolo di piattaforma',
  'audit.field.sessionId': 'Sessione',
  'audit.field.organizationId': 'Spazio',
  'audit.value.yes': 'vero',
  'audit.value.no': 'falso',
  'audit.value.cleared': 'svuotato',
  'audit.became': 'è diventato',

  /* ------------------------------------------------------------- finestre -- */

  'dialog.cancel': 'Annulla',

  'create.button': 'Nuovo account',
  'create.title': 'Crea un account',
  'create.body':
    'L’indirizzo non viene verificato e non parte alcuna posta — consegna tu la password.',
  'create.confirm': 'Crea account',
  'create.name.placeholder': 'Giulia Ferrari',
  'create.email': 'Indirizzo e-mail',
  'create.email.placeholder': 'giulia@planned.travel',
  'create.password': 'Password di accesso',
  'create.password.hint':
    'Abbastanza lunga da essere una frase. L’account potrà cambiarla dopo.',
  'create.done': 'Account creato',
  'create.done.body': '{email} può entrare con la password che hai impostato.',

  'action.menu.label': 'Azioni per {name}',
  'action.group.account': 'Utenza',
  'action.group.credentials': 'Credenziali',

  'action.role.item': 'Cambia il ruolo di piattaforma',
  'action.role.self':
    'Non sul tuo account — declassarti da solo può lasciare la piattaforma senza amministratore.',
  'action.role.body':
    'Ciò che {name} può fare sulla piattaforma stessa. L’appartenenza a uno spazio di lavoro è un vocabolario a parte e non si muove.',
  'action.role.confirm': 'Salva il ruolo',
  'action.role.current': 'Attuale',
  'action.role.done': 'Ruolo di piattaforma aggiornato',
  'action.role.done.body':
    '{name} porta ora il ruolo {role} sulla piattaforma.',

  'action.impersonate.item': 'Agisci per conto dell’account',
  'action.impersonate.self':
    'Non c’è nessuno in cui entrare — questo è il tuo account.',
  'action.impersonate.banned':
    'L’account è sospeso, quindi non tiene alcuna sessione da indossare.',
  'action.impersonate.admin':
    'Nessun ruolo sulla piattaforma può agire per conto di un amministratore, nemmeno il tuo.',
  'action.impersonate.title': 'Agisci come {name}',
  'action.impersonate.body':
    'Vedrai il prodotto esattamente come lo vede questo account, per quindici minuti.',
  'action.impersonate.confirm': 'Comincia',
  'action.impersonate.note.bar':
    'Una barra di avviso resta su ogni schermata finché non lo termini, e non si può chiudere.',
  'action.impersonate.note.platform':
    'Le azioni di piattaforma non sono disponibili mentre agisci per conto di qualcun altro — console compresa.',
  'action.impersonate.note.audit':
    'L’inizio e la fine si scrivono entrambi nella traccia di controllo della piattaforma, con sopra il tuo nome.',

  'action.password.item': 'Imposta una password',
  'action.password.title': 'Imposta una password per {name}',
  'action.password.body':
    'Usalo per recuperare un account chiuso fuori o per tagliare fuori un aggressore da uno compromesso.',
  'action.password.confirm': 'Imposta la password',
  'action.password.field': 'Nuova password',
  'action.password.hint.self':
    'Ogni sessione finisce quando la imposti — anche la tua.',
  'action.password.hint':
    'Ogni sessione che l’account tiene finisce quando la imposti.',
  'action.password.done': 'Password impostata',
  'action.password.done.body':
    '{name} è stato disconnesso da ogni dispositivo.',

  'action.sessions.item': 'Revoca tutte le sessioni',
  'action.sessions.body.self':
    'Questo ti disconnette da ogni dispositivo, compreso quello su cui stai leggendo.',
  'action.sessions.body':
    '{name} viene disconnesso da ogni dispositivo e dovrà rientrare.',
  'action.sessions.confirm': 'Revoca le sessioni',
  'action.sessions.done': 'Sessioni revocate',
  'action.sessions.done.body': {
    one: 'Una sessione è stata chiusa.',
    many: '{revoked} sessioni sono state chiuse.',
    other: '{revoked} sessioni sono state chiuse.',
  },

  'action.ban.item': 'Sospendi l’account',
  'action.ban.self':
    'Non sul tuo account — sospendere te stesso ti toglie la strada del ritorno.',
  'action.ban.title': 'Sospendi {name}',
  'action.ban.body':
    'Ogni sessione finisce subito e l’account non potrà rientrare finché la sospensione non viene tolta o non scade.',
  'action.ban.confirm': 'Sospendi account',
  'action.ban.reason': 'Motivo',
  'action.ban.reason.hint':
    'Tenuto tredici mesi nella traccia di controllo della piattaforma, e mostrato a nessuno tranne un amministratore.',
  'action.ban.reason.placeholder':
    'Segnalazioni di abuso ripetute da tre spazi di lavoro',
  'action.ban.duration': 'Durata',
  'action.ban.duration.label': 'Durata della sospensione',
  'action.ban.duration.permanent.body':
    'Resta in vigore finché un amministratore non la toglie di proposito.',
  'action.ban.duration.day': '24 ore',
  'action.ban.duration.day.body':
    'Abbastanza da interrompere, poco abbastanza da restare un intervento.',
  'action.ban.duration.week': '7 giorni',
  'action.ban.duration.week.body': 'Una settimana per rispondere a un reclamo.',
  'action.ban.duration.month': '30 giorni',
  'action.ban.duration.month.body': 'Un mese di silenzio imposto.',
  'action.ban.duration.quarter': '90 giorni',
  'action.ban.duration.quarter.body':
    'Il più lungo che la console offra. Oltre, sospendi a tempo indeterminato.',
  'action.ban.done': 'Account sospeso',
  'action.ban.done.body':
    '{name} è stato disconnesso ovunque e non può rientrare.',

  'action.unban.item': 'Togli la sospensione',
  'action.unban.title': 'Togli la sospensione a {name}',
  'action.unban.body':
    'L’account può rientrare dal suo prossimo tentativo. Nessuna sessione precedente viene ripristinata.',
  'action.unban.confirm': 'Togli la sospensione',
  'action.unban.done': 'Sospensione tolta',
  'action.unban.done.body':
    '{name} può rientrare. Nessuna sessione è stata ripristinata.',

  'action.delete.item': 'Elimina l’account',
  'action.delete.self': 'Non sul tuo account — da lì non si torna.',
  'action.delete.title': 'Elimina {name}',
  'action.delete.body':
    'L’account, le sue sessioni e ogni credenziale che vi è attaccata vengono rimossi. Questo non si può annullare.',
  'action.delete.confirm': 'Elimina account',
  'action.delete.note':
    'I contenuti di uno spazio di lavoro creati da questa persona restano allo spazio che li possiede. Sospendere l’account invece di eliminarlo tiene la traccia e toglie l’accesso.',
  'action.delete.owners':
    'Non si può eliminare un account che è l’unico proprietario di uno spazio di lavoro a cui appartengono altre persone. Un proprietario di quello spazio può prima nominare un altro proprietario dalla sua console dello spazio di lavoro, oppure l’account può essere sospeso.',
  'action.delete.done': 'Account eliminato',
  'action.delete.done.body':
    '{name} e tutto ciò che era attaccato all’account non ci sono più.',

  'session.revoke.label': 'Chiudi la sessione su {device}',
  'session.revoke.title': 'Chiudi questa sessione',
  'session.revoke.body':
    '{device} dovrà rientrare alla prossima richiesta. Se è la sessione in cui stai leggendo, vieni disconnesso insieme a lei.',
  'session.revoke.confirm': 'Chiudi la sessione',
  'session.revoke.done': 'Sessione chiusa',
  'session.revoke.done.body':
    'Il dispositivo dovrà rientrare alla prossima richiesta.',

  /* ------------------------------------------------ esecuzioni degli agenti -- */

  'runs.error.title': 'Il registro delle esecuzioni non ha risposto',
  'runs.origin.local': 'In locale',
  'runs.origin.githubActions': 'Azioni GitHub',
  'runs.stat.live': 'Esecuzioni vive',
  'runs.stat.live.none': 'In questo momento non si sta costruendo nulla',
  'runs.stat.live.some': 'Batte contro un affitto di cinque minuti',
  'runs.stat.issues': 'Segnalazioni tenute',
  'runs.stat.issues.caption':
    'Affittate a una sola esecuzione ciascuna, antenate e sotto-segnalazioni comprese',
  'runs.stat.orphans': 'Rami orfani',
  'runs.stat.orphans.none': 'Nessun lavoro resta senza padrone',
  'runs.stat.orphans.some':
    'Commit di un’esecuzione che si è fermata, in attesa di essere adottati',
  'runs.live.empty.title': 'Nessuna esecuzione è registrata',
  'runs.live.empty.body':
    'Un’esecuzione compare qui appena si registra — da questa macchina, da un’altra o da un esecutore GitHub — con le segnalazioni che ha preso.',
  'runs.holds.nothing': 'non tiene nulla',
  'runs.holds': 'tiene {issues}',
  'runs.uptime': '{elapsed} di attività · {lease}',
  'runs.lease.expired': 'scaduto',
  'runs.lease.left': 'restano {elapsed}',
  'runs.wip.label': 'Lavoro in corso',
  'runs.wip.empty.title': 'Nessun ramo porta lavoro',
  'runs.wip.empty.body':
    'Un’esecuzione annota il suo ramo appena vi ha dei commit, così che se muore, alla prossima che prende la segnalazione venga offerto quel lavoro invece di ricominciarlo.',
  'runs.wip.orphaned': 'Orfano',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} fa',
    many: '{commits} commit · {elapsed} fa',
    other: '{commits} commit · {elapsed} fa',
  },
  'runs.recent.label': 'Finite di recente',
  'runs.recent.empty.title': 'Nessuna esecuzione è ancora finita',
  'runs.recent.empty.body':
    'Qui restano le ultime cinquanta esecuzioni, con il modo in cui ognuna è finita.',
  'runs.ago': '{elapsed} fa',
  'runs.notCoordinator.title': 'Questo rilascio non coordina la flotta',
  'runs.notCoordinator.body':
    'Il registro delle esecuzioni è agganciato solo all’ambiente di prova, e di proposito: un secondo registro lascerebbe due flotte credere ciascuna di tenere l’arretrato, che è la cosa che esiste per impedire. Leggi la flotta sull’ambiente di prova.',
  'nav.providers': 'Fornitori',
  'nav.providers.description': 'Chiamate in uscita e i loro tetti',
  'providers.error.title':
    'Non è stato possibile leggere i contatori dei fornitori',
  'providers.list.label': 'Servizi',
  'providers.status.planned': 'Non integrato',
  'providers.status.planned.description':
    'Nulla chiama ancora questo servizio, quindi non c’è niente da contare. È elencato perché un tetto si concordi prima della prima chiamata e non dopo la prima fattura.',
  'providers.policy.allow': 'Fattura oltre il tetto',
  'providers.policy.block': 'Rifiuta al tetto',
  'providers.badge.blocked': {
    one: 'Una chiamata rifiutata',
    many: '{calls} chiamate rifiutate',
    other: '{calls} chiamate rifiutate',
  },
  'providers.limit.none': 'Nessun tetto concordato · {used} questo mese',
  'providers.limit.value': '{used} su {limit}',
  'providers.limit.window.day': 'Oggi',
  'providers.limit.window.month': 'Questo mese',
  'providers.measuring.none': 'Non è stato ancora misurato nulla',
  'providers.measuring.since': 'Misurazione dal {date}',
  'providers.stat.calls': 'Chiamate questo mese',
  'providers.stat.calls.caption': 'Su tutti i servizi integrati',
  'providers.stat.errors': 'Chiamate fallite',
  'providers.stat.errors.caption':
    'Contate anche come chiamate, perché quasi tutti i fornitori le addebitano',
  'providers.stat.nearLimit': 'Vicino a un tetto',
  'providers.stat.nearLimit.caption': 'Servizi oltre la soglia di avviso',
  'providers.stat.blocked': 'Chiamate rifiutate',
  'providers.stat.blocked.none': 'Non è stato rifiutato nulla',
  'providers.stat.blocked.some': 'Domanda rifiutata da un tetto',
  'providers.forecast.label': 'Previsione',
  'providers.forecast.provider': 'Servizio',
  'providers.forecast.monthEnd': 'A fine mese',
  'providers.forecast.runRate': 'Al mese con questo ritmo',
  'providers.forecast.perWorkspace': 'Per spazio di lavoro al mese',
  'providers.forecast.noWorkspaceTraffic':
    'Nessun traffico degli spazi da mediare',
  'providers.forecast.window': {
    one: 'Proiettato da un’ora di misurazione.',
    many: 'Proiettato da {hours} ore di misurazione.',
    other: 'Proiettato da {hours} ore di misurazione.',
  },
  'providers.forecast.tooEarly': {
    one: 'Finora è stata misurata una sola ora: troppo poco per proiettare. Estendere meno di un giorno a un mese sarebbe aritmetica, non una previsione.',
    many: 'Finora sono state misurate {hours} ore: troppo poco per proiettare. Estendere meno di un giorno a un mese sarebbe aritmetica, non una previsione.',
    other:
      'Finora sono state misurate {hours} ore: troppo poco per proiettare. Estendere meno di un giorno a un mese sarebbe aritmetica, non una previsione.',
  },
  'providers.forecast.atWorkspaces': 'Con quanti spazi di lavoro',
  'providers.forecast.callsEach': 'Chiamate per spazio al mese',
  'providers.forecast.projected': 'Circa {calls} chiamate al mese.',
  'providers.workspaces.label': 'Spazi più attivi',
  'providers.workspaces.platform': 'Piattaforma (nessuno spazio)',
  'providers.workspaces.empty.title': 'Ancora nulla di attribuito',
  'providers.workspaces.empty.description':
    'Una chiamata fatta per uno spazio di lavoro viene addebitata a quello. Il lavoro pianificato e la posta della piattaforma non appartengono a nessuno e si contano a parte.',
  'providers.readOnly':
    'Puoi leggere questi contatori ma non spostare un tetto. Cambiare un limite o la sua politica richiede il permesso provider:configure.',
  'providers.status.planned.agreed.month':
    'Tetto concordato: {limit} al mese. Vale dalla prima chiamata, appena esiste un client.',
  'providers.status.planned.agreed.day':
    'Tetto concordato: {limit} al giorno. Vale dalla prima chiamata, appena esiste un client.',
  'providers.edit.button': 'Modifica',
  'providers.edit.title': 'Tetto per {provider}',
  'providers.edit.body':
    'Quanto questa installazione ha concordato di spendere dal fornitore, e cosa accade quando si esaurisce.',
  'providers.edit.confirm': 'Salva il tetto',
  'providers.edit.done': 'Tetto salvato per {provider}',
  'providers.edit.label': 'Nome',
  'providers.edit.ceiling': 'Chiamate incluse',
  'providers.edit.ceiling.hint':
    'Lascia vuoto se non c’è un tetto concordato. Vuoto e zero sono cose diverse: zero con «rifiuta» respinge ogni chiamata.',
  'providers.edit.ceiling.placeholder': 'Nessun tetto',
  'providers.edit.window': 'Misurato su',
  'providers.edit.window.month': 'Un mese solare',
  'providers.edit.window.month.body': 'La forma consueta di una quota inclusa.',
  'providers.edit.window.day': 'Un giorno',
  'providers.edit.window.day.body':
    'Alcuni fornitori contano al giorno: il piano gratuito di Geoapify è 3.000 crediti al giorno.',
  'providers.edit.policy': 'Al tetto',
  'providers.edit.policy.allow': 'Continua a chiamare e paga',
  'providers.edit.policy.allow.body':
    'Le chiamate proseguono oltre il tetto e la console avvisa. Niente smette di funzionare.',
  'providers.edit.policy.block': 'Rifiuta le chiamate successive',
  'providers.edit.policy.block.body':
    'Le chiamate vengono respinte fino al reset della finestra. Ciò che dipende da questo fornitore smette di funzionare: scegli questa opzione solo dove è il guasto più economico.',
  'providers.edit.policy.block.refused':
    '{provider} non può essere rifiutato: non ha alternative, quindi respingere le sue chiamate fermerebbe la funzione invece di limitarne il costo. Resta possibile un tetto che si limita ad avvisare.',
  'providers.edit.warn': 'Avvisa al (%)',
  'providers.edit.critical': 'Allarme al (%)',
  'providers.edit.thresholds.hint':
    'Dove l’indicatore diventa ambra e rosso. L’avviso non può stare sopra l’allarme.',
} satisfies TranslationOf<typeof En>

export default messages
