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
  'account.menu': '{name}, accountmenu',
  'account.settings': 'Instellingen',
  'account.billing': 'Abonnement en facturen',
  'account.admin': 'Beheer',
  'account.signOut': 'Uitloggen',
  'account.signingOut': 'Je wordt uitgelogd …',
  'account.signOutFailed': 'Uitloggen is niet gelukt',
  'account.signOutFailedBody':
    'Controleer je verbinding en probeer het opnieuw.',

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Werkruimte',
  'workspace.switched': 'Overgeschakeld naar {name}',
  'workspace.switchFailed': 'Wisselen van werkruimte is niet gelukt',
  'workspace.switchFailedBody':
    'Controleer je verbinding en probeer het opnieuw.',
  'workspace.switchUnconfirmedBody':
    'De actieve werkruimte kon niet worden bevestigd. Laad de pagina opnieuw voordat je doorgaat.',
  'workspace.switchRateLimitedBody':
    'Te vaak van werkruimte gewisseld. Wacht even en probeer het opnieuw.',
  'workspace.create': 'Werkruimte maken',
  'workspace.createTitle': 'Een werkruimte maken',
  'workspace.createDescription':
    'Een aparte ruimte met eigen reizen, plekken en mensen. Begint met het abonnement Gratis en deelt het abonnement van de werkruimte waarin je zit niet.',
  'workspace.createName': 'Naam van de werkruimte',
  'workspace.createUpgrade':
    '“{workspace}” heeft het abonnement Gratis, en alleen een werkruimte met een betaald abonnement kan er nog een maken. Heeft een van je andere werkruimtes een betaald abonnement, wissel daar dan naartoe en maak de nieuwe werkruimte vanaf daar. Anders upgrade je “{workspace}”.',
  'workspace.createLimitReached':
    'Je hebt het maximale aantal werkruimtes bereikt waartoe één account kan behoren.',
  'workspace.createRoleRequired':
    'Alleen een beheerder van de werkruimte kan een werkruimte maken. Vraag een beheerder van deze werkruimte of wissel naar een werkruimte die je beheert.',
  'workspace.createFailed': 'De werkruimte kon niet worden gemaakt',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Weergave',
  'theme.light': 'Licht',
  'theme.dark': 'Donker',
  'theme.system': 'Zoals het apparaat',
  'theme.state.light': 'licht',
  'theme.state.dark': 'donker',
  'theme.state.system': 'zoals het apparaat',
  'theme.trigger': 'Weergave: {state}. Weergave wisselen',
  'language.trigger': 'Taal: {language}. Taal wijzigen',
  'language.hint':
    'Wordt onthouden op dit apparaat. Zodra je inlogt, geldt de taal die in je account is ingesteld; je kunt die wijzigen in Instellingen.',
  'language.announce': 'Taal gewijzigd naar {language}',
  'language.notApplied':
    'Deze browser heeft je keuze niet bewaard. Sta cookies toe voor deze site en kies opnieuw.',

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
  'notification.trip.copied.title': '{tripTitle} is klaar',
  'notification.trip.copied.body': {
    one: 'Meegekomen: {days} dag',
    other: 'Meegekomen: {days} dagen',
  },
  'notification.trip.copied.places': {
    one: '{places} plek',
    other: '{places} plekken',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} notitie vervallen',
    other: '{dropped} notities vervallen',
  },
  'notification.trip.copyFailed.title':
    '{tripTitle} kon niet worden gekopieerd',
  'notification.trip.copyFailed.body':
    'Er is niets verloren gegaan. Probeer het opnieuw vanaf het origineel.',
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
  'notification.billing.invoice_paid.title': 'Betaling ontvangen',
  'notification.billing.invoice_paid.body':
    'De laatste factuur voor {organizationName} is betaald.',
  'notification.billing.payment_failed.title': 'Een betaling is mislukt',
  'notification.billing.payment_failed.body':
    '{organizationName} heeft een achterstallige betaling. Werk de betaalmethode bij om het abonnement te houden.',
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
  'dashboard.hero.nights': 'Nachten',
  'dashboard.hero.companionsHint': 'op deze reis',
  'dashboard.hero.progress': 'Onderweg',
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
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Referentie',
  'dashboard.widgets.choose': 'Widgets kiezen',
  'dashboard.widgets.description':
    'De widgets die je naast je dashboard houdt.',
  'dashboard.clock.label': 'Wereldklok',
  'dashboard.clock.add': 'Tijdzone toevoegen',
  'dashboard.clock.search': 'Zoek steden en regio’s',
  'dashboard.clock.noMatches': 'Geen tijdzone met die naam',
  'dashboard.clock.remove': '{zone} verwijderen',
  'dashboard.clock.offset': '{offset} ten opzichte van je eigen tijd',
  'dashboard.clock.here': 'Je eigen tijd',
  'dashboard.clock.empty.title': 'Geen tijdzones vastgezet',
  'dashboard.clock.empty.body':
    'Zet een plaats vast en lees de klok ervan naast die van jou.',
  'dashboard.clock.unknown.title': 'Dit apparaat kent {zone} niet',
  'dashboard.clock.unknown.body':
    'De tijd ervan is hier niet te lezen. Verwijder de rij om dit op te lossen.',

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
  'admin.members.role.label': 'Rol van {name}',
  'admin.members.role.saved': '{name} is nu {role}.',
  'admin.members.role.impersonated':
    'Een rol kan niet worden gewijzigd terwijl je als een ander account handelt.',
  'admin.members.role.notPermitted':
    'Je kunt deze wijziging niet doorvoeren. Alleen een eigenaar kan de rol van eigenaar geven of een eigenaar wijzigen.',
  'admin.members.role.lastOwner':
    'Dit is de enige eigenaar van de werkruimte. Maak eerst iemand anders eigenaar.',
  'admin.members.role.notFound':
    'Deze persoon zit niet meer in de werkruimte. De lijst is vernieuwd.',
  'admin.members.role.failed': 'De rol kon niet worden gewijzigd. Probeer het opnieuw.',
  'admin.members.role.promote.title': '{name} eigenaar maken?',
  'admin.members.role.promote.body':
    '{name} krijgt dezelfde macht als jij: facturering, leden en instellingen. Een eigenaar kan elke andere eigenaar degraderen of verwijderen, ook jou.',
  'admin.members.role.promote.confirm': 'Eigenaar maken',
  'admin.members.role.promote.cancel': 'Annuleren',

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

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} reis',
    other: '{value} reizen',
  },
  'trips.count.favourites': {
    one: '{value} favoriet',
    other: '{value} favorieten',
  },
  'trips.count.archived': {
    one: '{value} gearchiveerd',
    other: '{value} gearchiveerd',
  },
  'trips.atLimit.body':
    'Je abonnement dekt {trips}. Archiveer een afgeronde reis of stap over naar een hoger abonnement om er meer tegelijk open te houden.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Nieuw dagboek',
  'newJourney.title': 'Begin een dagboek',
  'newJourney.description':
    'Een dagboek is de geschreven kant van een reis — stukjes op datum, met de foto’s en het weer waaraan je je herinnert.',
  'newJourney.titlePlaceholder': 'Twee weken in Kyoto',
  'newJourney.subtitle': 'Ondertitel',
  'newJourney.subtitleHint': 'Eén regel onder de titel, op het omslag.',
  'newJourney.subtitlePlaceholder': 'Tempels, treinen en veel te veel matcha',
  'newJourney.trip': 'Op basis van een reis',
  'newJourney.tripHint': 'Optioneel — verbindt het verhaal met het plan.',
  'newJourney.tripNone': 'Niet aan een reis gekoppeld',
  'newJourney.datesError': 'De einddatum ligt voor de start.',
  'newJourney.submit': 'Dagboek aanmaken',
  'newJourney.creating': 'Dagboek wordt aangemaakt',
  'newJourney.created': 'Dagboek begonnen',
  'newJourney.createdBody':
    'Voeg je eerste stukje toe om het verhaal te beginnen.',
  'newJourney.error':
    'Het dagboek kon niet worden aangemaakt. Probeer het straks opnieuw.',
  'newCollection.trigger': 'Nieuwe collectie',
  'newCollection.title': 'Begin een collectie',
  'newCollection.description':
    'Een plek voor de plekken die je vindt voordat je weet bij welke reis ze horen.',
  'newCollection.namePlaceholder': 'Koffie waarvoor je de stad oversteekt',
  'newCollection.descriptionHint': 'Wat hier thuishoort en wat niet.',
  'newCollection.submit': 'Collectie aanmaken',
  'newCollection.creating': 'Collectie wordt aangemaakt',
  'newCollection.created': 'Collectie aangemaakt',
  'newCollection.createdBody': 'Begin er plekken in op te slaan.',
  'newCollection.error':
    'De collectie kon niet worden aangemaakt. Probeer het straks opnieuw.',

  'newTrip.title': 'Een nieuwe reis beginnen',
  'newTrip.description':
    'Een titel is genoeg. Data bouwen het dagplan, en de rest kan wachten tot je het weet.',
  'newTrip.name': 'Naam van de reis',
  'newTrip.namePlaceholder': 'Kyoto in de kersenbloesem',
  'newTrip.destination': 'Bestemming',
  'newTrip.destinationHint': 'Een stad, een regio of de hele route.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japan',
  'newTrip.departure': 'Vertrek',
  'newTrip.return': 'Terugreis',
  'newTrip.returnError': 'De terugreisdatum ligt voor het vertrek.',
  'newTrip.currency': 'Valuta van het budget',
  'newTrip.currencyHint': 'Daarin wordt elke uitgave van deze reis opgeteld.',
  'newTrip.currencySearch': 'Zoek op code of naam',
  'newTrip.currencyEmpty': 'Geen valuta komt overeen.',
  'newTrip.currencyFavourites': 'Favorieten',
  'newTrip.currencyAll': 'Alle valuta',
  'newTrip.summary': 'Samenvatting',
  'newTrip.summaryPlaceholder': 'Twee weken tempels, treinen en noedelsoep.',
  'newTrip.duration': 'Duur in dagen',
  'newTrip.durationHint':
    'Zonder data begint de reis met dit aantal dagen zonder datum.',
  'newTrip.durationDerived': 'Berekend uit de twee data.',
  'newTrip.reminder': 'Herinnering voor vertrek',
  'newTrip.reminderNone': 'Geen',
  'newTrip.reminderBefore': {
    one: '{count} dag ervoor',
    other: '{count} dagen ervoor',
  },
  'newTrip.reminderCustom': 'Aangepast',
  'newTrip.reminderCustomDays': 'Dagen voor vertrek',
  'newTrip.reminderOn': 'Herinnering op {date}',
  'newTrip.reminderNoDeparture': 'Kies een vertrekdatum om de dag te zien.',
  'newTrip.submit': 'Reis aanmaken',
  'newTrip.creating': 'Reis wordt aangemaakt',
  'newTrip.error':
    'De reis kon niet worden aangemaakt. Probeer het straks opnieuw.',
  'newTrip.created': 'Reis aangemaakt',
  'newTrip.createdBody': 'Begin plekken op de kaart te zetten.',
  'newTrip.coverChoose': 'Omslagafbeelding toevoegen',
  'newTrip.coverChange': 'Omslagafbeelding wijzigen',
  'newTrip.coverHint':
    'Sleep hier een afbeelding naartoe, plak er een of kies een bestand. PNG, JPEG, WebP, AVIF of GIF.',
  'newTrip.coverChosen': 'Omslagafbeelding: {name}',
  'newTrip.coverRemove': 'Omslagafbeelding verwijderen',
  'newTrip.coverTypeError':
    '‘{name}’ kan niet als omslagafbeelding dienen. Kies een PNG-, JPEG-, WebP-, AVIF- of GIF-bestand.',
  'newTrip.coverSizeError':
    '‘{name}’ is groter dan {max}. Kies een kleinere afbeelding.',
  'newTrip.coverUploading': 'Omslagafbeelding wordt geüpload',
  'newTrip.coverFailedTitle': 'De omslagafbeelding is niet toegevoegd',
  'newTrip.coverFailed':
    'De reis is aangemaakt, maar ‘{name}’ kon niet als omslag worden geüpload.',
  'newTrip.coverRetry': 'Opnieuw proberen',
  'newTrip.coverContinue': 'Reis openen zonder omslag',
  'newTrip.people': 'Personen',
  'newTrip.peopleHint':
    'Ze worden toegevoegd zodra de reis is aangemaakt. Jij blijft de eigenaar.',
  'newTrip.peoplePlaceholder': 'Kies uit je werkruimte',
  'newTrip.peopleSearch': 'Zoeken op naam',
  'newTrip.peopleLoading': 'De personen in je werkruimte worden geladen',
  'newTrip.peopleLoadError':
    'De personen in je werkruimte konden niet worden geladen. Maak de reis aan en voeg ze toe via het scherm Personen van de reis.',
  'newTrip.peopleNone':
    'Je bent voorlopig de enige persoon in deze werkruimte.',
  'newTrip.peopleNoneMember':
    'Een eigenaar of beheerder van de werkruimte kan meer mensen uitnodigen.',
  'newTrip.peopleInvite': 'Mensen uitnodigen voor de werkruimte',
  'newTrip.peopleChosen': 'Gekozen personen en hun rollen',
  'newTrip.peopleFailedTitle':
    'De reis is aangemaakt, maar niet iedereen is toegevoegd',
  'newTrip.noticeBothTitle':
    'De reis is aangemaakt, maar niet alles is toegevoegd',
  'newTrip.peopleNotInWorkspace':
    '{name} zit niet meer in deze werkruimte en is daarom niet toegevoegd.',
  'newTrip.peopleAlreadyOn': '{name} stond al op deze reis.',
  'newTrip.peopleUnconfirmed':
    'Het toevoegen van {name} kon niet worden bevestigd. Kijk bij Personen of het gelukt is.',
  'newTrip.peopleContinue': 'Verder',
  'newTrip.peopleRetry': 'Opnieuw proberen',
  'newTrip.coverRetryOnly': 'Omslag opnieuw proberen',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Acties voor {title}',
  'tripActions.copy': 'Kopiëren',
  'tripActions.favourite': 'Toevoegen aan favorieten',
  'tripActions.unfavourite': 'Uit favorieten halen',
  'tripActions.edit': 'Bewerken',
  'tripActions.archive': 'Archiveren',
  'tripActions.restore': 'Terugzetten',
  'tripActions.delete': 'Verwijderen',
  'tripActions.deleteForGood': 'Definitief verwijderen',
  'tripActions.starFailed': 'De favoriet is niet opgeslagen',
  'tripActions.starFallback': 'De reis staat weer zoals hij stond.',
  'tripActions.archived': 'Reis gearchiveerd',
  'tripActions.archiveFailed': 'De reis kon niet worden gearchiveerd',
  'tripActions.restored': 'Reis teruggezet',
  'tripActions.restoreFailed': 'De reis kon niet worden teruggezet',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Reis bewerken',
  'editTrip.submit': 'Wijzigingen opslaan',
  'editTrip.saving': 'De reis wordt opgeslagen',
  'editTrip.cancel': 'Annuleren',
  'editTrip.saved': 'Reis bijgewerkt',
  'editTrip.errorTitle': 'Dat is niet opgeslagen',
  'editTrip.retry': 'Opnieuw proberen',
  'editTrip.error':
    'De reis kon niet worden opgeslagen. Probeer het zo nog eens.',
  'editTrip.coverFailed':
    '‘{name}’ kon niet als omslag worden geüpload. Er is nog niets anders opgeslagen.',
  'editTrip.coverContinue': 'Opslaan zonder de nieuwe omslag',
  'editTrip.currencyLocked':
    'Deze reis bevat al prijzen, dus de valuta van het budget kan hier niet worden gewijzigd. Gebruik Valuta van het budget wijzigen op het tabblad Kosten, of zet het terug op {current} om je andere wijzigingen op te slaan.',
  'editTrip.currencyReadonly':
    'De valuta van het budget wijzig je op het tabblad Kosten.',
  'editTrip.currencyLink': 'Tabblad Kosten openen',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': '“{title}” voorgoed verwijderen?',
  'deleteTrip.description':
    'Er is geen ongedaan maken en geen prullenbak. Archiveren haalt een reis uit de lijst zonder hem kwijt te raken.',
  'deleteTrip.reading': 'Lezen wat deze reis bevat',
  'deleteTrip.errorTitle': 'Dat is niet geladen',
  'deleteTrip.summaryError': 'Wat deze reis bevat, kon niet worden gelezen.',
  'deleteTrip.confirmLabel': 'Typ de naam van de reis om te bevestigen',
  'deleteTrip.deleting': 'De reis wordt verwijderd',
  'deleteTrip.deleted': 'Reis verwijderd',
  'deleteTrip.failed': 'De reis kon niet worden verwijderd',
  'deleteTrip.carried.reservations': {
    one: 'boeking',
    other: 'boekingen',
  },
  'deleteTrip.carried.transports': {
    one: 'rit',
    other: 'ritten',
  },
  'deleteTrip.carried.expenses': {
    one: 'uitgave',
    other: 'uitgaven',
  },
  'deleteTrip.carried.files': {
    one: 'bestand',
    other: 'bestanden',
  },
  'deleteTrip.carried.members': {
    one: 'persoon',
    other: 'personen',
  },
  'copyTrip.title': '“{title}” kopiëren',
  'copyTrip.nameLabel': 'Naam van de kopie',
  'copyTrip.titleRequired': 'Geef de kopie een naam.',
  'copyTrip.datesLabel': 'Datums',
  'copyTrip.datesTogether': 'Vul beide datums in of wis ze allebei.',
  'copyTrip.clearDates': 'Kopiëren zonder datums',
  'copyTrip.carries':
    'Dagen, plekken en notities gaan mee. Boekingen, geld, bestanden en mensen niet.',
  'copyTrip.shorter':
    'Dat is korter dan het origineel. De plekken van de extra dagen gaan naar de ideeën en hun notities vervallen.',
  'copyTrip.submit': 'Reis kopiëren',
  'copyTrip.copying': 'De reis wordt gekopieerd',
  'copyTrip.cancel': 'Annuleren',
  'copyTrip.started': '“{title}” wordt gekopieerd',
  'copyTrip.errorTitle': 'Dat is niet gekopieerd',
  'copyTrip.error':
    'De reis kon niet worden gekopieerd. Probeer het zo meteen opnieuw.',

  'trips.error': 'Je reizen zijn niet geladen',
  'trips.eyebrow': 'Werkruimte',
  'trips.nothingPlanned': 'Nog niets gepland',
  'trips.search': 'Reizen zoeken',
  'trips.atLimit.title':
    'Je hebt elke reis gebruikt die je abonnement toestaat',
  'trips.atLimit.action': 'Abonnementen vergelijken',
  'trips.noMatch.title': 'Niets past bij dit filter',
  'trips.noMatch.body':
    'Kies een andere fase, wis de zoekopdracht of kijk in het archief.',
  'trips.noMatch.action': 'Filters wissen',
  'trips.empty.body':
    'Een reis houdt je dagindeling, je kaart, je boekingen, je paklijsten en het geld bij elkaar. Begin er een en de rest volgt.',
  'trips.next.title': 'Ergens hierna',
  'trips.next.body':
    'Begin een reis en planned.travel maakt een dag per datum, klaar voor alles wat je hebt opgeslagen.',
  'trips.savedPlaces': 'Opgeslagen plekken',
  'trips.filter.all': 'Alle',
  'trips.filter.favourites': 'Favorieten',
  'trips.view.label': 'Weergave',
  'trips.view.grid': 'Raster',
  'trips.view.list': 'Lijst',
  'trips.card.favourite': 'Favoriet',
  'trips.card.noDestination': 'Bestemming nog niet gekozen',
  'trips.card.noDates': 'Data nog niet gekozen',
  'trips.card.startsIn': 'over {days} d',
  'trips.card.days': '{days} d',
  'trips.card.copying': 'Wordt gekopieerd',
  'trips.card.copyingLabel': '{title} wordt nog gekopieerd',
  'trips.card.copyingReason': 'Wacht tot de kopie klaar is.',
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
  'error.reported': 'We hebben een melding gekregen en kijken ernaar.',
  'error.reference': 'Referentie',
  'error.feedback.open': 'Vertel ons wat er gebeurde',
  'error.feedback.label': 'Wat was u aan het doen toen dit gebeurde?',
  'error.feedback.send': 'Versturen',
  'error.feedback.sent': 'Dank u — daar hebben we veel aan.',
  'error.feedback.failed':
    'Versturen is niet gelukt. De referentie hierboven bereikt ons wel.',
  'error.root': 'Hier zijn we van de route geraakt',
  'error.session': 'Je toegang tot de werkruimte is veranderd',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Een probleem melden',
  'feedback.formTitle': 'Een probleem melden',
  'feedback.messageLabel': 'Wat gaat er mis, of wat zou anders moeten?',
  'feedback.messagePlaceholder':
    'Wat verwachtte je, en wat gebeurde er in plaats daarvan?',
  'feedback.emailLabel': 'E-mailadres',
  'feedback.emailPlaceholder': 'jij@example.com',
  'feedback.isRequiredLabel': '(verplicht)',
  'feedback.submitButtonLabel': 'Melding versturen',
  'feedback.cancelButtonLabel': 'Annuleren',
  'feedback.confirmButtonLabel': 'Bevestigen',
  'feedback.addScreenshotButtonLabel': 'Screenshot toevoegen',
  'feedback.removeScreenshotButtonLabel': 'Screenshot verwijderen',
  'feedback.highlightToolText': 'Markeren',
  'feedback.hideToolText': 'Verbergen',
  'feedback.successMessageText': 'Bedankt — we hebben je melding.',
  'feedback.errorEmptyMessageText':
    'Schrijf eerst een zin — een lege melding zegt ons niets.',
  'feedback.errorTimeoutText':
    'Dit duurt te lang, en we kunnen niet bevestigen dat de melding is verstuurd.',
  'feedback.errorForbiddenText': 'Deze pagina mag geen meldingen versturen.',
  'feedback.errorGenericText':
    'Het versturen lukte niet. Controleer de verbinding, en of er een adblocker tussen zit.',

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
  'session.workspaceChanged':
    'De werkruimte is gewijzigd in een ander tabblad of venster. Er is niets opgeslagen.',
  'session.workspaceChangedTitle':
    'De werkruimte is gewijzigd in een ander tabblad',
  'session.workspaceChangedBody':
    'Dit tabblad toont {name}, maar de werkruimte is gewijzigd in een ander tabblad of venster. Er is niets opgeslagen.',
  'session.openCurrentWorkspace': 'Open de huidige werkruimte',
  'session.workspaceChangedDismiss': 'Niet nu',
} satisfies TranslationOf<typeof En>

export default messages
