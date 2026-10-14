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
  'expense.currencyLabel': 'Währung, in der dieser Belegt ausgestellt wurde',
  'expense.convertedTo': 'Umgerechnet in {currency}',
  'expense.convertedHint': 'Was {from} auf deinem Auszug in {to} ergab.',
  'expense.convertedSuggested':
    'Vorgeschlagen nach dem Kurs, der auf dieser Reise am {date} verwendet wurde ({rate}). Ändere den Betrag, damit er zu deinem Auszug passt.',
  'expense.convertedNotANumber': 'Gib den umgerechneten Betrag als Zahl ein.',
  'expense.dateLabel': 'Datum der Ausgabe',
  'expense.paidByHint':
    'Lass es offen, wenn du einen Belegt erfasst, den noch niemand übernommen hat.',
  'expense.nobodyYet': 'Noch niemand',
  'expense.whoPaid': 'Wer bezahlt hat',
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
  'payment.whoPaying': 'Wer zahlt',
  'payment.whoPaid': 'Wer bezahlt wird',
  'payment.amountIn': 'Betrag in {currency}',
  'payment.amountPositive': 'Gib einen Betrag über null ein.',
  'payment.currencyLabel': 'Währung, in der bezahlt wurde',
  'payment.how': 'Wie',
  'payment.howMade': 'Wie die Zahlung erfolgt ist',
  'payment.dateLabel': 'Datum der Zahlung',
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
  /* ------------------------------------------- read-only ledger (#837) */
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
} satisfies TranslationOf<typeof En>

export default messages
