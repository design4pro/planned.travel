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
 * invoice and Polar carry and no reader ever sees.
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
  'workspace.invite.invite': 'Einladen',
  'workspace.invite.resend': 'Erneut senden',
  'workspace.invite.revoke': 'Widerrufen',
  'workspace.invite.confirm': 'Einladung widerrufen',
  'workspace.invite.expired': 'Abgelaufen',
  'workspace.invite.by': 'Eingeladen von {name}',
  'workspace.invite.sent': 'Einladung gesendet',
  'workspace.invite.revoked': 'Einladung widerrufen',
  'workspace.invite.delivery':
    'Einladung gespeichert, aber der E-Mail-Versand ist fehlgeschlagen. Bitte erneut senden.',
  'workspace.invite.duplicate':
    'Eine Einladung steht bereits aus. Bitte erneut senden.',
  'workspace.invite.existing':
    'Diese Person ist bereits Mitglied des Arbeitsbereichs.',
  'workspace.invite.failed':
    'Einladung nicht verfügbar. Liste aktualisieren und erneut versuchen.',
  'workspace.invite.reload': 'Einladungen aktualisieren',

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
  'appearance.map.workspaceHint':
    'Was der Inhaber des Arbeitsbereichs gewählt hat.',
  'appearance.map.auto': 'Automatisch',
  'appearance.map.autoHint': 'Folgt dem hellen oder dunklen Erscheinungsbild.',
  'appearance.map.paper': 'Papier',
  'appearance.map.paperHint': 'Warm und hell, in jedem Erscheinungsbild.',
  'appearance.map.charcoal': 'Kohle',
  'appearance.map.charcoalHint': 'Warm und dunkel, in jedem Erscheinungsbild.',
  'appearance.map.quiet': 'Ruhig',
  'appearance.map.quietHint':
    'Ohne Straßennamen, damit die Pins zuerst gelesen werden.',
  /* The shoulder-safety switch: the bookings desk and the transports tab both obey it. */
  'appearance.privacy.title': 'Auf einem geteilten Bildschirm',
  'appearance.privacy.codesLabel':
    'Bestätigungscodes verbergen, bis ich sie sehen möchte',
  'appearance.privacy.codesHint':
    'Buchungsreferenzen und Bestätigungsnummern bleiben im Buchungsbereich und bei den Transporten verdeckt, bis Sie darauf klicken oder tippen, und werden wieder verdeckt, sobald Sie weitergehen. Preise werden nie verborgen.',
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
    'Bei der Anmeldung mit E-Mail und Passwort wird ein Code aus deiner Authenticator-App abgefragt, außer du vertraust diesem Browser.',
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

  'notifications.event.billing.plan_changed': 'Abo-Änderungen',
  'notifications.event.billing.plan_changed.hint':
    'Dein Arbeitsbereich wechselt den Tarif.',
  'notifications.event.billing.invoice_paid': 'Zahlungsbelege',
  'notifications.event.billing.invoice_paid.hint':
    'Eine Rechnung deines Arbeitsbereichs wurde bezahlt.',
  'notifications.event.billing.payment_failed': 'Zahlungsprobleme',
  'notifications.event.billing.payment_failed.hint':
    'Eine Abbuchung für deinen Arbeitsbereich ist fehlgeschlagen.',

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

  'billing.return.pending': 'Planänderung wird geprüft',
  'billing.return.checking': 'Abrechnungsstatus wird geprüft',
  'billing.return.confirmed': 'Plan bestätigt',
  'billing.return.scheduled': 'Planänderung vorgemerkt',
  'billing.return.delayed': 'Die Bestätigung dauert länger',
  'billing.return.body':
    'Aktualisiere die Seite, um erneut zu prüfen. Bleibt die Änderung unbestätigt, kontaktiere den Support.',
  'billing.return.scheduledBody':
    'Die Änderung gilt ab {date}. Bis dahin bleibt dein aktueller Plan bestehen. Änderungen der Anzahl der Plätze sind damit nicht bestätigt.',

  'billing.checkout.cancelledTitle': 'Bezahlvorgang abgebrochen',
  'billing.checkout.cancelledBody':
    'Es wurde nichts abgebucht und dein Tarif ist unverändert.',
  'billing.portal.backTitle': 'Zurück von Polar',
  'billing.portal.backBody':
    'Was du dort geändert hast, landet hier, sobald Polar es bestätigt.',
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
  'billing.price.free': 'Kostenlos',
  'billing.provider.opening': 'Polar wird geöffnet',
  'billing.renewal.trialEndsToday':
    'Deine Testphase endet heute. Die erste Abbuchung folgt, sofern du vorher nicht kündigst.',
  'billing.renewal.trialEndsIn': {
    one: 'Deine Testphase endet in {value} Tag, danach folgt die erste Abbuchung, sofern du vorher nicht kündigst.',
    other:
      'Deine Testphase endet in {value} Tagen, danach folgt die erste Abbuchung, sofern du vorher nicht kündigst.',
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
    'Wähle unten einen Tarif, um Buchungen und Tagebuch wieder zu öffnen.',
  'billing.renewal.incomplete':
    'Polar wartet noch auf die Bestätigung dieser Zahlung.',
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
  'billing.quota.places': 'Orte',
  'billing.quota.placesHint': 'Über alle Reisen in diesem Arbeitsbereich',
  'billing.quota.exhausted.places': 'Das Kontingent für Orte ist aufgebraucht',
  'billing.quota.over.places': 'Limit für Orte um {value} überschritten',
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
  'billing.plan.free.name': 'Gratis',
  'billing.plan.free.tagline': 'Plane deine nächsten zwei Reisen',
  'billing.plan.free.feature.trips':
    'Zwei Reisen gleichzeitig und bis zu 150 Orte',
  'billing.plan.free.feature.itinerary': 'Ablauf Tag für Tag, auf der Karte',
  'billing.plan.free.feature.lists': 'Packlisten und einfache Budgets',
  'billing.plan.free.feature.atlas':
    'Die Weltkarte, die festhält, wo du gewesen bist',
  'billing.plan.solo.name': 'Einzel',
  'billing.plan.solo.tagline': 'Für alle, die jede Kleinigkeit selbst planen',
  'billing.plan.solo.feature.trips': 'Unbegrenzt viele Reisen und Orte',
  'billing.plan.solo.feature.modules':
    'Alle Planungsmodule — Buchungen, Tagebuch, Budgets, Packen',
  'billing.plan.solo.feature.storage': '5 GB für Fotos und Dokumente',
  'billing.plan.solo.feature.export': 'Export als PDF und Kalender',
  'billing.plan.crew.name': 'Gruppe',
  'billing.plan.crew.tagline': 'Für Familien, Freundeskreise und kleine Teams',
  'billing.plan.crew.feature.members':
    'Bis zu zehn Mitglieder, pro Person abgerechnet',
  'billing.plan.crew.feature.realtime':
    'Zusammenarbeit in Echtzeit, jede Hand sichtbar auf der Karte',
  'billing.plan.crew.feature.everything':
    'Unbegrenzt viele Reisen und Orte sowie alle Module',
  'billing.plan.crew.feature.storage':
    'Gemeinsamer Platz für die Fotos und Dokumente aller',

  'billing.plan.current': 'Aktueller Tarif',
  'billing.plan.currentBadge': 'Aktuell',
  'billing.plan.popular': 'Beliebt',
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

  'billing.invoices.number': 'Rechnung',
  'billing.invoices.date': 'Datum',
  'billing.invoices.amount': 'Betrag',
  'billing.invoices.status': 'Zahlungsstatus',
  'billing.invoice.paid': 'Bezahlt',
  'billing.invoice.draft': 'Entwurf',
  'billing.invoice.void': 'Storniert',
  /**
   * Polar's order vocabulary, and the actions around one order's document.
   *
   * An order is not an invoice: a draft order has no invoice at all, and an
   * order can be refunded or partly refunded. `billing.invoices.*` above was
   * written against the invoice model this replaced, so the words that describe
   * an order live here rather than being bent into that group.
   */
  'billing.provider.rejected':
    'Der Zahlungsanbieter hat die Anfrage abgelehnt. Versuche es in einem Moment erneut.',
  'billing.failure.reference': 'Referenz für den Support: {reference}',
  'billing.failure.forbidden':
    'Deine Rolle erlaubt das für die Abrechnung dieses Arbeitsbereichs nicht. Bitte eine Inhaberin, einen Inhaber oder eine Administration darum.',
  'billing.failure.providerRefused':
    'Polar hat diese Änderung nicht angenommen. Prüfe die Platzanzahl gegen deine Mitglieder und versuche es dann erneut oder nutze das Abrechnungsportal.',
  'billing.failure.rateLimited':
    'Polar ist gerade ausgelastet. Es wurde nichts geändert. Versuche es in einer Minute erneut.',
  'billing.failure.notConnected':
    'Die Abrechnung ist in dieser Bereitstellung noch nicht verbunden, daher wurde nichts geändert. Wende dich an den Support.',
  'billing.failure.orderNotInvoiceable':
    'Polar kann für diese Bestellung keine Rechnung ausstellen. Fehlen Rechnungsname oder -adresse, trage sie im Abrechnungsportal nach und versuche es erneut; andernfalls wende dich an den Support.',
  'billing.discount.toggle': 'Haben Sie einen Aktionscode?',
  'billing.discount.label': 'Aktionscode',
  'billing.discount.hint': 'Gilt für den Tarif, den Sie als Nächstes wählen.',
  'billing.discount.hintCurrent':
    'Wenden Sie ihn auf Ihren aktuellen Tarif an oder wählen Sie unten einen Tarif.',
  'billing.discount.applyCurrent': 'Auf aktuellen Tarif anwenden',
  'billing.discount.applying': 'Code wird angewendet…',
  'billing.discount.invalidFormat':
    'Codes bestehen aus 3 bis 64 Buchstaben und Ziffern.',
  'billing.discount.rejected.invalid':
    'Dieser Code ist ungültig. Prüfen Sie ihn und versuchen Sie es erneut.',
  'billing.discount.rejected.rateLimited':
    'Zu viele Codes versucht. Versuchen Sie es in einer Stunde erneut.',
  'billing.discount.rejected.notApplicable':
    'Dieser Code gilt nicht für diesen Tarif.',
  'billing.discount.rejected.busy':
    'Codes können gerade nicht geprüft werden. Versuchen Sie es in einer Minute erneut.',
  'billing.discount.nextRenewal':
    'Ihr Aktionscode gilt ab Ihrer nächsten Verlängerung.',
  'billing.discount.appliedTitle': 'Aktionscode angewendet',
  'billing.hero.manage': 'Abrechnung verwalten',
  'billing.hero.manageHint':
    'Karten, Rechnungsadresse, USt-IdNr., Belege und Kündigung liegen bei Polar, das die Rechnung ausstellt.',
  'billing.hero.manageHintNone':
    'Es gibt noch kein Abrechnungsprofil. Mit einem bezahlten Tarif unten entsteht eines, und ab dann öffnet sich das Portal.',
  'billing.portal.opening': 'Abrechnungsportal wird geöffnet',
  'billing.plan.notApplied': 'Diese Änderung wurde nicht übernommen',
  'billing.plan.cancelInPortal': 'Im Portal kündigen',
  'billing.plan.seatsOverMax': {
    one: 'Dieser Workspace hat {members} Mitglieder, und {plan} rechnet höchstens {max} ab. Entferne {value} Mitglied, bevor du wechselst.',
    other:
      'Dieser Workspace hat {members} Mitglieder, und {plan} rechnet höchstens {max} ab. Entferne {value} Mitglieder, bevor du wechselst.',
  },
  'billing.plan.seatsBelowMembers':
    'Du hast {members} Mitglieder. Wähle mindestens so viele Plätze — Polar lehnt ein Abo mit weniger Plätzen als Zuweisungen ab.',
  'billing.orders.title': 'Bestellungen',
  'billing.orders.description':
    'Jede Bestellung dieses Workspace, neueste zuerst.',
  'billing.orders.receipts': 'Alle Belege',
  'billing.orders.unavailableTitle': 'Bestellungen laden nicht',
  'billing.orders.unavailableBody':
    'Polar hat für die Historie nicht rechtzeitig geantwortet. Alles darüber ist aktuell — versuche es in einem Moment erneut oder lies den vollen Verlauf im Abrechnungsportal.',
  'billing.orders.emptyTitle': 'Noch keine Bestellungen',
  'billing.orders.emptyCustomer':
    'Die erste Rechnung erscheint hier, sobald ein Abrechnungszeitraum endet.',
  'billing.orders.emptyNoCustomer':
    'Diesem Workspace wurde noch nie etwas berechnet. Wähle einen bezahlten Tarif, dann sammeln sich die Rechnungen hier.',
  'billing.orders.tableLabel': 'Bestellverlauf',
  'billing.orders.document': 'Dokument',
  'billing.orders.dateUnknown': 'Datum unbekannt',
  'billing.order.pending': 'Ausstehend',
  'billing.order.refunded': 'Erstattet',
  'billing.order.partiallyRefunded': 'Teils erstattet',
  'billing.order.noInvoiceDraft':
    'Keine Rechnung, solange die Bestellung ein Entwurf ist',
  'billing.order.preparing': 'Wird vorbereitet',
  'billing.order.renderingHint':
    'Polar erstellt Rechnung {number} noch. Der Download kommt in wenigen Sekunden zurück.',
  'billing.order.fetching': 'Rechnung wird geholt',
  'billing.order.generating': 'Polar bereitet die Rechnung vor',
  'billing.order.pdfLabel': 'Rechnung {number} als PDF',
  'billing.order.stillWritingTitle': 'Polar schreibt diese Rechnung noch',
  'billing.order.stillWritingBody':
    'Rechnung {number} wird erstellt. Der Download kommt von selbst in wenigen Sekunden zurück.',
  'billing.order.openFailed': 'Diese Rechnung ließ sich nicht öffnen',
  // 09-S1a: the passkeys screen. 09-S1b and 09-S1c append their keys below this line.
  'passkeys.page.eyebrow': 'Konto',
  'passkeys.page.title': 'Zugangsschlüssel',
  'passkeys.page.description':
    'Mit einem Zugangsschlüssel meldest du dich per Fingerabdruck, Gesichtserkennung oder Sicherheitsstick an, statt etwas zu tippen.',
  'passkeys.page.back': 'Zurück zur Sicherheit',
  'passkeys.list.label': 'Deine Zugangsschlüssel',
  'passkeys.add.action': 'Zugangsschlüssel hinzufügen',
  'passkeys.add.loading': 'Warten auf dein Gerät',
  'passkeys.add.added': 'Zugangsschlüssel hinzugefügt',
  'passkeys.add.dismissed': 'Es wurde kein Zugangsschlüssel hinzugefügt',
  'passkeys.add.exists':
    'Dieses Gerät hat bereits einen Zugangsschlüssel für dein Konto',
  'passkeys.add.failed':
    'Der Zugangsschlüssel wurde nicht hinzugefügt. Versuch es noch einmal.',
  'passkeys.add.stale':
    'Zu deiner Sicherheit erfordert die Verwaltung von Zugangsschlüsseln eine aktuelle Anmeldung. Wenn du „Erneut anmelden“ wählst, wirst du zuerst abgemeldet und dann zur Anmeldeseite weitergeleitet.',
  'passkeys.error.sessionEnded':
    'Deine Sitzung ist beendet. Melde dich erneut an, um deine Zugangsschlüssel weiter zu verwalten.',
  'passkeys.signInAgain': 'Erneut anmelden',
  'passkeys.add.limit':
    'Du hast das Limit von {value} Zugangsschlüsseln erreicht. Entferne einen, um einen weiteren hinzuzufügen.',
  'passkeys.add.unsupported':
    'Dieser Browser kann keine Zugangsschlüssel erstellen. Probiere einen anderen Browser oder ein anderes Gerät.',
  'passkeys.empty.title': 'Noch keine Zugangsschlüssel',
  'passkeys.empty.body':
    'Füge einen hinzu und melde dich per Fingerabdruck, Gesichtserkennung oder Sicherheitsstick an, statt etwas zu tippen.',
  'passkeys.row.fallbackName': 'Zugangsschlüssel · hinzugefügt am {date}',
  'passkeys.row.added': 'Hinzugefügt am {date}',
  'passkeys.row.lastUsed': 'Zuletzt verwendet am {date}',
  'passkeys.row.neverUsed': 'Noch nicht zum Anmelden verwendet',
  'passkeys.badge.synced': 'Synchronisiert',
  'passkeys.badge.singleDevice': 'Nur auf einem Gerät',
  'passkeys.error.title': 'Deine Zugangsschlüssel wurden nicht geladen',
  'passkeys.error.retry': 'Erneut versuchen',
  'passkeys.error.rateLimited':
    'Zu viele Versuche. Versuch es in ein paar Minuten noch einmal.',
  'passkeys.error.generic':
    'Prüfe deine Verbindung und versuch es noch einmal.',
  // 09-S1b: naming a passkey.
  'passkeys.rename.action': '{name} umbenennen',
  'passkeys.rename.fieldLabel': 'Gib diesem Zugangsschlüssel einen Namen',
  'passkeys.rename.placeholder': 'Gib ihm einen Namen, z. B. Diensthandy',
  'passkeys.rename.saving': 'Name wird gespeichert',
  'passkeys.rename.saved': 'Name gespeichert',
  'passkeys.rename.failed': 'Der Name wurde nicht gespeichert',
  // 09-S1c: taking a passkey away.
  'passkeys.delete.action': '{name} entfernen',
  'passkeys.delete.title': 'Diesen Zugangsschlüssel entfernen?',
  'passkeys.delete.body': 'Du kannst dich dann nicht mehr mit {name} anmelden.',
  'passkeys.delete.password': 'Passwort',
  'passkeys.delete.passwordHint': 'Gib zur Bestätigung dein Passwort ein.',
  'passkeys.delete.confirmOnly':
    'Dein Konto hat kein Passwort. Bestätige, dass du diesen Zugangsschlüssel entfernen möchtest.',
  'passkeys.delete.confirm': 'Zugangsschlüssel entfernen',
  'passkeys.delete.cancel': 'Abbrechen',
  'passkeys.delete.wrongPassword': 'Dieses Passwort ist nicht richtig.',
  'passkeys.delete.stale':
    'Zu deiner Sicherheit erfordert das Entfernen eines Zugangsschlüssels eine aktuelle Anmeldung. Wenn du „Erneut anmelden“ wählst, wirst du zuerst abgemeldet und dann zur Anmeldeseite weitergeleitet.',
  'passkeys.delete.removed': 'Zugangsschlüssel entfernt',
  'passkeys.delete.failed':
    'Der Zugangsschlüssel wurde nicht entfernt. Versuche es erneut.',
  'passkeys.delete.removing': 'Zugangsschlüssel wird entfernt',
  'passkeys.delete.passwordRequired':
    'Gib dein Passwort ein, um diesen Zugangsschlüssel zu entfernen.',
  'workspace.departure.leave': 'Arbeitsbereich verlassen',
  'workspace.departure.remove': 'Mitglied entfernen',
  'workspace.departure.title': 'Mitgliedschaft in {workspace} beenden?',
  'workspace.departure.body':
    '{name} verliert den Zugriff auf {workspace}. Das Konto sowie aufbewahrte Reisen und Kostenaufzeichnungen bleiben erhalten.',
  'workspace.departure.cancel': 'Abbrechen',
  'workspace.departure.pending': 'Mitgliedschaft wird beendet…',
  'workspace.departure.lastOwner':
    'Ernenne ein anderes Mitglied zum Eigentümer, bevor du den Arbeitsbereich verlässt oder diesen Eigentümer entfernst.',
  'workspace.departure.notPermitted':
    'Deine aktuelle Rolle erlaubt es nicht, dieses Mitglied zu entfernen. Aktualisiere die Mitgliederliste und versuche es erneut.',
  'workspace.departure.notFound':
    'Diese Person ist kein Mitglied dieses Arbeitsbereichs mehr.',
  'workspace.departure.impersonated':
    'Beende die Identitätsübernahme, bevor du die Mitgliedschaft im Arbeitsbereich änderst.',
  'workspace.departure.failed':
    'Das Ergebnis konnte nicht bestätigt werden. Lade den Arbeitsbereich neu und versuche es erneut.',
  'workspace.departure.removed': 'Mitglied entfernt',
  'workspace.departure.reload': 'Arbeitsbereich neu laden',
  'workspace.departure.activationFailed':
    'Du hast diesen Arbeitsbereich verlassen. Öffne den nächsten, um fortzufahren.',
  'workspace.departure.recover': 'Nächsten Arbeitsbereich öffnen',
  'twoFactor.back': 'Zurück zur Sicherheit',
  'twoFactor.title': 'Zwei-Faktor-Authentifizierung',
  'twoFactor.description':
    'Füge beim Anmelden mit E-Mail und Passwort einen zweiten Schritt hinzu.',
  'twoFactor.error':
    'Deine Zwei-Faktor-Einstellungen konnten nicht geladen werden.',
  'twoFactor.steps.label': 'Zwei-Faktor einrichten',
  'twoFactor.steps.password': 'Bestätige deine Identität',
  'twoFactor.steps.key': 'Zur Authenticator-App hinzufügen',
  'twoFactor.steps.confirm': 'Code eingeben',
  'twoFactor.steps.state.done': 'Erledigt',
  'twoFactor.steps.state.current': 'Aktueller Schritt',
  'twoFactor.steps.state.todo': 'Nicht begonnen',
  'twoFactor.password.label': 'Dein Passwort',
  'twoFactor.password.hint':
    'Wir fragen erneut, bevor sich deine Anmeldung ändert.',
  'twoFactor.password.submit': 'Weiter',
  'twoFactor.password.pending': 'Wird eingerichtet',
  'twoFactor.password.invalid': 'Dieses Passwort stimmt nicht.',
  'twoFactor.key.intro':
    'Du brauchst eine Authenticator-App auf deinem Handy. Füge diesen Schlüssel hinzu und kehre hierher zurück. Zwei-Faktor ist noch nicht aktiviert.',
  'twoFactor.key.matrixLabel':
    'Einrichtungscode. Derselbe Schlüssel ist als Text verfügbar',
  'twoFactor.key.matrixFailed':
    'Für diesen Schlüssel konnte kein Code erstellt werden. Gib den Einrichtungsschlüssel in deiner App ein.',
  'twoFactor.key.label': 'Einrichtungsschlüssel',
  'twoFactor.key.copy': 'Schlüssel kopieren',
  'twoFactor.key.copied': 'Schlüssel kopiert',
  'twoFactor.key.copyFailed':
    'Dein Browser konnte den Schlüssel nicht kopieren. Markiere und kopiere ihn manuell.',
  'twoFactor.key.open': 'In deiner Authenticator-App öffnen',
  'twoFactor.key.startOver': 'Neu beginnen',
  'twoFactor.key.startOverHint':
    'Dabei wird ein neuer Schlüssel erstellt. Ein bereits zur App hinzugefügter Schlüssel funktioniert dann nicht mehr.',
  'twoFactor.key.next': 'Ich habe ihn hinzugefügt',
  'twoFactor.code.label': 'Code aus der App',
  'twoFactor.code.hint': 'Die sechs Ziffern, die die App gerade zeigt.',
  'twoFactor.code.submit': 'Zwei-Faktor aktivieren',
  'twoFactor.code.pending': 'Wird geprüft',
  'twoFactor.code.invalid':
    'Der Code stimmt nicht. Prüfe die Uhrzeit deines Handys und gib den neuesten Code der App ein.',
  'twoFactor.code.unclear':
    'Wir konnten nicht feststellen, ob es geklappt hat. Gib den neuesten Code ein, um es erneut zu versuchen.',
  'twoFactor.rateLimited.title': 'Zu viele Versuche in kurzer Zeit',
  'twoFactor.rateLimited.password':
    'Warte etwa zehn Sekunden und versuche es erneut. Deine Eingaben bleiben erhalten.',
  'twoFactor.rateLimited.code':
    'Warte bis zu einer Minute und versuche es erneut. Deine Eingaben bleiben erhalten.',
  'twoFactor.codes.title': 'Deine Ersatzcodes',
  'twoFactor.codes.body':
    'Jeder Code funktioniert einmal, falls du dein Handy verlierst. Sie werden nur jetzt angezeigt. Bewahre sie sicher auf.',
  'twoFactor.codes.copyAll': 'Alle kopieren',
  'twoFactor.codes.copied': 'Ersatzcodes kopiert',
  'twoFactor.codes.download': 'Als Textdatei herunterladen',
  'twoFactor.codes.copyFailed':
    'Dein Browser konnte die Codes nicht kopieren. Markiere und kopiere sie manuell.',
  'twoFactor.codes.stored': 'Ich habe diese Ersatzcodes gespeichert',
  'twoFactor.codes.done': 'Fertig',
  'twoFactor.codes.gate': 'Aktiviere das Kästchen, um fortzufahren.',
  'twoFactor.codes.lost':
    'Wenn du diese Seite vorher verlässt, kannst du hier einen neuen Satz erstellen. Der alte funktioniert dann nicht mehr.',
  'twoFactor.codes.leave.title': 'Ohne gespeicherte Codes verlassen?',
  'twoFactor.codes.leave.body':
    'Deine Ersatzcodes werden nur einmal angezeigt. Wenn du jetzt gehst, kannst du hier einen neuen Satz erstellen. Der alte funktioniert dann nicht mehr.',
  'twoFactor.codes.leave.stay': 'Hier bleiben',
  'twoFactor.codes.leave.go': 'Verlassen',
  'twoFactor.on.title': 'Zwei-Faktor ist aktiviert',
  'twoFactor.on.badge': 'Aktiviert',
  'twoFactor.on.body':
    'Bei der Anmeldung mit E-Mail und Passwort fragen wir nach einem App-Code, außer du vertraust diesem Browser. Die Anmeldung mit Google, Apple oder einem Passkey erfordert keinen Code.',
  'twoFactor.replace.action': 'Ersatzcodes ersetzen',
  'twoFactor.replace.title': 'Deine Ersatzcodes ersetzen?',
  'twoFactor.replace.body':
    'Du erhältst einen neuen Satz. Der aktuelle funktioniert nicht mehr, sobald du fortfährst.',
  'twoFactor.replace.confirm': 'Ersetzen',
  'twoFactor.replace.pending': 'Wird ersetzt',
  'twoFactor.nopassword.title': 'Zuerst ein Passwort festlegen',
  'twoFactor.nopassword.body':
    'Zwei-Faktor benötigt ein Passwort für dieses Konto. Die nächste Seite fragt nach deiner E-Mail und sendet einen Link zum Festlegen. Dabei wirst du überall abgemeldet. Melde dich danach erneut an und kehre hierher zurück.',
  'twoFactor.nopassword.action': 'Passwort festlegen',
  'twoFactor.setup.action': 'Einrichtungsschlüssel erneut anzeigen',
  'twoFactor.setup.title': 'Einrichtungsschlüssel',
  'twoFactor.setup.body':
    'Füge diesen Schlüssel auf einem weiteren Gerät hinzu. Der Schlüssel auf deinen anderen Geräten funktioniert weiterhin.',
  'twoFactor.setup.done': 'Fertig',
  'twoFactor.setup.confirm': 'Schlüssel anzeigen',
  'twoFactor.setup.pending': 'Wird geprüft',
  'twoFactor.off.action': 'Zwei-Faktor-Authentifizierung ausschalten',
  'twoFactor.off.title': 'Zwei-Faktor-Authentifizierung ausschalten?',
  'twoFactor.off.body':
    'Wer dein Passwort kennt, kann sich ohne Code anmelden. Deine anderen angemeldeten Geräte bleiben angemeldet.',
  'twoFactor.off.confirm': 'Ausschalten',
  'twoFactor.off.pending': 'Wird ausgeschaltet',
  'twoFactor.off.cancel': 'Eingeschaltet lassen',
  'twoFactor.off.done': 'Zwei-Faktor-Authentifizierung ist ausgeschaltet',
} satisfies TranslationOf<typeof En>

export default messages
