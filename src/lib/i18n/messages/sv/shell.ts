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

  /* ------------------------------------------------------ workspace switcher */
  'workspace.label': 'Arbetsyta',
  'workspace.switched': 'Bytte till {name}',
  'workspace.switchFailed': 'Det gick inte att byta arbetsyta',
  'workspace.switchFailedBody': 'Kontrollera din uppkoppling och försök igen.',
  'workspace.switchUnconfirmedBody':
    'Det gick inte att bekräfta den aktiva arbetsytan. Ladda om sidan innan du fortsätter.',
  'workspace.switchRateLimitedBody':
    'För många byten av arbetsyta. Vänta en stund och försök igen.',
  'workspace.create': 'Skapa arbetsyta',
  'workspace.createTitle': 'Skapa en arbetsyta',
  'workspace.createDescription':
    'En separat yta med egna resor, platser och personer. Den startar i planen Gratis och delar inte plan med arbetsytan du är i.',
  'workspace.createName': 'Arbetsytans namn',
  'workspace.createUpgrade':
    '”{workspace}” är på planen Gratis, och bara en arbetsyta med en betald plan kan skapa en till. Har någon av dina andra arbetsytor en betald plan, byt till den och skapa därifrån. Annars uppgraderar du ”{workspace}”.',
  'workspace.createLimitReached':
    'Du har nått det största antalet arbetsytor som ett konto kan tillhöra.',
  'workspace.createRoleRequired':
    'Bara en administratör för arbetsytan kan skapa en arbetsyta. Fråga en administratör för den här arbetsytan eller byt till en arbetsyta som du administrerar.',
  'workspace.createFailed': 'Det gick inte att skapa arbetsytan',

  /* --------------------------------------------------------- theme switcher */
  'theme.label': 'Utseende',
  'theme.light': 'Ljust',
  'theme.dark': 'Mörkt',
  'theme.system': 'Som enheten',
  'theme.state.light': 'ljust',
  'theme.state.dark': 'mörkt',
  'theme.state.system': 'som enheten',
  'theme.trigger': 'Utseende: {state}. Byt utseende',
  'language.trigger': 'Språk: {language}. Byt språk',
  'language.hint':
    'Sparas på den här enheten. När du har loggat in gäller språket som är inställt i ditt konto; du kan ändra det under Inställningar.',
  'language.announce': 'Språket ändrades till {language}',
  'language.notApplied':
    'Den här webbläsaren behöll inte ditt val. Tillåt cookies för den här webbplatsen och välj igen.',

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
  'notification.trip.copied.title': '{tripTitle} är klar',
  'notification.trip.copied.body': {
    one: 'Med följde {days} dag',
    other: 'Med följde {days} dagar',
  },
  'notification.trip.copied.places': {
    one: '{places} plats',
    other: '{places} platser',
  },
  'notification.trip.copied.dropped': {
    one: '{dropped} anteckning föll bort',
    other: '{dropped} anteckningar föll bort',
  },
  'notification.trip.copyFailed.title': '{tripTitle} kunde inte kopieras',
  'notification.trip.copyFailed.body':
    'Ingenting gick förlorat. Försök igen från originalet.',
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
  'notification.billing.invoice_paid.title': 'Betalning mottagen',
  'notification.billing.invoice_paid.body':
    'Den senaste fakturan för {organizationName} är betald.',
  'notification.billing.payment_failed.title': 'En betalning gick inte igenom',
  'notification.billing.payment_failed.body':
    '{organizationName} har en förfallen betalning. Uppdatera betalsättet för att behålla abonnemanget.',
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
  'dashboard.hero.datesMissing': 'Fyll i datum, så byggs dagarna',
  'dashboard.hero.startsIn': 'Börjar om',
  'dashboard.hero.started': 'Startade för',
  'dashboard.hero.today': 'I dag',
  'dashboard.hero.startUnknown': 'inget startdatum',
  'dashboard.hero.startToday': 'ha det bra där ute',
  'dashboard.hero.startPast': { one: 'dag sedan', other: 'dagar sedan' },
  'dashboard.hero.startFuture': { one: 'dag', other: 'dagar' },
  'dashboard.hero.nights': 'Nätter',
  'dashboard.hero.companionsHint': 'på den här resan',
  'dashboard.hero.progress': 'Pågår',
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
  /* 01-S5 — the reference column and its clock */
  'dashboard.widgets.label': 'Referens',
  'dashboard.widgets.choose': 'Välj widgetar',
  'dashboard.widgets.description':
    'De widgetar du har bredvid din instrumentpanel.',
  'dashboard.clock.label': 'Världsklocka',
  'dashboard.clock.add': 'Lägg till en tidszon',
  'dashboard.clock.search': 'Sök städer och regioner',
  'dashboard.clock.noMatches': 'Ingen tidszon med det namnet',
  'dashboard.clock.remove': 'Ta bort {zone}',
  'dashboard.clock.offset': '{offset} mot din egen tid',
  'dashboard.clock.here': 'Din egen tid',
  'dashboard.clock.empty.title': 'Inga tidszoner fästa',
  'dashboard.clock.empty.body':
    'Fäst en plats och läs dess klocka bredvid din egen.',
  'dashboard.clock.unknown.title': 'Den här enheten känner inte till {zone}',
  'dashboard.clock.unknown.body':
    'Dess tid går inte att läsa här. Ta bort raden för att lösa det.',

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
  'admin.members.role.label': 'Roll för {name}',
  'admin.members.role.saved': '{name} är nu {role}.',
  'admin.members.role.impersonated':
    'En roll kan inte ändras medan du agerar som ett annat konto.',
  'admin.members.role.notPermitted':
    'Du kan inte göra den ändringen. Bara en ägare kan ge ägarrollen eller ändra en ägare.',
  'admin.members.role.lastOwner':
    'Det här är arbetsytans enda ägare. Gör först någon annan till ägare.',
  'admin.members.role.notFound':
    'Personen finns inte längre i arbetsytan. Listan har uppdaterats.',
  'admin.members.role.failed': 'Rollen kunde inte ändras. Försök igen.',
  'admin.members.role.promote.title': 'Göra {name} till ägare?',
  'admin.members.role.promote.body':
    '{name} får samma makt som du: fakturering, medlemmar och inställningar. En ägare kan degradera eller ta bort alla andra ägare, även dig.',
  'admin.members.role.promote.confirm': 'Gör till ägare',
  'admin.members.role.promote.cancel': 'Avbryt',

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

  /* ------------------------------------------- the trips index */
  'trips.count.trips': {
    one: '{value} resa',
    other: '{value} resor',
  },
  'trips.count.favourites': {
    one: '{value} favorit',
    other: '{value} favoriter',
  },
  'trips.count.archived': {
    one: '{value} arkiverad',
    other: '{value} arkiverade',
  },
  'trips.atLimit.body':
    'Din plan täcker {trips}. Arkivera en du är klar med, eller byt upp dig för att hålla fler öppna samtidigt.',
  /* --------------------------------------- the new-trip dialog */
  /* ------------------- the journey and collection dialogs */
  'newJourney.trigger': 'Ny dagbok',
  'newJourney.title': 'Börja en dagbok',
  'newJourney.description':
    'En dagbok är resans skrivna sida — inlägg i datumordning, med bilderna och vädret du minns den för.',
  'newJourney.titlePlaceholder': 'Två veckor i Kyoto',
  'newJourney.subtitle': 'Underrubrik',
  'newJourney.subtitleHint': 'En rad under rubriken, på omslaget.',
  'newJourney.subtitlePlaceholder':
    'Tempel, tåg och alldeles för mycket matcha',
  'newJourney.trip': 'Utifrån en resa',
  'newJourney.tripHint': 'Frivilligt — knyter berättelsen till dess plan.',
  'newJourney.tripNone': 'Inte kopplad till en resa',
  'newJourney.datesError': 'Slutdatumet ligger före starten.',
  'newJourney.submit': 'Skapa dagbok',
  'newJourney.creating': 'Skapar dagboken',
  'newJourney.created': 'Dagbok påbörjad',
  'newJourney.createdBody':
    'Lägg till ditt första inlägg för att börja berättelsen.',
  'newJourney.error': 'Dagboken kunde inte skapas. Försök igen om en stund.',
  'newCollection.trigger': 'Ny samling',
  'newCollection.title': 'Börja en samling',
  'newCollection.description':
    'En plats för platserna du hittar innan du vet vilken resa de hör till.',
  'newCollection.namePlaceholder': 'Kaffe värt att gå tvärs över staden för',
  'newCollection.descriptionHint': 'Vad som hör hit och vad som inte gör det.',
  'newCollection.submit': 'Skapa samling',
  'newCollection.creating': 'Skapar samlingen',
  'newCollection.created': 'Samling skapad',
  'newCollection.createdBody': 'Börja spara platser i den.',
  'newCollection.error':
    'Samlingen kunde inte skapas. Försök igen om en stund.',

  'newTrip.title': 'Börja en ny resa',
  'newTrip.description':
    'En titel räcker. Datumen bygger dagsplanen, och resten kan vänta tills du vet.',
  'newTrip.name': 'Resans namn',
  'newTrip.namePlaceholder': 'Kyoto under körsbärsblomningen',
  'newTrip.destination': 'Resmål',
  'newTrip.destinationHint': 'En stad, en region eller hela rutten.',
  'newTrip.destinationPlaceholder': 'Kyoto, Japan',
  'newTrip.departure': 'Avresa',
  'newTrip.return': 'Hemresa',
  'newTrip.returnError': 'Hemresedatumet ligger före avresan.',
  'newTrip.currency': 'Budgetvaluta',
  'newTrip.currencyHint': 'I den summeras varje utgift på resan.',
  'newTrip.currencySearch': 'Sök på kod eller namn',
  'newTrip.currencyEmpty': 'Ingen valuta matchar.',
  'newTrip.currencyFavourites': 'Favoriter',
  'newTrip.currencyAll': 'Alla valutor',
  'newTrip.summary': 'Sammanfattning',
  'newTrip.summaryPlaceholder': 'Två veckor med tempel, tåg och ramen.',
  'newTrip.duration': 'Längd i dagar',
  'newTrip.durationHint':
    'Utan datum börjar resan med så här många odaterade dagar.',
  'newTrip.durationDerived': 'Räknas ut från de två datumen.',
  'newTrip.reminder': 'Påminnelse före avresa',
  'newTrip.reminderNone': 'Ingen',
  'newTrip.reminderBefore': {
    one: '{count} dag före',
    other: '{count} dagar före',
  },
  'newTrip.reminderCustom': 'Anpassad',
  'newTrip.reminderCustomDays': 'Dagar före avresa',
  'newTrip.reminderOn': 'Påminnelse den {date}',
  'newTrip.reminderNoDeparture': 'Välj ett avresedatum för att se dagen.',
  'newTrip.submit': 'Skapa resa',
  'newTrip.creating': 'Skapar resan',
  'newTrip.error': 'Resan kunde inte skapas. Försök igen om en stund.',
  'newTrip.created': 'Resa skapad',
  'newTrip.createdBody': 'Börja lägga ut platser på kartan.',
  'newTrip.coverChoose': 'Lägg till omslagsbild',
  'newTrip.coverChange': 'Byt omslagsbild',
  'newTrip.coverHint':
    'Släpp en bild här, klistra in en eller välj en fil. PNG, JPEG, WebP, AVIF eller GIF.',
  'newTrip.coverChosen': 'Omslagsbild: {name}',
  'newTrip.coverRemove': 'Ta bort omslagsbilden',
  'newTrip.coverTypeError':
    '”{name}” kan inte vara omslagsbild. Välj en PNG-, JPEG-, WebP-, AVIF- eller GIF-fil.',
  'newTrip.coverSizeError': '”{name}” är större än {max}. Välj en mindre bild.',
  'newTrip.coverUploading': 'Laddar upp omslagsbilden',
  'newTrip.coverFailedTitle': 'Omslagsbilden lades inte till',
  'newTrip.coverFailed':
    'Resan skapades, men ”{name}” kunde inte laddas upp som omslag.',
  'newTrip.coverRetry': 'Försök igen',
  'newTrip.coverContinue': 'Öppna resan utan omslag',
  'newTrip.people': 'Personer',
  'newTrip.peopleHint':
    'De läggs till så fort resan har skapats. Du förblir ägare.',
  'newTrip.peoplePlaceholder': 'Välj från din arbetsyta',
  'newTrip.peopleSearch': 'Sök på namn',
  'newTrip.peopleLoading': 'Läser in personerna på din arbetsyta',
  'newTrip.peopleLoadError':
    'Personerna på din arbetsyta kunde inte läsas in. Skapa resan och lägg till dem från resans vy Personer.',
  'newTrip.peopleNone':
    'Du är än så länge den enda personen på den här arbetsytan.',
  'newTrip.peopleNoneMember':
    'En ägare eller administratör av arbetsytan kan bjuda in fler personer.',
  'newTrip.peopleInvite': 'Bjud in personer till arbetsytan',
  'newTrip.peopleChosen': 'Valda personer och deras roller',
  'newTrip.peopleFailedTitle': 'Resan skapades, men alla lades inte till',
  'newTrip.noticeBothTitle': 'Resan skapades, men allt lades inte till',
  'newTrip.peopleNotInWorkspace':
    '{name} finns inte längre på den här arbetsytan och lades därför inte till.',
  'newTrip.peopleAlreadyOn': '{name} var redan med på resan.',
  'newTrip.peopleUnconfirmed':
    'Det gick inte att bekräfta {name}. Kolla under Personer om personen lades till.',
  'newTrip.peopleContinue': 'Fortsätt',

  /* ------------------------------- the trip action menu */
  'tripActions.trigger': 'Åtgärder för {title}',
  'tripActions.copy': 'Kopiera',
  'tripActions.favourite': 'Lägg till som favorit',
  'tripActions.unfavourite': 'Ta bort som favorit',
  'tripActions.edit': 'Redigera',
  'tripActions.archive': 'Arkivera',
  'tripActions.restore': 'Återställ',
  'tripActions.delete': 'Ta bort',
  'tripActions.deleteForGood': 'Ta bort permanent',
  'tripActions.starFailed': 'Favoriten sparades inte',
  'tripActions.starFallback': 'Resan är tillbaka som den var.',
  'tripActions.archived': 'Resan arkiverad',
  'tripActions.archiveFailed': 'Resan kunde inte arkiveras',
  'tripActions.restored': 'Resan återställd',
  'tripActions.restoreFailed': 'Resan kunde inte återställas',
  /* --------------------------------- the trip edit sheet */
  'editTrip.title': 'Redigera resa',
  'editTrip.submit': 'Spara ändringar',
  'editTrip.saving': 'Sparar resan',
  'editTrip.cancel': 'Avbryt',
  'editTrip.saved': 'Resan uppdaterad',
  'editTrip.errorTitle': 'Det sparades inte',
  'editTrip.retry': 'Försök igen',
  'editTrip.error': 'Resan kunde inte sparas. Försök igen om en stund.',
  'editTrip.coverFailed':
    '”{name}” kunde inte laddas upp som omslag. Inget annat har sparats ännu.',
  'editTrip.coverContinue': 'Spara utan det nya omslaget',
  'editTrip.currencyLocked':
    'Resan har redan priser, så budgetvalutan kan inte ändras här. Använd Ändra budgetvaluta på fliken Kostnader eller ställ tillbaka den på {current} för att spara dina övriga ändringar.',
  'editTrip.currencyReadonly': 'Budgetvalutan ändras på fliken Kostnader.',
  'editTrip.currencyLink': 'Öppna fliken Kostnader',
  /* ------------------------------ the delete-trip dialog */
  'deleteTrip.title': 'Ta bort ”{title}” för gott?',
  'deleteTrip.description':
    'Det finns ingen ångra och ingen papperskorg. Arkivering tar bort en resa från listan utan att förlora den.',
  'deleteTrip.reading': 'Läser vad resan innehåller',
  'deleteTrip.errorTitle': 'Det laddades inte',
  'deleteTrip.summaryError': 'Det gick inte att läsa vad resan innehåller.',
  'deleteTrip.confirmLabel': 'Skriv resans namn för att bekräfta',
  'deleteTrip.deleting': 'Tar bort resan',
  'deleteTrip.deleted': 'Resan borttagen',
  'deleteTrip.failed': 'Resan kunde inte tas bort',
  'deleteTrip.carried.reservations': {
    one: 'bokning',
    other: 'bokningar',
  },
  'deleteTrip.carried.transports': {
    one: 'resa',
    other: 'resor',
  },
  'deleteTrip.carried.expenses': {
    one: 'utgift',
    other: 'utgifter',
  },
  'deleteTrip.carried.files': {
    one: 'fil',
    other: 'filer',
  },
  'deleteTrip.carried.members': {
    one: 'person',
    other: 'personer',
  },
  'copyTrip.title': 'Kopiera ”{title}”',
  'copyTrip.nameLabel': 'Namn på kopian',
  'copyTrip.titleRequired': 'Ge kopian ett namn.',
  'copyTrip.datesLabel': 'Datum',
  'copyTrip.datesTogether': 'Ange båda datumen, eller töm båda.',
  'copyTrip.clearDates': 'Kopiera utan datum',
  'copyTrip.carries':
    'Dagar, platser och anteckningar följer med. Bokningar, pengar, filer och personer gör det inte.',
  'copyTrip.shorter':
    'Det är kortare än originalet. Platserna från de överblivna dagarna hamnar bland idéerna och deras anteckningar faller bort.',
  'copyTrip.submit': 'Kopiera resan',
  'copyTrip.copying': 'Kopierar resan',
  'copyTrip.cancel': 'Avbryt',
  'copyTrip.started': 'Kopierar ”{title}”',
  'copyTrip.errorTitle': 'Det kopierades inte',
  'copyTrip.error': 'Resan kunde inte kopieras. Försök igen om en stund.',

  'trips.error': 'Dina resor kunde inte laddas',
  'trips.eyebrow': 'Arbetsyta',
  'trips.nothingPlanned': 'Inget planerat än',
  'trips.search': 'Sök resor',
  'trips.atLimit.title': 'Du har fyllt varje resa din plan tillåter',
  'trips.atLimit.action': 'Jämför planer',
  'trips.noMatch.title': 'Inget matchar det filtret',
  'trips.noMatch.body':
    'Prova ett annat skede, töm sökningen eller titta i arkivet.',
  'trips.noMatch.action': 'Återställ filter',
  'trips.empty.body':
    'En resa håller ihop dagsplanen, kartan, bokningarna, packlistorna och pengarna. Börja en och resten följer.',
  'trips.next.title': 'Någonstans härnäst',
  'trips.next.body':
    'Börja en resa och planned.travel bygger en dag per datum, redo för allt du har sparat.',
  'trips.savedPlaces': 'Sparade platser',
  'trips.filter.all': 'Alla',
  'trips.filter.favourites': 'Favoriter',
  'trips.view.label': 'Visning',
  'trips.view.grid': 'Rutnät',
  'trips.view.list': 'Lista',
  'trips.card.favourite': 'Favorit',
  'trips.card.noDestination': 'Resmål inte satt än',
  'trips.card.noDates': 'Datum inte satta än',
  'trips.card.startsIn': 'om {days} d',
  'trips.card.days': '{days} d',
  'trips.card.copying': 'Kopieras',
  'trips.card.copyingLabel': '{title} kopieras fortfarande',
  'trips.card.copyingReason': 'Vänta tills kopian är klar.',
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
  'error.reported': 'Vi har fått en avisering och tittar på det.',
  'error.reference': 'Referens',
  'error.feedback.open': 'Berätta vad som hände',
  'error.feedback.label': 'Vad höll du på med när det hände?',
  'error.feedback.send': 'Skicka',
  'error.feedback.sent': 'Tack — det hjälper oss.',
  'error.feedback.failed':
    'Det gick inte att skicka. Referensen ovan når oss ändå.',
  'error.root': 'Något kom bort från rutten',
  'error.session': 'Din åtkomst till arbetsytan har ändrats',

  /* ------------------------------------------------- reporting a problem */
  'feedback.triggerLabel': 'Rapportera ett problem',
  'feedback.formTitle': 'Rapportera ett problem',
  'feedback.messageLabel': 'Vad är fel, eller vad borde ändras?',
  'feedback.messagePlaceholder':
    'Vad förväntade du dig, och vad hände i stället?',
  'feedback.emailLabel': 'Mejladress',
  'feedback.emailPlaceholder': 'du@example.com',
  'feedback.isRequiredLabel': '(obligatoriskt)',
  'feedback.submitButtonLabel': 'Skicka rapporten',
  'feedback.cancelButtonLabel': 'Avbryt',
  'feedback.confirmButtonLabel': 'Bekräfta',
  'feedback.addScreenshotButtonLabel': 'Lägg till en skärmbild',
  'feedback.removeScreenshotButtonLabel': 'Ta bort skärmbilden',
  'feedback.highlightToolText': 'Markera',
  'feedback.hideToolText': 'Dölj',
  'feedback.successMessageText': 'Tack — vi har din rapport.',
  'feedback.errorEmptyMessageText':
    'Skriv en mening först — en tom rapport säger oss ingenting.',
  'feedback.errorTimeoutText':
    'Det tar för lång tid, och vi kan inte bekräfta att rapporten skickades.',
  'feedback.errorForbiddenText': 'Den här sidan får inte skicka rapporter.',
  'feedback.errorGenericText':
    'Det gick inte att skicka. Kontrollera anslutningen och om en annonsblockerare är i vägen.',

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
