/**
 * Everything the world tracker and the map chrome say, in the source locale.
 *
 * `docs/SPEC.md` §8 fixes the shape: one flat object of keys, default-exported,
 * at `messages/<locale>/<namespace>.ts`, and a screen reads a key as
 * `t('atlas.<key>')`. `../../types.ts` derives the key union from this file, so
 * a typo is a compile error at the call site rather than an English sentence
 * leaking onto an Arabic screen — §8.2 bans that fallback outright.
 *
 * **What is here.** Three surfaces, one namespace, because they are one screen:
 *
 * - `/atlas` itself (`src/routes/_app/atlas.tsx` and its `-ui/` screen), whose
 *   only copy is the map's accessible name and the failed-read panel;
 * - `src/components/atlas/**` — the shelf, the country record, the list, the
 *   search, the two writes and the card the map opens under the pointer;
 * - `src/components/map/**` — the zoom cluster, the legend, the credit, the
 *   basemap and coverage notices, the pins and the marker card.
 *
 * The map module is filed under `atlas` rather than given a namespace of its
 * own because §8 fixes exactly ten namespaces and adding an eleventh is a
 * contract change. The trip planner mounts the same controls, so the keys below
 * that begin `map.` are read on two screens and must stay screen-neutral: the
 * zoom button says "Zoom in", never "Zoom the atlas in".
 *
 * **What is deliberately not here.**
 *
 * - **Country names.** `src/lib/atlas/country-names.ts` is a frozen English
 *   table of 249 names, and it stays frozen. `Intl.DisplayNames` disagrees with
 *   itself between workerd and WebKit, which §8.5 calls a defect rather than a
 *   tolerance, and translating 249 names into 23 locales is not work §8 asks
 *   for. A country is named the same on every locale of this screen.
 * - **Dates, numbers and distances.** They come from `src/lib/format.ts`, which
 *   is the product's single formatter and is frozen against the same runtime
 *   divergence. Every number a reader sees is interpolated here as an
 *   *already formatted* string; a plural message's `count` selects the CLDR
 *   branch and is never itself printed (§8, "Numbers inside messages").
 * - **Continent values.** The column is free text, so `continent.*` covers the
 *   canonical six plus Antarctica and anything else falls through to the raw
 *   value rather than being dropped.
 */

import type { NamespaceMessages } from '../../types'

