import * as React from 'react'
import { MapPinOff, SearchX } from 'lucide-react'

import { Combobox, Field, GlassPanel, Spinner } from '#/components/ui'
import { VISITED_COUNTRY_ZOOM, useMapContext } from '#/components/map'
import {
  boundsToTuple,
  cameraMotion,
  clampPadding,
  countryBounds,
  resolvePadding,
} from '#/lib/map'
import {
  countrySearchEntries,
  searchCountries,
} from '#/lib/atlas/country-search'
import { cn } from '#/lib/cn'
import {
  countryFlag,
  formatNumber,
  humaniseToken,
} from '#/routes/_app/-lib/format'

import type { ComboboxOption } from '#/components/ui'
import type { MapLibreMap } from '#/components/map'
import type { EdgePadding, MapBounds } from '#/lib/map'
import type {
  CountrySearchEntry,
  CountrySearchVisit,
} from '#/lib/atlas/country-search'

/**
 * Reaching a country by typing at it, and taking the camera there.
 *
 * The map is the atlas's headline and a poor pointing device: at world zoom
 * Luxembourg is four pixels wide, 75 of the codes the record can hold have no
 * outline to click at all, and a WebGL canvas offers a keyboard user nothing to
 * reach. This is the field that answers all three, so it is a real combobox
 * rather than an input with a list of divs under it:
 *
 * - **The primitive does the semantics.** `Combobox` is a `listbox` addressed by
 *   `aria-activedescendant`, so focus stays in the search box while ArrowUp,
 *   ArrowDown, Home, End and Enter move and commit the highlight, Escape closes
 *   and hands focus back to the field, and the panel is a Radix popover that
 *   closes on Escape, on an outside press or on a choice — never on the pointer
 *   merely leaving it, which would eject a reader mid-list.
 * - **Ranking is somebody else's tested job.** `#/lib/atlas/country-search` folds
 *   diacritics, tiers the matches and puts the traveller's own countries first
 *   inside each tier. Nothing about relevance is decided in this file.
 * - **The list and the count always agree.** Opening the field lists the record
 *   in full — a ten-row cap belongs to a typed query, and applying it to the
 *   record would hide the eleventh country the reader has been to while the live
 *   region cheerfully announced all twelve. Any row the record's own count does
 *   not cover, which is only ever a pinned selection, is named out loud.
 * - **A country with no geometry is still a first-class result.** It lists, it
 *   selects, and then the field says in words that the map has nothing to frame,
 *   rather than accepting the choice and doing nothing visible.
 * - **Selection and camera are two separate promises.** `onSelect` tells the
 *   screen which country the reader means; the camera move is this component's
 *   own, taken through {@link cameraMotion} so a reader who has asked for
 *   reduced motion is given the destination in one frame instead of a flight.
 * - **The frame lands where the atlas can still speak.** The camera is capped at
 *   `VISITED_COUNTRY_ZOOM.interactiveMax`, the last zoom at which the country
 *   fills are drawn and still answer a pointer. Framing Luxembourg at street
 *   zoom would erase the very fill that answered the search and leave the map
 *   unable to hit-test the selection the reader had just made — after which the
 *   next click on the map reports no feature at all, which is precisely why the
 *   layer stays silent up there rather than reporting empty water.
 */

/* -------------------------------------------------------------------- camera */

/**
 * How long the camera takes to reach a search result.
 *
 * `docs/DESIGN.md` puts motion between 150 and 260ms, and a search result is UI
 * motion: it is the answer to a keystroke, and the reader still has their hands
 * on the keyboard. That is a different act from `MAP_FIT_DURATION`'s deliberate
 * 620ms tour of a whole trip, which is why this move is assembled here from the
 * bounds helpers rather than borrowing `fitMapToBounds` — the geometry is the
 * same, the tempo is not.
 */
export const COUNTRY_FRAME_DURATION = 220

