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
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Resplan',
  'plan.places': 'Platser',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Lägg till en anteckning',
  'plan.note.addForDay': 'Lägg till en anteckning för den här dagen',
  'plan.note.showMore': 'Visa mer',
  'plan.note.showLess': 'Visa mindre',
  'plan.note.moveUp': 'Flytta upp',
  'plan.note.moveDown': 'Flytta ner',
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
  'plan.note.error.move': 'Flytten sparades inte',
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
} satisfies TranslationOf<typeof En>

export default messages
