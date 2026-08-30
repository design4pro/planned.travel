/**
 * Alles wat de platformconsole zegt, in het Nederlands.
 *
 * Geschreven vanuit `../en/console.ts` (`docs/SPEC.md` §9). Het Engelse bestand is het schema:
 * `TranslationOf<typeof En>` maakt van een ontbrekende of verzonnen sleutel een compileerfout, en
 * `__tests__/parity.test.ts` controleert de plaatshouders, de meervoudstakken en dat hier niets
 * Engels blijft liggen.
 *
 * **Register.** Informeel `je`/`jij`, net als in de rest van de Nederlandse catalogus.
 *
 * **Twee rolschalen die nooit door elkaar lopen** (§5). Op het platform: beheerder, redacteur,
 * gebruiker. In de werkruimte: eigenaar, beheerder, lid. Hetzelfde woord valt in allebei, dus de
 * zin eromheen draagt het verschil.
 *
 * **De platformrol heet «redacteur», niet «curator».** Het Engelse `curator` staat in het
 * Nederlands voor een bewindvoerder bij een faillissement — precies de verkeerde lezing voor
 * iemand die de catalogus schrijft en publiceert.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------ secties -- */

  'nav.label': 'Secties van de console',
  'nav.overview': 'Overzicht',
  'nav.overview.description': 'Het platform in één oogopslag',
  'nav.accounts': 'Gebruikersaccounts',
  'nav.accounts.description': 'Rollen, schorsingen en sessies',
  'nav.runs': 'Agentruns',
  'nav.runs.description': 'Waar de sandcastle-vloot aan bouwt',

  /* --------------------------------------------------------------- schil -- */

  'shell.eyebrow': 'Het platform',
  'shell.title': 'Platformconsole',
  'shell.description':
    'Het product zelf — accounts, bevoegdheden en de gedeelde catalogus',
  'shell.signedInAs': 'Aangemeld als',
  'shell.error.title': 'De console is niet geladen',
  'shell.notFound.title': 'Zo’n account bestaat niet',
  'shell.notFound.body':
    'Niets op het platform draagt dat kenmerk. Het account is misschien verwijderd nadat de koppeling werd gemaakt, of het adres is verkeerd overgetypt.',
  'shell.allAccounts': 'Alle accounts',
  'shell.overview': 'Overzicht van de console',

  'failure.fallback': 'De actie is niet doorgegaan. Probeer het zo nog eens.',

  /* ------------------------------------------------------------ overzicht -- */

  'overview.error.title': 'Het overzicht is niet geladen',
  'overview.standing.title': 'Jouw bevoegdheden op het platform',
  'overview.standing.body':
    'Accounts, sessies en handelen namens iemand anders horen bij een platformbeheerder, dus de console laat je de catalogus zien en verder niets.',
  'overview.stat.accounts': 'Gebruikersaccounts',
  'overview.stat.accounts.caption': {
    one: 'Eén ervan draagt een platformrol',
    other: '{staff} ervan dragen een platformrol',
  },
  'overview.stat.admins': 'Beheerders',
  'overview.stat.admins.caption': 'Volledig gezag over accounts en sessies',
  'overview.stat.curators': 'Redacteuren',
  'overview.stat.curators.caption': 'Alleen de catalogus — nooit accounts',
  'overview.stat.suspended': 'Geschorst',
  'overview.stat.suspended.none': 'Niemand staat buiten',
  'overview.stat.suspended.some':
    'Overal afgemeld tot een schorsing wordt opgeheven',
  'overview.stat.suspended.review': 'Bekijk ze',
  'overview.newest.label': 'Nieuwste accounts',
  'overview.newest.empty.title': 'Nog geen accounts',
  'overview.newest.empty.body': 'De eerste die zich aanmeldt verschijnt hier.',
  'overview.catalogue.label': 'Catalogus per toestand',
  'overview.catalogue.empty.title': 'De gedeelde catalogus is nog niet open',
  'overview.catalogue.empty.body':
    'Zodra de invoerstraat er staat, telt dit paneel elke plek in de gedeelde catalogus als concept, in beoordeling of gepubliceerd — en elk getal opent de lijst die erachter zit.',
  'overview.scraping.label': 'Verzamelrondes',
  'overview.scraping.empty.title': 'Er is nog geen bron uitgevoerd',
  'overview.scraping.empty.body':
    'Bronnen worden wekelijks opgehaald. Als de eerste ronde klaar is, staan hier de laatste vijf met wat elke ronde binnenhaalde, wijzigde en afwees.',

  /* ------------------------------------------------------------ de rolschaal -- */

  'role.admin': 'Beheerder',
  'role.admin.summary':
    'Volledig gezag op het platform: accounts, rollen, schorsingen, sessies en handelen namens iemand anders.',
  'role.admin.holds.accounts': 'Accounts aanmaken en platformrollen toekennen',
  'role.admin.holds.bans': 'Accounts schorsen en schorsingen opheffen',
  'role.admin.holds.sessions': 'Sessies intrekken en wachtwoorden instellen',
  'role.admin.holds.impersonate':
    'Vijftien minuten lang namens een account handelen',
  'role.admin.holds.curation': 'Alles wat een redacteur mag',
  'role.admin.withheld.admins': 'Namens een andere platformbeheerder handelen',
  'role.curator': 'Redacteur',
  'role.curator.summary':
    'De catalogus, de bundels, de bronnen en het toezicht op gedeelde koppelingen. Niets wat accounts raakt.',
  'role.curator.holds.places':
    'Plekken uit de catalogus lezen, schrijven en publiceren',
  'role.curator.holds.packs': 'Plekbundels lezen, schrijven en publiceren',
  'role.curator.holds.sources': 'Catalogusbronnen lezen en uitvoeren',
  'role.curator.holds.shares': 'Gedeelde koppelingen beoordelen en intrekken',
  'role.curator.withheld.accounts': 'Alles wat een account of een sessie raakt',
  'role.curator.withheld.tokens': 'Machinesleutels uitgeven of intrekken',
  'role.user': 'Gebruiker',
  'role.user.summary':
    'Helemaal geen bevoegdheid op het platform. Dat is bijna iedereen.',
  'role.user.withheld.everything':
    'Elke bevoegdheid van het platform, zonder uitzondering',

  /* --------------------------------------------------------- één account -- */

  'identity.you': 'Dat ben jij',
  'status.active': 'Actief',
  'status.suspended': 'Geschorst',
  'status.permanent': 'Onbepaald',
  'status.until': 'Tot {date}',
  'status.unverified': 'Niet bevestigd',
  'device.on': '{browser} op {platform}',
  'device.unrecognised': 'Onbekend apparaat',

  /* ----------------------------------------------------- lijst met accounts -- */

  'users.error.title': 'De lijst met accounts is niet geladen',
  'users.total': '{total} in totaal',
  'users.loading': 'Accounts worden geladen',
  'users.table.label': 'Accounts van het platform',
  'users.search.label': 'Accounts zoeken',
  'users.search.email': 'Zoek in e-mailadressen',
  'users.search.name': 'Zoek in namen',
  'users.search.column': 'In welke kolom zoeken',
  'users.search.submit': 'Zoeken',
  'users.field.email': 'E-mail',
  'users.field.name': 'Naam',
  'users.filter.role.label': 'Filter op platformrol',
  'users.filter.role.any': 'Elke rol',
  'users.filter.role.admin': 'Beheerders',
  'users.filter.role.curator': 'Redacteuren',
  'users.filter.status.label': 'Filter op toestand van het account',
  'users.filter.status.any': 'Elke toestand',
  'users.filter.clear': 'Filters wissen',
  'users.filter.hint': 'Verklein op rol of op toestand — één tegelijk.',
  'users.column.account': 'Gebruikersaccount',
  'users.column.role': 'Platformrol',
  'users.column.status': 'Toestand',
  'users.column.joined': 'Aangemeld',
  'users.column.actions': 'Acties',
  'users.joined': 'Aangemeld op {date}',
  'users.pastEnd.title': 'Die pagina ligt voorbij het einde',
  'users.pastEnd.body': {
    one: 'In dit overzicht staat één account, en pagina 1 is de enige die het heeft.',
    other:
      'In dit overzicht staan {total} accounts, dat is {pages}. Pagina {page} ligt daarvoorbij.',
  },
  'users.pastEnd.pages': {
    one: 'één enkele pagina',
    other: '{pages} pagina’s',
  },
  'users.pastEnd.back': 'Terug naar de eerste pagina',
  'users.empty.filtered.title': 'Niets past bij deze filters',
  'users.empty.filtered.body':
    'Geen enkel account op het platform beantwoordt deze zoekopdracht. Maak hem ruimer, of wis de filters om iedereen te zien.',
  'users.empty.title': 'Geen accounts om te tonen',
  'users.empty.body':
    'Dit overzicht is leeg. Er is niets gefilterd, dus hier valt niets ruimer te maken.',

  /* ---------------------------------------------------------- accountpagina -- */

  'account.error.title': 'Dat account is niet geladen',
  'account.loading': 'Account wordt geladen',
  'account.meta.lastChange': 'Laatste wijziging',
  'account.meta.id': 'Accountkenmerk',
  'account.banned.title': 'Dit account is geschorst',
  'account.banned.noReason': 'Bij de schorsing is geen reden vastgelegd.',
  'account.banned.permanent':
    ' Ze blijft van kracht tot een beheerder haar opheft.',
  'account.banned.until': ' Ze heft zichzelf op op {date}.',
  'account.banned.untilUnknown': 'haar einddatum',
  'account.authority.label': 'Bevoegdheden op het platform',
  'account.authority.may': 'Mag',
  'account.authority.mayNot': 'Mag niet',
  'account.authority.none': 'Niets op het platform.',
  'account.workspaces.label': 'Werkruimtes',
  'account.workspaces.truncated':
    'Dit account hoort bij meer werkruimtes dan de {listed} die hier staan.',
  'account.workspaces.empty.title': 'In geen enkele werkruimte',
  'account.workspaces.empty.body':
    'Dit account hoort nog bij geen enkele werkruimte. Bij de eerste aanmelding wordt er één gemaakt, en elke werkruimte waarvoor het wordt uitgenodigd verschijnt hier.',
  'account.workspaces.column.workspace': 'Werkruimte',
  'account.workspaces.column.role': 'Rol',
  'account.workspaces.column.plan': 'Pakket',
  'account.subscription.label': 'Abonnement',
  'account.subscription.free.title': 'Op het gratis pakket',
  'account.subscription.free.body':
    'De werkruimte waarvan dit account de eigenaar is, is nooit langs de kassa geweest, draagt dus geen abonnementsregel en draait op de grenzen van het gratis pakket.',
  'account.subscription.none.title':
    'Er wordt niets aan dit account gefactureerd',
  'account.subscription.none.body':
    'Dit account bezit geen werkruimte. Lid zijn van andermans werkruimte is niet hetzelfde als degene zijn aan wie die werkruimte factureert, dus hier valt niets op te halen.',
  'account.subscription.endsAtClose': 'Eindigt aan het eind van de periode',
  'account.subscription.seats': 'Plaatsen',
  'account.subscription.seatsValue': '{used} van {limit}',
  'account.subscription.ends': 'Eindigt',
  'account.subscription.renews': 'Verlengt',
  'account.sessions.label': 'Lopende sessies',
  'account.sessions.truncated':
    'Dit account houdt meer sessies vast dan één aanroep opsomt. Trek alle sessies in via het actiemenu om zeker te weten dat er geen achterblijft.',
  'account.sessions.empty.title': 'Overal afgemeld',
  'account.sessions.empty.body':
    'Dit account houdt geen sessie vast die nog niet verlopen is. Het verschijnt hier zodra het zich weer aanmeldt.',
  'account.sessions.column.device': 'Apparaat',
  'account.sessions.column.address': 'Adres',
  'account.sessions.column.started': 'Begin',
  'account.sessions.column.expires': 'Verloopt',
  'account.sessions.impersonated': 'Ontstaan door handelen namens het account',
  'account.sessions.noAddress': 'Niet vastgelegd',
  'account.sessions.noAddressLong': 'Adres niet vastgelegd',
  'account.sessions.when': 'Begin {started} · verloopt {expires}',
  'account.audit.label': 'Controlegeschiedenis',
  'account.audit.truncated':
    'Het logboek houdt meer regels vast dan deze. Het controlespoor van het platform kent alleen toevoegingen en wordt vierhonderd dagen bewaard.',
  'account.audit.empty.title': 'Er is niets met dit account gedaan',
  'account.audit.empty.body':
    'Elke rolwijziging, schorsing, ingesteld wachtwoord, ingetrokken sessie en elk handelen namens het account wordt hier geschreven, met de naam van wie het deed. Dit account heeft niemand aangeraakt.',

  /* ------------------------------------------------- de schaal van de werkruimte -- */

  'workspace.role.owner': 'Eigenaar',
  'workspace.role.admin': 'Beheerder',
  'workspace.role.member': 'Lid',
  'plan.free': 'Gratis',
  'plan.starter': 'Start',
  'plan.pro': 'Professioneel',
  'plan.business': 'Zakelijk',
  'subscription.trialing': 'Proefperiode',
  'subscription.active': 'Actief',
  'subscription.pastDue': 'Te laat',
  'subscription.canceled': 'Opgezegd',
  'subscription.incomplete': 'Onvolledig',
  'subscription.expired': 'Verlopen',
  'subscription.unpaid': 'Onbetaald',
  'subscription.paused': 'Gepauzeerd',

  /* ---------------------------------------------------------- controlelogboek -- */

  'audit.action.created': 'Account aangemaakt',
  'audit.action.updated': 'Accountgegevens gewijzigd',
  'audit.action.roleChanged': 'Platformrol gewijzigd',
  'audit.action.banned': 'Account geschorst',
  'audit.action.unbanned': 'Schorsing opgeheven',
  'audit.action.deleted': 'Account verwijderd',
  'audit.action.passwordSet': 'Wachtwoord ingesteld door een beheerder',
  'audit.action.emailSet': 'E-mailadres gewijzigd',
  'audit.action.impersonationStarted': 'Handelen namens het account begonnen',
  'audit.action.impersonationEnded': 'Handelen namens het account beëindigd',
  'audit.action.sessionRevoked': 'Er is een sessie ingetrokken',
  'audit.action.sessionRevokedAll': 'Alle sessies zijn ingetrokken',
  'audit.actor.system': 'Het platform zelf',
  'audit.actor.system.detail': 'automatisch',
  'audit.actor.agent': 'Een machinesleutel',
  'audit.actor.agent.detail': 'MCP-token',
  'audit.actor.deleted': 'Een verwijderd account',
  'audit.actorBadge': 'Toen: {role}',
  'audit.field.name': 'Naam',
  'audit.field.email': 'E-mailadres',
  'audit.field.emailVerified': 'E-mail bevestigd',
  'audit.field.role': 'Platformrol',
  'audit.field.banned': 'Geschorst',
  'audit.field.banReason': 'Reden',
  'audit.field.banExpiresAt': 'Einde van de schorsing',
  'audit.field.revoked': 'Beëindigde sessies',
  'audit.field.impersonating': 'Handelt als',
  'audit.field.impersonatedBy': 'Gehandeld door',
  'audit.field.expiresAt': 'Sessie verloopt',
  'audit.field.targetRole': 'Hun platformrol',
  'audit.field.sessionId': 'Sessie',
  'audit.value.yes': 'ja',
  'audit.value.no': 'nee',
  'audit.value.cleared': 'geleegd',
  'audit.became': 'werd',

  /* ----------------------------------------------------------- dialoogvensters -- */

  'dialog.cancel': 'Annuleren',

  'create.button': 'Nieuw account',
  'create.title': 'Een account aanmaken',
  'create.body':
    'Het adres wordt niet bevestigd en er gaat geen bericht uit — geef het wachtwoord zelf door.',
  'create.confirm': 'Account aanmaken',
  'create.name.placeholder': 'Sanne de Vries',
  'create.email': 'E-mailadres',
  'create.email.placeholder': 'sanne@planned.travel',
  'create.password': 'Wachtwoord',
  'create.password.hint':
    'Lang genoeg om een zin te zijn. Het account kan het daarna wijzigen.',
  'create.done': 'Account aangemaakt',
  'create.done.body':
    '{email} kan zich aanmelden met het wachtwoord dat je hebt ingesteld.',

  'action.menu.label': 'Acties voor {name}',
  'action.group.account': 'Gebruikersaccount',
  'action.group.credentials': 'Sleutels',

  'action.role.item': 'Platformrol wijzigen',
  'action.role.self':
    'Niet op je eigen account — jezelf degraderen kan het platform zonder beheerder achterlaten.',
  'action.role.body':
    'Wat {name} op het platform zelf mag. Lidmaatschap van een werkruimte is een aparte woordenschat en beweegt niet mee.',
  'action.role.confirm': 'Rol opslaan',
  'action.role.current': 'Nu',
  'action.role.done': 'Platformrol bijgewerkt',
  'action.role.done.body': '{name} draagt nu de rol {role} op het platform.',

  'action.impersonate.item': 'Handel namens dit account',
  'action.impersonate.self':
    'Er is niemand om te worden — dit is je eigen account.',
  'action.impersonate.banned':
    'Het account is geschorst, dus het houdt geen sessie vast om aan te trekken.',
  'action.impersonate.admin':
    'Geen enkele rol op het platform mag namens een beheerder handelen, de jouwe ook niet.',
  'action.impersonate.title': 'Handel als {name}',
  'action.impersonate.body':
    'Je ziet het product precies zoals dit account het ziet, vijftien minuten lang.',
  'action.impersonate.confirm': 'Beginnen',
  'action.impersonate.note.bar':
    'Een waarschuwingsbalk blijft op elk scherm staan tot je het beëindigt, en hij kan niet weggeklikt worden.',
  'action.impersonate.note.platform':
    'Platformacties zijn niet beschikbaar zolang je namens iemand anders handelt — de console ook niet.',
  'action.impersonate.note.audit':
    'Begin en einde worden allebei in het controlespoor van het platform geschreven, met jouw naam erbij.',

  'action.password.item': 'Wachtwoord instellen',
  'action.password.title': 'Wachtwoord instellen voor {name}',
  'action.password.body':
    'Gebruik dit om een buitengesloten account terug te halen of om een aanvaller uit een gekaapt account te zetten.',
  'action.password.confirm': 'Wachtwoord instellen',
  'action.password.field': 'Nieuw wachtwoord',
  'action.password.hint.self':
    'Bij het instellen eindigt elke sessie — die van jou ook.',
  'action.password.hint':
    'Bij het instellen eindigt elke sessie die het account vasthoudt.',
  'action.password.done': 'Wachtwoord ingesteld',
  'action.password.done.body': '{name} is op elk apparaat afgemeld.',

  'action.sessions.item': 'Alle sessies intrekken',
  'action.sessions.body.self':
    'Dit meldt je op elk apparaat af, ook op het apparaat waarop je dit leest.',
  'action.sessions.body':
    '{name} wordt op elk apparaat afgemeld en moet zich opnieuw aanmelden.',
  'action.sessions.confirm': 'Sessies intrekken',
  'action.sessions.done': 'Sessies ingetrokken',
  'action.sessions.done.body': {
    one: 'Er is één sessie beëindigd.',
    other: 'Er zijn {revoked} sessies beëindigd.',
  },

  'action.ban.item': 'Account schorsen',
  'action.ban.self':
    'Niet op je eigen account — jezelf schorsen neemt je eigen weg terug weg.',
  'action.ban.title': '{name} schorsen',
  'action.ban.body':
    'Elke sessie eindigt meteen en het account kan zich niet meer aanmelden tot de schorsing wordt opgeheven of verloopt.',
  'action.ban.confirm': 'Account schorsen',
  'action.ban.reason': 'Reden',
  'action.ban.reason.hint':
    'Dertien maanden bewaard in het controlespoor van het platform, en aan niemand getoond behalve aan een beheerder.',
  'action.ban.reason.placeholder':
    'Herhaalde meldingen van misbruik uit drie werkruimtes',
  'action.ban.duration': 'Duur',
  'action.ban.duration.label': 'Duur van de schorsing',
  'action.ban.duration.permanent.body':
    'Blijft van kracht tot een beheerder haar bewust opheft.',
  'action.ban.duration.day': '24 uur',
  'action.ban.duration.day.body':
    'Lang genoeg om te onderbreken, kort genoeg om een ingreep te blijven.',
  'action.ban.duration.week': '7 dagen',
  'action.ban.duration.week.body': 'Een week om op een klacht te antwoorden.',
  'action.ban.duration.month': '30 dagen',
  'action.ban.duration.month.body': 'Een maand opgelegde stilte.',
  'action.ban.duration.quarter': '90 dagen',
  'action.ban.duration.quarter.body':
    'Het langste dat de console aanbiedt. Daarboven: schors voor onbepaalde tijd.',
  'action.ban.done': 'Account geschorst',
  'action.ban.done.body':
    '{name} is overal afgemeld en kan zich niet meer aanmelden.',

  'action.unban.item': 'Schorsing opheffen',
  'action.unban.title': 'Schorsing van {name} opheffen',
  'action.unban.body':
    'Het account kan zich vanaf de volgende poging weer aanmelden. Geen eerdere sessie komt terug.',
  'action.unban.confirm': 'Schorsing opheffen',
  'action.unban.done': 'Schorsing opgeheven',
  'action.unban.done.body':
    '{name} kan zich weer aanmelden. Er is geen sessie hersteld.',

  'action.delete.item': 'Account verwijderen',
  'action.delete.self':
    'Niet op je eigen account — daar kom je niet van terug.',
  'action.delete.title': '{name} verwijderen',
  'action.delete.body':
    'Het account, zijn sessies en elke sleutel die eraan hangt worden weggehaald. Dit kan niet ongedaan gemaakt worden.',
  'action.delete.confirm': 'Account verwijderen',
  'action.delete.note':
    'Inhoud van een werkruimte die deze persoon maakte blijft bij de werkruimte die er eigenaar van is. Het account schorsen in plaats van verwijderen houdt het spoor en neemt de toegang weg.',
  'action.delete.done': 'Account verwijderd',
  'action.delete.done.body':
    '{name} en alles wat aan het account hing zijn weg.',

  'session.revoke.label': 'Sessie op {device} beëindigen',
  'session.revoke.title': 'Deze sessie beëindigen',
  'session.revoke.body':
    '{device} moet zich bij het volgende verzoek opnieuw aanmelden. Is dit de sessie waarin je dit leest, dan word je meteen mee afgemeld.',
  'session.revoke.confirm': 'Sessie beëindigen',
  'session.revoke.done': 'Sessie beëindigd',
  'session.revoke.done.body':
    'Het apparaat moet zich bij het volgende verzoek opnieuw aanmelden.',

  /* --------------------------------------------------------------- agentruns -- */

  'runs.error.title': 'Het runregister gaf geen antwoord',
  'runs.origin.local': 'Lokaal',
  'runs.origin.githubActions': 'GitHub-Actions',
  'runs.stat.live': 'Lopende runs',
  'runs.stat.live.none': 'Er wordt op dit moment niets gebouwd',
  'runs.stat.live.some': 'Hartslag tegen een pacht van vijf minuten',
  'runs.stat.issues': 'Vastgehouden meldingen',
  'runs.stat.issues.caption':
    'Per stuk aan één run verpacht, met voorouders en submeldingen',
  'runs.stat.orphans': 'Verweesde takken',
  'runs.stat.orphans.none': 'Er ligt geen werk zonder eigenaar',
  'runs.stat.orphans.some':
    'Commits van een run die stilviel, wachtend om overgenomen te worden',
  'runs.live.empty.title': 'Er is geen run aangemeld',
  'runs.live.empty.body':
    'Een run verschijnt hier zodra hij zich aanmeldt — vanaf deze machine, vanaf een andere, of vanaf een uitvoerder van GitHub — met de meldingen die hij heeft genomen.',
  'runs.holds.nothing': 'houdt niets vast',
  'runs.holds': 'houdt {issues} vast',
  'runs.uptime': '{elapsed} in de lucht · {lease}',
  'runs.lease.expired': 'verlopen',
  'runs.lease.left': 'nog {elapsed}',
  'runs.wip.label': 'Werk in uitvoering',
  'runs.wip.empty.title': 'Geen tak draagt werk',
  'runs.wip.empty.body':
    'Een run legt zijn tak vast zodra er commits op staan, zodat de volgende die de melding neemt het werk aangeboden krijgt in plaats van opnieuw te beginnen als de run sterft.',
  'runs.wip.orphaned': 'Verweesd',
  'runs.wip.meta': {
    one: '{commits} commit · {elapsed} geleden',
    other: '{commits} commits · {elapsed} geleden',
  },
  'runs.recent.label': 'Onlangs afgerond',
  'runs.recent.empty.title': 'Er is nog geen run afgerond',
  'runs.recent.empty.body':
    'De laatste vijftig runs blijven hier staan, met hoe elk ervan eindigde.',
  'runs.ago': '{elapsed} geleden',
  'runs.notCoordinator.title': 'Deze omgeving stuurt de vloot niet aan',
  'runs.notCoordinator.body':
    'Het runregister hangt alleen aan de testomgeving, en dat met opzet: een tweede register zou twee vloten allebei laten geloven dat zij de wachtrij vasthouden, en juist dat moet het voorkomen. Lees de vloot op de testomgeving.',
} satisfies TranslationOf<typeof En>

export default messages
