/**
 * Everything the application shell says, in Dutch.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Informal `je`/`jij` throughout. A travel planner speaks to the
 * traveller; `u` would put a bank counter between them, and the whole Dutch
 * catalogue keeps that one voice.
 *
 * **Plural.** `Intl.PluralRules('nl')` reports `one` and `other`, the same two
 * branches English needs.
 *
 * **Words chosen once and kept.** `trip` is "reis", `workspace` is "werkruimte",
 * `plan` in the billing sense is "abonnement" and `plan` in the itinerary sense
 * is "dagplan" — English uses one word for both and Dutch must not, or a trip
 * tab and a subscription row read as the same thing. `Atlas` is "wereldkaart",
 * because the section is the world map that records where the traveller has
 * been, and nobody would look for that under a Latin noun.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Hoofdonderdelen',
  'nav.mobile': 'Onderdelen',
  'nav.dashboardLink': 'planned.travel overzicht',
  'nav.homeLink': 'planned.travel startpagina',
  'nav.newTrip': 'Nieuwe reis',

  'nav.trips': 'Mijn reizen',
  'nav.trips.short': 'Reizen',
  'nav.vacay': 'Vakantie',
  'nav.vacay.short': 'Vakantie',
  'nav.atlas': 'Wereldkaart',
  'nav.atlas.short': 'Kaart',
  'nav.journey': 'Dagboek',
  'nav.journey.short': 'Dagboek',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Onderdelen van deze reis',
  'trip.nav.back': 'Reizen',
  'trip.nav.share': 'Delen',
  'trip.nav.shareLabel': 'Deze reis delen',
  'trip.tab.plan': 'Dagplan',
  'trip.tab.transports': 'Vervoer',
  'trip.tab.book': 'Boeken',
  'trip.tab.lists': 'Lijsten',
  'trip.tab.costs': 'Kosten',
  'trip.tab.files': 'Bestanden',
  'trip.tab.collab': 'Overleg',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Accountmenu',
  'account.settings': 'Instellingen',
  'account.billing': 'Abonnement en facturen',
  'account.admin': 'Beheer',
  'account.signOut': 'Uitloggen',
  'account.signingOut': 'Je wordt uitgelogd …',
  'account.signOutFailed': 'Uitloggen is niet gelukt',
  'account.signOutFailedBody':
    'Controleer je verbinding en probeer het opnieuw.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Weergave',
  'theme.light': 'Licht',
  'theme.dark': 'Donker',
  'theme.system': 'Zoals het apparaat',
  'theme.state.light': 'licht',
  'theme.state.dark': 'donker',
  'theme.state.system': 'zoals het apparaat',
  'theme.trigger': 'Weergave: {state}. Weergave wisselen',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Meldingen, alles gelezen',
  'bell.unread': {
    one: 'Meldingen, {unread} ongelezen',
    other: 'Meldingen, {unread} ongelezen',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Postvak',
  'inbox.title': 'Meldingen',
  'inbox.error': 'Je postvak is niet geladen',
  'inbox.allRead': 'Alles gelezen',
  'inbox.unread': {
    one: '{unread} ongelezen bericht',
    other: '{unread} ongelezen berichten',
  },
  'inbox.markAll': 'Alles als gelezen',
  'inbox.markingAll': 'Alles wordt op gelezen gezet',
  'inbox.cleared': 'Postvak leeggemaakt',
  'inbox.markAllFailed': 'Niet alles kon op gelezen worden gezet',
  'inbox.retryHint': 'Controleer je verbinding en probeer het opnieuw.',
  'inbox.filter.all': 'Alles',
  'inbox.filter.unread': 'Ongelezen',
  'inbox.waiting': {
    one: '{invitations} uitnodiging wacht',
    other: '{invitations} uitnodigingen wachten',
  },
  'inbox.empty.title': 'Je postvak is leeg',
  'inbox.empty.body':
    'Reisuitnodigingen, wijzigingen in het plan, herinneringen voor boekingen en vereffende bedragen komen hier allemaal binnen.',
  'inbox.empty.action': 'Terug naar het overzicht',
  'inbox.emptyUnread.title': 'Niets ongelezen',
  'inbox.emptyUnread.body':
    'Je hebt alles gelezen. Ga naar Alles om terug te kijken in de historie.',
  'inbox.emptyUnread.action': 'Alles tonen',
  'inbox.row.new': 'Nieuw',
  'inbox.row.accepted': 'Geaccepteerd',
  'inbox.row.declined': 'Geweigerd',
  'inbox.row.open': 'Openen',
  'inbox.row.markRead': 'Gelezen',
  'inbox.row.markingRead': 'Wordt op gelezen gezet',
  'inbox.row.markReadFailed': 'Dat kon niet op gelezen worden gezet',
  'inbox.preferences':
    'Bepaal wat hiervan je postvak, je mail en je telefoon bereikt.',
  'inbox.preferencesAction': 'Instellingen voor meldingen',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Je bent uitgenodigd voor {tripTitle}',
  'notification.trip.invited.body':
    '{actorName} heeft je aan de reis toegevoegd.',
  'notification.trip.updated.title': '{tripTitle} is gewijzigd',
  'notification.trip.updated.body': '{actorName} heeft het plan aangepast.',
  'notification.trip.member_added.title':
    '{memberName} reist mee op {tripTitle}',
  'notification.trip.member_added.body':
    'Het dagplan, de boekingen en de kosten zijn nu zichtbaar.',
  'notification.trip.member_removed.title':
    '{memberName} reist niet meer mee op {tripTitle}',
  'notification.trip.member_removed.body':
    'De toegang tot deze reis is beëindigd.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} begint over {days} dag',
    other: '{tripTitle} begint over {days} dagen',
  },
  'notification.trip.starting_soon.body':
    'Tijd om de paklijst en de boekingen na te lopen.',
  'notification.reservation.reminder.title': '{title} komt eraan',
  'notification.reservation.reminder.body':
    'Kijk bij de boeking zelf voor de tijd en de bevestigingscode.',
  'notification.reservation.confirmed.title': '{title} is bevestigd',
  'notification.reservation.confirmed.body':
    'De boeking staat op {tripTitle} als bevestigd.',
  'notification.expense.added.title': '{actorName} heeft een uitgave genoteerd',
  'notification.expense.added.body': '{title} op {tripTitle}.',
  'notification.expense.settled.title': '{actorName} heeft afgerekend',
  'notification.expense.settled.body':
    'Het openstaande bedrag op {tripTitle} is betaald.',
  'notification.list.assigned.title': '{actorName} heeft jou een taak gegeven',
  'notification.list.assigned.body': '{title} op {tripTitle}.',
  'notification.collab.message.title':
    '{actorName} schreef iets bij {tripTitle}',
  /**
   * The reader's own words, set in Dutch single quotation marks. English hands
   * the preview through bare; quoting it is what marks the fragment as somebody
   * else's sentence rather than ours.
   */
  'notification.collab.message.body': '‘{preview}’',
  'notification.collab.poll.title': 'Er loopt een peiling bij {tripTitle}',
  'notification.collab.poll.body': '‘{question}’',
  'notification.organization.invited.title':
    'Je bent uitgenodigd voor {organizationName}',
  'notification.organization.invited.body':
    'Accepteer om lid te worden van de werkruimte en van alles wat daarin gedeeld wordt.',
  'notification.journey.published.title': '{title} is gepubliceerd',
  'notification.journey.published.body':
    'Iedereen met de link kan het dagboek nu lezen.',
  'notification.billing.plan_changed.title': 'Je abonnement is gewijzigd',
  'notification.billing.plan_changed.body':
    '{organizationName} zit nu op het abonnement {plan}.',
  'notification.fallback.title': 'Er is iets veranderd in je werkruimte',
  'notification.fallback.body': 'Open de reis om te zien wat het was.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Het overzicht is niet geladen',
  'dashboard.blank.title': 'Hier begint je volgende reis',
  'dashboard.blank.body':
    'Maak een reis aan, zet de plekken die je wilt zien op de kaart en planned.travel bouwt daar het dagplan omheen.',
  'dashboard.blank.action': 'Een reis plannen',
  'dashboard.blank.secondary': 'Naar je wereldkaart',

  'dashboard.upNext': 'Eerstvolgend',
  'dashboard.openPlan': 'Open het dagplan',
  'dashboard.hero.travellers': 'Reisgenoten',
  'dashboard.hero.travellersHint': 'in deze werkruimte',
  'dashboard.hero.dates': 'Reisdata',
  'dashboard.hero.datesUnset': 'Nog open',
  'dashboard.hero.datesHint': { one: '{days} dag', other: '{days} dagen' },
  'dashboard.hero.datesMissing': 'Vul data in, dan ontstaan de dagen',
  'dashboard.hero.startsIn': 'Begint over',
  'dashboard.hero.started': 'Begonnen',
  'dashboard.hero.today': 'Vandaag',
  'dashboard.hero.startUnknown': 'geen begindatum',
  'dashboard.hero.startToday': 'goede reis',
  'dashboard.hero.startPast': {
    one: 'dag geleden',
    other: 'dagen geleden',
  },
  'dashboard.hero.startFuture': { one: 'dag', other: 'dagen' },
  'dashboard.hero.places': 'Plekken',
  'dashboard.hero.placesNone': 'nog niets op de kaart',
  'dashboard.hero.placesHint': 'op de kaart',

  'dashboard.stat.countries': 'Bezochte landen',
  'dashboard.stat.countriesUnit': 'van {total}',
  'dashboard.stat.countriesNone':
    'Markeer een land om je wereldkaart te beginnen',
  'dashboard.stat.visits': {
    one: '{visits} bezoek vastgelegd',
    other: '{visits} bezoeken vastgelegd',
  },
  'dashboard.stat.trips': 'Reizen totaal',
  'dashboard.stat.tripsCaption': '{planning} in planning · {booked} geboekt',
  'dashboard.stat.places': 'Plekken op de kaart',
  'dashboard.stat.placesNone': 'Nog niets op de kaart',
  'dashboard.stat.placesAcross': {
    one: 'verdeeld over {trips} reis',
    other: 'verdeeld over {trips} reizen',
  },
  'dashboard.stat.bookings': 'Bevestigde boekingen',
  'dashboard.stat.bookingsNone': 'Geen boekingen op komst',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} boeking op komst',
    other: '{bookings} boekingen op komst',
  },

  'dashboard.trips.label': 'Jouw reizen',
  'dashboard.trips.all': 'Alle reizen',
  'dashboard.trips.empty.title': 'Nog geen reizen',
  'dashboard.trips.empty.body':
    'Alles wat je plant verschijnt hier, het nieuwste bovenaan.',
  'dashboard.trips.empty.action': 'Een reis aanmaken',

  'dashboard.bookings.label': 'Komende boekingen',
  'dashboard.bookings.empty.title': 'Nog niets geboekt',
  'dashboard.bookings.empty.body':
    'Bevestigde overnachtingen, tafels en tickets verschijnen hier zodra hun datum dichterbij komt.',

  'dashboard.pipeline.label': 'Reizen per fase',
  'dashboard.pipeline.empty':
    'Nog niets onderweg. Je eerste reis splitst dit hier uit per fase.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favoriet',
    other: '{favourites} favorieten',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} gearchiveerde reis',
    other: '{archived} gearchiveerde reizen',
  },

  'dashboard.storage.label': 'Opslag',
  'dashboard.storage.count': '{used} van {limit}',
  'dashboard.storage.files': {
    one: "{files} bestand over al je reizen, foto's en tickets inbegrepen.",
    other: "{files} bestanden over al je reizen, foto's en tickets inbegrepen.",
  },
  'dashboard.storage.more': 'Meer ruimte nodig?',
  'dashboard.storage.plans': 'Bekijk de abonnementen',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Het beheer is niet geladen',
  'admin.denied.title': 'Alleen beheerders van de werkruimte openen dit',
  'admin.denied.body':
    'Vraag een eigenaar of beheerder van deze werkruimte om je rol aan te passen als je dit nodig hebt.',
  'admin.denied.action': 'Terug naar het overzicht',
  'admin.eyebrow': 'Beheer van de werkruimte',
  'admin.description': 'Abonnement {plan} · aangemaakt {date}',
  'admin.createdUnknown': 'kortgeleden',
  'admin.workspaceSettings': 'Instellingen van de werkruimte',
  'admin.billing': 'Abonnement en facturen',

  'admin.invitations.title': {
    one: '{invitations} uitnodiging staat nog open',
    other: '{invitations} uitnodigingen staan nog open',
  },
  'admin.invitations.body':
    'Elke openstaande uitnodiging telt mee voor de plaatsen waarvoor je abonnement betaalt.',
  'admin.invitations.action': 'Uitnodigingen nalopen',

  'admin.stat.members': 'Leden',
  'admin.stat.membersCaption': {
    one: '{invitations} uitnodiging open',
    other: '{invitations} uitnodigingen open',
  },
  'admin.stat.storage': 'Opslag',
  'admin.stat.storageUnit': 'van {limit}',
  'admin.stat.storageUnlimited': 'geen grens',
  'admin.stat.storageCaption': "Bestanden, foto's en exports",
  'admin.stat.audit': 'Logboekregels',
  'admin.stat.auditCaption': 'De meest recente activiteit staat hieronder',
  'admin.stat.plan': 'Abonnement',
  'admin.stat.planCaption':
    'Limieten worden onderin bij de gegevenslaag afgedwongen',

  'admin.quotas.label': 'Limieten',
  'admin.quotas.count': {
    one: '{metrics} maatstaf',
    other: '{metrics} maatstaven',
  },
  'admin.quotas.unlimited': 'Onbeperkt',
  'admin.quotas.value': '{used} van {limit}',

  'admin.members.label': 'Leden',
  'admin.members.table': 'Leden van deze werkruimte',
  'admin.members.person': 'Persoon',
  'admin.members.role': 'Rol',
  'admin.members.joined': 'Lid sinds',

  'admin.activity.label': 'Recente activiteit',
  'admin.activity.empty.title': 'Nog niets vastgelegd',
  'admin.activity.empty.body':
    'Elke schrijfactie die ertoe doet wordt meteen aan het logboek toegevoegd.',
  'admin.activity.workspace': 'de werkruimte zelf',
  'admin.actions.label': 'Drukste acties',
  'admin.actions.count': {
    one: '{actions} actie',
    other: '{actions} acties',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Concept',
  'tripStatus.planning': 'In planning',
  'tripStatus.booked': 'Geboekt',
  'tripStatus.active': 'Onderweg',
  'tripStatus.completed': 'Afgerond',
  'tripStatus.archived': 'Gearchiveerd',

  'bookingStatus.none': 'Niet geboekt',
  'bookingStatus.pending': 'In behandeling',
  'bookingStatus.confirmed': 'Bevestigd',
  'bookingStatus.cancelled': 'Geannuleerd',
  'bookingStatus.completed': 'Klaar',

  'bookingType.accommodation': 'Verblijf',
  'bookingType.restaurant': 'Tafel',
  'bookingType.activity': 'Activiteit',
  'bookingType.tour': 'Excursie',
  'bookingType.ticket': 'Kaartje',
  'bookingType.transport': 'Vervoer',
  'bookingType.other': 'Boeking',

  'role.owner': 'Eigenaar',
  'role.admin': 'Beheerder',
  'role.member': 'Lid',

  'metric.trips': 'Reizen',
  'metric.places': 'Plekken',
  'metric.members': 'Leden',
  'metric.files': 'Bestanden',
  'metric.storage_bytes': 'Opslag',
  'metric.collections': 'Collecties',
  'metric.journeys': 'Dagboeken',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Dit is niet geladen',
  'error.body':
    'Er is niets verloren gegaan. Probeer het opnieuw, en als het blijft gebeuren is de melding hieronder wat je ons stuurt.',
  'error.retry': 'Opnieuw proberen',
  'error.dashboard': 'Terug naar overzicht',
  'error.unknown': 'Het verzoek liep vast voordat het klaar was.',
  'error.root': 'Hier zijn we van de route geraakt',
  'error.session': 'Je toegang tot de werkruimte is veranderd',

  'notFound.eyebrow': 'Fout 404',
  'notFound.title': 'Deze pagina staat op geen enkele kaart',
  'notFound.body':
    'De link is misschien verouderd, of de reis erachter is verplaatst of verwijderd.',
  'notFound.trips': 'Alle reizen',
  'notFound.rootBody':
    'We hebben de hele route afgezocht. Misschien staat er een typefout in het adres, of is de pagina inmiddels verhuisd.',
  'notFound.home': 'Terug naar het begin',
  'notFound.plans': 'Bekijk de abonnementen',

  'session.noWorkspace':
    'Je account hoort nog bij geen enkele werkruimte. Log uit en weer in om dat af te ronden.',
  'session.membershipRemoved':
    'Je lidmaatschap van deze werkruimte is beëindigd.',
} satisfies TranslationOf<typeof En>

export default messages