/**
 * The quintic ease-out that `--ease-out-quint` approximates in CSS.
 *
 * MapLibre eases in JavaScript, so the token itself cannot be handed to it, and
 * naming the curve the token was cut from is the closest the two can be kept.
 * `1 - (1-t)^5` sits within a pixel of `cubic-bezier(.23, 1, .32, 1)` over any
 * distance a camera moves, and it is exact at both ends, which a numerically
 * solved bezier is not.
 */
function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5
}

/**
 * Eases the camera onto one country's rectangle.
 *
 * Returns `false` when there is nothing to move — no map yet, or a container
 * with no area, which happens for a frame or two while a panel beside it is
 * being laid out. Padding is resolved and clamped against the *container*, so
 * the panels a screen floats over the map are kept clear and a 360px phone is
 * still left somewhere to draw.
 */
function frameCountry(
  map: MapLibreMap,
  bounds: MapBounds,
  padding: Partial<EdgePadding> | undefined,
): boolean {
  const container = map.getContainer()
  const width = container.clientWidth
  const height = container.clientHeight
  if (width < 1 || height < 1) return false

  const motion = cameraMotion({ duration: COUNTRY_FRAME_DURATION })
  const [[west, south], [east, north]] = boundsToTuple(bounds)

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: clampPadding(resolvePadding(padding), { width, height }),
      // The country fills stop being drawn above this zoom, so a frame past it
      // would answer the search with a basemap and no answer on it.
      maxZoom: VISITED_COUNTRY_ZOOM.interactiveMax,
      animate: motion.animate,
      duration: motion.duration,
      easing: easeOutQuint,
    },
  )
  return true
}

/* ---------------------------------------------------------------------- copy */

const FIELD_LABEL = 'Find a country'

/** What the field says while the record is still being read. */
const LOADING_LABEL = 'Loading your countries'

/**
 * The sentence a country with no bundled outline gets, in the field and out loud.
 *
 * Said as a fact about the geometry rather than as an error, because nothing has
 * gone wrong: the 1:110m cut the atlas draws with holds no polygon this small,
 * the record is intact, and the only thing the reader loses is the camera move.
 */
function noFrameSentence(name: string, visited: boolean): string {
  return visited
    ? `${name} has no outline at world scale, so the map has nothing to frame. Its record is unaffected.`
    : `${name} has no outline at world scale, so the map has nothing to frame.`
}

/** Plural agreement, pulled out so the sentences below stay readable. */
function countryWord(count: number): string {
  return count === 1 ? 'country' : 'countries'
}

/** What the list holds right now, as the live region needs to describe it. */
interface ListState {
  /** The folded query the answer came from. `''` when nothing was typed. */
  readonly folded: string
  /** The query as the reader typed it, for quoting back at them. */
  readonly typed: string
  /** Rows that came from the answer. The pinned selection is not one of them. */
  readonly shown: number
  /** How many countries answered, before any cap. */
  readonly total: number
  /** The selected country pinned above a blank list, when the record lacks it. */
  readonly pinned: string | null
}

/**
 * The sentence the live region carries for whatever the list now holds.
 *
 * Every clause is checked against the rows on screen, because a count that
 * disagrees with the list is worse than no count at all: it tells a reader who
 * cannot see the list that countries are there when they are not. So a shortfall
 * is stated in both branches — the record is uncapped by
 * `#/lib/atlas/country-search`, but a caller is free to cap it and this sentence
 * must not become a lie if one ever does — and a selection pinned above the
 * record is named, because it is a row the record's own count does not include.
 */
function resultSentence(list: ListState): string {
  const { folded, typed, shown, total, pinned } = list
  const selection =
    pinned === null ? '' : ` ${pinned} is selected and listed first.`

  if (folded === '') {
    if (total === 0) {
      return pinned === null
        ? 'No countries on your record yet. Type to search every country in the world.'
        : `${pinned} is selected. No countries on your record yet — type to search every country in the world.`
    }
    const counted = `${formatNumber(total)} ${countryWord(total)} on your record.`
    const capped =
      shown < total ? ` Showing the first ${formatNumber(shown)}.` : ''
    return `${counted}${capped}${selection}`
  }

  const term = `“${typed.trim()}”`
  if (total === 0) return `No country matches ${term}.`
  if (shown < total) {
    return `${formatNumber(total)} ${countryWord(total)} match ${term}. Showing the first ${formatNumber(shown)}.`
  }
  return `${formatNumber(total)} ${countryWord(total)} ${total === 1 ? 'matches' : 'match'} ${term}.`
}

