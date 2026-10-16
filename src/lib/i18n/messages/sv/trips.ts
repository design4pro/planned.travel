/**
 * The trip tabs' own copy, in sv.
 *
 * Authored from `../en/trips.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/trips'

const messages = {
  /* ------------------------------------------ when a tab fails to load */
  'error.trip': 'Den här resan kunde inte läsas in',
  'error.plan': 'Resplanen kunde inte läsas in',
  'error.costs': 'Kostnaderna kunde inte läsas in',
  'error.collab': 'Samtalet kunde inte läsas in',
  'error.book': 'Bokningarna kunde inte läsas in',
  'error.transports': 'Färderna kunde inte laddas',
  'error.people': 'Personerna kunde inte läsas in',
  'header.length': {
    one: '{days} dag',
    other: '{days} dagar',
  },
  'header.planned': {
    one: '{days} dag planerad',
    other: '{days} dagar planerade',
  },
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Resplan',
  'plan.places': 'Platser',
  'plan.readOnly.archived':
    'Den här resan är arkiverad, så planen är skrivskyddad.',
  'plan.readOnly.role':
    'Du kan läsa den här planen. Bara resans ägare och redigerare kan ändra den.',
  'plan.day.empty':
    'Inget planerat än – släpp en plats eller en anteckning här',
  'plan.move.refused.duplicate': '{name} finns redan den dagen',
  'plan.move.refused.duplicateBody':
    'En plats kan bara finnas en gång per dag. Flytta den till en annan dag i stället.',
  'plan.move.refused.notInIdeas': 'En anteckning stannar i dagen',
  'plan.move.refused.notInIdeasBody':
    'Idéer är platser som väntar på en dag. En anteckning hör till dagen den skrevs för.',
  'plan.move.refused.notInAnotherDay': 'En anteckning stannar på sin egen dag',
  'plan.move.refused.notInAnotherDayBody':
    'Anteckningar kan ännu inte flyttas mellan dagar. Redigera anteckningen, eller skriv den på den andra dagen.',
  'plan.move.refused.journeyNotInIdeas': 'En färd stannar i dagen',
  'plan.move.refused.journeyNotInIdeasBody':
    'Idéer är platser som väntar på en dag. En färd hör till dagen den sker.',
  'plan.move.refused.journeyNotInAnotherDay': 'En färd stannar på sin egen dag',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'En färds dag kommer från dess datum. Ändra dem på fliken Färder.',
  'plan.move.refused.journeyTimed': '{name} avgår {time}',
  'plan.move.refused.journeyTimedBody':
    'En avgångstid hör till tidtabellen, inte till planen. Lägg färden där dess klocka hör hemma.',
  'plan.move.spoken.duplicate':
    '{name} flyttades inte. Den dagen har den redan.',
  'plan.move.spoken.notInIdeas':
    '{name} flyttades inte. En anteckning stannar i dagen.',
  'plan.move.spoken.notInAnotherDay':
    '{name} flyttades inte. En anteckning stannar på sin egen dag.',
  'plan.move.spoken.timed':
    '{name} har tiden {time}. Vi frågar om den ska tas bort.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} flyttades inte. En färd stannar i dagen.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} flyttades inte. En färd stannar på sin egen dag.',
  'plan.move.spoken.journeyTimed': '{name} flyttades inte. Den avgår {time}.',
  'plan.move.error.save': 'Flytten sparades inte',
  'plan.move.error.retry': 'Försök igen om en stund.',
  'plan.move.dropTime.title': 'Flytta {name} och ta bort {time}?',
  'plan.move.dropTime.body':
    'Den här platsen motsäger tiden på den. Att flytta hit rensar tiden — den nya ordningen och den rensade tiden sparas tillsammans.',
  'plan.move.dropTime.confirm': 'Flytta och ta bort tiden',
  'plan.move.dropTime.cancel': 'Låt den vara',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Lägg till en anteckning',
  'plan.note.addForDay': 'Lägg till en anteckning: {day}',
  'plan.addPlace.label': 'Lägg till en plats',
  'plan.addPlace.more': 'Fler sätt att lägga till en plats',
  'plan.addPlace.option.map': 'Placera den på kartan',
  'plan.addPlace.forDayNamed': 'Lägg till en plats: {day}',
  'plan.addPlace.quota':
    'Du har nått gränsen för platser i din plan. Uppgradera för att lägga till fler.',
  'plan.addPlace.quotaAction': 'Visa planer',
  'plan.stay.checkIn': 'Incheckning',
  'plan.stay.checkOut': 'Utcheckning',
  'plan.day.addStay': 'Lägg till ett boende: {day}',
  'plan.day.addStayShort': 'Lägg till ett boende',
  'plan.handoff.stop': 'Öppna {place} i {service} (öppnas i en ny flik)',
  'plan.handoff.day.directions': 'Vägbeskrivning i {service}',
  'plan.handoff.day.directionsName':
    'Vägbeskrivning i {service}: {day} (öppnas i en ny flik)',
  'plan.handoff.day.directionsPartial': 'Stopp: de första {carried} av {total}',
  'plan.handoff.day.directionsPartialName':
    'Vägbeskrivning i {service}: {day}, stopp: de första {carried} av {total} (öppnas i en ny flik)',
  'plan.handoff.day.point': 'Visa i {service}',
  'plan.handoff.day.pointName':
    'Visa i {service}: det enda stoppet med position på {day} (öppnas i en ny flik)',
  'plan.drop.hint':
    'Högerklicka på kartan, eller tryck och håll, för att lägga till en plats precis där.',
  'plan.drop.armed':
    'Klicka på kartan där den ska ligga, eller flytta kartan och tryck på Enter för att släppa den i mitten.',
  'plan.drop.stop': 'Sluta placera en ny nål',
  'plan.drop.pin': 'Ny plats',
  'plan.drop.lookingUp': 'Letar efter adressen…',
  'plan.drop.error': 'Nålen kunde inte placeras. Försök igen om en stund.',
  'plan.place.pastedPosition': 'Tolkat som latitud {lat}, longitud {lng}',
  'plan.note.showMore': 'Visa mer',
  'plan.note.showLess': 'Visa mindre',
  'plan.note.moveUp': 'Flytta upp',
  'plan.note.moveDown': 'Flytta ner',
  'plan.note.drag': 'Ändra ordning på anteckningen',
  'plan.note.edit': 'Redigera anteckningen',
  'plan.note.delete': 'Ta bort anteckningen',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Lägg till en anteckning',
  'plan.note.dialog.editTitle': 'Redigera anteckningen',
  'plan.note.field.body': 'Anteckning',
  'plan.note.field.bodyHint': 'En rad. Det är den dagen visar.',
  'plan.note.field.detail': 'Detaljer',
  'plan.note.field.detailHint':
    'Rubriker, listor, länkar, citat, kod och tabeller.',
  'plan.note.field.time': 'Tid',
  'plan.note.field.timeHint': 'Valfritt, i 24-timmarsformat.',
  'plan.note.field.icon': 'Ikon',
  'plan.note.tab.write': 'Skriv',
  'plan.note.tab.preview': 'Förhandsvisning',
  'plan.note.previewEmpty': 'Inget att förhandsvisa än',
  'plan.note.save': 'Spara anteckningen',
  'plan.note.cancel': 'Avbryt',
  'plan.note.confirmDelete': 'Ta bort den här anteckningen?',
  'plan.note.confirmDeleteBody':
    'Anteckningen och dess detaljer försvinner från den här dagen.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Anteckningen har lagts till',
  'plan.note.toast.updated': 'Anteckningen har sparats',
  'plan.note.toast.deleted': 'Anteckningen har tagits bort',
  'plan.note.error.save': 'Anteckningen sparades inte',
  'plan.note.error.delete': 'Anteckningen togs inte bort',
  'plan.note.error.retry': 'Försök igen om en stund.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Påminnelse',
  'plan.note.icon.clock': 'Tid',
  'plan.note.icon.flashlight': 'Ficklampa',
  'plan.note.icon.footprints': 'Promenad',
  'plan.note.icon.info': 'Information',
  'plan.note.icon.luggage': 'Bagage',
  'plan.note.icon.package': 'Paket',
  'plan.note.icon.ticket': 'Biljetter',
  'plan.note.icon.trainFront': 'Tåg',
  'plan.note.icon.wifi': 'Internet',
  'plan.note.icon.stickyNote': 'Anteckning',
  'plan.note.icon.utensils': 'Mat',
  'plan.note.icon.bus': 'Kollektivtrafik',
  'plan.note.icon.bedDouble': 'Boende',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Plats',
  'plan.note.icon.wallet': 'Pengar',
  'plan.note.icon.umbrella': 'Regn',
  'plan.note.icon.triangleAlert': 'Varning',
  'plan.transport.phase.flight.departing': 'Avgång',
  'plan.transport.phase.flight.travelling': 'I luften',
  'plan.transport.phase.flight.arriving': 'Landning',
  'plan.transport.phase.hire.departing': 'Upphämtning',
  'plan.transport.phase.hire.travelling': 'Uthyrd',
  'plan.transport.phase.hire.arriving': 'Återlämning',
  'plan.transport.phase.journey.departing': 'Start',
  'plan.transport.phase.journey.travelling': 'På väg',
  'plan.transport.phase.journey.arriving': 'Slut',
  'plan.transport.label': 'Från {from} till {to}',
  'plan.transport.drag': 'Ändra ordning: {journey}',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Tillsammans',
  'collab.empty': 'Inget delat än',
  'collab.conversation': 'Samtal',
  'collab.count.messages': {
    one: '{messages} meddelande',
    other: '{messages} meddelanden',
  },
  'collab.count.notes': {
    one: '{notes} anteckning',
    other: '{notes} anteckningar',
  },
  'collab.count.polls': {
    one: '{polls} omröstning',
    other: '{polls} omröstningar',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Bokningar',
  'book.empty': 'Inget bokat än',
  'book.count.bookings': {
    one: '{bookings} bokning',
    other: '{bookings} bokningar',
  },
  'book.count.confirmed': {
    one: '{confirmed} bekräftad',
    other: '{confirmed} bekräftade',
  },
  'book.progressLabel': {
    one: '{confirmed} av {total} bokning bekräftad',
    other: '{confirmed} av {total} bokningar bekräftade',
  },
  'book.ofTotal': 'av {total}',
  'book.confirmed': 'Bekräftade',
  'book.awaiting': 'Väntar på bekräftelse',
  'book.nothingHanging': 'Inget öppet',
  'book.chase': 'Ligg på innan ni flyger',
  'book.committed': 'Bundet',
  'book.committedCaption': 'Över alla bokningar på den här resan',
  'book.onItinerary': 'I resplanen',
  'book.pinnedCaption': 'Fäst vid en dag i planen',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Färder',
  'transports.empty': 'Inget noterat än',
  'transports.count.transports': {
    one: '{transports} färd',
    other: '{transports} färder',
  },
  'transports.distance': 'Tillryggalagd sträcka',
  'transports.equator': '≈ {times}× runt ekvatorn',
  'transports.noGrouping': 'Inget grupperat än',
  'transports.mostly': 'mest {mode}',
  'transports.confirmed': 'Bekräftade',
  'transports.stillPending': {
    one: '{pending} väntar fortfarande',
    other: '{pending} väntar fortfarande',
  },
  'transports.spent': 'Spenderat på resor',
  'transports.noPrices': 'Inga priser noterade',
  'transports.priced': {
    one: 'över {priced} prissatt färd',
    other: 'över {priced} prissatta färder',
  },
  'people.title': 'Personer',
  'people.description': 'Vilka som är med på resan och vilka som kan hitta den',
  'people.members.title': 'Med på resan',
  'people.members.empty': 'Ingen från den här resan finns kvar i arbetsytan',
  'people.role.label': 'Roll',
  'people.role.owner': 'Ägare',
  'people.role.editor': 'Redigerare',
  'people.role.viewer': 'Läsare',
  'people.you': 'Du',
  'people.owner.hint': 'En resa behåller alltid minst en ägare',
  'people.remove.action': 'Ta bort {name} från resan',
  'people.remove.title': 'Ta bort {name} från resan?',
  'people.remove.body':
    'Personen förlorar åtkomsten till resplanen direkt. Det som lagts till blir kvar på resan.',
  'people.remove.confirm': 'Ta bort',
  'people.leave.action': 'Lämna resan',
  'people.leave.title': 'Lämna den här resan?',
  'people.leave.body':
    'Du förlorar åtkomsten till resplanen tills någon på resan lägger till dig igen.',
  'people.leave.confirm': 'Lämna',
  'people.cancel': 'Avbryt',
  'people.invite.title': 'Lägg till någon',
  'people.invite.placeholder': 'Sök bland personerna i arbetsytan',
  'people.invite.action': 'Lägg till på resan',
  'people.invite.role': 'Går med som',
  'people.invite.empty': 'Alla i arbetsytan är redan med på resan',
  'people.invite.emptyHint':
    'Först kommer någon ny in i arbetsytan, under Inställningar',
  'people.visibility.title': 'Vilka som kan hitta resan',
  'people.visibility.switch': 'Synlig för alla i arbetsytan',
  'people.visibility.private': 'Bara personerna som står här ser den här resan',
  'people.visibility.organization':
    'Vem som helst i arbetsytan kan öppna den här resan',
  'people.visibility.public': 'Den här resan delas med en offentlig länk',
  'people.error.lastOwner':
    'En resa behåller minst en ägare. Gör någon annan till ägare först.',
  'people.error.notInWorkspace': 'Den personen finns inte i arbetsytan',
  'people.error.alreadyOnTrip': 'Den personen är redan med på resan',
  'people.guests.title': 'Reser med dig',
  'people.guests.description':
    'Personer på den här resan som inte har något konto',
  'people.guests.empty': 'Ingen än',
  'people.guests.emptyHint':
    'En gäst reser med dig och behöver inget konto. Lägg till gästen med namn.',
  'people.guest.badge': 'Gäst',
  'people.guest.add.label': 'Namn',
  'people.guest.add.placeholder': 'Elsa',
  'people.guest.add.action': 'Lägg till gäst',
  'people.guest.rename.action': 'Byt namn på {name}',
  'people.guest.rename.title': 'Byt namn på {name}',
  'people.guest.rename.confirm': 'Byt namn',
  'people.guest.remove.action': 'Ta bort {name} från resan',
  'people.guest.remove.title': 'Ta bort {name} från resan?',
  'people.guest.remove.body': 'Gästen försvinner. Inget annat på resan ändras.',
  'people.guest.remove.confirm': 'Ta bort',
  'people.guest.merge.action': '{name} är nu…',
  'people.guest.merge.title': '{name} är nu en av personerna på den här resan',
  'people.guest.merge.body':
    'Allt som är tilldelat {name} flyttas till personen du väljer, och gästen försvinner. Det går inte att ångra.',
  'people.guest.merge.inherits':
    '{member} tar över allt som är tilldelat {name}.',
  'people.guest.merge.placeholder': 'Välj någon på resan',
  'people.guest.merge.confirm': 'Slå ihop',
  'people.guest.merge.done': '{name} är nu {member}',
  'people.guest.merge.nothingMoved': 'Inget var tilldelat gästen ännu',
  'people.error.guestNameTaken':
    'En gäst som heter {name} finns redan på resan',
  'people.error.guestLimit':
    'En resa rymmer högst {limit} gäster, eftersom en längre lista gör deltagarväljarna och kostnadsfördelningen svåra att läsa',
  'people.error.guestMergeTarget': 'Välj någon som redan är med på resan',
  'plan.weather.badge.forecast':
    'Prognos: {condition}, högst {max}, lägst {min}',
  'plan.weather.badge.forecastNoCondition': 'Prognos: högst {max}, lägst {min}',
  'plan.weather.badge.unavailable':
    'Vädret är inte tillgängligt för den här dagen',
  'plan.weather.badge.loading': 'Läser in vädret',
  'plan.weather.badge.recorded': 'Uppmätt: högst {max}, lägst {min}',
  'plan.weather.badge.recordedHigh': 'Uppmätt: högst {max}',
  'plan.weather.badge.recordedLow': 'Uppmätt: lägst {min}',
  'plan.weather.badge.estimate':
    'Uppskattning: typiskt högst {max}, lägst {min}',
  'plan.weather.badge.estimateHigh': 'Uppskattning: typiskt högst {max}',
  'plan.weather.badge.estimateLow': 'Uppskattning: typiskt lägst {min}',
  'plan.weather.badge.notYetRecorded': 'Ännu inte registrerat',
  'plan.weather.condition.clear': 'Klart',
  'plan.weather.condition.fair': 'Fint',
  'plan.weather.condition.partlyCloudy': 'Delvis molnigt',
  'plan.weather.condition.cloudy': 'Molnigt',
  'plan.weather.condition.fog': 'Dimma',
  'plan.weather.condition.rain': 'Regn',
  'plan.weather.condition.heavyRain': 'Kraftigt regn',
  'plan.weather.condition.sleet': 'Snöblandat regn',
  'plan.weather.condition.snow': 'Snö',
  'plan.weather.condition.thunder': 'Åska',
  'plan.weather.panel.title': 'Väder {date}',
  'plan.weather.panel.temperature': 'Högsta / lägsta',
  'plan.weather.panel.precipitation': 'Nederbörd',
  'plan.weather.panel.precipitationTypical': 'Typisk nederbörd per dag',
  'plan.weather.panel.probability': '{percent} chans',
  'plan.weather.panel.wind': 'Vind',
  'plan.weather.panel.sunrise': 'Soluppgång',
  'plan.weather.panel.sunset': 'Solnedgång',
  'plan.weather.panel.noSunrise': 'Ingen soluppgång',
  'plan.weather.panel.noSunset': 'Ingen solnedgång',
  'plan.weather.panel.slots': 'Under dagen',
  'plan.weather.panel.slot.night': 'Natt',
  'plan.weather.panel.slot.morning': 'Förmiddag',
  'plan.weather.panel.slot.afternoon': 'Eftermiddag',
  'plan.weather.panel.slot.evening': 'Kväll',
  'plan.weather.panel.high': 'Högsta',
  'plan.weather.panel.low': 'Lägsta',
  'plan.weather.panel.recordedNote': 'Uppmätta värden för den här dagen.',
  'plan.weather.panel.temperatureTypical': 'Typiskt högsta / lägsta',
  'plan.weather.panel.estimateNote':
    'Ett långtidsmedelvärde för den här månaden, inte en prognos.',
  'plan.weather.attribution.metNorway': 'Prognosdata: MET Norway, CC BY 4.0',
  'plan.weather.attribution.nasaPower':
    'Datakälla: NASA Langley Research Center POWER Project',
  'plan.workspace.resizeItinerary': 'Ändra resplanens bredd',
  'plan.workspace.resizePlaces': 'Ändra platsernas bredd',
  'plan.workspace.toggleDay': 'Expandera eller fäll ihop {day}',
} satisfies TranslationOf<typeof En>

export default messages
