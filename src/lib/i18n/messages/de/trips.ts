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
  'error.people': 'Die Personen konnten nicht geladen werden',
  /* ------------------------------------------------- the itinerary tab */
  'plan.title': 'Reiseverlauf',
  'plan.places': 'Orte',
  'plan.readOnly.archived':
    'Diese Reise ist archiviert, der Plan ist daher schreibgeschützt.',
  'plan.readOnly.role':
    'Du kannst diesen Plan lesen. Ändern können ihn nur der Inhaber der Reise und die Bearbeiter.',
  'plan.day.empty':
    'Noch nichts geplant – zieh einen Ort oder eine Notiz hierher',
  'plan.move.refused.duplicate': '{name} ist an diesem Tag schon vorhanden',
  'plan.move.refused.duplicateBody':
    'Ein Ort kann pro Tag nur einmal vorkommen. Verschiebe ihn stattdessen auf einen anderen Tag.',
  'plan.move.refused.notInIdeas': 'Eine Notiz bleibt im Tag',
  'plan.move.refused.notInIdeasBody':
    'Ideen sind Orte, die auf einen Tag warten. Eine Notiz gehört zu dem Tag, für den sie geschrieben wurde.',
  'plan.move.refused.notInAnotherDay': 'Eine Notiz bleibt an ihrem Tag',
  'plan.move.refused.notInAnotherDayBody':
    'Notizen lassen sich noch nicht zwischen Tagen verschieben. Bearbeite die Notiz, oder schreib sie am anderen Tag.',
  'plan.move.refused.journeyNotInIdeas': 'Ein Transfer bleibt im Tag',
  'plan.move.refused.journeyNotInIdeasBody':
    'Ideen sind Orte, die auf einen Tag warten. Ein Transfer gehört zu dem Tag, an dem er stattfindet.',
  'plan.move.refused.journeyNotInAnotherDay':
    'Ein Transfer bleibt an seinem Tag',
  'plan.move.refused.journeyNotInAnotherDayBody':
    'Der Tag eines Transfers ergibt sich aus seinen Daten. Ändere sie im Tab Transfers.',
  'plan.move.refused.journeyTimed': '{name} fährt um {time}',
  'plan.move.refused.journeyTimedBody':
    'Eine Abfahrtszeit gehört zum Fahrplan, nicht zum Plan. Setz den Transfer dorthin, wo seine Uhr ihn hinstellt.',
  'plan.move.spoken.duplicate':
    '{name} wurde nicht verschoben. Dieser Tag hat den Ort schon.',
  'plan.move.spoken.notInIdeas':
    '{name} wurde nicht verschoben. Eine Notiz bleibt im Tag.',
  'plan.move.spoken.notInAnotherDay':
    '{name} wurde nicht verschoben. Eine Notiz bleibt an ihrem Tag.',
  'plan.move.spoken.timed':
    '{name} trägt {time}. Wir fragen, ob die Zeit entfallen soll.',
  'plan.move.spoken.journeyNotInIdeas':
    '{name} wurde nicht verschoben. Ein Transfer bleibt im Tag.',
  'plan.move.spoken.journeyNotInAnotherDay':
    '{name} wurde nicht verschoben. Ein Transfer bleibt an seinem Tag.',
  'plan.move.spoken.journeyTimed':
    '{name} wurde nicht verschoben. Abfahrt um {time}.',
  'plan.move.error.save': 'Das Verschieben wurde nicht gespeichert',
  'plan.move.error.retry': 'Versuch es gleich noch einmal.',
  'plan.move.dropTime.title': '{name} verschieben und {time} entfernen?',
  'plan.move.dropTime.body':
    'Diese Position widerspricht der Zeit darauf. Ein Verschieben hierher löscht die Zeit — die neue Reihenfolge und die gelöschte Zeit werden zusammen gespeichert.',
  'plan.move.dropTime.confirm': 'Verschieben und Zeit entfernen',
  'plan.move.dropTime.cancel': 'So lassen',
  /* --------------------------------------------------- a day's own notes */
  'plan.note.add': 'Notiz hinzufügen',
  'plan.note.addForDay': 'Notiz hinzufügen: {day}',
  'plan.addPlace.label': 'Ort hinzufügen',
  'plan.addPlace.more': 'Weitere Wege, einen Ort hinzuzufügen',
  'plan.addPlace.option.map': 'Auf der Karte platzieren',
  'plan.addPlace.forDay': 'Ort zu diesem Tag hinzufügen',
  'plan.addPlace.forDayNamed': 'Ort hinzufügen: {day}',
  'plan.stay.checkIn': 'Anreise',
  'plan.stay.checkOut': 'Abreise',
  'plan.day.addStay': 'Unterkunft hinzufügen: {day}',
  'plan.day.addStayShort': 'Unterkunft hinzufügen',
  'plan.drop.hint':
    'Klick mit der rechten Maustaste auf die Karte oder halte sie gedrückt, um genau dort einen Ort hinzuzufügen.',
  'plan.drop.armed':
    'Klick auf die Karte, wo er hingehört, oder verschieb die Karte und drück die Eingabetaste, um ihn in der Mitte abzulegen.',
  'plan.drop.stop': 'Platzieren der neuen Stecknadel beenden',
  'plan.drop.pin': 'Neuer Ort',
  'plan.drop.lookingUp': 'Adresse wird gesucht…',
  'plan.drop.error':
    'Die Stecknadel konnte nicht gesetzt werden. Versuch es gleich noch einmal.',
  'plan.place.pastedPosition': 'Gelesen als Breite {lat}, Länge {lng}',
  'plan.note.showMore': 'Mehr anzeigen',
  'plan.note.showLess': 'Weniger anzeigen',
  'plan.note.moveUp': 'Nach oben',
  'plan.note.moveDown': 'Nach unten',
  'plan.note.drag': 'Notiz umsortieren',
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
  'plan.transport.phase.flight.departing': 'Abflug',
  'plan.transport.phase.flight.travelling': 'In der Luft',
  'plan.transport.phase.flight.arriving': 'Landung',
  'plan.transport.phase.hire.departing': 'Abholung',
  'plan.transport.phase.hire.travelling': 'Gemietet',
  'plan.transport.phase.hire.arriving': 'Rückgabe',
  'plan.transport.phase.journey.departing': 'Start',
  'plan.transport.phase.journey.travelling': 'Unterwegs',
  'plan.transport.phase.journey.arriving': 'Ende',
  'plan.transport.label': 'Von {from} nach {to}',
  'plan.transport.drag': 'Umsortieren: {journey}',
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
  'people.title': 'Personen',
  'people.description': 'Wer auf dieser Reise ist und wer sie finden kann',
  'people.members.title': 'Auf dieser Reise',
  'people.members.empty':
    'Niemand von dieser Reise ist noch in diesem Arbeitsbereich',
  'people.role.label': 'Rolle',
  'people.role.owner': 'Inhaber',
  'people.role.editor': 'Bearbeiter',
  'people.role.viewer': 'Betrachter',
  'people.you': 'Du',
  'people.owner.hint': 'Eine Reise behält immer mindestens einen Inhaber',
  'people.remove.action': '{name} von dieser Reise entfernen',
  'people.remove.title': '{name} von dieser Reise entfernen?',
  'people.remove.body':
    'Der Zugriff auf den Reiseverlauf endet sofort. Was hinzugefügt wurde, bleibt auf der Reise.',
  'people.remove.confirm': 'Entfernen',
  'people.leave.action': 'Diese Reise verlassen',
  'people.leave.title': 'Diese Reise verlassen?',
  'people.leave.body':
    'Du verlierst den Zugriff auf den Reiseverlauf, bis dich jemand von der Reise wieder hinzufügt.',
  'people.leave.confirm': 'Verlassen',
  'people.cancel': 'Abbrechen',
  'people.invite.title': 'Jemanden hinzufügen',
  'people.invite.placeholder':
    'Die Personen in diesem Arbeitsbereich durchsuchen',
  'people.invite.action': 'Zur Reise hinzufügen',
  'people.invite.role': 'Kommt dazu als',
  'people.invite.empty':
    'Alle in diesem Arbeitsbereich sind schon auf dieser Reise',
  'people.invite.emptyHint':
    'Erst kommt jemand Neues in den Arbeitsbereich, in den Einstellungen',
  'people.visibility.title': 'Wer diese Reise finden kann',
  'people.visibility.switch': 'Für alle im Arbeitsbereich sichtbar',
  'people.visibility.private':
    'Nur die hier aufgeführten Personen sehen diese Reise',
  'people.visibility.organization':
    'Alle in diesem Arbeitsbereich können diese Reise öffnen',
  'people.visibility.public':
    'Diese Reise ist über einen öffentlichen Link geteilt',
  'people.error.lastOwner':
    'Eine Reise behält mindestens einen Inhaber. Mach zuerst jemand anderen zum Inhaber.',
  'people.error.notInWorkspace':
    'Diese Person ist nicht in diesem Arbeitsbereich',
  'people.error.alreadyOnTrip': 'Diese Person ist schon auf dieser Reise',
  'people.guests.title': 'Reisen mit dir',
  'people.guests.description':
    'Personen auf dieser Reise, die kein Konto haben',
  'people.guests.empty': 'Noch niemand',
  'people.guests.emptyHint':
    'Ein Gast reist mit dir und braucht kein Konto. Füge ihn mit seinem Namen hinzu.',
  'people.guest.badge': 'Gast',
  'people.guest.add.label': 'Name',
  'people.guest.add.placeholder': 'Lena',
  'people.guest.add.action': 'Gast hinzufügen',
  'people.guest.rename.action': '{name} umbenennen',
  'people.guest.rename.title': '{name} umbenennen',
  'people.guest.rename.confirm': 'Umbenennen',
  'people.guest.remove.action': '{name} von dieser Reise entfernen',
  'people.guest.remove.title': '{name} von dieser Reise entfernen?',
  'people.guest.remove.body':
    'Der Gast wird entfernt. Sonst ändert sich nichts an der Reise.',
  'people.guest.remove.confirm': 'Entfernen',
  'people.guest.merge.action': '{name} ist jetzt…',
  'people.guest.merge.title':
    '{name} ist jetzt eine der Personen auf dieser Reise',
  'people.guest.merge.body':
    'Alles, was {name} zugewiesen ist, geht an die gewählte Person über, und der Gast wird entfernt. Das lässt sich nicht rückgängig machen.',
  'people.guest.merge.inherits':
    '{member} übernimmt alles, was {name} zugeordnet ist.',
  'people.guest.merge.placeholder': 'Wähle jemanden auf dieser Reise',
  'people.guest.merge.confirm': 'Zusammenführen',
  'people.guest.merge.done': '{name} ist jetzt {member}',
  'people.guest.merge.nothingMoved': 'Diesem Gast war noch nichts zugewiesen',
  'people.error.guestNameTaken':
    'Ein Gast namens {name} ist bereits auf dieser Reise',
  'people.error.guestLimit':
    'Eine Reise fasst höchstens {limit} Gäste, weil eine längere Liste die Teilnehmerauswahl und die Kostenaufteilung schwer lesbar macht',
  'people.error.guestMergeTarget':
    'Wähle jemanden, der bereits auf dieser Reise ist',
} satisfies TranslationOf<typeof En>

export default messages
