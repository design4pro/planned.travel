/**
 * Všechno, co říká konzole platformy, česky.
 *
 * Napsáno z `../en/console.ts` (`docs/SPEC.md` §9). Anglický soubor je schéma:
 * `TranslationOf<typeof En>` udělá z chybějícího nebo vymyšleného klíče chybu překladu a
 * `__tests__/parity.test.ts` kontroluje zástupné značky, větve množného čísla a to, že tu nezůstalo
 * nic anglicky.
 *
 * **Množné číslo.** České `one` (1) · `few` (2–4) · `other` (0 a 5 výš) · `many` pro zlomky, které
 * se v češtině pojí s genitivem jednotného čísla.
 *
 * **Dvě škály rolí, které se nikdy nemíchají** (§5). Na platformě: správce, kurátor, uživatel.
 * V pracovním prostoru: vlastník, správce, člen. Totéž slovo padne v obou, takže rozdíl nese věta
 * kolem něj.
 *
 * **„Suspend“ je pozastavení, ne zablokování.** Pozastavený účet lze zase pustit dovnitř a
 * záznam auditu drží obojí; „zablokovaný“ by naznačoval trvalý stav, který produkt nemá.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- oddíly -- */

  'nav.label': 'Oddíly konzole',
  'nav.overview': 'Přehled',
  'nav.overview.description': 'Platforma na jeden pohled',
  'nav.accounts': 'Účty',
  'nav.accounts.description': 'Role, pozastavení a relace',
  'nav.runs': 'Běhy agentů',
  'nav.runs.description': 'Co staví flotila sandcastle',

  /* -------------------------------------------------------------- obal -- */

  'shell.eyebrow': 'Platforma',
  'shell.title': 'Konzole',
  'shell.description': 'Samotný produkt — účty, pravomoci a společný katalog',
  'shell.signedInAs': 'Přihlášen jako',
  'shell.error.title': 'Konzole se nenačetla',
  'shell.notFound.title': 'Takový účet neexistuje',
  'shell.notFound.body':
    'Nic na platformě nenese tento identifikátor. Účet mohl být smazán poté, co odkaz vznikl, nebo je adresa opsaná s chybou.',
  'shell.allAccounts': 'Všechny účty',
  'shell.overview': 'Přehled konzole',

  'failure.fallback': 'Akce neprošla. Zkus to za chvíli znovu.',

  /* ------------------------------------------------------------- přehled -- */

  'overview.error.title': 'Přehled se nenačetl',
  'overview.standing.title': 'Tvoje pravomoci na platformě',
  'overview.standing.body':
    'Účty, relace a jednání jménem někoho jiného patří správci platformy, takže ti konzole ukazuje katalog a nic víc.',
  'overview.stat.accounts': 'Účty',
  'overview.stat.accounts.caption': {
    one: 'Jeden z nich má roli na platformě',
    few: '{staff} z nich mají roli na platformě',
    many: '{staff} z nich má roli na platformě',
    other: '{staff} z nich má roli na platformě',
  },
  'overview.stat.admins': 'Správci',
  'overview.stat.admins.caption': 'Plná pravomoc nad účty a relacemi',
  'overview.stat.curators': 'Kurátoři',
  'overview.stat.curators.caption': 'Jen katalog — nikdy účty',
  'overview.stat.suspended': 'Pozastavené',
  'overview.stat.suspended.none': 'Nikdo není venku',
  'overview.stat.suspended.some':
    'Odhlášené všude, dokud se pozastavení nezruší',
  'overview.stat.suspended.review': 'Prohlédni si je',
  'overview.newest.label': 'Nejnovější účty',
  'overview.newest.empty.title': 'Zatím žádné účty',
  'overview.newest.empty.body': 'První, kdo se zaregistruje, se objeví tady.',
  'overview.catalogue.label': 'Katalog podle stavu',
  'overview.catalogue.empty.title': 'Společný katalog zatím není otevřený',
  'overview.catalogue.empty.body':
    'Až bude stát linka pro příjem dat, tento panel spočítá každé místo ve společném katalogu jako koncept, v revizi nebo publikované — a každé číslo otevře seznam, který za ním stojí.',
  'overview.scraping.label': 'Sběrné běhy',
  'overview.scraping.empty.title': 'Žádný zdroj nebyl spuštěn',
  'overview.scraping.empty.body':
    'Zdroje se sbírají jednou týdně. Až první běh skončí, bude tu posledních pět i s tím, co každý načetl, změnil a odmítl.',

  /* ---------------------------------------------------------- škála rolí -- */

  'role.admin': 'Správce',
  'role.admin.summary':
    'Plná pravomoc na platformě: účty, role, pozastavení, relace a jednání jménem někoho jiného.',
  'role.admin.holds.accounts': 'Zakládat účty a nastavovat role platformy',
  'role.admin.holds.bans': 'Pozastavovat účty a pozastavení rušit',
  'role.admin.holds.sessions': 'Rušit relace a nastavovat hesla',
  'role.admin.holds.impersonate': 'Jednat jménem účtu po dobu patnácti minut',
  'role.admin.holds.curation': 'Všechno, co smí kurátor',
  'role.admin.withheld.admins': 'Jednat jménem jiného správce platformy',
  'role.curator': 'Kurátor',
  'role.curator.summary':
    'Katalog, sbírky, zdroje a dohled nad sdílenými odkazy. Nic, co se dotýká účtů.',
  'role.curator.holds.places': 'Číst, zapisovat a publikovat místa z katalogu',
  'role.curator.holds.packs': 'Číst, zapisovat a publikovat sbírky míst',
  'role.curator.holds.sources': 'Číst a spouštět zdroje katalogu',
  'role.curator.holds.shares': 'Prohlížet a rušit sdílené odkazy',
  'role.curator.withheld.accounts': 'Cokoli, co se dotýká účtu nebo relace',
  'role.curator.withheld.tokens':
    'Vydávat nebo rušit strojové přihlašovací údaje',
  'role.user': 'Uživatel',
  'role.user.summary': 'Vůbec žádná pravomoc na platformě. To je skoro každý.',
  'role.user.withheld.everything': 'Každá pravomoc platformy, bez výjimky',

  /* ---------------------------------------------------------- jeden účet -- */

  'identity.you': 'To jsi ty',
  'status.active': 'Aktivní',
  'status.suspended': 'Pozastavený',
  'status.permanent': 'Bez konce',
  'status.until': 'Do {date}',
  'status.unverified': 'Nepotvrzený',
  'device.on': '{browser} na {platform}',
  'device.unrecognised': 'Neznámé zařízení',

  /* --------------------------------------------------------- seznam účtů -- */

  'users.error.title': 'Seznam účtů se nenačetl',
  'users.total': 'celkem {total}',
  'users.loading': 'Načítají se účty',
  'users.table.label': 'Účty platformy',
  'users.search.label': 'Hledat účty',
  'users.search.email': 'Hledat v e-mailových adresách',
  'users.search.name': 'Hledat ve jménech',
  'users.search.column': 'Ve kterém sloupci hledat',
  'users.search.submit': 'Hledat',
  'users.field.email': 'E-mail',
  'users.field.name': 'Jméno',
  'users.filter.role.label': 'Filtrovat podle role na platformě',
  'users.filter.role.any': 'Jakákoli role',
  'users.filter.role.admin': 'Správci',
  'users.filter.role.curator': 'Kurátoři',
  'users.filter.status.label': 'Filtrovat podle stavu účtu',
  'users.filter.status.any': 'Jakýkoli stav',
  'users.filter.hint': 'Zužuj podle role nebo podle stavu — vždy po jednom.',
  'users.column.account': 'Účet',
  'users.column.role': 'Role na platformě',
  'users.column.status': 'Stav',
  'users.column.joined': 'Registrace',
  'users.column.actions': 'Akce',
  'users.joined': 'Registrace {date}',
  'users.pastEnd.title': 'Tahle stránka je za koncem',
  'users.pastEnd.body': {
    one: 'V tomhle pohledu je jeden účet a stránka 1 je jediná, kterou má.',
    few: 'V tomhle pohledu jsou {total} účty, což je {pages}. Stránka {page} leží za tím.',
    many: 'V tomhle pohledu je {total} účtu, což je {pages}. Stránka {page} leží za tím.',
    other:
      'V tomhle pohledu je {total} účtů, což je {pages}. Stránka {page} leží za tím.',
  },
  'users.pastEnd.pages': {
    one: 'jediná stránka',
    few: '{pages} stránky',
    many: '{pages} stránky',
    other: '{pages} stránek',
  },
  'users.pastEnd.back': 'Zpět na první stránku',
  'users.empty.filtered.title': 'Těmto filtrům nic neodpovídá',
  'users.empty.filtered.body':
    'Žádný účet na platformě tomuhle hledání neodpovídá. Rozšiř ho, nebo vymaž filtry, ať uvidíš všechny.',
  'users.empty.title': 'Není co ukázat',
  'users.empty.body':
    'Tenhle pohled je prázdný. Nic není odfiltrované, takže tu není co rozšiřovat.',

  /* --------------------------------------------------------- stránka účtu -- */

  'account.error.title': 'Tenhle účet se nenačetl',
  'account.loading': 'Načítá se účet',
  'account.meta.lastChange': 'Poslední změna',
  'account.meta.id': 'Identifikátor účtu',
  'account.banned.title': 'Tenhle účet je pozastavený',
  'account.banned.noReason': 'K pozastavení nebyl zapsán žádný důvod.',
  'account.banned.permanent': ' Platí, dokud ho správce nezruší.',
  'account.banned.until': ' Samo skončí {date}.',
  'account.banned.untilUnknown': 'v den, kdy vyprší',
  'account.authority.label': 'Pravomoci na platformě',
  'account.authority.may': 'Smí',
  'account.authority.mayNot': 'Nesmí',
  'account.authority.none': 'Nic na platformě.',
  'account.workspaces.label': 'Pracovní prostory',
  'account.workspaces.truncated':
    'Tenhle účet patří do víc pracovních prostorů, než je těch {listed} vypsaných tady.',
  'account.workspaces.empty.title': 'V žádném pracovním prostoru',
  'account.workspaces.empty.body':
    'Tenhle účet zatím nepatří do žádného pracovního prostoru. Jeden vznikne při prvním přihlášení a každý, do kterého ho pozvou, se objeví tady.',
  'account.workspaces.column.workspace': 'Pracovní prostor',
  'account.workspaces.column.role': 'Role v prostoru',
  'account.workspaces.column.plan': 'Tarif',
  'account.subscription.label': 'Předplatné',
  'account.subscription.free.title': 'Na tarifu zdarma',
  'account.subscription.free.body':
    'Pracovní prostor, který tenhle účet vlastní, nikdy neprošel pokladnou, takže nenese žádný záznam o předplatném a běží na limitech tarifu zdarma.',
  'account.subscription.none.title': 'Tomuhle účtu se nic neúčtuje',
  'account.subscription.none.body':
    'Tenhle účet nevlastní žádný pracovní prostor. Být členem cizího prostoru neznamená být tím, komu ten prostor fakturuje, takže tu není co sbírat.',
  'account.subscription.endsAtClose': 'Končí s koncem období',
  'account.subscription.seats': 'Místa',
  'account.subscription.seatsValue': '{used} z {limit}',
  'account.subscription.ends': 'Končí',
  'account.subscription.renews': 'Obnoví se',
  'account.sessions.label': 'Živé relace',
  'account.sessions.truncated':
    'Tenhle účet drží víc relací, než vypíše jedno volání. Zruš všechny relace z nabídky akcí, ať máš jistotu, že žádná nezůstala.',
  'account.sessions.empty.title': 'Odhlášený všude',
  'account.sessions.empty.body':
    'Tenhle účet nedrží žádnou relaci, které by nevypršela platnost. Objeví se tu ve chvíli, kdy se zase přihlásí.',
  'account.sessions.column.device': 'Zařízení',
  'account.sessions.column.address': 'Adresa',
  'account.sessions.column.started': 'Začátek',
  'account.sessions.column.expires': 'Vyprší',
  'account.sessions.impersonated': 'Vznikla jednáním jménem účtu',
  'account.sessions.noAddress': 'Nezapsána',
  'account.sessions.noAddressLong': 'Adresa nezapsána',
  'account.sessions.when': 'Začátek {started} · vyprší {expires}',
  'account.audit.label': 'Historie auditu',
  'account.audit.truncated':
    'Záznam drží víc položek než tyhle. Auditní stopa platformy se jen doplňuje a uchovává se čtyři sta dní.',
  'account.audit.empty.title': 'S tímhle účtem nikdo nic neudělal',
  'account.audit.empty.body':
    'Každá změna role, pozastavení, nastavení hesla, zrušení relace i jednání jménem účtu se píše sem, se jménem toho, kdo to udělal. Tenhle se nikdo nedotkl.',

  /* ----------------------------------------- škála pracovního prostoru -- */

  'workspace.role.owner': 'Vlastník',
  'workspace.role.admin': 'Správce',
  'workspace.role.member': 'Člen',
  'plan.free': 'Zdarma',
  'plan.starter': 'Začátek',
  'plan.pro': 'Profi',
  'plan.business': 'Firma',
  'subscription.trialing': 'Ve zkušební době',
  'subscription.active': 'Aktivní',
  'subscription.pastDue': 'Po splatnosti',
  'subscription.canceled': 'Zrušené',
  'subscription.incomplete': 'Neúplné',
  'subscription.expired': 'Vypršelé',
  'subscription.unpaid': 'Nezaplacené',
  'subscription.paused': 'Pozastavené',

  /* -------------------------------------------------------- záznam auditu -- */

  'audit.action.created': 'Účet založen',
  'audit.action.updated': 'Údaje účtu změněny',
  'audit.action.roleChanged': 'Role na platformě změněna',
  'audit.action.banned': 'Účet pozastaven',
  'audit.action.unbanned': 'Pozastavení zrušeno',
  'audit.action.deleted': 'Účet smazán',
  'audit.action.passwordSet': 'Heslo nastaveno správcem',
  'audit.action.emailSet': 'E-mailová adresa změněna',
  'audit.action.impersonationStarted': 'Začalo jednání jménem účtu',
  'audit.action.impersonationEnded': 'Jednání jménem účtu skončilo',
  'audit.action.impersonationWorkspaceChanged':
    'Změna prostoru při jednání jménem účtu',
  'audit.action.sessionRevoked': 'Jedna relace byla zrušena',
  'audit.action.sessionRevokedAll': 'Všechny relace byly zrušeny',
  'audit.actor.system': 'Samotná platforma',
  'audit.actor.system.detail': 'automaticky',
  'audit.actor.agent': 'Strojové přihlašovací údaje',
  'audit.actor.agent.detail': 'token MCP',
  'audit.actor.deleted': 'Smazaný účet',
  'audit.actorBadge': 'Tehdy: {role}',
  'audit.field.name': 'Jméno',
  'audit.field.email': 'E-mailová adresa',
  'audit.field.emailVerified': 'E-mail potvrzen',
  'audit.field.role': 'Role na platformě',
  'audit.field.banned': 'Pozastaveno',
  'audit.field.banReason': 'Důvod',
  'audit.field.banExpiresAt': 'Konec pozastavení',
  'audit.field.revoked': 'Ukončené relace',
  'audit.field.impersonating': 'Jedná jako',
  'audit.field.impersonatedBy': 'Jednal',
  'audit.field.expiresAt': 'Relace vyprší',
  'audit.field.targetRole': 'Jejich role na platformě',
  'audit.field.sessionId': 'Relace',
  'audit.field.organizationId': 'Prostor',
  'audit.value.yes': 'ano',
  'audit.value.no': 'ne',
  'audit.value.cleared': 'vyprázdněno',
  'audit.became': 'se změnilo na',

  /* ------------------------------------------------------------- dialogy -- */

  'dialog.cancel': 'Zrušit',

  'create.button': 'Nový účet',
  'create.title': 'Založit účet',
  'create.body':
    'Adresa se nepotvrzuje a žádná pošta neodchází — heslo předej sám.',
  'create.confirm': 'Založit účet',
  'create.name.placeholder': 'Tereza Nováková',
  'create.email': 'E-mailová adresa',
  'create.email.placeholder': 'tereza@planned.travel',
  'create.password': 'Heslo',
  'create.password.hint':
    'Dost dlouhé, aby to byla věta. Účet si ho pak může změnit.',
  'create.done': 'Účet založen',
  'create.done.body': '{email} se může přihlásit heslem, které jsi nastavil.',

  'action.menu.label': 'Akce pro {name}',
  'action.group.account': 'Účet',
  'action.group.credentials': 'Přihlašovací údaje',

  'action.role.item': 'Změnit roli na platformě',
  'action.role.self':
    'Ne na vlastním účtu — sesadit sám sebe může nechat platformu bez správce.',
  'action.role.body':
    'Co {name} smí na samotné platformě. Členství v pracovním prostoru je zvláštní slovník a nehýbe se s tím.',
  'action.role.confirm': 'Uložit roli',
  'action.role.current': 'Nyní',
  'action.role.done': 'Role na platformě upravena',
  'action.role.done.body': '{name} má teď na platformě roli {role}.',

  'action.impersonate.item': 'Jednat jménem účtu',
  'action.impersonate.self': 'Není kým se stát — tohle je tvůj vlastní účet.',
  'action.impersonate.banned':
    'Účet je pozastavený, takže nedrží žádnou relaci, kterou by šlo obléknout.',
  'action.impersonate.admin':
    'Žádná role na platformě nesmí jednat jménem správce, ani ta tvoje.',
  'action.impersonate.title': 'Jednat jako {name}',
  'action.impersonate.body':
    'Uvidíš produkt přesně tak, jak ho vidí tenhle účet, po dobu patnácti minut.',
  'action.impersonate.confirm': 'Začít',
  'action.impersonate.note.bar':
    'Varovný pruh zůstane na každé obrazovce, dokud to neukončíš, a nejde zavřít.',
  'action.impersonate.note.platform':
    'Akce platformy nejsou dostupné, dokud jednáš jménem někoho jiného — konzole taky ne.',
  'action.impersonate.note.audit':
    'Začátek i konec se píší do auditní stopy platformy, se tvým jménem.',

  'action.password.item': 'Nastavit heslo',
  'action.password.title': 'Nastavit heslo pro {name}',
  'action.password.body':
    'Použij to k vrácení uzamčeného účtu nebo k odříznutí útočníka od účtu, který převzal.',
  'action.password.confirm': 'Nastavit heslo',
  'action.password.field': 'Nové heslo',
  'action.password.hint.self':
    'Při nastavení skončí každá relace — i ta tvoje.',
  'action.password.hint':
    'Při nastavení skončí každá relace, kterou účet drží.',
  'action.password.done': 'Heslo nastaveno',
  'action.password.done.body': '{name} byl odhlášen ze všech zařízení.',

  'action.sessions.item': 'Zrušit všechny relace',
  'action.sessions.body.self':
    'Tohle tě odhlásí ze všech zařízení, i z toho, na kterém to čteš.',
  'action.sessions.body':
    '{name} je odhlášen ze všech zařízení a musí se přihlásit znovu.',
  'action.sessions.confirm': 'Zrušit relace',
  'action.sessions.done': 'Relace zrušeny',
  'action.sessions.done.body': {
    one: 'Jedna relace byla ukončena.',
    few: '{revoked} relace byly ukončeny.',
    many: '{revoked} relace bylo ukončeno.',
    other: '{revoked} relací bylo ukončeno.',
  },

  'action.ban.item': 'Pozastavit účet',
  'action.ban.self':
    'Ne na vlastním účtu — pozastavit sám sebe ti bere cestu zpátky.',
  'action.ban.title': 'Pozastavit {name}',
  'action.ban.body':
    'Každá relace okamžitě skončí a účet se nepřihlásí, dokud se pozastavení nezruší nebo nevyprší.',
  'action.ban.confirm': 'Pozastavit účet',
  'action.ban.reason': 'Důvod',
  'action.ban.reason.hint':
    'Drží se třináct měsíců v auditní stopě platformy a ukazuje se jen správci.',
  'action.ban.reason.placeholder':
    'Opakovaná hlášení o zneužití ze tří pracovních prostorů',
  'action.ban.duration': 'Doba',
  'action.ban.duration.label': 'Doba pozastavení',
  'action.ban.duration.permanent.body':
    'Platí, dokud ho správce vědomě nezruší.',
  'action.ban.duration.day': '24 hodin',
  'action.ban.duration.day.body':
    'Dost dlouho na přerušení, dost krátce na to, aby to byl zásah.',
  'action.ban.duration.week': '7 dní',
  'action.ban.duration.week.body': 'Týden na odpověď na stížnost.',
  'action.ban.duration.month': '30 dní',
  'action.ban.duration.month.body': 'Měsíc vynuceného ticha.',
  'action.ban.duration.quarter': '90 dní',
  'action.ban.duration.quarter.body':
    'Nejdelší, co konzole nabízí. Nad to pozastav bez konce.',
  'action.ban.done': 'Účet pozastaven',
  'action.ban.done.body':
    '{name} byl všude odhlášen a nemůže se znovu přihlásit.',

  'action.unban.item': 'Zrušit pozastavení',
  'action.unban.title': 'Zrušit pozastavení účtu {name}',
  'action.unban.body':
    'Účet se může přihlásit hned při dalším pokusu. Žádná dřívější relace se nevrací.',
  'action.unban.confirm': 'Zrušit pozastavení',
  'action.unban.done': 'Pozastavení zrušeno',
  'action.unban.done.body':
    '{name} se může zase přihlásit. Žádná relace nebyla obnovena.',

  'action.delete.item': 'Smazat účet',
  'action.delete.self': 'Ne na vlastním účtu — odtamtud není návratu.',
  'action.delete.title': 'Smazat {name}',
  'action.delete.body':
    'Účet, jeho relace a každé přihlašovací údaje, které na něm visí, se odstraní. Tohle nejde vzít zpět.',
  'action.delete.confirm': 'Smazat účet',
  'action.delete.note':
    'Obsah pracovního prostoru, který tenhle člověk vytvořil, zůstává prostoru, který ho vlastní. Pozastavit účet místo smazání zachová záznam a vezme přístup.',
  'action.delete.owners':
    'Tento účet je jediným vlastníkem prostoru s dalšími členy. Požádejte vlastníka, aby nejprve v konzoli prostoru povýšil jiného člena na vlastníka, nebo účet pozastavte.',
  'action.delete.done': 'Účet smazán',
  'action.delete.done.body': '{name} i všechno, co na účtu viselo, je pryč.',

  'session.revoke.label': 'Ukončit relaci na zařízení {device}',
  'session.revoke.title': 'Ukončit tuhle relaci',
  'session.revoke.body':
    'Zařízení {device} se při dalším požadavku musí přihlásit znovu. Pokud je to relace, ve které tohle čteš, odhlásíš se s ní.',
  'session.revoke.confirm': 'Ukončit relaci',
  'session.revoke.done': 'Relace ukončena',
  'session.revoke.done.body':
    'Zařízení se při dalším požadavku musí přihlásit znovu.',

  /* --------------------------------------------------------- běhy agentů -- */

  'runs.error.title': 'Registr běhů neodpověděl',
  'runs.origin.local': 'Místně',
  'runs.origin.githubActions': 'Akce GitHubu',
  'runs.stat.live': 'Živé běhy',
  'runs.stat.live.none': 'Právě teď se nic nestaví',
  'runs.stat.live.some': 'Tluče proti pětiminutové výpůjčce',
  'runs.stat.issues': 'Držené úkoly',
  'runs.stat.issues.caption':
    'Půjčené vždy jednomu běhu, i s předky a podúkoly',
  'runs.stat.orphans': 'Osiřelé větve',
  'runs.stat.orphans.none': 'Žádná práce neleží bez pána',
  'runs.stat.orphans.some':
    'Commity z běhu, který se zastavil, čekající na převzetí',
  'runs.live.empty.title': 'Žádný běh není zapsán',
  'runs.live.empty.body':
    'Běh se tu objeví ve chvíli, kdy se zapíše — z tohoto stroje, z jiného nebo ze spouštěče GitHubu — i s úkoly, které si vzal.',
  'runs.holds.nothing': 'nedrží nic',
  'runs.holds': 'drží {issues}',
  'runs.uptime': 'běží {elapsed} · {lease}',
  'runs.lease.expired': 'vypršela',
  'runs.lease.left': 'zbývá {elapsed}',
  'runs.wip.label': 'Rozdělaná práce',
  'runs.wip.empty.title': 'Žádná větev nenese práci',
  'runs.wip.empty.body':
    'Běh si zapíše větev, jakmile na ní má commity, aby po jeho smrti dostal další, kdo si úkol vezme, tuhle práci místo toho, aby začínal znovu.',
  'runs.wip.orphaned': 'Osiřelá',
  'runs.wip.meta': {
    one: '{commits} commit · před {elapsed}',
    few: '{commits} commity · před {elapsed}',
    many: '{commits} commitu · před {elapsed}',
    other: '{commits} commitů · před {elapsed}',
  },
  'runs.recent.label': 'Nedávno dokončené',
  'runs.recent.empty.title': 'Zatím žádný běh neskončil',
  'runs.recent.empty.body':
    'Drží se tu posledních padesát běhů i s tím, jak každý skončil.',
  'runs.ago': 'před {elapsed}',
  'runs.notCoordinator.title': 'Tohle nasazení flotilu neřídí',
  'runs.notCoordinator.body':
    'Registr běhů je napojený jen na testovací prostředí, a to schválně: druhý registr by nechal dvě flotily věřit, že každá drží frontu — a přesně tomu má bránit. Flotilu čti na testovacím prostředí.',
  'nav.providers': 'Poskytovatelé',
  'nav.providers.description': 'Odchozí volání a jejich stropy',
  'providers.error.title': 'Měřidla poskytovatelů se nepodařilo načíst',
  'providers.list.label': 'Služby',
  'providers.status.planned': 'Nezapojeno',
  'providers.status.planned.description':
    'Tuhle službu zatím nic nevolá, takže není co počítat. Je tu proto, aby se strop dohodl před prvním voláním, a ne až po první faktuře.',
  'providers.policy.allow': 'Účtuje i nad strop',
  'providers.policy.block': 'Odmítá po dosažení stropu',
  'providers.badge.blocked': {
    one: 'Jedno volání odmítnuto',
    few: '{calls} volání odmítnuta',
    many: '{calls} volání odmítnuto',
    other: '{calls} volání odmítnuto',
  },
  'providers.limit.none': 'Žádný dohodnutý strop · {used} tento měsíc',
  'providers.limit.value': '{used} z {limit}',
  'providers.limit.window.day': 'Dnes',
  'providers.limit.window.month': 'Tento měsíc',
  'providers.measuring.none': 'Zatím nic naměřeno',
  'providers.measuring.since': 'Měříme od {date}',
  'providers.stat.calls': 'Volání tento měsíc',
  'providers.stat.calls.caption': 'Napříč všemi zapojenými službami',
  'providers.stat.errors': 'Neúspěšná volání',
  'providers.stat.errors.caption':
    'Počítají se také jako volání, protože je většina poskytovatelů účtuje',
  'providers.stat.nearLimit': 'Blízko stropu',
  'providers.stat.nearLimit.caption': 'Služby nad svým varovným prahem',
  'providers.stat.blocked': 'Odmítnutá volání',
  'providers.stat.blocked.none': 'Nic nebylo odmítnuto',
  'providers.stat.blocked.some': 'Poptávka odmítnutá stropem',
  'providers.forecast.label': 'Předpověď',
  'providers.forecast.provider': 'Služba',
  'providers.forecast.monthEnd': 'Do konce měsíce',
  'providers.forecast.runRate': 'Měsíčně při tomto tempu',
  'providers.forecast.perWorkspace': 'Na pracovní prostor za měsíc',
  'providers.forecast.noWorkspaceTraffic':
    'Není provoz pracovních prostorů, ze kterého počítat průměr',
  'providers.forecast.window': {
    one: 'Odhad z jedné hodiny měření.',
    few: 'Odhad z {hours} h měření.',
    many: 'Odhad z {hours} h měření.',
    other: 'Odhad z {hours} h měření.',
  },
  'providers.forecast.tooEarly': {
    one: 'Zatím naměřena jediná hodina — na odhad málo. Roztáhnout necelý den na měsíc by byla aritmetika, ne předpověď.',
    few: 'Zatím naměřeno {hours} h — na odhad málo. Roztáhnout necelý den na měsíc by byla aritmetika, ne předpověď.',
    many: 'Zatím naměřeno {hours} h — na odhad málo. Roztáhnout necelý den na měsíc by byla aritmetika, ne předpověď.',
    other:
      'Zatím naměřeno {hours} h — na odhad málo. Roztáhnout necelý den na měsíc by byla aritmetika, ne předpověď.',
  },
  'providers.forecast.atWorkspaces': 'Při kolika pracovních prostorech',
  'providers.forecast.callsEach': 'Volání na prostor za měsíc',
  'providers.forecast.projected': 'Asi {calls} volání měsíčně.',
  'providers.workspaces.label': 'Nejvytíženější prostory',
  'providers.workspaces.platform': 'Platforma (bez prostoru)',
  'providers.workspaces.empty.title': 'Zatím nic nepřiřazeno',
  'providers.workspaces.empty.description':
    'Volání provedené pro pracovní prostor se připíše jemu. Naplánované úlohy a pošta platformy nepatří žádnému a počítají se zvlášť.',
  'providers.readOnly':
    'Tato měřidla můžeš číst, ale strop neposuneš. Změna limitu nebo jeho politiky vyžaduje oprávnění provider:configure.',
  'providers.status.planned.agreed.month':
    'Dohodnutý strop: {limit} měsíčně. Platí od prvního volání, jakmile bude klient.',
  'providers.status.planned.agreed.day':
    'Dohodnutý strop: {limit} denně. Platí od prvního volání, jakmile bude klient.',
  'providers.edit.button': 'Upravit',
  'providers.edit.title': 'Strop pro {provider}',
  'providers.edit.body':
    'Kolik se tato instalace zavázala u poskytovatele utratit a co se stane, až se to vyčerpá.',
  'providers.edit.confirm': 'Uložit strop',
  'providers.edit.done': 'Strop pro {provider} uložen',
  'providers.edit.label': 'Název',
  'providers.edit.ceiling': 'Zahrnutá volání',
  'providers.edit.ceiling.hint':
    'Nech prázdné, pokud strop není dohodnutý. Prázdné a nula nejsou totéž: nula při „odmítat“ odmítne každé volání.',
  'providers.edit.ceiling.placeholder': 'Bez stropu',
  'providers.edit.window': 'Měřeno za',
  'providers.edit.window.month': 'Kalendářní měsíc',
  'providers.edit.window.month.body': 'Obvyklý tvar zahrnuté kvóty.',
  'providers.edit.window.day': 'Den',
  'providers.edit.window.day.body':
    'Někteří poskytovatelé měří po dnech — bezplatný plán Geoapify je 3 000 kreditů denně.',
  'providers.edit.policy': 'Po dosažení stropu',
  'providers.edit.policy.allow': 'Volat dál a platit',
  'providers.edit.policy.allow.body':
    'Volání pokračují nad strop a konzole varuje. Nic nepřestane fungovat.',
  'providers.edit.policy.block': 'Odmítat další volání',
  'providers.edit.policy.block.body':
    'Volání se odmítají, dokud se okno neresetuje. Co na tomto poskytovateli závisí, přestane fungovat — vol to jen tam, kde je to levnější porucha.',
  'providers.edit.policy.block.refused':
    '{provider} odmítat nelze: nemá záložní cestu, takže odříznutí volání by funkci zastavilo, ne zlevnilo. Strop, který jen varuje, je stále k dispozici.',
  'providers.edit.warn': 'Varovat při (%)',
  'providers.edit.critical': 'Alarm při (%)',
  'providers.edit.thresholds.hint':
    'Kde ukazatel zežloutne a zčervená. Varování nesmí být nad alarmem.',
} satisfies TranslationOf<typeof En>

export default messages
