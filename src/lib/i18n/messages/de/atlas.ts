/**
 * The world tracker and the map chrome, in German.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** „Weltkarte" for the atlas module, „Reise" for a trip and
 * „Wunschliste" for the bucket list — the same words `de/shell.ts` already
 * uses. The traveller's log of visits is „deine Chronik", one word chosen once
 * and kept through the search, the stats and the write actions. The address is
 * „du" throughout, matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('de')` reports `one` and `other`, the same two
 * branches English needs.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks German uses, and the parity suite exempts them
 * structurally. `panel.bucket.kind.region` is „Landesteil" rather than the
 * homograph „Region", so the label reads as German instead of tripping the
 * untranslated check.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': 'Weltkarte. Noch kein Land als besucht markiert.',
  'screen.world.summary':
    'Weltkarte mit {visited} von {total} Ländern, die als besucht markiert sind.',
  'screen.error.title': 'Die Weltkarte wurde nicht geladen',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Karte wird geladen',
  'map.controls.label': 'Kartensteuerung',
  'map.controls.zoomIn': 'Vergrößern',
  'map.controls.zoomOut': 'Verkleinern',
  'map.controls.north': 'Nach Norden ausrichten',
  'map.controls.locate': 'Meinen Standort finden',
  'map.controls.locateFailed': 'Wir konnten deinen Standort nicht ermitteln.',
  'map.controls.locateFailedBody':
    'Prüfe, ob der Standortzugriff für diese Seite erlaubt ist, und versuch es dann noch einmal.',

  'map.attribution.label': 'Kartendaten von',

  'map.basemap.title': 'Basiskarte nicht verfügbar',
  'map.basemap.body':
    'Die Straßendetails sind offline. Jeder Ort wird trotzdem an seiner echten Position gezeigt, Entfernungen und Gruppen bleiben also genau.',
  'map.basemap.credit': 'Küstenlinien von',
  'map.basemap.retry': 'Noch einmal versuchen',
  'map.basemap.retrying': 'Basiskarte wird geprüft',

  'map.engine.unsupported.title': 'Kartendarstellung nicht verfügbar',
  'map.engine.unsupported.body':
    'Dieser Browser kann die interaktive Karte nicht ausführen: Sie braucht WebGL2, und hier ist kein WebGL2-Kontext verfügbar. Nichts anderes auf diesem Bildschirm hängt davon ab.',
  'map.engine.stalled.title': 'Die Karte hat noch nichts gezeichnet',
  'map.engine.stalled.body':
    'In der Zeit, die die Karte zum Starten bekommt, ist nichts erschienen. Vielleicht fängt sie sich noch von selbst; nichts anderes auf diesem Bildschirm hängt davon ab.',

  'map.coverage.partial.title': 'Straßendetails nur teilweise',
  'map.coverage.partial.body': {
    one: 'Die veröffentlichten Kartendaten reichen nicht bis zu {outside} Ort dieser Reise. Er ist an seiner echten Position auf unseren eigenen Küstenlinien eingezeichnet.',
    other:
      'Die veröffentlichten Kartendaten reichen nicht bis zu {outside} Orten dieser Reise. Sie sind an ihren echten Positionen auf unseren eigenen Küstenlinien eingezeichnet.',
  },
  'map.coverage.none.title': 'Hier keine Straßendetails',
  'map.coverage.none.body':
    'Für diese Region sind noch keine Straßen veröffentlicht. Die Küstenlinien, die Pins und die Routen dazwischen sind alle echt — nur Gebäude und Straßen fehlen.',
  'map.coverage.dismiss': 'Hinweis zur Kartenabdeckung ausblenden',

  'map.legend.title': 'Legende',
  'map.legend.collapse': '{title} einklappen',
  'map.legend.expand': '{title} ausklappen',
  'map.legend.dayPin': 'Beispiel für einen Tages-Pin',
  'map.legend.dayPinMeaning': 'Reisetag',
  'map.legend.clusterPin': 'Beispiel für einen gruppierten Pin',
  'map.legend.clusterPinMeaning': 'Gruppierte Orte',

  'map.filter.label': 'Orte nach Kategorie filtern',
  'map.filter.all': 'Alle',
  'map.filter.category': {
    one: '{name} · {places} Ort',
    other: '{name} · {places} Orte',
  },

  'map.pin.day': 'Tag {day}',
  'map.pin.cluster': {
    one: '{places} Ort — zum Trennen vergrößern',
    other: '{places} Orte — zum Trennen vergrößern',
  },

  'map.place.rating': 'Bewertet mit {rating} von {max}',
  'map.place.clause.day': 'Tag {day}',
  'map.place.clause.rating': 'bewertet mit {rating} von {max}',
  'map.place.clause.visited': 'besucht',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Letzter Besuch',
  'legend.recent': {
    one: 'Im letzten Jahr',
    other: 'In den letzten {years} Jahren',
  },
  'legend.middle': 'Vor {from}–{to} Jahren oder ohne Datum',
  'legend.distant': {
    one: 'Vor über {years} Jahr',
    other: 'Vor über {years} Jahren',
  },
  'legend.unvisited': 'Noch nicht besucht',
  'legend.note':
    'Die Färbung zeigt nur, wie lange es her ist — der Tab „Land“ schreibt jedes Datum aus.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Weltabdeckung',
  'panel.coverage.unit': 'von {total}',
  'panel.coverage.caption': '{share} der Welt · {visits}',
  'panel.progress.label': 'Auf dem Weg zu jedem Land',
  'panel.progress.remaining': 'Noch {remaining}',
  'panel.toggle.hide': 'Weltkarten-Details ausblenden',
  'panel.toggle.show': 'Weltkarten-Details einblenden',
  'panel.tabs.label': 'Bereiche der Weltkarte',
  'panel.tab.country': 'Land',
  'panel.tab.stats': 'Statistik',
  'panel.tab.bucket': 'Wunschliste',
  'panel.back': 'Alle Länder',
  'panel.list.label': 'Besuchte Länder',
  'panel.loading': 'Deine Weltkarte wird geladen',

  'panel.empty.blank.title': 'Deine Karte ist noch leer',
  'panel.empty.blank.body':
    'Markiere ein Land als besucht, und es füllt sich hier auf der Karte — mit erstem und letztem Besuch, der Zahl deiner Aufenthalte und allem, was du dazu notiert hast.',
  'panel.empty.pick.title': 'Wähle ein Land',
  'panel.empty.pick.body':
    'Wähle eins auf der Karte, im Suchfeld oder in der Liste, und sein vollständiger Eintrag öffnet sich hier — erster Besuch, letzter Besuch, der Zähler und deine Notiz.',

  'panel.stat.places': 'Orte',
  'panel.stat.placesNone': 'Noch nichts auf einer Reise angepinnt',
  'panel.stat.placesCaption':
    'Gespeicherte Sehenswürdigkeiten, Unterkünfte und Stopps',
  'panel.stat.regions': 'Regionen',
  'panel.stat.regionsNone': 'Noch keine Regionen markiert',
  'panel.stat.regionsCaption': 'Bundesländer, Provinzen, Präfekturen',
  'panel.stat.visits': 'Besuche',
  'panel.stat.visitsCaption': 'Jede erfasste Ankunft',
  'panel.stat.trips': 'Reisen',
  'panel.stat.tripsCaption': 'Nur abgeschlossene Reisen',
  'panel.stat.cities': 'Städte',
  'panel.stat.citiesCaption': 'Orte, in denen du geschlafen oder gehalten hast',
  'panel.stat.days': 'Tage unterwegs',
  'panel.stat.daysCaption': 'Über alle Reisen in deiner Chronik',
  'panel.continents.label': 'Länder nach Kontinent',

  'panel.bucket.empty.title': 'Nichts auf der Liste',
  'panel.bucket.empty.body':
    'Irgendwohin wolltest du schon immer. Trag es ein und hak es ab, wenn du dort ankommst.',
  'panel.bucket.label': 'Wunschliste',
  'panel.bucket.progress': '{done} von {total} geschafft',
  'panel.bucket.done': 'Geschafft',
  'panel.bucket.toGo': 'Noch offen',
  'panel.bucket.target': 'bis {year}',
  'panel.bucket.hidden': {
    one: 'Noch {entries} weiterer Eintrag auf deiner Liste, hier nicht gezeigt.',
    other:
      'Noch {entries} weitere Einträge auf deiner Liste, hier nicht gezeigt.',
  },
  'panel.bucket.kind.country': 'Land',
  'panel.bucket.kind.region': 'Landesteil',
  'panel.bucket.kind.place': 'Ort',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Antarktis',
  'continent.asia': 'Asien',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Nordamerika',
  'continent.oceania': 'Ozeanien',
  'continent.southAmerica': 'Südamerika',
  'continent.unknown': 'Kontinent nicht erfasst',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Besucht',
  'record.firstVisit': 'Erster Besuch',
  'record.lastVisit': 'Letzter Besuch',
  'record.visitDates': 'Besuchsdaten',
  'record.notRecorded': 'Nicht erfasst',
  'record.datesUnrecorded': 'Daten nicht erfasst',
  'record.visits': { one: '{visits} Besuch', other: '{visits} Besuche' },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Erster Besuch {from}',
  'record.spanTo': 'Letzter Besuch {to}',
  'record.visitsUnit': { one: 'Besuch', other: 'Besuche' },
  'record.gap.days': {
    one: 'im Abstand von {gap} Tag',
    other: 'im Abstand von {gap} Tagen',
  },
  'record.gap.months': {
    one: 'im Abstand von {gap} Monat',
    other: 'im Abstand von {gap} Monaten',
  },
  'record.gap.years': {
    one: 'im Abstand von {gap} Jahr',
    other: 'im Abstand von {gap} Jahren',
  },
  'record.note.empty': 'Noch keine Notiz',
  'record.noOutline':
    'Die Weltumrisse dieser Karte sind im Maßstab 1:110m geschnitten, und der schlägt dieses Gebiet seinem Mutterstaat zu — auf der Karte gibt es also nichts einzurahmen. Der Besuch zählt trotzdem.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Länder ordnen',
  'list.sort.code': 'Ländercode',
  'list.sort.codeStatement': 'Geordnet nach Ländercode, von A bis Z.',
  'list.sort.name': 'Ländername',
  'list.sort.nameStatement':
    'Geordnet nach Ländername, von A bis Z, dann nach Ländercode.',
  'list.sort.recent': 'Neuester Besuch',
  'list.sort.recentStatement':
    'Geordnet nach dem neuesten Besuch zuerst, dann nach Ländercode.',
  'list.sort.visits': 'Meiste Besuche',
  'list.sort.visitsStatement':
    'Geordnet nach den meisten Besuchen zuerst, dann nach Ländercode.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Von den Weltumrissen dem Mutterstaat zugeschlagen, auf der Karte gibt es also nichts einzurahmen.',
  'list.announce.selected': '{name} ausgewählt.',
  'list.announce.selectedUnframed': '{name} ausgewählt. {reason}',
  'list.empty.title': 'Noch keine Länder auf der Karte',
  'list.empty.body':
    'Ein Land erscheint hier, sobald ein Besuch dafür erfasst ist — mit der ersten Ankunft, der neuesten und der Zahl deiner Aufenthalte.',
  'list.loading': 'Besuchte Länder werden geladen',
  'list.error.title': 'Deine Länder wurden nicht geladen',
  'list.error.body':
    'Die Weltkarte konnte deine besuchten Länder gerade nicht lesen. Nichts ist verloren — sie sind weiterhin erfasst.',
  'list.error.retry': 'Noch einmal versuchen',
  'list.error.retrying': 'Deine Länder werden geladen',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Land finden',
  'search.loading': 'Deine Länder werden geladen',
  'search.placeholder': 'Ländername oder Code',
  'search.entry.notVisited': 'Noch nicht besucht',
  'search.entry.noOutline': 'kein Kartenumriss',
  'search.entry.separator': ' · ',
  'search.cleared': 'Auswahl aufgehoben.',
  'search.unframed':
    '{name} hat im Weltmaßstab keinen Umriss, die Karte hat also nichts einzurahmen.',
  'search.unframedVisited':
    '{name} hat im Weltmaßstab keinen Umriss, die Karte hat also nichts einzurahmen. Der Eintrag bleibt unberührt.',
  'search.results.empty':
    'Noch keine Länder in deiner Chronik. Tippe, um jedes Land der Welt zu durchsuchen.',
  'search.results.emptyPinned':
    '{name} ist ausgewählt. Noch keine Länder in deiner Chronik — tippe, um jedes Land der Welt zu durchsuchen.',
  'search.results.record': {
    one: '{countries} Land in deiner Chronik.',
    other: '{countries} Länder in deiner Chronik.',
  },
  'search.results.capped': 'Die ersten {shown} werden gezeigt.',
  'search.results.pinned': '{name} ist ausgewählt und steht ganz oben.',
  'search.results.none': 'Kein Land passt zu {term}.',
  'search.results.matches': {
    one: '{countries} Land passt zu {term}.',
    other: '{countries} Länder passen zu {term}.',
  },
  'search.announce.selected': '{name} ausgewählt.',
  'search.announce.framing':
    '{name} ausgewählt. Die Karte rahmt es gerade ein.',
  'search.announce.unframed': '{name} ausgewählt. {reason}',
  'search.empty.title': 'Noch nichts in deiner Chronik',
  'search.empty.body':
    'Tippe einen Ländernamen oder seinen Zwei-Buchstaben-Code, um das Land auf der Karte zu finden.',
  'search.empty.noMatchTitle': 'Kein Land passt zu „{term}“',
  'search.empty.noMatchBody':
    'Prüfe die Schreibweise oder versuch den Zwei-Buchstaben-Code — PT findet Portugal. Alle {countries} Länder sind durchsuchbar, besucht oder nicht.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Deine Chronik',
  'actions.visit.absent.title': 'Nicht besucht',
  'actions.visit.absent.caption': 'Ein Besuch ohne Reise dahinter.',
  'actions.visit.title': 'Besucht',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Nicht auf der Liste',
  'actions.goal.absent.caption': 'Irgendwohin willst du noch.',
  'actions.goal.title': 'Auf der Wunschliste',
  'actions.goal.waiting': 'Wartet, bis es an der Reihe ist.',
  'actions.goal.target': 'Geplant für {year}.',
  'actions.goal.achieved.title': 'Von der Liste abgehakt',
  'actions.goal.achieved.caption':
    'Du warst dort. Der Eintrag bleibt als Andenken stehen.',

  'actions.button.remove': 'Entfernen',
  'actions.button.mark': 'Als besucht markieren',
  'actions.button.add': 'Auf die Liste',
  'actions.visit.remove.name': 'Entfernen: {name} von deiner Weltkarte',
  'actions.visit.remove.busy': '{name} wird von deiner Weltkarte entfernt',
  'actions.visit.add.name': 'Als besucht markieren: {name}',
  'actions.visit.add.busy': '{name} wird als besucht markiert',
  'actions.goal.remove.name': 'Entfernen: {name} von deiner Wunschliste',
  'actions.goal.remove.busy': '{name} wird von deiner Wunschliste entfernt',
  'actions.goal.add.name': 'Auf die Liste: {name}',
  'actions.goal.add.busy': '{name} wird deiner Wunschliste hinzugefügt',

  'actions.hint':
    'Beides wirkt sofort, und beides lässt sich hier rückgängig machen.',
  'actions.offline':
    'Dein Gerät hat den Server nicht erreicht. Prüfe die Verbindung und versuch es noch einmal.',
  'actions.toast.marked': 'Als besucht markiert',
  'actions.toast.markedBody': '{name} ist auf deiner Weltkarte.',
  'actions.toast.markFailed': '{name} wurde nicht markiert',
  'actions.toast.unmarked': 'Von deiner Weltkarte entfernt',
  'actions.toast.unmarkedBody': '{name} ist nicht mehr als besucht markiert.',
  'actions.toast.unmarkFailed': '{name} wurde nicht entfernt',
  'actions.toast.listed': 'Zur Wunschliste hinzugefügt',
  'actions.toast.listedBody':
    '{name} ist ein Ziel, das du dir vorgenommen hast.',
  'actions.toast.listFailed': '{name} wurde nicht hinzugefügt',
  'actions.toast.unlisted': 'Von deiner Wunschliste entfernt',
  'actions.toast.unlistedBody': '{name} steht nicht mehr auf der Liste.',
  'actions.toast.unlistFailed': '{name} wurde nicht entfernt',
  'actions.toast.fallback':
    'Die Änderung hat den Server nicht erreicht. Versuch es gleich noch einmal.',

  'actions.confirm.visit.title': '{name} von deiner Weltkarte entfernen?',
  'actions.confirm.visit.body': {
    one: '{visits} erfasster Besuch{dates} würde gelöscht{note}. Deine Reisen und gespeicherten Orte bleiben unberührt.',
    other:
      '{visits} erfasste Besuche{dates} würden gelöscht{note}. Deine Reisen und gespeicherten Orte bleiben unberührt.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', zusammen mit deiner Notiz dazu',
  'actions.confirm.goal.title': '{name} von deiner Wunschliste entfernen?',
  'actions.confirm.goal.body':
    'Der Eintrag ist schon abgehakt, also verschwindet auch der Vermerk, dass du dort warst. Deine Weltkarte und deine Reisen bleiben unberührt.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': { one: 'Reise', other: 'Reisen' },
  'card.visits': { one: 'Besuch', other: 'Besuche' },
  'card.places': { one: 'Ort', other: 'Orte' },
  'card.firstTrip': 'Erste Reise',
  'card.lastTrip': 'Letzte Reise',
  'card.firstVisit': 'Erster Besuch',
  'card.lastVisit': 'Letzter Besuch',
  'card.absent': 'Nicht erfasst',
  'card.loading': 'Land wird geladen',
  'card.loadingNamed': '{name} wird geladen',
  'card.error.body': 'Diese Zahlen wurden nicht geladen. Nichts ist verloren.',
  'card.error.retry': 'Noch einmal versuchen',
  'overlay.close': '{name} schließen',
} satisfies TranslationOf<typeof En>

export default messages
