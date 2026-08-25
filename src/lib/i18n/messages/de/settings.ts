/**
 * Everything the settings module says, in German.
 *
 * Authored from `../en/settings.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Register.** Second person singular, as everywhere else in the German
 * catalogue. Even the billing screen says „du": a settings page that switched
 * to „Sie" for money would read as a different product.
 *
 * **Two senses of one English word.** `plan` is „Tarif" when it is something a
 * workspace pays for and „Ablauf" when it is the day-by-day itinerary; the
 * settings module only ever means the first. `Workspace` is „Arbeitsbereich"
 * throughout, `seat` is „Platz", `quota` is „Kontingent".
 *
 * **The three plan names are words, not proper nouns.** English calls them
 * Free, Solo and Crew; German reads „Gratis", „Einzel" and „Gruppe". What is
 * stable across languages is the plan *id* in `src/lib/plans.ts`, which the
 * invoice and Stripe carry and no reader ever sees.
 *
 * **The euro carries its region.** Every other currency in the list is named by
 * the country that issues it — „Britisches Pfund", „US-Dollar" — so the euro is
 * given the same parenthetical rather than sitting there as a bare word with no
 * home.
 *
 * **Plural.** `Intl.PluralRules('de')` reports `one` and `other`.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/settings'

const messages = {
  /* ------------------------------------------------------------------ shell */
  'page.eyebrow': 'Konto',
  'page.title': 'Einstellungen',
  'page.description':
    'Alles über dich, deinen Arbeitsbereich und das Verhalten von planned.travel',
  'page.error': 'Die Einstellungen wurden nicht geladen',

  'nav.label': 'Bereiche der Einstellungen',
  'nav.profile': 'Profil',
  'nav.profile.hint': 'Du, Datum, Geld und Einheiten',
  'nav.language': 'Sprache',
  'nav.language.hint': 'Die Sprache aller Bildschirme',
  'nav.appearance': 'Darstellung',
  'nav.appearance.hint': 'Thema, Bewegung und Karte',
  'nav.security': 'Sicherheit',
  'nav.security.hint': 'Passwort, Zwei-Faktor, Schlüssel',
  'nav.notifications': 'Mitteilungen',
  'nav.notifications.hint': 'Posteingang, E-Mail und Handy',
  'nav.workspace': 'Arbeitsbereich',
  'nav.workspace.hint': 'Mitglieder und Vorgaben',
  'nav.billing': 'Abrechnung',
  'nav.billing.hint': 'Tarif, Plätze und Rechnungen',

  /* ----------------------------------------------------------------- shared */
  'action.save': 'Änderungen speichern',
  'error.retryBody':
    'Nichts ist verloren. Prüfe deine Verbindung und versuche es noch einmal.',
  'role.owner': 'Inhaber',
  'role.admin': 'Administrator',
  'role.member': 'Mitglied',

  /* -------------------------------------------------- regional option labels */
  'regional.workspaceDefault': 'Vom Arbeitsbereich — {value}',
  'regional.currency.AUD': 'Australischer Dollar',
  'regional.currency.CAD': 'Kanadischer Dollar',
  'regional.currency.CHF': 'Schweizer Franken',
  'regional.currency.EUR': 'Euro (Eurozone)',
  'regional.currency.GBP': 'Britisches Pfund',
  'regional.currency.JPY': 'Japanischer Yen',
  'regional.currency.PLN': 'Polnischer Złoty',
  'regional.currency.SEK': 'Schwedische Krone',
  'regional.currency.USD': 'US-Dollar',
  'regional.distance.metric': 'Kilometer',
  'regional.distance.imperial': 'Meilen',

  /* ---------------------------------------------------------------- profile */
  'profile.error': 'Dein Profil wurde nicht geladen',
  'profile.account.title': 'Dein Konto',
  'profile.account.description':
    'Name und E-Mail stammen aus dem Konto, mit dem du dich anmeldest.',
  'profile.email.verified': 'E-Mail bestätigt',
  'profile.email.unverified': 'E-Mail nicht bestätigt',
  'profile.twoFactor.on': 'Zwei-Faktor aktiv',
  'profile.figure.workspace': 'Arbeitsbereich',
  'profile.figure.role': 'Rolle',
  'profile.figure.joined': 'Mitglied seit',
  'profile.figure.joinedUnknown': 'Nicht erfasst',
  'profile.regional.title': 'Datum, Geld und Einheiten',
  'profile.regional.description':
    'Diese Angaben gelten nur für dich und übergehen die Vorgaben des Arbeitsbereichs. Was auf der Vorgabe stehen bleibt, folgt weiter dem Arbeitsbereich.',
  'profile.regional.saving': 'Deine Einstellungen werden gespeichert',
  'profile.regional.saved': 'Deine Einstellungen sind gespeichert',
  'profile.regional.saveFailed': 'Deine Einstellungen wurden nicht gespeichert',
  'profile.language.label': 'Sprache',
  'profile.language.hint':
    'Wird auf einem eigenen Bildschirm gewählt, wo jede Sprache in ihrer eigenen Schrift steht.',
  'profile.language.action': 'Ändern',
  'profile.timezone.label': 'Zeitzone',
  'profile.timezone.hint':
    'Abfahrts- und Ankunftszeiten werden daran gemessen.',
  'profile.currency.label': 'Währung',
  'profile.currency.hint':
    'Neue Reisen starten in dieser Währung; jede Reise darf davon abweichen.',
  'profile.dateFormat.label': 'Datumsformat',
  'profile.weekStart.label': 'Woche beginnt am',
  'profile.weekStart.hint':
    'Gilt für jeden Kalender, auch für das Jahresraster im Urlaub.',
  'profile.distance.label': 'Entfernung',

  /* --------------------------------------------------------------- language */
  'language.error': 'Deine Spracheinstellungen wurden nicht geladen',
  'language.section.title': 'Sprache',
  'language.section.description':
    'Jeder Bildschirm, jede Schaltfläche und jedes Datum liest sich in der Sprache, die du hier wählst — dreiundzwanzig davon, jede in ihrer eigenen Schrift.',
  'language.label': 'Sprache wählen',
  'language.followWorkspace': 'Dem Arbeitsbereich folgen',
  'language.state.yours': 'Deine Sprache',
  'language.state.workspace': 'Vom Arbeitsbereich vorgegeben',
  'language.state.hint.override':
    'Deine eigene Wahl. Sie gilt nur für dich, auf jedem Gerät, mit dem du dich anmeldest.',
  'language.state.hint.workspace':
    'Du hast keine eigene Sprache gewählt, also liest du das, worauf der Arbeitsbereich eingestellt ist. Ein Inhaber oder Administrator kann das unter Arbeitsbereich ändern.',
  'language.saved': 'planned.travel spricht jetzt {language}',
  'language.saveFailed': 'Deine Sprache wurde nicht geändert',
  'language.saveFailedBody':
    'Nichts ist verloren und du liest weiterhin {language}. Prüfe deine Verbindung und wähle dann noch einmal.',
  'language.reload.title': 'Deine Sprache ist gespeichert',
  'language.reload.body':
    'Diese Seite konnte den Wechsel zu {language} nicht zu Ende bringen. Lade sie neu, um das Produkt in deiner neuen Sprache zu lesen.',
  'language.sample.title': 'So werden Datum und Zahlen gelesen',
  'language.sample.description':
    'Dieselben drei Werte, geschrieben, wie diese Sprache sie schreibt.',
  'language.sample.date': 'Ein Datum',
  'language.sample.number': 'Eine Zahl',
  'language.sample.money': 'Ein Betrag',
  'language.legal':
    'Die Nutzungsbedingungen und der Datenschutzhinweis erscheinen nur auf Englisch. Alles andere im Produkt ist übersetzt.',

  /* ------------------------------------------------------------- appearance */
  'appearance.error': 'Die Darstellung wurde nicht geladen',
  'appearance.theme.title': 'Thema',
  'appearance.theme.description':
    'Beide Themen sind gestaltet, nicht umgedreht. Nimm das, mit dem du am angenehmsten liest.',
  'appearance.theme.light': 'Hell',
  'appearance.theme.lightHint': 'Warmes Papier, den ganzen Tag',
  'appearance.theme.dark': 'Dunkel',
  'appearance.theme.darkHint': 'Warme Kohle, niemals Schwarz',
  'appearance.theme.system': 'Automatisch',
  'appearance.theme.systemHint': 'Dem Gerät folgen',
  'appearance.theme.showing': 'Zu sehen ist gerade die {palette} Palette.',
  'appearance.theme.showingSystem':
    'Zu sehen ist gerade die {palette} Palette, passend zu deinem Gerät.',
  'appearance.palette.light': 'helle',
  'appearance.palette.dark': 'dunkle',
  'appearance.motion.title': 'Bewegung und Karten',
  'appearance.motion.label': 'Bewegung reduzieren',
  'appearance.motion.hint':
    'Kürzt Einblendungen auf ein schlichtes Aufblenden. Die Einstellung deines Betriebssystems wird ohnehin immer beachtet.',
  'appearance.map.label': 'Kartenstil',
  'appearance.map.hint': 'Die Grundkarte für Planer und Weltkarte.',
  'appearance.map.workspace': 'Dem Arbeitsbereich folgen',
  'appearance.map.light': 'Papier — hell',
  'appearance.map.dark': 'Kohle — dunkel',
  'appearance.saveFailed': 'Diese Änderung wurde nicht gespeichert',
  'appearance.saveFailedBody':
    'Hier ist sie zu sehen, auf dem nächsten Gerät, mit dem du dich anmeldest, aber nicht.',

  /* --------------------------------------------------------------- security */
  'security.error': 'Die Sicherheit wurde nicht geladen',
  'security.unverified.title': 'Deine E-Mail-Adresse ist noch nicht bestätigt',
  'security.unverified.body':
    'Neue Passwörter und Reiseeinladungen gehen an {email}. Die Bestätigung ist der Nachweis, dass die Adresse dir gehört.',
  'security.unverified.action': 'Link noch einmal senden',
  'security.signin.title': 'Anmeldung',
  'security.signin.description':
    'Wie du nachweist, dass du es bist. Zwei-Faktor und Zugangsschlüssel sind beide stärker als ein Passwort allein.',
  'security.email.label': 'E-Mail-Adresse',
  'security.email.verified': 'Bestätigt',
  'security.email.unverified': 'Nicht bestätigt',
  'security.password.label': 'Passwort',
  'security.password.hint':
    'Ändere es, wann du willst — du bekommst einen einmaligen Link, statt nach dem alten gefragt zu werden.',
  'security.password.action': 'Passwort ändern',
  'security.twoFactor.label': 'Zwei-Faktor-Anmeldung',
  'security.twoFactor.onHint':
    'Bei jeder neuen Anmeldung wird ein Code aus deiner Authenticator-App verlangt.',
  'security.twoFactor.offHint':
    'Ergänze dein Passwort um einen sechsstelligen Code aus einer Authenticator-App.',
  'security.twoFactor.on': 'An',
  'security.twoFactor.off': 'Aus',
  'security.twoFactor.manage': 'Verwalten',
  'security.twoFactor.enable': 'Einschalten',
  'security.passkeys.label': 'Zugangsschlüssel',
  'security.passkeys.hint':
    'Melde dich mit Fingerabdruck, Gesichtserkennung oder einem Sicherheitsstick an, statt etwas zu tippen.',
  'security.passkeys.action': 'Zugangsschlüssel verwalten',
  'security.session.title': 'Diese Sitzung',
  'security.session.description': 'Der Browser, in dem du das gerade liest.',
  'security.session.label': 'Angemeldet als',
  'security.session.expires': 'Läuft ab {date}',
  'security.session.expiresSoon': 'bald',
  'security.session.noExpiry': 'Kein Ablauf erfasst',
  'security.signOut.label': 'Abmelden',
  'security.signOut.hint':
    'Beendet diese Sitzung und bringt dich zurück zur Anmeldung. Andere Geräte bleiben angemeldet.',
  'security.signOut.pending': 'Du wirst abgemeldet',
  'security.signOut.failed': 'Du wurdest nicht abgemeldet',
  'security.signOut.failedBody':
    'Prüfe deine Verbindung und versuche es noch einmal.',

  /* ---------------------------------------------------------- notifications */
  'notifications.error': 'Die Mitteilungseinstellungen wurden nicht geladen',
  'notifications.title': 'Mitteilungen',
  'notifications.description':
    'Jeder Schalter gilt nur für dich. Ihn auszuschalten verhindert nie das Ereignis selbst — nur, dass wir dir davon erzählen.',
  'notifications.caption': 'Welche Mitteilungen welchen Kanal erreichen',
  'notifications.event': 'Ereignis',
  'notifications.switch': '{event}: {channel}',
  'notifications.saveFailed': 'Diese Einstellung wurde nicht gespeichert',
  'notifications.saveFailedBody':
    'Der Schalter steht wieder wie vorher. Prüfe deine Verbindung und versuche es noch einmal.',
  'notifications.channel.in_app': 'In der App',
  'notifications.channel.in_app.hint': 'Die Glocke in der Kopfzeile',
  'notifications.channel.email': 'E-Mail',
  'notifications.channel.email.hint': 'An deine Anmeldeadresse',
  'notifications.channel.push': 'Handy',
  'notifications.channel.push.hint':
    'Auf Geräten, auf denen du es erlaubt hast',
  'notifications.event.trip.invited': 'Reiseeinladungen',
  'notifications.event.trip.invited.hint':
    'Jemand nimmt dich in eine Reise auf, die er plant.',
  'notifications.event.trip.updated': 'Planänderungen',
  'notifications.event.trip.updated.hint':
    'Ein Tag, ein Halt oder ein Datum verschiebt sich auf einer Reise, auf der du bist.',
  'notifications.event.trip.starting_soon': 'Erinnerung vor der Abreise',
  'notifications.event.trip.starting_soon.hint':
    'Ein Hinweis in den Tagen vor dem Start.',
  'notifications.event.reservation.reminder': 'Buchungserinnerungen',
  'notifications.event.reservation.reminder.hint':
    'Eine Unterkunft, ein Tisch oder ein Ticket steht an.',
  'notifications.event.expense.added': 'Neue Ausgaben',
  'notifications.event.expense.added.hint':
    'Jemand trägt Geld ein, das auf einer gemeinsamen Reise ausgegeben wurde.',
  'notifications.event.expense.settled': 'Ausgeglichene Beträge',
  'notifications.event.expense.settled.hint':
    'Ein Betrag, an dem du beteiligt warst, ist bezahlt.',
  'notifications.event.list.assigned': 'Zugewiesene Punkte',
  'notifications.event.list.assigned.hint':
    'Etwas auf einer Pack- oder Aufgabenliste wird dir zugeteilt.',
  'notifications.event.collab.message': 'Gespräch zur Reise',
  'notifications.event.collab.message.hint':
    'Neue Nachrichten auf einer Reise, auf der du unterwegs bist.',
  'notifications.event.organization.invited': 'Einladungen in Arbeitsbereiche',
  'notifications.event.organization.invited.hint':
    'Du wirst in einen Arbeitsbereich eingeladen.',

  /* -------------------------------------------------------------- workspace */
  'workspace.error': 'Der Arbeitsbereich wurde nicht geladen',
  'workspace.summary.description': 'Tarif {plan} · angelegt {date}',
  'workspace.summary.createdRecently': 'kürzlich',
  'workspace.summary.billingAction': 'Tarif und Abrechnung',
  'workspace.seats.label': 'Belegte Plätze',
  'workspace.seats.value': '{used} von {limit}',
  'workspace.seats.note':
    'Offene Einladungen zählen gegen eure Plätze, damit ein Arbeitsbereich nie mehr belegt, als sein Tarif bezahlt.',
  'workspace.seatsFull.title': 'Alle Plätze dieses Tarifs sind belegt',
  'workspace.seatsFull.body':
    '{members} und {invitations} füllen alle {limit} Plätze.',
  'workspace.seatsFull.action': 'Plätze hinzubuchen',
  'workspace.members.count': {
    one: '{value} Mitglied',
    other: '{value} Mitglieder',
  },
  'workspace.invitations.count': {
    one: '{value} offene Einladung',
    other: '{value} offene Einladungen',
  },
  'workspace.members.title': 'Mitglieder',
  'workspace.members.description':
    'Alle, die die Reisen, das Geld und die Dateien in diesem Arbeitsbereich sehen.',
  'workspace.members.tableLabel': 'Mitglieder dieses Arbeitsbereichs',
  'workspace.members.person': 'Name',
  'workspace.members.role': 'Rolle',
  'workspace.members.joined': 'Dabei seit',
  'workspace.invitations.title': 'Einladungen',
  'workspace.invitations.description':
    'Menschen, die eingeladen wurden, aber noch nicht dabei sind.',
  'workspace.invitations.emptyTitle': 'Keine offenen Einladungen',
  'workspace.invitations.emptyBody':
    'Alle, die in diesen Arbeitsbereich eingeladen wurden, sind schon dabei.',
  'workspace.invitations.expires': 'Läuft ab {date}',
  'workspace.invitations.expiresSoon': 'bald',
  'workspace.defaults.title': 'Gemeinsame Vorgaben',
  'workspace.defaults.description':
    'Womit eine neue Reise und ein neues Mitglied starten. Jede und jeder darf das im eigenen Profil übergehen.',
  'workspace.defaults.readOnly': 'Nur lesen',
  'workspace.defaults.saving': 'Die Vorgaben werden gespeichert',
  'workspace.defaults.saved':
    'Die Vorgaben des Arbeitsbereichs sind gespeichert',
  'workspace.defaults.saveFailed': 'Die Vorgaben wurden nicht gespeichert',
  'workspace.defaults.saveFailedBody':
    'Nur Inhaber und Administratoren dürfen sie ändern. Prüfe deine Verbindung und versuche es dann noch einmal.',
  'workspace.currency.label': 'Standardwährung',
  'workspace.currency.hint': 'Darin werden neue Reisen budgetiert.',
  'workspace.language.label': 'Sprache',
  'workspace.language.hint':
    'Was ein Mitglied liest, das keine eigene Sprache gewählt hat.',
  'workspace.timezone.label': 'Zeitzone',
  'workspace.dateFormat.label': 'Datumsformat',
  'workspace.weekStart.label': 'Woche beginnt am',
  'workspace.distance.label': 'Entfernung',

  /* ---------------------------------------------------------------- billing */
  'billing.error': 'Die Abrechnung wurde nicht geladen',
  'billing.loading': 'Tarif und Belege werden geladen',
  'billing.status.none': 'Kein Abonnement',
  'billing.status.trialing': 'Testphase',
  'billing.status.active': 'Aktiv',
  'billing.status.past_due': 'Zahlung fehlgeschlagen',
  'billing.status.unpaid': 'Unbezahlt',
  'billing.status.paused': 'Pausiert',
  'billing.status.canceled': 'Gekündigt',
  'billing.status.incomplete': 'Unvollständig',
  'billing.status.incomplete_expired': 'Abgelaufen',

  'billing.checkout.completeTitle': 'Zahlung eingegangen',
  'billing.checkout.completeBody':
    'Dein neuer Tarif wird gerade übernommen. Er erscheint hier, sobald Stripe ihn bestätigt — meist innerhalb weniger Sekunden.',
  'billing.checkout.cancelledTitle': 'Bezahlvorgang abgebrochen',
  'billing.checkout.cancelledBody':
    'Es wurde nichts abgebucht und dein Tarif ist unverändert.',
  'billing.portal.backTitle': 'Zurück von Stripe',
  'billing.portal.backBody':
    'Was du dort geändert hast, landet hier, sobald Stripe es bestätigt.',
  'billing.refresh': 'Aktualisieren',
  'billing.readOnly.title': 'Du bist Mitglied dieses Arbeitsbereichs',
  'billing.readOnly.body':
    'Nur Inhaber und Administratoren können das Abonnement ändern. Alles darunter kannst du nur lesen.',

  'billing.hero.label': 'Aktueller Tarif',
  'billing.hero.endsAtPeriod': 'Endet zum Periodenschluss',
  'billing.hero.perYear': '/ Jahr',
  'billing.hero.perMonth': '/ Monat',
  'billing.hero.freeAllowance': '{trips} Reisen, eine Person',
  'billing.hero.perSeatLine': '{seats} Mitglieder × {price}',
  'billing.hero.singleTraveller': 'Eine reisende Person',
  'billing.hero.paymentMethod': 'Zahlungsmittel',
  'billing.hero.cancel': 'Tarif kündigen',
  'billing.price.free': 'Kostenlos',
  'billing.stripe.opening': 'Stripe wird geöffnet',
  'billing.stripe.failed': 'Stripe war nicht erreichbar',
  'billing.stripe.failedBody':
    'Es wurde nichts abgebucht. Prüfe deine Verbindung und versuche es gleich noch einmal.',

  'billing.renewal.trialEndsToday':
    'Deine Testphase endet heute. Hinterlege eine Karte, damit alle Module offen bleiben.',
  'billing.renewal.trialEndsIn': {
    one: 'Deine Testphase endet in {value} Tag. Bis dahin brauchst du keine Karte.',
    other:
      'Deine Testphase endet in {value} Tagen. Bis dahin brauchst du keine Karte.',
  },
  'billing.renewal.trialEnded': 'Deine Testphase ist vorbei.',
  'billing.renewal.endsNoDate':
    'Dieser Tarif ist zum Auslaufen vorgemerkt und verlängert sich nicht.',
  'billing.renewal.endsOn':
    'Dieser Tarif endet am {date}. Gelöscht wird nichts — die bezahlten Module schließen einfach zu.',
  'billing.renewal.pastDue':
    'Die letzte Zahlung ging nicht durch. Aktualisiere deine Karte, damit die bezahlten Module bleiben.',
  'billing.renewal.unpaid':
    'Dieses Abonnement ist unbezahlt und die bezahlten Module sind zu.',
  'billing.renewal.paused':
    'Dieses Abonnement pausiert. Setz es fort, sobald du wieder losziehst.',
  'billing.renewal.lapsed':
    'Wähle unten einen Tarif, um Buchungen, Tagebuch und Offline-Karten wieder zu öffnen.',
  'billing.renewal.incomplete':
    'Stripe wartet noch auf die Bestätigung dieser Zahlung.',
  'billing.renewal.free':
    'Zwei Reisen gleichzeitig, aufs Haus. Wechsle, sobald dir das zu eng wird.',
  'billing.renewal.auto': 'Verlängert sich automatisch.',
  'billing.renewal.renewsOn': 'Verlängert sich am {date}.',

  'billing.usage.title': 'Nutzung',
  'billing.usage.description':
    'Live gezählt, damit kein Balken veraltet. Die Grenzen richten sich nach dem Tarif, der gerade gilt.',
  'billing.quota.seats': 'Mitglieder',
  'billing.quota.trips': 'Reisen',
  'billing.quota.storageBytes': 'Speicher',
  'billing.quota.unlimited': 'Unbegrenzt',
  'billing.quota.noLimit': 'In diesem Tarif ohne Grenze',
  'billing.quota.used': '{quota} belegt',
  'billing.quota.over.seats': {
    one: '{value} Platz über der Grenze dieses Tarifs',
    other: '{value} Plätze über der Grenze dieses Tarifs',
  },
  'billing.quota.over.trips': {
    one: '{value} Reiseplatz über der Grenze dieses Tarifs',
    other: '{value} Reiseplätze über der Grenze dieses Tarifs',
  },
  'billing.quota.over.storage': '{value} über der Grenze dieses Tarifs',
  'billing.quota.exhausted.seats': 'Alle Plätze dieses Tarifs sind belegt',
  'billing.quota.exhausted.trips': 'Alle Reiseplätze dieses Tarifs sind belegt',
  'billing.quota.exhausted.storage': 'Der Speicher dieses Tarifs ist voll',
  'billing.quota.left': 'noch {value}',

  'billing.plans.title': 'Tarife',
  'billing.plans.description':
    'Wechsle den Tarif, wann du willst. Nach oben wird taggenau verrechnet; nach unten wartet der Wechsel, bis die bezahlte Periode vorbei ist.',
  'billing.interval.label': 'Abrechnungsintervall',
  'billing.interval.monthly': 'Monatlich',
  'billing.interval.yearly': 'Jährlich',
  'billing.interval.saving': '{value} sparen',
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Plane deine nächsten zwei Reisen',
  'billing.plan.free.feature.trips': 'Zwei Reisen gleichzeitig',
  'billing.plan.free.feature.itinerary': 'Ablauf Tag für Tag, auf der Karte',
  'billing.plan.free.feature.lists': 'Packlisten und einfache Budgets',
  'billing.plan.free.feature.atlas':
    'Die Weltkarte, die festhält, wo du gewesen bist',
  'billing.plan.solo.name': 'Einzel',
  'billing.plan.solo.tagline': 'Für alle, die jede Kleinigkeit selbst planen',
  'billing.plan.solo.feature.trips': 'Unbegrenzt viele Reisen',
  'billing.plan.solo.feature.modules':
    'Alle Planungsmodule — Buchungen, Tagebuch, Budgets, Packen',
  'billing.plan.solo.feature.offline':
    'Offline-Karten, die du vor dem Abflug lädst',
  'billing.plan.solo.feature.export': 'Export als PDF und Kalender',
  'billing.plan.crew.name': 'Gruppe',
  'billing.plan.crew.tagline': 'Für Familien, Freundeskreise und kleine Teams',
  'billing.plan.crew.feature.members':
    'Bis zu zehn Mitglieder, pro Person abgerechnet',
  'billing.plan.crew.feature.realtime':
    'Zusammenarbeit in Echtzeit, jede Hand sichtbar auf der Karte',
  'billing.plan.crew.feature.everything':
    'Unbegrenzt viele Reisen und alle Module',
  'billing.plan.crew.feature.storage':
    'Gemeinsamer Platz für die Fotos und Dokumente aller',

  'billing.plan.current': 'Aktueller Tarif',
  'billing.plan.currentBadge': 'Aktuell',
  'billing.plan.popular': 'Beliebt',
  'billing.plan.moveTo': 'Zu {plan} wechseln',
  'billing.plan.switchYearly': 'Auf jährlich wechseln',
  'billing.plan.switchMonthly': 'Auf monatlich wechseln',
  'billing.plan.upgradeTo': 'Auf {plan} hochstufen',
  'billing.plan.changeTo': 'Auf {plan} umstellen',
  'billing.plan.perMemberMonth': '/ Mitglied / Monat',
  'billing.plan.perMonth': '/ Monat',
  'billing.plan.alwaysFree': 'Immer gratis, ohne Karte',
  'billing.plan.billedYearly': '{amount} jährlich abgerechnet',
  'billing.plan.billedMonthly': '{amount} monatlich abgerechnet',
  'billing.plan.members': 'Mitglieder',
  'billing.plan.membersHint': 'Jederzeit änderbar — die Abrechnung folgt mit.',
  'billing.plan.seatOption': {
    one: '{value} Mitglied',
    other: '{value} Mitglieder',
  },

  'billing.invoices.title': 'Rechnungen',
  'billing.invoices.description':
    'Jeder Beleg dieses Arbeitsbereichs, der neueste zuerst.',
  'billing.invoices.portal': 'Abrechnungsportal',
  'billing.invoices.unavailableTitle': 'Die Belege laden nicht',
  'billing.invoices.unavailableBody':
    'Stripe hat für die Historie nicht rechtzeitig geantwortet. Alles darüber ist aktuell; öffne für den vollständigen Verlauf das Abrechnungsportal, oder schau gleich noch einmal vorbei.',
  'billing.invoices.emptyTitle': 'Noch keine Rechnungen',
  'billing.invoices.emptyCustomer':
    'Der erste Beleg erscheint hier, sobald eine Abrechnungsperiode endet.',
  'billing.invoices.emptyNoCustomer':
    'Diesem Arbeitsbereich wurde noch nie etwas berechnet. Wähle einen bezahlten Tarif, dann sammeln sich die Belege hier.',
  'billing.invoices.tableLabel': 'Rechnungsverlauf',
  'billing.invoices.number': 'Rechnung',
  'billing.invoices.date': 'Datum',
  'billing.invoices.period': 'Zeitraum',
  'billing.invoices.amount': 'Betrag',
  'billing.invoices.status': 'Zahlungsstatus',
  'billing.invoices.receipt': 'Beleg',
  'billing.invoices.view': 'Ansehen',
  'billing.invoice.paid': 'Bezahlt',
  'billing.invoice.open': 'Offen',
  'billing.invoice.draft': 'Entwurf',
  'billing.invoice.void': 'Storniert',
  'billing.invoice.uncollectible': 'Uneinbringlich',
} satisfies TranslationOf<typeof En>

export default messages
