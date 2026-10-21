/**
 * The world tracker and the map chrome, in Catalan.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** «Mapa del món» for the atlas module — the words
 * `ca/shell.ts` already uses for `nav.atlas` — «viatge» for a trip and
 * «llista de desitjos» for the bucket list. The traveller's log of visits is
 * «el teu registre», one word chosen once and kept through the search, the
 * stats and the write actions. The address is «tu» throughout, matching the
 * rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('ca')` reports `one`, `many` and `other`;
 * `many` covers the million-scale round numbers and reads like `other`, the
 * same three branches the rest of the Catalan catalogue writes.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Catalan uses, and the parity suite exempts them
 * structurally. Catalan spells two labels exactly as English does, so
 * `continent.oceania` takes the school-atlas grouping «Austràlia i Oceania»
 * and `panel.stat.regions` reads «Regions marcades», rather than tripping the
 * untranslated check with homographs.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Encara no hi ha res per comptar',
  'panel.stats.empty.body':
    'Marca un país al mapa o planifica un viatge i les teves xifres començaran aquí.',
  'panel.stats.empty.action': 'Planifica un viatge',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Mapa del món. Encara no hi ha cap país marcat com a visitat.',
  'screen.world.summary':
    'Mapa del món amb {visited} de {total} països marcats com a visitats.',
  'screen.error.title': 'El mapa del món no s’ha carregat',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'S’està carregant el mapa',
  'map.controls.label': 'Controls del mapa',
  'map.controls.zoomIn': 'Amplia',
  'map.controls.zoomOut': 'Redueix',
  'map.controls.north': 'Orienta al nord',
  'map.controls.locate': 'Troba la meva ubicació',
  'map.controls.locateFailed': 'No hem pogut obtenir la teva ubicació.',
  'map.controls.locateFailedBody':
    'Comprova que l’accés a la ubicació està permès per a aquest lloc web i torna-ho a provar.',

  'map.attribution.label': 'Dades del mapa de',
  'map.attribution.geocoder': 'Llocs localitzats amb',

  'map.basemap.title': 'Mapa base no disponible',
  'map.basemap.body':
    'El detall dels carrers està fora de línia. Cada lloc es continua mostrant a la seva posició real, així que les distàncies i els grups es mantenen exactes.',
  'map.basemap.credit': 'Costes de',
  'map.basemap.retry': 'Torna-ho a provar',
  'map.basemap.retrying': 'S’està comprovant el mapa base',

  'map.engine.unsupported.title': 'Representació del mapa no disponible',
  'map.engine.unsupported.body':
    'Aquest navegador no pot executar el mapa interactiu: necessita WebGL2, i aquí no hi ha cap context WebGL2 disponible. Res més d’aquesta pantalla no en depèn.',
  'map.engine.stalled.title': 'El mapa encara no ha dibuixat res',
  'map.engine.stalled.body':
    'No ha aparegut res en el temps que el mapa té per arrencar. Encara es pot refer tot sol; res més d’aquesta pantalla no en depèn.',

  'map.coverage.partial.title': 'Detall dels carrers parcial',
  'map.coverage.partial.body': {
    one: 'Les dades publicades del mapa no arriben a {outside} lloc d’aquest viatge. Es dibuixa a la seva posició real sobre les nostres costes.',
    many: 'Les dades publicades del mapa no arriben a {outside} llocs d’aquest viatge. Es dibuixen a les seves posicions reals sobre les nostres costes.',
    other:
      'Les dades publicades del mapa no arriben a {outside} llocs d’aquest viatge. Es dibuixen a les seves posicions reals sobre les nostres costes.',
  },
  'map.coverage.none.title': 'Aquí no hi ha detall dels carrers',
  'map.coverage.none.body':
    'Els carrers encara no estan publicats per a aquesta regió. Les costes, els marcadors i les rutes que els uneixen són tots reals — només falten els edificis i les carreteres.',
  'map.coverage.dismiss': 'Descarta la nota de cobertura del mapa',

  'map.legend.title': 'Llegenda',
  'map.legend.collapse': 'Replega {title}',
  'map.legend.expand': 'Desplega {title}',
  'map.legend.dayPin': 'Exemple de marcador de dia',
  'map.legend.dayPinMeaning': 'Dia de l’itinerari',
  'map.legend.clusterPin': 'Exemple de marcador agrupat',
  'map.legend.clusterPinMeaning': 'Llocs agrupats',

  'map.filter.label': 'Filtra els llocs per categoria',
  'map.filter.all': 'Tots',
  'map.filter.category': {
    one: '{name} · {places} lloc',
    many: '{name} · {places} llocs',
    other: '{name} · {places} llocs',
  },

  'map.pin.day': 'Dia {day}',
  'map.pin.cluster': {
    one: '{places} lloc — amplia per aïllar-lo',
    many: '{places} llocs — amplia per separar-los',
    other: '{places} llocs — amplia per separar-los',
  },

  'map.place.rating': 'Valorat amb {rating} de {max}',
  'map.place.clause.day': 'dia {day}',
  'map.place.clause.rating': 'valorat amb {rating} de {max}',
  'map.place.clause.visited': 'visitat',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Darrera visita',
  'legend.recent': {
    one: 'Durant el darrer any',
    many: 'Durant els darrers {years} anys',
    other: 'Durant els darrers {years} anys',
  },
  'legend.middle': 'Fa {from}–{to} anys, o sense data',
  'legend.distant': {
    one: 'Fa més de {years} any',
    many: 'Fa més de {years} anys',
    other: 'Fa més de {years} anys',
  },
  'legend.unvisited': 'Encara no visitat',
  'legend.note':
    'El to només mostra com és de recent — la pestanya País escriu totes les dates.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Cobertura del món',
  'panel.coverage.unit': 'de {total}',
  'panel.coverage.caption': '{share} del món · {visits}',
  'panel.progress.label': 'Camí de tots els països',
  'panel.progress.remaining': '{remaining} per visitar',
  'panel.toggle.hide': 'Amaga els detalls del mapa del món',
  'panel.toggle.show': 'Mostra els detalls del mapa del món',
  'panel.tabs.label': 'Seccions del mapa del món',
  'panel.tab.country': 'País',
  'panel.tab.stats': 'Estadístiques',
  'panel.tab.bucket': 'Llista de desitjos',
  'panel.back': 'Tots els països',
  'panel.list.label': 'Països visitats',
  'panel.loading': 'S’està carregant el teu mapa del món',

  'panel.empty.blank.title': 'El teu mapa encara és en blanc',
  'panel.empty.blank.body':
    'Marca un país com a visitat i s’omplirà aquí al mapa, amb la primera i la darrera visita, quantes vegades hi has estat i tot el que n’hagis escrit.',
  'panel.empty.pick.title': 'Tria un país',
  'panel.empty.pick.body':
    'Tria’n un al mapa, al camp de cerca o a la llista, i la seva fitxa completa s’obrirà aquí — primera visita, darrera visita, el recompte i la teva nota.',

  'panel.stat.places': 'Els teus llocs',
  'panel.stat.placesNone': 'Encara no hi ha res fixat en cap viatge',
  'panel.stat.placesCaption': 'Llocs d’interès, allotjaments i parades desats',
  'panel.stat.regions': 'Les teves regions',
  'panel.stat.regionsNone': 'Encara no hi ha cap regió marcada',
  'panel.stat.regionsCaption': 'Estats, províncies, prefectures',
  'panel.stat.visits': 'Les teves visites',
  'panel.stat.visitsCaption': 'Cada arribada registrada',
  'panel.stat.trips': 'Els teus viatges',
  'panel.stat.tripsCaption': 'Tots els viatges en què participes',
  'panel.stat.cities': 'Les teves ciutats',
  'panel.stat.citiesCaption': 'Ciutats on has dormit o has fet parada',
  'panel.stat.days': 'Els teus dies de viatge',
  'panel.stat.daysCaption': 'Comptant tots els viatges del teu registre',
  'panel.continents.label': 'Països per continent',

  'panel.bucket.empty.title': 'Res a la llista',
  'panel.bucket.empty.body':
    'Aquell lloc on sempre has volgut anar. Afegeix-lo, i marca’l com a fet quan hi arribis.',
  'panel.bucket.label': 'Llista de desitjos',
  'panel.bucket.progress': '{done} de {total} fets',
  'panel.bucket.done': 'Fets',
  'panel.bucket.toGo': 'Pendents',
  'panel.bucket.target': 'per al {year}',
  'panel.bucket.hidden': {
    one: '{entries} entrada més a la teva llista, que no es mostra aquí.',
    many: '{entries} entrades més a la teva llista, que no es mostren aquí.',
    other: '{entries} entrades més a la teva llista, que no es mostren aquí.',
  },
  'panel.bucket.kind.country': 'País',
  'panel.bucket.kind.region': 'Regió',
  'panel.bucket.kind.place': 'Lloc',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Àfrica',
  'continent.antarctica': 'Antàrtida',
  'continent.asia': 'Àsia',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Amèrica del Nord',
  'continent.oceania': 'Austràlia i Oceania',
  'continent.southAmerica': 'Amèrica del Sud',
  'continent.unknown': 'Continent no registrat',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visitat',
  'record.firstVisit': 'Primera visita',
  'record.lastVisit': 'Darrera visita',
  'record.visitDates': 'Dates de les visites',
  'record.notRecorded': 'No registrat',
  'record.datesUnrecorded': 'Dates no registrades',
  'record.visits': {
    one: '{visits} visita',
    many: '{visits} visites',
    other: '{visits} visites',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Primera visita {from}',
  'record.spanTo': 'Darrera visita {to}',
  'record.visitsUnit': { one: 'visita', many: 'visites', other: 'visites' },
  'record.gap.days': {
    one: 'amb {gap} dia de diferència',
    many: 'amb {gap} dies de diferència',
    other: 'amb {gap} dies de diferència',
  },
  'record.gap.months': {
    one: 'amb {gap} mes de diferència',
    many: 'amb {gap} mesos de diferència',
    other: 'amb {gap} mesos de diferència',
  },
  'record.gap.years': {
    one: 'amb {gap} any de diferència',
    many: 'amb {gap} anys de diferència',
    other: 'amb {gap} anys de diferència',
  },
  'record.note.empty': 'Encara no hi ha cap nota',
  'record.noOutline':
    'Els contorns del món que dibuixa aquest mapa estan tallats a 1:110m, una escala que fon aquest territori amb l’estat de què depèn — així que al mapa no hi ha res per enquadrar. La visita compta igualment.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordena els països',
  'list.sort.code': 'Codi de país',
  'list.sort.codeStatement': 'Ordenats per codi de país, de la A a la Z.',
  'list.sort.name': 'Nom del país',
  'list.sort.nameStatement':
    'Ordenats per nom de país, de la A a la Z, i després per codi de país.',
  'list.sort.recent': 'Visita més recent',
  'list.sort.recentStatement':
    'Ordenats amb la visita més recent primer, i després per codi de país.',
  'list.sort.visits': 'Més visites',
  'list.sort.visitsStatement':
    'Ordenats amb més visites primer, i després per codi de país.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Fos amb l’estat de què depèn pels contorns del món, així que al mapa no hi ha res per enquadrar.',
  'list.announce.selected': '{name} seleccionat.',
  'list.announce.selectedUnframed': '{name} seleccionat. {reason}',
  'list.empty.title': 'Encara no hi ha països al mapa',
  'list.empty.body':
    'Un país apareix aquí tan bon punt s’hi registra una visita, amb la primera arribada, la més recent i quantes vegades hi has estat.',
  'list.loading': 'S’estan carregant els països visitats',
  'list.error.title': 'Els teus països no s’han carregat',
  'list.error.body':
    'El mapa del món no ha pogut llegir els teus països visitats ara mateix. No s’ha perdut res — continuen registrats.',
  'list.error.retry': 'Torna-ho a provar',
  'list.error.retrying': 'S’estan carregant els teus països',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Troba un país',
  'search.loading': 'S’estan carregant els teus països',
  'search.placeholder': 'Nom del país o codi',
  'search.entry.notVisited': 'Encara no visitat',
  'search.entry.noOutline': 'sense contorn al mapa',
  'search.entry.separator': ' · ',
  'search.cleared': 'Selecció esborrada.',
  'search.unframed':
    '{name} no té contorn a escala mundial, així que el mapa no té res per enquadrar.',
  'search.unframedVisited':
    '{name} no té contorn a escala mundial, així que el mapa no té res per enquadrar. La seva fitxa no se’n ressent.',
  'search.results.empty':
    'Encara no hi ha països al teu registre. Escriu per cercar entre tots els països del món.',
  'search.results.emptyPinned':
    '{name} està seleccionat. Encara no hi ha països al teu registre — escriu per cercar entre tots els països del món.',
  'search.results.record': {
    one: '{countries} país al teu registre.',
    many: '{countries} països al teu registre.',
    other: '{countries} països al teu registre.',
  },
  'search.results.capped': 'Es mostren els primers {shown}.',
  'search.results.pinned': '{name} està seleccionat i apareix primer.',
  'search.results.none': 'Cap país no coincideix amb {term}.',
  'search.results.matches': {
    one: '{countries} país coincideix amb {term}.',
    many: '{countries} països coincideixen amb {term}.',
    other: '{countries} països coincideixen amb {term}.',
  },
  'search.announce.selected': '{name} seleccionat.',
  'search.announce.framing': '{name} seleccionat. El mapa l’està enquadrant.',
  'search.announce.unframed': '{name} seleccionat. {reason}',
  'search.empty.title': 'Encara no hi ha res al teu registre',
  'search.empty.body':
    'Escriu el nom d’un país, o el seu codi de dues lletres, per trobar-lo al mapa.',
  'search.empty.noMatchTitle': 'Cap país no coincideix amb «{term}»',
  'search.empty.noMatchBody':
    'Comprova’n l’ortografia, o prova el codi de dues lletres — PT troba Portugal. Tots els {countries} països es poden cercar, hi hagis estat o no.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'El teu registre',
  'actions.visit.absent.title': 'No visitat',
  'actions.visit.absent.caption': 'Una visita sense cap viatge al darrere.',
  'actions.visit.title': 'Visitat',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Fora de la llista',
  'actions.goal.absent.caption': 'Un lloc on tens pensat anar.',
  'actions.goal.title': 'A la llista de desitjos',
  'actions.goal.waiting': 'Espera el seu torn.',
  'actions.goal.target': 'Amb la mirada posada al {year}.',
  'actions.goal.achieved.title': 'Marcat com a fet',
  'actions.goal.achieved.caption':
    'Hi has arribat. L’entrada es queda com a record.',

  'actions.button.remove': 'Treu',
  'actions.button.mark': 'Marca com a visitat',
  'actions.button.add': 'Afegeix a la llista',
  'actions.visit.remove.name': 'Treu {name} del teu mapa del món',
  'actions.visit.remove.busy': 'S’està traient {name} del teu mapa del món',
  'actions.visit.add.name': 'Marca com a visitat, {name}',
  'actions.visit.add.busy': 'S’està marcant {name} com a visitat',
  'actions.goal.remove.name': 'Treu {name} de la teva llista de desitjos',
  'actions.goal.remove.busy':
    'S’està traient {name} de la teva llista de desitjos',
  'actions.goal.add.name': 'Afegeix a la llista, {name}',
  'actions.goal.add.busy': 'S’està afegint {name} a la teva llista de desitjos',

  'actions.hint':
    'Totes dues coses tenen efecte a l’instant, i totes dues es poden desfer aquí.',
  'actions.offline':
    'El teu dispositiu no ha pogut contactar amb el servidor. Comprova la connexió i torna-ho a provar.',
  'actions.toast.marked': 'Marcat com a visitat',
  'actions.toast.markedBody': '{name} és al teu mapa del món.',
  'actions.toast.markFailed': '{name} no s’ha marcat',
  'actions.toast.unmarked': 'Tret del teu mapa del món',
  'actions.toast.unmarkedBody': '{name} ja no està marcat com a visitat.',
  'actions.toast.unmarkFailed': '{name} no s’ha tret',
  'actions.toast.listed': 'Afegit a la teva llista de desitjos',
  'actions.toast.listedBody': '{name} és un lloc on tens pensat anar.',
  'actions.toast.listFailed': '{name} no s’ha afegit',
  'actions.toast.unlisted': 'Tret de la teva llista de desitjos',
  'actions.toast.unlistedBody': '{name} ja no és a la llista.',
  'actions.toast.unlistFailed': '{name} no s’ha tret',
  'actions.toast.fallback':
    'El canvi no ha arribat al servidor. Torna-ho a provar d’aquí a un moment.',

  'actions.confirm.visit.title': 'Vols treure {name} del teu mapa del món?',
  'actions.confirm.visit.body': {
    one: '{visits} visita registrada{dates} s’esborraria{note}. Els teus viatges i els llocs desats no es toquen.',
    many: '{visits} visites registrades{dates} s’esborrarien{note}. Els teus viatges i els llocs desats no es toquen.',
    other:
      '{visits} visites registrades{dates} s’esborrarien{note}. Els teus viatges i els llocs desats no es toquen.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', juntament amb la nota que hi vas escriure',
  'actions.confirm.goal.title':
    'Vols treure {name} de la teva llista de desitjos?',
  'actions.confirm.goal.body':
    'Ja està marcat com a fet, així que això també esborra el record que hi vas arribar. El teu mapa del món i els teus viatges no es toquen.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Viatge de l’espai de treball',
    many: 'Viatges de l’espai de treball',
    other: 'Viatges de l’espai de treball',
  },
  'card.visits': { one: 'Visita', many: 'Visites', other: 'Visites' },
  'card.places': {
    one: 'Lloc de l’espai de treball',
    many: 'Llocs de l’espai de treball',
    other: 'Llocs de l’espai de treball',
  },
  'card.firstTrip': 'Primer viatge',
  'card.lastTrip': 'Darrer viatge',
  'card.firstVisit': 'Primera visita',
  'card.lastVisit': 'Darrera visita',
  'card.absent': 'No registrat',
  'card.loading': 'S’està carregant aquest país',
  'card.loadingNamed': 'S’està carregant {name}',
  'card.error.body': 'Aquestes xifres no s’han carregat. No s’ha perdut res.',
  'card.error.retry': 'Torna-ho a provar',
  'overlay.close': 'Tanca {name}',
  'regions.label': 'Regions visitades',
  'regions.hint': 'Afegir una regió també marca {country} com a visitat.',
  'regions.keeps': 'Eliminar una regió no treu {country} del teu atles.',
  'regions.keeps.unvisited':
    'Aquestes regions queden desades. Marca {country} com a visitat o afegeix una regió per tornar-lo al mapa.',
  'regions.empty.title': 'Encara no hi ha regions registrades aquí',
  'regions.empty.body':
    'Afegeix un estat, província o zona que hagis visitat a {country}.',
  'regions.input.label': 'Afegir una regió a {country}',
  'regions.input.placeholder': 'Per exemple, Baviera',
  'regions.add': 'Afegir regió',
  'regions.adding': 'Afegint {region}',
  'regions.remove': 'Eliminar {region}',
  'regions.loading': 'Carregant les teves regions',
  'regions.status.added': 'S’ha afegit {region}',
  'regions.status.exists': '{region} ja està registrat',
  'regions.status.removed': 'S’ha eliminat {region}',
  'regions.status.addedCountry':
    'S’ha afegit {region}. {country} ara està marcat com a visitat.',
  'regions.error.invalid': 'Escriu el nom d’una regió.',
  'regions.error.hidden':
    'El nom conté caràcters no admesos. Elimina’ls i torna-ho a provar.',
  'regions.error.load': 'No hem pogut carregar les teves regions de {country}.',
  'regions.error.add': 'No hem pogut afegir {region}. Torna-ho a provar.',
  'regions.error.remove': 'No hem pogut eliminar {region}. Torna-ho a provar.',
  'regions.error.full':
    'Has registrat {limit} regions. Elimina’n una per afegir-ne una altra.',
  'regions.reload': 'Recarregar regions',
  'actions.confirm.visitRegions.body': {
    one: '{history}Les regions registrades a {country} queden desades: {count}.',
    many: '{history}Les regions registrades a {country} queden desades: {count}.',
    other:
      '{history}Les regions registrades a {country} queden desades: {count}.',
  },
  'regions.error.uncertain':
    'No hem pogut confirmar el canvi. Recarrega les regions per comprovar què s’ha desat.',
  'regions.status.refreshFailed':
    '{result} No s’ha pogut actualitzar l’atles. Recarrega’l per actualitzar el mapa.',

  'panel.stat.periodLabel': 'Mostra les xifres de',
  'panel.stat.allTime': 'Tot el període',
  'panel.stat.groupAll': 'Xifres de tot el període',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Xifres de {year}',
  'panel.stat.announceAll': 'Es mostren les xifres de tot el període.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Es mostren les xifres de {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Viatges que comencen el {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'En viatges que comencen el {year}',
  'panel.stat.countries': 'Països dels teus viatges',
  'panel.stat.countriesCaption': 'Països diferents en aquests viatges',
  'panel.stat.streak': 'La teva ratxa anual',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Viatges cada any, de {first} a {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Un viatge el {last}',
  'panel.stat.streakNone': 'Afegeix un viatge amb dates per iniciar una ratxa',
} satisfies TranslationOf<typeof En>

export default messages
