/**
 * The trip modules' own copy, in de.
 *
 * Authored from `../en/modules.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`. **Typografie.** Deutsch zitiert mit „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/modules'

const messages = {
  /* -------------------------------------------- shared by every module */
  'value.notSet': 'Nicht gesetzt',
  /* ----------------------------------------- the realtime presence bar */
  'presence.connecting.title': 'Verbindet',
  'presence.connecting.body': 'Wir betreten den Live-Raum dieser Reise.',
  'presence.live.title': 'Direkt',
  'presence.live.body':
    'Nachrichten, Notizen und Stimmen erscheinen hier, sobald sie entstehen.',
  'presence.reconnecting.title': 'Verbindet neu',
  'presence.reconnecting.body':
    'Die Verbindung ist abgebrochen. Wir versuchen es erneut — alles, was du sendest, wird trotzdem gespeichert.',
  'presence.offline.title': 'Nicht live',
  'presence.offline.body':
    'Live-Aktualisierungen sind aus. Gespeichert wird weiterhin; lade neu oder versuche es erneut, um aufzuholen.',
  'presence.reconnect': 'Neu verbinden',
  /* ------------------------------------------- the transports timeline */
  'transports.filter.all': 'Alle Transfers',
  'transports.empty.title': 'Noch keine Transfers',
  'transports.empty.body':
    'Flüge, Züge, Fähren und die Fahrt vom Flughafen wohnen hier, mit Buchungscodes und Sitzplatznummern zur Hand am Reisetag — und jeder Übergang gegen den vorherigen geprüft.',
  'transports.empty.action': 'Ersten Transfer hinzufügen',
  'transports.filtered.title': 'Keine Transfers dieser Art',
  'transports.filtered.body':
    'Jeder Transfer dieser Reise nutzt ein anderes Verkehrsmittel. Wechsle zurück zu „{label}“, um alle zu sehen.',
  'transports.filtered.action': 'Alle Transfers zeigen',
  'transports.alert.impossible.title': {
    one: 'Ein Übergang ist nicht machbar',
    other: '{value} Übergänge sind nicht machbar',
  },
  'transports.alert.impossible.body':
    'Ein Transfer fährt ab, bevor der vorherige ankommt. Die Knoten unten sagen, welche und um wie viel.',
  'transports.alert.tight.title': {
    one: 'Ein Übergang ist knapp',
    other: '{value} Übergänge sind knapp',
  },
  'transports.alert.tight.body':
    'Zeit ist da, aber nicht viel für das Verkehrsmittel, das du erwischen willst. Die Knoten unten zeigen, wie viel jeder lässt.',
  'transports.badge.impossible': {
    one: '{value} gebrochener Übergang',
    other: '{value} gebrochene Übergänge',
  },
  'transports.badge.tight': {
    one: '{value} knapper Übergang',
    other: '{value} knappe Übergänge',
  },
  'transports.badge.ok': 'Jeder Übergang passt',
  'transports.remove.body':
    'Der Transfer verlässt diese Reise endgültig, samt Buchungsnummer und Sitzplatz. Wenn er nur abgesagt ist, setze seinen Status stattdessen auf Abgesagt.',
  'transports.remove.confirm': 'Transfer entfernen',
  'transports.menu.edit': 'Transfer bearbeiten…',
  'transports.field.service': 'Verbindung',
  'transports.field.bookingRef': 'Buchungsnummer',
  'transports.field.seat': 'Sitzplatz',
  'transports.field.distance': 'Entfernung',
  'transports.noTime': 'Noch keine Uhrzeit',
  'transports.toast.statusFailed.title': 'Der Status hat sich nicht geändert',
  'transports.toast.statusFailed.body':
    'Der Transfer steht noch auf seinem vorherigen Stand.',
  'transports.toast.removed': 'Transfer entfernt',
  'transports.toast.removeFailed': 'Der Transfer wurde nicht entfernt',

  /* --------------------------------------- the transport dialog */
  'transports.dialog.addTitle': 'Transfer hinzufügen',
  'transports.dialog.editTitle': 'Diesen Transfer bearbeiten',
  'transports.dialog.description':
    'Flüge, Züge, Fähren und die Fahrt vom Flughafen. Die Zeiten sind die lokalen, die auf dem Ticket stehen.',
  'transports.form.modeLegend': 'Womit reist du',
  'transports.form.timingError': 'Prüfe die Zeiten',
  'transports.field.namePlaceholder': 'Lufthansa von FRA nach HND',
  'transports.field.place': 'Ort',
  'transports.field.code': 'Kürzel',
  'transports.field.date': 'Datum',
  'transports.field.time': 'Abfahrt ab',
  'transports.field.departurePlaceholder': 'Frankfurt Flughafen',
  'transports.field.arrivalPlaceholder': 'Tokio Haneda',
  'transports.field.carrier': 'Anbieter',
  'transports.field.serviceNumber': 'Verbindungsnummer',
  'transports.field.bookingRefHint':
    'Der Code, den du am Schalter vorlesen wirst.',
  'transports.field.notesPlaceholder':
    'Gangplatz gewünscht. Gepäck bis Kyoto durchgecheckt.',
  'transports.action.add': 'Transfer hinzufügen',
  'transports.action.save': 'Transfer speichern',
  'transports.action.saving': 'Transfer wird gespeichert',
  'transports.toast.added': 'Transfer hinzugefügt',
  'transports.toast.addedBody': 'Sie steht jetzt in der Reisefolge.',
  'transports.toast.addFailed': 'Der Transfer wurde nicht hinzugefügt',
  'transports.toast.updated': 'Transfer aktualisiert',
  'transports.toast.updateFailed': 'Der Transfer wurde nicht aktualisiert',

  /* ------------------------------- shared labels and the bookings timeline */
  'field.name': 'Bezeichnung',
  'field.time': 'Uhrzeit',
  'field.price': 'Preis',
  'field.notes': 'Notizen',
  'field.status': 'Zustand',
  'form.saveError': 'Das wurde nicht gespeichert',
  'action.cancel': 'Abbrechen',
  'action.showCode': '{label} anzeigen',
  'book.status.none': 'Ohne Zustand',
  'book.status.pending': 'Offen',
  'book.status.confirmed': 'Bestätigt',
  'book.status.completed': 'Erledigt',
  'book.status.cancelled': 'Abgesagt',
  'book.toast.statusFailed': 'Der Zustand hat sich nicht geändert',
  'book.toast.statusFailedBody':
    'Die Buchung steht noch auf ihrem vorherigen Stand.',
  'book.toast.removed': 'Buchung entfernt',
  'book.toast.removeFailed': 'Die Buchung wurde nicht entfernt',
  'book.empty.title': 'Noch nichts gebucht',
  'book.empty.body':
    'Unterkünfte, Tische, Touren und Tickets gehören hierher — mit der Bestätigungsnummer dort, wo du sie an der Tür findest, und dem Datum, das sie auf die Zeitachse setzt.',
  'book.empty.action': 'Erste Buchung hinzufügen',
  'book.filtered.title': 'Noch nichts dieser Art',
  'book.filtered.body':
    'Von den gewählten Arten ist hier nichts gebucht. Setze den Filter zurück, um den Rest des Schalters zu sehen.',
  'book.filtered.action': 'Filter zurücksetzen',
  'book.panel.outstanding': 'Noch zu klären',
  'book.panel.outstandingEmpty': 'Nichts offen — alles hier ist geklärt.',
  'book.panel.settled': 'Geklärt',
  'book.panel.settledEmpty':
    'Noch nichts geklärt — alles ist noch nachzuhalten.',
  'book.import.badge': 'Ungeprüfter Import',
  'book.import.hint':
    'Aus einer Bestätigung importiert. Öffne und speichere sie, um sie als geprüft zu markieren.',
  'book.import.action': 'Importieren',
  'book.import.title': 'Buchungen aus einer Datei importieren',
  'book.import.description':
    'Leg eine Bestätigung ab, wir lesen sie. Bis du sie gesehen hast, kommt nichts in die Reise.',
  'book.import.drop.idle': 'Dateien hier ablegen oder aussuchen',
  'book.import.drop.active': 'Loslassen zum Hinzufügen',
  'book.import.drop.formats':
    'PDF, gespeicherte E-Mail, Webseite, Foto, Word, Excel, Kalenderdatei oder JSON-Export.',
  'book.import.drop.limits':
    'Bis zu {files} Dateien auf einmal, jede bis {size}.',
  'book.import.drop.browse': 'Dateien aussuchen',
  'book.import.refused.format':
    '„{filename}“ ist keine Datei, die dieser Import lesen kann. Er liest ein PDF, eine gespeicherte E-Mail, eine Webseite, ein Foto, ein Word- oder Excel-Dokument, eine Kalenderdatei oder einen JSON-Export.',
  'book.import.refused.tooMany':
    'Nur {files} Dateien auf einmal. Der Rest kam nicht dazu.',
  'book.import.refused.tooLarge':
    '„{filename}“ hat {size}. Ein Import liest Dateien bis {limit}.',
  'book.import.refused.empty':
    '„{filename}“ ist leer, da ist also nichts zu lesen.',
  'book.import.ceiling.title':
    'Dieser Arbeitsbereich hat diesen Monat alle Bestätigungen gelesen',
  'book.import.ceiling.body':
    'Der Tarif enthält {ceiling} gelesene Dateien im Monat, und das Guthaben erneuert sich am Ersten. Eine Buchung von Hand geht weiterhin.',
  'book.import.ceiling.none':
    'Eine Bestätigungsdatei lesen gehört nicht zum Tarif dieses Arbeitsbereichs',
  'book.import.ceiling.noneBody':
    'Wechsle den Tarif, damit eine Bestätigung für dich gelesen wird. Eine Buchung von Hand gibt es immer.',
  'book.import.widget.title': 'Bestätigungen werden gelesen',
  'book.import.widget.working': '{done} von {total} gelesen',
  'book.import.widget.file': '„{filename}“ wird gelesen',
  'book.import.widget.done': {
    one: 'Eine Buchung wartet auf dich',
    other: '{count} Buchungen warten auf dich',
  },
  'book.import.widget.review': 'Ansehen',
  'book.import.widget.failed': '„{filename}“ war nicht lesbar',
  'book.import.widget.stalled': 'Das dauert länger als gedacht',
  'book.import.widget.check': 'Nochmal nachsehen',
  'book.import.widget.dismiss': 'Ausblenden',
  'book.import.review.title': 'Was wir gelesen haben',
  'book.import.review.from': 'Aus „{filename}“',
  'book.import.review.selectAll': 'Alle auswählen',
  'book.import.review.selectNone': 'Keine auswählen',
  'book.import.review.confirm': {
    one: '{count} Buchung hinzufügen',
    other: '{count} Buchungen hinzufügen',
  },
  'book.import.review.confirmNone': 'Wähle eine Buchung zum Hinzufügen',
  'book.import.review.cancel': 'Abbrechen',
  'book.import.review.needsReview': 'Kurz prüfen',
  'book.import.review.needsReviewHint':
    'Ein paar Felder standen nicht im Dokument. Öffne die Buchung, nachdem du sie hinzugefügt hast.',
  'book.import.review.noPrice': 'Kein Preis gelesen',
  'book.import.review.noPriceHint':
    'Das Dokument nannte keinen klar, also blieb das Feld leer statt geraten.',
  'book.import.review.untitled': 'Buchung ohne Titel',
  'book.import.empty.title': 'In dieser Datei haben wir keine Buchung gefunden',
  'book.import.empty.body':
    'In „{filename}“ war nichts, was nach einer Bestätigung aussieht. Versuch eine andere Datei, oder trag die Buchung von Hand ein.',
  'book.import.failed.title': '„{filename}“ war nicht lesbar',
  'book.import.failed.body':
    'Die Datei ging auf, aber es war nichts daraus zu machen. Versuch eine andere Datei, oder trag die Buchung von Hand ein.',
  'book.import.failed.retry': 'Andere Datei versuchen',
  'book.import.uploadFailed': '„{filename}“ wurde nicht hochgeladen',
  'book.import.uploadRetry': 'Nochmal versuchen',
  'book.import.actionFailed': 'Versuche es gleich noch einmal.',
  'book.import.toast.added': {
    one: 'Eine Buchung hinzugefügt',
    other: '{count} Buchungen hinzugefügt',
  },
  'book.import.partial.title':
    '{written} von {total} Buchungen wurden hinzugefügt',
  'book.import.partial.body':
    'Der Rest bleibt ausgewählt. Ein zweiter Versuch schreibt nur den.',
  'book.import.partial.retry': 'Rest hinzufügen',
  'book.journeyLink': 'Im Transport-Tab',
  'filter.all': 'Alles',
  'book.remove.body':
    'Sie verschwindet endgültig von der Zeitachse. Wenn sie nur abgesagt ist, setze ihren Zustand stattdessen auf Abgesagt, damit der Eintrag bleibt.',
  'book.remove.confirm': 'Buchung entfernen',
  'book.menu.edit': 'Buchung bearbeiten…',
  'book.menu.open': 'Buchung öffnen',
  'book.noDate': 'Noch kein Datum',
  'book.until': 'Bis',
  'book.provider': 'Anbieter',
  'book.where': 'Wo',
  'book.guests': 'Personen',
  'book.confirmation': 'Bestätigung',
  'book.undated': 'Gib ihnen ein Datum und sie kommen auf die Zeitachse',
  statusOf: 'Zustand von {title}',

  /* ------------------------------------------- the booking dialog */
  'book.statusChoice.none': 'Noch ohne Zustand',
  'book.statusChoice.pending': 'Offen — wir warten auf sie',
  'book.dialog.addTitle': 'Buchung hinzufügen',
  'book.dialog.editTitle': 'Diese Buchung bearbeiten',
  'book.dialog.typeLegend': 'Was für eine Buchung',
  'book.field.namePlaceholder': 'Friedrichstraße 43',
  'book.field.priceHint': 'Leer lassen, wenn noch nicht abgerechnet.',
  'book.field.confirmation': 'Bestätigungsnummer',
  'book.field.confirmationHint': 'Der Code, nach dem am Schalter gefragt wird.',
  'book.field.day': 'Einem Tag zuordnen',
  'book.field.dayHint':
    'Heftet sie an den Reiseverlauf, damit sie im Plan auftaucht.',
  'book.field.noDay': 'Nicht im Reiseverlauf',
  'book.field.link': 'Verweis',
  'book.field.notesPlaceholder':
    'Späte Anreise vereinbart. Um ein Zimmer weg vom Aufzug bitten.',
  'book.action.add': 'Buchung hinzufügen',
  'book.action.save': 'Buchung speichern',
  'book.action.saving': 'Buchung wird gespeichert',
  'book.toast.added': 'Buchung hinzugefügt',
  'book.toast.addedBody': 'Sie steht jetzt auf der Zeitachse.',
  'book.toast.addFailed': 'Die Buchung wurde nicht hinzugefügt',
  'book.toast.updated': 'Buchung aktualisiert',
  'book.toast.updateFailed': 'Die Buchung wurde nicht aktualisiert',

  'book.emptyFacts':
    'Außer dem Namen ist noch nichts erfasst. Öffne es, um Uhrzeit, Preis und Bestätigungsnummer zu ergänzen.',
  'book.onItinerary': 'Im Reiseverlauf: {day}',
  'book.dayNumber': 'Tag {n}',

  /* ------------------------------ the booking type table, per type */
  'book.shape.other.label': 'Sonstiges',
  'book.field.host': 'Hotel oder Gastgeber',
  'book.field.restaurant': 'Lokal',
  'book.field.operator': 'Veranstalter',
  'book.field.issuer': 'Ausgestellt von',
  'book.field.carrier': 'Verkehrsunternehmen',
  'book.field.address': 'Adresse',
  'book.field.meetingPoint': 'Treffpunkt',
  'book.field.venue': 'Veranstaltungsort',
  'book.field.fromTo': 'Von und nach',
  'book.field.checkIn': 'Anreise',
  'book.field.date': 'Datum',
  'book.field.validOn': 'Gültig am',
  'book.field.departs': 'Abfahrt',
  'book.field.checkOut': 'Abreise',
  'book.field.ends': 'Endet',
  'book.field.arrives': 'Ankunft',
  'book.example.accommodationProvider': 'Booking.com',
  'book.example.restaurantProvider': 'Den',
  'book.example.activityProvider': 'teamLab',
  'book.example.tourProvider': 'Kyoto Free Walking Tour',
  'book.example.ticketProvider': 'Ghibli-Museum',
  'book.example.transportProvider': 'JR Central',
  'book.example.otherProvider': 'Wer das für dich zurückhält',
  'book.example.accommodationTitle':
    'Hotel Gracery Shinjuku · 2 Zweibettzimmer',
  'book.example.restaurantTitle': 'Abendessen im Den',
  'book.example.activityTitle': 'teamLab Planets, 4 Tickets',
  'book.example.tourTitle': 'Spaziergang durch den Bambuswald von Arashiyama',
  'book.example.ticketTitle': 'Ghibli-Museum, Einlass 10:00',
  'book.example.transportTitle': 'Nozomi 21 nach Kyoto',
  'book.example.otherTitle': 'Was du gebucht hast',
  'book.hint.accommodation':
    'Ein Hotel, ein Ryokan, eine Wohnung — wo auch immer du schläfst.',
  'book.hint.restaurant':
    'Ein reservierter Tisch. Die Uhrzeit ist der Teil, an den du gebunden bist.',
  'book.hint.activity': 'Ein Kurs, ein Badehaus, ein gebuchtes Erlebnis.',
  'book.hint.tour': 'Ein Ort, eine Uhrzeit und eine Führung, die wartet.',
  'book.hint.ticket':
    'Ein Zeitfenster, ein Museumspass, ein Spiel. Halte den Code parat.',
  'book.hint.transport':
    'Ein gebuchter Platz. Ganze Transfers mit Codes gehören zu {module}.',
  'book.hint.other':
    'Alles, was auf deinen Namen läuft und nirgends sonst passt.',

  /* -------------------------------------- lists: the dialogs */
  'lists.kind.packing': 'Packen',
  'lists.kind.todo': 'Zu tun',
  'lists.kind.shopping': 'Einkäufe',
  'lists.kind.documents': 'Dokumente',
  'lists.kind.fallback': 'Liste',
  'colour.none': 'Keine Farbe',
  'colour.pine': 'Kiefer',
  'colour.inkBlue': 'Tintenblau',
  'colour.amber': 'Bernstein',
  'colour.green': 'Grün',
  'colour.red': 'Rot',
  'colour.slate': 'Schiefer',
  'lists.toast.created': 'Liste erstellt',
  'lists.toast.createdBody':
    'Trage das Erste ein, was du nicht vergessen darfst.',
  'lists.toast.createFailed': 'Die Liste wurde nicht erstellt',
  'lists.toast.updated': 'Liste aktualisiert',
  'lists.toast.updateFailed': 'Die Liste wurde nicht aktualisiert',
  'lists.error.weightLimit': 'Ein Gewichtslimit ist eine ganze Zahl in Gramm.',
  'lists.dialog.editTitle': 'Diese Liste bearbeiten',
  'lists.dialog.editBody':
    'Umbenennen, die Art der Liste ändern oder sie einer Person übergeben.',
  'lists.dialog.addBody':
    'Packen, Aufgaben, Einkäufe und die Dokumente, die du nicht vergessen darfst — jedes bekommt seine eigene Liste.',
  'lists.action.new': 'Neue Liste',
  'lists.field.namePlaceholder': 'Handgepäck',
  'lists.field.kind': 'Art',
  'lists.field.kindAria': 'Art der Liste',
  'lists.field.owner': 'Gehört zu',
  'lists.field.ownerHint': 'Geteilte Listen hakt jeder ab.',
  'lists.field.everyone': 'Alle auf der Reise',
  'lists.field.weightLimit': 'Gewichtslimit',
  'lists.field.weightLimitHint':
    'Gramm. Leer lassen, wenn es keine Grenze einzuhalten gibt.',
  'colour.legend': 'Farbe',
  'lists.action.saving': 'Liste wird gespeichert',
  'lists.action.save': 'Liste speichern',
  'lists.action.create': 'Liste anlegen',
  'lists.item.toast.added': 'Eintrag hinzugefügt',
  'lists.item.toast.addFailed': 'Der Eintrag wurde nicht hinzugefügt',
  'lists.item.toast.updated': 'Eintrag aktualisiert',
  'lists.item.toast.updateFailed': 'Der Eintrag wurde nicht aktualisiert',
  'lists.item.error.quantity': 'Eine Menge ist eine ganze Zahl von 1 bis 999.',
  'lists.item.error.weight': 'Ein Gewicht ist eine ganze Zahl in Gramm.',
  'lists.item.dialog.editTitle': 'Diesen Eintrag bearbeiten',
  'lists.item.dialog.addTitle': 'Eintrag hinzufügen',
  'lists.item.field.label': 'Eintrag',
  'lists.item.field.placeholder': 'Reisepass',
  'field.category': 'Kategorie',
  'lists.item.field.categoryHint':
    'Gruppiert die Liste unter einer Überschrift. Optional.',
  'lists.item.field.categoryPlaceholder': 'Dokumente',
  'lists.item.field.priority': 'Priorität',
  'lists.priorityChoice.high': 'Hoch — nicht vergessen',
  'lists.priorityChoice.low': 'Niedrig — wenn Platz ist',
  'lists.priorityChoice.normal': 'Mittel',
  'lists.item.field.quantity': 'Menge',
  'lists.item.field.weight': 'Gewicht',
  'lists.item.field.weightHint': 'Gramm, pro Stück.',
  'lists.item.field.owner': 'Wessen Aufgabe ist das',
  'lists.item.owner.nobody': 'Niemand Bestimmtes',
  'lists.item.action.saving': 'Eintrag wird gespeichert',
  'lists.item.action.save': 'Eintrag speichern',
  'lists.item.action.add': 'Zur Liste hinzufügen',
  'lists.template.loadError':
    'Die Vorlagen konnten gerade nicht geladen werden.',
  'lists.template.toast.added': 'Liste aus einer Vorlage hinzugefügt',
  'lists.template.toast.addFailed': 'Die Vorlage wurde nicht angewendet',
  'lists.template.error.apply': 'Das ließ sich nicht anwenden',
  'lists.template.error.load': 'Die Vorlagen wurden nicht geladen',
  'lists.template.empty.title': 'Noch keine Vorlagen',
  'lists.template.empty.body':
    'Speichere eine Liste als Vorlage, sobald du eine hast, die du wieder so bauen würdest — dann steht sie hier für jede künftige Reise.',
  'lists.template.applying': 'Vorlage wird angewendet',
  'lists.template.dialogTitle': 'Mit einer Vorlage beginnen',
  'lists.template.loading': 'Vorlagen werden geladen',
  'lists.template.apply': 'Vorlage anwenden',
  'lists.template.from': 'Aus einer Vorlage',

  /* ---------------------------------------- lists: the board */
  'lists.unassigned': 'Nicht zugewiesen',
  'lists.toast.listRemoved': 'Liste entfernt',
  'lists.toast.listRemoveFailed': 'Die Liste wurde nicht entfernt',
  'lists.toast.itemRemoved': 'Eintrag entfernt',
  'lists.toast.itemRemoveFailed': 'Der Eintrag wurde nicht entfernt',
  'lists.toast.reset': 'Liste zurückgesetzt',
  'lists.toast.resetBody':
    'Alles ist abgehakt zurückgesetzt und bereit für die nächste Reise.',
  'lists.toast.resetFailed': 'Die Liste wurde nicht zurückgesetzt',
  'lists.toast.tickFailed': 'Das Häkchen wurde nicht gespeichert',
  'lists.toast.tickFailedBody': 'Der Eintrag steht wieder so da wie vorher.',
  'lists.toast.assignFailed': 'Die Zuweisung wurde nicht gespeichert',
  'lists.toast.orderFailed': 'Die neue Reihenfolge wurde nicht gespeichert',
  'lists.toast.orderFailedBody': 'Die Liste steht wieder so da wie vorher.',
  'lists.filter.todo': 'Noch zu tun',
  'lists.filter.done': 'Fertig',
  'lists.scope.all': 'Alle Listen',
  'lists.scope.shared': 'Geteilt',
  'lists.scope.mine': 'Meine',
  'lists.empty.mine.title': 'Noch keine eigenen Listen',
  'lists.empty.shared.title': 'Noch keine geteilten Listen',
  'lists.empty.mine.body':
    'Eine eigene Liste hakst nur du ab — praktisch für die Dinge, die sonst niemand sehen muss.',
  'lists.empty.shared.body':
    'Eine geteilte Liste hakt jeder ab, damit nicht zwei Leute denselben Adapter einpacken.',
  'lists.remove.list': 'Liste entfernen',
  'lists.remove.item': 'Eintrag entfernen',
  'lists.remove.itemBody':
    'Er verschwindet von dieser Liste. Sonst ändert sich nichts.',
  'lists.menu.editList': 'Liste bearbeiten…',
  'lists.menu.tickAll': 'Alles abhaken',
  'lists.menu.untickAll': 'Alle Häkchen entfernen',
  'lists.menu.reset': 'Für die nächste Reise zurücksetzen',
  'lists.menu.dragOrderLong':
    'Auf eine Reihenfolge umschalten, die du ziehen kannst',
  'lists.menu.groupAgain': 'Wieder nach Kategorie gruppieren',
  'lists.menu.dragOrder': 'Auf eine ziehbare Reihenfolge umschalten',
  'lists.menu.groupByCategory': 'Nach Kategorie gruppieren',
  'lists.weight.packed': '{weight} eingepackt',
  'lists.weight.packedOver': '{weight} eingepackt — über dem Limit',
  'lists.weight.packedOf': '{weight} eingepackt von {limit} erlaubt',
  'lists.weight.packedOfOver':
    '{weight} eingepackt von {limit} erlaubt — über dem Limit',
  'lists.progress.ticked': '{done} von {total} abgehakt',
  'lists.items.empty.title': 'Diese Liste ist leer',
  'lists.items.empty.body':
    'Trage das Erste ein, was du nicht vergessen darfst — am schnellsten über das Feld darunter.',
  'lists.items.doneEmpty.title': 'Noch nichts abgehakt',
  'lists.items.doneEmpty.body': 'Hake etwas ab, dann steht es hier.',
  'lists.items.todoEmpty.title': 'Hier ist alles fertig',
  'lists.items.todoEmpty.body':
    'Jeder Eintrag auf dieser Liste ist abgehakt. Wechsle zu „{label}“, um sie zu sehen.',
  'lists.category.other': 'Alles Übrige',
  'lists.dnd.fallbackName': 'diesen Eintrag',
  'lists.dnd.picked': '{name} aufgenommen.',
  'lists.dnd.dropped':
    '{name} abgelegt. Die neue Reihenfolge wird gespeichert.',
  'lists.dnd.cancelled': 'Abgebrochen. Die Reihenfolge bleibt unverändert.',
  'lists.menu.editItem': 'Eintrag bearbeiten…',
  'lists.quickAdd.placeholder': 'Eintrag eingeben und Enter drücken',
  'lists.quickAdd.aria': 'Einen Eintrag zu dieser Liste hinzufügen',
  'lists.quickAdd.detailsHint': 'Mit Gewicht, Kategorie oder Person hinzufügen',
  'lists.quickAdd.detailsAria': 'Einen Eintrag mit allen Angaben hinzufügen',
  'lists.show': 'Anzeigen',
  'lists.priority.high': 'Hoch',
  'lists.action.add': 'Hinzufügen',

  /* ------------------------------- lists: counted in items */
  'lists.template.itemCount': {
    one: '{count} Eintrag',
    other: '{count} Einträge',
  },
  'lists.template.copiedIn': {
    one: '{count} Eintrag übernommen, bereit zum Abhaken.',
    other: '{count} Einträge übernommen, bereit zum Abhaken.',
  },
  'lists.remove.listBody': {
    one: 'Die Liste und ihr {count} Eintrag verschwinden von dieser Reise. Gespeicherte Vorlagen bleiben unberührt.',
    other:
      'Die Liste und ihre {count} Einträge verschwinden von dieser Reise. Gespeicherte Vorlagen bleiben unberührt.',
  },

  'lists.item.dialog.body':
    'Alles außer dem Namen ist optional — ein Gewicht macht die Packsumme echt, und eine Kategorie gruppiert die Liste.',
  'lists.template.dialogBody':
    'Eine Vorlage ist eine Liste, die du schon gespeichert hast. Sie anzuwenden kopiert sie als neue Liste auf diese Reise — das Original bleibt unberührt.',

  /* ------------------------ lists: names built around a row */
  'remove.confirmTitle': '„{name}“ entfernen?',
  actionsFor: 'Aktionen für {name}',
  'lists.dnd.reorder': '{name} umsortieren',
  'lists.action.untickItem': 'Häkchen bei {name} entfernen',
  'lists.action.tickOffItem': '{name} abhaken',
  'lists.item.assignAria': '{name} jemandem zuweisen',
  'lists.item.reassignAria': '{item} gehört {owner} — neu zuweisen',

  /* ------------------------------ book: what the form refuses */
  'book.error.titleEmpty':
    'Gib dieser Buchung einen Namen, den du in einer Liste wiedererkennst.',
  'error.titleLong': 'Halte den Namen unter 160 Zeichen.',
  'book.error.required': 'Dieser Buchung fehlt: {field}.',
  'book.error.timeNeedsDate':
    'Eine Uhrzeit braucht den Tag, auf den sie fällt.',
  'book.error.endTimeNeedsDate':
    'Eine Endzeit braucht den Tag, auf den sie fällt.',
  'book.error.endsBeforeStart': 'Das endet, bevor es anfängt.',
  'book.fieldName.checkInDay': 'Anreisetag',
  'book.fieldName.checkOutDay': 'Abreisetag',
  'book.stay.pickDay': 'Tag wählen',
  'book.stay.nights': {
    one: '{count} Nacht',
    other: '{count} Nächte',
  },
  'book.stay.range': '{from} bis {to}',
  'book.stay.label': 'Aufenthalt',
  'book.remove.keepsNights':
    'Die Nächte bleiben in der Reise. Nur die Buchung wird entfernt.',
  'book.menu.removeWithStay': 'Buchung und Aufenthalt entfernen',
  'book.removeStay.body':
    'Die Buchung und die Nächte, die sie bezahlt, werden beide entfernt.',
  'book.toast.stayRemoved': 'Buchung und Aufenthalt entfernt',
  'book.error.endTimeBeforeStart': 'Die Endzeit liegt vor der Startzeit.',
  'book.error.guests': 'Die Personenzahl muss eine ganze Zahl bis 1000 sein.',
  'error.price': 'Diesen Betrag können wir nicht lesen.',
  'book.error.url': 'Ein Verweis muss mit http:// oder https:// beginnen.',
  'book.error.confirmationLong':
    'Diese Bestätigungsnummer ist zu lang zum Speichern.',
  'book.error.stopGone': 'Dieser Halt gehört nicht mehr zu dieser Reise.',
  'book.ledger.unlinked':
    'Die Kostenzeile dieser Buchung bleibt in den Reisekosten, ist aber nicht mehr mit der Buchung verknüpft.',
  'book.ledger.updated':
    'Die Kostenzeile dieser Buchung wird auf {money} geändert.',
  'book.ledger.needsDate':
    'Geben Sie dieser Buchung ein Datum, dann wandern ihre Kosten in die Reisekosten.',
  'book.ledger.added':
    'Den Kosten dieser Reise wird eine Zeile über {money} hinzugefügt.',
  'book.fieldName.provider': 'Anbieter',
  'book.fieldName.location': 'Ort',
  'book.fieldName.confirmationNumber': 'Bestätigungsnummer',
  'book.fieldName.link': 'Verweis',
  'book.fieldName.date': 'Datum',
  'book.fieldName.time': 'Uhrzeit',
  'book.fieldName.endDate': 'Enddatum',
  'book.fieldName.endTime': 'Endzeit',
  'book.fieldName.guests': 'Personenzahl',
  'book.fieldName.price': 'Preis',
  'book.fieldName.stop': 'Halt',
  'book.field.stop': 'Verknüpfter Halt',
  'book.field.stopHint': 'Zu welchem Halt des Plans diese Buchung gehört.',
  'book.field.stopHintEmpty':
    'Füge erst einen Ort zu einem Tag hinzu, dann lässt sich die Buchung damit verknüpfen',
  'book.field.stopPlaceholder': 'An keinen Halt gebunden',
  'book.field.stopSearch': 'Halte und Tage durchsuchen',
  'book.field.stopEmpty': 'Kein Halt passt dazu',
  'book.ledger.refused.title':
    'Gespeichert, aber nicht zu den Kosten hinzugefügt',
  'book.ledger.refused.body':
    'Die Buchung steht auf der Reise. Ihre Kostenzeile zu den Reisekosten hinzuzufügen hat nicht geklappt — versuche diese Hälfte noch einmal.',
  'book.action.ledgerRetry': 'Zu den Kosten hinzufügen',
  'book.ledger.splitStale.title':
    'Gespeichert, aber die Aufteilung stimmt nicht mehr',
  'book.ledger.splitStale.body':
    'Die Buchung und ihr neuer Preis sind gespeichert, doch die Aufteilung dieses Kostenpostens konnte dem neuen Gesamtbetrag nicht folgen. Öffne den Posten unter Kosten und korrigiere die Aufteilung.',
  'book.action.done': 'Fertig',
  'book.copyConfirmation': 'die Bestätigungsnummer für {title}',

  /* -------------------------- transports: modes, ends, refusals */
  'transports.mode.flight': 'Flug',
  'transports.mode.train': 'Zug',
  'transports.mode.bus': 'Bus',
  'transports.mode.ferry': 'Fähre',
  'transports.mode.car': 'Auto',
  'transports.mode.taxi': 'Taxi',
  'transports.mode.transit': 'Nahverkehr',
  'transports.mode.metro': 'U-Bahn',
  'transports.mode.tram': 'Straßenbahn',
  'transports.mode.bike': 'Fahrrad',
  'transports.mode.walk': 'Zu Fuß',
  'transports.mode.other': 'Sonstiges',
  'transports.mode.fallback': 'Transfer',
  'transports.rank.earliest': 'Frühste Ankunft',
  'transports.rank.fewestChanges': 'Wenigste Umstiege',
  'transports.connection.findStop': 'Halt suchen',
  'transports.connection.findStopSearch': 'FRA, Hbf, Frankfurt…',
  'transports.connection.findStopEmpty': 'Kein Halt dieses Namens im Katalog.',
  'transports.connection.hideStops': 'Halte ausblenden',
  'transports.connection.seeStops': 'Halte anzeigen',
  'transports.connection.saving': 'Verbindung wird gespeichert',
  'transports.connection.use': 'Diese nehmen',
  'transports.connection.onFoot': 'Zu Fuß',
  'transports.connection.service': 'Fahrt',
  'transports.connection.direct': 'direkt',
  'transports.connection.changes': {
    one: '{changes} Umstieg',
    other: '{changes} Umstiege',
  },
  'transports.connection.tooLong':
    'Diese Verbindung hat mehr als {max} Etappen und damit mehr, als ein Reisesatz fasst. Suche einen kürzeren Abschnitt und trage den Rest getrennt ein.',
  'transports.connection.refusal.ceiling':
    'Diesen Monat keine Suchen mehr übrig',
  'transports.connection.refusal.unconfigured':
    'Die Verbindungssuche ist auf diesem Deployment aus',
  'transports.connection.refusal.provider':
    'Der Fahrplandienst hat nicht geantwortet',
  'transports.connection.refusal.plan':
    'Die Verbindungssuche gehört nicht zu diesem Tarif',
  'transports.connection.refusal.planBody':
    'Wechsle den Tarif, um Fahrpläne direkt aus einer Reise heraus zu durchsuchen. Eine Fahrt lässt sich weiterhin von Hand eintragen.',
  'transports.connection.refusal.ceilingBody':
    'Das Monatskontingent von {ceiling} ist aufgebraucht und erneuert sich am Ersten des nächsten Monats. Eine Fahrt lässt sich weiterhin von Hand eintragen.',
  'transports.connection.refusal.unconfiguredBody':
    'Hier ist kein Fahrplandienst eingerichtet, also wurde nichts gesucht. Trage die Fahrt von Hand ein.',
  'transports.connection.refusal.providerBody':
    'Es kam nichts zurück, das sich zeigen ließe. Versuch es gleich noch einmal oder trage die Fahrt von Hand ein.',
  'transports.connection.invitation':
    'Zwei Halte und ein Datum, und der Fahrplan antwortet. Gespeichert wird nichts, bis du eine wählst.',
  'transports.connection.empty':
    'Zwischen diesen beiden Halten wurde an dem Datum keine Verbindung gefunden. Versuche einen Nachbarbahnhof oder erweitere den Modusfilter.',
  'transports.connection.credit': 'Fahrplandaten von',
  'transports.connection.searchFailed': 'Die Suche lief nicht',
  'transports.connection.searchFailedBody': 'Versuche es gleich noch einmal.',
  'transports.connection.saved': 'Verbindung gespeichert',
  'transports.connection.replaced': 'Route ersetzt',
  'transports.connection.replacedBody':
    'Buchungscode und Sitzplatz bleiben unberührt.',
  'transports.connection.saveFailed': 'Die Verbindung wurde nicht gespeichert',
  'transports.connection.saveError': 'Das wurde nicht gespeichert',
  'transports.connection.fromHint':
    'Wähle einen Halt — ein Fahrplan wird gefragt wo, nicht wie es heißt.',
  'transports.connection.toHint': 'Wähle einen Halt aus dem Katalog.',
  'transports.connection.timeHint':
    'Ein Fahrplan antwortet mit den nächsten Abfahrten - das hier entscheidet, mit welchen.',
  'transports.connection.onlyModes': 'Nur diese Modi',
  'transports.connection.searching': 'Fahrplan wird durchsucht',
  'transports.connection.search': 'Verbindungen suchen',
  'transports.connection.title': 'Von {from} nach {to}',
  'transports.status.idea': 'Idee',
  'transports.status.pending': 'Offen',
  'transports.status.confirmed': 'Bestätigt',
  'transports.status.completed': 'Erledigt',
  'transports.status.cancelled': 'Abgesagt',
  'transports.end.fromAirport': 'Ab Flughafen',
  'transports.end.toAirport': 'Bis Flughafen',
  'transports.end.fromPort': 'Ab Hafen',
  'transports.end.toPort': 'Bis Hafen',
  'transports.end.fromStation': 'Ab Bahnhof',
  'transports.end.toStation': 'Bis Bahnhof',
  'transports.end.from': 'Von',
  'transports.end.to': 'Nach',
  'transports.end.pickUp': 'Abholung',
  'transports.end.dropOff': 'Rückgabe',
  'transports.end.departureDay': 'Abfahrtstag',
  'transports.end.arrivalDay': 'Ankunftstag',
  'transports.end.pickUpDay': 'Abholtag',
  'transports.end.returnDay': 'Rückgabetag',
  'transports.dayNumber': 'Tag {n}',
  'transports.error.titleEmpty':
    'Gib diesem Transfer einen Namen, den du in einer Liste wiedererkennst.',
  'transports.error.date': 'Ein Datum schreibt man JJJJ-MM-TT.',
  'transports.error.time':
    'Eine Uhrzeit schreibt man HH:MM im 24-Stunden-Format.',
  'transports.error.departureNeedsDate':
    'Eine Abfahrtszeit braucht den Tag, auf den sie fällt.',
  'transports.error.arrivalNeedsDate':
    'Eine Ankunftszeit braucht den Tag, auf den sie fällt.',
  'transports.error.code': 'Ein Code hat 2 bis 8 Buchstaben oder Ziffern.',
  'transports.error.distance':
    'Eine Entfernung ist eine Zahl in Kilometern, bis 100.000.',
  'transports.error.arrivesBeforeDeparts':
    'Dieser Transfer kommt an, bevor er abfährt.',
  'transports.error.timingHint':
    'Verschiebe eine der beiden Zeiten, damit der Transfer tatsächlich erreichbar ist.',
  'transports.error.arrivalDayBeforeDeparture':
    'Der Ankunftstag liegt vor dem Abfahrtstag.',
  'transports.error.returnDayBeforePickUp':
    'Der Rückgabetag liegt vor dem Abholtag.',
  'transports.field.noDay': 'Noch kein Tag',
  'transports.fill.legend': 'Wie du das ausfüllst',
  'transports.fill.manual': 'Selbst eintragen',
  'transports.fill.searchAgain': 'Erneut suchen',
  'transports.fill.search': 'Verbindungen suchen',
  'transports.chain.unsplit': 'Wieder zu einer Reise zusammenfassen',
  'transports.field.arrivalDayHint':
    'Eine Reise, die am nächsten Morgen landet, sagt das hier.',
  'transports.chain.splitHint':
    'Unterwegs umsteigen? Halte jeden Teil mit eigener Zugnummer, Gleis, Sitzplatz und Uhrzeit fest.',
  'transports.chain.split': 'In Etappen aufteilen',
  'transports.chain.stopNumber': 'Halt {n}',
  'transports.chain.change': 'Umstieg {n}',
  'transports.chain.removeStation': '{label} entfernen',
  'transports.chain.findStation': 'Flughafen oder Bahnhof suchen',
  'transports.chain.findStationFor':
    'Flughafen oder Bahnhof für {label} suchen',
  'transports.chain.findPlaceholder': 'FRA, Flughafen, Frankfurt…',
  'transports.chain.findEmpty':
    'Kein Treffer — trage den Halt unten selbst ein.',
  'transports.chain.stopLabel': 'Halt',
  'transports.chain.stopPlaceholder': 'Frankfurt Hbf',
  'transports.chain.timezoneHint': 'Nach welcher Uhr dieser Halt geht',
  'transports.chain.timezoneAt': 'Zeitzone bei {label}',
  'transports.chain.timezonePlaceholder': 'Nicht angegeben',
  'transports.chain.timezoneSearch': 'Tokio, Lissabon, UTC…',
  'transports.chain.acrossClocks': '{gap} über zwei Uhren',
  'transports.chain.addStopAfter': 'Halt nach {label} hinzufügen',
  'transports.chain.servicePlaceholder': 'ICE 599',
  'transports.chain.leaves': 'Ab {label}',
  'transports.chain.reaches': 'An {label}',
  'transports.chain.dayOfLeg': '{label} von Etappe {n}',
  'transports.chain.formError': 'Diese Kette lässt sich nicht speichern',
  'transports.chain.atCap':
    'Eine Kette fasst höchstens {max} Etappen — das begrenzt, was ein Speichern trägt, nicht wie viele Umstiege eine Reise haben darf.',
  'transports.chain.hint':
    'Füge auf einer Etappe einen Halt hinzu, um einen Zugwechsel festzuhalten; jede Etappe behält ihre eigene Zugnummer, ihr Gleis und ihren Sitzplatz.',
  'transports.field.timezone': 'Zeitzone',
  'transports.field.platform': 'Gleis',
  'transports.chain.legNumber': 'Etappe {n}',
  'transports.chain.platform': 'Gleis {value}',
  'transports.chain.seat': 'Sitzplatz {value}',
  'transports.chain.error.stopName':
    'Jeder Halt braucht einen Namen — hier steigen Sie um.',
  'transports.chain.error.stopNameLong':
    'Der Name eines Halts muss unter 200 Zeichen bleiben.',
  'transports.chain.error.timezone': 'Wählen Sie eine Zeitzone aus der Liste.',
  'transports.chain.error.tooManyLegs':
    'Eine Kette fasst höchstens {max} Abschnitte.',
  'transports.bookingRefFor': 'die Buchungsnummer für {title}',
  'transports.doorToDoor': 'Das sind {gap} von Tür zu Tür.',
  'transports.title.fromTo': '{operator} von {from} nach {to}',
  'transports.title.from': '{operator} von {from}',
  'transports.title.to': '{operator} nach {to}',

  /* ------------------ transports: whether a hand-over can be made */
  'transports.junction.unknown.headline': 'Keine Zeiten zum Vergleichen',
  'transports.junction.unknown.detail':
    'Trage bei beiden Transfers Datum und Uhrzeit ein, dann wird dieser Übergang für dich geprüft.',
  'transports.junction.impossible.headline':
    'Fährt {gap} vor der Ankunft des vorigen Transfers ab',
  'transports.junction.impossible.detail':
    '„{to}“ fährt ab, bevor „{from}“ ankommt — beide sind nicht zu erreichen. Verschiebe eine davon.',
  'transports.junction.tight.headline': '{gap} zum Umsteigen',
  'transports.junction.tight.detail':
    'Für {mode} braucht man meist etwa {required}. Das hier ist knapp.',
  'transports.junction.tight.detailAt':
    'Für {mode} braucht man in {place} meist etwa {required}. Das hier ist knapp.',
  'transports.junction.ok.headline': '{gap} dazwischen',
  'transports.junction.ok.detail':
    'Ankunft in {landing}, aber der nächste Transfer fährt von {boarding} — du musst hinüberkommen.',

  /* ------------------------------ collab: the note and poll dialogs */
  'collab.note.toast.shared': 'Notiz geteilt',
  'collab.note.toast.sharedBody': 'Alle auf der Reise sehen sie jetzt.',
  'collab.note.toast.shareFailed': 'Die Notiz wurde nicht geteilt',
  'collab.note.toast.updated': 'Notiz aktualisiert',
  'collab.note.toast.updateFailed': 'Die Notiz wurde nicht aktualisiert',
  'collab.note.dialog.editTitle': 'Diese Notiz bearbeiten',
  'collab.note.dialog.addTitle': 'Neue geteilte Notiz',
  'collab.note.dialog.body':
    'Restaurantempfehlungen, Visaregeln, der Code für die Haustür — alles, was die ganze Reise sich merken muss, an einem Ort.',
  'collab.note.field.title': 'Titel',
  'collab.note.field.titlePlaceholder': 'Haustürcode',
  'collab.note.field.body': 'Notiz',
  'collab.note.field.bodyPlaceholder':
    '4821, dann die Raute. Der Schlüsselkasten ist links von der Tür.',
  'collab.note.field.categoryHint':
    'Gruppiert das Board unter einem Filter. Optional.',
  'collab.note.field.categoryPlaceholder': 'Logistik',
  'collab.note.field.pin': 'Oben am Board anpinnen',
  'collab.note.field.pinHint':
    'Angepinnte Notizen stehen vorn, was auch dazukommt.',
  'collab.note.action.saving': 'Notiz wird gespeichert',
  'collab.note.action.save': 'Notiz speichern',
  'collab.note.action.share': 'Notiz teilen',
  'collab.poll.toast.opened': 'Abstimmung eröffnet',
  'collab.poll.toast.openedBody': 'Alle auf der Reise können jetzt abstimmen.',
  'collab.poll.toast.openFailed': 'Die Abstimmung wurde nicht eröffnet',
  'collab.poll.dialog.addTitle': 'Neue Abstimmung',
  'collab.poll.field.question': 'Frage',
  'collab.poll.field.questionPlaceholder': 'Wo essen wir am letzten Abend?',
  'collab.poll.field.optionsLegend': 'Auswahl',
  'collab.poll.field.option': 'Antwort {n}',
  'collab.poll.example.first': 'Den',
  'collab.poll.example.second': 'Narisawa',
  'collab.poll.example.third': 'Noch eine Antwort',
  'collab.poll.action.addOption': 'Antwort hinzufügen',
  'collab.poll.action.removeOption': 'Antwort entfernen {n}',
  'collab.poll.field.multi': 'Mehrfachauswahl erlauben',
  'collab.poll.field.multiHint':
    'Aus heißt eine Stimme pro Person, und ein Umdenken verschiebt sie.',
  'collab.poll.action.opening': 'Abstimmung wird eröffnet',
  'collab.poll.action.open': 'Abstimmung eröffnen',
  'collab.poll.error.tooFew':
    'Eine Abstimmung braucht mindestens zwei Dinge zur Auswahl.',
  'collab.poll.error.duplicate':
    'Zwei Antworten sagen dasselbe. Gib jeder ihre eigene Formulierung.',
  'collab.presence.viewingNow': 'sehen gerade zu',
  'collab.presence.unnamed': 'Mitglied ohne Namen',
  'collab.presence.tabsOpen': {
    one: '{name} — {count} offener Tab',
    other: '{name} — {count} offene Tabs',
  },

  /* ----------------------------------------- collab: the thread */
  'collab.reaction.agree': 'Zustimmung',
  'collab.reaction.love': 'Gefällt mir',
  'collab.reaction.funny': 'Witzig',
  'collab.reaction.celebrate': 'Feiern',
  'collab.reaction.thanks': 'Danke',
  'collab.reaction.looking': 'Schaue',
  'collab.reaction.tally': '{emoji} — {count}',
  'collab.reaction.tallyMine': '{emoji} — {count}, du dabei',
  'collab.thread.today': 'Heute',
  'collab.thread.emptyBody':
    'Alle auf dieser Reise teilen einen Gesprächsverlauf. Hier getroffene Entscheidungen bleiben bei der Reise, statt sich über Gruppenchats zu verteilen.',
  /** Invitation to write the first message of an empty conversation, not a command. */
  'collab.thread.empty': 'Schreib die erste Nachricht',
  'collab.thread.loadOlder': 'Frühere Nachrichten laden',
  'collab.thread.loadingOlder': 'Frühere Nachrichten werden geladen',
  'collab.thread.loadOlderFailed':
    'Frühere Nachrichten konnten nicht geladen werden',
  'collab.thread.retry': 'Erneut versuchen',
  'collab.thread.start': 'Hier beginnt die Unterhaltung',
  'collab.thread.loadedEarlier': {
    one: '{earlier} frühere Nachricht geladen',
    other: '{earlier} frühere Nachrichten geladen',
  },
  'collab.thread.newFrom': 'Neue Nachricht von {name}',
  'collab.thread.newMany': {
    one: '{new} neue Nachricht',
    other: '{new} neue Nachrichten',
  },
  'collab.toast.reactionFailed': 'Die Reaktion wurde nicht gespeichert',
  'collab.toast.messageDeleted': 'Nachricht gelöscht',
  'collab.toast.deleteFailed': 'Die Nachricht wurde nicht gelöscht',
  'collab.toast.notSent': 'Nicht gesendet',
  'collab.toast.notSentBody':
    'Die Nachricht konnte nicht gesendet werden. Versuch es gleich noch einmal.',
  'collab.toast.messageUpdated': 'Nachricht aktualisiert',
  'collab.toast.editFailed': 'Die Änderung wurde nicht gespeichert',
  'collab.message.deleteTitle': 'Diese Nachricht löschen?',
  'collab.message.deleteBody':
    'Der Text verschwindet aus dem Verlauf. Antworten darauf bleiben, wo sie sind.',
  'collab.message.delete': 'Nachricht löschen',
  'collab.message.reply': 'Antworten',
  'collab.message.menuEdit': 'Nachricht bearbeiten…',
  'collab.message.react': 'Auf diese Nachricht reagieren',
  'collab.message.edited': 'bearbeitet',
  'collab.message.actionsFor': 'Aktionen für die Nachricht von {name}',
  'collab.compose.editingYours': 'Du bearbeitest deine Nachricht',
  'collab.compose.replyingTo': 'Antwort an {name}',
  'collab.compose.cancelReply': 'Antwort abbrechen',
  'collab.compose.cancelEdit': 'Bearbeiten abbrechen',
  'collab.compose.placeholder': 'Schreib an die Reise',
  'collab.compose.placeholderText': 'Sag der Gruppe etwas…',
  'collab.compose.editPlaceholder': 'Deine Nachricht bearbeiten',
  'collab.compose.editPlaceholderText': 'Ändere, was du gesagt hast…',
  'collab.compose.send': 'Nachricht senden',
  'collab.compose.savingEdit': 'Änderung wird gespeichert',
  'collab.compose.save': 'Speichern',
  /** Textarea description for a fine pointer; input-method composition never sends. */
  'collab.compose.keysHint':
    'Drücke Enter zum Senden, Shift und Enter für eine neue Zeile.',
  /** Added to the textarea description only while replying or editing. */
  'collab.compose.keysHintEsc': 'Drücke Escape zum Abbrechen.',
  /** Textarea description on a coarse pointer; Enter adds a line. */
  'collab.compose.keysHintTouch':
    'Verwende die Senden-Schaltfläche zum Senden.',
  /** Button retries the failed send or edit using the text currently in the field. */
  'collab.compose.retry': 'Erneut versuchen',
  /** Fixed failed-edit body, also used as the edit toast fallback; never server diagnostics. */
  'collab.toast.editFailedBody':
    'Deine Änderungen stehen noch im Textfeld. Prüfe deine Verbindung und versuche es erneut.',
  'collab.hint.sends': 'sendet',
  'collab.hint.addsLine': 'fügt eine Zeile ein',
  'collab.hint.cancels': 'bricht ab',

  /* ------------------------------------------ collab: the board */
  'collab.toast.noteRemoved': 'Notiz entfernt',
  'collab.toast.noteRemoveFailed': 'Die Notiz wurde nicht entfernt',
  'collab.notes.empty.title': 'Keine geteilten Notizen',
  'collab.notes.empty.body':
    'Restaurantempfehlungen, Visaregeln, der Code für die Haustür — alles, was die ganze Reise sich merken muss.',
  'collab.notes.empty.action': 'Schreib die erste Notiz',
  'collab.note.menu.edit': 'Notiz bearbeiten…',
  'collab.note.menu.unpin': 'Losheften',
  'collab.note.menu.pin': 'Oben anpinnen',
  'collab.note.remove': 'Notiz entfernen',
  'collab.note.removeBody':
    'Die Notiz verschwindet für alle auf der Reise vom Board.',
  'collab.note.new': 'Neue Notiz',
  'collab.poll.toast.voteFailed': 'Deine Stimme wurde nicht gespeichert',
  'collab.poll.toast.voteFailedBody': 'Das Ergebnis bleibt unverändert.',
  'collab.poll.toast.closed': 'Abstimmung geschlossen',
  'collab.poll.toast.closeFailed': 'Die Abstimmung wurde nicht geschlossen',
  'collab.poll.toast.removed': 'Abstimmung entfernt',
  'collab.poll.toast.removeFailed': 'Die Abstimmung wurde nicht entfernt',
  'collab.polls.heading': 'Abstimmungen',
  'collab.polls.empty.title': 'Keine offenen Abstimmungen',
  'collab.polls.empty.body':
    'Wenn sich die Gruppe nicht auf ein Restaurant einigen kann, stellt es zur Abstimmung und lasst die Antwort sich selbst klären.',
  'collab.polls.empty.action': 'Die Gruppe fragen',
  'collab.poll.menu.close': 'Abstimmung schließen',
  'collab.poll.remove': 'Abstimmung entfernen',
  'collab.poll.removeTitle': 'Diese Abstimmung entfernen?',
  'collab.poll.actionsFor': 'Aktionen für die Abstimmung „{question}“',
  'collab.badge.pinned': 'Angepinnt',
  'collab.badge.closed': 'Geschlossen',
  'collab.badge.open': 'Offen',
  'collab.badge.multi': 'Mehrfachauswahl',
  'collab.badge.leading': 'Führt',
  'collab.poll.removeBody': {
    one: '„{question}“ und ihre {count} Stimme verschwinden für alle.',
    other: '„{question}“ und ihre {count} Stimmen verschwinden für alle.',
  },
  'collab.poll.result': {
    one: '{label} — {votes} von {count} Stimme',
    other: '{label} — {votes} von {count} Stimmen',
  },
  'collab.poll.resultMine': {
    one: '{label} — {votes} von {count} Stimme, deine dabei',
    other: '{label} — {votes} von {count} Stimmen, deine dabei',
  },
  'collab.poll.voteCount': {
    one: '{count} Stimme',
    other: '{count} Stimmen',
  },

  /* ------------------------------------------- files: the library */
  'files.kind.document': 'Dokument',
  'files.kind.photo': 'Foto',
  'files.kind.ticket': 'Ticket',
  'files.kind.receipt': 'Beleg',
  'files.kind.map': 'Karte',
  'files.kind.other': 'Sonstiges',
  'files.kindChoice.ticket': 'Ticket oder Pass',
  'files.kindChoice.map': 'Karte oder Route',
  'files.toast.removed': 'Datei entfernt',
  'files.toast.removeFailed': 'Die Datei wurde nicht entfernt',
  'files.toast.downloadFailed': 'Der Download ist nicht gestartet',
  'files.toast.gone': 'Die Datei ist in diesem Tab nicht mehr verfügbar.',
  'files.toast.uploadFailed':
    'Der Upload ist fehlgeschlagen. Versuch es noch einmal.',
  'files.toast.updated': 'Datei aktualisiert',
  'files.toast.updateFailed': 'Die Datei wurde nicht aktualisiert',
  'files.storage.full': 'Dieser Arbeitsbereich hat keinen Speicher mehr',
  'files.storage.used':
    '{used} von {limit} sind belegt. Entferne unten eine Datei oder wechsle in einen höheren Tarif, bevor du noch etwas hinzufügst.',
  'files.storage.perFile': 'bis zu {size} pro Datei',
  'files.action.add': 'Dateien hinzufügen',
  'files.action.choose': 'Dateien auswählen',
  'files.action.upload': 'Dateien hochladen',
  'files.calendar.live.action': 'Aktueller Kalenderlink',
  'files.calendar.live.title': 'Aktueller Kalenderlink',
  'files.calendar.warning':
    'Alle mit diesem Link können Orte, Zeiten, Adressen und Notizen dieser Reise ohne Konto lesen. Schütze ihn wie ein Passwort.',
  'files.calendar.enable.action': 'Link erstellen',
  'files.calendar.link.once':
    'Kopiere ihn jetzt - wir zeigen ihn nur einmal. Falls du ihn verlierst, erstelle einen neuen Link; der alte funktioniert dann nicht mehr.',
  'files.calendar.link.address': 'Linkadresse',
  'files.calendar.link.copy': 'Link kopieren',
  'files.calendar.link.copied': 'Link kopiert',
  'files.calendar.link.copyFailed':
    'Kopieren fehlgeschlagen. Markiere die Adresse und kopiere sie selbst.',
  'files.calendar.link.open': 'In deiner Kalender-App öffnen',
  'files.calendar.link.google': 'Zu Google Kalender hinzufügen',
  'files.calendar.link.outlook': 'Zu Outlook hinzufügen',
  'files.calendar.link.done': 'Fertig',
  'files.calendar.link.stays':
    'Bestätigungsnummern, Preise und Dateien bleiben in planned.travel.',
  'files.calendar.freshness':
    'Kalender-Apps zeigen Änderungen möglicherweise erst nach mehreren Stunden oder später.',
  'files.calendar.state.on': 'Kalenderlink ist aktiv',
  'files.calendar.state.lastFetched':
    'Ein Kalender hat diesen Link zuletzt {when} abgerufen',
  'files.calendar.state.neverFetched': 'Noch nicht abgerufen',
  'files.calendar.rotate.action': 'Neuen Link erstellen',
  'files.calendar.rotate.confirmTitle': 'Neuen Link erstellen?',
  'files.calendar.rotate.confirmBody':
    'Der alte Link funktioniert ab sofort nicht mehr. Kalender, die ihn verwenden, werden erst wieder aktualisiert, wenn du ihnen den neuen Link gibst.',
  'files.calendar.rotate.busy': 'Neuer Link wird erstellt…',
  'files.calendar.error.rotate':
    'Wir konnten nicht bestätigen, dass ein neuer Link erstellt wurde. Der aktuelle Status steht unten; versuche es bei Bedarf erneut.',
  'files.calendar.rotate.confirm': 'Neuen Link erstellen',
  'files.calendar.off.action': 'Deaktivieren',
  'files.calendar.off.confirmTitle': 'Diesen Kalenderlink deaktivieren?',
  'files.calendar.off.confirmBody':
    'Der Link funktioniert sofort nicht mehr. Kalender behalten vorhandene Termine, aktualisieren sie aber nicht mehr.',
  'files.calendar.off.confirm': 'Deaktivieren',
  'files.calendar.off.busy': 'Wird deaktiviert…',
  'files.calendar.closeGuard.title': 'Ohne Kopieren des Links schließen?',
  'files.calendar.closeGuard.body':
    'Wir können ihn nicht erneut zeigen. Du müsstest einen neuen erstellen.',
  'files.calendar.closeGuard.confirm': 'Trotzdem schließen',
  'files.calendar.closeGuard.cancel': 'Geöffnet lassen',
  'files.calendar.error.enable':
    'Die Erstellung des Links konnte nicht bestätigt werden. Unten steht der aktuelle Status. Wenn ein Link aktiv ist, den du nie gesehen hast, deaktiviere ihn und erstelle ihn erneut.',
  'files.calendar.error.off':
    'Die Deaktivierung konnte nicht bestätigt werden. Unten steht der aktuelle Status; versuche es bei Bedarf erneut.',
  'files.calendar.error.load':
    'Der Kalenderlink dieser Reise konnte nicht geprüft werden. Versuche es erneut.',
  'files.calendar.retry': 'Erneut versuchen',
  'files.calendar.off.confirmBodyUnused':
    'Dieser Link wurde noch nicht verwendet. Er funktioniert ab sofort nicht mehr.',
  'files.calendar.link.fallback':
    'Wenn du ihn am Handy nicht hinzufügen kannst, öffne diese Seite am Computer.',
  'files.calendar.link.newTab': 'öffnet einen neuen Tab',
  'files.calendar.title': 'Kalender',
  'files.calendar.description':
    'Übernimm diese Reise in die Kalender-App, die du schon nutzt.',
  'files.calendar.download.action': 'Kalenderdatei herunterladen (.ics)',
  'files.calendar.download.hint':
    'Eine Momentaufnahme der Reise, wie sie jetzt ist. Sie aktualisiert sich nicht.',
  'files.calendar.undated':
    'Diese Reise hat noch keine Daten, daher erscheinen nur Reservierungen und Fahrten mit Datum.',
  'files.calendar.download.error':
    'Wir konnten die Datei nicht vorbereiten. Versuche es erneut.',
  'files.calendar.timesNote':
    'Fahrten mit Zeitzone erscheinen überall zum selben Zeitpunkt. Alles andere erscheint zur geplanten Uhrzeit, wo auch immer dein Kalender ist.',
  'files.drop.active': 'Zum Hochladen loslassen',
  'files.drop.pasteHint': 'fügt ein kopiertes Bild oder einen Screenshot ein',
  'files.reject.blockedType':
    '„{name}“ wurde nicht hinzugefügt: XML- und komprimierte SVG-Dateien werden hier aus Sicherheitsgründen nicht gespeichert. Speichere sie als PDF oder Bild und füge stattdessen das hinzu.',
  'files.drop.idle': 'Dateien hierher ziehen',
  'files.empty.title': 'Keine Dateien auf dieser Reise',
  'files.empty.body':
    'Alles, was du sonst am Check-in-Schalter aus einem Postfach kramen müsstest, liegt hier, bei der Reise, zu der es gehört.',
  'files.empty.hint':
    'Bordkarten, Hotelbestätigungen, Tickets, Versicherungsunterlagen und die Belege, die deine Ausgaben stützen.',
  'files.heading': 'Anhänge',
  'files.tableCaption': 'Dateien zu dieser Reise',
  'files.menu.download': 'Herunterladen',
  'files.menu.rename': 'Umbenennen und beschreiben…',
  'files.menu.remove': 'Datei entfernen',
  'files.remove.body':
    'Die Datei wird aus dem Speicher und von dieser Reise gelöscht, und {size} werden frei. Das lässt sich nicht rückgängig machen.',
  'files.queue.clear': 'Fertige aufräumen',
  'files.column.file': 'Datei',
  'files.column.size': 'Größe',
  'files.column.addedBy': 'Hinzugefügt von',
  'files.column.when': 'Wann',
  'files.status.uploaded': 'Hochgeladen',
  'files.status.failed': 'Fehlgeschlagen',
  'files.status.cancelled': 'Abgebrochen',
  'files.status.uploading': 'Wird hochgeladen',
  'files.status.waiting': 'Wartet',
  'files.error.nameEmpty':
    'Eine Datei braucht einen Namen, unter dem du sie wiederfindest.',
  'files.field.kindHint':
    'Entscheidet, unter welchem Filter sie steht und welches Zeichen sie bekommt.',
  'files.field.kindAria': 'Art der Datei',
  'files.field.description': 'Beschreibung',
  'files.field.descriptionPlaceholder':
    'Versicherungspolice — deckt die ganze Gruppe, Schadensnummer auf Seite 2.',
  'files.dialog.title': 'Dateidetails',
  'files.action.saving': 'Datei wird gespeichert',
  'files.action.save': 'Details speichern',
  'files.queue.someFailed': {
    one: '{count} Datei wurde nicht hochgeladen. Der Grund steht in der jeweiligen Zeile — sonst ist im Stapel nichts betroffen.',
    other:
      '{count} Dateien wurden nicht hochgeladen. Der Grund steht in der jeweiligen Zeile — sonst ist im Stapel nichts betroffen.',
  },

  'files.action.cancelUploadOf': 'Hochladen von {name} abbrechen',
  'files.action.dismissOf': '{name} ausblenden',
  'files.status.downloadingOf': '{name} wird heruntergeladen',
  'files.status.uploadingOf': '{name} wird hochgeladen',
  'files.status.uploadingCount': {
    one: '{count} Datei wird hochgeladen',
    other: '{count} Dateien werden hochgeladen',
  },

  /* --------------------------- files: the trip export document and its email */
  'files.export.doc.footer': '{app} - erstellt am {when}',
  'files.export.madeAt': '{date}, {time}',
  'files.export.email.subject': '{title} ist fertig',
  'files.export.email.body': {
    one: 'Der Reiseexport ist fertig. Er wird {count} Tag aufbewahrt.',
    other: 'Der Reiseexport ist fertig. Er wird {count} Tage aufbewahrt.',
  },
  'files.export.email.action': '{title} öffnen',
  'files.export.email.text': 'Der Reiseexport ist fertig: {url}',

  /* --------------------------- files: the trip export list */
  'files.export.label': 'Reise exportieren',
  'files.export.description':
    'Eine druckbare Kopie der Reise: Tage, Stopps, Reservierungen, Transport und Unterkünfte. Gib sie an jemanden ohne Konto weiter.',
  'files.export.kept': {
    one: 'Jeder Export wird {count} Tag aufbewahrt.',
    other: 'Jeder Export wird {count} Tage aufbewahrt.',
  },
  'files.export.empty.title': 'Noch keine Exporte',
  'files.export.empty.body':
    'Erstelle eine druckbare Kopie der Reise, um sie an jemanden ohne Konto zu schicken.',
  'files.export.empty.bodyViewer':
    'Wer die Reise besitzt oder bearbeiten darf, kann einen Export erstellen.',
  'files.export.format.pdf': 'PDF-Datei',
  'files.export.format.html': 'Druckbare Seite',
  'files.export.artifact': 'Reiseexport, {date}',
  'files.export.download': 'Herunterladen',
  'files.export.downloadLabelPdf': 'PDF vom {date} herunterladen',
  'files.export.downloadLabelHtml': 'Druckbare Seite vom {date} herunterladen',
  'files.export.error.list': 'Die Liste der Exporte wurde nicht geladen.',
  'files.export.retry': 'Erneut versuchen',
  'files.export.error.missing':
    'Dieser Export wird nicht mehr aufbewahrt. Exportiere die Reise erneut.',
  'files.export.error.missingViewer':
    'Dieser Export wird nicht mehr aufbewahrt.',

  /* --------------------------- files: the upload and download chain */
  'files.error.cancelled': 'Hochladen abgebrochen.',
  'files.error.badAnswer':
    'Der Server hat eine Antwort geschickt, die dieser Browser nicht lesen konnte.',
  'files.error.connection':
    'Die Verbindung ist beim Hochladen abgerissen. Prüfe dein Netz und versuch es noch einmal.',
  'files.error.timeout':
    'Das Hochladen hat zu lange gedauert. Versuch es noch einmal.',
  'files.error.refused': 'Der Server hat den Upload abgelehnt ({status}).',
  'files.error.downloadShape':
    'Der Download kam in einer Form zurück, die wir nicht speichern konnten.',
  'files.error.downloadFailed': 'Der Download ist fehlgeschlagen ({status}).',
  'files.toast.uploadedOne': 'Datei hochgeladen',
  'files.toast.uploadedManyBody': '{size} zu dieser Reise hinzugefügt.',
  'files.toast.failedOne': 'Diese Datei wurde nicht hochgeladen',
  'files.toast.failedManyBody':
    'Die Warteschlange unten sagt bei jeder, warum.',
  'files.error.tooMany': {
    one: 'Es kann nur {count} Datei auf einmal hinzugefügt werden, deshalb blieb „{name}“ außen vor. Zieh sie einzeln noch einmal herein.',
    other:
      'Es können nur {count} Dateien auf einmal hinzugefügt werden, deshalb blieb „{name}“ außen vor. Zieh sie einzeln noch einmal herein.',
  },
  'files.toast.uploadedMany': {
    one: '{count} Datei hochgeladen',
    other: '{count} Dateien hochgeladen',
  },
  'files.toast.failedMany': {
    one: '{count} Datei wurde nicht hochgeladen',
    other: '{count} Dateien wurden nicht hochgeladen',
  },

  'files.export.request': 'Reise exportieren',
  'files.export.includeReferences': 'Bestätigungscodes einschließen',
  'files.export.includeReferencesHint':
    'Nicht aktivieren, wenn du die Datei an jemanden außerhalb deines Arbeitsbereichs sendest.',
  'files.export.pending':
    'Dein Export wird vorbereitet. Du kannst diese Seite verlassen; die fertige Datei erscheint in dieser Liste.',
  'files.export.slow':
    'Es dauert länger als üblich. Die fertige Datei erscheint hier. Falls nicht, exportiere erneut.',
  'files.export.refresh': 'Aktualisieren',
  'files.export.ready': 'Dein Export ist fertig',
  'files.export.quota': {
    one: 'Das Monatskontingent dieses Arbeitsbereichs von {count} Exporten ist aufgebraucht. Der Zähler beginnt am {date} neu.',
    other:
      'Das Monatskontingent dieses Arbeitsbereichs von {count} Exporten ist aufgebraucht. Der Zähler beginnt am {date} neu.',
  },
  'files.export.error.request': 'Der Export wurde nicht gestartet',
  'files.export.error.requestBody':
    'Dieser Versuch wurde nicht gezählt. Versuche es gleich erneut.',
  'files.export.doc.overview': 'Übersicht',
  'files.export.doc.timezone': 'Zeitzone',
  'files.export.doc.days': 'Tage',
  'files.export.doc.day': {
    one: 'Tag {count} - {date}',
    other: 'Tag {count} - {date}',
  },
  'files.export.doc.dayUndated': { one: 'Tag {count}', other: 'Tag {count}' },
  'files.export.doc.dayEmpty': 'Noch nichts geplant.',
  'files.export.doc.reservations': 'Reservierungen',
  'files.export.doc.transport': 'Verkehrsmittel',
  'files.export.doc.reference': 'Best.-Nr. {code}',
  'files.export.doc.route': '{from} nach {to}',
  'files.export.doc.stays': 'Unsere Unterkünfte',
  'files.export.doc.nights': {
    one: 'Nächte: {count}',
    other: 'Nächte: {count}',
  },
  'files.export.doc.truncatedDays': {
    one: 'Nicht alle Tage passen in ein Dokument. Die ersten {count} Tage werden angezeigt.',
    other:
      'Nicht alle Tage passen in ein Dokument. Die ersten {count} Tage werden angezeigt.',
  },
  'files.export.doc.truncatedRows': {
    one: 'Die ersten {count} von {total} werden angezeigt.',
    other: 'Die ersten {count} von {total} werden angezeigt.',
  },
  'files.export.notify':
    'Per E-Mail benachrichtigen, sobald der Export fertig ist',
  'files.export.viewer':
    'Nur Eigentümer und Bearbeiter können einen Export erstellen. Vorhandene Exporte kannst du herunterladen.',
  'files.export.jump': 'Zu den Exporten',
  'files.export.fromLink': 'Aus deinem Link',
  'files.export.linkGone':
    'Dieser Export wird nicht mehr aufbewahrt. Erstelle unten einen neuen.',
  'files.export.allowance': {
    one: 'Diesen Monat {used} von {count} Export genutzt',
    other: 'Diesen Monat {used} von {count} Exporten genutzt',
  },
  'files.export.allowanceUnlimited': {
    one: '{count} Export diesen Monat',
    other: '{count} Exporte diesen Monat',
  },
  'files.export.linkGoneViewer': 'Dieser Export wird nicht mehr aufbewahrt.',
  'files.calendar.tab.trip': 'Diese Reise',
  'files.calendar.tab.workspace': 'Meine Reisen',
  'files.calendar.workspace.warning':
    'Jeder mit diesem Link kann ohne Konto deine nicht archivierten Reisen in diesem Arbeitsbereich lesen: die {count} mit den spätesten Startdaten. Neue Reisen erscheinen automatisch. Schütze ihn wie ein Passwort.',
  'files.calendar.workspace.nameNote':
    'Dieser Link erscheint in deiner Kalender-App als „planned.travel“. Benenne ihn um, wenn du mehrere hast.',
} satisfies TranslationOf<typeof En>

export default messages
