/**
 * The costs tab's copy, in de.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Plural.** `one` · `other`. **Typografie.** Deutsch setzt Bereiche mit
 * Halbgeviertstrich und zitiert mit „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Du',
  'person.youTarget': 'dich',
  'person.removed': 'Entfernte Reisende',
  'person.removedTarget': 'eine entfernte Person',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Diese Ausgabe löschen?',
  'delete.description':
    '„{title}“ und ihre Aufteilung verschwinden aus der Abrechnung. Das lässt sich nicht rückgängig machen.',
  'delete.failed': 'Das hat nicht geklappt',
  'delete.failedBody':
    'Die Ausgabe konnte nicht gelöscht werden. Versuch es gleich noch einmal.',
  'delete.noBalances':
    'Kein Saldo ändert sich - es war nichts darauf aufgeteilt.',
  'delete.balancesChange': 'Salden ändern sich für {names}.',
  'delete.confirm': 'Ausgabe löschen',
  'delete.working': 'Ausgabe wird gelöscht',
  'delete.payment.title': 'Diese Zahlung löschen?',
  'delete.payment.description':
    '„{title}“ verschwindet aus der Abrechnung. Das lässt sich nicht rückgängig machen. Um eine Zahlung zu korrigieren, erfasse sie neu.',
  'delete.payment.failedBody':
    'Die Zahlung konnte nicht gelöscht werden. Versuch es gleich noch einmal.',
  'delete.payment.confirm': 'Zahlung löschen',
  'delete.payment.working': 'Zahlung wird gelöscht',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Ausgaben',
  'toolbar.shownOf': '{shown} von {total}',
  'toolbar.searchPlaceholder': 'In Ausgaben, Notizen oder Zahlern suchen…',
  'toolbar.searchLabel': 'Ausgaben durchsuchen',
  'toolbar.allCategories': 'Alle Kategorien',
  'toolbar.allDays': 'Alle Tage',
  'toolbar.filterCategory': 'Nach Kategorie filtern',
  'toolbar.filterDay': 'Nach Tag filtern',
  'toolbar.whose': 'Wessen Ausgaben',
  'toolbar.paidByMe': 'Von mir bezahlt',
  'toolbar.owedToMe': 'Mir geschuldet',
  'toolbar.logged': {
    one: '{value} erfasst',
    other: '{value} erfasst',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Aufteilung unter den Mitreisenden',
  'split.label': 'Aufteilen unter',
  'split.everyone': 'Alle',
  'split.nobody': 'Niemand',
  'split.departed': 'Hat die Reise verlassen',
  'split.departedHint':
    'Wenn du jemanden abwählst, der die Reise verlassen hat, wird der Anteil endgültig entfernt.',
  'split.includeFor': '{name} in diese Aufteilung einbeziehen',
  'split.how': 'Wie sich diese Ausgabe teilt',
  'split.method.equal': 'Gleichmäßig',
  'split.method.equalHint':
    'Alle Beteiligten zahlen dasselbe, und die überzählige kleinste Einheit geht an die erste Person in der Liste.',
  'split.method.exact': 'Genau',
  'split.method.exactHint':
    'Trag ein, was jede Person wirklich schuldet. Die Beträge müssen die Summe ergeben.',
  'split.method.shares': 'Anteile',
  'split.method.sharesHint':
    'Gewichte die Aufteilung - 2 Anteile für ein Paar, 1 für alle anderen.',
  'split.method.percentage': 'Prozent',
  'split.method.percentageHint':
    'Aufteilung nach Prozent. Die Prozente müssen 100 ergeben.',
  'split.exactFor': 'Genauer Betrag für {name}',
  'split.percentFor': 'Prozentsatz für {name}',
  'split.sharesFor': 'Anteile für {name}',
  'split.balanced': 'Passt',
  'split.allocated': '{allocated} von {total} zugeteilt',
  'split.over': '{amount} zu viel',
  'split.left': '{amount} übrig',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Betrag',
  'field.currency': 'Währung',
  'field.date': 'Datum',
  'field.paidBy': 'Bezahlt von',
  'expense.editTitle': 'Diese Ausgabe bearbeiten',
  'expense.addTitle': 'Ausgabe hinzufügen',
  'expense.editDescription':
    'Wenn du den Betrag änderst, wird er unter allen unten Beteiligten neu aufgeteilt.',
  'expense.addDescription':
    'Beträge werden für diese Reise in {currency} geführt. Erfasse einen Belegt in seiner eigenen Währung und trag ein, was er umgerechnet ergab.',
  'expense.saveFailed': 'Das hat nicht geklappt',
  'expense.what': 'Wofür war das',
  'expense.whatPlaceholder': 'Abendessen im Kyubey',
  'expense.amountNotANumber': 'Gib den Betrag als Zahl ein.',
  'expense.convertedTo': 'Umgerechnet in {currency}',
  'expense.convertedHint': 'Was {from} auf deinem Auszug in {to} ergab.',
  'expense.convertedSuggested':
    'Vorgeschlagen nach dem Kurs, der auf dieser Reise am {date} verwendet wurde ({rate}). Ändere den Betrag, damit er zu deinem Auszug passt.',
  'expense.convertedNotANumber': 'Gib den umgerechneten Betrag als Zahl ein.',
  'expense.paidByHint':
    'Lass es offen, wenn du einen Belegt erfasst, den noch niemand übernommen hat.',
  'expense.nobodyYet': 'Noch niemand',
  'expense.notesHint': 'Optional. Alles, was der Belegt nicht sagt.',
  'expense.notesPlaceholder': 'Menü geteilt, Getränke separat.',
  'expense.noAmount': 'Noch kein Betrag',
  'expense.saving': 'Ausgabe wird gespeichert',
  'expense.saveChanges': 'Änderungen speichern',
  'expense.add': 'Ausgabe hinzufügen',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Zahlung erfassen',
  'payment.description':
    'Eine erfasste Überweisung verschwindet aus beiden Salden. Sie bewegt kein Geld - planned.travel führt die Abrechnung, überwiesen wird bei deiner Bank.',
  'payment.youSuffix': '{name} (du)',
  'payment.pays': '{from} zahlt an {to}',
  'payment.pickTwo': 'Wähle zwei verschiedene Personen.',
  'payment.paidTo': 'Bezahlt an',
  'payment.needsTwo': 'Eine Zahlung braucht zwei verschiedene Personen.',
  'payment.amountIn': 'Betrag in {currency}',
  'payment.amountPositive': 'Gib einen Betrag über null ein.',
  'payment.how': 'Wie',
  'payment.note': 'Notiz',
  'payment.noteHint': 'Optional. Eine Referenz, oder wofür es war.',
  'payment.notePlaceholder': 'Deckt das Hotel in Kyoto und die JR-Tickets.',
  'payment.recording': 'Zahlung wird erfasst',
  'payment.confirm': 'Zahlung erfassen',
  'payment.failed':
    'Die Zahlung konnte nicht erfasst werden. Versuch es gleich noch einmal.',
  'payment.method.bankTransfer': 'Banküberweisung',
  'payment.method.cash': 'Bargeld',
  'payment.method.card': 'Karte',
  'payment.method.app': 'Bezahl-App',
  'payment.method.other': 'Etwas anderes',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Ausgleich',
  'settle.addPayment': 'Zahlung erfassen',
  'settle.action': 'Ausgleichen',
  'settle.empty.title': 'Alle sind quitt',
  'settle.empty.body':
    'Es sind keine Überweisungen nötig. Erfasse eine Ausgabe, und jedes Ungleichgewicht erscheint hier.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Salden',
  'balances.count': {
    one: '{travellers} Reisender',
    other: '{travellers} Reisende',
  },
  'balances.empty':
    'Salden erscheinen, sobald eine Ausgabe einen Zahler und eine Aufteilung hat.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Nach Kategorie',
  'categories.againstBudget': 'Gegen das Reisebudget',
  'categories.progressLabel': 'Ausgegeben gegen das Reisebudget',
  'categories.empty':
    'Budgetposten und Ausgaben schlüsseln sich hier auf, sobald es etwas aufzuschlüsseln gibt.',
  'categories.legendLabel': 'Ausgaben nach Kategorie',
  'categories.planned': '{amount} geplant',
  'categories.nothingSpent': 'Noch nichts ausgegeben. Das hast du geplant.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': 'weniger als {percent}',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Für wen das Geld ausgegeben wurde',
  'memberBar.others': {
    one: '{others} weiterer Reisender',
    other: '{others} weitere Reisende',
  },
  'memberBar.notSplit': 'Niemandem zugeordnet',
  'totalTile.label': 'Gesamtausgaben der Reise',
  'totalTile.captionPlanned': '{amount} geplant für alle Reisenden',
  'totalTile.captionBudget': '{amount} Budget für die Reise',
  'totalTile.yourShare': 'Dein Anteil',
  'totalTile.youPaid': 'Du hast gezahlt',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Erfasste Zahlungen',
  'payments.empty.title': 'Noch keine Zahlungen',
  'payments.empty.body':
    'Sobald jemand einen Saldo zurückzahlt, wird die Überweisung hier erfasst.',
  'payments.delete': 'Zahlung von {from} an {to} löschen, {amount}',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.archived':
    'Diese Reise ist archiviert. Stelle sie wieder her, bevor du die Kosten änderst.',
  'readOnly.title': 'Du kannst die Kosten ansehen, aber nicht ändern',
  'readOnly.body':
    'Ausgaben hinzufügen, ändern oder löschen und Zahlungen erfassen können nur die Eigentümer der Reise und Personen mit Bearbeitungsrechten. Wende dich an einen Eigentümer, wenn etwas geändert werden muss.',
  'readOnly.empty':
    'Auf dieser Reise wurden noch keine Ausgaben erfasst. Sie erscheinen hier, sobald ein Eigentümer oder Bearbeiter sie hinzufügt.',
  'readOnly.settleEmpty':
    'Im Moment sind keine Überweisungen nötig. Ein offener Saldo würde hier erscheinen.',
  'refusal.rebaseChanged':
    'Die Reise hat sich geändert, während du bestätigt hast, deshalb wurde nichts geändert. Prüfe die neuen Beträge und bestätige erneut.',
  'refusal.tripCurrencyChanged':
    'Die Budgetwährung dieser Reise ist jetzt {to}, deshalb wurde nichts gespeichert. Die Seite wurde aktualisiert: Prüfe den Betrag und speichere erneut.',
  /* ---------------------------------------- display currency (#844) */
  'display.label': 'Anzeigewährung',
  'display.indicator.perTrip': 'Eigene Währung',
  'display.indicator.fixed': 'Auch in {code}',
  'display.menu.perTrip': 'Jede Reise in ihrer Währung',
  'display.menu.workspace': '{code} (Standard des Arbeitsbereichs)',
  'display.menu.rateHint': 'Nutzt einen auf einer Reise erfassten Kurs',
  'display.menu.currentHint': 'Gewählt, aber kein erfasster Kurs deckt sie ab',
  'display.menu.needsLiveRate':
    'Braucht einen Live-Kurs, der noch nicht verfügbar ist',
  'display.menu.saving': 'Auswahl wird gespeichert',
  'display.error.title': 'Die Anzeigewährung wurde nicht gespeichert',
  'display.error.body':
    'Deine Auswahl konnte nicht gespeichert werden. Versuche es gleich noch einmal.',
  'display.row.converted': '≈ {amount} {code}',
  'display.row.convertedLabel': 'Etwa {amount} {code} in deiner Anzeigewährung',
  'display.row.notConverted': 'Nicht umgerechnet',
  'display.alert.title': 'Einige Beträge sind nicht umgerechnet',
  'display.alert.body':
    'Für diese Währungspaare ist kein Kurs erfasst, daher bleiben die Beträge in der Budgetwährung:',
  'display.alert.pair': '{from} nach {to} am {date}',
  /* ----------------------- the budget currency dialog (#841) */
  'rebase.open': 'Budgetwährung ändern',
  'rebase.title': 'Die Budgetwährung ändern',
  'rebase.description':
    'Die Beträge bleiben so, wie du sie eingegeben hast. Die Summen und Salden dieser Reise werden in die neue Währung umgerechnet.',
  'rebase.to': 'Neue Währung',
  'rebase.toPlaceholder': 'Währung wählen',
  'rebase.rateLabel': 'Wechselkurs (1 {from} in {to})',
  'rebase.rateInverse': 'Das entspricht 1 {to} = {inverse} {from}.',
  'rebase.rateInvalid': 'Gib einen Kurs größer als null ein.',
  'rebase.rateOutOfRange':
    'Dieser Kurs wirkt viel zu groß oder zu klein. Prüfe, in welche Richtung er gilt.',
  'rebase.source.recent':
    'Der zuletzt in diesem Arbeitsbereich verwendete Kurs',
  'rebase.source.manual': 'Der Kurs, den du eingegeben hast',
  'rebase.noRate':
    'Für {from} zu {to} ist kein Kurs erfasst. Gib den Kurs ein, den du verwenden möchtest.',
  'rebase.waitingForRate': 'Die Vorschau erscheint, sobald ein Kurs vorliegt.',
  'rebase.loading': 'Die Umrechnung wird berechnet',
  'rebase.example':
    '{original} bleibt, wie du es eingegeben hast, und wird als {converted} gezählt.',
  'rebase.count.expenses': {
    one: '{count} Ausgabe wird in {to} gezählt.',
    other: '{count} Ausgaben werden in {to} gezählt.',
  },
  'rebase.count.payments': {
    one: '{count} Zahlung wird in {to} gezählt.',
    other: '{count} Zahlungen werden in {to} gezählt.',
  },
  'rebase.count.planned': {
    one: '{count} geplanter Eintrag wird in {to} gezählt.',
    other: '{count} geplante Einträge werden in {to} gezählt.',
  },
  'rebase.pinned':
    'Preise von Orten, Buchungen, Unterkünften und Fahrten bleiben in {from}.',
  'rebase.target': 'Das Reisebudget {before} wird zu {after}.',
  'rebase.rounding':
    'Jeder Betrag wird einmal gerundet, daher kann sich ein Saldo um bis zu {amount} verschieben.',
  'rebase.leftover':
    'Nach der Änderung würde {name} {other} {amount} schulden.',
  'rebase.someone': 'Jemand',
  'rebase.nothing':
    'Auf dieser Reise hat noch nichts einen Preis, daher muss nichts umgerechnet werden.',
  'rebase.unconverted': {
    one: '{count} Eintrag ist in einer anderen Währung als {from} und kann nicht automatisch umgerechnet werden. Meist ist es eine Ausgabe, die aus einer in anderer Währung bepreisten Buchung entstanden ist: Bearbeite oder lösche sie und versuche es dann erneut.',
    other:
      '{count} Einträge sind in einer anderen Währung als {from} und können nicht automatisch umgerechnet werden. Meist sind es Ausgaben, die aus in anderer Währung bepreisten Buchungen entstanden sind: Bearbeite oder lösche sie und versuche es dann erneut.',
  },
  'rebase.unsplittable': {
    one: '{count} Ausgabe hat eine Aufteilung, die sich nicht übernehmen lässt, weil jeder Anteil darin null ist. Bearbeite oder lösche sie und versuche es dann erneut.',
    other:
      '{count} Ausgaben haben eine Aufteilung, die sich nicht übernehmen lässt, weil in ihnen jeder Anteil null ist. Bearbeite oder lösche sie und versuche es dann erneut.',
  },
  'rebase.outOfRange':
    'Mit diesem Kurs wäre ein Betrag auf der Reise zu groß, um in {to} gespeichert zu werden. Prüfe den Kurs und seine Richtung.',
  'rebase.tooLarge':
    'Diese Reise hat zu viele Einträge, um sie in einem Schritt zu ändern: Es wären {changes} Änderungen auf einmal nötig, erlaubt sind {limit}. Das Budget bleibt vorerst in {from}.',
  'rebase.copyPending':
    'Diese Reise wird noch kopiert. Versuche es gleich noch einmal.',
  'rebase.error':
    'Die Umrechnung konnte nicht geladen werden. Es wurde nichts geändert.',
  'rebase.commitError':
    'Wir konnten die Budgetwährung nicht ändern. Es wurde nichts geändert.',
  'rebase.stale':
    'Die Budgetwährung der Reise ist jetzt {current}, nicht {from}. Schließe diesen Dialog und öffne ihn erneut.',
  'rebase.sameCurrency':
    'Das Budget ist bereits in {to}. Wähle eine andere Währung.',
  'rebase.commitUnknown':
    'Wir konnten nicht bestätigen, ob die Budgetwährung auf {to} umgestellt wurde. Lade die Seite neu und prüfe es, bevor du es erneut versuchst.',
  'rebase.retry': 'Erneut versuchen',
  'rebase.confirm': 'Auf {to} umstellen',
  'rebase.committing': 'Die Budgetwährung wird geändert',
  'rebase.done': 'Das Budget ist jetzt in {to}.',
  // The costs screen (#1031)
  'screen.nothingSpent': 'Noch nichts ausgegeben',
  'screen.summary': '{expenses} · {spent} ausgegeben',
  'count.expenses': {
    one: '{expenses} Ausgabe',
    other: '{expenses} Ausgaben',
  },
  'screen.exportCsv': 'CSV exportieren',
  'screen.addFirst': 'Erste Ausgabe hinzufügen',
  'screen.empty.title': 'Noch keine Ausgaben',
  'screen.empty.body':
    'Erfasse Ausgaben direkt unterwegs. planned.travel teilt sie auf alle Mitreisenden auf und führt die laufende Summe in {currency}.',
  'screen.filtered.title': 'Zu diesen Filtern passt nichts',
  'screen.filtered.body':
    'Erweitere die Suche, wähle einen anderen Tag oder setze die Filter zurück, um wieder die ganze Reise zu sehen.',
  'export.empty.title': 'Nichts zu exportieren',
  'export.empty.body': 'Keine Ausgabe passt zu den aktiven Filtern.',
  'export.ready.title': 'Export fertig',
  'export.ready.body': {
    one: '{expenses} Ausgabe in die CSV-Datei geschrieben.',
    other: '{expenses} Ausgaben in die CSV-Datei geschrieben.',
  },
  'list.daySpent': '{amount} ausgegeben',
  'skeleton.loading': 'Ausgaben werden geladen',
  'row.noPayer': 'Noch kein Zahler',
  'row.youPaid': 'Du hast bezahlt',
  'row.paid': '{name} hat bezahlt',
  'row.notYourShare': 'nicht dein Anteil',
  'row.yourShare': '{amount} dein Anteil',
  'row.noteOn': 'Notiz zu {title}',
  'row.edit': '{title} bearbeiten',
  'row.delete': '{title} löschen',
  'row.saving': 'Wird gespeichert',
  'tile.owe.label': 'Du schuldest',
  'tile.owe.settled': 'Bei dir ist alles beglichen',
  'tile.owe.pending': 'Gleiche es aus, bevor du heimfliegst',
  'tile.owe.to': 'An',
  'tile.owed.label': 'Dir wird geschuldet',
  'tile.owed.none': 'Dir schuldet niemand etwas',
  'tile.owed.pending': 'Kommt noch zu dir zurück',
  'tile.owed.from': 'Von',
  'tile.outstanding.label': 'Offen',
  'tile.outstanding.none': 'Jede Ausgabe hat einen Zahler',
  'tile.outstanding.some': {
    one: '{expenses} Ausgabe noch ohne Zahler',
    other: '{expenses} Ausgaben noch ohne Zahler',
  },
  'category.accommodation': 'Unterkunft',
  'category.transport': 'Transport',
  'category.food': 'Essen & Trinken',
  'category.activities': 'Aktivitäten',
  'category.shopping': 'Einkäufe',
  'category.fees': 'Gebühren',
  'category.insurance': 'Versicherung',
  'category.other': 'Sonstiges',
  'toolbar.summary.everything': 'Alles wird angezeigt',
  'toolbar.summary.filtered': 'Gefiltert: {filters}',
  'toolbar.summary.search': 'passend zu „{term}“',
  'write.added': 'Ausgabe hinzugefügt',
  'write.updated': 'Ausgabe aktualisiert',
  'write.deleted': 'Ausgabe gelöscht',
  'write.addFailed': 'Die Ausgabe wurde nicht hinzugefügt',
  'write.editFailed': 'Die Ausgabe wurde nicht gespeichert',
  'write.deleteFailed': 'Die Ausgabe wurde nicht gelöscht',
  'write.paymentRecorded': 'Zahlung erfasst',
  'write.paymentRecordedBody': 'Beide Salden sind aktualisiert.',
  'write.paymentFailed': 'Die Zahlung wurde nicht erfasst',
  'write.paymentDeleted': 'Zahlung gelöscht',
  'write.paymentDeleteFailed': 'Die Zahlung wurde nicht gelöscht',
  'write.rolledBack': 'Die Änderung wurde zurückgenommen.',
  'expense.saveFallback':
    'Die Ausgabe konnte nicht gespeichert werden. Versuche es gleich noch einmal.',
} satisfies TranslationOf<typeof En>

export default messages
