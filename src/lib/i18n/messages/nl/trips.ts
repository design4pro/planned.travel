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
  'plan.day.empty': 'Nog niets gepland — sleep hier een plek of een notitie naartoe',
  'plan.move.refused.duplicate': '{name} staat al op die dag',
  'plan.move.refused.duplicateBody': 'Een plek kan maar één keer per dag voorkomen. Verplaats hem naar een andere dag.',
  'plan.move.refused.notInIdeas': 'Een notitie blijft in de dag',
  'plan.move.refused.notInIdeasBody': 'Ideeën zijn plekken die op een dag wachten. Een notitie hoort bij de dag waarvoor ze is geschreven.',
  'plan.move.refused.notInAnotherDay': 'Een notitie blijft op haar eigen dag',
  'plan.move.refused.notInAnotherDayBody': 'Notities kunnen nog niet naar een andere dag. Bewerk de notitie, of schrijf haar op de andere dag.',
  'plan.move.spoken.duplicate': '{name} is niet verplaatst. Die dag heeft hem al.',
  'plan.move.spoken.notInIdeas': '{name} is niet verplaatst. Een notitie blijft in de dag.',
  'plan.move.spoken.notInAnotherDay': '{name} is niet verplaatst. Een notitie blijft op haar eigen dag.',
  'plan.move.spoken.timed': '{name} heeft {time}. We vragen of die tijd mag vervallen.',
  'plan.move.error.save': 'Die verplaatsing is niet opgeslagen',
  'plan.move.error.retry': 'Probeer het zo meteen opnieuw.',
  'plan.move.dropTime.title': '{name} verplaatsen en {time} laten vervallen?',
  'plan.move.dropTime.body': 'Deze plek spreekt de tijd erop tegen. Hierheen verplaatsen wist de tijd — de nieuwe volgorde en de gewiste tijd worden samen opgeslagen.',
  'plan.move.dropTime.confirm': 'Verplaatsen en tijd wissen',
  'plan.move.dropTime.cancel': 'Laat staan waar het staat',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Notitie toevoegen',
  'plan.note.addForDay': 'Notitie toevoegen: {day}',
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
