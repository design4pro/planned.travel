/**
 * The world tracker and the map chrome, in Dutch.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** "Wereldkaart" for the atlas module, "reis" for a trip and
 * "bucketlist" for the bucket list — the word Dutch travel products actually
 * use, written as one Dutch word. The traveller's log of visits is "je
 * reisarchief", chosen once and kept through the search, the stats and the
 * write actions. The address is informal `je`/`jij`, matching `./shell.ts`.
 *
 * **Plural.** `Intl.PluralRules('nl')` reports `one` and `other`, the same two
 * branches English needs. "Jaar" stays "jaar" after a numeral, so a few
 * `other` branches legitimately repeat their `one` text.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Dutch uses, and the parity suite exempts them
 * structurally. `continent.antarctica` is "Zuidpoolgebied" rather than the
 * homograph "Antarctica", so the chip reads as Dutch instead of tripping the
 * untranslated check.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty': 'Wereldkaart. Nog geen landen als bezocht gemarkeerd.',
  'screen.world.summary':
    'Wereldkaart met {visited} van {total} landen gemarkeerd als bezocht.',
  'screen.error.title': 'De wereldkaart is niet geladen',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Kaart laden',
  'map.controls.label': 'Kaartbediening',
  'map.controls.zoomIn': 'Inzoomen',
  'map.controls.zoomOut': 'Uitzoomen',
  'map.controls.north': 'Naar het noorden draaien',
  'map.controls.locate': 'Mijn locatie zoeken',
  'map.controls.locateFailed': 'We konden je locatie niet bepalen.',
  'map.controls.locateFailedBody':
    'Controleer of deze site toegang tot je locatie heeft en probeer het dan opnieuw.',

  'map.attribution.label': 'Kaartgegevens van',
  'map.attribution.geocoder': 'Plaatsen gevonden met',

  'map.basemap.title': 'Basiskaart niet beschikbaar',
  'map.basemap.body':
    'De straatdetails zijn offline. Elke plek staat wel op zijn echte positie, dus afstanden en groepen blijven kloppen.',
  'map.basemap.credit': 'Kustlijnen van',
  'map.basemap.retry': 'Opnieuw proberen',
  'map.basemap.retrying': 'Basiskaart controleren',

  'map.engine.unsupported.title': 'Kaartweergave niet beschikbaar',
  'map.engine.unsupported.body':
    'Deze browser kan de interactieve kaart niet draaien: die heeft WebGL2 nodig, en hier is geen WebGL2-context beschikbaar. Niets anders op dit scherm hangt ervan af.',
  'map.engine.stalled.title': 'De kaart heeft nog niets getekend',
  'map.engine.stalled.body':
    'In de tijd die de kaart krijgt om te starten is er niets verschenen. Misschien komt het nog vanzelf goed; niets anders op dit scherm hangt ervan af.',

  'map.coverage.partial.title': 'Gedeeltelijke straatdetails',
  'map.coverage.partial.body': {
    one: 'De gepubliceerde kaartgegevens reiken niet tot {outside} plek van deze reis. Die is op zijn echte positie getekend op onze eigen kustlijnen.',
    other:
      'De gepubliceerde kaartgegevens reiken niet tot {outside} plekken van deze reis. Die zijn op hun echte posities getekend op onze eigen kustlijnen.',
  },
  'map.coverage.none.title': 'Hier geen straatdetails',
  'map.coverage.none.body':
    'Straten zijn voor deze regio nog niet gepubliceerd. De kustlijnen, de pins en de routes ertussen zijn allemaal echt — alleen de gebouwen en wegen ontbreken.',
  'map.coverage.dismiss': 'Melding over kaartdekking sluiten',

  'map.legend.title': 'Legenda',
  'map.legend.collapse': '{title} inklappen',
  'map.legend.expand': '{title} uitklappen',
  'map.legend.dayPin': 'Voorbeeld van een dagpin',
  'map.legend.dayPinMeaning': 'Reisdag',
  'map.legend.clusterPin': 'Voorbeeld van een gegroepeerde pin',
  'map.legend.clusterPinMeaning': 'Gegroepeerde plekken',

  'map.filter.label': 'Plekken filteren op categorie',
  'map.filter.all': 'Alle',
  'map.filter.category': {
    one: '{name} · {places} plek',
    other: '{name} · {places} plekken',
  },

  'map.pin.day': 'Dag {day}',
  'map.pin.cluster': {
    one: '{places} plek — zoom in om die apart te zien',
    other: '{places} plekken — zoom in om ze uit elkaar te halen',
  },

  'map.place.rating': 'Beoordeeld met {rating} van {max}',
  'map.place.clause.day': 'dag {day}',
  'map.place.clause.rating': 'beoordeeld met {rating} van {max}',
  'map.place.clause.visited': 'bezocht',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Laatste bezoek',
  'legend.recent': {
    one: 'In het afgelopen jaar',
    other: 'In de afgelopen {years} jaar',
  },
  'legend.middle': '{from}–{to} jaar geleden, of zonder datum',
  'legend.distant': {
    one: 'Meer dan {years} jaar geleden',
    other: 'Meer dan {years} jaar geleden',
  },
  'legend.unvisited': 'Nog niet bezocht',
  'legend.note':
    'De tint toont alleen hoe recent het was — het tabblad Land schrijft elke datum voluit.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Werelddekking',
  'panel.coverage.unit': 'van {total}',
  'panel.coverage.caption': '{share} van de wereld · {visits}',
  'panel.progress.label': 'Op weg naar elk land',
  'panel.progress.remaining': 'Nog {remaining} te gaan',
  'panel.toggle.hide': 'Details van de wereldkaart verbergen',
  'panel.toggle.show': 'Details van de wereldkaart tonen',
  'panel.tabs.label': 'Onderdelen van de wereldkaart',
  'panel.tab.country': 'Land',
  'panel.tab.stats': 'Statistieken',
  'panel.tab.bucket': 'Bucketlist',
  'panel.back': 'Alle landen',
  'panel.list.label': 'Bezochte landen',
  'panel.loading': 'Je wereldkaart laden',

  'panel.empty.blank.title': 'Je kaart is nog leeg',
  'panel.empty.blank.body':
    'Markeer een land als bezocht en het kleurt hier op de kaart in — met je eerste en laatste bezoek, hoe vaak je er bent geweest en wat je erover hebt geschreven.',
  'panel.empty.pick.title': 'Kies een land',
  'panel.empty.pick.body':
    'Kies er een op de kaart, in het zoekveld of in de lijst, en het volledige overzicht opent hier — eerste bezoek, laatste bezoek, de teller en je notitie.',

  'panel.stat.places': 'Jouw plekken',
  'panel.stat.placesNone': 'Nog niets vastgepind op een reis',
  'panel.stat.placesCaption':
    'Opgeslagen bezienswaardigheden, verblijven en stops',
  'panel.stat.regions': 'Je regio’s',
  'panel.stat.regionsNone': 'Nog geen regio’s gemarkeerd',
  'panel.stat.regionsCaption': 'Staten, provincies, prefecturen',
  'panel.stat.visits': 'Je bezoeken',
  'panel.stat.visitsCaption': 'Elke vastgelegde aankomst',
  'panel.stat.trips': 'Jouw reizen',
  'panel.stat.tripsCaption': 'Alle reizen waar je bij bent',
  'panel.stat.cities': 'Je steden',
  'panel.stat.citiesCaption': 'Plaatsen waar je sliep of stopte',
  'panel.stat.days': 'Je reisdagen',
  'panel.stat.daysCaption': 'Over alle reizen in je reisarchief',
  'panel.continents.label': 'Landen per continent',

  'panel.bucket.empty.title': 'Nog niets op de lijst',
  'panel.bucket.empty.body':
    'Ergens waar je altijd al heen wilde. Zet het erop en vink het af zodra je er bent.',
  'panel.bucket.label': 'Bucketlist',
  'panel.bucket.progress': '{done} van {total} gedaan',
  'panel.bucket.done': 'Gedaan',
  'panel.bucket.toGo': 'Nog te gaan',
  'panel.bucket.target': 'vóór {year}',
  'panel.bucket.hidden': {
    one: 'Nog {entries} item op je lijst, hier niet getoond.',
    other: 'Nog {entries} items op je lijst, hier niet getoond.',
  },
  'panel.bucket.kind.country': 'Land',
  'panel.bucket.kind.region': 'Regio',
  'panel.bucket.kind.place': 'Plek',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Zuidpoolgebied',
  'continent.asia': 'Azië',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Noord-Amerika',
  'continent.oceania': 'Oceanië',
  'continent.southAmerica': 'Zuid-Amerika',
  'continent.unknown': 'Continent niet vastgelegd',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Bezocht',
  'record.firstVisit': 'Eerste bezoek',
  'record.lastVisit': 'Laatste bezoek',
  'record.visitDates': 'Bezoekdata',
  'record.notRecorded': 'Niet vastgelegd',
  'record.datesUnrecorded': 'Data niet vastgelegd',
  'record.visits': { one: '{visits} bezoek', other: '{visits} bezoeken' },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Eerste bezoek {from}',
  'record.spanTo': 'Laatste bezoek {to}',
  'record.visitsUnit': { one: 'bezoek', other: 'bezoeken' },
  'record.gap.days': {
    one: 'met {gap} dag ertussen',
    other: 'met {gap} dagen ertussen',
  },
  'record.gap.months': {
    one: 'met {gap} maand ertussen',
    other: 'met {gap} maanden ertussen',
  },
  'record.gap.years': {
    one: 'met {gap} jaar ertussen',
    other: 'met {gap} jaar ertussen',
  },
  'record.note.empty': 'Nog geen notitie',
  'record.noOutline':
    'De wereldomtrekken die deze kaart tekent zijn gesneden op 1:110m, en die vouwen dit gebied bij zijn moederland — er valt op de kaart dus niets in beeld te brengen. Het bezoek telt gewoon mee.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Landen ordenen',
  'list.sort.code': 'Landcode',
  'list.sort.codeStatement': 'Geordend op landcode, van A tot Z.',
  'list.sort.name': 'Landnaam',
  'list.sort.nameStatement':
    'Geordend op landnaam, van A tot Z, daarna op landcode.',
  'list.sort.recent': 'Meest recente bezoek',
  'list.sort.recentStatement':
    'Geordend op het meest recente bezoek eerst, daarna op landcode.',
  'list.sort.visits': 'Meeste bezoeken',
  'list.sort.visitsStatement':
    'Geordend op de meeste bezoeken eerst, daarna op landcode.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Door de wereldomtrekken bij het moederland gevouwen, dus er valt op de kaart niets in beeld te brengen.',
  'list.announce.selected': '{name} geselecteerd.',
  'list.announce.selectedUnframed': '{name} geselecteerd. {reason}',
  'list.empty.title': 'Nog geen landen op de kaart',
  'list.empty.body':
    'Een land verschijnt hier zodra er een bezoek voor is vastgelegd — met de eerste aankomst, de laatste en hoe vaak je er bent geweest.',
  'list.loading': 'Bezochte landen laden',
  'list.error.title': 'Je landen zijn niet geladen',
  'list.error.body':
    'De wereldkaart kon je bezochte landen nu even niet lezen. Er is niets verloren — ze staan nog steeds vastgelegd.',
  'list.error.retry': 'Opnieuw proberen',
  'list.error.retrying': 'Je landen laden',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Zoek een land',
  'search.loading': 'Je landen laden',
  'search.placeholder': 'Landnaam of code',
  'search.entry.notVisited': 'Nog niet bezocht',
  'search.entry.noOutline': 'geen kaartomtrek',
  'search.entry.separator': ' · ',
  'search.cleared': 'Selectie gewist.',
  'search.unframed':
    '{name} heeft op wereldschaal geen omtrek, dus de kaart heeft niets om in beeld te brengen.',
  'search.unframedVisited':
    '{name} heeft op wereldschaal geen omtrek, dus de kaart heeft niets om in beeld te brengen. Het reisarchief blijft onaangetast.',
  'search.results.empty':
    'Nog geen landen in je reisarchief. Typ om elk land ter wereld te doorzoeken.',
  'search.results.emptyPinned':
    '{name} is geselecteerd. Nog geen landen in je reisarchief — typ om elk land ter wereld te doorzoeken.',
  'search.results.record': {
    one: '{countries} land in je reisarchief.',
    other: '{countries} landen in je reisarchief.',
  },
  'search.results.capped': 'De eerste {shown} worden getoond.',
  'search.results.pinned': '{name} is geselecteerd en staat bovenaan.',
  'search.results.none': 'Geen land komt overeen met {term}.',
  'search.results.matches': {
    one: '{countries} land komt overeen met {term}.',
    other: '{countries} landen komen overeen met {term}.',
  },
  'search.announce.selected': '{name} geselecteerd.',
  'search.announce.framing':
    '{name} geselecteerd. De kaart brengt het in beeld.',
  'search.announce.unframed': '{name} geselecteerd. {reason}',
  'search.empty.title': 'Nog niets in je reisarchief',
  'search.empty.body':
    'Typ een landnaam of de tweeletterige code om het land op de kaart te vinden.',
  'search.empty.noMatchTitle': 'Geen land komt overeen met ‘{term}’',
  'search.empty.noMatchBody':
    'Controleer de spelling of probeer de tweeletterige code — PT vindt Portugal. Alle {countries} landen zijn doorzoekbaar, of je er nu bent geweest of niet.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Jouw reisarchief',
  'actions.visit.absent.title': 'Niet bezocht',
  'actions.visit.absent.caption': 'Een bezoek zonder reis erachter.',
  'actions.visit.title': 'Bezocht',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Niet op de lijst',
  'actions.goal.absent.caption': 'Ergens waar je nog heen wilt.',
  'actions.goal.title': 'Op de bucketlist',
  'actions.goal.waiting': 'Wacht op zijn beurt.',
  'actions.goal.target': 'Gepland voor {year}.',
  'actions.goal.achieved.title': 'Afgevinkt van de lijst',
  'actions.goal.achieved.caption':
    'Je bent er geweest. Het item blijft staan als aandenken.',

  'actions.button.remove': 'Verwijderen',
  'actions.button.mark': 'Markeer als bezocht',
  'actions.button.add': 'Zet op de lijst',
  'actions.visit.remove.name': 'Verwijderen: {name} van je wereldkaart',
  'actions.visit.remove.busy': '{name} wordt van je wereldkaart verwijderd',
  'actions.visit.add.name': 'Markeer als bezocht: {name}',
  'actions.visit.add.busy': '{name} wordt als bezocht gemarkeerd',
  'actions.goal.remove.name': 'Verwijderen: {name} van je bucketlist',
  'actions.goal.remove.busy': '{name} wordt van je bucketlist verwijderd',
  'actions.goal.add.name': 'Zet op de lijst: {name}',
  'actions.goal.add.busy': '{name} wordt aan je bucketlist toegevoegd',

  'actions.hint':
    'Allebei werken ze meteen, en allebei kun je ze hier ongedaan maken.',
  'actions.offline':
    'Je apparaat kon de server niet bereiken. Controleer de verbinding en probeer het opnieuw.',
  'actions.toast.marked': 'Gemarkeerd als bezocht',
  'actions.toast.markedBody': '{name} staat op je wereldkaart.',
  'actions.toast.markFailed': '{name} is niet gemarkeerd',
  'actions.toast.unmarked': 'Van je wereldkaart verwijderd',
  'actions.toast.unmarkedBody': '{name} is niet langer gemarkeerd als bezocht.',
  'actions.toast.unmarkFailed': '{name} is niet verwijderd',
  'actions.toast.listed': 'Toegevoegd aan je bucketlist',
  'actions.toast.listedBody': '{name} is ergens waar je nog heen wilt.',
  'actions.toast.listFailed': '{name} is niet toegevoegd',
  'actions.toast.unlisted': 'Verwijderd van je bucketlist',
  'actions.toast.unlistedBody': '{name} staat niet meer op de lijst.',
  'actions.toast.unlistFailed': '{name} is niet verwijderd',
  'actions.toast.fallback':
    'De wijziging heeft de server niet bereikt. Probeer het zo nog eens.',

  'actions.confirm.visit.title': '{name} van je wereldkaart verwijderen?',
  'actions.confirm.visit.body': {
    one: '{visits} vastgelegd bezoek{dates} zou worden gewist{note}. Je reizen en opgeslagen plekken blijven staan.',
    other:
      '{visits} vastgelegde bezoeken{dates} zouden worden gewist{note}. Je reizen en opgeslagen plekken blijven staan.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', samen met de notitie die je erbij schreef',
  'actions.confirm.goal.title': '{name} van je bucketlist verwijderen?',
  'actions.confirm.goal.body':
    'Het staat al afgevinkt, dus hiermee verdwijnt ook het bewijs dat je er bent geweest. Je wereldkaart en je reizen blijven onaangetast.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Reis van de werkruimte',
    other: 'Reizen van de werkruimte',
  },
  'card.visits': { one: 'Bezoek', other: 'Bezoeken' },
  'card.places': {
    one: 'Plek van de werkruimte',
    other: 'Plekken van de werkruimte',
  },
  'card.firstTrip': 'Eerste reis',
  'card.lastTrip': 'Laatste reis',
  'card.firstVisit': 'Eerste bezoek',
  'card.lastVisit': 'Laatste bezoek',
  'card.absent': 'Niet vastgelegd',
  'card.loading': 'Land laden',
  'card.loadingNamed': '{name} laden',
  'card.error.body': 'Deze cijfers zijn niet geladen. Er is niets verloren.',
  'card.error.retry': 'Opnieuw proberen',
  'overlay.close': '{name} sluiten',
  'regions.label': 'Regio’s',
  'regions.hint': 'Een regio toevoegen markeert ook {country} als bezocht.',
  'regions.keeps': 'Een regio verwijderen haalt {country} niet uit je atlas.',
  'regions.keeps.unvisited':
    'Deze regio’s blijven bewaard. Markeer {country} als bezocht of voeg een regio toe om het land weer op je kaart te zetten.',
  'regions.empty.title': 'Hier zijn nog geen regio’s vastgelegd',
  'regions.empty.body':
    'Voeg een staat, provincie of gebied toe dat je in {country} hebt bezocht.',
  'regions.input.label': 'Regio in {country} toevoegen',
  'regions.input.placeholder': 'Bijvoorbeeld Beieren',
  'regions.add': 'Regio toevoegen',
  'regions.adding': '{region} toevoegen',
  'regions.remove': '{region} verwijderen',
  'regions.loading': 'Je regio’s laden',
  'regions.status.added': '{region} toegevoegd',
  'regions.status.exists': '{region} is al vastgelegd',
  'regions.status.removed': '{region} verwijderd',
  'regions.status.addedCountry':
    '{region} toegevoegd. {country} is nu als bezocht gemarkeerd.',
  'regions.error.invalid': 'Vul een regionaam in.',
  'regions.error.hidden':
    'De naam bevat ongeldige tekens. Verwijder ze en probeer het opnieuw.',
  'regions.error.load': 'Je regio’s voor {country} konden niet worden geladen.',
  'regions.error.add':
    '{region} kon niet worden toegevoegd. Probeer het opnieuw.',
  'regions.error.remove':
    '{region} kon niet worden verwijderd. Probeer het opnieuw.',
  'regions.error.full':
    'Je hebt {limit} regio’s vastgelegd. Verwijder er een om een andere toe te voegen.',
  'regions.reload': 'Regio’s opnieuw laden',
  'actions.confirm.visitRegions.body': {
    one: '{history}Je vastgelegde regio’s in {country} blijven bewaard: {count}.',
    other:
      '{history}Je vastgelegde regio’s in {country} blijven bewaard: {count}.',
  },
  'regions.error.uncertain':
    'De wijziging kon niet worden bevestigd. Laad je regio’s opnieuw om te zien wat is opgeslagen.',
  'regions.status.refreshFailed':
    '{result} De atlas kon niet worden vernieuwd. Laad hem opnieuw om de kaart bij te werken.',

  'panel.stat.periodLabel': 'Toon cijfers voor',
  'panel.stat.allTime': 'Alle jaren',
  'panel.stat.groupAll': 'Cijfers voor alle jaren',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Cijfers voor {year}',
  'panel.stat.announceAll': 'Cijfers voor alle jaren worden getoond.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Cijfers voor {year} worden getoond.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Reizen die beginnen in {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Op reizen die beginnen in {year}',
  'panel.stat.countries': 'Landen op je reizen',
  'panel.stat.countriesCaption': 'Verschillende landen op deze reizen',
  'panel.stat.streak': 'Je reeks reisjaren',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Elk jaar gereisd, van {first} tot {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Een reis in {last}',
  'panel.stat.streakNone':
    'Voeg een reis met datums toe om een reeks te beginnen',
} satisfies TranslationOf<typeof En>

export default messages
