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
} satisfies TranslationOf<typeof En>

export default messages
