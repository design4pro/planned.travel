/**
 * Tot el que diu la consola de la plataforma, en català.
 *
 * Escrit a partir de `../en/console.ts` (`docs/SPEC.md` §9). El fitxer anglès és l'esquema:
 * `TranslationOf<typeof En>` converteix una clau que falta o inventada en un error de compilació, i
 * `__tests__/parity.test.ts` comprova els substituts, les branques de plural i que aquí no hi quedi
 * res en anglès.
 *
 * **Registre.** Segona persona del singular amb accions en imperatiu, com a la resta del catàleg
 * català.
 *
 * **Plural.** `Intl.PluralRules('ca')` diu `one`, `many` i `other`; `many` és la branca CLDR dels
 * milions i concorda igual que `other`.
 *
 * **`audit.value.yes` i `audit.value.no` són «cert» i «fals»**: són el valor d'un camp booleà del
 * registre d'auditoria — «Correu verificat  fals → cert» — i la parella diu el mateix que l'anglès
 * sense deixar un «no» sol entre dues fletxes.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- seccions -- */

  'nav.label': 'Seccions de la consola',
  'nav.overview': 'Resum',
  'nav.overview.description': 'La plataforma d’un cop d’ull',
  'nav.accounts': 'Comptes',
  'nav.accounts.description': 'Rols, suspensions i sessions',
  'nav.runs': 'Execucions d’agents',
  'nav.runs.description': 'Què està construint la flota sandcastle',

  /* -------------------------------------------------------------- closca -- */

  'shell.eyebrow': 'Plataforma',
  'shell.title': 'Consola',
  'shell.description':
    'El producte mateix — comptes, potestats i el catàleg comú',
  'shell.signedInAs': 'Has entrat com a',
  'shell.error.title': 'La consola no s’ha carregat',
  'shell.notFound.title': 'No hi ha cap compte així',
  'shell.notFound.body':
    'Res de la plataforma no porta aquest identificador. El compte pot haver estat esborrat des que es va fer l’enllaç, o l’adreça pot estar mal copiada.',
  'shell.allAccounts': 'Tots els comptes',
  'shell.overview': 'Resum de la consola',

  'failure.fallback':
    'L’acció no ha tirat endavant. Torna-ho a provar de seguida.',

  /* --------------------------------------------------------------- resum -- */

  'overview.error.title': 'El resum no s’ha carregat',
  'overview.standing.title': 'Les teves potestats a la plataforma',
  'overview.standing.body':
    'Els comptes, les sessions i actuar en nom d’una altra persona són d’un administrador de la plataforma, així que la consola et mostra el catàleg i res més.',
  'overview.stat.accounts': 'Comptes',
  'overview.stat.accounts.caption': {
    one: 'Un d’ells porta un rol de plataforma',
    many: '{staff} d’ells porten un rol de plataforma',
    other: '{staff} d’ells porten un rol de plataforma',
  },
  'overview.stat.admins': 'Administradors',
  'overview.stat.admins.caption': 'Potestat sencera sobre comptes i sessions',
  'overview.stat.curators': 'Curadors',
  'overview.stat.curators.caption': 'Només el catàleg — mai els comptes',
  'overview.stat.suspended': 'Suspesos',
  'overview.stat.suspended.none': 'Ningú no és a fora',
  'overview.stat.suspended.some':
    'Amb la sessió tancada arreu fins que s’aixequi una suspensió',
  'overview.stat.suspended.review': 'Mira-te’ls',
  'overview.newest.label': 'Comptes més nous',
  'overview.newest.empty.title': 'Encara no hi ha comptes',
  'overview.newest.empty.body':
    'La primera persona que es registri sortirà aquí.',
  'overview.catalogue.label': 'Catàleg per estat',
  'overview.catalogue.empty.title': 'El catàleg comú encara no és obert',
  'overview.catalogue.empty.body':
    'Quan la cadena d’ingesta hi sigui, aquest plafó comptarà cada lloc del catàleg comú com a esborrany, en revisió o publicat — i cada xifra obrirà la llista que hi ha al darrere.',
  'overview.scraping.label': 'Passades de recollida',
  'overview.scraping.empty.title': 'No s’ha executat cap font',
  'overview.scraping.empty.body':
    'Les fonts es recullen cada setmana. Quan acabi la primera passada, aquí hi haurà les cinc últimes amb el que cadascuna ha ingerit, canviat i rebutjat.',

  /* ------------------------------------------------------ l’escala de rols -- */

  'role.admin': 'Administrador',
  'role.admin.summary':
    'Potestat sencera a la plataforma: comptes, rols, suspensions, sessions i actuar en nom d’una altra persona.',
  'role.admin.holds.accounts': 'Crear comptes i fixar rols de plataforma',
  'role.admin.holds.bans': 'Suspendre comptes i aixecar suspensions',
  'role.admin.holds.sessions': 'Revocar sessions i fixar contrasenyes',
  'role.admin.holds.impersonate':
    'Actuar en nom d’un compte durant quinze minuts',
  'role.admin.holds.curation': 'Tot el que pot fer un curador',
  'role.admin.withheld.admins':
    'Actuar en nom d’un altre administrador de la plataforma',
  'role.curator': 'Curador',
  'role.curator.summary':
    'El catàleg, els reculls, les fonts i la moderació dels enllaços compartits. Res que toqui els comptes.',
  'role.curator.holds.places': 'Llegir, escriure i publicar llocs del catàleg',
  'role.curator.holds.packs': 'Llegir, escriure i publicar reculls de llocs',
  'role.curator.holds.sources': 'Llegir i executar fonts del catàleg',
  'role.curator.holds.shares': 'Revisar i revocar enllaços compartits',
  'role.curator.withheld.accounts':
    'Qualsevol cosa que toqui un compte o una sessió',
  'role.curator.withheld.tokens': 'Emetre o revocar credencials de màquina',
  'role.user': 'Usuari',
  'role.user.summary': 'Cap potestat a la plataforma. És gairebé tothom.',
  'role.user.withheld.everything':
    'Tota potestat de la plataforma, sense excepció',

  /* --------------------------------------------------------- un compte -- */

  'identity.you': 'Ets tu',
  'status.active': 'Actiu',
  'status.suspended': 'Suspès',
  'status.permanent': 'Indefinida',
  'status.until': 'Fins al {date}',
  'status.unverified': 'Sense verificar',
  'device.on': '{browser} a {platform}',
  'device.unrecognised': 'Dispositiu desconegut',

  /* ---------------------------------------------------- llista de comptes -- */

  'users.error.title': 'La llista de comptes no s’ha carregat',
  'users.total': '{total} en total',
  'users.loading': 'S’estan carregant els comptes',
  'users.table.label': 'Comptes de la plataforma',
  'users.search.label': 'Cerca comptes',
  'users.search.email': 'Cerca a les adreces de correu',
  'users.search.name': 'Cerca als noms',
  'users.search.column': 'A quina columna cercar',
  'users.search.submit': 'Cerca',
  'users.field.email': 'Correu',
  'users.field.name': 'Nom',
  'users.filter.role.label': 'Filtra per rol de plataforma',
  'users.filter.role.any': 'Qualsevol rol',
  'users.filter.role.admin': 'Administradors',
  'users.filter.role.curator': 'Curadors',
  'users.filter.status.label': 'Filtra per estat del compte',
  'users.filter.status.any': 'Qualsevol estat',
  'users.filter.hint': 'Estreny per rol o per estat — un de cada vegada.',
  'users.column.account': 'Compte',
  'users.column.role': 'Rol de plataforma',
  'users.column.status': 'Estat',
  'users.column.joined': 'Alta',
  'users.column.actions': 'Accions',
  'users.joined': 'Alta el {date}',
  'users.pastEnd.title': 'Aquesta pàgina queda passat el final',
  'users.pastEnd.body': {
    one: 'En aquesta vista hi ha un compte, i la pàgina 1 és l’única que té.',
    many: 'En aquesta vista hi ha {total} comptes, és a dir {pages}. La pàgina {page} queda més enllà.',
    other:
      'En aquesta vista hi ha {total} comptes, és a dir {pages}. La pàgina {page} queda més enllà.',
  },
  'users.pastEnd.pages': {
    one: 'una sola pàgina',
    many: '{pages} pàgines',
    other: '{pages} pàgines',
  },
  'users.pastEnd.back': 'Torna a la primera pàgina',
  'users.empty.filtered.title': 'Res no encaixa amb aquests filtres',
  'users.empty.filtered.body':
    'Cap compte de la plataforma no respon a aquesta cerca. Eixampla-la, o esborra els filtres per veure’ls tots.',
  'users.empty.title': 'No hi ha comptes per mostrar',
  'users.empty.body':
    'Aquesta vista és buida. No hi ha res filtrat, així que aquí no hi ha res per eixamplar.',

  /* ------------------------------------------------------ fitxa del compte -- */

  'account.error.title': 'Aquest compte no s’ha carregat',
  'account.loading': 'S’està carregant el compte',
  'account.meta.lastChange': 'Últim canvi',
  'account.meta.id': 'Identificador del compte',
  'account.banned.title': 'Aquest compte està suspès',
  'account.banned.noReason': 'Amb la suspensió no s’hi va anotar cap motiu.',
  'account.banned.permanent':
    ' Continua vigent fins que un administrador l’aixequi.',
  'account.banned.until': ' S’aixeca tota sola el {date}.',
  'account.banned.untilUnknown': 'la seva data de venciment',
  'account.authority.label': 'Potestat a la plataforma',
  'account.authority.may': 'Pot',
  'account.authority.mayNot': 'No pot',
  'account.authority.none': 'Res a la plataforma.',
  'account.workspaces.label': 'Espais de treball',
  'account.workspaces.truncated':
    'Aquest compte pertany a més espais de treball que els {listed} que hi ha llistats aquí.',
  'account.workspaces.empty.title': 'A cap espai de treball',
  'account.workspaces.empty.body':
    'Aquest compte encara no pertany a cap espai de treball. Se n’hi crea un el primer cop que entra, i tots els que se li convidin sortiran aquí.',
  'account.workspaces.column.workspace': 'Espai de treball',
  'account.workspaces.column.role': 'Rol',
  'account.workspaces.column.plan': 'Pla',
  'account.subscription.label': 'Subscripció',
  'account.subscription.free.title': 'Al pla gratuït',
  'account.subscription.free.body':
    'L’espai de treball que té aquest compte no ha passat mai per la caixa, així que no porta cap registre de subscripció i va amb les quotes del pla gratuït.',
  'account.subscription.none.title': 'A aquest compte no se li cobra res',
  'account.subscription.none.body':
    'Aquest compte no té cap espai de treball. Ser membre de l’espai d’una altra persona no és ser a qui aquell espai factura, així que aquí no hi ha res per recollir.',
  'account.subscription.endsAtClose': 'Acaba en tancar el període',
  'account.subscription.seats': 'Places',
  'account.subscription.seatsValue': '{used} de {limit}',
  'account.subscription.ends': 'Acaba',
  'account.subscription.renews': 'Es renova',
  'account.sessions.label': 'Sessions vives',
  'account.sessions.truncated':
    'Aquest compte té més sessions de les que llista una crida. Revoca totes les sessions des del menú d’accions per assegurar-te que no en queda cap.',
  'account.sessions.empty.title': 'Amb la sessió tancada arreu',
  'account.sessions.empty.body':
    'Aquest compte no té cap sessió sense caducar. Sortirà aquí en el moment que torni a entrar.',
  'account.sessions.column.device': 'Dispositiu',
  'account.sessions.column.address': 'Adreça',
  'account.sessions.column.started': 'Inici',
  'account.sessions.column.expires': 'Caduca',
  'account.sessions.impersonated': 'Nascuda d’actuar en nom del compte',
  'account.sessions.noAddress': 'Sense anotar',
  'account.sessions.noAddressLong': 'Adreça sense anotar',
  'account.sessions.when': 'Inici {started} · caduca {expires}',
  'account.audit.label': 'Historial d’auditoria',
  'account.audit.truncated':
    'El registre guarda més entrades que aquestes. El rastre d’auditoria de la plataforma només admet afegits i es guarda quatre-cents dies.',
  'account.audit.empty.title': 'A aquest compte no li han fet res',
  'account.audit.empty.body':
    'Cada canvi de rol, suspensió, contrasenya fixada, sessió revocada i actuació en nom del compte s’escriu aquí amb el nom de qui ho ha fet. Aquest no l’ha tocat ningú.',

  /* ------------------------------------ l’escala de l’espai de treball -- */

  'workspace.role.owner': 'Propietari',
  'workspace.role.admin': 'Administrador',
  'workspace.role.member': 'Membre',
  'plan.free': 'Gratuït',
  'plan.starter': 'Inicial',
  'plan.pro': 'Professional',
  'plan.business': 'Empresa',
  'subscription.trialing': 'En prova',
  'subscription.active': 'Activa',
  'subscription.pastDue': 'Amb pagament vençut',
  'subscription.canceled': 'Cancel·lada',
  'subscription.incomplete': 'Incompleta',
  'subscription.expired': 'Caducada',
  'subscription.unpaid': 'Sense pagar',
  'subscription.paused': 'En pausa',

  /* ------------------------------------------------- registre d’auditoria -- */

  'audit.action.created': 'Compte creat',
  'audit.action.updated': 'Dades del compte canviades',
  'audit.action.roleChanged': 'Rol de plataforma canviat',
  'audit.action.banned': 'Compte suspès',
  'audit.action.unbanned': 'Suspensió aixecada',
  'audit.action.deleted': 'Compte esborrat',
  'audit.action.passwordSet': 'Contrasenya fixada per un administrador',
  'audit.action.emailSet': 'Adreça de correu canviada',
  'audit.action.impersonationStarted': 'Comença a actuar en nom del compte',
  'audit.action.impersonationEnded': 'Deixa d’actuar en nom del compte',
  'audit.action.impersonationWorkspaceChanged':
    'Canvi d’espai mentre s’actuava en nom del compte',
  'audit.action.sessionRevoked': 'S’ha revocat una sessió',
  'audit.action.sessionRevokedAll': 'S’han revocat totes les sessions',
  'audit.actor.system': 'La plataforma mateixa',
  'audit.actor.system.detail': 'automàtic',
  'audit.actor.agent': 'Una credencial de màquina',
  'audit.actor.agent.detail': 'testimoni MCP',
  'audit.actor.deleted': 'Un compte esborrat',
  'audit.actorBadge': 'Aleshores: {role}',
  'audit.field.name': 'Nom',
  'audit.field.email': 'Adreça de correu',
  'audit.field.emailVerified': 'Correu verificat',
  'audit.field.role': 'Rol de plataforma',
  'audit.field.banned': 'Suspès',
  'audit.field.banReason': 'Motiu',
  'audit.field.banExpiresAt': 'Fi de la suspensió',
  'audit.field.revoked': 'Sessions tancades',
  'audit.field.impersonating': 'Actua com a',
  'audit.field.impersonatedBy': 'Actuat per',
  'audit.field.expiresAt': 'La sessió caduca',
  'audit.field.targetRole': 'El seu rol de plataforma',
  'audit.field.sessionId': 'Sessió',
  'audit.field.organizationId': 'Espai',
  'audit.value.yes': 'cert',
  'audit.value.no': 'fals',
  'audit.value.cleared': 'buidat',
  'audit.became': 'ha passat a ser',

  /* ------------------------------------------------------------- diàlegs -- */

  'dialog.cancel': 'Cancel·la',

  'create.button': 'Compte nou',
  'create.title': 'Crea un compte',
  'create.body':
    'L’adreça no es verifica i no surt cap correu — dona la contrasenya tu mateix.',
  'create.confirm': 'Crea el compte',
  'create.name.placeholder': 'Laia Puig',
  'create.email': 'Adreça de correu',
  'create.email.placeholder': 'laia@planned.travel',
  'create.password': 'Contrasenya',
  'create.password.hint':
    'Prou llarga per ser una frase. El compte la podrà canviar després.',
  'create.done': 'Compte creat',
  'create.done.body': '{email} pot entrar amb la contrasenya que has fixat.',

  'action.menu.label': 'Accions per a {name}',
  'action.group.account': 'Compte',
  'action.group.credentials': 'Credencials',

  'action.role.item': 'Canvia el rol de plataforma',
  'action.role.self':
    'Al teu propi compte no — abaixar-te tu mateix pot deixar la plataforma sense administrador.',
  'action.role.body':
    'El que {name} pot fer a la plataforma mateixa. Pertànyer a un espai de treball és un vocabulari a part i no es mou.',
  'action.role.confirm': 'Desa el rol',
  'action.role.current': 'Actual',
  'action.role.done': 'Rol de plataforma actualitzat',
  'action.role.done.body': '{name} porta ara el rol {role} a la plataforma.',

  'action.impersonate.item': 'Actua en nom del compte',
  'action.impersonate.self':
    'No hi ha ningú en qui convertir-se — aquest és el teu propi compte.',
  'action.impersonate.banned':
    'El compte està suspès, així que no té cap sessió per posar-se.',
  'action.impersonate.admin':
    'Cap rol de la plataforma no pot actuar en nom d’un administrador, tampoc el teu.',
  'action.impersonate.title': 'Actua com a {name}',
  'action.impersonate.body':
    'Veuràs el producte exactament com el veu aquest compte, durant quinze minuts.',
  'action.impersonate.confirm': 'Comença',
  'action.impersonate.note.bar':
    'Una barra d’avís es queda a cada pantalla fins que ho acabis, i no es pot tancar.',
  'action.impersonate.note.platform':
    'Les accions de plataforma no hi són mentre actues en nom d’una altra persona — la consola inclosa.',
  'action.impersonate.note.audit':
    'El començament i el final s’escriuen tots dos al rastre d’auditoria de la plataforma, amb el teu nom a sobre.',

  'action.password.item': 'Fixa una contrasenya',
  'action.password.title': 'Fixa una contrasenya per a {name}',
  'action.password.body':
    'Fes-ho servir per recuperar un compte tancat a fora o per deixar fora un atacant d’un compte compromès.',
  'action.password.confirm': 'Fixa la contrasenya',
  'action.password.field': 'Contrasenya nova',
  'action.password.hint.self':
    'En fixar-la s’acaben totes les sessions — la teva també.',
  'action.password.hint':
    'En fixar-la s’acaben totes les sessions que té el compte.',
  'action.password.done': 'Contrasenya fixada',
  'action.password.done.body':
    'A {name} se li ha tancat la sessió a tots els dispositius.',

  'action.sessions.item': 'Revoca totes les sessions',
  'action.sessions.body.self':
    'Això et tanca la sessió a tots els dispositius, també al que estàs llegint això.',
  'action.sessions.body':
    'A {name} se li tanca la sessió a tots els dispositius i haurà de tornar a entrar.',
  'action.sessions.confirm': 'Revoca les sessions',
  'action.sessions.done': 'Sessions revocades',
  'action.sessions.done.body': {
    one: 'S’ha tancat una sessió.',
    many: 'S’han tancat {revoked} sessions.',
    other: 'S’han tancat {revoked} sessions.',
  },

  'action.ban.item': 'Suspèn el compte',
  'action.ban.self':
    'Al teu propi compte no — suspendre’t tu mateix et treu el camí de tornada.',
  'action.ban.title': 'Suspèn {name}',
  'action.ban.body':
    'Totes les sessions s’acaben de seguida i el compte no podrà tornar a entrar fins que la suspensió s’aixequi o caduqui.',
  'action.ban.confirm': 'Suspèn el compte',
  'action.ban.reason': 'Motiu',
  'action.ban.reason.hint':
    'Es guarda tretze mesos al rastre d’auditoria de la plataforma, i no es mostra a ningú tret d’un administrador.',
  'action.ban.reason.placeholder':
    'Denúncies d’abús repetides des de tres espais de treball',
  'action.ban.duration': 'Durada',
  'action.ban.duration.label': 'Durada de la suspensió',
  'action.ban.duration.permanent.body':
    'Continua vigent fins que un administrador l’aixequi expressament.',
  'action.ban.duration.day': '24 hores',
  'action.ban.duration.day.body':
    'Prou per interrompre, poc per deixar de ser una intervenció.',
  'action.ban.duration.week': '7 dies',
  'action.ban.duration.week.body': 'Una setmana per respondre una queixa.',
  'action.ban.duration.month': '30 dies',
  'action.ban.duration.month.body': 'Un mes de silenci forçat.',
  'action.ban.duration.quarter': '90 dies',
  'action.ban.duration.quarter.body':
    'El més llarg que ofereix la consola. Més enllà, suspèn de manera indefinida.',
  'action.ban.done': 'Compte suspès',
  'action.ban.done.body':
    'A {name} se li ha tancat la sessió arreu i no pot tornar a entrar.',

  'action.unban.item': 'Aixeca la suspensió',
  'action.unban.title': 'Aixeca la suspensió de {name}',
  'action.unban.body':
    'El compte pot tornar a entrar des del pròxim intent. No es recupera cap sessió anterior.',
  'action.unban.confirm': 'Aixeca la suspensió',
  'action.unban.done': 'Suspensió aixecada',
  'action.unban.done.body':
    '{name} pot tornar a entrar. No s’ha recuperat cap sessió.',

  'action.delete.item': 'Esborra el compte',
  'action.delete.self': 'Al teu propi compte no — d’allà no es torna.',
  'action.delete.title': 'Esborra {name}',
  'action.delete.body':
    'El compte, les seves sessions i totes les credencials que hi van enganxades es retiren. Això no es pot desfer.',
  'action.delete.confirm': 'Esborra el compte',
  'action.delete.note':
    'El contingut d’espai de treball que ha creat aquesta persona es queda amb l’espai que el té. Suspendre el compte en comptes d’esborrar-lo manté el registre i treu l’accés.',
  'action.delete.owners':
    'No es pot esborrar un compte que és l’únic propietari d’un espai de treball on hi ha més gent. Primer nomeneu-hi un altre propietari o suspeneu el compte en comptes d’esborrar-lo.',
  'action.delete.done': 'Compte esborrat',
  'action.delete.done.body':
    '{name} i tot el que anava enganxat al compte han desaparegut.',

  'session.revoke.label': 'Tanca la sessió de {device}',
  'session.revoke.title': 'Tanca aquesta sessió',
  'session.revoke.body':
    '{device} haurà de tornar a entrar a la pròxima petició. Si és la sessió on estàs llegint això, se’t tanca a tu amb ella.',
  'session.revoke.confirm': 'Tanca la sessió',
  'session.revoke.done': 'Sessió tancada',
  'session.revoke.done.body':
    'El dispositiu haurà de tornar a entrar a la pròxima petició.',

  /* -------------------------------------------------- execucions d’agents -- */

  'runs.error.title': 'El registre d’execucions no ha contestat',
  'runs.origin.local': 'En local',
  'runs.origin.githubActions': 'Accions de GitHub',
  'runs.stat.live': 'Execucions vives',
  'runs.stat.live.none': 'Ara mateix no s’està construint res',
  'runs.stat.live.some': 'Batega contra un lloguer de cinc minuts',
  'runs.stat.issues': 'Incidències retingudes',
  'runs.stat.issues.caption':
    'Llogades a una sola execució cadascuna, amb antecessores i subincidències',
  'runs.stat.orphans': 'Branques òrfenes',
  'runs.stat.orphans.none': 'No hi ha feina sense amo',
  'runs.stat.orphans.some':
    'Commits d’una execució que es va aturar, esperant que algú els adopti',
  'runs.live.empty.title': 'No hi ha cap execució registrada',
  'runs.live.empty.body':
    'Una execució surt aquí en el moment que es registra — des d’aquesta màquina, des d’una altra o des d’un executor de GitHub — amb les incidències que ha pres.',
  'runs.holds.nothing': 'no reté res',
  'runs.holds': 'reté {issues}',
  'runs.uptime': '{elapsed} en marxa · {lease}',
  'runs.lease.expired': 'caducat',
  'runs.lease.left': 'queden {elapsed}',
  'runs.wip.label': 'Feina en curs',
  'runs.wip.empty.title': 'Cap branca no porta feina',
  'runs.wip.empty.body':
    'Una execució anota la seva branca tan bon punt hi té commits, perquè si mor, a la següent que prengui la incidència se li ofereixi la feina en comptes de començar-la de nou.',
  'runs.wip.orphaned': 'Òrfena',
  'runs.wip.meta': {
    one: '{commits} commit · fa {elapsed}',
    many: '{commits} commits · fa {elapsed}',
    other: '{commits} commits · fa {elapsed}',
  },
  'runs.recent.label': 'Acabades fa poc',
  'runs.recent.empty.title': 'Encara no ha acabat cap execució',
  'runs.recent.empty.body':
    'Aquí es guarden les cinquanta últimes execucions amb el final que ha tingut cadascuna.',
  'runs.ago': 'fa {elapsed}',
  'runs.notCoordinator.title': 'Aquest desplegament no coordina la flota',
  'runs.notCoordinator.body':
    'El registre d’execucions està enganxat només a la preproducció, i a posta: un segon registre deixaria que dues flotes es pensessin cadascuna que té la llista pendent, que és justament el que existeix per impedir. Llegeix la flota a la preproducció.',
  'nav.providers': 'Proveïdors',
  'nav.providers.description': 'Crides sortints i els seus sostres',
  'providers.error.title':
    'No s’han pogut llegir els comptadors dels proveïdors',
  'providers.list.label': 'Serveis',
  'providers.status.planned': 'Sense integrar',
  'providers.status.planned.description':
    'Encara no hi ha res que cridi aquest servei, així que no hi ha res per comptar. Hi surt perquè el sostre s’acordi abans de la primera crida i no després de la primera factura.',
  'providers.policy.allow': 'Factura per sobre',
  'providers.policy.block': 'Rebutja en arribar al sostre',
  'providers.badge.blocked': {
    one: 'Una crida rebutjada',
    many: '{calls} crides rebutjades',
    other: '{calls} crides rebutjades',
  },
  'providers.limit.none': 'Cap sostre acordat · {used} aquest mes',
  'providers.limit.value': '{used} de {limit}',
  'providers.limit.window.day': 'Avui',
  'providers.limit.window.month': 'Aquest mes',
  'providers.measuring.none': 'Encara no s’ha mesurat res',
  'providers.measuring.since': 'Mesurant des del {date}',
  'providers.stat.calls': 'Crides aquest mes',
  'providers.stat.calls.caption': 'A tots els serveis integrats',
  'providers.stat.errors': 'Crides fallides',
  'providers.stat.errors.caption':
    'Compten també com a crides, perquè gairebé tots els proveïdors les cobren',
  'providers.stat.nearLimit': 'A prop d’un sostre',
  'providers.stat.nearLimit.caption': 'Serveis per sobre del llindar d’avís',
  'providers.stat.blocked': 'Crides rebutjades',
  'providers.stat.blocked.none': 'No s’ha rebutjat res',
  'providers.stat.blocked.some': 'Demanda rebutjada per un sostre',
  'providers.forecast.label': 'Previsió',
  'providers.forecast.provider': 'Servei',
  'providers.forecast.monthEnd': 'A final de mes',
  'providers.forecast.runRate': 'Al mes a aquest ritme',
  'providers.forecast.perWorkspace': 'Per espai de treball i mes',
  'providers.forecast.noWorkspaceTraffic':
    'No hi ha trànsit d’espais per fer la mitjana',
  'providers.forecast.window': {
    one: 'Projectat a partir d’una hora de mesura.',
    many: 'Projectat a partir de {hours} hores de mesura.',
    other: 'Projectat a partir de {hours} hores de mesura.',
  },
  'providers.forecast.tooEarly': {
    one: 'Només s’ha mesurat una hora: massa poc per projectar. Estirar menys d’un dia fins a un mes seria aritmètica, no una previsió.',
    many: 'Només s’han mesurat {hours} hores: massa poc per projectar. Estirar menys d’un dia fins a un mes seria aritmètica, no una previsió.',
    other:
      'Només s’han mesurat {hours} hores: massa poc per projectar. Estirar menys d’un dia fins a un mes seria aritmètica, no una previsió.',
  },
  'providers.forecast.atWorkspaces': 'Amb quants espais de treball',
  'providers.forecast.callsEach': 'Crides per espai i mes',
  'providers.forecast.projected': 'Unes {calls} crides al mes.',
  'providers.workspaces.label': 'Espais més actius',
  'providers.workspaces.platform': 'Plataforma (cap espai)',
  'providers.workspaces.empty.title': 'Encara no s’ha atribuït res',
  'providers.workspaces.empty.description':
    'Una crida feta per a un espai de treball se li imputa. Les tasques programades i el correu de la plataforma no són de cap i es compten a part.',
  'providers.readOnly':
    'Pots llegir aquests comptadors però no moure un sostre. Canviar un límit o la seva política requereix el permís provider:configure.',
  'providers.status.planned.agreed.month':
    'Sostre acordat: {limit} al mes. S’aplica des de la primera crida, quan hi hagi un client.',
  'providers.status.planned.agreed.day':
    'Sostre acordat: {limit} al dia. S’aplica des de la primera crida, quan hi hagi un client.',
  'providers.edit.button': 'Edita',
  'providers.edit.title': 'Sostre de {provider}',
  'providers.edit.body':
    'Què ha acordat gastar aquest desplegament amb el proveïdor, i què passa quan s’exhaureix.',
  'providers.edit.confirm': 'Desa el sostre',
  'providers.edit.done': 'Sostre desat per a {provider}',
  'providers.edit.label': 'Nom',
  'providers.edit.ceiling': 'Crides incloses',
  'providers.edit.ceiling.hint':
    'Deixa-ho buit si no hi ha sostre acordat. Buit i zero no són el mateix: zero amb «rebutja» aparta totes les crides.',
  'providers.edit.ceiling.placeholder': 'Sense sostre',
  'providers.edit.window': 'Mesurat en',
  'providers.edit.window.month': 'Un mes natural',
  'providers.edit.window.month.body': 'La forma habitual d’una quota inclosa.',
  'providers.edit.window.day': 'Un dia',
  'providers.edit.window.day.body':
    'Alguns proveïdors mesuren per dia: el pla gratuït de Geoapify són 3.000 crèdits diaris.',
  'providers.edit.policy': 'En arribar al sostre',
  'providers.edit.policy.allow': 'Continua cridant i paga',
  'providers.edit.policy.allow.body':
    'Les crides continuen per sobre del sostre i la consola avisa. No deixa de funcionar res.',
  'providers.edit.policy.block': 'Rebutja les crides següents',
  'providers.edit.policy.block.body':
    'Les crides es rebutgen fins que la finestra es reinicia. El que depèn d’aquest proveïdor deixa de funcionar: tria-ho només on aquesta fallada surti més barata.',
  'providers.edit.policy.block.refused':
    '{provider} no es pot rebutjar: no té alternativa, així que apartar-ne les crides aturaria la funció en comptes d’acotar-ne el cost. Un sostre que només avisa continua sent possible.',
  'providers.edit.warn': 'Avisa al (%)',
  'providers.edit.critical': 'Alarma al (%)',
  'providers.edit.thresholds.hint':
    'On l’indicador es torna ambre i vermell. L’avís no pot ser per sobre de l’alarma.',
} satisfies TranslationOf<typeof En>

export default messages
