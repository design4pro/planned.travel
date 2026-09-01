/**
 * Allt som plattformskonsolen säger, på svenska.
 *
 * Skrivet utifrån `../en/console.ts` (`docs/SPEC.md` §9). Den engelska filen är schemat:
 * `TranslationOf<typeof En>` gör en saknad eller påhittad nyckel till ett kompileringsfel, och
 * `__tests__/parity.test.ts` kontrollerar platshållarna, pluralgrenarna och att inget engelskt
 * blivit kvar här.
 *
 * **Tilltal.** Du, som i resten av den svenska katalogen.
 *
 * **Plural.** `Intl.PluralRules('sv')` rapporterar `one` och `other`.
 *
 * **Två rollskalor som aldrig blandas** (§5). På plattformen: administratör, redaktör, användare.
 * I arbetsytan: ägare, administratör, medlem. Samma ord faller i båda, så det är meningen runt
 * omkring som bär skillnaden.
 *
 * **Plattformsrollen heter «redaktör», inte «kurator».** En kurator är på svenska en person som
 * arbetar med socialt stöd — helt fel läsning för den som skriver och publicerar katalogen.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------ avsnitt -- */

  'nav.label': 'Konsolens avsnitt',
  'nav.overview': 'Översikt',
  'nav.overview.description': 'Plattformen i ett ögonkast',
  'nav.accounts': 'Konton',
  'nav.accounts.description': 'Roller, avstängningar och sessioner',
  'nav.runs': 'Agentkörningar',
  'nav.runs.description': 'Vad sandcastle-flottan bygger',

  /* --------------------------------------------------------------- skal -- */

  'shell.eyebrow': 'Plattform',
  'shell.title': 'Konsol',
  'shell.description':
    'Själva produkten — konton, befogenheter och den gemensamma katalogen',
  'shell.signedInAs': 'Inloggad som',
  'shell.error.title': 'Konsolen laddades inte',
  'shell.notFound.title': 'Det finns inget sådant konto',
  'shell.notFound.body':
    'Ingenting på plattformen bär den beteckningen. Kontot kan ha tagits bort sedan länken skapades, eller så har adressen skrivits av fel.',
  'shell.allAccounts': 'Alla konton',
  'shell.overview': 'Konsolens översikt',

  'failure.fallback': 'Åtgärden gick inte igenom. Försök igen om en stund.',

  /* ------------------------------------------------------------- översikt -- */

  'overview.error.title': 'Översikten laddades inte',
  'overview.standing.title': 'Dina befogenheter på plattformen',
  'overview.standing.body':
    'Konton, sessioner och att handla i någon annans namn hör till en plattformsadministratör, så konsolen visar dig katalogen och inget mer.',
  'overview.stat.accounts': 'Konton',
  'overview.stat.accounts.caption': {
    one: 'Ett av dem bär en plattformsroll',
    other: '{staff} av dem bär en plattformsroll',
  },
  'overview.stat.admins': 'Administratörer',
  'overview.stat.admins.caption': 'Full befogenhet över konton och sessioner',
  'overview.stat.curators': 'Redaktörer',
  'overview.stat.curators.caption': 'Bara katalogen — aldrig konton',
  'overview.stat.suspended': 'Avstängda',
  'overview.stat.suspended.none': 'Ingen är utelåst',
  'overview.stat.suspended.some':
    'Utloggade överallt tills en avstängning hävs',
  'overview.stat.suspended.review': 'Se efter',
  'overview.newest.label': 'Nyaste kontona',
  'overview.newest.empty.title': 'Inga konton än',
  'overview.newest.empty.body': 'Den första som registrerar sig dyker upp här.',
  'overview.catalogue.label': 'Katalogen efter tillstånd',
  'overview.catalogue.empty.title': 'Den gemensamma katalogen är inte öppen än',
  'overview.catalogue.empty.body':
    'När inmatningskedjan är på plats räknar den här panelen varje plats i den gemensamma katalogen som utkast, under granskning eller publicerad — och varje siffra öppnar listan bakom sig.',
  'overview.scraping.label': 'Insamlingskörningar',
  'overview.scraping.empty.title': 'Ingen källa har körts',
  'overview.scraping.empty.body':
    'Källor samlas in en gång i veckan. När den första körningen är klar står de fem senaste här, med vad var och en hämtade in, ändrade och avvisade.',

  /* ---------------------------------------------------------- rollskalan -- */

  'role.admin': 'Administratör',
  'role.admin.summary':
    'Full befogenhet på plattformen: konton, roller, avstängningar, sessioner och att handla i någon annans namn.',
  'role.admin.holds.accounts': 'Skapa konton och sätta plattformsroller',
  'role.admin.holds.bans': 'Stänga av konton och häva avstängningar',
  'role.admin.holds.sessions': 'Återkalla sessioner och sätta lösenord',
  'role.admin.holds.impersonate': 'Handla i ett kontos namn i femton minuter',
  'role.admin.holds.curation': 'Allt en redaktör får göra',
  'role.admin.withheld.admins':
    'Handla i en annan plattformsadministratörs namn',
  'role.curator': 'Redaktör',
  'role.curator.summary':
    'Katalogen, samlingarna, källorna och tillsynen över delade länkar. Ingenting som rör konton.',
  'role.curator.holds.places': 'Läsa, skriva och publicera platser i katalogen',
  'role.curator.holds.packs': 'Läsa, skriva och publicera platssamlingar',
  'role.curator.holds.sources': 'Läsa och köra katalogens källor',
  'role.curator.holds.shares': 'Granska och återkalla delade länkar',
  'role.curator.withheld.accounts': 'Allt som rör ett konto eller en session',
  'role.curator.withheld.tokens': 'Utfärda eller återkalla maskinnycklar',
  'role.user': 'Användare',
  'role.user.summary':
    'Ingen befogenhet alls på plattformen. Det är nästan alla.',
  'role.user.withheld.everything':
    'Varje befogenhet på plattformen, utan undantag',

  /* --------------------------------------------------------- ett konto -- */

  'identity.you': 'Det är du',
  'status.active': 'Aktivt',
  'status.suspended': 'Avstängt',
  'status.permanent': 'Tills vidare',
  'status.until': 'Till {date}',
  'status.unverified': 'Obekräftad',
  'device.on': '{browser} på {platform}',
  'device.unrecognised': 'Okänd enhet',

  /* ----------------------------------------------------------- kontolistan -- */

  'users.error.title': 'Kontolistan laddades inte',
  'users.total': '{total} totalt',
  'users.loading': 'Kontona laddas',
  'users.table.label': 'Plattformens konton',
  'users.search.label': 'Sök konton',
  'users.search.email': 'Sök i e-postadresser',
  'users.search.name': 'Sök i namn',
  'users.search.column': 'Vilken kolumn att söka i',
  'users.search.submit': 'Sök',
  'users.field.email': 'E-post',
  'users.field.name': 'Namn',
  'users.filter.role.label': 'Filtrera på plattformsroll',
  'users.filter.role.any': 'Vilken roll som helst',
  'users.filter.role.admin': 'Administratörer',
  'users.filter.role.curator': 'Redaktörer',
  'users.filter.status.label': 'Filtrera på kontots tillstånd',
  'users.filter.status.any': 'Vilket tillstånd som helst',
  'users.filter.hint': 'Smalna av på roll eller tillstånd — ett i taget.',
  'users.column.account': 'Konto',
  'users.column.role': 'Plattformsroll',
  'users.column.status': 'Tillstånd',
  'users.column.joined': 'Med sedan',
  'users.column.actions': 'Åtgärder',
  'users.joined': 'Med sedan {date}',
  'users.pastEnd.title': 'Den sidan ligger bortom slutet',
  'users.pastEnd.body': {
    one: 'I den här vyn finns ett konto, och sida 1 är den enda sida den har.',
    other:
      'I den här vyn finns {total} konton, vilket är {pages}. Sida {page} ligger bortom det.',
  },
  'users.pastEnd.pages': {
    one: 'en enda sida',
    other: '{pages} sidor',
  },
  'users.pastEnd.back': 'Tillbaka till första sidan',
  'users.empty.filtered.title': 'Ingenting stämmer med de filtren',
  'users.empty.filtered.body':
    'Inget konto på plattformen svarar mot den här sökningen. Vidga den, eller rensa filtren för att se alla.',
  'users.empty.title': 'Inga konton att visa',
  'users.empty.body':
    'Den här vyn är tom. Ingenting är filtrerat, så det finns inget här att vidga.',

  /* ---------------------------------------------------------- kontosidan -- */

  'account.error.title': 'Det kontot laddades inte',
  'account.loading': 'Kontot laddas',
  'account.meta.lastChange': 'Senaste ändring',
  'account.meta.id': 'Kontobeteckning',
  'account.banned.title': 'Det här kontot är avstängt',
  'account.banned.noReason': 'Inget skäl antecknades vid avstängningen.',
  'account.banned.permanent': ' Den gäller tills en administratör häver den.',
  'account.banned.until': ' Den hävs av sig själv {date}.',
  'account.banned.untilUnknown': 'sitt slutdatum',
  'account.authority.label': 'Befogenheter på plattformen',
  'account.authority.may': 'Får',
  'account.authority.mayNot': 'Får inte',
  'account.authority.none': 'Ingenting på plattformen.',
  'account.workspaces.label': 'Arbetsytor',
  'account.workspaces.truncated':
    'Det här kontot hör till fler arbetsytor än de {listed} som räknas upp här.',
  'account.workspaces.empty.title': 'I ingen arbetsyta',
  'account.workspaces.empty.body':
    'Det här kontot hör ännu inte till någon arbetsyta. En skapas första gången det loggar in, och varje arbetsyta det bjuds in till dyker upp här.',
  'account.workspaces.column.workspace': 'Arbetsyta',
  'account.workspaces.column.role': 'Roll',
  'account.workspaces.column.plan': 'Paket',
  'account.subscription.label': 'Abonnemang',
  'account.subscription.free.title': 'På det gratis paketet',
  'account.subscription.free.body':
    'Arbetsytan som det här kontot äger har aldrig varit genom kassan, så den bär ingen abonnemangspost och går på gratispaketets gränser.',
  'account.subscription.none.title': 'Ingenting faktureras det här kontot',
  'account.subscription.none.body':
    'Det här kontot äger ingen arbetsyta. Att vara medlem i någon annans arbetsyta är inte att vara den arbetsytan fakturerar, så här finns inget att hämta.',
  'account.subscription.endsAtClose': 'Slutar när perioden går ut',
  'account.subscription.seats': 'Platser',
  'account.subscription.seatsValue': '{used} av {limit}',
  'account.subscription.ends': 'Slutar',
  'account.subscription.renews': 'Förnyas',
  'account.sessions.label': 'Levande sessioner',
  'account.sessions.truncated':
    'Det här kontot håller fler sessioner än ett anrop räknar upp. Återkalla alla sessioner från åtgärdsmenyn för att vara säker på att ingen blir kvar.',
  'account.sessions.empty.title': 'Utloggat överallt',
  'account.sessions.empty.body':
    'Det här kontot håller ingen session som inte gått ut. Det dyker upp här i samma stund som det loggar in igen.',
  'account.sessions.column.device': 'Enhet',
  'account.sessions.column.address': 'Adress',
  'account.sessions.column.started': 'Start',
  'account.sessions.column.expires': 'Går ut',
  'account.sessions.impersonated': 'Född ur handlande i kontots namn',
  'account.sessions.noAddress': 'Inte antecknad',
  'account.sessions.noAddressLong': 'Adressen inte antecknad',
  'account.sessions.when': 'Start {started} · går ut {expires}',
  'account.audit.label': 'Granskningshistorik',
  'account.audit.truncated':
    'Loggen håller fler poster än de här. Plattformens granskningsspår tar bara emot tillägg och sparas i fyrahundra dagar.',
  'account.audit.empty.title': 'Ingenting har gjorts med det här kontot',
  'account.audit.empty.body':
    'Varje rollbyte, avstängning, satt lösenord, återkallad session och handling i kontots namn skrivs hit med namnet på den som gjorde det. Det här har ingen rört.',

  /* -------------------------------------------------------- arbetsytans skala -- */

  'workspace.role.owner': 'Ägare',
  'workspace.role.admin': 'Administratör',
  'workspace.role.member': 'Medlem',
  'plan.free': 'Gratis',
  'plan.starter': 'Start',
  'plan.pro': 'Proffs',
  'plan.business': 'Företag',
  'subscription.trialing': 'Provperiod',
  'subscription.active': 'Aktivt',
  'subscription.pastDue': 'Förfallet',
  'subscription.canceled': 'Uppsagt',
  'subscription.incomplete': 'Ofullständigt',
  'subscription.expired': 'Utgånget',
  'subscription.unpaid': 'Obetalt',
  'subscription.paused': 'Pausat',

  /* --------------------------------------------------------- granskningslogg -- */

  'audit.action.created': 'Kontot skapades',
  'audit.action.updated': 'Kontouppgifterna ändrades',
  'audit.action.roleChanged': 'Plattformsrollen ändrades',
  'audit.action.banned': 'Kontot stängdes av',
  'audit.action.unbanned': 'Avstängningen hävdes',
  'audit.action.deleted': 'Kontot togs bort',
  'audit.action.passwordSet': 'Lösenordet sattes av en administratör',
  'audit.action.emailSet': 'E-postadressen ändrades',
  'audit.action.impersonationStarted': 'Började handla i kontots namn',
  'audit.action.impersonationEnded': 'Slutade handla i kontots namn',
  'audit.action.sessionRevoked': 'En session återkallades',
  'audit.action.sessionRevokedAll': 'Alla sessioner återkallades',
  'audit.actor.system': 'Plattformen själv',
  'audit.actor.system.detail': 'automatiskt',
  'audit.actor.agent': 'En maskinnyckel',
  'audit.actor.agent.detail': 'MCP-token',
  'audit.actor.deleted': 'Ett borttaget konto',
  'audit.actorBadge': 'Då: {role}',
  'audit.field.name': 'Namn',
  'audit.field.email': 'E-postadress',
  'audit.field.emailVerified': 'E-posten bekräftad',
  'audit.field.role': 'Plattformsroll',
  'audit.field.banned': 'Avstängt',
  'audit.field.banReason': 'Skäl',
  'audit.field.banExpiresAt': 'Avstängningen slutar',
  'audit.field.revoked': 'Avslutade sessioner',
  'audit.field.impersonating': 'Handlar som',
  'audit.field.impersonatedBy': 'Handlat av',
  'audit.field.expiresAt': 'Sessionen går ut',
  'audit.field.targetRole': 'Deras plattformsroll',
  'audit.field.sessionId': 'Berörd session',
  'audit.value.yes': 'ja',
  'audit.value.no': 'nej',
  'audit.value.cleared': 'tömdes',
  'audit.became': 'blev',

  /* ----------------------------------------------------------- dialogrutor -- */

  'dialog.cancel': 'Avbryt',

  'create.button': 'Nytt konto',
  'create.title': 'Skapa ett konto',
  'create.body':
    'Adressen bekräftas inte och inget brev går ut — lämna över lösenordet själv.',
  'create.confirm': 'Skapa konto',
  'create.name.placeholder': 'Elin Lindqvist',
  'create.email': 'E-postadress',
  'create.email.placeholder': 'elin@planned.travel',
  'create.password': 'Lösenord',
  'create.password.hint':
    'Långt nog att vara en mening. Kontot kan byta det efteråt.',
  'create.done': 'Kontot skapat',
  'create.done.body': '{email} kan logga in med lösenordet du satte.',

  'action.menu.label': 'Åtgärder för {name}',
  'action.group.account': 'Konto',
  'action.group.credentials': 'Inloggningsuppgifter',

  'action.role.item': 'Byt plattformsroll',
  'action.role.self':
    'Inte på ditt eget konto — att degradera sig själv kan lämna plattformen utan administratör.',
  'action.role.body':
    'Vad {name} får göra på själva plattformen. Medlemskap i en arbetsyta är ett eget ordförråd och rör sig inte med.',
  'action.role.confirm': 'Spara rollen',
  'action.role.current': 'Nuvarande',
  'action.role.done': 'Plattformsrollen uppdaterad',
  'action.role.done.body': '{name} bär nu rollen {role} på plattformen.',

  'action.impersonate.item': 'Handla i kontots namn',
  'action.impersonate.self':
    'Det finns ingen att bli — det här är ditt eget konto.',
  'action.impersonate.banned':
    'Kontot är avstängt och håller därför ingen session att ta på sig.',
  'action.impersonate.admin':
    'Ingen roll på plattformen får handla i en administratörs namn, inte din heller.',
  'action.impersonate.title': 'Handla som {name}',
  'action.impersonate.body':
    'Du ser produkten precis som det här kontot ser den, i femton minuter.',
  'action.impersonate.confirm': 'Börja',
  'action.impersonate.note.bar':
    'En varningsrad står kvar på varje skärm tills du avslutar, och den går inte att stänga.',
  'action.impersonate.note.platform':
    'Plattformens åtgärder är otillgängliga så länge du handlar i någon annans namn — konsolen inräknad.',
  'action.impersonate.note.audit':
    'Både början och slutet skrivs in i plattformens granskningsspår, med ditt namn på.',

  'action.password.item': 'Sätt ett lösenord',
  'action.password.title': 'Sätt ett lösenord för {name}',
  'action.password.body':
    'Använd det för att hämta hem ett utelåst konto eller för att stänga ute en angripare från ett kapat.',
  'action.password.confirm': 'Sätt lösenordet',
  'action.password.field': 'Nytt lösenord',
  'action.password.hint.self':
    'Alla sessioner tar slut när det sätts — din också.',
  'action.password.hint':
    'Alla sessioner kontot håller tar slut när det sätts.',
  'action.password.done': 'Lösenordet satt',
  'action.password.done.body': '{name} har loggats ut från varje enhet.',

  'action.sessions.item': 'Återkalla alla sessioner',
  'action.sessions.body.self':
    'Det här loggar ut dig från varje enhet, också den du läser det här på.',
  'action.sessions.body':
    '{name} loggas ut från varje enhet och måste logga in igen.',
  'action.sessions.confirm': 'Återkalla sessionerna',
  'action.sessions.done': 'Sessionerna återkallade',
  'action.sessions.done.body': {
    one: 'En session avslutades.',
    other: '{revoked} sessioner avslutades.',
  },

  'action.ban.item': 'Stäng av kontot',
  'action.ban.self':
    'Inte på ditt eget konto — att stänga av sig själv tar bort din egen väg tillbaka.',
  'action.ban.title': 'Stäng av {name}',
  'action.ban.body':
    'Alla sessioner tar slut direkt och kontot kan inte logga in igen förrän avstängningen hävs eller går ut.',
  'action.ban.confirm': 'Stäng av kontot',
  'action.ban.reason': 'Skäl',
  'action.ban.reason.hint':
    'Sparas i tretton månader i plattformens granskningsspår och visas för ingen utom en administratör.',
  'action.ban.reason.placeholder':
    'Upprepade anmälningar om missbruk från tre arbetsytor',
  'action.ban.duration': 'Längd',
  'action.ban.duration.label': 'Avstängningens längd',
  'action.ban.duration.permanent.body':
    'Gäller tills en administratör medvetet häver den.',
  'action.ban.duration.day': '24 timmar',
  'action.ban.duration.day.body':
    'Långt nog för att avbryta, kort nog för att förbli ett ingripande.',
  'action.ban.duration.week': '7 dagar',
  'action.ban.duration.week.body': 'En vecka att svara på ett klagomål.',
  'action.ban.duration.month': '30 dagar',
  'action.ban.duration.month.body': 'En månads påtvingad tystnad.',
  'action.ban.duration.quarter': '90 dagar',
  'action.ban.duration.quarter.body':
    'Det längsta konsolen erbjuder. Bortom det: stäng av tills vidare.',
  'action.ban.done': 'Kontot avstängt',
  'action.ban.done.body':
    '{name} har loggats ut överallt och kan inte logga in igen.',

  'action.unban.item': 'Häv avstängningen',
  'action.unban.title': 'Häv avstängningen av {name}',
  'action.unban.body':
    'Kontot kan logga in igen från och med nästa försök. Ingen tidigare session kommer tillbaka.',
  'action.unban.confirm': 'Häv avstängningen',
  'action.unban.done': 'Avstängningen hävd',
  'action.unban.done.body':
    '{name} kan logga in igen. Ingen session återställdes.',

  'action.delete.item': 'Ta bort kontot',
  'action.delete.self':
    'Inte på ditt eget konto — därifrån finns ingen väg tillbaka.',
  'action.delete.title': 'Ta bort {name}',
  'action.delete.body':
    'Kontot, dess sessioner och varje nyckel som hänger på det tas bort. Det går inte att ångra.',
  'action.delete.confirm': 'Ta bort kontot',
  'action.delete.note':
    'Innehåll i en arbetsyta som den här personen skapat stannar hos arbetsytan som äger det. Att stänga av kontot i stället behåller spåret och tar bort åtkomsten.',
  'action.delete.done': 'Kontot borttaget',
  'action.delete.done.body': '{name} och allt som hängde på kontot är borta.',

  'session.revoke.label': 'Avsluta sessionen på {device}',
  'session.revoke.title': 'Avsluta den här sessionen',
  'session.revoke.body':
    '{device} måste logga in igen vid nästa anrop. Är det sessionen du läser det här i loggas du ut med den.',
  'session.revoke.confirm': 'Avsluta sessionen',
  'session.revoke.done': 'Sessionen avslutad',
  'session.revoke.done.body': 'Enheten måste logga in igen vid nästa anrop.',

  /* ------------------------------------------------------- agentkörningar -- */

  'runs.error.title': 'Körningsregistret svarade inte',
  'runs.origin.local': 'Lokalt',
  'runs.origin.githubActions': 'GitHub-Actions',
  'runs.stat.live': 'Levande körningar',
  'runs.stat.live.none': 'Ingenting byggs just nu',
  'runs.stat.live.some': 'Hjärtslag mot ett arrende på fem minuter',
  'runs.stat.issues': 'Hållna ärenden',
  'runs.stat.issues.caption':
    'Arrenderade till en körning var, med förfäder och underärenden',
  'runs.stat.orphans': 'Föräldralösa grenar',
  'runs.stat.orphans.none': 'Inget arbete ligger utan ägare',
  'runs.stat.orphans.some':
    'Commits från en körning som stannade, i väntan på att tas över',
  'runs.live.empty.title': 'Ingen körning är registrerad',
  'runs.live.empty.body':
    'En körning dyker upp här i samma stund som den registrerar sig — från den här maskinen, från en annan, eller från en körare hos GitHub — med de ärenden den tagit.',
  'runs.holds.nothing': 'håller ingenting',
  'runs.holds': 'håller {issues}',
  'runs.uptime': '{elapsed} uppe · {lease}',
  'runs.lease.expired': 'utgånget',
  'runs.lease.left': '{elapsed} kvar',
  'runs.wip.label': 'Pågående arbete',
  'runs.wip.empty.title': 'Ingen gren bär arbete',
  'runs.wip.empty.body':
    'En körning antecknar sin gren så snart den har commits på den, så att nästa körning som tar ärendet blir erbjuden arbetet i stället för att börja om, om körningen dör.',
  'runs.wip.orphaned': 'Föräldralös',
  'runs.wip.meta': {
    one: '{commits} commit · för {elapsed} sedan',
    other: '{commits} commits · för {elapsed} sedan',
  },
  'runs.recent.label': 'Nyligen avslutade',
  'runs.recent.empty.title': 'Ingen körning har avslutats än',
  'runs.recent.empty.body':
    'De femtio senaste körningarna sparas här, med hur var och en slutade.',
  'runs.ago': 'för {elapsed} sedan',
  'runs.notCoordinator.title': 'Den här driftsättningen styr inte flottan',
  'runs.notCoordinator.body':
    'Körningsregistret är bundet bara i testmiljön, och det med avsikt: ett andra register skulle låta två flottor var för sig tro att de håller kön, vilket är just vad det finns till för att hindra. Läs flottan i testmiljön.',
  'nav.providers': 'Leverantörer',
  'nav.providers.description': 'Utgående anrop och deras tak',
  'providers.error.title': 'Leverantörsmätarna kunde inte läsas',
  'providers.list.label': 'Tjänster',
  'providers.status.planned': 'Inte inkopplad',
  'providers.status.planned.description':
    'Ingenting anropar den här tjänsten ännu, så det finns inget att räkna. Den står här för att ett tak ska avtalas före första anropet i stället för efter första fakturan.',
  'providers.policy.allow': 'Fakturerar över taket',
  'providers.policy.block': 'Nekar vid taket',
  'providers.badge.blocked': {
    one: 'Ett anrop nekat',
    other: '{calls} anrop nekade',
  },
  'providers.limit.none': 'Inget avtalat tak · {used} den här månaden',
  'providers.limit.value': '{used} av {limit}',
  'providers.limit.window.day': 'I dag',
  'providers.limit.window.month': 'Den här månaden',
  'providers.measuring.none': 'Inget har mätts ännu',
  'providers.measuring.since': 'Mäter sedan {date}',
  'providers.stat.calls': 'Anrop den här månaden',
  'providers.stat.calls.caption': 'Över alla inkopplade tjänster',
  'providers.stat.errors': 'Misslyckade anrop',
  'providers.stat.errors.caption':
    'Räknas också som anrop, eftersom de flesta leverantörer tar betalt för dem',
  'providers.stat.nearLimit': 'Nära ett tak',
  'providers.stat.nearLimit.caption': 'Tjänster över sin varningströskel',
  'providers.stat.blocked': 'Nekade anrop',
  'providers.stat.blocked.none': 'Ingenting har nekats',
  'providers.stat.blocked.some': 'Efterfrågan som ett tak nekade',
  'providers.forecast.label': 'Prognos',
  'providers.forecast.provider': 'Tjänst',
  'providers.forecast.monthEnd': 'Till månadens slut',
  'providers.forecast.runRate': 'Per månad i den här takten',
  'providers.forecast.perWorkspace': 'Per arbetsyta och månad',
  'providers.forecast.noWorkspaceTraffic':
    'Ingen arbetsytetrafik att beräkna snitt på',
  'providers.forecast.window': {
    one: 'Framskrivet från en timmes mätning.',
    other: 'Framskrivet från {hours} timmars mätning.',
  },
  'providers.forecast.tooEarly': {
    one: 'Bara en timme uppmätt hittills — för lite för att skriva fram. Att sträcka mindre än ett dygn till en månad vore räkning, inte prognos.',
    other:
      'Bara {hours} timmar uppmätta hittills — för lite för att skriva fram. Att sträcka mindre än ett dygn till en månad vore räkning, inte prognos.',
  },
  'providers.forecast.atWorkspaces': 'Vid hur många arbetsytor',
  'providers.forecast.callsEach': 'Anrop per arbetsyta och månad',
  'providers.forecast.projected': 'Ungefär {calls} anrop i månaden.',
  'providers.workspaces.label': 'Mest aktiva arbetsytor',
  'providers.workspaces.platform': 'Plattformen (ingen arbetsyta)',
  'providers.workspaces.empty.title': 'Inget har tillskrivits ännu',
  'providers.workspaces.empty.description':
    'Ett anrop som görs för en arbetsyta bokförs på den. Schemalagt arbete och plattformens post hör inte till någon och räknas för sig.',
  'providers.readOnly':
    'Du kan läsa de här mätarna men inte flytta ett tak. Att ändra en gräns eller dess policy kräver rättigheten provider:configure.',
  'providers.status.planned.agreed.month':
    'Avtalat tak: {limit} i månaden. Det gäller från första anropet, så snart en klient finns.',
  'providers.status.planned.agreed.day':
    'Avtalat tak: {limit} om dagen. Det gäller från första anropet, så snart en klient finns.',
  'providers.edit.button': 'Redigera',
  'providers.edit.title': 'Tak för {provider}',
  'providers.edit.body':
    'Vad den här installationen har avtalat att spendera hos leverantören, och vad som händer när det tar slut.',
  'providers.edit.confirm': 'Spara taket',
  'providers.edit.done': 'Taket för {provider} sparat',
  'providers.edit.label': 'Namn',
  'providers.edit.ceiling': 'Anrop som ingår',
  'providers.edit.ceiling.hint':
    'Lämna tomt om inget tak är avtalat. Tomt och noll är inte samma sak: noll med ”neka” avvisar varje anrop.',
  'providers.edit.ceiling.placeholder': 'Inget tak',
  'providers.edit.window': 'Mäts över',
  'providers.edit.window.month': 'En kalendermånad',
  'providers.edit.window.month.body': 'Den vanliga formen på en ingående kvot.',
  'providers.edit.window.day': 'Ett dygn',
  'providers.edit.window.day.body':
    'Vissa leverantörer mäter per dygn — Geoapifys gratisplan är 3 000 krediter om dagen.',
  'providers.edit.policy': 'Vid taket',
  'providers.edit.policy.allow': 'Fortsätt anropa och betala',
  'providers.edit.policy.allow.body':
    'Anropen fortsätter över taket och konsolen varnar. Ingenting slutar fungera.',
  'providers.edit.policy.block': 'Neka fortsatta anrop',
  'providers.edit.policy.block.body':
    'Anrop avvisas tills fönstret börjar om. Det som beror på den här leverantören slutar fungera — välj det bara där det är det billigare felet.',
  'providers.edit.policy.block.refused':
    '{provider} kan inte nekas: den har ingen reservväg, så att avvisa dess anrop skulle stoppa funktionen i stället för att hålla nere kostnaden. Ett tak som bara varnar går fortfarande bra.',
  'providers.edit.warn': 'Varna vid (%)',
  'providers.edit.critical': 'Larma vid (%)',
  'providers.edit.thresholds.hint':
    'Där mätaren blir gul och röd. Varningen får inte ligga över larmet.',
} satisfies TranslationOf<typeof En>

export default messages
