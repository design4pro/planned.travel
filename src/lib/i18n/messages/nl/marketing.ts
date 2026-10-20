/**
 * The public pages' copy, in nl.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typografie.** Nederlands citeert met „…”.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Gratis beginnen',
  'action.signIn': 'Inloggen',
  'action.pricing': 'Prijzen',
  'action.seePricing': 'Bekijk de prijzen',
  'action.skipToContent': 'Naar de inhoud',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — startpagina',
  'nav.onThisPage': 'Op deze pagina',
  'anchor.planner': 'Reisplanner',
  'anchor.modules': 'Onderdelen',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Neerzetten op dag {day}',
  'legal.summaryNote':
    'De samenvatting staat er om gelezen te worden. Wat hieronder staat, geldt.',
  'visual.daysTravelled': 'Reisdagen',
  'visual.acrossEveryTrip': 'over alle reizen',
  'visual.mapFilled': '{percent}% van de kaart gevuld',
  'visual.previewSummary':
    'Een voorbeeld van het planned.travel-dashboard: de volgende reis met de data, de reisgenoten en het aantal plekken; totalen voor bezochte landen, reizen en reisdagen; een kaart van de route; en de volgende twee boekingen.',
  'visual.placesMapped': {
    one: '{value} plek op de kaart',
    other: '{value} plekken op de kaart',
  },
  'visual.splitWays': {
    one: 'niet gedeeld',
    other: 'over {value} verdeeld',
  },
  'visual.tripTotal': 'Reistotaal',
  'visual.paidSplit': '{who} heeft betaald · {split}',
  'visual.nextUp': 'Straks',
  'visual.ofTotal': '{done} van {total}',
  'visual.awaitingReply': 'Wacht op antwoord',
  'visual.upcoming': 'Binnenkort',
  'visual.days': {
    one: '{value} dag',
    other: '{value} dagen',
  },
  'visual.places': {
    one: '{value} plek',
    other: '{value} plekken',
  },
  'visual.transfersLeft': {
    one: 'nog {value} overboeking',
    other: 'nog {value} overboekingen',
  },

  'legal.badge.version': 'Versie {version}',
  'legal.badge.effective': 'Geldig vanaf {updated}',
  'legal.notice.title': 'Dit is een model, geen juridisch advies',
  'legal.notice.body':
    'Het is in eenvoudig Engels geschreven om een echt bruikbaar vertrekpunt te zijn voor een kleine reisplanningsdienst, en elk gat dat een bedrijf moet vullen is aangegeven. Laat het door een gekwalificeerde jurist in jouw rechtsgebied nakijken en aanpassen voordat je één klant aanneemt. Niets hier beweert dat planned.travel een certificering, audit of nalevingsnorm heeft.',
  'legal.contents': 'Inhoud',
  'legal.shortVersion': 'De korte versie',
  'legal.both': 'Beide documenten gelden samen.',

  'landing.plans.title': 'Begin gratis. Betaal pas als het het verdient.',
  'landing.plans.lede':
    'Elk pakket bevat de dagplanner, de kaart, budgetten en paklijsten. Betaalde pakketten - vanaf {price} per maand - openen onbeperkt reizen, reserveringen, het dagboek en exports.',
  'landing.plans.ledeFree':
    'Elk pakket bevat de dagplanner, de kaart, budgetten en paklijsten. Betaalde pakketten openen onbeperkt reizen, reserveringen, het dagboek en exports.',
  'landing.plans.compare': 'Vergelijk elke limiet, regel voor regel',
  'landing.questions.title': 'Vragen, recht voor de raap beantwoord',
  'landing.questions.lede':
    'De vijf dingen die mensen echt willen weten voordat ze beginnen.',
  'cta.heading': 'Je volgende reis is het al waard om goed te plannen',
  'cta.lede':
    'Twee reizen, de hele kaart, de dagplanning en de paklijsten - gratis, zonder kaart en zonder aftelklok.',
  'landing.faq.seats.q': 'Moeten de mensen met wie ik reis ook betalen?',
  'landing.faq.seats.a':
    'Nee. Iedereen die je in een werkruimte {crew} uitnodigt, valt onder de plekken daarvan. Ze melden zich aan met hun eigen account en zien alleen de reizen waar jij ze aan toegevoegd hebt.',
  'landing.faq.phone.q': 'Werkt het goed op een telefoon?',
  'landing.faq.phone.a':
    'Ja. De mobiele indelingen zijn apart getekend in plaats van uit de desktopversies geperst, en het is een website: er is niets te installeren en niets bij te houden.',
  'landing.faq.privacy.q': 'Wie kan mijn reis zien?',
  'landing.faq.privacy.a':
    'Een reis hoort bij één werkruimte, en alleen de mensen die in die werkruimte zijn uitgenodigd kunnen hem openen. Niets is openbaar, er is geen ontdekkingsfeed, en standaard wordt er niets met iemand gedeeld.',
  'landing.faq.stop.q':
    'Wat gebeurt er met mijn reizen als ik stop met betalen?',
  'landing.faq.stop.a':
    'Er wordt niets verwijderd. De betaalde modules gaan op slot, je reizen blijven precies waar ze zijn, en alles gaat weer open op het moment dat je een abonnement neemt. {free} blijft gratis, zonder aftelklok.',

  'action.startPlanning': 'Begin gratis met plannen',
  'cta.comparePlans': 'Vergelijk de pakketten',
  'landing.hero.eyebrow': 'Samen reizen plannen',
  'landing.hero.title': 'Plan de reis.',
  'landing.hero.titleQuiet': 'Niet het spreadsheet.',
  'landing.hero.lede':
    'Één reisschema op een echte kaart, live gedeeld met iedereen die meegaat - met de boekingen, het geld en de paklijst eraan vast.',
  'landing.hero.secondary': 'Bekijk wat het kost',
  'landing.trust.noCard': 'Geen kaart om te beginnen',
  'landing.trust.noAds': 'Geen advertenties, geen affiliate links',
  'landing.trust.export': 'Exporteer alles, wanneer je wilt',

  'proof.eyebrow': 'Rechte antwoorden',
  'proof.title': 'Geen testimonials, want die hebben we nog niet verdiend',
  'proof.lede':
    'planned.travel is nieuw. In plaats van een quote te verzinnen of iemands logo te lenen, staat hier precies wat het doet, voor wie het is en wat het je nooit zal aandoen.',
  'proof.who.label': 'Voor wie het is',
  'proof.who.heading': 'Voor degene die uiteindelijk het spreadsheet maakt',
  'proof.who.body':
    'Koppels, gezinnen en vriendengroepen die één plan willen dat iedereen ziet, in plaats van zes screenshots, drie groepschats en een gedeelde notitie die niemand sinds maart heeft geopend.',
  'proof.not.label': 'Wat het niet is',
  'proof.not.heading': 'Geen boekingssite, en niet te koop aan er een',
  'proof.not.body':
    'We nemen geen commissie, dragen geen advertenties en plaatsen geen affiliate links, dus niets op een pagina stuurt je stil naar een bepaald hotel. Jij betaalt ons, dus wij werken voor jou.',
  'proof.where.label': 'Waar je spullen staan',
  'proof.where.heading': 'Op Cloudflare, in je eigen werkruimte',
  'proof.where.body':
    'Reizen staan in een database die tot je eigen werkruimte beperkt is en bestanden in onze eigen objectopslag, beide geleverd vanaf de edge van Cloudflare. Polar, onze verkoper van record, regelt de afrekening en stuurt de factuur, dus je kaartnummer bereikt ons nooit.',
  'proof.promise.ads.title': 'Geen advertenties, geen analytics van derden',
  'proof.promise.ads.body': 'Niets op deze pagina meet jou voor iemand anders.',
  'proof.promise.sold.title': 'Je reizen worden nooit verkocht of verhuurd',
  'proof.promise.sold.body':
    'Niet aan adverteerders, niet aan reisbedrijven, aan niemand.',
  'proof.promise.leave.title': 'Vertrek wanneer je wilt, met alles',
  'proof.promise.leave.body':
    'Pdf-reisschema’s, agendabestanden en je plekken als GeoJSON.',
  'proof.certification':
    'We hebben vandaag geen enkele beveiligingscertificering, en we gaan er ook geen suggereren. Wanneer planned.travel tegen een norm wordt geaudit, noemen we hier de norm, de auditor en de datum - en niet eerder.',

  'feature.modules.title': 'De rest van de reis, geregeld',
  'feature.modules.lede':
    'Elke module doet één ding goed en geeft zijn werk door aan de andere. Niets hier is een lege tab die op een toekomstige release wacht.',
  'feature.module.lists.benefit': 'Niemand komt aan zonder de adapter.',
  'feature.module.lists.detail':
    'Inpakken, to-do’s, boodschappen en documenten - één lijst per klus, gedeeld met iedereen die meegaat en afgevinkt terwijl het gebeurt.',
  'feature.module.journal.name': 'Dagboek',
  'feature.module.journal.benefit': 'De reis wordt een verhaal, geen map.',
  'feature.module.journal.detail':
    'Berichten op datum, met de foto’s die je maakte, waar je was, het weer, en hoe de dag echt voelde.',
  'feature.module.atlas.benefit': 'Eén kaart van alles waar je geweest bent.',
  'feature.module.atlas.detail':
    'Zet een land op bezocht en het komt op je wereldkaart, met het eerste bezoek, het laatste en hoe vaak je terug bent geweest.',
  'feature.module.vacay.benefit':
    'Vraag de vrije dagen aan vóór je de vlucht boekt.',
  'feature.module.vacay.detail':
    'Markeer de dagen dat je weg bent en het jaar vult zich - weekenden, feestdagen en het vrij van alle anderen in hetzelfde raster.',
  'feature.module.collab.benefit': 'De besluiten blijven bij de reis.',
  'feature.module.collab.detail':
    'Één gesprek per reis, gedeelde notities voor wat iedereen moet weten, en een poll voor als de groep het niet eens wordt over het eten.',
  'feature.module.files.benefit': 'Instapkaarten waar je ze terugvindt.',
  'feature.module.files.detail':
    'Bevestigingen, tickets, verzekeringspapieren en bonnen hangen aan de reis waar ze bij horen, niet begraven in een inbox.',

  'feature.planner.title': 'Een dagplanning, getekend op een echte kaart',
  'feature.planner.lede':
    'Verzamel de plekken die je wilt zien en sleep ze naar een dag. De kaart tekent de route onderweg opnieuw, dus je ziet meteen wanneer een ochtend je twee keer door de stad stuurt.',
  'feature.planner.point.days':
    'Eén kolom per dag, met de datum, het weer en de plek waar je slaapt.',
  'feature.planner.point.unscheduled':
    'Plekken zonder datum wachten in hun eigen kolom tot ze een dag krijgen.',
  'feature.planner.point.crew':
    'Bij {crew} sleept iedereen tegelijk: live cursors, directe synchronisatie, geen verversen.',
  'feature.planner.point.tiles':
    'Vectortegels vanaf onze eigen opslag, dus geen kaartleverancier kijkt mee terwijl je plant.',
  'feature.costs.title': 'Gedeelde kosten die echt vereffend raken',
  'feature.costs.lede':
    'Leg vast wat je uitgeeft in de valuta van de reis, verdeel elke uitgave zoals jullie het echt hebben afgesproken, en zie de kortste reeks overboekingen die alles sluit.',
  'feature.costs.point.split':
    'Gelijk verdeeld, naar aandeel of op het bedrag af - per uitgave, niet per reis.',
  'feature.costs.point.currency':
    'Alles omgerekend naar één reisvaluta, zodat het totaal iets betekent.',
  'feature.costs.point.settle':
    'Het vereffeningsoverzicht noemt wie wie betaalt, en boekt de overboeking zodra die gedaan is.',
  'feature.costs.point.receipt':
    'Hang de bon aan de uitgave, zodat het bedrag altijd zijn bewijs heeft.',
  'feature.book.title':
    'Elke boeking, met de code die je bij de deur nodig hebt',
  'feature.book.lede':
    'Overnachtingen, tafels, tours en tickets in één lijst, naast de vluchten, treinen en veerboten die je ertussen brengen: elk met het bevestigingsnummer en de dag waar het bij hoort.',
  'feature.book.point.legs':
    'Reisdelen bevatten de stoel, het perron, de terminal en de boekingscode.',
  'feature.book.point.day':
    'Een boeking hangt aan een dag en staat dus in de planning zonder dat je iets overtypt.',
  'feature.book.point.states':
    'Aangevraagd, bevestigd en geannuleerd zijn aparte toestanden, geen aantekening in een veld.',
  'feature.book.point.export':
    'Exporteer de hele reis als pdf-reisschema of agendabestand voordat je vliegt.',

  'pricing.faq.trial.q': 'Wat gebeurt er als de proefperiode eindigt?',
  'pricing.faq.trial.a':
    'De proefperiode gaat over in het betaalde abonnement. Polar legt bij de start een betaalmethode vast en schrijft af op de dag dat de proefperiode eindigt, dus zeg je eerder op, dan wordt er nooit iets afgeschreven. Er wordt in geen van beide gevallen iets verwijderd: de betaalde modules gaan op slot, je reizen blijven precies waar ze zijn, en alles gaat weer open op het moment dat je een abonnement neemt.',
  'pricing.faq.seller.q': 'Van wie koop ik eigenlijk?',
  'pricing.faq.seller.a':
    'Van Polar. Zij zijn onze verkoper van record: zij verkopen je het abonnement als onze reseller, innen de betaling, sturen de factuur op eigen naam, en bepalen, innen en dragen de omzetbelasting of btw af die jouw land heft. Terugbetalingen en kaartgeschillen lopen ook via hen. Wij runnen nog steeds de dienst en wij antwoorden op je e-mail.',
  'pricing.faq.change.q': 'Kan ik halverwege een reis van abonnement wisselen?',
  'pricing.faq.change.a':
    'Ja. Opwaarderen geldt direct en wordt per dag verrekend; afwaarderen gaat in aan het eind van de periode die je al betaald hebt, dus je verliest nooit toegang waarvoor je betaald hebt.',
  'pricing.faq.seats.q': 'Hoe werkt afrekenen per lid bij {crew}?',
  'pricing.faq.seats.a':
    'Je betaalt voor de plaatsen die je echt vult, en je kunt het aantal altijd wijzigen. Openstaande uitnodigingen tellen mee, zodat een werkruimte het abonnement nooit stil overschrijdt.',
  'pricing.faq.guests.q':
    'Hebben mijn medereizigers een eigen abonnement nodig?',
  'pricing.faq.guests.a':
    'Nee. Iedereen die je in een werkruimte {crew} uitnodigt valt onder de plekken daarvan. Ze melden zich aan met hun eigen account en zien de reizen waar ze aan toegevoegd zijn.',
  'pricing.faq.storage.q': 'Wat telt mee voor de opslag?',
  'pricing.faq.storage.a':
    'Foto’s, tickets, bevestigingen en elk bestand dat je aan een reis hangt. Kaarttegels en de app zelf tellen nooit mee. In Instellingen zie je precies wat ruimte inneemt.',
  'pricing.faq.export.q': 'Kan ik mijn gegevens meenemen?',
  'pricing.faq.export.a':
    'Altijd. Elke reis exporteert als PDF-reisplan en als agendabestand, en je plekken exporteren als GeoJSON. Het is jouw reis, niet de onze.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Geen kaart, geen termijn, geen aftellen',
  'pricing.card.yearlyPerSeat': '{amount} per jaar per lid, in één keer',
  'pricing.card.yearly': '{amount} in één keer per jaar',
  'pricing.card.seatsUnlimited': 'Onbeperkt leden',
  'pricing.card.tripsUnlimited': 'onbeperkt reizen',
  'pricing.card.startFree': 'Gratis beginnen',
  'pricing.card.startTrial': '{plan} proberen',
  'pricing.card.popular': 'Het meest gekozen',
  'pricing.card.noteYearly':
    'Eén keer per jaar afgerekend. Twee maanden van ons.',
  'pricing.card.noteMonthly':
    'Per maand afgerekend. Wissel of zeg op wanneer je wilt.',
  'pricing.card.trial': {
    one: '{value} dag gratis, kaart vooraf, afschrijving aan het eind',
    other: '{value} dagen gratis, kaart vooraf, afschrijving aan het eind',
  },
  'pricing.card.seatsUpTo': {
    one: 'Tot {value} lid',
    other: 'Tot {value} leden',
  },
  'pricing.card.trips': {
    one: '{value} reis tegelijk',
    other: '{value} reizen tegelijk',
  },

  'pricing.feature.storage': '{size} voor foto’s en documenten',
  'pricing.feature.storageShared': '{size} samen voor foto’s en documenten',
  'pricing.feature.free.tripsDetail':
    'Archiveer er een om aan de volgende te beginnen',
  'pricing.feature.solo.modules': 'Elke planningsmodule',
  'pricing.feature.solo.modulesDetail':
    'Reserveringen, dagboek, budgetten, inpakken',
  'pricing.feature.crew.membersDetail':
    'Per lid afgerekend, altijd aan te passen',
  'pricing.feature.crew.realtimeDetail':
    'Live cursors en directe synchronisatie',
  'pricing.feature.crew.supportDetail':
    'Antwoord van een mens binnen één werkdag',

  'pricing.hero.eyebrow': 'Twee reizen gratis, voor altijd',
  'pricing.hero.title': 'Plan het goed.',
  'pricing.hero.titleQuiet': 'Betaal wat je gebruikt.',
  'pricing.hero.lede':
    'Plan twee reizen gratis. Zet elke module aan voor één reiziger, of neem de hele groep mee en bewerk samen dezelfde reis.',
  'pricing.hero.taxNote':
    'Prijzen in Amerikaanse dollars, exclusief omzetbelasting of btw. Polar is onze verkoper van record: Polar staat op je factuur, bepaalt wat jouw land heft, telt het op bij het afrekenen en draagt het af. Opzeggen kan altijd, vanuit het product zelf.',
  'pricing.compare.eyebrow': 'Naast elkaar',
  'pricing.compare.title': 'Elke grens, vergeleken',
  'pricing.compare.lede':
    'Eén tabel, gemaakt uit dezelfde catalogus die de facturatie leest. Zegt een rij dat een module erbij hoort, dan is de rechtencontrole het ermee eens.',
  'pricing.compare.caption':
    'Vergelijking van functies en grenzen over alle drie abonnementen',
  'pricing.compare.feature': 'Functie',
  'pricing.compare.limits': 'Grenzen',
  'pricing.compare.included': 'Inbegrepen',
  'pricing.compare.notIncluded': 'Niet inbegrepen',
  'pricing.compare.includedIn': 'Inbegrepen in {plan}',
  'pricing.compare.notIn': 'Niet in {plan}',
  'pricing.questions.eyebrow': 'Voordat je het vraagt',
  'pricing.questions.title': 'Vragen, beantwoord',
  'pricing.questions.lede':
    'Facturatie, proefperiodes en je gegevens weer meenemen.',
  'pricing.cta.secondary': 'Kijk hoe het werkt',
  'pricing.module.itinerary': 'Dagindeling',
  'pricing.module.map': 'Interactieve kaart',
  'pricing.module.budget': 'Budgetten en kosten delen',
  'pricing.module.packing': 'Pak- en to-dolijsten',
  'pricing.module.reservations': 'Reserveringen',
  'pricing.module.journal': 'Reisdagboek',
  'pricing.module.atlas': 'Wereldkaart-tracker',
  'pricing.module.collaboration': 'Andere reizigers uitnodigen',
  'pricing.module.realtime': 'Live samenwerken',
  'pricing.module.offlineMaps': 'Offlinekaarten',
  'pricing.module.pdfExport': 'PDF- en agenda-export',
  'pricing.module.prioritySupport': 'Voorrangsondersteuning',

  'anchor.plans': 'Abonnementen',
  'anchor.compare': 'Vergelijking',
  'anchor.questions': 'Vragen',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Eén plek voor de reisroute, de kaart, de boekingen, het geld en de paklijst — gedeeld met iedereen die meegaat.',
  'footer.attribution':
    'Draait op Cloudflare Workers. Kaartgegevens © OpenStreetMap-bijdragers. Verkoop en facturatie door Polar, onze merchant of record.',
  'footer.column.product': 'Het product',
  'footer.column.account': 'Mijn account',
  'footer.link.overview': 'Overzicht',
  'footer.link.everyModule': 'Alle modules',
  'footer.link.dayPlanner': 'Dagplanner',
  'footer.link.sharedCosts': 'Gedeelde kosten',
  'footer.link.reservations': 'Boekingen',
  'footer.link.atlasJournal': 'Atlas en dagboek',
  'footer.link.createAccount': 'Account aanmaken',
  'footer.link.terms': 'Servicevoorwaarden',
  'footer.link.privacy': 'Privacyverklaring',
} satisfies TranslationOf<typeof En>

export default messages