/**
 * The second line of a row.
 *
 * Deliberately not a date. The two runtimes this renders in abbreviate months
 * differently, and a text node that differs between the server pass and the
 * client pass is a hydration error; the tally and the continent identify a
 * country without going near a calendar, and the record the selection opens
 * prints both ends of the visit span properly.
 */
function describeEntry(entry: CountrySearchEntry): string {
  const parts: Array<string> = []
  if (entry.visit === null) {
    parts.push('Not visited yet')
  } else {
    parts.push(
      entry.visit.continent === null
        ? 'Continent not recorded'
        : humaniseToken(entry.visit.continent),
      `${formatNumber(entry.visit.visitCount)} ${entry.visit.visitCount === 1 ? 'visit' : 'visits'}`,
    )
  }
  if (countryBounds(entry.code) === null) parts.push('no map outline')
  return parts.join(' · ')
}

/* -------------------------------------------------------------------- layout */

const layout = {
  /**
   * A 6px halo, not a frame.
   *
   * The glass exists to lift an opaque control off whatever terrain is under it
   * and to give the hint below it a ground; any more padding than the field's own
   * radius and it starts reading as a second surface around a smaller field
   * instead of as one floating control. 12 + 6 lands on `--radius-lg`'s 16.
   */
  panel: 'flex w-full min-w-0 flex-col p-1.5',
  control: 'relative flex w-full min-w-0 items-center',
  hint: 'flex min-w-0 items-start gap-1.5 rounded-md bg-info-soft px-2 py-1 text-info',
  /** Clear of the trailing chevron, which owns the last 28px of the field. */
  spinner: 'pointer-events-none absolute top-1/2 right-9 -translate-y-1/2',
  empty: 'flex flex-col items-center gap-1.5',
  emptyTitle: 'block text-label font-semibold text-ink',
  emptyBody: 'block max-w-64 text-balance text-caption text-ink-3',
  /**
   * The one state the primitive's rows cannot express on their own.
   *
   * A row already paints rest, highlighted and selected from tokens — and
   * highlighted is deliberately one paint for pointer hover and keyboard focus,
   * because `aria-activedescendant` makes them one thing: there is no second
   * place for focus to be. What the row has no rule for is being *pressed*, so
   * the press is added here from the same `--color-active` wash every other row
   * in the product uses. A descendant selector on the popover rather than an
   * inline style, so it stays one themed stylesheet rule.
   */
  options: '[&_[role=option]:active]:bg-active',
} as const

/* ---------------------------------------------------------------- component */

export interface CountrySearchProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'onSelect'
> {
  /** The traveller's record. Every other country is searchable regardless. */
  readonly countries: ReadonlyArray<CountrySearchVisit>
  /**
   * The country the rest of the screen is about. Omit it to let the field own
   * the selection; pass `null` to control it and select nothing.
   */
  readonly selectedCode?: string | null
  /** Fired on a choice, and with `null` when the field is cleared. */
  readonly onSelect?: (countryCode: string | null) => void
  /** Insets the camera must keep clear — the panels floating over the map. */
  readonly padding?: Partial<EdgePadding>
  /** Accessible name for the field, and what it says before a choice is made. */
  readonly label?: string
  /** The record has not arrived yet, so the field waits rather than lying. */
  readonly loading?: boolean
  readonly disabled?: boolean
}

