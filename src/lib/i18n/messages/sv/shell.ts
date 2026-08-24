/**
 * Everything the application shell says, in Swedish.
 *
 * Authored from `../en/shell.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** `du` throughout, which is simply how Swedish addresses anyone.
 *
 * **Plural.** `Intl.PluralRules('sv')` reports `one` and `other`, the same two
 * branches English needs.
 *
 * **Words chosen once and kept.** `trip` is "resa", `workspace` is "arbetsyta",
 * `plan` in the billing sense is "abonnemang" and `plan` in the itinerary sense
 * is "dagsplan" — English uses one word for both and Swedish must not, or a
 * trip tab and a subscription row read as the same thing. `Atlas` is
 * "världskarta", because the section is the world map that records where the
 * traveller has been.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/shell'

const messages = {
  /* -------------------------------------------------------------- navigation */
  'nav.primary': 'Huvudavsnitt',
  'nav.mobile': 'Avsnitt',
  'nav.dashboardLink': 'planned.travel översikt',
  'nav.homeLink': 'planned.travel startsida',
  'nav.newTrip': 'Ny resa',

  'nav.trips': 'Mina resor',
  'nav.trips.short': 'Resor',
  'nav.vacay': 'Semester',
  'nav.vacay.short': 'Semester',
  'nav.atlas': 'Världskarta',
  'nav.atlas.short': 'Karta',
  'nav.journey': 'Dagbok',
  'nav.journey.short': 'Dagbok',

  /* ---------------------------------------------------------- trip sub-nav */
  'trip.nav.label': 'Delar av resan',
  'trip.nav.back': 'Resor',
  'trip.nav.share': 'Dela',
  'trip.nav.shareLabel': 'Dela den här resan',
  'trip.tab.plan': 'Dagsplan',
  'trip.tab.transports': 'Transporter',
  'trip.tab.book': 'Boka',
  'trip.tab.lists': 'Listor',
  'trip.tab.costs': 'Kostnader',
  'trip.tab.files': 'Filer',
  'trip.tab.collab': 'Samarbete',

  /* ------------------------------------------------------------ user menu */
  'account.menu': 'Kontomeny',
  'account.settings': 'Inställningar',
  'account.billing': 'Abonnemang och betalning',
  'account.admin': 'Administration',
  'account.signOut': 'Logga ut',
  'account.signingOut': 'Du loggas ut …',
  'account.signOutFailed': 'Utloggningen gick inte igenom',
  'account.signOutFailedBody': 'Kontrollera din uppkoppling och försök igen.',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Utseende',
  'theme.light': 'Ljust',
  'theme.dark': 'Mörkt',
  'theme.system': 'Som enheten',
  'theme.state.light': 'ljust',
  'theme.state.dark': 'mörkt',
  'theme.state.system': 'som enheten',
  'theme.trigger': 'Utseende: {state}. Byt utseende',

  /* ------------------------------------------------------------------ bell */
  'bell.none': 'Aviseringar, inget oläst',
  'bell.unread': {
    one: 'Aviseringar, {unread} oläst',
    other: 'Aviseringar, {unread} olästa',
  },

  /* ----------------------------------------------------------------- inbox */
  'inbox.eyebrow': 'Inkorg',
  'inbox.title': 'Aviseringar',
  'inbox.error': 'Din inkorg lästes inte in',
  'inbox.allRead': 'Allt är läst',
  'inbox.unread': {
    one: '{unread} oläst meddelande',
    other: '{unread} olästa meddelanden',
  },
  'inbox.markAll': 'Markera allt läst',
  'inbox.markingAll': 'Allt markeras som läst',
  'inbox.cleared': 'Inkorgen är tömd',
  'inbox.markAllFailed': 'Allt kunde inte markeras som läst',
  'inbox.retryHint': 'Kontrollera din uppkoppling och försök igen.',
  'inbox.filter.all': 'Allt',
  'inbox.filter.unread': 'Olästa',
  'inbox.waiting': {
    one: '{invitations} inbjudan väntar',
    other: '{invitations} inbjudningar väntar',
  },
  'inbox.empty.title': 'Din inkorg är tom',
  'inbox.empty.body':
    'Reseinbjudningar, ändringar i planen, påminnelser om bokningar och reglerade belopp landar allihop här.',
  'inbox.empty.action': 'Tillbaka till översikten',
  'inbox.emptyUnread.title': 'Inget oläst',
  'inbox.emptyUnread.body':
    'Du har läst allt. Byt till Allt för att bläddra tillbaka i historiken.',
  'inbox.emptyUnread.action': 'Visa allt',
  'inbox.row.new': 'Nytt',
  'inbox.row.accepted': 'Accepterad',
  'inbox.row.declined': 'Avböjd',
  'inbox.row.open': 'Öppna',
  'inbox.row.markRead': 'Läst',
  'inbox.row.markingRead': 'Markeras som läst',
  'inbox.row.markReadFailed': 'Det kunde inte markeras som läst',
  'inbox.preferences':
    'Bestäm vad av det här som når din inkorg, din mejl och din telefon.',
  'inbox.preferencesAction': 'Inställningar för aviseringar',

  /* ----------------------------------------------- stored notification copy */
  'notification.trip.invited.title': 'Du är inbjuden till {tripTitle}',
  'notification.trip.invited.body': '{actorName} lade till dig på resan.',
  'notification.trip.updated.title': '{tripTitle} har ändrats',
  'notification.trip.updated.body': '{actorName} har justerat planen.',
  'notification.trip.member_added.title':
    '{memberName} följer med på {tripTitle}',
  'notification.trip.member_added.body':
    'Dagsplan, bokningar och kostnader är därmed synliga.',
  'notification.trip.member_removed.title':
    '{memberName} har lämnat {tripTitle}',
  'notification.trip.member_removed.body': 'Åtkomsten till resan är avslutad.',
  'notification.trip.starting_soon.title': {
    one: '{tripTitle} börjar om {days} dag',
    other: '{tripTitle} börjar om {days} dagar',
  },
  'notification.trip.starting_soon.body':
    'Dags att gå igenom packlistan och bokningarna.',
  'notification.reservation.reminder.title': '{title} närmar sig',
  'notification.reservation.reminder.body':
    'Se tid och bokningsnummer på själva bokningen.',
  'notification.reservation.confirmed.title': '{title} är bekräftad',
  'notification.reservation.confirmed.body':
    'Bokningen är markerad som bekräftad på {tripTitle}.',
  'notification.expense.added.title': '{actorName} har lagt in en utgift',
  'notification.expense.added.body': '{title} på {tripTitle}.',
  'notification.expense.settled.title': '{actorName} har gjort rätt för sig',
  'notification.expense.settled.body':
    'Det som stod ute på {tripTitle} är betalt.',
  'notification.list.assigned.title': '{actorName} har gett dig en punkt',
  'notification.list.assigned.body': '{title} på {tripTitle}.',
  'notification.collab.message.title': '{actorName} skrev något i {tripTitle}',
  /**
   * The reader's own words, set in Swedish quotation marks. English hands the
   * preview through bare; quoting it is what marks the fragment as somebody
   * else's sentence rather than ours.
   */
  'notification.collab.message.body': '”{preview}”',
  'notification.collab.poll.title': 'En omröstning pågår i {tripTitle}',
  'notification.collab.poll.body': '”{question}”',
  'notification.organization.invited.title':
    'Du är inbjuden till {organizationName}',
  'notification.organization.invited.body':
    'Tacka ja för att gå med i arbetsytan och allt som delas där.',
  'notification.journey.published.title': '{title} är publicerad',
  'notification.journey.published.body':
    'Alla som har länken kan läsa dagboken nu.',
  'notification.billing.plan_changed.title': 'Ditt abonnemang har ändrats',
  'notification.billing.plan_changed.body':
    '{organizationName} kör nu abonnemanget {plan}.',
  'notification.fallback.title': 'Något har ändrats i din arbetsyta',
  'notification.fallback.body': 'Öppna resan för att se vad det var.',

  /* ------------------------------------------------------------- dashboard */
  'dashboard.error': 'Översikten lästes inte in',
  'dashboard.blank.title': 'Här börjar din nästa resa',
  'dashboard.blank.body':
    'Skapa en resa, sätt ut platserna du vill se på kartan, så bygger planned.travel dagsplanen runt dem.',
  'dashboard.blank.action': 'Planera en resa',
  'dashboard.blank.secondary': 'Till din världskarta',

  'dashboard.upNext': 'Närmast',
  'dashboard.openPlan': 'Öppna dagsplanen',
  'dashboard.hero.travellers': 'Ressällskap',
  'dashboard.hero.travellersHint': 'i arbetsytan',
  'dashboard.hero.dates': 'Resdatum',
  'dashboard.hero.datesUnset': 'Inte satta',
  'dashboard.hero.datesHint': { one: '{days} dag', other: '{days} dagar' },
  'dashboard.hero.datesMissing': 'Fyll i datum, så byggs dagarna',
  'dashboard.hero.startsIn': 'Börjar om',
  'dashboard.hero.started': 'Startade för',
  'dashboard.hero.today': 'I dag',
  'dashboard.hero.startUnknown': 'inget startdatum',
  'dashboard.hero.startToday': 'ha det bra där ute',
  'dashboard.hero.startPast': { one: 'dag sedan', other: 'dagar sedan' },
  'dashboard.hero.startFuture': { one: 'dag', other: 'dagar' },
  'dashboard.hero.places': 'Platser',
  'dashboard.hero.placesNone': 'inget på kartan än',
  'dashboard.hero.placesHint': 'på kartan',

  'dashboard.stat.countries': 'Besökta länder',
  'dashboard.stat.countriesUnit': 'av {total}',
  'dashboard.stat.countriesNone': 'Markera ett land så börjar din världskarta',
  'dashboard.stat.visits': {
    one: '{visits} besök noterat',
    other: '{visits} besök noterade',
  },
  'dashboard.stat.trips': 'Resor totalt',
  'dashboard.stat.tripsCaption': '{planning} planeras · {booked} bokade',
  'dashboard.stat.places': 'Platser på kartan',
  'dashboard.stat.placesNone': 'Inget på kartan än',
  'dashboard.stat.placesAcross': {
    one: 'fördelat på {trips} resa',
    other: 'fördelat på {trips} resor',
  },
  'dashboard.stat.bookings': 'Bekräftade bokningar',
  'dashboard.stat.bookingsNone': 'Inga bokningar på gång',
  'dashboard.stat.bookingsSoon': {
    one: '{bookings} bokning på gång',
    other: '{bookings} bokningar på gång',
  },

  'dashboard.trips.label': 'Dina resor',
  'dashboard.trips.all': 'Alla resor',
  'dashboard.trips.empty.title': 'Inga resor än',
  'dashboard.trips.empty.body':
    'Allt du planerar dyker upp här, det senaste överst.',
  'dashboard.trips.empty.action': 'Skapa en resa',

  'dashboard.bookings.label': 'Kommande bokningar',
  'dashboard.bookings.empty.title': 'Inget bokat än',
  'dashboard.bookings.empty.body':
    'Bekräftade boenden, bord och biljetter visas här när deras datum närmar sig.',

  'dashboard.pipeline.label': 'Resor efter läge',
  'dashboard.pipeline.empty':
    'Inget på gång än. Din första resa delar upp det här efter läge.',
  'dashboard.pipeline.favourites': {
    one: '{favourites} favorit',
    other: '{favourites} favoriter',
  },
  'dashboard.pipeline.archived': {
    one: '{archived} arkiverad resa',
    other: '{archived} arkiverade resor',
  },

  'dashboard.storage.label': 'Lagring',
  'dashboard.storage.count': '{used} av {limit}',
  'dashboard.storage.files': {
    one: '{files} fil över alla resor, foton och biljetter inräknade.',
    other: '{files} filer över alla resor, foton och biljetter inräknade.',
  },
  'dashboard.storage.more': 'Behöver du mer plats?',
  'dashboard.storage.plans': 'Se abonnemangen',

  /* ----------------------------------------------------------------- admin */
  'admin.error': 'Administrationen lästes inte in',
  'admin.denied.title': 'Bara arbetsytans administratörer öppnar det här',
  'admin.denied.body':
    'Be en ägare eller administratör i arbetsytan att ändra din roll om du behöver det.',
  'admin.denied.action': 'Tillbaka till översikten',
  'admin.eyebrow': 'Administrera arbetsytan',
  'admin.description': 'Abonnemanget {plan} · skapad {date}',
  'admin.createdUnknown': 'nyligen',
  'admin.workspaceSettings': 'Arbetsytans inställningar',
  'admin.billing': 'Abonnemang och betalning',

  'admin.invitations.title': {
    one: '{invitations} inbjudan är fortfarande obesvarad',
    other: '{invitations} inbjudningar är fortfarande obesvarade',
  },
  'admin.invitations.body':
    'Varje obesvarad inbjudan räknas mot platserna som abonnemanget betalar för.',
  'admin.invitations.action': 'Gå igenom inbjudningarna',

  'admin.stat.members': 'Medlemmar',
  'admin.stat.membersCaption': {
    one: '{invitations} inbjudan väntar',
    other: '{invitations} inbjudningar väntar',
  },
  'admin.stat.storage': 'Lagring',
  'admin.stat.storageUnit': 'av {limit}',
  'admin.stat.storageUnlimited': 'utan tak',
  'admin.stat.storageCaption': 'Filer, foton och exporter',
  'admin.stat.audit': 'Loggposter',
  'admin.stat.auditCaption': 'Den senaste aktiviteten står nedanför',
  'admin.stat.plan': 'Abonnemang',
  'admin.stat.planCaption':
    'Kvoterna tillämpas nere vid datalagret, inte i gränssnittet',

  'admin.quotas.label': 'Kvoter',
  'admin.quotas.count': {
    one: '{metrics} nyckeltal',
    other: '{metrics} nyckeltal',
  },
  'admin.quotas.unlimited': 'Obegränsat',
  'admin.quotas.value': '{used} av {limit}',

  'admin.members.label': 'Medlemmar',
  'admin.members.table': 'Medlemmar i den här arbetsytan',
  'admin.members.person': 'Namn',
  'admin.members.role': 'Roll',
  'admin.members.joined': 'Med sedan',

  'admin.activity.label': 'Senaste aktivitet',
  'admin.activity.empty.title': 'Inget noterat än',
  'admin.activity.empty.body':
    'Varje skrivning som spelar roll läggs till i loggen medan den sker.',
  'admin.activity.workspace': 'själva arbetsytan',
  'admin.actions.label': 'Vanligaste åtgärderna',
  'admin.actions.count': {
    one: '{actions} åtgärd',
    other: '{actions} åtgärder',
  },

  /* ---------------------------------------------------------- domain words */
  'tripStatus.draft': 'Utkast',
  'tripStatus.planning': 'Planeras',
  'tripStatus.booked': 'Bokad',
  'tripStatus.active': 'Pågår',
  'tripStatus.completed': 'Avslutad',
  'tripStatus.archived': 'Arkiverad',

  'bookingStatus.none': 'Inte bokad',
  'bookingStatus.pending': 'Väntar',
  'bookingStatus.confirmed': 'Bekräftad',
  'bookingStatus.cancelled': 'Avbokad',
  'bookingStatus.completed': 'Klar',

  'bookingType.accommodation': 'Boende',
  'bookingType.restaurant': 'Bord',
  'bookingType.activity': 'Aktivitet',
  'bookingType.tour': 'Rundtur',
  'bookingType.ticket': 'Biljett',
  'bookingType.transport': 'Färd',
  'bookingType.other': 'Bokning',

  'role.owner': 'Ägare',
  'role.admin': 'Administratör',
  'role.member': 'Medlem',

  'metric.trips': 'Resor',
  'metric.places': 'Platser',
  'metric.members': 'Medlemmar',
  'metric.files': 'Filer',
  'metric.storage_bytes': 'Lagring',
  'metric.collections': 'Samlingar',
  'metric.journeys': 'Dagböcker',

  /* -------------------------------------------------------------- failures */
  'error.title': 'Det här lästes inte in',
  'error.body':
    'Ingenting gick förlorat. Försök igen, och om det fortsätter hända är uppgiften nedanför det du skickar till oss.',
  'error.retry': 'Försök igen',
  'error.dashboard': 'Tillbaka till översikten',
  'error.unknown': 'Förfrågan avbröts innan den hann bli klar.',
  'error.root': 'Något kom bort från rutten',
  'error.session': 'Din åtkomst till arbetsytan har ändrats',

  'notFound.eyebrow': 'Fel 404',
  'notFound.title': 'Den här sidan finns inte på kartan',
  'notFound.body':
    'Länken kan vara gammal, eller så har resan bakom den flyttats eller tagits bort.',
  'notFound.trips': 'Alla resor',
  'notFound.rootBody':
    'Vi letade längs hela rutten. Adressen kan vara felstavad, eller så har sidan hunnit flytta vidare.',
  'notFound.home': 'Tillbaka till början',
  'notFound.plans': 'Se abonnemangen',

  'session.noWorkspace':
    'Ditt konto hör ännu inte till någon arbetsyta. Logga ut och in igen för att bli klar med det.',
  'session.membershipRemoved':
    'Ditt medlemskap i den här arbetsytan har avslutats.',
} satisfies TranslationOf<typeof En>

export default messages
