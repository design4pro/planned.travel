/**
 * The trip tabs' own copy, in nl.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Meervoud.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  'notFound.title': 'We kunnen deze reis niet vinden',
  'notFound.body':
    'Deze staat niet tussen de reizen die je in de huidige werkruimte kunt openen. De reis is mogelijk verwijderd of je hebt er geen toegang toe.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Een plek aan deze reis toevoegen',
  'plan.editor.editTitle': 'Deze plek bewerken',
  'plan.editor.createDescription':
    'Geef de plek nu een naam en later een positie - ongeplande plekken wachten in het plekkenpaneel tot je ze aan een dag toevoegt.',
  'plan.editor.editDescription':
    'Wijzigingen gelden overal: op de kaart, op elke toegewezen dag en in de plekkenlijst van de reis.',
  'plan.editor.nameRequired': 'Een plek heeft een naam nodig',
  'plan.editor.nameExample': 'bijv. Fushimi Inari Taisha',
  'plan.editor.city': 'Stad',
  'plan.editor.cityExample': 'bijv. Kyoto',
  'plan.editor.addressExample': 'bijv. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Tijd ter plaatse',
  'plan.editor.rating': 'De moeite waard?',
  'plan.editor.latitude': 'Breedtegraad',
  'plan.editor.longitude': 'Lengtegraad',
  'plan.editor.positionHint': 'Of sluit dit en kies de plek op de kaart.',
  'plan.editor.latitudeError': 'Tussen -90 en 90',
  'plan.editor.longitudeError': 'Tussen -180 en 180',
  'plan.editor.positionError': 'Een positie heeft beide getallen nodig',
  'plan.editor.day': 'Aan een dag toevoegen',
  'plan.editor.dayHint': 'Laat leeg om de plek in het plekkenpaneel te houden.',
  'plan.editor.unplanned': 'Ongepland laten',
  'plan.editor.dayNamed': 'Dag {day} · {title}',
  'plan.editor.stopFallback': 'Deze stop',
  'plan.editor.dayNumber': 'Dag {day}',
  'plan.editor.visited': 'Al bezocht',
  'plan.editor.visitedHint': 'Markeert de pin met een vinkje.',
  'plan.editor.saving': 'Plek opslaan',
  'plan.editor.save': 'Wijzigingen opslaan',
  'plan.editor.noCategory': 'Geen categorie',
  'plan.editor.arrive': 'Aankomst',
  'plan.editor.leave': 'Vertrek',
  'plan.editor.timeError': 'Vertrek moet later zijn dan aankomst',
  'plan.editor.booking': 'Reservering',
  'plan.editor.note': 'Notitie voor deze stop',
  'plan.editor.noteExample': 'Ga vroeg - na 9 uur sta je een uur in de rij.',
  'plan.editor.savingTimes': 'Tijden opslaan',
  'plan.editor.saveTimes': 'Opslaan',
  'plan.editor.duration0': 'Geen vaste duur',
  'plan.editor.duration30': '30 minuten',
  'plan.editor.duration45': '45 minuten',
  'plan.editor.duration60': '1 uur',
  'plan.editor.duration90': '1½ uur',
  'plan.editor.duration120': '2 uur',
  'plan.editor.duration180': '3 uur',
  'plan.editor.duration240': 'Een halve dag',
  'plan.editor.duration480': 'Een hele dag',
  'plan.editor.rating0': 'Niet beoordeeld',
  'plan.editor.rating1': '★ 1 - overslaan',
  'plan.editor.rating2': '★ 2 - als er tijd is',
  'plan.editor.rating3': '★ 3 - de moeite waard',
  'plan.editor.rating4': '★ 4 - erg goed',
  'plan.editor.rating5': '★ 5 - niet missen',
  'plan.editor.bookingNone': 'Geen reservering nodig',
  'plan.editor.bookingPending': 'Nog te boeken',
  'plan.editor.bookingConfirmed': 'Geboekt en bevestigd',
  'plan.editor.bookingCompleted': 'Bezoek voltooid',
  'plan.editor.bookingCancelled': 'Geannuleerd',
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Deze reis kon niet worden geladen',
  'error.plan': 'De reisroute kon niet worden geladen',
  'error.costs': 'De kosten konden niet worden geladen',
  'error.collab': 'Het gesprek kon niet worden geladen',
  'error.book': 'De boekingen konden niet worden geladen',
  'error.transports': 'De trajecten zijn niet geladen',
  'error.people': 'De personen konden niet worden geladen',
  'header.length': {
    one: '{days} dag',
    other: '{days} dagen',
  },
  'header.planned': {
    one: '{days} dag gepland',
    other: '{days} dagen gepland',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reisroute',
  'plan.places': 'Plekken',
  'plan.readOnly.archived':
    'Deze reis is gearchiveerd, dus het plan is alleen-lezen.',
  'plan.readOnly.role':
    'Je kunt dit plan lezen. Alleen de eigenaar van de reis en bewerkers kunnen het wijzigen.',
  'plan.day.empty':
    'Nog niets gepland — sleep hier een plek of een notitie naartoe',
  'plan.move.refused.duplicate': '{name} staat al op die dag',
  'plan.move.refused.duplicateBody':
    'Een plek kan maar één keer per dag voorkomen. Verplaats hem naar een andere dag.',
  'plan.move.refused.notInIdeas': 'Een notitie blijft in de dag',
  'plan.move.refused.notInIdeasBody':
    'Ideeën zijn plekken die op een dag wachten. Een notitie hoort altijd bij een dag.',
  'plan.move.refused.journeyNotInIdeas': 'Een traject blijft in de dag',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ideeën zijn plekken die op een dag wachten. Een traject hoort bij de dag waarop het plaatsvindt.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Een traject blijft op zijn eigen dag',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'De dag van een traject komt uit zijn datums. Pas ze aan op het tabblad Trajecten.',
  'plan.move.refused.journeyTimed': '{name} vertrekt om {time}',
  'plan.move.refused.journeyTimedBody':
    'Een vertrektijd hoort bij de dienstregeling, niet bij het plan. Zet het traject waar zijn klok het neerzet.',
  'plan.move.spoken.duplicate':
    '{name} is niet verplaatst. Die dag heeft hem al.',
  'plan.move.spoken.notInIdeas':
    '{name} is niet verplaatst. Een notitie blijft in de dag.',
  'plan.move.spoken.timed':
    '{name} heeft {time}. We vragen of die tijd mag vervallen.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} is niet verplaatst. Een traject blijft in de dag.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} is niet verplaatst. Een traject blijft op zijn eigen dag.',
  'plan.move.spoken.journeyTimed':
    '{name} is niet verplaatst. Het vertrekt om {time}.',
  'plan.move.error.save': 'Die verplaatsing is niet opgeslagen',
  'plan.move.error.retry': 'Probeer het zo meteen opnieuw.',
  'plan.move.dropTime.title': '{name} verplaatsen en {time} laten vervallen?',
  'plan.move.dropTime.body':
    'Deze plek spreekt de tijd erop tegen. Hierheen verplaatsen wist de tijd — de nieuwe volgorde en de gewiste tijd worden samen opgeslagen.',
  'plan.move.dropTime.confirm': 'Verplaatsen en tijd wissen',
  'plan.move.dropTime.cancel': 'Laat staan waar het staat',
  /* ------------------------------------------- a stop's menu and its delete */
  'plan.stop.menu.editPlace': 'Plek bewerken',
  'plan.stop.menu.setTime': 'Tijd instellen',
  'plan.stop.menu.placeOnMap': 'Op de kaart plaatsen',
  'plan.stop.menu.movePin': 'Speld verplaatsen',
  'plan.stop.menu.moveToDay': 'Naar een andere dag verplaatsen',
  'plan.stop.menu.backToUnplanned': 'Terug naar ongepland',
  'plan.stop.menu.delete': 'Uit de reis verwijderen',
  'plan.delete.title': '{name} verwijderen?',
  'plan.delete.bodyUnplanned':
    'De plek verdwijnt helemaal uit de plekken van de reis. Dit kan niet ongedaan worden gemaakt.',
  'plan.delete.bodyOnDays': {
    one: 'De plek staat op {count} dag van deze reis en verdwijnt daarvan. Dit kan niet ongedaan worden gemaakt.',
    other:
      'De plek staat op {count} dagen van deze reis en verdwijnt van allemaal. Dit kan niet ongedaan worden gemaakt.',
  },
  'plan.delete.error': 'Verwijderen is niet gelukt',
  'plan.delete.confirm': 'Plek verwijderen',
  'plan.delete.deleting': 'Plek wordt verwijderd',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Notitie toevoegen',
  'plan.note.addForDay': 'Notitie toevoegen: {day}',
  'plan.addPlace.label': 'Plek toevoegen',
  'plan.addPlace.more': 'Meer manieren om een plek toe te voegen',
  'plan.addPlace.option.map': 'Op de kaart plaatsen',
  'plan.addPlace.forDayNamed': 'Plek toevoegen: {day}',
  'plan.addPlace.quota':
    'Je hebt de limiet voor plaatsen van je abonnement bereikt. Upgrade om er meer toe te voegen.',
  'plan.addPlace.quotaAction': 'Abonnementen bekijken',
  'plan.stay.checkIn': 'Aankomst',
  'plan.stay.checkOut': 'Vertrek',
  'plan.day.addStay': 'Verblijf toevoegen: {day}',
  'plan.day.addStayShort': 'Verblijf toevoegen',
  'plan.handoff.stop': 'Open {place} in {service} (opent in een nieuw tabblad)',
  'plan.handoff.day.directions': 'Route in {service}',
  'plan.handoff.day.directionsName':
    'Route in {service}: {day} (opent in een nieuw tabblad)',
  'plan.handoff.day.directionsPartial':
    'Stops: de eerste {carried} van {total}',
  'plan.handoff.day.directionsPartialName':
    'Route in {service}: {day}, stops: de eerste {carried} van {total} (opent in een nieuw tabblad)',
  'plan.handoff.day.point': 'Toon in {service}',
  'plan.handoff.day.pointName':
    'Toon in {service}: de enige stop met locatie op {day} (opent in een nieuw tabblad)',
  'plan.drop.hint':
    'Klik met de rechtermuisknop op de kaart, of houd je vinger erop, om precies daar een plek toe te voegen.',
  'plan.drop.armed':
    'Klik op de kaart waar hij hoort, of verschuif de kaart en druk op Enter om hem in het midden neer te zetten.',
  'plan.drop.stop': 'Stoppen met het plaatsen van een nieuwe speld',
  'plan.drop.pin': 'Nieuwe plek',
  'plan.drop.lookingUp': 'Adres wordt gezocht…',
  'plan.drop.error':
    'De speld kon niet worden geplaatst. Probeer het zo meteen opnieuw.',
  'plan.place.pastedPosition':
    'Gelezen als breedtegraad {lat}, lengtegraad {lng}',
  'plan.note.showMore': 'Meer tonen',
  'plan.note.showLess': 'Minder tonen',
  'plan.note.moveUp': 'Omhoog verplaatsen',
  'plan.note.moveDown': 'Omlaag verplaatsen',
  'plan.note.moveToDay': 'Naar een andere dag verplaatsen',
  'plan.note.drag': 'Notitie herschikken',
  'plan.note.edit': 'Notitie bewerken',
  'plan.note.delete': 'Notitie verwijderen',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Notitie toevoegen',
  'plan.note.dialog.editTitle': 'Notitie bewerken',
  'plan.note.field.body': 'Notitie',
  'plan.note.field.bodyHint': 'Eén regel. Dit is wat de dag laat zien.',
  'plan.note.field.detail': 'Toelichting',
  'plan.note.field.detailHint':
    'Koppen, lijsten, links, citaten, code en tabellen.',
  'plan.note.field.time': 'Tijd',
  'plan.note.field.timeHint': 'Optioneel, 24-uursnotatie.',
  'plan.note.field.icon': 'Pictogram',
  'plan.note.tab.write': 'Schrijven',
  'plan.note.tab.preview': 'Voorbeeld',
  'plan.note.previewEmpty': 'Nog niets om te tonen',
  'plan.note.save': 'Notitie opslaan',
  'plan.note.cancel': 'Annuleren',
  'plan.note.confirmDelete': 'Deze notitie verwijderen?',
  'plan.note.confirmDeleteBody':
    'De notitie en de toelichting verdwijnen van deze dag.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Notitie toegevoegd',
  'plan.note.toast.updated': 'Notitie opgeslagen',
  'plan.note.toast.deleted': 'Notitie verwijderd',
  'plan.note.error.save': 'De notitie is niet opgeslagen',
  'plan.note.error.delete': 'De notitie is niet verwijderd',
  'plan.note.error.retry': 'Probeer het zo meteen opnieuw.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Herinnering',
  'plan.note.icon.clock': 'Tijd',
  'plan.note.icon.flashlight': 'Zaklamp',
  'plan.note.icon.footprints': 'Wandeling',
  'plan.note.icon.info': 'Informatie',
  'plan.note.icon.luggage': 'Bagage',
  'plan.note.icon.package': 'Pakket',
  'plan.note.icon.ticket': 'Kaartjes',
  'plan.note.icon.trainFront': 'Trein',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Notitie',
  'plan.note.icon.utensils': 'Eten',
  'plan.note.icon.bus': 'Vervoer',
  'plan.note.icon.bedDouble': 'Overnachting',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Plek',
  'plan.note.icon.wallet': 'Geld',
  'plan.note.icon.umbrella': 'Regen',
  'plan.note.icon.triangleAlert': 'Waarschuwing',
  'plan.transport.phase.flight.departing': 'Vertrek',
  'plan.transport.phase.flight.travelling': 'In de lucht',
  'plan.transport.phase.flight.arriving': 'Landing',
  'plan.transport.phase.hire.departing': 'Ophalen',
  'plan.transport.phase.hire.travelling': 'Gehuurd',
  'plan.transport.phase.hire.arriving': 'Inleveren',
  'plan.transport.phase.journey.departing': 'Begin',
  'plan.transport.phase.journey.travelling': 'Onderweg',
  'plan.transport.phase.journey.arriving': 'Einde',
  'plan.transport.label': 'Van {from} naar {to}',
  'plan.transport.drag': 'Herschikken: {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Samen',
  'collab.empty': 'Nog niets gedeeld',
  'collab.conversation': 'Gesprek',
  'collab.count.messages': {
    one: '{messages} bericht',
    other: '{messages} berichten',
  },
  'collab.count.notes': {
    one: '{notes} notitie',
    other: '{notes} notities',
  },
  'collab.count.polls': {
    one: '{polls} peiling',
    other: '{polls} peilingen',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Boekingen',
  'book.empty': 'Nog niets geboekt',
  'book.count.bookings': {
    one: '{bookings} boeking',
    other: '{bookings} boekingen',
  },
  'book.count.confirmed': {
    one: '{confirmed} bevestigd',
    other: '{confirmed} bevestigd',
  },
  'book.progressLabel': {
    one: '{confirmed} van {total} boeking bevestigd',
    other: '{confirmed} van {total} boekingen bevestigd',
  },
  'book.ofTotal': 'van {total}',
  'book.confirmed': 'Bevestigd',
  'book.awaiting': 'Wacht op bevestiging',
  'book.nothingHanging': 'Niets open',
  'book.chase': 'Regel dit voor vertrek',
  'book.committed': 'Vastgelegd',
  'book.committedCaption': 'Over alle boekingen van deze reis',
  'book.onItinerary': 'In de reisroute',
  'book.pinnedCaption': 'Vastgezet op een dag van de route',
  'book.readOnly.archived':
    'Deze reis is gearchiveerd, dus de boekingen en verblijven zijn alleen-lezen. Herstel de reis om ze te wijzigen.',
  /* ---------------------------------------------- the transports tab */
  'transports.recovery.refused':
    'Deze wijziging is geweigerd. Bekijk de huidige reis voordat je meer wijzigingen aanbrengt.',
  'transports.recovery.failed':
    'De reis kon niet worden vernieuwd. Probeer het opnieuw voordat je wijzigingen aanbrengt.',
  'transports.readOnly.archived':
    'Deze reis is gearchiveerd. Herstel de reis om vervoer te wijzigen.',
  'transports.title': 'Trajecten',
  'transports.empty': 'Nog niets vastgelegd',
  'transports.count.transports': {
    one: '{transports} traject',
    other: '{transports} trajecten',
  },
  'transports.distance': 'Afgelegde afstand',
  'transports.equator': '≈ {times}× rond de evenaar',
  'transports.noGrouping': 'Nog niets gegroepeerd',
  'transports.mostly': 'vooral {mode}',
  'transports.confirmed': 'Bevestigd',
  'transports.stillPending': {
    one: '{pending} staat nog open',
    other: '{pending} staan nog open',
  },
  'transports.spent': 'Uitgegeven aan reizen',
  'transports.noPrices': 'Geen prijzen vastgelegd',
  'transports.priced': {
    one: 'over {priced} traject met prijs',
    other: 'over {priced} trajecten met prijs',
  },
  'people.title': 'Personen',
  'people.description': 'Wie er op deze reis is, en wie de reis kan vinden',
  'people.members.title': 'Op deze reis',
  'people.members.empty': 'Niemand van deze reis zit nog in deze werkruimte',
  'people.role.label': 'Rol',
  'people.role.owner': 'Eigenaar',
  'people.role.editor': 'Bewerker',
  'people.role.viewer': 'Lezer',
  'people.you': 'Jij',
  'people.owner.hint': 'Een reis houdt altijd minstens één eigenaar',
  'people.remove.action': '{name} van deze reis halen',
  'people.remove.title': '{name} van deze reis halen?',
  'people.remove.body':
    'Diegene verliest meteen toegang tot de reisroute. Wat is toegevoegd, blijft op de reis.',
  'people.remove.confirm': 'Verwijderen',
  'people.leave.action': 'Deze reis verlaten',
  'people.leave.title': 'Deze reis verlaten?',
  'people.leave.body':
    'Je verliest de toegang tot de reisroute totdat iemand van de reis je weer toevoegt.',
  'people.leave.confirm': 'Verlaten',
  'people.cancel': 'Annuleren',
  'people.invite.title': 'Iemand toevoegen',
  'people.invite.placeholder': 'Zoek de mensen in deze werkruimte',
  'people.invite.action': 'Aan de reis toevoegen',
  'people.invite.role': 'Doet mee als',
  'people.invite.empty': 'Iedereen in deze werkruimte is al op deze reis',
  'people.invite.emptyHint':
    'Eerst komt er iemand nieuw in de werkruimte, bij Instellingen',
  'people.visibility.title': 'Wie deze reis kan vinden',
  'people.visibility.switch': 'Zichtbaar voor iedereen in de werkruimte',
  'people.visibility.private': 'Alleen de mensen die hier staan zien deze reis',
  'people.visibility.organization':
    'Iedereen in deze werkruimte kan deze reis openen',
  'people.visibility.public': 'Deze reis is gedeeld met een openbare link',
  'people.error.lastOwner':
    'Een reis houdt minstens één eigenaar. Maak eerst iemand anders eigenaar.',
  'people.error.notInWorkspace': 'Die persoon zit niet in deze werkruimte',
  'people.error.alreadyOnTrip': 'Die persoon is al op deze reis',
  'people.guests.title': 'Reizen met je mee',
  'people.guests.description': 'Mensen op deze reis zonder account',
  'people.guests.empty': 'Nog niemand',
  'people.guests.emptyHint':
    'Een gast reist met je mee en heeft geen account nodig. Voeg hem toe met zijn naam.',
  'people.guest.badge': 'Gast',
  'people.guest.add.label': 'Naam',
  'people.guest.add.placeholder': 'Sanne',
  'people.guest.add.action': 'Gast toevoegen',
  'people.guest.rename.action': '{name} hernoemen',
  'people.guest.rename.title': '{name} hernoemen',
  'people.guest.rename.confirm': 'Hernoemen',
  'people.guest.remove.action': '{name} van deze reis verwijderen',
  'people.guest.remove.title': '{name} van deze reis verwijderen?',
  'people.guest.remove.body':
    'De gast verdwijnt. Verder verandert er niets aan de reis.',
  'people.guest.remove.confirm': 'Verwijderen',
  'people.guest.merge.action': '{name} is nu…',
  'people.guest.merge.title': '{name} is nu een van de mensen op deze reis',
  'people.guest.merge.body':
    'Alles wat aan {name} is toegewezen gaat naar de persoon die je kiest, en de gast verdwijnt. Dit kan niet ongedaan worden gemaakt.',
  'people.guest.merge.inherits':
    '{member} neemt alles over wat aan {name} is toegewezen.',
  'people.guest.merge.placeholder': 'Kies iemand op deze reis',
  'people.guest.merge.confirm': 'Samenvoegen',
  'people.guest.merge.done': '{name} is nu {member}',
  'people.guest.merge.nothingMoved':
    'Er was nog niets aan deze gast toegewezen',
  'people.error.guestNameTaken':
    'Er staat al een gast met de naam {name} op deze reis',
  'people.error.guestLimit':
    'Een reis heeft hooguit {limit} gasten, omdat een langere lijst de deelnemerskeuze en de kostenverdeling moeilijk leesbaar maakt',
  'people.error.guestMergeTarget': 'Kies iemand die al op deze reis staat',
  'plan.weather.badge.forecast':
    'Voorspelling: {condition}, maximaal {max}, minimaal {min}',
  'plan.weather.badge.forecastNoCondition':
    'Voorspelling: maximaal {max}, minimaal {min}',
  'plan.weather.badge.unavailable': 'Weer niet beschikbaar voor deze dag',
  'plan.weather.badge.loading': 'Weer laden',
  'plan.weather.badge.recorded': 'Gemeten: maximaal {max}, minimaal {min}',
  'plan.weather.badge.recordedHigh': 'Gemeten: maximaal {max}',
  'plan.weather.badge.recordedLow': 'Gemeten: minimaal {min}',
  'plan.weather.badge.estimate':
    'Schatting: typisch maximaal {max}, minimaal {min}',
  'plan.weather.badge.estimateHigh': 'Schatting: typisch maximaal {max}',
  'plan.weather.badge.estimateLow': 'Schatting: typisch minimaal {min}',
  'plan.weather.badge.notYetRecorded': 'Nog niet geregistreerd',
  'plan.weather.condition.clear': 'Helder',
  'plan.weather.condition.fair': 'Mooi weer',
  'plan.weather.condition.partlyCloudy': 'Half bewolkt',
  'plan.weather.condition.cloudy': 'Bewolkt',
  'plan.weather.condition.fog': 'Mist',
  'plan.weather.condition.rain': 'Regen',
  'plan.weather.condition.heavyRain': 'Zware regen',
  'plan.weather.condition.sleet': 'Natte sneeuw',
  'plan.weather.condition.snow': 'Sneeuw',
  'plan.weather.condition.thunder': 'Onweer',
  'plan.weather.panel.title': 'Weer op {date}',
  'plan.weather.panel.temperature': 'Hoogste / laagste',
  'plan.weather.panel.precipitation': 'Neerslag',
  'plan.weather.panel.precipitationTypical': 'Typische neerslag per dag',
  'plan.weather.panel.probability': '{percent} kans',
  'plan.weather.panel.wind': 'Wind',
  'plan.weather.panel.sunrise': 'Zonsopkomst',
  'plan.weather.panel.sunset': 'Zonsondergang',
  'plan.weather.panel.noSunrise': 'Geen zonsopkomst',
  'plan.weather.panel.noSunset': 'Geen zonsondergang',
  'plan.weather.panel.slots': 'Gedurende de dag',
  'plan.weather.panel.slot.night': 'Nacht',
  'plan.weather.panel.slot.morning': 'Ochtend',
  'plan.weather.panel.slot.afternoon': 'Middag',
  'plan.weather.panel.slot.evening': 'Avond',
  'plan.weather.panel.high': 'Hoogste',
  'plan.weather.panel.low': 'Laagste',
  'plan.weather.panel.recordedNote': 'Gemeten waarden voor deze dag.',
  'plan.weather.panel.temperatureTypical': 'Typisch hoogste / laagste',
  'plan.weather.panel.estimateNote':
    'Een langjarig gemiddelde voor deze maand, geen voorspelling.',
  'plan.weather.attribution.metNorway':
    'Voorspellingsgegevens: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Gegevens: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Reisplanbreedte aanpassen',
  'plan.workspace.resizePlaces': 'Plaatsenbreedte aanpassen',
  'plan.workspace.toggleDay': '{day} uit- of inklappen',
  'plan.workspace.days': 'Dagen',
  'plan.workspace.showPanel': 'Paneel {label} tonen',
  'plan.workspace.hidePanel': 'Paneel {label} verbergen',
  'plan.workspace.narrowPanel': '{label} versmallen',
  'plan.workspace.widenPanel': '{label} verbreden',
  'collab.sections.tabsLabel': 'Samenwerkingssecties',
  'collab.sections.trigger': 'Onderdelen kiezen',
  'collab.sections.menuLabel': 'Tonen aan iedereen op deze reis',
  'collab.sections.keepOne': 'Er blijft minstens één onderdeel aan.',
  'collab.sections.failed': 'De wijziging is niet opgeslagen',
  'collab.sections.failedBody': 'Het menu toont de momenteel opgeslagen stand.',
  'collab.sections.someHidden':
    'Sommige onderdelen zijn verborgen voor deze reis.',
  'collab.sections.turnedOff':
    'Dit onderdeel is uitgezet voor de reis. Het sluit zodra je je tekst verstuurt of wist.',
  'collab.sections.changed': 'De onderdelen van deze reis zijn gewijzigd.',
  'collab.sections.savedHidden':
    'Opgeslagen. Dit onderdeel is verborgen voor de reis en sluit nu.',
  'plan.place.error.save':
    'De plek kon niet worden opgeslagen. Probeer het zo meteen opnieuw.',
  'plan.stop.error.saveTimes':
    'De tijden van de stop konden niet worden opgeslagen. Probeer het zo meteen opnieuw.',
  'plan.place.error.delete':
    'De plek kon niet worden verwijderd. Probeer het zo meteen opnieuw.',
  'plan.pin.error.move':
    'De pin kon niet worden verplaatst. Probeer het zo meteen opnieuw.',
  'plan.place.toast.created': 'Plek toegevoegd',
  'plan.place.toast.updated': 'Plek bijgewerkt',
  'plan.stop.toast.timesSaved': 'Tijden van de stop opgeslagen',
  'plan.place.toast.deleted': 'Plek verwijderd',
  'plan.pin.toast.moved': '{name} vastgepind',
  'join.page.title': 'Uitnodigingslink voor de reis',
  'join.page.description':
    'Open deze link om mee te doen met een gedeelde reis op planned.travel.',
  'join.title.invited': '{inviter} heeft je uitgenodigd voor een reis',
  'join.requirement':
    'Deze link werkt voor mensen die al in de werkruimte van {inviter} zitten.',
  'join.newHere':
    'Nieuw hier? Vraag {inviter} eerst om je toe te voegen aan de werkruimte.',
  'join.trip.label': 'Reis',
  'join.role.label': 'Je zou meedoen als',
  'join.dates.label': 'Data',
  'join.destination.label': 'Bestemming',
  'join.action.signIn': 'Inloggen',
  'join.action.join': 'Meedoen aan de reis',
  'join.action.joining': 'Je sluit aan bij de reis',
  'join.action.open': 'Reis openen',
  'join.action.openIn': 'Reis openen en van werkruimte wisselen',
  'join.action.openIn.pending': 'Van werkruimte wisselen',
  'join.loading': 'Uitnodiging laden',
  'join.joined.title': 'Je doet mee aan de reis',
  'join.joined.body': 'Open de reis om het plan te zien.',
  'join.member.title': 'Je doet al mee aan deze reis',
  'join.needsWorkspace.title':
    'Deze reis staat in een werkruimte waar je geen deel van uitmaakt',
  'join.needsWorkspace.body':
    'Vraag {inviter} eerst om je toe te voegen aan de werkruimte en open deze link daarna opnieuw.',
  'join.needsWorkspace.signedInAs':
    'Je bent ingelogd als {email}. Zeg tegen {inviter} dat dit adres gebruikt moet worden.',
  'join.needsWorkspace.acceptFirst':
    'Heb je al een e-mail met een uitnodiging voor een werkruimte? Accepteer die eerst en open deze link daarna opnieuw.',
  'join.needsWorkspace.otherAccount': 'Inloggen met een ander account',
  'join.unavailable.title': 'Deze uitnodigingslink is niet beschikbaar',
  'join.unavailable.body':
    'De link is mogelijk vervangen of uitgeschakeld. Vraag degene die hem stuurde om een nieuwe.',
  'join.unavailable.signIn': 'Inloggen',
  'join.unavailable.trips': 'Naar je reizen',
  'join.error.title': 'We konden deze uitnodigingslink niet laden',
  'join.error.retry': 'Opnieuw proberen',
  'join.error.busy':
    'Deze pagina is druk bezet. Probeer het over een minuut opnieuw.',
  'join.error.join':
    'Meedoen is niet gelukt. De link werkt nog, probeer het opnieuw.',
  'join.error.switch': 'Kon niet van werkruimte wisselen. Probeer het opnieuw.',

  'invite.title': 'Uitnodigingslink',
  'invite.description':
    'Iedereen in deze werkruimte die de link opent, neemt deel aan de reis.',
  'invite.empty.title': 'Nog geen uitnodigingslink',
  'invite.empty.body':
    'Maak een link en deel die in je groepschat zodat mensen in deze werkruimte kunnen deelnemen.',
  'invite.action.create': 'Link maken',
  'invite.link.label': 'Uitnodigingslink',
  'invite.copy': 'Link kopiëren',
  'invite.copied': 'Link gekopieerd',
  'invite.copyFailed':
    'Kopiëren mislukt. Selecteer de link en kopieer deze zelf.',
  'invite.switch.label':
    'Iedereen in deze werkruimte met de link kan deelnemen',
  'invite.switch.onHint':
    'Uitschakelen maakt de link voor iedereen ongeldig, ook reeds verstuurde kopieën.',
  'invite.switch.offHint':
    'Inschakelen maakt een nieuwe link. Eerdere links blijven ongeldig.',
  'invite.off.body': 'De link is uitgeschakeld. Niemand kan ermee deelnemen.',
  'invite.uses': {
    one: 'Deelnemers via deze link: {count}',
    other: 'Deelnemers via deze link: {count}',
  },
  'invite.uses.never': 'Nog niemand heeft via deze link deelgenomen.',
  'invite.lastUsed': 'Laatst deelgenomen: {when}',
  'invite.role.upgrade.title': 'Bewerkrechten geven?',
  'invite.role.upgrade.body':
    'Dit geldt voor alle verstuurde kopieën en iedereen die vanaf nu deelneemt.',
  'invite.role.upgrade.confirm': 'Bewerkrechten geven',
  'invite.replace.action': 'Link vervangen',
  'invite.replace.title': 'Deze link vervangen?',
  'invite.replace.body':
    'De oude link wordt direct voor iedereen ongeldig. Wie al deelnam, blijft op de reis; verwijder die personen zo nodig uit de lijst hieronder.',
  'invite.replace.deadBody':
    'De oude link werkt niet meer. Wie al deelnam, blijft op de reis.',
  'invite.replace.confirm': 'Link vervangen',
  'invite.replace.pending': 'Link wordt vervangen',
  'invite.stale': 'Deze link werkt niet meer. Vervang deze.',
  'invite.creatorGone':
    'De link werkt niet meer omdat de maker geen eigenaar meer is. Vervang deze.',
  'invite.archived':
    'Deze reis is gearchiveerd. De link werkt weer zodra de reis is hersteld.',
  'invite.announce.created': 'Uitnodigingslink gemaakt',
  'invite.announce.roleEditor': 'Nieuwe deelnemers krijgen bewerkrechten',
  'invite.announce.off': 'Uitnodigingslink uitgeschakeld',
  'invite.announce.newLink':
    'Nieuwe link gereed. Kopieer en verstuur deze opnieuw.',
  'invite.announce.roleViewer': 'Nieuwe deelnemers krijgen leesrechten',
  'invite.error.title': 'De uitnodigingslink is niet geladen',
  'invite.error.retry': 'Opnieuw proberen',
  'invite.refusal.archived': 'Deze reis is gearchiveerd.',
  'invite.refusal.notOwner': 'Alleen een reiseigenaar kan de link wijzigen.',
  'invite.refusal.changed':
    'Iemand heeft de link gewijzigd. De huidige wordt getoond.',
  'invite.announce.recovered':
    'De huidige linkinstellingen worden getoond. Controleer ze voordat je nog iets wijzigt.',
} satisfies TranslationOf<typeof En>

export default messages