/**
 * The atlas's country search, as a glass pill that floats over the map.
 *
 * Reads the map off context, so it can be dropped anywhere inside a `MapCanvas`
 * and needs nothing passed to it; outside one it still searches, still selects,
 * and simply has no camera to move.
 */
export const CountrySearch = React.forwardRef<
  HTMLDivElement,
  CountrySearchProps
>(
  (
    {
      countries: record,
      selectedCode,
      onSelect,
      padding,
      label = FIELD_LABEL,
      loading = false,
      disabled = false,
      className,
      ...props
    },
    ref,
  ) => {
    const { map } = useMapContext()
    const [query, setQuery] = React.useState('')

    /**
     * What the field last had to say, and a counter that changes even when the
     * sentence does not.
     *
     * Choosing the same country twice is a supported gesture — it re-frames the
     * map — and a live region only speaks when its text changes, so the same
     * sentence written back into the same node is silent. The counter's parity
     * decides which of two regions carries it, so a repeat lands in an empty one
     * and is read out.
     */
    const [status, setStatus] = React.useState('')
    const [announcements, setAnnouncements] = React.useState(0)

    /** The country this field last chose that the map could not frame. */
    const [unframed, setUnframed] = React.useState<string | null>(null)
    const [chosen, setChosen] = React.useState<string | null>(null)

    const entries = React.useMemo(() => countrySearchEntries(record), [record])
    const byCode = React.useMemo(() => {
      const table = new Map<string, CountrySearchEntry>()
      for (const entry of entries) table.set(entry.code, entry)
      return table
    }, [entries])

    const controlled = selectedCode !== undefined
    const selected = controlled ? (selectedCode ?? null) : chosen
    const selectedKey = selected === null ? null : selected.trim().toUpperCase()
    const selectedEntry =
      selectedKey === null ? null : (byCode.get(selectedKey) ?? null)

    const outcome = React.useMemo(
      () => (loading ? null : searchCountries(entries, query)),
      [entries, loading, query],
    )

    /**
     * The selection pinned above a blank list.
     *
     * A combobox whose own value is missing from its list has lost the reader's
     * place, so a selection the blank answer does not already contain is added
     * at the top. Since the blank answer is the record in full, that can only
     * ever be a country the reader has not been to — chosen on the map, or from
     * a search they have since cleared — and the live region names it rather
     * than letting the record's count stand for a row the record does not hold.
     */
    const pinned = React.useMemo(() => {
      if (outcome === null || outcome.query !== '' || selectedEntry === null) {
        return null
      }
      const listed = outcome.matches.some(
        (match) => match.entry.code === selectedEntry.code,
      )
      return listed ? null : selectedEntry
    }, [outcome, selectedEntry])

    /* The rows the popover shows: with nothing typed, the whole record — capping
       it would hide countries the reader has actually been to — and while a query
       is live the matches and nothing else, so an empty result set is able to say
       so. */
    const options = React.useMemo<Array<ComboboxOption>>(() => {
      if (outcome === null) return []
      const rows = outcome.matches.map((match) => match.entry)
      if (pinned !== null) rows.unshift(pinned)
      return rows.map((entry) => ({
        value: entry.code,
        label: entry.name,
        description: describeEntry(entry),
        icon: (
          <span aria-hidden="true" className="leading-none">
            {countryFlag(entry.code)}
          </span>
        ),
      }))
    }, [outcome, pinned])

    /**
     * Announce what the list now holds.
     *
     * Held shut until the reader actually types: nobody asked a question on page
     * load, and after a choice the sentence in the region is "Japan selected",
     * which a recount of the record has no business overwriting before a screen
     * reader has reached the end of it. The next keystroke opens it again.
     */
    const holdStatus = React.useRef(true)
    React.useEffect(() => {
      if (outcome === null || holdStatus.current) return
      setStatus(
        resultSentence({
          folded: outcome.query,
          typed: query,
          shown: outcome.matches.length,
          total: outcome.total,
          pinned: pinned?.name ?? null,
        }),
      )
    }, [outcome, pinned, query])

    const announce = (sentence: string): void => {
      holdStatus.current = true
      setStatus(sentence)
      setAnnouncements((count) => count + 1)
    }

    const choose = (code: string | null): void => {
      if (!controlled) setChosen(code)
      onSelect?.(code)

      if (code === null) {
        setUnframed(null)
        announce('Selection cleared.')
        return
      }

      const entry = byCode.get(code)
      const name = entry?.name ?? code
      const bounds = countryBounds(code)
      if (bounds === null) {
        setUnframed(code)
        announce(
          `${name} selected. ${noFrameSentence(name, entry?.visited ?? false)}`,
        )
        return
      }

      setUnframed(null)
      const moved = map !== null && frameCountry(map, bounds, padding)
      announce(
        moved
          ? `${name} selected. The map is framing it.`
          : `${name} selected.`,
      )
    }

    /* The notice lives only as long as the selection it is about, so a country
       chosen afterwards on the map or in the list never leaves a stale sentence
       hanging off the field. */
    const stranded =
      unframed !== null && unframed === selectedKey
        ? (byCode.get(unframed) ?? null)
        : null

    return (
      <GlassPanel
        ref={ref}
        radius="lg"
        padding="none"
        aria-busy={loading || undefined}
        className={cn(layout.panel, className)}
        {...props}
      >
        <Field
          hint={
            stranded === null ? undefined : (
              <span className={layout.hint}>
                <MapPinOff
                  size={12}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  {noFrameSentence(stranded.name, stranded.visited)}
                </span>
              </span>
            )
          }
        >
          <span className={layout.control}>
            <Combobox
              options={options}
              // The normalised code, not the raw prop: a host handing back a
              // padded or lower-case column would otherwise fail to match any
              // row and the chosen country would render unselected in its own
              // list.
              value={selectedKey}
              onChange={choose}
              manualFiltering
              clearable
              loading={loading}
              disabled={disabled || loading}
              ariaLabel={label}
              placeholder={
                loading ? LOADING_LABEL : (selectedEntry?.name ?? label)
              }
              searchPlaceholder="Country name or code"
              onSearchChange={(next) => {
                holdStatus.current = false
                setQuery(next)
              }}
              emptyMessage={<Nothing query={query} total={entries.length} />}
              contentClassName={layout.options}
            />
            {loading ? (
              <span className={layout.spinner}>
                <Spinner
                  size="md"
                  label={LOADING_LABEL}
                  className="text-ink-3"
                />
              </span>
            ) : null}
          </span>
        </Field>

        {/* Two regions, alternated, so re-choosing the country already selected
            is announced again instead of falling silent on an unchanged string. */}
        {[0, 1].map((slot) => (
          <p
            key={slot}
            role="status"
            aria-live="polite"
            data-part="announcement"
            className="sr-only"
          >
            {announcements % 2 === slot ? status : ''}
          </p>
        ))}
      </GlassPanel>
    )
  },
)
CountrySearch.displayName = 'CountrySearch'

/**
 * The designed nothing.
 *
 * Phrasing content only: the primitive renders this inside a paragraph, and a
 * block element in a `<p>` is the browser's parse to repair rather than ours to
 * reason about. Two shapes, because two different nothings are possible — an
 * empty record with nothing typed yet, and a query nothing answers.
 */
function Nothing({
  query,
  total,
}: {
  readonly query: string
  readonly total: number
}) {
  const term = query.trim()
  return (
    <span className={layout.empty}>
      <SearchX size={18} className="text-ink-3" aria-hidden="true" />
      <span className={layout.emptyTitle}>
        {term === ''
          ? 'Nothing on your record yet'
          : `No country matches “${term}”`}
      </span>
      <span className={layout.emptyBody}>
        {term === ''
          ? 'Type a country name, or its two-letter code, to find it on the map.'
          : `Check the spelling, or try the two-letter code — PT finds Portugal. All ${formatNumber(total)} countries are searchable, whether or not you have been.`}
      </span>
    </span>
  )
}
