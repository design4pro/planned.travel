/**
 * Alles, was die Plattform-Konsole sagt, auf Deutsch.
 *
 * Geschrieben aus `../en/console.ts` (`docs/SPEC.md` §9). Die englische Datei ist das Schema;
 * `__tests__/parity.test.ts` prüft die Platzhalter, die Pluralzweige und dass hier nichts
 * Englisches liegen geblieben ist.
 *
 * **Zwei Rollenskalen, die sich nie mischen** (§5). Auf der Plattform gibt es „Administrator“,
 * „Kurator“ und „Benutzer“; im Arbeitsbereich „Inhaber“, „Administrator“ und „Mitglied“. Dasselbe
 * Wort fällt in beiden, also trägt der Satz darum herum den Unterschied, nicht das Wort selbst.
 *
 * **„Suspend“ ist eine Sperre, die sich aufheben lässt.** Das Konto wird gesperrt, nicht gelöscht,
 * und das Prüfprotokoll hält beides fest — deshalb überall „gesperrt“ und „Sperre aufheben“.
 *
 * **„Name“ steht hier als „Anzeigename“.** Ein Konto trägt genau einen sichtbaren Namen, und die
 * längere Form sagt an einer Spaltenüberschrift eindeutig, welcher gemeint ist.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/console'

const messages = {
  /* ------------------------------------------------------------- Bereiche -- */

  'nav.label': 'Bereiche der Konsole',
  'nav.overview': 'Übersicht',
  'nav.overview.description': 'Die Plattform auf einen Blick',
  'nav.accounts': 'Konten',
  'nav.accounts.description': 'Rollen, Sperren und Sitzungen',
  'nav.runs': 'Agentenläufe',
  'nav.runs.description': 'Woran die Sandcastle-Flotte baut',

  /* ---------------------------------------------------------------- Hülle -- */

  'shell.eyebrow': 'Plattform',
  'shell.title': 'Konsole',
  'shell.description':
    'Das Produkt selbst — Konten, Befugnisse und der gemeinsame Katalog',
  'shell.signedInAs': 'Angemeldet als',
  'shell.error.title': 'Die Konsole wurde nicht geladen',
  'shell.notFound.title': 'Kein solches Konto',
  'shell.notFound.body':
    'Nichts auf der Plattform trägt diese Kennung. Das Konto wurde vielleicht gelöscht, nachdem der Link entstand, oder die Adresse ist vertippt.',
  'shell.allAccounts': 'Alle Konten',
  'shell.overview': 'Übersicht der Konsole',

  'failure.fallback':
    'Die Aktion ist nicht durchgegangen. Versuche es gleich noch einmal.',

  /* -------------------------------------------------------------- Übersicht -- */

  'overview.error.title': 'Die Übersicht wurde nicht geladen',
  'overview.standing.title': 'Deine Befugnisse auf der Plattform',
  'overview.standing.body':
    'Konten, Sitzungen und das Handeln in fremdem Namen gehören einem Plattform-Administrator, deshalb zeigt dir die Konsole den Katalog und sonst nichts.',
  'overview.stat.accounts': 'Konten',
  'overview.stat.accounts.caption': {
    one: 'Eines davon trägt eine Plattformrolle',
    other: '{staff} davon tragen eine Plattformrolle',
  },
  'overview.stat.admins': 'Administratoren',
  'overview.stat.admins.caption': 'Volle Befugnis über Konten und Sitzungen',
  'overview.stat.curators': 'Kuratoren',
  'overview.stat.curators.caption': 'Nur der Katalog — nie Konten',
  'overview.stat.suspended': 'Gesperrt',
  'overview.stat.suspended.none': 'Niemand ist ausgesperrt',
  'overview.stat.suspended.some':
    'Überall abgemeldet, bis eine Sperre aufgehoben wird',
  'overview.stat.suspended.review': 'Ansehen',
  'overview.newest.label': 'Neueste Konten',
  'overview.newest.empty.title': 'Noch keine Konten',
  'overview.newest.empty.body':
    'Wer sich als Erstes registriert, erscheint hier.',
  'overview.catalogue.label': 'Katalog nach Zustand',
  'overview.catalogue.empty.title':
    'Der gemeinsame Katalog ist noch nicht geöffnet',
  'overview.catalogue.empty.body':
    'Sobald die Einlesestrecke steht, zählt diese Karte jeden Ort im gemeinsamen Katalog als Entwurf, in Prüfung oder veröffentlicht — und jede Zahl öffnet die Liste dahinter.',
  'overview.scraping.label': 'Sammelläufe',
  'overview.scraping.empty.title': 'Keine Quelle wurde ausgeführt',
  'overview.scraping.empty.body':
    'Quellen werden wöchentlich abgeholt. Nach dem ersten Lauf stehen hier die letzten fünf, mit dem, was jeder eingelesen, geändert und verworfen hat.',

  /* ---------------------------------------------------------- Rollenskala -- */

  'role.admin': 'Administrator',
  'role.admin.summary':
    'Volle Befugnis auf der Plattform: Konten, Rollen, Sperren, Sitzungen und das Handeln in fremdem Namen.',
  'role.admin.holds.accounts': 'Konten anlegen und Plattformrollen setzen',
  'role.admin.holds.bans': 'Konten sperren und Sperren aufheben',
  'role.admin.holds.sessions': 'Sitzungen beenden und Passwörter setzen',
  'role.admin.holds.impersonate':
    'Fünfzehn Minuten lang im Namen eines Kontos handeln',
  'role.admin.holds.curation': 'Alles, was ein Kurator darf',
  'role.admin.withheld.admins':
    'Im Namen eines anderen Plattform-Administrators handeln',
  'role.curator': 'Kurator',
  'role.curator.summary':
    'Katalog, Pakete, Quellen und die Moderation geteilter Links. Nichts, was Konten berührt.',
  'role.curator.holds.places':
    'Katalogorte lesen, schreiben und veröffentlichen',
  'role.curator.holds.packs': 'Ortspakete lesen, schreiben und veröffentlichen',
  'role.curator.holds.sources': 'Katalogquellen lesen und ausführen',
  'role.curator.holds.shares': 'Geteilte Links prüfen und zurückziehen',
  'role.curator.withheld.accounts':
    'Alles, was ein Konto oder eine Sitzung berührt',
  'role.curator.withheld.tokens':
    'Maschinen-Anmeldedaten ausstellen oder zurückziehen',
  'role.user': 'Benutzer',
  'role.user.summary': 'Überhaupt keine Plattformbefugnis. Das ist fast jeder.',
  'role.user.withheld.everything': 'Jede Plattformbefugnis, ohne Ausnahme',

  /* ------------------------------------------------------------ ein Konto -- */

  'identity.you': 'Das bist du',
  'status.active': 'Aktiv',
  'status.suspended': 'Gesperrt',
  'status.permanent': 'Dauerhaft',
  'status.until': 'Bis {date}',
  'status.unverified': 'Nicht bestätigt',
  'device.on': '{browser} unter {platform}',
  'device.unrecognised': 'Unbekanntes Gerät',

  /* ------------------------------------------------------------ Kontoliste -- */

  'users.error.title': 'Die Kontoliste wurde nicht geladen',
  'users.total': '{total} insgesamt',
  'users.loading': 'Konten werden geladen',
  'users.table.label': 'Konten der Plattform',
  'users.search.label': 'Konten durchsuchen',
  'users.search.email': 'E-Mail-Adressen durchsuchen',
  'users.search.name': 'Anzeigenamen durchsuchen',
  'users.search.column': 'Welche Spalte durchsuchen',
  'users.search.submit': 'Suchen',
  'users.field.email': 'E-Mail',
  'users.field.name': 'Anzeigename',
  'users.filter.role.label': 'Nach Plattformrolle filtern',
  'users.filter.role.any': 'Beliebige Rolle',
  'users.filter.role.admin': 'Administratoren',
  'users.filter.role.curator': 'Kuratoren',
  'users.filter.status.label': 'Nach Kontozustand filtern',
  'users.filter.status.any': 'Beliebiger Zustand',
  'users.filter.clear': 'Filter zurücksetzen',
  'users.filter.hint':
    'Nach Rolle oder nach Zustand eingrenzen — immer nur eines davon.',
  'users.column.account': 'Konto',
  'users.column.role': 'Plattformrolle',
  'users.column.status': 'Zustand',
  'users.column.joined': 'Dabei seit',
  'users.column.actions': 'Aktionen',
  'users.joined': 'Dabei seit {date}',
  'users.pastEnd.title': 'Diese Seite liegt hinter dem Ende',
  'users.pastEnd.body': {
    one: 'In dieser Ansicht steht ein Konto, und Seite 1 ist die einzige, die es gibt.',
    other:
      'In dieser Ansicht stehen {total} Konten, also {pages}. Seite {page} liegt dahinter.',
  },
  'users.pastEnd.pages': {
    one: 'eine einzige Seite',
    other: '{pages} Seiten',
  },
  'users.pastEnd.back': 'Zurück zur ersten Seite',
  'users.empty.filtered.title': 'Nichts passt zu diesen Filtern',
  'users.empty.filtered.body':
    'Kein Konto auf der Plattform beantwortet diese Suche. Erweitere sie, oder setze die Filter zurück, um alle zu sehen.',
  'users.empty.title': 'Keine Konten zu zeigen',
  'users.empty.body':
    'Diese Ansicht ist leer. Es ist nichts gefiltert, also gibt es hier nichts zu erweitern.',

  /* ------------------------------------------------------------ Kontoseite -- */

  'account.error.title': 'Dieses Konto wurde nicht geladen',
  'account.loading': 'Konto wird geladen',
  'account.meta.lastChange': 'Letzte Änderung',
  'account.meta.id': 'Kontokennung',
  'account.banned.title': 'Dieses Konto ist gesperrt',
  'account.banned.noReason': 'Zur Sperre wurde kein Grund festgehalten.',
  'account.banned.permanent':
    ' Sie bleibt in Kraft, bis ein Administrator sie aufhebt.',
  'account.banned.until': ' Sie endet von selbst am {date}.',
  'account.banned.untilUnknown': 'ihrem Ablaufdatum',
  'account.authority.label': 'Befugnisse auf der Plattform',
  'account.authority.may': 'Darf',
  'account.authority.mayNot': 'Darf nicht',
  'account.authority.none': 'Nichts auf der Plattform.',
  'account.workspaces.label': 'Arbeitsbereiche',
  'account.workspaces.truncated':
    'Dieses Konto gehört zu mehr Arbeitsbereichen als den {listed} hier aufgeführten.',
  'account.workspaces.empty.title': 'In keinem Arbeitsbereich',
  'account.workspaces.empty.body':
    'Dieses Konto gehört noch zu keinem Arbeitsbereich. Beim ersten Anmelden entsteht einer, und jeder weitere, zu dem es eingeladen wird, erscheint hier.',
  'account.workspaces.column.workspace': 'Arbeitsbereich',
  'account.workspaces.column.role': 'Rolle',
  'account.workspaces.column.plan': 'Tarif',
  'account.subscription.label': 'Abonnement',
  'account.subscription.free.title': 'Im kostenlosen Tarif',
  'account.subscription.free.body':
    'Der Arbeitsbereich, dem dieses Konto gehört, war nie an der Kasse, trägt also keinen Abonnementeintrag und läuft auf den Grenzen des kostenlosen Tarifs.',
  'account.subscription.none.title': 'Diesem Konto wird nichts berechnet',
  'account.subscription.none.body':
    'Diesem Konto gehört kein Arbeitsbereich. Wer Mitglied im Arbeitsbereich eines anderen ist, bekommt dessen Rechnung nicht, also gibt es hier nichts einzusammeln.',
  'account.subscription.endsAtClose': 'Endet zum Periodenende',
  'account.subscription.seats': 'Plätze',
  'account.subscription.seatsValue': '{used} von {limit}',
  'account.subscription.ends': 'Endet',
  'account.subscription.renews': 'Verlängert sich',
  'account.sessions.label': 'Laufende Sitzungen',
  'account.sessions.truncated':
    'Dieses Konto hält mehr Sitzungen, als ein Aufruf auflistet. Beende alle Sitzungen über das Aktionsmenü, um sicher zu sein, dass keine übrig bleibt.',
  'account.sessions.empty.title': 'Überall abgemeldet',
  'account.sessions.empty.body':
    'Dieses Konto hält keine Sitzung, die nicht abgelaufen wäre. Es erscheint hier, sobald es sich wieder anmeldet.',
  'account.sessions.column.device': 'Gerät',
  'account.sessions.column.address': 'Adresse',
  'account.sessions.column.started': 'Beginn',
  'account.sessions.column.expires': 'Läuft ab',
  'account.sessions.impersonated': 'Aus fremdem Namen entstanden',
  'account.sessions.noAddress': 'Nicht festgehalten',
  'account.sessions.noAddressLong': 'Adresse nicht festgehalten',
  'account.sessions.when': 'Beginn {started} · läuft ab {expires}',
  'account.audit.label': 'Prüfprotokoll',
  'account.audit.truncated':
    'Das Protokoll hält mehr Einträge als diese. Die Prüfspur der Plattform wird nur angehängt und vierhundert Tage aufbewahrt.',
  'account.audit.empty.title': 'An diesem Konto wurde nichts getan',
  'account.audit.empty.body':
    'Jeder Rollenwechsel, jede Sperre, jedes gesetzte Passwort, jede beendete Sitzung und jedes Handeln in fremdem Namen steht hier, mit dem Namen der handelnden Person. Dieses Konto hat niemand angefasst.',

  /* -------------------------------------------------- Arbeitsbereichsskala -- */

  'workspace.role.owner': 'Inhaber',
  'workspace.role.admin': 'Administrator',
  'workspace.role.member': 'Mitglied',
  'plan.free': 'Kostenlos',
  'plan.starter': 'Einstieg',
  'plan.pro': 'Profi',
  'plan.business': 'Unternehmen',
  'subscription.trialing': 'Testphase',
  'subscription.active': 'Aktiv',
  'subscription.pastDue': 'Überfällig',
  'subscription.canceled': 'Gekündigt',
  'subscription.incomplete': 'Unvollständig',
  'subscription.expired': 'Abgelaufen',
  'subscription.unpaid': 'Unbezahlt',
  'subscription.paused': 'Pausiert',

  /* ---------------------------------------------------------- Prüfprotokoll -- */

  'audit.action.created': 'Konto angelegt',
  'audit.action.updated': 'Kontodaten geändert',
  'audit.action.roleChanged': 'Plattformrolle geändert',
  'audit.action.banned': 'Konto gesperrt',
  'audit.action.unbanned': 'Sperre aufgehoben',
  'audit.action.deleted': 'Konto gelöscht',
  'audit.action.passwordSet': 'Passwort von einem Administrator gesetzt',
  'audit.action.emailSet': 'E-Mail-Adresse geändert',
  'audit.action.impersonationStarted': 'Handeln in fremdem Namen begonnen',
  'audit.action.impersonationEnded': 'Handeln in fremdem Namen beendet',
  'audit.action.sessionRevoked': 'Eine Sitzung wurde beendet',
  'audit.action.sessionRevokedAll': 'Alle Sitzungen wurden beendet',
  'audit.actor.system': 'Die Plattform selbst',
  'audit.actor.system.detail': 'automatisch',
  'audit.actor.agent': 'Maschinen-Anmeldedaten',
  'audit.actor.agent.detail': 'MCP-Token',
  'audit.actor.deleted': 'Ein gelöschtes Konto',
  'audit.actorBadge': 'Damals: {role}',
  'audit.field.name': 'Anzeigename',
  'audit.field.email': 'E-Mail-Adresse',
  'audit.field.emailVerified': 'E-Mail bestätigt',
  'audit.field.role': 'Plattformrolle',
  'audit.field.banned': 'Gesperrt',
  'audit.field.banReason': 'Grund',
  'audit.field.banExpiresAt': 'Sperre endet',
  'audit.field.revoked': 'Beendete Sitzungen',
  'audit.field.impersonating': 'Handelt als',
  'audit.field.impersonatedBy': 'Gehandelt von',
  'audit.field.expiresAt': 'Sitzung läuft ab',
  'audit.field.targetRole': 'Deren Plattformrolle',
  'audit.field.sessionId': 'Sitzung',
  'audit.value.yes': 'ja',
  'audit.value.no': 'nein',
  'audit.value.cleared': 'geleert',
  'audit.became': 'wurde zu',

  /* ---------------------------------------------------------------- Dialoge -- */

  'dialog.cancel': 'Abbrechen',

  'create.button': 'Neues Konto',
  'create.title': 'Konto anlegen',
  'create.body':
    'Die Adresse wird nicht bestätigt und es geht keine Mail hinaus — gib das Passwort selbst weiter.',
  'create.confirm': 'Konto anlegen',
  'create.name.placeholder': 'Lena Bergmann',
  'create.email': 'E-Mail-Adresse',
  'create.email.placeholder': 'lena@planned.travel',
  'create.password': 'Passwort',
  'create.password.hint':
    'Lang genug, um ein Satz zu sein. Das Konto kann es danach ändern.',
  'create.done': 'Konto angelegt',
  'create.done.body':
    '{email} kann sich mit dem Passwort anmelden, das du gesetzt hast.',

  'action.menu.label': 'Aktionen für {name}',
  'action.group.account': 'Konto',
  'action.group.credentials': 'Anmeldedaten',

  'action.role.item': 'Plattformrolle ändern',
  'action.role.self':
    'Nicht am eigenen Konto — wer sich selbst herabstuft, lässt die Plattform womöglich ohne Administrator zurück.',
  'action.role.body':
    'Was {name} auf der Plattform selbst darf. Die Mitgliedschaft in einem Arbeitsbereich ist ein eigenes Vokabular und bewegt sich nicht mit.',
  'action.role.confirm': 'Rolle speichern',
  'action.role.current': 'Derzeit',
  'action.role.done': 'Plattformrolle aktualisiert',
  'action.role.done.body':
    '{name} trägt auf der Plattform jetzt die Rolle {role}.',

  'action.impersonate.item': 'In fremdem Namen handeln',
  'action.impersonate.self':
    'Da ist niemand, in dessen Namen du handeln könntest — das ist dein eigenes Konto.',
  'action.impersonate.banned':
    'Das Konto ist gesperrt und hält deshalb keine Sitzung, die du übernehmen könntest.',
  'action.impersonate.admin':
    'Keine Rolle auf der Plattform darf im Namen eines Administrators handeln, auch deine nicht.',
  'action.impersonate.title': 'Als {name} handeln',
  'action.impersonate.body':
    'Du siehst das Produkt fünfzehn Minuten lang genau so, wie dieses Konto es sieht.',
  'action.impersonate.confirm': 'Übernahme starten',
  'action.impersonate.note.bar':
    'Ein Warnbalken bleibt auf jedem Bildschirm, bis du das beendest, und lässt sich nicht wegklicken.',
  'action.impersonate.note.platform':
    'Plattformaktionen sind gesperrt, solange du im Namen einer anderen Person handelst — die Konsole eingeschlossen.',
  'action.impersonate.note.audit':
    'Anfang und Ende stehen beide in der Prüfspur der Plattform, mit deinem Namen daran.',

  'action.password.item': 'Passwort setzen',
  'action.password.title': 'Passwort für {name} setzen',
  'action.password.body':
    'Damit holst du ein ausgesperrtes Konto zurück oder sperrst einen Angreifer aus einem übernommenen aus.',
  'action.password.confirm': 'Passwort setzen',
  'action.password.field': 'Neues Passwort',
  'action.password.hint.self':
    'Beim Speichern enden alle Sitzungen — deine auch.',
  'action.password.hint':
    'Beim Speichern enden alle Sitzungen, die das Konto hält.',
  'action.password.done': 'Passwort gesetzt',
  'action.password.done.body': '{name} wurde von jedem Gerät abgemeldet.',

  'action.sessions.item': 'Alle Sitzungen beenden',
  'action.sessions.body.self':
    'Das meldet dich von jedem Gerät ab, auch von dem, auf dem du das gerade liest.',
  'action.sessions.body':
    '{name} wird von jedem Gerät abgemeldet und muss sich neu anmelden.',
  'action.sessions.confirm': 'Sitzungen beenden',
  'action.sessions.done': 'Sitzungen beendet',
  'action.sessions.done.body': {
    one: 'Eine Sitzung wurde beendet.',
    other: '{revoked} Sitzungen wurden beendet.',
  },

  'action.ban.item': 'Konto sperren',
  'action.ban.self':
    'Nicht am eigenen Konto — wer sich selbst sperrt, nimmt sich den eigenen Weg zurück.',
  'action.ban.title': '{name} sperren',
  'action.ban.body':
    'Alle Sitzungen enden sofort, und das Konto kann sich nicht wieder anmelden, bis die Sperre aufgehoben wird oder abläuft.',
  'action.ban.confirm': 'Konto sperren',
  'action.ban.reason': 'Grund',
  'action.ban.reason.hint':
    'Wird dreizehn Monate in der Prüfspur der Plattform gehalten und niemandem außer einem Administrator gezeigt.',
  'action.ban.reason.placeholder':
    'Wiederholte Missbrauchsmeldungen aus drei Arbeitsbereichen',
  'action.ban.duration': 'Dauer',
  'action.ban.duration.label': 'Dauer der Sperre',
  'action.ban.duration.permanent.body':
    'Bleibt in Kraft, bis ein Administrator sie bewusst aufhebt.',
  'action.ban.duration.day': '24 Stunden',
  'action.ban.duration.day.body':
    'Lang genug, um zu unterbrechen, kurz genug, um ein Eingriff zu bleiben.',
  'action.ban.duration.week': '7 Tage',
  'action.ban.duration.week.body':
    'Eine Woche, um auf eine Beschwerde zu antworten.',
  'action.ban.duration.month': '30 Tage',
  'action.ban.duration.month.body': 'Ein Monat erzwungene Ruhe.',
  'action.ban.duration.quarter': '90 Tage',
  'action.ban.duration.quarter.body':
    'Das Längste, was die Konsole anbietet. Darüber hinaus: dauerhaft sperren.',
  'action.ban.done': 'Konto gesperrt',
  'action.ban.done.body':
    '{name} wurde überall abgemeldet und kann sich nicht wieder anmelden.',

  'action.unban.item': 'Sperre aufheben',
  'action.unban.title': 'Sperre für {name} aufheben',
  'action.unban.body':
    'Das Konto kann sich ab dem nächsten Versuch wieder anmelden. Keine frühere Sitzung kommt zurück.',
  'action.unban.confirm': 'Sperre aufheben',
  'action.unban.done': 'Sperre aufgehoben',
  'action.unban.done.body':
    '{name} kann sich wieder anmelden. Keine Sitzung wurde wiederhergestellt.',

  'action.delete.item': 'Konto löschen',
  'action.delete.self':
    'Nicht am eigenen Konto — von dort gibt es keinen Weg zurück.',
  'action.delete.title': '{name} löschen',
  'action.delete.body':
    'Das Konto, seine Sitzungen und alle daran hängenden Anmeldedaten werden entfernt. Das lässt sich nicht rückgängig machen.',
  'action.delete.confirm': 'Konto löschen',
  'action.delete.note':
    'Inhalte eines Arbeitsbereichs, die diese Person angelegt hat, bleiben beim Arbeitsbereich, dem sie gehören. Das Konto stattdessen zu sperren, behält den Eintrag und nimmt nur den Zugang.',
  'action.delete.done': 'Konto gelöscht',
  'action.delete.done.body': '{name} und alles, was am Konto hing, ist fort.',

  'session.revoke.label': 'Sitzung auf {device} beenden',
  'session.revoke.title': 'Diese Sitzung beenden',
  'session.revoke.body':
    '{device} muss sich bei der nächsten Anfrage neu anmelden. Ist es die Sitzung, in der du das liest, wirst du mit abgemeldet.',
  'session.revoke.confirm': 'Sitzung beenden',
  'session.revoke.done': 'Sitzung beendet',
  'session.revoke.done.body':
    'Das Gerät muss sich bei der nächsten Anfrage neu anmelden.',

  /* -------------------------------------------------------------- Agentenläufe -- */

  'runs.error.title': 'Das Laufregister hat nicht geantwortet',
  'runs.origin.local': 'Lokal',
  'runs.origin.githubActions': 'GitHub-Actions',
  'runs.stat.live': 'Laufende Läufe',
  'runs.stat.live.none': 'Gerade baut nichts',
  'runs.stat.live.some': 'Herzschlag gegen eine Fünf-Minuten-Pacht',
  'runs.stat.issues': 'Belegte Tickets',
  'runs.stat.issues.caption':
    'Je einem Lauf verpachtet, samt Eltern- und Unterticket',
  'runs.stat.orphans': 'Verwaiste Zweige',
  'runs.stat.orphans.none': 'Keine Arbeit liegt herrenlos herum',
  'runs.stat.orphans.some':
    'Commits eines Laufs, der stehen blieb, und warten auf Übernahme',
  'runs.live.empty.title': 'Kein Lauf ist registriert',
  'runs.live.empty.body':
    'Ein Lauf erscheint hier, sobald er sich registriert — von dieser Maschine, von einer anderen oder von einem GitHub-Actions-Runner — samt den Tickets, die er belegt hat.',
  'runs.holds.nothing': 'belegt nichts',
  'runs.holds': 'belegt {issues}',
  'runs.uptime': 'seit {elapsed} · {lease}',
  'runs.lease.expired': 'abgelaufen',
  'runs.lease.left': 'noch {elapsed}',
  'runs.wip.label': 'Arbeit in Gang',
  'runs.wip.empty.title': 'Kein Zweig trägt Arbeit',
  'runs.wip.empty.body':
    'Ein Lauf hält seinen Zweig fest, sobald Commits darauf liegen, damit nach seinem Tod dem nächsten, der das Ticket belegt, die Arbeit angeboten wird, statt sie neu zu beginnen.',
  'runs.wip.orphaned': 'Verwaist',
  'runs.wip.meta': {
    one: '{commits} Commit · vor {elapsed}',
    other: '{commits} Commits · vor {elapsed}',
  },
  'runs.recent.label': 'Zuletzt beendet',
  'runs.recent.empty.title': 'Noch hat kein Lauf geendet',
  'runs.recent.empty.body':
    'Die letzten fünfzig Läufe bleiben hier stehen, samt dem, wie jeder ausging.',
  'runs.ago': 'vor {elapsed}',
  'runs.notCoordinator.title': 'Diese Umgebung koordiniert die Flotte nicht',
  'runs.notCoordinator.body':
    'Das Laufregister hängt allein auf Staging, und das mit Absicht: ein zweites Register ließe zwei Flotten je glauben, sie hielten den Rückstand — genau das, was es verhindern soll. Lies die Flotte auf Staging.',
  'nav.providers': 'Anbieter',
  'nav.providers.description': 'Ausgehende Aufrufe und ihre Obergrenzen',
  'providers.error.title': 'Die Anbieterzähler konnten nicht gelesen werden',
  'providers.list.label': 'Dienste',
  'providers.status.planned': 'Nicht angebunden',
  'providers.status.planned.description':
    'Noch ruft nichts diesen Dienst auf, es gibt also nichts zu zählen. Er steht hier, damit eine Obergrenze vor dem ersten Aufruf vereinbart wird statt nach der ersten Rechnung.',
  'providers.policy.allow': 'Rechnet darüber hinaus ab',
  'providers.policy.block': 'Verweigert ab der Obergrenze',
  'providers.badge.blocked': {
    one: 'Ein Aufruf abgewiesen',
    other: '{calls} Aufrufe abgewiesen',
  },
  'providers.limit.none':
    'Keine Obergrenze vereinbart · {used} in diesem Monat',
  'providers.limit.value': '{used} von {limit}',
  'providers.limit.window.day': 'Heute',
  'providers.limit.window.month': 'Diesen Monat',
  'providers.measuring.none': 'Noch nichts gemessen',
  'providers.measuring.since': 'Messung seit {date}',
  'providers.stat.calls': 'Aufrufe diesen Monat',
  'providers.stat.calls.caption': 'Über alle angebundenen Dienste',
  'providers.stat.errors': 'Fehlgeschlagene Aufrufe',
  'providers.stat.errors.caption':
    'Zählen auch als Aufrufe, weil die meisten Anbieter sie berechnen',
  'providers.stat.nearLimit': 'Nahe der Obergrenze',
  'providers.stat.nearLimit.caption': 'Dienste über ihrer Warnschwelle',
  'providers.stat.blocked': 'Abgewiesene Aufrufe',
  'providers.stat.blocked.none': 'Es wurde nichts abgewiesen',
  'providers.stat.blocked.some': 'Von einer Obergrenze abgewiesener Bedarf',
  'providers.forecast.label': 'Prognose',
  'providers.forecast.provider': 'Dienst',
  'providers.forecast.monthEnd': 'Bis Monatsende',
  'providers.forecast.runRate': 'Pro Monat bei diesem Tempo',
  'providers.forecast.perWorkspace': 'Pro Arbeitsbereich und Monat',
  'providers.forecast.noWorkspaceTraffic':
    'Kein Arbeitsbereichsverkehr zum Mitteln',
  'providers.forecast.window': {
    one: 'Hochgerechnet aus einer Stunde Messung.',
    other: 'Hochgerechnet aus {hours} Stunden Messung.',
  },
  'providers.forecast.tooEarly': {
    one: 'Bisher nur eine Stunde gemessen — zu wenig für eine Hochrechnung. Aus weniger als einem Tag einen Monat hochzurechnen wäre Rechnen, keine Prognose.',
    other:
      'Bisher nur {hours} Stunden gemessen — zu wenig für eine Hochrechnung. Aus weniger als einem Tag einen Monat hochzurechnen wäre Rechnen, keine Prognose.',
  },
  'providers.forecast.atWorkspaces': 'Bei wie vielen Arbeitsbereichen',
  'providers.forecast.callsEach': 'Aufrufe je Bereich und Monat',
  'providers.forecast.projected': 'Etwa {calls} Aufrufe im Monat.',
  'providers.workspaces.label': 'Aktivste Arbeitsbereiche',
  'providers.workspaces.platform': 'Plattform (kein Arbeitsbereich)',
  'providers.workspaces.empty.title': 'Noch nichts zugeordnet',
  'providers.workspaces.empty.description':
    'Ein Aufruf für einen Arbeitsbereich wird ihm zugerechnet. Cron-Läufe und Plattformpost gehören zu keinem und zählen getrennt.',
  'providers.readOnly':
    'Sie können diese Zähler lesen, aber keine Obergrenze verschieben. Limit oder Richtlinie zu ändern erfordert die Berechtigung provider:configure.',
} satisfies TranslationOf<typeof En>

export default messages
