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
    'Ideeën zijn plekken die op een dag wachten. Een notitie hoort bij de dag waarvoor ze is geschreven.',
  'plan.move.refused.notInAnotherDay': 'Een notitie blijft op haar eigen dag',
  'plan.move.refused.notInAnotherDayBody':
    'Notities kunnen nog niet naar een andere dag. Bewerk de notitie, of schrijf haar op de andere dag.',
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
  'plan.move.spoken.notInAnotherDay':
    '{name} is niet verplaatst. Een notitie blijft op haar eigen dag.',
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
  /* ---------------------------------------------- the transports tab */
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
} satisfies TranslationOf<typeof En>

export default messages
