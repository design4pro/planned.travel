/**
 * The trip tabs' own copy, in de.
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
  'error.trip': 'Diese Reise konnte nicht geladen werden',
  'error.plan': 'Der Reiseverlauf konnte nicht geladen werden',
  'error.costs': 'Die Kosten konnten nicht geladen werden',
  'error.collab': 'Die Unterhaltung konnte nicht geladen werden',
  'error.book': 'Die Buchungen konnten nicht geladen werden',
  'error.transports': 'Die Transfers konnten nicht geladen werden',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reiseverlauf',
  'plan.places': 'Orte',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Notiz hinzufügen',
  'plan.note.addForDay': 'Notiz hinzufügen: {day}',
  'plan.note.showMore': 'Mehr anzeigen',
  'plan.note.showLess': 'Weniger anzeigen',
  'plan.note.moveUp': 'Nach oben',
  'plan.note.moveDown': 'Nach unten',
  'plan.note.edit': 'Notiz bearbeiten',
  'plan.note.delete': 'Notiz löschen',
  /* ----------------------------------------------------- the note editor */
  'plan.note.dialog.createTitle': 'Notiz hinzufügen',
  'plan.note.dialog.editTitle': 'Notiz bearbeiten',
  'plan.note.field.body': 'Notiz',
  'plan.note.field.bodyHint': 'Eine Zeile. Das zeigt der Tag an.',
  'plan.note.field.detail': 'Einzelheiten',
  'plan.note.field.detailHint':
    'Überschriften, Listen, Links, Zitate, Code und Tabellen.',
  'plan.note.field.time': 'Uhrzeit',
  'plan.note.field.timeHint': 'Optional, im 24-Stunden-Format.',
  'plan.note.field.icon': 'Symbol',
  'plan.note.tab.write': 'Schreiben',
  'plan.note.tab.preview': 'Vorschau',
  'plan.note.previewEmpty': 'Noch nichts für die Vorschau',
  'plan.note.save': 'Notiz speichern',
  'plan.note.cancel': 'Abbrechen',
  'plan.note.confirmDelete': 'Diese Notiz löschen?',
  'plan.note.confirmDeleteBody':
    'Die Notiz und ihre Einzelheiten verschwinden von diesem Tag.',
  /* --------------------------------------------- what happened to a note */
  'plan.note.toast.created': 'Notiz hinzugefügt',
  'plan.note.toast.updated': 'Notiz gespeichert',
  'plan.note.toast.deleted': 'Notiz gelöscht',
  'plan.note.error.save': 'Die Notiz wurde nicht gespeichert',
  'plan.note.error.delete': 'Die Notiz wurde nicht gelöscht',
  'plan.note.error.move': 'Das Verschieben wurde nicht gespeichert',
  'plan.note.error.retry': 'Versuch es gleich noch einmal.',
  /* ------------------------------------------------- the icon vocabulary */
  'plan.note.icon.alarmClock': 'Erinnerung',
  'plan.note.icon.clock': 'Uhrzeit',
  'plan.note.icon.flashlight': 'Taschenlampe',
  'plan.note.icon.footprints': 'Zu Fuß',
  'plan.note.icon.info': 'Hinweis',
  'plan.note.icon.luggage': 'Gepäck',
  'plan.note.icon.package': 'Paket',
  'plan.note.icon.ticket': 'Tickets',
  'plan.note.icon.trainFront': 'Zug',
  'plan.note.icon.wifi': 'WLAN',
  'plan.note.icon.stickyNote': 'Notiz',
  'plan.note.icon.utensils': 'Essen',
  'plan.note.icon.bus': 'Verkehrsmittel',
  'plan.note.icon.bedDouble': 'Übernachtung',
  'plan.note.icon.camera': 'Foto',
  'plan.note.icon.mapPin': 'Ort',
  'plan.note.icon.wallet': 'Geld',
  'plan.note.icon.umbrella': 'Regen',
  'plan.note.icon.triangleAlert': 'Warnung',
  /* ---------------------------------------------------- the collab tab */
  'collab.title': 'Gemeinsam',
  'collab.empty': 'Noch nichts geteilt',
  'collab.conversation': 'Unterhaltung',
  'collab.count.messages': {
    one: '{messages} Nachricht',
    other: '{messages} Nachrichten',
  },
  'collab.count.notes': {
    one: '{notes} Notiz',
    other: '{notes} Notizen',
  },
  'collab.count.polls': {
    one: '{polls} Umfrage',
    other: '{polls} Umfragen',
  },
  /* -------------------------------------------------- the bookings tab */
  'book.title': 'Buchungen',
  'book.empty': 'Noch nichts gebucht',
  'book.count.bookings': {
    one: '{bookings} Buchung',
    other: '{bookings} Buchungen',
  },
  'book.count.confirmed': {
    one: '{confirmed} bestätigt',
    other: '{confirmed} bestätigt',
  },
  'book.progressLabel': {
    one: '{confirmed} von {total} Buchung bestätigt',
    other: '{confirmed} von {total} Buchungen bestätigt',
  },
  'book.ofTotal': 'von {total}',
  'book.confirmed': 'Bestätigt',
  'book.awaiting': 'Wartet auf Bestätigung',
  'book.nothingHanging': 'Nichts offen',
  'book.chase': 'Kläre das vor dem Abflug',
  'book.committed': 'Festgelegt',
  'book.committedCaption': 'Über alle Buchungen dieser Reise',
  'book.onItinerary': 'Im Reiseverlauf',
  'book.pinnedCaption': 'An einen Tag des Plans geheftet',
  /* ---------------------------------------------- the transports tab */
  'transports.title': 'Transfers',
  'transports.empty': 'Noch nichts erfasst',
  'transports.count.transports': {
    one: '{transports} Transfer',
    other: '{transports} Transfers',
  },
  'transports.distance': 'Zurückgelegte Strecke',
  'transports.equator': '≈ {times}× um den Äquator',
  'transports.noGrouping': 'Noch nichts gruppiert',
  'transports.mostly': 'meist {mode}',
  'transports.confirmed': 'Bestätigt',
  'transports.stillPending': {
    one: '{pending} steht noch aus',
    other: '{pending} stehen noch aus',
  },
  'transports.spent': 'Für die Reise ausgegeben',
  'transports.noPrices': 'Keine Preise erfasst',
  'transports.priced': {
    one: 'über {priced} Transfer mit Preis',
    other: 'über {priced} Transfers mit Preis',
  },
} satisfies TranslationOf<typeof En>

export default messages