const messages = {
  /* ------------------------------------------------------------- the screen */
  /**
   * The map's accessible name. Two shapes, because "0 of 195" read out as a
   * proportion is a worse answer than saying plainly that nothing is marked.
   */
  'screen.world.empty': 'World map. No countries marked as visited yet.',
  'screen.world.summary':
    'World map with {visited} of {total} countries marked as visited.',
  'screen.error.title': 'The atlas did not load',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Loading map',
  'map.controls.label': 'Map controls',
  'map.controls.zoomIn': 'Zoom in',
  'map.controls.zoomOut': 'Zoom out',
  'map.controls.north': 'Face north',
  'map.controls.locate': 'Find my location',
  'map.controls.locateFailed': 'We could not get your location.',
  'map.controls.locateFailedBody':
    'Check that location access is allowed for this site, then try again.',

  /** Heard, never seen: the pill beside it is the credit a reader can read. */
  'map.attribution.label': 'Map data from',
  'map.attribution.geocoder': 'Places located with',

  'map.basemap.title': 'Basemap unavailable',
  'map.basemap.body':
    'Street detail is offline. Every place is still shown at its real position, so distances and clusters remain accurate.',
  /** Followed by the outline source's own link, which is a proper noun. */
  'map.basemap.credit': 'Coastlines from',
  'map.basemap.retry': 'Try again',
  'map.basemap.retrying': 'Checking for the basemap',

  'map.engine.unsupported.title': 'Map rendering unavailable',
  'map.engine.unsupported.body':
    'This browser cannot run the interactive map: it needs WebGL2, and no WebGL2 context is available here. Nothing else on this screen depends on it.',
  'map.engine.stalled.title': 'The map has not drawn yet',
  'map.engine.stalled.body':
    'Nothing appeared in the time the map is given to start. It may still come good on its own; nothing else on this screen depends on it.',

  'map.coverage.partial.title': 'Partial street detail',
  /**
   * The count is emphasised in place, so the sentence is split at the
   * placeholder rather than assembled from two half-sentences a translator
   * cannot reorder.
   */
  'map.coverage.partial.body': {
    one: 'The published map data stops short of {outside} of this trip’s place. It is drawn at its real position on our own coastlines.',
    other:
      'The published map data stops short of {outside} of this trip’s places. They are drawn at their real positions on our own coastlines.',
  },
  'map.coverage.none.title': 'No street detail here',
  'map.coverage.none.body':
    'Streets are not published for this region yet. The coastlines, the pins and the routes between them are all real — only the buildings and roads are missing.',
  'map.coverage.dismiss': 'Dismiss the map coverage note',

  'map.legend.title': 'Legend',
  'map.legend.collapse': 'Collapse {title}',
  'map.legend.expand': 'Expand {title}',
  'map.legend.dayPin': 'Example day pin',
  'map.legend.dayPinMeaning': 'Itinerary day',
  'map.legend.clusterPin': 'Example grouped pin',
  'map.legend.clusterPinMeaning': 'Grouped places',

  'map.filter.label': 'Filter places by category',
  'map.filter.all': 'All',
  'map.filter.category': {
    one: '{name} · {places} place',
    other: '{name} · {places} places',
  },

  'map.pin.day': 'Day {day}',
  'map.pin.cluster': {
    one: '{places} place — zoom in to separate them',
    other: '{places} places — zoom in to separate them',
  },

  /** Read out beside the stars, which are decoration. */
  'map.place.rating': 'Rated {rating} out of {max}',
  /** Clauses of a marker's accessible name, joined by the locale's own comma. */
  'map.place.clause.day': 'day {day}',
  'map.place.clause.rating': 'rated {rating} out of {max}',
  'map.place.clause.visited': 'visited',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Last visit',
  /**
   * The boundaries come from the ramp `visitRecency()` actually cuts at, so
   * every step carries the number rather than a copywriter's approximation of
   * it. `count` picks the branch; `years` is the number as printed.
   */
  'legend.recent': {
    one: 'Within the last year',
    other: 'Within {years} years',
  },
  /**
   * Two meanings in one step, both stated: an undated country is painted the
   * middle shade because the ramp measures a last visit and there is none.
   */
  'legend.middle': '{from}–{to} years ago, or undated',
  'legend.distant': {
    one: 'Over {years} year ago',
    other: 'Over {years} years ago',
  },
  'legend.unvisited': 'Not visited yet',
  'legend.note':
    'Shade shows recency only — the Country tab writes out every date.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'World coverage',
  'panel.coverage.unit': 'of {total}',
  'panel.coverage.caption': '{share} of the world · {visits}',
  'panel.progress.label': 'Towards every country',
  'panel.progress.remaining': '{remaining} to go',
  'panel.toggle.hide': 'Hide atlas details',
  'panel.toggle.show': 'Show atlas details',
  'panel.tabs.label': 'Atlas sections',
  'panel.tab.country': 'Country',
  'panel.tab.stats': 'Stats',
  'panel.tab.bucket': 'Bucket list',
  /** The way back on a phone, where the record replaces the list. */
  'panel.back': 'All countries',
  'panel.list.label': 'Visited countries',
  'panel.loading': 'Loading your atlas',

  'panel.empty.blank.title': 'Your map is still blank',
  'panel.empty.blank.body':
    'Mark a country as visited and it fills in on the map here, with its first and last visit, how many times you have been and whatever you wrote about it.',
  'panel.empty.pick.title': 'Pick a country',
  'panel.empty.pick.body':
    'Choose one on the map, in the search field or from the list, and its full record opens here — first visit, last visit, the tally and your note.',

  /**
   * Whose places, for the reason `panel.stat.trips` gives for whose trips.
   *
   * `recomputeTravelStats` counts the places on the trips the reader is a
   * member of; the per-country tally under `card.places` is
   * `countVisitedPlacesByCountry`, which counts the workspace's. Both land on
   * `/atlas`, so each label names its own population.
   */
  'panel.stat.places': 'Your places',
  'panel.stat.placesNone': 'Nothing pinned on a trip yet',
  'panel.stat.placesCaption': 'Sights, stays and stops saved',
  'panel.stat.regions': 'Your regions',
  'panel.stat.regionsNone': 'No regions marked yet',
  'panel.stat.regionsCaption': 'States, provinces, prefectures',
  'panel.stat.visits': 'Your visits',
  'panel.stat.visitsCaption': 'Every recorded arrival',
  /**
   * Whose trips, said in the label, because the screen prints two counts.
   *
   * `recomputeTravelStats` counts the trips the reader is a member of (ADR 0007
   * and the `00-S4` amendment); the per-country tally under `card.trips` counts
   * the workspace's. Both are true, both are on `/atlas`, and in any workspace
   * where somebody is not on every trip the country cards sum higher than this
   * tile — which under a bare `Trips` reads as a broken aggregate rather than as
   * two answers. So each label names its own population, and a translation that
   * drops the qualifier puts that locale back where it started. The caption is
   * not a second chance to say it: this tile prints the recorded distance there
   * instead as soon as there is one.
   *
   * What the caption may not do is narrow the population further than the query
   * does. It read "Finished trips only", which is not what is counted:
   * `recomputeTravelStats` filters by membership and, on a year row, by
   * `start_date` — a trip that has not left yet is in this figure. Left as it
   * was, the caption answered the reader's "why is this lower than the cards?"
   * with the wrong reason.
   */
  'panel.stat.trips': 'Your trips',
  'panel.stat.tripsCaption': 'Every trip you are on',
  'panel.stat.cities': 'Your cities',
  'panel.stat.citiesCaption': 'Towns you slept or stopped in',
  'panel.stat.days': 'Your days away',
  'panel.stat.daysCaption': 'Across every trip on your record',
  'panel.continents.label': 'Countries by continent',

  'panel.bucket.empty.title': 'Nothing on the list',
  'panel.bucket.empty.body':
    'Somewhere you have always meant to go. Add it, and tick it off when you get there.',
  'panel.bucket.label': 'Bucket list',
  'panel.bucket.progress': '{done} of {total} done',
  'panel.bucket.done': 'Done',
  'panel.bucket.toGo': 'To go',
  'panel.bucket.target': 'by {year}',
  'panel.bucket.hidden': {
    one: '{entries} more entry on your list, not shown here.',
    other: '{entries} more entries on your list, not shown here.',
  },
  /** The three shapes `bucket_list_items.kind` can hold. */
  'panel.bucket.kind.country': 'Country',
  'panel.bucket.kind.region': 'Region',
  'panel.bucket.kind.place': 'Place',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Africa',
  'continent.antarctica': 'Antarctica',
  'continent.asia': 'Asia',
  'continent.europe': 'Europe',
  'continent.northAmerica': 'North America',
  'continent.oceania': 'Oceania',
  'continent.southAmerica': 'South America',
  'continent.unknown': 'Continent not recorded',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Visited',
  'record.firstVisit': 'First visit',
  'record.lastVisit': 'Last visit',
  'record.visitDates': 'Visit dates',
  'record.notRecorded': 'Not recorded',
  'record.datesUnrecorded': 'Dates not recorded',
  'record.visits': { one: '{visits} visit', other: '{visits} visits' },
  /**
   * Both ends of a range, printed whole. Never elided the way a trip's dates
   * are: these are two separate journeys weeks or years apart, and collapsing
   * them would imply the traveller stayed for the whole interval.
   */
  'record.span': '{from} – {to}',
  'record.spanFrom': 'First visit {from}',
  'record.spanTo': 'Last visit {to}',
  /** The bare unit under the tally numeral in a list row. */
  'record.visitsUnit': { one: 'visit', other: 'visits' },
  /**
   * How far apart two visits are, in the coarsest unit that is still true.
   * `count` picks the branch, `gap` is the figure as printed.
   */
  'record.gap.days': { one: '{gap} day apart', other: '{gap} days apart' },
  'record.gap.months': {
    one: '{gap} month apart',
    other: '{gap} months apart',
  },
  'record.gap.years': { one: '{gap} year apart', other: '{gap} years apart' },
  'record.note.empty': 'No note yet',
  /**
   * Said as a fact about the geometry, not as an error. Natural Earth's 1:110m
   * cut folds a dependency into its parent sovereign state — it is emphatically
   * not about size, and telling a reader French Guiana is too small would be a
   * factual untruth in a product about places.
   */
  'record.noOutline':
    'The world outlines this map draws are cut at 1:110m, which folds this territory into its parent state — so there is nothing to frame on the map. The visit still counts.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Order countries',
  'list.sort.code': 'Country code',
  'list.sort.codeStatement': 'Ordered by country code, A to Z.',
  'list.sort.name': 'Country name',
  'list.sort.nameStatement':
    'Ordered by country name, A to Z, then country code.',
  'list.sort.recent': 'Most recent visit',
  'list.sort.recentStatement':
    'Ordered by the most recent visit first, then country code.',
  'list.sort.visits': 'Most visits',
  'list.sort.visitsStatement':
    'Ordered by the most visits first, then country code.',
  /** One labelled date, folded into a row's accessible name. */
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Folded into its parent state by the world outlines, so there is nothing to frame on the map.',
  'list.announce.selected': '{name} selected.',
  'list.announce.selectedUnframed': '{name} selected. {reason}',
  'list.empty.title': 'No countries on the map yet',
  'list.empty.body':
    'A country lands here the moment a visit is recorded against it, with the first arrival, the latest one and how many times you have been.',
  'list.loading': 'Loading visited countries',
  'list.error.title': 'Your countries did not load',
  'list.error.body':
    'The atlas could not read your visited countries just now. Nothing has been lost — they are still recorded.',
  'list.error.retry': 'Try again',
  'list.error.retrying': 'Loading your countries',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Find a country',
  'search.loading': 'Loading your countries',
  'search.placeholder': 'Country name or code',
  'search.entry.notVisited': 'Not visited yet',
  'search.entry.noOutline': 'no map outline',
  'search.entry.separator': ' · ',
  'search.cleared': 'Selection cleared.',
  'search.unframed':
    '{name} has no outline at world scale, so the map has nothing to frame.',
  'search.unframedVisited':
    '{name} has no outline at world scale, so the map has nothing to frame. Its record is unaffected.',
  'search.results.empty':
    'No countries on your record yet. Type to search every country in the world.',
  'search.results.emptyPinned':
    '{name} is selected. No countries on your record yet — type to search every country in the world.',
  'search.results.record': {
    one: '{countries} country on your record.',
    other: '{countries} countries on your record.',
  },
  'search.results.capped': 'Showing the first {shown}.',
  'search.results.pinned': '{name} is selected and listed first.',
  'search.results.none': 'No country matches {term}.',
  'search.results.matches': {
    one: '{countries} country matches {term}.',
    other: '{countries} countries match {term}.',
  },
  'search.announce.selected': '{name} selected.',
  'search.announce.framing': '{name} selected. The map is framing it.',
  'search.announce.unframed': '{name} selected. {reason}',
  'search.empty.title': 'Nothing on your record yet',
  'search.empty.body':
    'Type a country name, or its two-letter code, to find it on the map.',
  'search.empty.noMatchTitle': 'No country matches “{term}”',
  'search.empty.noMatchBody':
    'Check the spelling, or try the two-letter code — PT finds Portugal. All {countries} countries are searchable, whether or not you have been.',

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Your record',
  'actions.visit.absent.title': 'Not visited',
  'actions.visit.absent.caption': 'A visit with no trip behind it.',
  'actions.visit.title': 'Visited',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Not on the list',
  'actions.goal.absent.caption': 'Somewhere you mean to go.',
  'actions.goal.title': 'On the bucket list',
  'actions.goal.waiting': 'Waiting for its turn.',
  'actions.goal.target': 'Aiming for {year}.',
  'actions.goal.achieved.title': 'Ticked off the list',
  'actions.goal.achieved.caption':
    'You got there. The entry stays as the record.',

  /**
   * Printed on a control. The accessible name beneath each one opens with these
   * same words, so voice control can say what it sees (WCAG 2.5.3).
   */
  'actions.button.remove': 'Remove',
  'actions.button.mark': 'Mark visited',
  'actions.button.add': 'Add to list',
  'actions.visit.remove.name': 'Remove {name} from your atlas',
  'actions.visit.remove.busy': 'Removing {name} from your atlas',
  'actions.visit.add.name': 'Mark visited, {name}',
  'actions.visit.add.busy': 'Marking {name} as visited',
  'actions.goal.remove.name': 'Remove {name} from your bucket list',
  'actions.goal.remove.busy': 'Removing {name} from your bucket list',
  'actions.goal.add.name': 'Add to list, {name}',
  'actions.goal.add.busy': 'Adding {name} to your bucket list',

  'actions.hint':
    'Both take effect straight away, and both can be undone here.',
  'actions.offline':
    'Your device could not reach the server. Check the connection and try again.',
  'actions.toast.marked': 'Marked as visited',
  'actions.toast.markedBody': '{name} is on your atlas.',
  'actions.toast.markFailed': '{name} was not marked',
  'actions.toast.unmarked': 'Removed from your atlas',
  'actions.toast.unmarkedBody': '{name} is no longer marked as visited.',
  'actions.toast.unmarkFailed': '{name} was not removed',
  'actions.toast.listed': 'Added to your bucket list',
  'actions.toast.listedBody': '{name} is somewhere you mean to go.',
  'actions.toast.listFailed': '{name} was not added',
  'actions.toast.unlisted': 'Removed from your bucket list',
  'actions.toast.unlistedBody': '{name} is no longer on the list.',
  'actions.toast.unlistFailed': '{name} was not removed',
  'actions.toast.fallback':
    'The change did not reach the server. Try again in a moment.',

  'actions.confirm.visit.title': 'Remove {name} from your atlas?',
  /**
   * The two optional clauses are their own keys rather than English fragments
   * spliced into a translated sentence, so a translator controls the bracket
   * and the comma as well as the words.
   */
  'actions.confirm.visit.body': {
    one: '{visits} recorded visit{dates} would be cleared{note}. Your trips and saved places are not touched.',
    other:
      '{visits} recorded visits{dates} would be cleared{note}. Your trips and saved places are not touched.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ', and the note you wrote with it',
  'actions.confirm.goal.title': 'Remove {name} from your bucket list?',
  'actions.confirm.goal.body':
    'It is already ticked off, so this also removes the record that you got there. Your atlas and your trips are not touched.',

  /* ------------------------------------------------- the card over the map */
  /**
   * The unit over the leading numeral, agreeing with it.
   *
   * The trips are the workspace's, not the reader's — see `panel.stat.trips`,
   * the figure this one is allowed to disagree with. The qualifier belongs in
   * every plural branch a locale needs, because the branch a reader sees is the
   * one their count selects.
   */
  'card.trips': { one: 'Workspace trip', other: 'Workspace trips' },
  'card.visits': { one: 'Visit', other: 'Visits' },
  /** The workspace's places, not the reader's — see `panel.stat.places`. */
  'card.places': { one: 'Workspace place', other: 'Workspace places' },
  'card.firstTrip': 'First trip',
  'card.lastTrip': 'Last trip',
  'card.firstVisit': 'First visit',
  'card.lastVisit': 'Last visit',
  /** What a reader hears where the card prints an em dash. */
  'card.absent': 'Not recorded',
  'card.loading': 'Loading this country',
  'card.loadingNamed': 'Loading {name}',
  'card.error.body': 'These figures did not load. Nothing has been lost.',
  'card.error.retry': 'Try again',
  'overlay.close': 'Close {name}',
  'regions.label': 'Regions',
  'regions.hint': 'Adding a region marks {country} as visited too.',
  'regions.keeps':
    'Removing a region does not remove {country} from your atlas.',
  'regions.keeps.unvisited':
    'These regions stay on your record. Mark {country} as visited, or add a region, to put it back on your map.',
  'regions.empty.title': 'No regions recorded here yet',
  'regions.empty.body':
    'Add a state, province or area you have visited in {country}.',
  'regions.input.label': 'Add a region in {country}',
  'regions.input.placeholder': 'For example, Bavaria',
  'regions.add': 'Add region',
  'regions.adding': 'Adding {region}',
  'regions.remove': 'Remove {region}',
  'regions.loading': 'Loading your regions',
  'regions.status.added': 'Added {region}',
  'regions.status.exists': '{region} is already on your record',
  'regions.status.removed': 'Removed {region}',
  'regions.status.addedCountry':
    'Added {region}. {country} is now marked as visited.',
  'regions.error.invalid': 'Enter a region name.',
  'regions.error.hidden':
    'That name contains characters we cannot keep. Remove them and try again.',
  'regions.error.load': 'We could not load your regions for {country}.',
  'regions.error.add': 'We could not add {region}. Try again.',
  'regions.error.remove': 'We could not remove {region}. Try again.',
  'regions.error.full':
    'You have recorded {limit} regions. Remove one to add another.',
  'regions.reload': 'Reload regions',
  'actions.confirm.visitRegions.body': {
    one: '{history}{count} region you recorded in {country} stays on your record.',
    other:
      '{history}{count} regions you recorded in {country} stay on your record.',
  },
  'regions.error.uncertain':
    'We could not confirm the change. Reload your regions to check what was saved.',
  'regions.status.refreshFailed':
    '{result} The atlas could not refresh. Reload it to update the map.',

  'panel.stat.periodLabel': 'Show figures for',
  'panel.stat.allTime': 'All time',
  'panel.stat.groupAll': 'Figures for all time',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Figures for {year}',
  'panel.stat.announceAll': 'Showing figures for all time.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Showing figures for {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Trips that start in {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'On trips that start in {year}',
  'panel.stat.countries': 'Countries on your trips',
  'panel.stat.countriesCaption': 'Distinct countries across these trips',
  'panel.stat.streak': 'Your year streak',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange': 'Trips every year, {first} to {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'A trip in {last}',
  'panel.stat.streakNone': 'Add a trip with dates to start a streak',
} as const satisfies NamespaceMessages

export default messages
