/**
 * The public pages' copy, in de.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Typografie.** Deutsch zitiert mit „…“.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Kostenlos starten',
  'action.signIn': 'Anmelden',
  'action.pricing': 'Preise',
  'action.seePricing': 'Preise ansehen',
  'action.skipToContent': 'Zum Inhalt springen',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — Startseite',
  'nav.onThisPage': 'Auf dieser Seite',
  'anchor.planner': 'Planer',
  'anchor.modules': 'Module',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Auf Tag {day} ablegen',
  'legal.summaryNote':
    'Die Kurzfassung ist zum Lesen da. Was unten steht, gilt.',
  'visual.daysTravelled': 'Reisetage',
  'visual.acrossEveryTrip': 'über alle Reisen',
  'visual.mapFilled': '{percent} % der Karte gefüllt',
  'visual.previewSummary':
    'Eine Vorschau des planned.travel-Dashboards: die nächste Reise mit Daten, Mitreisenden und Zahl der Orte; Summen für besuchte Länder, Reisen und Reisetage; eine Karte der Reiseroute; und die nächsten zwei Buchungen.',
  'visual.placesMapped': {
    one: '{value} Ort auf der Karte',
    other: '{value} Orte auf der Karte',
  },
  'visual.splitWays': {
    one: 'nicht geteilt',
    other: 'auf {value} geteilt',
  },
  'visual.tripTotal': 'Reisesumme',
  'visual.paidSplit': '{who} hat gezahlt · {split}',
  'visual.nextUp': 'Als Nächstes',
  'visual.ofTotal': '{done} von {total}',
  'visual.awaitingReply': 'Warte auf Antwort',
  'visual.upcoming': 'Bevorstehend',
  'visual.days': {
    one: '{value} Tag',
    other: '{value} Tage',
  },
  'visual.places': {
    one: '{value} Ort',
    other: '{value} Orte',
  },
  'visual.transfersLeft': {
    one: '{value} Überweisung offen',
    other: '{value} Überweisungen offen',
  },

  'legal.badge.version': 'Version {version}',
  'legal.badge.effective': 'Gültig ab {updated}',
  'legal.notice.title': 'Das ist eine Vorlage, keine Rechtsberatung',
  'legal.notice.body':
    'Sie ist in einfachem Englisch geschrieben, um ein wirklich brauchbarer Ausgangspunkt für einen kleinen Reiseplanungsdienst zu sein, und jede Lücke, die ein Unternehmen füllen muss, ist markiert. Lass sie von einer qualifizierten Anwältin in deiner Rechtsordnung prüfen und anpassen, bevor du einen einzigen Kunden annimmst. Nichts hier behauptet eine Zertifizierung, Prüfung oder einen Compliance-Standard, den planned.travel hält.',
  'legal.contents': 'Inhalt',
  'legal.shortVersion': 'Die Kurzfassung',
  'legal.both': 'Beide Dokumente gelten zusammen.',

  'landing.plans.title':
    'Kostenlos anfangen. Zahlen, wenn es sich verdient hat.',
  'landing.plans.lede':
    'Jeder Plan enthält den Tagesplaner, die Karte, Budgets und Packlisten. Bezahlte Pläne - ab {price} im Monat - schalten unbegrenzt viele Reisen, Reservierungen, das Tagebuch und Exporte frei.',
  'landing.plans.ledeFree':
    'Jeder Plan enthält den Tagesplaner, die Karte, Budgets und Packlisten. Bezahlte Pläne schalten unbegrenzt viele Reisen, Reservierungen, das Tagebuch und Exporte frei.',
  'landing.plans.compare': 'Jedes Limit vergleichen, Zeile für Zeile',
  'landing.questions.title': 'Fragen, klar beantwortet',
  'landing.questions.lede':
    'Die fünf Dinge, die Leute wirklich wissen wollen, bevor sie anfangen.',
  'cta.heading':
    'Deine nächste Reise ist es schon wert, richtig geplant zu werden',
  'cta.lede':
    'Zwei Reisen, die ganze Karte, der Tagesplan und die Packlisten - kostenlos, ohne Karte und ohne Countdown.',
  'landing.faq.seats.q': 'Müssen die Leute, mit denen ich reise, auch zahlen?',
  'landing.faq.seats.a':
    'Nein. Alle, die du in einen {crew}-Arbeitsbereich einlädst, sind von seinen Plätzen abgedeckt. Sie melden sich mit ihrem eigenen Konto an und sehen nur die Reisen, zu denen du sie hinzugefügt hast.',
  'landing.faq.phone.q': 'Funktioniert es auf dem Handy richtig?',
  'landing.faq.phone.a':
    'Ja. Die mobilen Layouts sind eigens gezeichnet und nicht aus den Desktop-Layouts zusammengedrückt, und es ist eine Website - es gibt also nichts zu installieren und nichts aktuell zu halten.',
  'landing.faq.privacy.q': 'Wer kann meine Reise sehen?',
  'landing.faq.privacy.a':
    'Eine Reise gehört zu einem Arbeitsbereich, und nur die dort eingeladenen Leute können sie öffnen. Nichts ist öffentlich, es gibt keinen Entdeckungs-Feed, und standardmäßig wird nichts mit anderen geteilt.',
  'landing.faq.stop.q':
    'Was passiert mit meinen Reisen, wenn ich nicht mehr zahle?',
  'landing.faq.stop.a':
    'Nichts wird gelöscht. Die bezahlten Module sperren, deine Reisen bleiben genau dort, wo sie sind, und alles ist wieder frei, sobald du abonnierst. {free} bleibt kostenlos, ohne Countdown.',

  'action.startPlanning': 'Kostenlos planen',
  'cta.comparePlans': 'Pläne vergleichen',
  'landing.hero.eyebrow': 'Gemeinsame Reiseplanung',
  'landing.hero.title': 'Plane die Reise.',
  'landing.hero.titleQuiet': 'Nicht die Tabelle.',
  'landing.hero.lede':
    'Ein Reiseplan auf einer echten Karte, live geteilt mit allen Mitreisenden - mit den Buchungen, dem Geld und der Packliste daran.',
  'landing.hero.secondary': 'Sieh, was es kostet',
  'landing.trust.noCard': 'Keine Karte zum Start',
  'landing.trust.noAds': 'Keine Werbung, keine Affiliate-Links',
  'landing.trust.export': 'Alles exportieren, jederzeit',

  'proof.eyebrow': 'Klare Antworten',
  'proof.title': 'Keine Kundenstimmen, weil wir uns noch keine verdient haben',
  'proof.lede':
    'planned.travel ist neu. Statt ein Zitat zu erfinden oder ein fremdes Logo zu leihen, steht hier genau, was es tut, für wen es ist und was es niemals mit dir macht.',
  'proof.who.label': 'Für wen es ist',
  'proof.who.heading': 'Für die Person, die am Ende die Tabelle anlegt',
  'proof.who.body':
    'Für Paare, Familien und Freundesgruppen, die einen Plan wollen, den alle sehen - statt sechs Screenshots, drei Gruppenchats und einer gemeinsamen Notiz, die seit März niemand geöffnet hat.',
  'proof.not.label': 'Was es nicht ist',
  'proof.not.heading': 'Keine Buchungsseite, und nicht an eine verkäuflich',
  'proof.not.body':
    'Wir nehmen keine Provision, tragen keine Werbung und setzen keine Affiliate-Links, also lenkt dich auf keiner Seite etwas leise zu einem bestimmten Hotel. Du bezahlst uns, also arbeiten wir für dich.',
  'proof.where.label': 'Wo deine Dinge liegen',
  'proof.where.heading': 'Auf Cloudflare, in deinem eigenen Arbeitsbereich',
  'proof.where.body':
    'Reisen liegen in einer Datenbank, die auf deinen Arbeitsbereich beschränkt ist, Dateien in unserem eigenen Objektspeicher, beides ausgeliefert von Cloudflares Edge. Polar, unser Verkäufer im Rechtssinne, führt den Checkout und stellt die Rechnung, deine Kartennummer erreicht uns also nie.',
  'proof.promise.ads.title': 'Keine Werbung, keine Analytik Dritter',
  'proof.promise.ads.body':
    'Nichts auf der Seite misst dich für jemand anderen.',
  'proof.promise.sold.title': 'Deine Reisen werden nie verkauft oder vermietet',
  'proof.promise.sold.body':
    'Nicht an Werbetreibende, nicht an Reisefirmen, an niemanden.',
  'proof.promise.leave.title': 'Geh, wann du willst - und nimm alles mit',
  'proof.promise.leave.body':
    'PDF-Reisepläne, Kalenderdateien und deine Orte als GeoJSON.',
  'proof.certification':
    'Wir haben heute keine Sicherheitszertifizierung, und wir werden keine andeuten. Wenn planned.travel gegen einen Standard geprüft wird, nennen wir hier den Standard, den Prüfer und das Datum - und nicht vorher.',

  'feature.modules.title': 'Der Rest der Reise, erledigt',
  'feature.modules.lede':
    'Jedes Modul macht eine Sache richtig und gibt seine Arbeit an die anderen weiter. Nichts hier ist ein Platzhalter-Tab, der auf ein künftiges Release wartet.',
  'feature.module.lists.benefit': 'Niemand kommt ohne den Adapter an.',
  'feature.module.lists.detail':
    'Packen, To-dos, Einkäufe und Dokumente - eine Liste pro Aufgabe, geteilt mit allen Mitreisenden und abgehakt, während es passiert.',
  'feature.module.journal.name': 'Tagebuch',
  'feature.module.journal.benefit':
    'Aus der Reise wird eine Geschichte, kein Ordner.',
  'feature.module.journal.detail':
    'Einträge nach Datum, mit den Fotos, die du gemacht hast, dem Ort, dem Wetter und dem, wie sich der Tag wirklich angefühlt hat.',
  'feature.module.atlas.benefit': 'Eine Karte von überall, wo du warst.',
  'feature.module.atlas.detail':
    'Markiere ein Land als besucht, und es kommt auf deine Weltkarte - mit dem ersten Besuch, dem letzten und der Zahl der Male, die du zurück warst.',
  'feature.module.vacay.benefit': 'Buche den Urlaub, bevor du den Flug buchst.',
  'feature.module.vacay.detail':
    'Markiere die Tage, an denen du weg bist, und das Jahr füllt sich - Wochenenden, Feiertage und die Abwesenheiten aller anderen im gleichen Raster.',
  'feature.module.collab.benefit': 'Die Entscheidungen bleiben bei der Reise.',
  'feature.module.collab.detail':
    'Ein Verlauf pro Reise, gemeinsame Notizen für alles, was alle wissen müssen, und eine Abstimmung, wenn sich die Gruppe beim Abendessen nicht einig wird.',
  'feature.module.files.benefit': 'Bordkarten dort, wo du sie findest.',
  'feature.module.files.detail':
    'Bestätigungen, Tickets, Versicherungsunterlagen und Belege hängen an der Reise, zu der sie gehören, statt in einem Postfach zu versinken.',

  'feature.planner.title': 'Ein Tagesplan, gezeichnet auf einer echten Karte',
  'feature.planner.lede':
    'Sammle die Orte, die du sehen willst, und zieh sie dann auf einen Tag. Die Karte zeichnet die Route sofort neu, sodass du gleich siehst, wenn ein Morgen dich zweimal quer durch die Stadt schickt.',
  'feature.planner.point.days':
    'Eine Spalte pro Tag, mit Datum, Wetter und dem Ort, an dem du schläfst.',
  'feature.planner.point.unscheduled':
    'Orte ohne Termin warten in ihrer eigenen Spalte, bis sie einen Tag bekommen.',
  'feature.planner.point.crew':
    'Bei {crew} ziehen alle gleichzeitig: Live-Cursor, sofortige Synchronisierung, kein Neuladen.',
  'feature.planner.point.tiles':
    'Vektorkacheln aus unserem eigenen Speicher, also schaut kein Kartenanbieter zu, wie du planst.',
  'feature.costs.title': 'Geteilte Kosten, die sich wirklich ausgleichen',
  'feature.costs.lede':
    'Erfasse Ausgaben in der Währung der Reise, teile jede so auf, wie ihr es tatsächlich vereinbart habt, und sieh die kürzeste Reihe von Überweisungen, die alles begleicht.',
  'feature.costs.point.split':
    'Gleichmäßig, nach Anteilen oder auf den Betrag genau - je Ausgabe, nicht je Reise.',
  'feature.costs.point.currency':
    'Alles in eine Reisewährung umgerechnet, damit die Summe etwas bedeutet.',
  'feature.costs.point.settle':
    'Die Ausgleichsansicht nennt, wer wem zahlt, und verbucht die Überweisung, sobald sie erfolgt.',
  'feature.costs.point.receipt':
    'Häng den Belegt an die Ausgabe, damit die Zahl immer ihren Nachweis hat.',
  'feature.book.title':
    'Jede Buchung, mit dem Code, den du an der Tür brauchst',
  'feature.book.lede':
    'Übernachtungen, Tische, Touren und Tickets in einer Liste, neben den Flügen, Zügen und Fähren dazwischen - jedes mit Bestätigungsnummer und dem Tag, zu dem es gehört.',
  'feature.book.point.legs':
    'Verbindungen tragen Sitzplatz, Bahnsteig, Terminal und Buchungscode.',
  'feature.book.point.day':
    'Eine Buchung hängt an einem Tag und steht damit im Plan, ohne dass du sie neu eintippst.',
  'feature.book.point.states':
    'Angefragt, bestätigt und storniert sind eigene Zustände, keine Notiz in einem Feld.',
  'feature.book.point.export':
    'Exportiere die ganze Reise als PDF-Reiseplan oder Kalenderdatei, bevor du fliegst.',

  'pricing.faq.trial.q': 'Was passiert am Ende der Testphase?',
  'pricing.faq.trial.a':
    'Die Testphase geht in den bezahlten Tarif über. Polar erfasst zu Beginn der Testphase eine Zahlungsmethode und belastet sie am Tag, an dem die Testphase endet — kündige vorher, und es wird nie etwas abgebucht. Gelöscht wird in keinem Fall etwas: die bezahlten Module sperren, deine Reisen bleiben genau da, wo sie sind, und alles öffnet sich wieder, sobald du abonnierst.',
  'pricing.faq.seller.q': 'Bei wem kaufe ich eigentlich?',
  'pricing.faq.seller.a':
    'Bei Polar. Polar ist unser Verkäufer im Rechtssinn: verkauft dir das Abo als unser Reseller, nimmt die Zahlung, stellt die Rechnung im eigenen Namen aus und ermittelt, erhebt und führt die Umsatz- oder Mehrwertsteuer ab, die dein Land erhebt. Rückerstattungen und Kartenstreitigkeiten laufen ebenfalls über Polar. Den Dienst betreiben weiterhin wir, und wir antworten auf deine E-Mails.',
  'pricing.faq.change.q': 'Kann ich mitten in einer Reise den Tarif wechseln?',
  'pricing.faq.change.a':
    'Ja. Höherstufungen gelten sofort und werden auf den Tag genau abgerechnet; Herabstufungen greifen zum Ende des Zeitraums, den du bereits bezahlt hast — du verlierst also nie Zugang, für den du gezahlt hast.',
  'pricing.faq.seats.q':
    'Wie funktioniert die Abrechnung pro Mitglied bei {crew}?',
  'pricing.faq.seats.a':
    'Du zahlst für die Plätze, die du tatsächlich belegst, und kannst die Zahl jederzeit ändern. Offene Einladungen zählen mit, damit ein Workspace den Tarif nicht unbemerkt überbucht.',
  'pricing.faq.guests.q': 'Brauchen meine Mitreisenden ein eigenes Abo?',
  'pricing.faq.guests.a':
    'Nein. Alle, die du in einen {crew}-Arbeitsbereich einlädst, sind von seinen Plätzen abgedeckt. Sie melden sich mit ihrem eigenen Konto an und sehen die Reisen, zu denen sie hinzugefügt wurden.',
  'pricing.faq.storage.q': 'Was zählt zum Speicherplatz?',
  'pricing.faq.storage.a':
    'Fotos, Tickets, Bestätigungen und jede Datei, die du an eine Reise hängst. Kartenkacheln und die App selbst zählen nie mit. In den Einstellungen siehst du genau, was Platz braucht.',
  'pricing.faq.export.q': 'Komme ich an meine Daten heran?',
  'pricing.faq.export.a':
    'Immer. Jede Reise lässt sich als PDF-Reiseplan und als Kalenderdatei exportieren, deine Orte als GeoJSON. Es sind deine Reisen, nicht unsere.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Keine Karte, keine Frist, kein Countdown',
  'pricing.card.yearlyPerSeat': '{amount} im Jahr pro Person, einmal berechnet',
  'pricing.card.yearly': '{amount} einmal im Jahr berechnet',
  'pricing.card.seatsUnlimited': 'Unbegrenzt viele Mitglieder',
  'pricing.card.tripsUnlimited': 'unbegrenzt viele Reisen',
  'pricing.card.startFree': 'Kostenlos starten',
  'pricing.card.startTrial': '{plan} testen',
  'pricing.card.popular': 'Am häufigsten gewählt',
  'pricing.card.noteYearly':
    'Einmal im Jahr berechnet. Zwei Monate gehen aufs Haus.',
  'pricing.card.noteMonthly':
    'Monatlich berechnet. Wechseln oder kündigen, wann du willst.',
  'pricing.card.trial': {
    one: '{value} Tag gratis testen, Karte vorab, Abbuchung am Ende',
    other: '{value} Tage gratis testen, Karte vorab, Abbuchung am Ende',
  },
  'pricing.card.seatsUpTo': {
    one: 'Bis zu {value} Mitglied',
    other: 'Bis zu {value} Mitgliedern',
  },
  'pricing.card.trips': {
    one: '{value} Reise gleichzeitig',
    other: '{value} Reisen gleichzeitig',
  },

  'pricing.feature.storage': '{size} für Fotos und Dokumente',
  'pricing.feature.storageShared': '{size} gemeinsam für Fotos und Dokumente',
  'pricing.feature.free.tripsDetail':
    'Eine archivieren, um die nächste zu beginnen',
  'pricing.feature.solo.modules': 'Jedes Planungsmodul',
  'pricing.feature.solo.modulesDetail':
    'Reservierungen, Tagebuch, Budgets, Packen',
  'pricing.feature.crew.membersDetail':
    'Abrechnung pro Mitglied, jederzeit änderbar',
  'pricing.feature.crew.realtimeDetail':
    'Live-Cursor und sofortige Synchronisierung',
  'pricing.feature.crew.supportDetail':
    'Antwort von einem Menschen innerhalb eines Werktags',

  'pricing.hero.eyebrow': 'Zwei Reisen kostenlos, dauerhaft',
  'pricing.hero.title': 'Plane es richtig.',
  'pricing.hero.titleQuiet': 'Zahle, was du nutzt.',
  'pricing.hero.lede':
    'Plane zwei Reisen kostenlos. Schalte jedes Modul für eine Person frei, oder nimm die ganze Crew mit und bearbeitet denselben Plan gleichzeitig.',
  'pricing.hero.taxNote':
    'Preise in US-Dollar, ohne Umsatzsteuer oder Mehrwertsteuer. Polar ist unser Verkäufer im Rechtssinn: Polar steht auf deiner Rechnung, ermittelt, was dein Land erhebt, schlägt es beim Bezahlen auf und führt es ab. Kündigen kannst du jederzeit, direkt im Produkt.',
  'pricing.compare.eyebrow': 'Nebeneinander',
  'pricing.compare.title': 'Jede Grenze im Vergleich',
  'pricing.compare.lede':
    'Eine Tabelle, erzeugt aus demselben Katalog, den die Abrechnung liest. Sagt eine Zeile, ein Modul sei enthalten, stimmt die Berechtigungsprüfung zu.',
  'pricing.compare.caption':
    'Vergleich der Funktionen und Grenzen über alle drei Tarife',
  'pricing.compare.feature': 'Funktion',
  'pricing.compare.limits': 'Grenzen',
  'pricing.compare.included': 'Enthalten',
  'pricing.compare.notIncluded': 'Nicht enthalten',
  'pricing.compare.includedIn': 'In {plan} enthalten',
  'pricing.compare.notIn': 'Nicht in {plan}',
  'pricing.questions.eyebrow': 'Bevor du fragst',
  'pricing.questions.title': 'Fragen, beantwortet',
  'pricing.questions.lede':
    'Abrechnung, Testphasen und wie du deine Daten wieder herausbekommst.',
  'pricing.cta.secondary': 'So funktioniert es',
  'pricing.module.itinerary': 'Tagesplan',
  'pricing.module.map': 'Interaktive Karte',
  'pricing.module.budget': 'Budgets und Kostenteilung',
  'pricing.module.packing': 'Pack- und To-do-Listen',
  'pricing.module.reservations': 'Reservierungen und Buchungen',
  'pricing.module.journal': 'Reisetagebuch',
  'pricing.module.atlas': 'Weltkarten-Tracker',
  'pricing.module.collaboration': 'Mitreisende einladen',
  'pricing.module.realtime': 'Zusammenarbeit in Echtzeit',
  'pricing.module.offlineMaps': 'Offline-Karten',
  'pricing.module.pdfExport': 'PDF- und Kalenderexport',
  'pricing.module.prioritySupport': 'Vorrangiger Support',

  'anchor.plans': 'Tarife',
  'anchor.compare': 'Vergleich',
  'anchor.questions': 'Fragen',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Ein Ort für den Reiseverlauf, die Karte, die Buchungen, das Geld und die Packliste — geteilt mit allen, die mitkommen.',
  'footer.attribution':
    'Läuft auf Cloudflare Workers. Kartendaten © OpenStreetMap-Mitwirkende. Verkauf und Rechnung über Polar, unseren Merchant of Record.',
  'footer.column.product': 'Produkt',
  'footer.column.account': 'Konto',
  'footer.link.overview': 'Überblick',
  'footer.link.everyModule': 'Alle Module',
  'footer.link.dayPlanner': 'Tagesplaner',
  'footer.link.sharedCosts': 'Geteilte Kosten',
  'footer.link.reservations': 'Buchungen',
  'footer.link.atlasJournal': 'Atlas und Tagebuch',
  'footer.link.createAccount': 'Konto erstellen',
  'footer.link.terms': 'Nutzungsbedingungen',
  'footer.link.privacy': 'Datenschutzhinweis',
} satisfies TranslationOf<typeof En>

export default messages
