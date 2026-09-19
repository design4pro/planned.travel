/**
 * The world tracker and the map chrome, in Spanish.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** «Mapa del mundo» for the atlas module — the words
 * `es/shell.ts` already uses for `nav.atlas` — «viaje» for a trip and «lista
 * de deseos» for the bucket list. The traveller's log of visits is «tu
 * registro», one word chosen once and kept through the search, the stats and
 * the write actions. The address is «tú» throughout, matching the rest of the
 * catalogue.
 *
 * **Plural.** `Intl.PluralRules('es')` reports `one`, `many` and `other`;
 * `many` covers the million-scale round numbers and reads like `other`, the
 * same three branches the rest of the Spanish catalogue writes.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Spanish uses, and the parity suite exempts them
 * structurally. `continent.asia` is «Continente asiático» rather than the
 * homograph «Asia», so the label reads as Spanish instead of tripping the
 * untranslated check.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Mapa del mundo. Aún no hay países marcados como visitados.',
  'screen.world.summary':
    'Mapa del mundo con {visited} de {total} países marcados como visitados.',
  'screen.error.title': 'El mapa del mundo no se cargó',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Cargando el mapa',
  'map.controls.label': 'Controles del mapa',
  'map.controls.zoomIn': 'Acercar',
  'map.controls.zoomOut': 'Alejar',
  'map.controls.north': 'Orientar al norte',
  'map.controls.locate': 'Encontrar mi ubicación',
  'map.controls.locateFailed': 'No pudimos obtener tu ubicación.',
  'map.controls.locateFailedBody':
    'Comprueba que el acceso a la ubicación está permitido para este sitio y vuelve a intentarlo.',

  'map.attribution.label': 'Datos del mapa de',
  'map.attribution.geocoder': 'Lugares localizados con',

  'map.basemap.title': 'Mapa base no disponible',
  'map.basemap.body':
    'El detalle de las calles está sin conexión. Cada lugar se muestra igualmente en su posición real, así que las distancias y los grupos siguen siendo exactos.',
  'map.basemap.credit': 'Costas de',
  'map.basemap.retry': 'Reintentar',
  'map.basemap.retrying': 'Buscando el mapa base',

  'map.engine.unsupported.title': 'Representación del mapa no disponible',
  'map.engine.unsupported.body':
    'Este navegador no puede ejecutar el mapa interactivo: necesita WebGL2 y aquí no hay ningún contexto WebGL2 disponible. Nada más en esta pantalla depende de él.',
  'map.engine.stalled.title': 'El mapa aún no ha dibujado nada',
  'map.engine.stalled.body':
    'No apareció nada en el tiempo que el mapa tiene para arrancar. Puede que se recupere por sí solo; nada más en esta pantalla depende de él.',

  'map.coverage.partial.title': 'Detalle de calles parcial',
  'map.coverage.partial.body': {
    one: 'Los datos publicados del mapa no llegan a {outside} lugar de este viaje. Está dibujado en su posición real sobre nuestras propias costas.',
    many: 'Los datos publicados del mapa no llegan a {outside} lugares de este viaje. Están dibujados en sus posiciones reales sobre nuestras propias costas.',
    other:
      'Los datos publicados del mapa no llegan a {outside} lugares de este viaje. Están dibujados en sus posiciones reales sobre nuestras propias costas.',
  },
  'map.coverage.none.title': 'Aquí no hay detalle de calles',
  'map.coverage.none.body':
    'Las calles aún no están publicadas para esta región. Las costas, las chinchetas y las rutas entre ellas son todas reales — solo faltan los edificios y las carreteras.',
  'map.coverage.dismiss': 'Descartar la nota de cobertura del mapa',

  'map.legend.title': 'Leyenda',
  'map.legend.collapse': 'Contraer {title}',
  'map.legend.expand': 'Expandir {title}',
  'map.legend.dayPin': 'Ejemplo de chincheta de día',
  'map.legend.dayPinMeaning': 'Día del itinerario',
  'map.legend.clusterPin': 'Ejemplo de chincheta agrupada',
  'map.legend.clusterPinMeaning': 'Lugares agrupados',

  'map.filter.label': 'Filtrar lugares por categoría',
  'map.filter.all': 'Todos',
  'map.filter.category': {
    one: '{name} · {places} lugar',
    many: '{name} · {places} lugares',
    other: '{name} · {places} lugares',
  },

  'map.pin.day': 'Día {day}',
  'map.pin.cluster': {
    one: '{places} lugar — acerca el mapa para aislarlo',
    many: '{places} lugares — acerca el mapa para separarlos',
    other: '{places} lugares — acerca el mapa para separarlos',
  },

  'map.place.rating': 'Valorado con {rating} de {max}',
  'map.place.clause.day': 'día {day}',
  'map.place.clause.rating': 'valorado con {rating} de {max}',
  'map.place.clause.visited': 'visitado',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Última visita',
  'legend.recent': {
    one: 'En el último año',
    many: 'En los últimos {years} años',
    other: 'En los últimos {years} años',
  },
  'legend.middle': 'Hace {from}–{to} años, o sin fecha',
  'legend.distant': {
    one: 'Hace más de {years} año',
    many: 'Hace más de {years} años',
    other: 'Hace más de {years} años',
  },
  'legend.unvisited': 'Aún sin visitar',
  'legend.note':
    'El tono solo muestra lo reciente que fue — la pestaña País escribe todas las fechas.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Cobertura del mundo',
  'panel.coverage.unit': 'de {total}',
  'panel.coverage.caption': '{share} del mundo · {visits}',
  'panel.progress.label': 'Camino de todos los países',
  'panel.progress.remaining': '{remaining} por visitar',
  'panel.toggle.hide': 'Ocultar los detalles del mapa del mundo',
  'panel.toggle.show': 'Mostrar los detalles del mapa del mundo',
  'panel.tabs.label': 'Secciones del mapa del mundo',
  'panel.tab.country': 'País',
  'panel.tab.stats': 'Estadísticas',
  'panel.tab.bucket': 'Lista de deseos',
  'panel.back': 'Todos los países',
  'panel.list.label': 'Países visitados',
  'panel.loading': 'Cargando tu mapa del mundo',

  'panel.empty.blank.title': 'Tu mapa sigue en blanco',
  'panel.empty.blank.body':
    'Marca un país como visitado y se rellenará aquí en el mapa, con su primera y su última visita, cuántas veces has estado y lo que escribiste sobre él.',
  'panel.empty.pick.title': 'Elige un país',
  'panel.empty.pick.body':
    'Elige uno en el mapa, en el buscador o en la lista, y su ficha completa se abre aquí — primera visita, última visita, el recuento y tu nota.',

  'panel.stat.places': 'Tus lugares',
  'panel.stat.placesNone': 'Aún no hay nada fijado en un viaje',
  'panel.stat.placesCaption': 'Sitios, alojamientos y paradas guardados',
  'panel.stat.regions': 'Regiones',
  'panel.stat.regionsNone': 'Aún no hay regiones marcadas',
  'panel.stat.regionsCaption': 'Estados, provincias, prefecturas',
  'panel.stat.visits': 'Visitas',
  'panel.stat.visitsCaption': 'Cada llegada registrada',
  'panel.stat.trips': 'Tus viajes',
  'panel.stat.tripsCaption': 'Todos los viajes en los que participas',
  'panel.stat.cities': 'Ciudades',
  'panel.stat.citiesCaption': 'Ciudades donde dormiste o hiciste parada',
  'panel.stat.days': 'Días fuera',
  'panel.stat.daysCaption': 'Sumando todos los viajes de tu registro',
  'panel.continents.label': 'Países por continente',

  'panel.bucket.empty.title': 'Nada en la lista',
  'panel.bucket.empty.body':
    'Ese sitio al que siempre quisiste ir. Añádelo, y táchalo cuando llegues.',
  'panel.bucket.label': 'Lista de deseos',
  'panel.bucket.progress': '{done} de {total} cumplidos',
  'panel.bucket.done': 'Cumplidos',
  'panel.bucket.toGo': 'Pendientes',
  'panel.bucket.target': 'para {year}',
  'panel.bucket.hidden': {
    one: '{entries} entrada más en tu lista, no mostrada aquí.',
    many: '{entries} entradas más en tu lista, no mostradas aquí.',
    other: '{entries} entradas más en tu lista, no mostradas aquí.',
  },
  'panel.bucket.kind.country': 'País',
  'panel.bucket.kind.region': 'Región',
  'panel.bucket.kind.place': 'Lugar',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'África',
  'continent.antarctica': 'Antártida',
  'continent.asia': 'Continente asiático',
  'continent.europe': 'Europa',
  'continent.northAmerica': 'Norteamérica',
  'continent.oceania': 'Oceanía',
  'continent.southAmerica': 'Sudamérica',
  'continent.unknown': 'Continente sin registrar',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visitado',
  'record.firstVisit': 'Primera visita',
  'record.lastVisit': 'Última visita',
  'record.visitDates': 'Fechas de visita',
  'record.notRecorded': 'Sin registrar',
  'record.datesUnrecorded': 'Fechas sin registrar',
  'record.visits': {
    one: '{visits} visita',
    many: '{visits} visitas',
    other: '{visits} visitas',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'Primera visita {from}',
  'record.spanTo': 'Última visita {to}',
  'record.visitsUnit': { one: 'visita', many: 'visitas', other: 'visitas' },
  'record.gap.days': {
    one: 'con {gap} día de diferencia',
    many: 'con {gap} días de diferencia',
    other: 'con {gap} días de diferencia',
  },
  'record.gap.months': {
    one: 'con {gap} mes de diferencia',
    many: 'con {gap} meses de diferencia',
    other: 'con {gap} meses de diferencia',
  },
  'record.gap.years': {
    one: 'con {gap} año de diferencia',
    many: 'con {gap} años de diferencia',
    other: 'con {gap} años de diferencia',
  },
  'record.note.empty': 'Aún sin nota',
  'record.noOutline':
    'Los contornos del mundo que dibuja este mapa están cortados a 1:110m, y esa escala funde este territorio con su estado matriz — así que no hay nada que encuadrar en el mapa. La visita cuenta igualmente.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ordenar países',
  'list.sort.code': 'Código de país',
  'list.sort.codeStatement': 'Ordenados por código de país, de la A a la Z.',
  'list.sort.name': 'Nombre del país',
  'list.sort.nameStatement':
    'Ordenados por nombre de país, de la A a la Z, y luego por código de país.',
  'list.sort.recent': 'Visita más reciente',
  'list.sort.recentStatement':
    'Ordenados por la visita más reciente primero, y luego por código de país.',
  'list.sort.visits': 'Más visitas',
  'list.sort.visitsStatement':
    'Ordenados por el mayor número de visitas primero, y luego por código de país.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Fundido con su estado matriz por los contornos del mundo, así que no hay nada que encuadrar en el mapa.',
  'list.announce.selected': '{name} seleccionado.',
  'list.announce.selectedUnframed': '{name} seleccionado. {reason}',
  'list.empty.title': 'Aún no hay países en el mapa',
  'list.empty.body':
    'Un país aparece aquí en cuanto se registra una visita, con la primera llegada, la más reciente y cuántas veces has estado.',
  'list.loading': 'Cargando los países visitados',
  'list.error.title': 'Tus países no se cargaron',
  'list.error.body':
    'El mapa del mundo no pudo leer tus países visitados ahora mismo. No se ha perdido nada — siguen registrados.',
  'list.error.retry': 'Reintentar',
  'list.error.retrying': 'Cargando tus países',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Encontrar un país',
  'search.loading': 'Cargando tus países',
  'search.placeholder': 'Nombre del país o código',
  'search.entry.notVisited': 'Aún sin visitar',
  'search.entry.noOutline': 'sin contorno en el mapa',
  'search.entry.separator': ' · ',
  'search.cleared': 'Selección borrada.',
  'search.unframed':
    '{name} no tiene contorno a escala mundial, así que el mapa no tiene nada que encuadrar.',
  'search.unframedVisited':
    '{name} no tiene contorno a escala mundial, así que el mapa no tiene nada que encuadrar. Su ficha no se ve afectada.',
  'search.results.empty':
    'Aún no hay países en tu registro. Escribe para buscar entre todos los países del mundo.',
  'search.results.emptyPinned':
    '{name} está seleccionado. Aún no hay países en tu registro — escribe para buscar entre todos los países del mundo.',
  'search.results.record': {
    one: '{countries} país en tu registro.',
    many: '{countries} países en tu registro.',
    other: '{countries} países en tu registro.',
  },
  'search.results.capped': 'Se muestran los primeros {shown}.',
  'search.results.pinned': '{name} está seleccionado y aparece primero.',
  'search.results.none': 'Ningún país coincide con {term}.',
  'search.results.matches': {
    one: '{countries} país coincide con {term}.',
    many: '{countries} países coinciden con {term}.',
    other: '{countries} países coinciden con {term}.',
  },
  'search.announce.selected': '{name} seleccionado.',
  'search.announce.framing':
    '{name} seleccionado. El mapa lo está encuadrando.',
  'search.announce.unframed': '{name} seleccionado. {reason}',
  'search.empty.title': 'Aún no hay nada en tu registro',
  'search.empty.body':
    'Escribe el nombre de un país, o su código de dos letras, para encontrarlo en el mapa.',
  'search.empty.noMatchTitle': 'Ningún país coincide con «{term}»',
  'search.empty.noMatchBody':
    'Comprueba la ortografía, o prueba con el código de dos letras — PT encuentra Portugal. Los {countries} países se pueden buscar, hayas estado o no.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Tu registro',
  'actions.visit.absent.title': 'Sin visitar',
  'actions.visit.absent.caption': 'Una visita sin viaje detrás.',
  'actions.visit.title': 'Visitado',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Fuera de la lista',
  'actions.goal.absent.caption': 'Un sitio al que piensas ir.',
  'actions.goal.title': 'En la lista de deseos',
  'actions.goal.waiting': 'Espera su turno.',
  'actions.goal.target': 'Con la mira en {year}.',
  'actions.goal.achieved.title': 'Tachado de la lista',
  'actions.goal.achieved.caption':
    'Llegaste. La entrada se queda como recuerdo.',

  'actions.button.remove': 'Quitar',
  'actions.button.mark': 'Marcar visitado',
  'actions.button.add': 'Añadir a la lista',
  'actions.visit.remove.name': 'Quitar {name} de tu mapa del mundo',
  'actions.visit.remove.busy': 'Quitando {name} de tu mapa del mundo',
  'actions.visit.add.name': 'Marcar visitado, {name}',
  'actions.visit.add.busy': 'Marcando {name} como visitado',
  'actions.goal.remove.name': 'Quitar {name} de tu lista de deseos',
  'actions.goal.remove.busy': 'Quitando {name} de tu lista de deseos',
  'actions.goal.add.name': 'Añadir a la lista, {name}',
  'actions.goal.add.busy': 'Añadiendo {name} a tu lista de deseos',

  'actions.hint':
    'Ambas cosas surten efecto al momento, y ambas se pueden deshacer aquí.',
  'actions.offline':
    'Tu dispositivo no pudo conectar con el servidor. Comprueba la conexión y vuelve a intentarlo.',
  'actions.toast.marked': 'Marcado como visitado',
  'actions.toast.markedBody': '{name} está en tu mapa del mundo.',
  'actions.toast.markFailed': '{name} no se marcó',
  'actions.toast.unmarked': 'Quitado de tu mapa del mundo',
  'actions.toast.unmarkedBody': '{name} ya no está marcado como visitado.',
  'actions.toast.unmarkFailed': '{name} no se quitó',
  'actions.toast.listed': 'Añadido a tu lista de deseos',
  'actions.toast.listedBody': '{name} es un sitio al que piensas ir.',
  'actions.toast.listFailed': '{name} no se añadió',
  'actions.toast.unlisted': 'Quitado de tu lista de deseos',
  'actions.toast.unlistedBody': '{name} ya no está en la lista.',
  'actions.toast.unlistFailed': '{name} no se quitó',
  'actions.toast.fallback':
    'El cambio no llegó al servidor. Vuelve a intentarlo en un momento.',

  'actions.confirm.visit.title': '¿Quitar {name} de tu mapa del mundo?',
  'actions.confirm.visit.body': {
    one: '{visits} visita registrada{dates} se borraría{note}. Tus viajes y tus lugares guardados no se tocan.',
    many: '{visits} visitas registradas{dates} se borrarían{note}. Tus viajes y tus lugares guardados no se tocan.',
    other:
      '{visits} visitas registradas{dates} se borrarían{note}. Tus viajes y tus lugares guardados no se tocan.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', junto con la nota que escribiste',
  'actions.confirm.goal.title': '¿Quitar {name} de tu lista de deseos?',
  'actions.confirm.goal.body':
    'Ya está tachado, así que esto también borra el recuerdo de que llegaste. Tu mapa del mundo y tus viajes no se tocan.',

  /* ------------------------------------------------- the card over the map */
  'card.trips': {
    one: 'Viaje del espacio de trabajo',
    many: 'Viajes del espacio de trabajo',
    other: 'Viajes del espacio de trabajo',
  },
  'card.visits': { one: 'Visita', many: 'Visitas', other: 'Visitas' },
  'card.places': {
    one: 'Lugar del espacio de trabajo',
    many: 'Lugares del espacio de trabajo',
    other: 'Lugares del espacio de trabajo',
  },
  'card.firstTrip': 'Primer viaje',
  'card.lastTrip': 'Último viaje',
  'card.firstVisit': 'Primera visita',
  'card.lastVisit': 'Última visita',
  'card.absent': 'Sin registrar',
  'card.loading': 'Cargando este país',
  'card.loadingNamed': 'Cargando {name}',
  'card.error.body': 'Estas cifras no se cargaron. No se ha perdido nada.',
  'card.error.retry': 'Reintentar',
  'overlay.close': 'Cerrar {name}',
} satisfies TranslationOf<typeof En>

export default messages
