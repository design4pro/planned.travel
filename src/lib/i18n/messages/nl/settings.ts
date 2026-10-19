/**
 * Everything the settings module says, in Dutch.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Informal `je`/`jij`, even on the billing screen. A settings
 * page that switched to `u` for money would read as a different product.
 *
 * **Two senses of one English word.** `plan` is "abonnement" when it is
 * something a workspace pays for and "dagplan" when it is the itinerary; the
 * settings module only ever means the first. `Workspace` is "werkruimte",
 * `seat` is "plaats", `quota` is "limiet".
 *
 * **The three plan names are words, not proper nouns.** English calls them
 * Free, Solo and Crew; Dutch reads "Gratis", "Alleen" and "Samen" — the way the
 * traveller is actually travelling. What is stable across languages is the plan
 * *id* in `src/lib/plans.ts`, which the invoice and Polar carry and no reader
 * ever sees.
 *
 * **Currency names are lower case.** Dutch does not capitalise a currency, only
 * the country adjective in front of it: "Britse pond", but plain "euro".
 *
 * **Plural.** `Intl.PluralRules('nl')` reports `one` and `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  'workspace.invite.invite': 'Uitnodigen',
  'workspace.invite.resend': 'Opnieuw versturen',
  'workspace.invite.revoke': 'Intrekken',
  'workspace.invite.confirm': 'Uitnodiging intrekken',
  'workspace.invite.expired': 'Verlopen',
  'workspace.invite.by': 'Uitgenodigd door {name}',
  'workspace.invite.sent': 'Uitnodiging verstuurd',
  'workspace.invite.revoked': 'Uitnodiging ingetrokken',
  'workspace.invite.delivery':
    'Uitnodiging opgeslagen, maar de e-mail is niet verstuurd. Verstuur opnieuw.',
  'workspace.invite.duplicate':
    'Er staat al een uitnodiging open. Verstuur opnieuw.',
  'workspace.invite.existing': 'Deze persoon is al lid van de werkruimte.',
  'workspace.invite.failed':
    'Uitnodiging niet beschikbaar. Vernieuw de lijst en probeer opnieuw.',
  'workspace.invite.reload': 'Uitnodigingen vernieuwen',

  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Mijn account',
  'page.title': 'Instellingen',
  'page.description':
    'Alles over jou, je werkruimte en hoe planned.travel zich gedraagt',
  'page.error': 'De instellingen zijn niet geladen',

  'nav.label': 'Onderdelen van de instellingen',
  'nav.profile': 'Profiel',
  'nav.profile.hint': 'Jij, data, bedragen en eenheden',
  'nav.language': 'Taal',
  'nav.language.hint': 'De taal die elk scherm spreekt',
  'nav.appearance': 'Weergave',
  'nav.appearance.hint': 'Thema, beweging en de kaart',
  'nav.security': 'Beveiliging',
  'nav.security.hint': 'Wachtwoord, verificatie, sleutels',
  'nav.notifications': 'Meldingen',
  'nav.notifications.hint': 'Postvak, mail en telefoon',
  'nav.workspace': 'Werkruimte',
  'nav.workspace.hint': 'Leden en gedeelde standaarden',
  'nav.billing': 'Facturering',
  'nav.billing.hint': 'Abonnement, plaatsen en facturen',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Wijzigingen opslaan',
  'error.retryBody':
    'Er is niets verloren gegaan. Controleer je verbinding en probeer het opnieuw.',
  'role.owner': 'Eigenaar',
  'role.admin': 'Beheerder',
  'role.member': 'Lid',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Van de werkruimte — {value}',
  'regional.currency.AUD': 'Australische dollar',
  'regional.currency.CAD': 'Canadese dollar',
  'regional.currency.CHF': 'Zwitserse frank',
  'regional.currency.EUR': 'euro',
  'regional.currency.GBP': 'Brits pond',
  'regional.currency.JPY': 'Japanse yen',
  'regional.currency.PLN': 'Poolse zloty',
  'regional.currency.SEK': 'Zweedse kroon',
  'regional.currency.USD': 'Amerikaanse dollar',
  'regional.distance.metric': 'Kilometers',
  'regional.distance.imperial': 'Mijlen',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Je profiel is niet geladen',
  'profile.account.title': 'Je account',
  'profile.account.description':
    'Je naam en e-mailadres komen uit het account waarmee je inlogt.',
  'profile.email.verified': 'E-mail bevestigd',
  'profile.email.unverified': 'E-mail niet bevestigd',
  'profile.twoFactor.on': 'Tweestapsverificatie aan',
  'profile.figure.workspace': 'Werkruimte',
  'profile.figure.role': 'Rol',
  'profile.figure.joined': 'Lid sinds',
  'profile.figure.joinedUnknown': 'Niet vastgelegd',
  'profile.regional.title': 'Data, bedragen en eenheden',
  'profile.regional.description':
    'Deze gaan voor jou boven de standaarden van de werkruimte. Wat op de standaard blijft staan, volgt gewoon de werkruimte.',
  'profile.regional.saving': 'Je voorkeuren worden opgeslagen',
  'profile.regional.saved': 'Je voorkeuren zijn opgeslagen',
  'profile.regional.saveFailed': 'Je voorkeuren zijn niet opgeslagen',
  'profile.language.label': 'Taal',
  'profile.language.hint':
    'Kies je op een eigen scherm, waar elke taal in haar eigen schrift staat.',
  'profile.language.action': 'Wijzigen',
  'profile.timezone.label': 'Tijdzone',
  'profile.timezone.hint':
    'Vertrek- en aankomsttijden worden hieraan afgemeten.',
  'profile.currency.label': 'Valuta',
  'profile.currency.hint':
    'Nieuwe reizen beginnen in deze valuta; elke reis mag daarvan afwijken.',
  'profile.dateFormat.label': 'Datumnotatie',
  'profile.weekStart.label': 'Week begint op',
  'profile.weekStart.hint':
    'Geldt voor elke kalender, ook voor het vakantiejaar.',
  'profile.distance.label': 'Afstand',

  /* --------------------------------------------------------------- language */
  'language.error': 'Je taalinstellingen zijn niet geladen',
  'language.section.title': 'Taal',
  'language.section.description':
    'Elk scherm, elke knop en elke datum leest in de taal die je hier kiest — drieëntwintig stuks, elk in haar eigen schrift.',
  'language.label': 'Kies een taal',
  'language.followWorkspace': 'De werkruimte volgen',
  'language.state.yours': 'Jouw taal',
  'language.state.workspace': 'Bepaald door de werkruimte',
  'language.state.hint.override':
    'Je eigen keuze. Die geldt alleen voor jou, op elk apparaat waarop je inlogt.',
  'language.state.hint.workspace':
    'Je hebt geen eigen taal gekozen, dus je leest waar de werkruimte op staat. Een eigenaar of beheerder past dat aan onder Werkruimte.',
  'language.saved': 'planned.travel spreekt nu {language}',
  'language.saveFailed': 'Je taal is niet gewijzigd',
  'language.saveFailedBody':
    'Er is niets verloren gegaan en je leest nog steeds {language}. Controleer je verbinding en kies daarna opnieuw.',
  'language.reload.title': 'Je taal is opgeslagen',
  'language.reload.body':
    'Deze pagina kon de overgang naar {language} niet afmaken. Herlaad hem om het product in je nieuwe taal te lezen.',
  'language.sample.title': 'Zo lezen data en getallen straks',
  'language.sample.description':
    'Dezelfde drie waarden, geschreven zoals deze taal ze schrijft.',
  'language.sample.date': 'Een datum',
  'language.sample.number': 'Een getal',
  'language.sample.money': 'Een bedrag',
  'language.legal':
    'De voorwaarden en de privacyverklaring verschijnen alleen in het Engels. Al het andere in het product is vertaald.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'De weergave is niet geladen',
  'appearance.theme.title': 'Thema',
  'appearance.theme.description':
    "Beide thema's zijn ontworpen, niet omgekeerd. Neem het thema waarmee je het prettigst leest.",
  'appearance.theme.light': 'Licht',
  'appearance.theme.lightHint': 'Warm papier, de hele dag',
  'appearance.theme.dark': 'Donker',
  'appearance.theme.darkHint': 'Warme houtskool, nooit zwart',
  'appearance.theme.system': 'Systeem',
  'appearance.theme.systemHint': 'Het apparaat volgen',
  'appearance.theme.showing': 'Nu te zien: het {palette} palet.',
  'appearance.theme.showingSystem':
    'Nu te zien: het {palette} palet, in navolging van je apparaat.',
  'appearance.palette.light': 'lichte',
  'appearance.palette.dark': 'donkere',
  'appearance.motion.title': 'Beweging en kaarten',
  'appearance.motion.label': 'Beweging beperken',
  'appearance.motion.hint':
    'Brengt binnenkomende animaties terug tot een eenvoudige vervaging. De instelling van je besturingssysteem wordt sowieso altijd gevolgd.',
  'appearance.map.label': 'Kaartstijl',
  'appearance.map.hint': 'De basiskaart op de planner en de wereldkaart.',
  'appearance.map.workspace': 'De werkruimte volgen',
  'appearance.map.workspaceHint':
    'Wat de eigenaar van de werkruimte heeft gekozen.',
  'appearance.map.auto': 'Automatisch',
  'appearance.map.autoHint': 'Volgt je lichte of donkere thema.',
  'appearance.map.paper': 'Papier',
  'appearance.map.paperHint': 'Warm en licht, in welk thema je ook zit.',
  'appearance.map.charcoal': 'Houtskool',
  'appearance.map.charcoalHint': 'Warm en donker, in welk thema je ook zit.',
  'appearance.map.quiet': 'Rustig',
  'appearance.map.quietHint':
    'Zonder straatnamen, zodat je pins eerst opvallen.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Op een gedeeld scherm',
  'appearance.privacy.codesLabel':
    'Bevestigingscodes verbergen tot ik erom vraag',
  'appearance.privacy.codesHint':
    'Boekingsreferenties en bevestigingsnummers blijven verborgen op het boekingsoverzicht en bij het vervoer totdat je erop klikt of tikt, en worden weer verborgen zodra je verdergaat. Prijzen worden nooit verborgen.',
  'appearance.saveFailed': 'Die wijziging is niet bewaard',
  'appearance.saveFailedBody':
    'Hier zie je hem wel, maar op het volgende apparaat waarop je inlogt niet.',

  /* --------------------------------------------------------------- security */
  'security.error': 'De beveiliging is niet geladen',
  'security.unverified.title': 'Je e-mailadres is nog niet bevestigd',
  'security.unverified.body':
    'Nieuwe wachtwoorden en reisuitnodigingen gaan naar {email}. De bevestiging is het bewijs dat het adres van jou is.',
  'security.unverified.action': 'Stuur de link nog eens',
  'security.signin.title': 'Inloggen',
  'security.signin.description':
    'Hoe je aantoont dat jij het bent. Tweestapsverificatie en toegangssleutels zijn allebei sterker dan een wachtwoord alleen.',
  'security.email.label': 'E-mailadres',
  'security.email.verified': 'Bevestigd',
  'security.email.unverified': 'Niet bevestigd',
  'security.password.label': 'Wachtwoord',
  'security.password.hint':
    'Wijzig het wanneer je wilt — je krijgt een eenmalige link in plaats van een vraag naar het oude.',
  'security.password.action': 'Wachtwoord wijzigen',
  'security.twoFactor.label': 'Tweestapsverificatie',
  'security.twoFactor.onHint':
    'Bij elke nieuwe login wordt een code uit je verificatie-app gevraagd.',
  'security.twoFactor.offHint':
    'Zet naast je wachtwoord een code van zes cijfers uit een verificatie-app.',
  'security.twoFactor.on': 'Aan',
  'security.twoFactor.off': 'Uit',
  'security.twoFactor.manage': 'Beheren',
  'security.twoFactor.enable': 'Aanzetten',
  'security.passkeys.label': 'Toegangssleutels',
  'security.passkeys.hint':
    'Log in met je vingerafdruk, gezichtsherkenning of een beveiligingssleutel in plaats van iets te typen.',
  'security.passkeys.action': 'Toegangssleutels beheren',
  'security.session.title': 'Deze sessie',
  'security.session.description': 'De browser waarin je dit nu leest.',
  'security.session.label': 'Ingelogd als',
  'security.session.expires': 'Verloopt {date}',
  'security.session.expiresSoon': 'binnenkort',
  'security.session.noExpiry': 'Geen vervaldatum vastgelegd',
  'security.signOut.label': 'Uitloggen',
  'security.signOut.hint':
    'Beëindigt deze sessie en brengt je terug naar de inlogpagina. Andere apparaten blijven ingelogd.',
  'security.signOut.pending': 'Je wordt uitgelogd',
  'security.signOut.failed': 'Je bent niet uitgelogd',
  'security.signOut.failedBody':
    'Controleer je verbinding en probeer het opnieuw.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'De instellingen voor meldingen zijn niet geladen',
  'notifications.title': 'Meldingen',
  'notifications.description':
    'Elke schakelaar geldt alleen voor jou. Er een uitzetten voorkomt nooit de gebeurtenis zelf — alleen dat wij het je vertellen.',
  'notifications.caption': 'Welke meldingen welk kanaal bereiken',
  'notifications.event': 'Gebeurtenis',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Die voorkeur is niet opgeslagen',
  'notifications.saveFailedBody':
    'De schakelaar staat weer zoals hij stond. Controleer je verbinding en probeer het opnieuw.',
  'notifications.channel.in_app': 'In de app',
  'notifications.channel.in_app.hint': 'De bel in de bovenbalk',
  'notifications.channel.email': 'E-mail',
  'notifications.channel.email.hint': 'Naar het adres waarmee je inlogt',
  'notifications.channel.push': 'Mobiel',
  'notifications.channel.push.hint': 'Op apparaten waar je het hebt toegestaan',
  'notifications.event.trip.invited': 'Reisuitnodigingen',
  'notifications.event.trip.invited.hint':
    'Iemand zet je op een reis die hij aan het plannen is.',
  'notifications.event.trip.updated': 'Wijzigingen in het plan',
  'notifications.event.trip.updated.hint':
    'Een dag, een stop of een datum verschuift op een reis waar jij op staat.',
  'notifications.event.trip.starting_soon': 'Herinneringen voor vertrek',
  'notifications.event.trip.starting_soon.hint':
    'Een seintje in de dagen voordat een reis begint.',
  'notifications.event.reservation.reminder': 'Herinneringen voor boekingen',
  'notifications.event.reservation.reminder.hint':
    'Een overnachting, een tafel of een ticket komt eraan.',
  'notifications.event.expense.added': 'Nieuwe uitgaven',
  'notifications.event.expense.added.hint':
    'Iemand noteert geld dat op een gedeelde reis is uitgegeven.',
  'notifications.event.expense.settled': 'Vereffende bedragen',
  'notifications.event.expense.settled.hint':
    'Een bedrag waar jij deel van uitmaakte is betaald.',
  'notifications.event.list.assigned': 'Toegewezen taken',
  'notifications.event.list.assigned.hint':
    'Iets op een paklijst of takenlijst wordt van jou.',
  'notifications.event.collab.message': 'Gesprek over de reis',
  'notifications.event.collab.message.hint':
    'Nieuwe berichten op een reis waar jij op meegaat.',
  'notifications.event.organization.invited': 'Uitnodigingen voor werkruimtes',
  'notifications.event.organization.invited.hint':
    'Je wordt uitgenodigd voor een werkruimte.',

  'notifications.event.billing.plan_changed': 'Abonnementswijzigingen',
  'notifications.event.billing.plan_changed.hint':
    'Je werkruimte stapt over naar een ander abonnement.',
  'notifications.event.billing.invoice_paid': 'Betaalbewijzen',
  'notifications.event.billing.invoice_paid.hint':
    'Een factuur van je werkruimte is betaald.',
  'notifications.event.billing.payment_failed': 'Betaalproblemen',
  'notifications.event.billing.payment_failed.hint':
    'Een afschrijving voor je werkruimte is mislukt.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'De werkruimte is niet geladen',
  'workspace.summary.description': 'Abonnement {plan} · aangemaakt {date}',
  'workspace.summary.createdRecently': 'kortgeleden',
  'workspace.summary.billingAction': 'Abonnement en facturen',
  'workspace.seats.label': 'Bezette plaatsen',
  'workspace.seats.value': '{used} van {limit}',
  'workspace.seats.note':
    'Openstaande uitnodigingen tellen mee voor jullie plaatsen, zodat een werkruimte nooit meer bezet dan het abonnement betaalt.',
  'workspace.seatsFull.title': 'Elke plaats in dit abonnement is bezet',
  'workspace.seatsFull.body':
    '{members} en {invitations} vullen alle {limit} plaatsen.',
  'workspace.seatsFull.action': 'Plaatsen bijkopen',
  'workspace.members.count': {
    one: '{value} lid',
    other: '{value} leden',
  },
  'workspace.invitations.count': {
    one: '{value} openstaande uitnodiging',
    other: '{value} openstaande uitnodigingen',
  },
  'workspace.members.title': 'Leden',
  'workspace.members.description':
    'Iedereen die de reizen, het geld en de bestanden in deze werkruimte ziet.',
  'workspace.members.tableLabel': 'Leden van deze werkruimte',
  'workspace.members.person': 'Persoon',
  'workspace.members.role': 'Rol',
  'workspace.members.joined': 'Lid sinds',
  'workspace.invitations.title': 'Uitnodigingen',
  'workspace.invitations.description':
    'Mensen die zijn uitgenodigd maar er nog niet bij zijn.',
  'workspace.invitations.emptyTitle': 'Geen openstaande uitnodigingen',
  'workspace.invitations.emptyBody':
    'Iedereen die voor deze werkruimte is uitgenodigd, doet al mee.',
  'workspace.invitations.expires': 'Verloopt {date}',
  'workspace.invitations.expiresSoon': 'binnenkort',
  'workspace.defaults.title': 'Gedeelde standaarden',
  'workspace.defaults.description':
    'Waarmee een nieuwe reis en een nieuw lid beginnen. Iedereen mag dit voor zichzelf aanpassen in het profiel.',
  'workspace.defaults.readOnly': 'Alleen lezen',
  'workspace.defaults.saving': 'De standaarden worden opgeslagen',
  'workspace.defaults.saved':
    'De standaarden van de werkruimte zijn opgeslagen',
  'workspace.defaults.saveFailed': 'De standaarden zijn niet opgeslagen',
  'workspace.defaults.saveFailedBody':
    'Alleen een eigenaar of beheerder mag ze wijzigen. Controleer je verbinding en probeer het daarna opnieuw.',
  'workspace.currency.label': 'Standaardvaluta',
  'workspace.currency.hint': 'Hierin worden nieuwe reizen begroot.',
  'workspace.language.label': 'Taal',
  'workspace.language.hint':
    'Wat een lid leest dat zelf geen taal heeft gekozen.',
  'workspace.timezone.label': 'Tijdzone',
  'workspace.dateFormat.label': 'Datumnotatie',
  'workspace.weekStart.label': 'Week begint op',
  'workspace.distance.label': 'Afstand',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'De facturering is niet geladen',
  'billing.loading': 'Het abonnement en de bonnen worden geladen',
  'billing.status.none': 'Geen abonnement',
  'billing.status.trialing': 'Proefperiode',
  'billing.status.active': 'Actief',
  'billing.status.past_due': 'Betaling mislukt',
  'billing.status.unpaid': 'Onbetaald',
  'billing.status.paused': 'Gepauzeerd',
  'billing.status.canceled': 'Opgezegd',
  'billing.status.incomplete': 'Onvolledig',
  'billing.status.incomplete_expired': 'Verlopen',

  'billing.checkout.completeTitle': 'Betaling ontvangen',
  'billing.checkout.completeBody':
    'Je nieuwe abonnement wordt toegepast. Het verschijnt hier zodra Polar het bevestigt — meestal binnen een paar seconden.',
  'billing.checkout.cancelledTitle': 'Afrekenen afgebroken',
  'billing.checkout.cancelledBody':
    'Er is niets afgeschreven en je abonnement is niet veranderd.',
  'billing.portal.backTitle': 'Terug van Polar',
  'billing.portal.backBody':
    'Wat je daar hebt gewijzigd komt hier binnen zodra Polar het bevestigt.',
  'billing.refresh': 'Vernieuwen',
  'billing.readOnly.title': 'Je bent lid van deze werkruimte',
  'billing.readOnly.body':
    'Alleen een eigenaar of beheerder kan het abonnement wijzigen. Alles hieronder kun je alleen lezen.',

  'billing.hero.label': 'Huidig abonnement',
  'billing.hero.endsAtPeriod': 'Stopt aan het einde van de periode',
  'billing.hero.perYear': '/ jaar',
  'billing.hero.perMonth': '/ maand',
  'billing.hero.freeAllowance': '{trips} reizen, één reiziger',
  'billing.hero.perSeatLine': '{seats} leden × {price}',
  'billing.hero.singleTraveller': 'Eén reiziger',
  'billing.price.free': 'Gratis',
  'billing.provider.opening': 'Polar wordt geopend',
  'billing.renewal.trialEndsToday':
    'Je proefperiode eindigt vandaag. De eerste afschrijving volgt, tenzij je eerder opzegt.',
  'billing.renewal.trialEndsIn': {
    one: 'Je proefperiode eindigt over {value} dag, daarna volgt de eerste afschrijving, tenzij je eerder opzegt.',
    other:
      'Je proefperiode eindigt over {value} dagen, daarna volgt de eerste afschrijving, tenzij je eerder opzegt.',
  },
  'billing.renewal.trialEnded': 'Je proefperiode is voorbij.',
  'billing.renewal.endsNoDate':
    'Dit abonnement staat op stoppen en wordt niet verlengd.',
  'billing.renewal.endsOn':
    'Dit abonnement stopt op {date}. Er wordt niets verwijderd — de betaalde modules gaan simpelweg op slot.',
  'billing.renewal.pastDue':
    'De laatste betaling ging niet door. Werk je kaart bij om de betaalde modules te houden.',
  'billing.renewal.unpaid':
    'Dit abonnement is onbetaald en de betaalde modules zitten op slot.',
  'billing.renewal.paused':
    'Dit abonnement is gepauzeerd. Hervat het wanneer je weer op pad gaat.',
  'billing.renewal.lapsed':
    'Kies hieronder een abonnement om boekingen, het dagboek en offline kaarten weer te openen.',
  'billing.renewal.incomplete':
    'Polar wacht nog op de bevestiging van deze betaling.',
  'billing.renewal.free':
    'Twee reizen tegelijk, van het huis. Stap over zodra je het te krap vindt.',
  'billing.renewal.auto': 'Wordt automatisch verlengd.',
  'billing.renewal.renewsOn': 'Wordt verlengd op {date}.',

  'billing.usage.title': 'Gebruik',
  'billing.usage.description':
    'Live geteld, zodat geen meter veroudert. De grenzen volgen het abonnement dat nu geldt.',
  'billing.quota.seats': 'Leden',
  'billing.quota.trips': 'Reizen',
  'billing.quota.storageBytes': 'Opslag',
  'billing.quota.unlimited': 'Onbeperkt',
  'billing.quota.places': 'Plaatsen',
  'billing.quota.placesHint': 'In alle reizen in deze werkruimte',
  'billing.quota.exhausted.places': 'Het quotum voor plaatsen is opgebruikt',
  'billing.quota.over.places': 'Limiet voor plaatsen met {value} overschreden',
  'billing.quota.noLimit': 'Geen grens in dit abonnement',
  'billing.quota.used': '{quota} gebruikt',
  'billing.quota.over.seats': {
    one: '{value} plaats boven de grens van dit abonnement',
    other: '{value} plaatsen boven de grens van dit abonnement',
  },
  'billing.quota.over.trips': {
    one: '{value} reisplek boven de grens van dit abonnement',
    other: '{value} reisplekken boven de grens van dit abonnement',
  },
  'billing.quota.over.storage': '{value} boven de grens van dit abonnement',
  'billing.quota.exhausted.seats': 'Elke plaats in dit abonnement is bezet',
  'billing.quota.exhausted.trips':
    'Elke reisplek in dit abonnement is in gebruik',
  'billing.quota.exhausted.storage': 'De opslag in dit abonnement is vol',
  'billing.quota.left': 'nog {value}',

  'billing.plans.title': 'Abonnementen',
  'billing.plans.description':
    'Stap over wanneer je wilt. Omhoog rekenen we per dag af; omlaag wacht tot de periode die je betaald hebt voorbij is.',
  'billing.interval.label': 'Facturatieritme',
  'billing.interval.monthly': 'Maandelijks',
  'billing.interval.yearly': 'Jaarlijks',
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Plan je volgende twee reizen',
  'billing.plan.free.feature.trips':
    'Twee reizen tegelijk en maximaal 150 plaatsen',
  'billing.plan.free.feature.itinerary': 'Dagplan en kaart, dag voor dag',
  'billing.plan.free.feature.lists': 'Paklijsten en eenvoudige budgetten',
  'billing.plan.free.feature.atlas':
    'De wereldkaart die bijhoudt waar je bent geweest',
  'billing.plan.solo.name': 'Alleen',
  'billing.plan.solo.tagline': 'Voor de reiziger die alles zelf uitzoekt',
  'billing.plan.solo.feature.trips': 'Onbeperkt reizen en plaatsen',
  'billing.plan.solo.feature.modules':
    'Alle planningsmodules — boekingen, dagboek, budgetten, paklijsten',
  'billing.plan.solo.feature.offline':
    'Offline kaarten die je voor vertrek downloadt',
  'billing.plan.solo.feature.export': 'Export naar pdf en agenda',
  'billing.plan.crew.name': 'Samen',
  'billing.plan.crew.tagline': 'Voor gezinnen, vriendengroepen en kleine teams',
  'billing.plan.crew.feature.members': 'Tot tien leden, per persoon afgerekend',
  'billing.plan.crew.feature.realtime':
    'Samenwerken in realtime, iedere hand zichtbaar op de kaart',
  'billing.plan.crew.feature.everything':
    'Onbeperkt reizen en plaatsen en alle modules',
  'billing.plan.crew.feature.storage':
    "Gedeelde ruimte voor ieders foto's en documenten",

  'billing.plan.current': 'Huidig abonnement',
  'billing.plan.currentBadge': 'Huidig',
  'billing.plan.popular': 'Populair',
  'billing.plan.switchYearly': 'Overstappen op jaarlijks',
  'billing.plan.switchMonthly': 'Overstappen op maandelijks',
  'billing.plan.upgradeTo': 'Opwaarderen naar {plan}',
  'billing.plan.changeTo': 'Wisselen naar {plan}',
  'billing.plan.perMemberMonth': '/ lid / maand',
  'billing.plan.perMonth': '/ maand',
  'billing.plan.alwaysFree': 'Altijd gratis, zonder kaart',
  'billing.plan.billedYearly': '{amount} per jaar gefactureerd',
  'billing.plan.billedMonthly': '{amount} per maand gefactureerd',
  'billing.plan.members': 'Leden',
  'billing.plan.membersHint':
    'Op elk moment aan te passen — de facturering volgt.',
  'billing.plan.seatOption': {
    one: '{value} lid',
    other: '{value} leden',
  },

  'billing.invoices.number': 'Factuur',
  'billing.invoices.date': 'Datum',
  'billing.invoices.amount': 'Bedrag',
  'billing.invoices.status': 'Betaalstatus',
  'billing.invoice.paid': 'Betaald',
  'billing.invoice.draft': 'Concept',
  'billing.invoice.void': 'Vervallen',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'De betaalprovider heeft dat verzoek geweigerd. Probeer het straks opnieuw.',
  'billing.failure.reference': 'Referentie voor de ondersteuning: {reference}',
  'billing.failure.forbidden':
    'Je rol staat dit niet toe voor de facturering van deze werkruimte. Vraag het een eigenaar of beheerder.',
  'billing.failure.providerRefused':
    'Polar heeft die wijziging niet geaccepteerd. Vergelijk het aantal plekken met je leden en probeer het opnieuw, of gebruik het factureringsportaal.',
  'billing.failure.rateLimited':
    'Polar is op dit moment druk. Er is niets gewijzigd. Probeer het over een minuut opnieuw.',
  'billing.failure.notConnected':
    'Facturering is op deze implementatie nog niet gekoppeld, dus er is niets gewijzigd. Neem contact op met de ondersteuning.',
  'billing.failure.orderNotInvoiceable':
    'Polar kan voor deze bestelling geen factuur uitgeven. Ontbreken de factuurnaam of het factuuradres, voeg ze dan toe in het factureringsportaal en probeer het opnieuw; neem anders contact op met de ondersteuning.',
  'billing.planChanged.title': 'Abonnement bijgewerkt',
  'billing.planChanged.body':
    'De wijziging geldt al bij Polar, dat het verschil factureert. Het overzicht hieronder loopt binnen een minuut bij.',
  'billing.discount.toggle': 'Heb je een promotiecode?',
  'billing.discount.label': 'Promotiecode',
  'billing.discount.hint': 'Geldt voor het abonnement dat je hierna kiest.',
  'billing.discount.hintCurrent':
    'Pas hem toe op je huidige abonnement of kies hieronder een abonnement.',
  'billing.discount.applyCurrent': 'Toepassen op huidig abonnement',
  'billing.discount.applying': 'Code toepassen…',
  'billing.discount.invalidFormat':
    'Codes bestaan uit 3 tot 64 letters en cijfers.',
  'billing.discount.rejected.invalid':
    'Die code is ongeldig. Controleer hem en probeer het opnieuw.',
  'billing.discount.rejected.rateLimited':
    'Te veel codes geprobeerd. Probeer het over een uur opnieuw.',
  'billing.discount.rejected.notApplicable':
    'Die code geldt niet voor dit abonnement.',
  'billing.discount.rejected.busy':
    'Codes kunnen nu niet worden gecontroleerd. Probeer het over een minuut opnieuw.',
  'billing.discount.nextRenewal':
    'Je promotiecode geldt vanaf je volgende verlenging.',
  'billing.discount.appliedTitle': 'Promotiecode toegepast',
  'billing.hero.manage': 'Facturatie beheren',
  'billing.hero.manageHint':
    'Kaarten, factuuradres, btw-nummer, bonnen en opzegging staan bij Polar, dat de factuur uitgeeft.',
  'billing.hero.manageHintNone':
    'Er is nog geen facturatieprofiel. Een betaald abonnement hieronder maakt er een, en daarna opent het portaal.',
  'billing.portal.opening': 'Facturatieportaal wordt geopend',
  'billing.plan.notApplied': 'Die wijziging is niet doorgevoerd',
  'billing.plan.cancelInPortal': 'Opzeggen in het portaal',
  'billing.plan.seatsOverMax': {
    one: 'Deze werkruimte heeft {members} leden en {plan} rekent maximaal {max} af. Verwijder {value} lid voordat je wisselt.',
    other:
      'Deze werkruimte heeft {members} leden en {plan} rekent maximaal {max} af. Verwijder {value} leden voordat je wisselt.',
  },
  'billing.plan.seatsBelowMembers':
    'Je hebt {members} leden. Kies minstens zoveel plaatsen — Polar weigert een abonnement met minder plaatsen dan toewijzingen.',
  'billing.orders.title': 'Bestellingen',
  'billing.orders.description':
    'Elke bestelling van deze werkruimte, nieuwste eerst.',
  'billing.orders.receipts': 'Alle bonnen',
  'billing.orders.unavailableTitle': 'Bestellingen laden niet',
  'billing.orders.unavailableBody':
    'Polar antwoordde niet op tijd voor de historie. Alles hierboven is actueel — probeer het straks opnieuw of lees het volledige overzicht in het facturatieportaal.',
  'billing.orders.emptyTitle': 'Nog geen bestellingen',
  'billing.orders.emptyCustomer':
    'De eerste factuur verschijnt hier zodra een factuurperiode sluit.',
  'billing.orders.emptyNoCustomer':
    'Deze werkruimte is nooit belast. Kies een betaald abonnement en de facturen verzamelen zich hier.',
  'billing.orders.tableLabel': 'Bestelgeschiedenis',
  'billing.orders.document': 'Document',
  'billing.orders.dateUnknown': 'Datum onbekend',
  'billing.order.pending': 'In afwachting',
  'billing.order.refunded': 'Terugbetaald',
  'billing.order.partiallyRefunded': 'Deels terugbetaald',
  'billing.order.noInvoiceDraft':
    'Geen factuur zolang de bestelling een concept is',
  'billing.order.preparing': 'Wordt voorbereid',
  'billing.order.renderingHint':
    'Polar maakt factuur {number} nog. De download komt over een paar seconden terug.',
  'billing.order.fetching': 'Factuur ophalen',
  'billing.order.generating': 'Polar bereidt de factuur voor',
  'billing.order.pdfLabel': 'Factuur {number} als PDF',
  'billing.order.stillWritingTitle': 'Polar schrijft die factuur nog',
  'billing.order.stillWritingBody':
    'Factuur {number} wordt gemaakt. De download komt over een paar seconden van zelf terug.',
  'billing.order.openFailed': 'Die factuur ging niet open',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Mijn account',
  'passkeys.page.title': 'Toegangssleutels',
  'passkeys.page.description':
    'Met een toegangssleutel log je in met je vingerafdruk, gezichtsherkenning of een beveiligingssleutel in plaats van iets te typen.',
  'passkeys.page.back': 'Terug naar beveiliging',
  'passkeys.list.label': 'Je toegangssleutels',
  'passkeys.add.action': 'Toegangssleutel toevoegen',
  'passkeys.add.loading': 'Wachten op je apparaat',
  'passkeys.add.added': 'Toegangssleutel toegevoegd',
  'passkeys.add.dismissed': 'Er is geen toegangssleutel toegevoegd',
  'passkeys.add.exists':
    'Dit apparaat heeft al een toegangssleutel voor je account',
  'passkeys.add.failed':
    'De toegangssleutel is niet toegevoegd. Probeer het opnieuw.',
  'passkeys.add.stale': 'Voor je veiligheid: log opnieuw in om door te gaan.',
  'passkeys.error.sessionEnded':
    'Je sessie is beëindigd. Log opnieuw in om door te gaan.',
  'passkeys.signInAgain': 'Opnieuw inloggen',
  'passkeys.add.limit':
    'Je hebt de limiet van {value} toegangssleutels bereikt. Verwijder er een om een andere toe te voegen.',
  'passkeys.add.unsupported':
    'Deze browser kan geen toegangssleutels maken. Probeer een andere browser of een ander apparaat.',
  'passkeys.empty.title': 'Nog geen toegangssleutels',
  'passkeys.empty.body':
    'Voeg er een toe en log in met je vingerafdruk, gezichtsherkenning of een beveiligingssleutel in plaats van iets te typen.',
  'passkeys.row.fallbackName': 'Toegangssleutel · toegevoegd op {date}',
  'passkeys.row.added': 'Toegevoegd op {date}',
  'passkeys.row.lastUsed': 'Laatst gebruikt op {date}',
  'passkeys.row.neverUsed': 'Nog niet gebruikt om in te loggen',
  'passkeys.badge.synced': 'Gesynchroniseerd',
  'passkeys.badge.singleDevice': 'Alleen op één apparaat',
  'passkeys.error.title': 'Je toegangssleutels zijn niet geladen',
  'passkeys.error.retry': 'Opnieuw proberen',
  'passkeys.error.rateLimited':
    'Te veel pogingen. Probeer het over een paar minuten opnieuw.',
  'passkeys.error.generic': 'Controleer je verbinding en probeer het opnieuw.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': '{name} hernoemen',
  'passkeys.rename.fieldLabel': 'Geef deze toegangssleutel een naam',
  'passkeys.rename.placeholder': 'Geef hem een naam, zoals Werktelefoon',
  'passkeys.rename.saving': 'Naam wordt opgeslagen',
  'passkeys.rename.saved': 'Naam opgeslagen',
  'passkeys.rename.failed': 'De naam is niet opgeslagen',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': '{name} verwijderen',
  'passkeys.delete.title': 'Deze toegangssleutel verwijderen?',
  'passkeys.delete.body': 'Je kunt dan niet meer inloggen met {name}.',
  'passkeys.delete.password': 'Wachtwoord',
  'passkeys.delete.passwordHint': 'Voer ter bevestiging je wachtwoord in.',
  'passkeys.delete.confirmOnly':
    'Je account heeft geen wachtwoord. Bevestig dat je deze toegangssleutel wilt verwijderen.',
  'passkeys.delete.confirm': 'Toegangssleutel verwijderen',
  'passkeys.delete.cancel': 'Annuleren',
  'passkeys.delete.wrongPassword': 'Dat wachtwoord klopt niet.',
  'passkeys.delete.stale':
    'Voor je veiligheid: log opnieuw in voordat je een toegangssleutel verwijdert.',
  'passkeys.delete.removed': 'Toegangssleutel verwijderd',
  'passkeys.delete.failed':
    'De toegangssleutel is niet verwijderd. Probeer het opnieuw.',
  'passkeys.delete.removing': 'Toegangssleutel wordt verwijderd',
  'passkeys.delete.passwordRequired':
    'Voer je wachtwoord in om deze toegangssleutel te verwijderen.',
  'workspace.departure.leave': 'Werkruimte verlaten',
  'workspace.departure.remove': 'Lid verwijderen',
  'workspace.departure.title': 'Lidmaatschap van {workspace} beëindigen?',
  'workspace.departure.body':
    '{name} verliest toegang tot {workspace}. Het account en de bewaarde reizen en kostenregistraties blijven bestaan.',
  'workspace.departure.cancel': 'Annuleren',
  'workspace.departure.pending': 'Lidmaatschap beëindigen…',
  'workspace.departure.lastOwner':
    'Maak een ander lid eigenaar voordat je vertrekt of deze eigenaar verwijdert.',
  'workspace.departure.notPermitted':
    'Je huidige rol staat niet toe dit lid te verwijderen. Vernieuw de ledenlijst voordat je het opnieuw probeert.',
  'workspace.departure.notFound':
    'Deze persoon is geen lid meer van deze werkruimte.',
  'workspace.departure.impersonated':
    'Stop met het overnemen van een identiteit voordat je het werkruimtelidmaatschap wijzigt.',
  'workspace.departure.failed':
    'Het resultaat kon niet worden bevestigd. Laad de werkruimte opnieuw voordat je het opnieuw probeert.',
  'workspace.departure.removed': 'Lid verwijderd',
  'workspace.departure.reload': 'Werkruimte opnieuw laden',
  'workspace.departure.activationFailed':
    'Je hebt deze werkruimte verlaten. Open de volgende om verder te gaan.',
  'workspace.departure.recover': 'Volgende werkruimte openen',
} satisfies TranslationOf<typeof En>

export default messages
