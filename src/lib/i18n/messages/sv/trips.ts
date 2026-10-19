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
  'notFound.title': 'Vi kan inte hitta den här resan',
  'notFound.body':
    'Den finns inte bland resorna du kan öppna i din nuvarande arbetsyta. Den kan ha tagits bort, eller så saknar du åtkomst till den.',
  // Coordinate examples keep decimal points because the inputs accept that notation.
  'plan.editor.latitudeExample': '34.9671',
  'plan.editor.longitudeExample': '135.7727',
  /* Place and timing editors; option labels are resolved at render time. */
  'plan.editor.createTitle': 'Lägg till en plats i resan',
  'plan.editor.editTitle': 'Redigera platsen',
  'plan.editor.createDescription':
    'Ge platsen ett namn nu och en position senare - oplanerade platser väntar i platspanelen tills du lägger dem på en dag.',
  'plan.editor.editDescription':
    'Ändringar gäller överallt: kartan, alla tilldelade dagar och resans platslista.',
  'plan.editor.nameRequired': 'Platsen behöver ett namn',
  'plan.editor.nameExample': 't.ex. Fushimi Inari Taisha',
  'plan.editor.city': 'Stad',
  'plan.editor.cityExample': 't.ex. Kyoto',
  'plan.editor.addressExample': 't.ex. 68 Fukakusa Yabunouchicho',
  'plan.editor.duration': 'Tid på plats',
  'plan.editor.rating': 'Värt ett besök?',
  'plan.editor.latitude': 'Breddgrad',
  'plan.editor.longitude': 'Längdgrad',
  'plan.editor.positionHint': 'Eller stäng och välj punkten på kartan.',
  'plan.editor.latitudeError': 'Mellan -90 och 90',
  'plan.editor.longitudeError': 'Mellan -180 och 180',
  'plan.editor.positionError': 'En position behöver båda talen',
  'plan.editor.day': 'Lägg på en dag',
  'plan.editor.dayHint': 'Lämna tomt för att behålla platsen i platspanelen.',
  'plan.editor.unplanned': 'Lämna oplanerad',
  'plan.editor.dayNamed': 'Dag {day} · {title}',
  'plan.editor.stopFallback': 'Det här stoppet',
  'plan.editor.dayNumber': 'Dag {day}',
  'plan.editor.visited': 'Redan besökt',
  'plan.editor.visitedHint': 'Markerar nålen med en bock.',
  'plan.editor.saving': 'Sparar platsen',
  'plan.editor.save': 'Spara ändringar',
  'plan.editor.noCategory': 'Ingen kategori',
  'plan.editor.arrive': 'Ankomst',
  'plan.editor.leave': 'Avresa',
  'plan.editor.timeError': 'Avresan måste vara efter ankomsten',
  'plan.editor.booking': 'Bokning',
  'plan.editor.note': 'Anteckning för stoppet',
  'plan.editor.noteExample': 'Kom tidigt - efter klockan 9 tar kön en timme.',
  'plan.editor.savingTimes': 'Sparar tiderna',
  'plan.editor.saveTimes': 'Spara',
  'plan.editor.duration0': 'Ingen fast längd',
  'plan.editor.duration30': '30 minuter',
  'plan.editor.duration45': '45 minuter',
  'plan.editor.duration60': '1 timme',
  'plan.editor.duration90': '1½ timme',
  'plan.editor.duration120': '2 timmar',
  'plan.editor.duration180': '3 timmar',
  'plan.editor.duration240': 'En halv dag',
  'plan.editor.duration480': 'En hel dag',
  'plan.editor.rating0': 'Inte betygsatt',
  'plan.editor.rating1': '★ 1 - hoppa över',
  'plan.editor.rating2': '★ 2 - om tiden räcker',
  'plan.editor.rating3': '★ 3 - värt det',
  'plan.editor.rating4': '★ 4 - riktigt bra',
  'plan.editor.rating5': '★ 5 - missa inte',
  'plan.editor.bookingNone': 'Ingen bokning behövs',
  'plan.editor.bookingPending': 'Återstår att boka',
  'plan.editor.bookingConfirmed': 'Bokat och bekräftat',
  'plan.editor.bookingCompleted': 'Besöket klart',
  'plan.editor.bookingCancelled': 'Avbokat',
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
  'book.readOnly.archived':
    'Den här resan är arkiverad, så bokningarna och boendena är skrivskyddade. Återställ resan för att ändra dem.',
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
  'plan.workspace.days': 'Dagar',
  'plan.workspace.showPanel': 'Visa panelen {label}',
  'plan.workspace.hidePanel': 'Dölj panelen {label}',
  'plan.workspace.narrowPanel': 'Gör {label} smalare',
  'plan.workspace.widenPanel': 'Gör {label} bredare',
  'collab.sections.tabsLabel': 'Samarbetssektioner',
  'collab.sections.trigger': 'Välj avsnitt',
  'collab.sections.menuLabel': 'Visa för alla på den här resan',
  'collab.sections.keepOne': 'Minst ett avsnitt måste vara på.',
  'collab.sections.failed': 'Ändringen sparades inte',
  'collab.sections.failedBody': 'Menyn visar det som är sparat nu.',
  'collab.sections.someHidden': 'Vissa avsnitt är dolda på den här resan.',
  'collab.sections.turnedOff':
    'Det här avsnittet stängdes av för resan. Det stängs när du skickar eller rensar det du skriver.',
  'collab.sections.changed': 'Avsnitten på den här resan har ändrats.',
  'collab.sections.savedHidden':
    'Sparat. Det här avsnittet är dolt för resan och stängs nu.',
  'plan.place.error.save':
    'Platsen kunde inte sparas. Försök igen om en stund.',
  'plan.stop.error.saveTimes':
    'Stoppets tider kunde inte sparas. Försök igen om en stund.',
  'plan.place.error.delete':
    'Platsen kunde inte tas bort. Försök igen om en stund.',
  'plan.pin.error.move': 'Nålen kunde inte flyttas. Försök igen om en stund.',
  'plan.place.toast.created': 'Plats tillagd',
  'plan.place.toast.updated': 'Plats uppdaterad',
  'plan.stop.toast.timesSaved': 'Stoppets tider sparade',
  'plan.place.toast.deleted': 'Plats borttagen',
  'plan.pin.toast.moved': '{name} fäst',
  'join.page.title': 'Inbjudningslänk till resan',
  'join.page.description':
    'Öppna den här länken för att gå med i en delad resa på planned.travel.',
  'join.title.invited': '{inviter} har bjudit in dig till en resa',
  'join.requirement':
    'Länken fungerar för personer som redan finns i {inviter}s arbetsyta.',
  'join.newHere': 'Ny här? Be {inviter} lägga till dig i arbetsytan först.',
  'join.trip.label': 'Resa',
  'join.role.label': 'Du skulle gå med som',
  'join.dates.label': 'Datum',
  'join.destination.label': 'Resmål',
  'join.action.signIn': 'Logga in',
  'join.action.join': 'Följ med på resan',
  'join.action.joining': 'Går med i resan',
  'join.action.open': 'Öppna resan',
  'join.action.openIn': 'Öppna resan och byt arbetsyta',
  'join.action.openIn.pending': 'Byter arbetsyta',
  'join.loading': 'Läser in inbjudan',
  'join.joined.title': 'Du är med på resan',
  'join.joined.body': 'Öppna den för att se planen.',
  'join.member.title': 'Du är redan med på den här resan',
  'join.needsWorkspace.title':
    'Den här resan finns i en arbetsyta som du inte är med i',
  'join.needsWorkspace.body':
    'Be {inviter} lägga till dig i arbetsytan först och öppna sedan länken igen.',
  'join.needsWorkspace.signedInAs':
    'Du är inloggad som {email}. Be {inviter} använda den här adressen.',
  'join.needsWorkspace.acceptFirst':
    'Om du redan har fått ett mejl med en inbjudan till en arbetsyta ska du tacka ja till den först och sedan öppna länken igen.',
  'join.needsWorkspace.otherAccount': 'Logga in med ett annat konto',
  'join.unavailable.title': 'Den här inbjudningslänken är inte tillgänglig',
  'join.unavailable.body':
    'Länken kan ha ersatts eller stängts av. Be den som skickade den om en ny.',
  'join.unavailable.signIn': 'Logga in',
  'join.unavailable.trips': 'Gå till dina resor',
  'join.error.title': 'Vi kunde inte läsa in den här inbjudningslänken',
  'join.error.retry': 'Försök igen',
  'join.error.busy': 'Sidan är upptagen. Försök igen om en minut.',
  'join.error.join':
    'Det gick inte att gå med. Länken fungerar fortfarande, försök igen.',
  'join.error.switch': 'Det gick inte att byta arbetsyta. Försök igen.',

  'invite.title': 'Inbjudningslänk',
  'invite.description':
    'Alla i denna arbetsyta som öppnar länken går med i resan.',
  'invite.empty.title': 'Ingen inbjudningslänk ännu',
  'invite.empty.body':
    'Skapa en länk och dela den i gruppchatten så att personer i arbetsytan kan gå med.',
  'invite.action.create': 'Skapa länk',
  'invite.link.label': 'Inbjudningslänk',
  'invite.copy': 'Kopiera länk',
  'invite.copied': 'Länken kopierad',
  'invite.copyFailed':
    'Kunde inte kopiera. Markera länken och kopiera den själv.',
  'invite.switch.label': 'Alla i arbetsytan med länken kan gå med',
  'invite.switch.onHint':
    'Avstängning gör länken ogiltig för alla, även redan skickade kopior.',
  'invite.switch.offHint':
    'När den slås på skapas en ny länk. Tidigare länkar förblir ogiltiga.',
  'invite.off.body': 'Länken är avstängd. Ingen kan gå med via den.',
  'invite.uses': {
    one: 'Antal som gått med via länken: {count}',
    other: 'Antal som gått med via länken: {count}',
  },
  'invite.uses.never': 'Ingen har gått med via länken ännu.',
  'invite.lastUsed': 'Senast ansluten: {when}',
  'invite.role.upgrade.title': 'Ge redigeringsrättigheter?',
  'invite.role.upgrade.body':
    'Det gäller alla redan skickade kopior och alla som går med från och med nu.',
  'invite.role.upgrade.confirm': 'Ge redigeringsrättigheter',
  'invite.replace.action': 'Ersätt länk',
  'invite.replace.title': 'Ersätt denna länk?',
  'invite.replace.body':
    'Den gamla länken slutar fungera direkt för alla. De som redan gått med stannar i resan; ta bort dem från listan nedan vid behov.',
  'invite.replace.deadBody':
    'Den gamla länken fungerar inte längre. De som redan gått med stannar i resan.',
  'invite.replace.confirm': 'Ersätt länk',
  'invite.replace.pending': 'Ersätter länken',
  'invite.stale': 'Denna länk fungerar inte längre. Ersätt den.',
  'invite.creatorGone':
    'Länken fungerar inte eftersom skaparen inte längre är ägare. Ersätt den.',
  'invite.archived':
    'Resan är arkiverad. Länken fungerar igen när resan återställs.',
  'invite.announce.created': 'Inbjudningslänk skapad',
  'invite.announce.roleEditor': 'Nya deltagare får redigera',
  'invite.announce.off': 'Inbjudningslänk avstängd',
  'invite.announce.newLink': 'Ny länk klar. Kopiera och skicka den igen.',
  'invite.announce.roleViewer': 'Nya deltagare får läsbehörighet',
  'invite.error.title': 'Inbjudningslänken kunde inte laddas',
  'invite.error.retry': 'Försök igen',
  'invite.refusal.archived': 'Resan är arkiverad.',
  'invite.refusal.notOwner': 'Bara en reseägare kan ändra länken.',
  'invite.refusal.changed': 'Någon ändrade länken. Den aktuella visas.',
  'invite.announce.recovered':
    'De aktuella länkinställningarna visas. Kontrollera dem innan du ändrar igen.',
} satisfies TranslationOf<typeof En>

export default messages
