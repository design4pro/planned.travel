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
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reisroute',
  'plan.places': 'Plekken',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Notitie toevoegen',
  'plan.note.addForDay': 'Notitie aan deze dag toevoegen',
  'plan.note.showMore': 'Meer tonen',
  'plan.note.showLess': 'Minder tonen',
  'plan.note.moveUp': 'Omhoog verplaatsen',
  'plan.note.moveDown': 'Omlaag verplaatsen',
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
  'plan.note.error.move': 'Die verplaatsing is niet opgeslagen',
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
} satisfies TranslationOf<typeof En>

export default messages
