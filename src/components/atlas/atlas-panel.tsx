import * as React from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  Flag,
  Globe,
  Landmark,
  MapPin,
  MapPinned,
  PlaneTakeoff,
  Sparkles,
  Sun,
  Telescope,
} from 'lucide-react'

import {
  Badge,
  Button,
  EmptyState,
  cardVariants,
  GlassPanel,
  IconButton,
  Progress,
  ScrollArea,
  SectionLabel,
  Skeleton,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { countryName } from '#/lib/atlas/country-names'
import {
  countryFlag,
  formatDistance,
  formatNumber,
  formatPercent,
  humaniseToken,
  pluralise,
} from '#/lib/format'
import { AtlasLegend, AtlasLegendSkeleton } from './atlas-legend'
import { CountriesList, CountriesListSkeleton } from './countries-list'
import { CountryActions } from './country-actions'
import { CountryRecord, CountryRecordSkeleton } from './country-record'

import type { CountriesListCountry } from './countries-list'
import type { CountryActionsGoal, CountryActionsVisit } from './country-actions'

/**
 * The atlas's floating panel: everything the map cannot say, over the map.
 *
 * The screen is a map. That leaves one composition question — where do the
 * counters, the continent roll-up, the country record, the list and the bucket
 * list go — and two bad answers. Putting them in a scrolling column under the
 * map demotes the map to a thumbnail. Dropping them keeps the map and loses the
 * feature. So they float, in one glass panel across the foot of the map, and the
 * decisions inside it are these.
 *
 * **Three sections, not one strip.** The bar we are measured against crams a
 * hero count, four counters, six continents and three more figures into a single
 * row, and pays for it by rendering every label at 9px and about 2.4:1 against
 * its own panel — a hierarchy with exactly two levels, "white" and "invisible".
 * Ours splits them across three tabs, which buys each figure a `StatCard` with a
 * real label, a real numeral and a real caption, and buys the country record and
 * the list room to be readable rather than a hover tooltip.
 *
 * **The headline never moves.** The hero count and the share of the world sit in
 * the panel's own header, outside the tabs, because they are the answer to "how
 * am I doing" and a reader should not have to pick a tab to see it. It is also
 * what the panel shows on a phone before it is opened.
 *
 * **Selection opens the record.** Choosing a country anywhere — the map, the
 * search, a list row — switches to the record tab and, on a phone, opens the
 * panel. The record is a persistent surface a touch or keyboard reader reaches
 * exactly as a mouse reader does; hover on the map only adds emphasis to
 * something already reachable without a pointer.
 *
 * **A phone gets a drawer, not a squeezed desktop.** Below `lg` the panel is
 * collapsed to its header, so the map keeps the screen; the tab strip is still
 * there, and touching a tab opens it. From `lg` up it opens by default, because
 * there is room. The toggle is offered at both, because collapsing the shelf is
 * also how a desktop reader gets the southern hemisphere back from under it.
 *
 * **The toggle reports the state the panel is actually in.** Which shelf is open
 * by default is a question about the *width*, and the panel refuses to answer it
 * during render — that is the classic hydration mismatch, and the body's own
 * `hidden lg:flex` lets the stylesheet answer it instead, in both passes and
 * with no JavaScript at all. But `aria-expanded` and the chevron are not
 * stylesheet-addressable, and left at the desktop default they told a phone
 * reader the drawer was open while it was `display: none` — and then swallowed
 * the first press, because "close what is already closed" is a no-op. So the
 * breakpoint is read through `useSyncExternalStore`, which is the one hook that
 * may legitimately return a different answer on the server: React hydrates with
 * the server snapshot and reconciles afterwards, with no mismatch and nothing
 * on screen to move.
 *
 * **A zero is a figure, not a blank.** Oceania is 0 in our own record, and three
 * continents are 0 for most travellers. Every continent cell is rendered at the
 * same size and the same opacity whatever its count; the only difference between
 * 0 and 7 is one step of ink. That is the single most visible defect in the bar
 * we are measured against, whose zeros land at about 1.5:1.
 */

/* --------------------------------------------------------------------- tabs */

const TAB_VALUES = ['country', 'stats', 'bucket'] as const

/** Which section of the panel is open. */
export type AtlasPanelTab = (typeof TAB_VALUES)[number]

/** Narrows an arbitrary string from the tab primitive back to our union. */
function asTab(value: string): AtlasPanelTab | null {
  return TAB_VALUES.find((candidate) => candidate === value) ?? null
}

/* ----------------------------------------------------------------- viewport */

/**
 * Tailwind's `lg`, as a query — the same 1024px the body's `hidden lg:flex`
 * turns on, written once so the markup and the announcement cannot disagree.
 */
const SHELF_OPEN_QUERY = '(min-width: 1024px)'

/** True where `window.matchMedia` exists to be asked. */
function canMatchMedia(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  )
}

function subscribeToShelfWidth(onChange: () => void): () => void {
  if (!canMatchMedia()) return () => {}
  const query = window.matchMedia(SHELF_OPEN_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function readShelfWidth(): boolean {
  return canMatchMedia() && window.matchMedia(SHELF_OPEN_QUERY).matches
}

/**
 * The server has no viewport, and guessing one is what produces a mismatch. It
 * reports the stylesheet's own mobile-first default instead — shut — which is
 * exactly what the body renders to before any `lg` rule applies.
 */
function shelfWidthOnServer(): boolean {
  return false
}

/**
 * Whether this viewport is one where the shelf opens by default.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: React uses the
 * server snapshot for the hydrating render and re-reads afterwards, so a desktop
 * gets the right answer without either pass rendering markup the other did not.
 * Nothing laid out depends on it — only `aria-expanded`, the toggle's accessible
 * name and which way the chevron points, and the chevron takes the breakpoint
 * from CSS so that not even it moves after hydration.
 */
function useShelfOpensByDefault(): boolean {
  return React.useSyncExternalStore(
    subscribeToShelfWidth,
    readShelfWidth,
    shelfWidthOnServer,
  )
}

/* --------------------------------------------------------------- continents */

/**
 * The continents a reader expects to see, whether or not they have been.
 *
 * The summary query groups by the column, so it can only ever return continents
 * the traveller has visited — and a roll-up that silently omits Oceania answers
 * a different question from the one it appears to answer. The canonical six are
 * listed here and matched case-insensitively; anything else the column holds is
 * appended rather than dropped, because the column is free text and a row that
 * says "Antarctica" is data, not a bug.
 */
const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const

/** One continent's tally, exactly as the atlas summary returns it. */
export interface AtlasPanelContinent {
  readonly continent: string
  readonly countryCount: number
}

interface ContinentCell {
  readonly key: string
  readonly label: string
  readonly countryCount: number
}

function continentCells(
  rows: ReadonlyArray<AtlasPanelContinent>,
): ReadonlyArray<ContinentCell> {
  /** Folded case-insensitively, because the column is free text. */
  const counts = new Map<string, { label: string; total: number }>()
  for (const row of rows) {
    const name = row.continent.trim()
    if (name === '') continue
    const key = name.toLowerCase()
    const seen = counts.get(key)
    counts.set(key, {
      label: seen?.label ?? humaniseToken(name),
      total: (seen?.total ?? 0) + row.countryCount,
    })
  }

  const canonical = CONTINENTS.map((label) => {
    const key = label.toLowerCase()
    const seen = counts.get(key)
    counts.delete(key)
    return { key, label, countryCount: seen?.total ?? 0 }
  })

  // Anything the column holds that is not one of the six is data, not a bug.
  const extra = [...counts.entries()].map(([key, seen]) => ({
    key,
    label: seen.label,
    countryCount: seen.total,
  }))

  return [...canonical, ...extra]
}

/* -------------------------------------------------------------------- stats */

/** The counters the panel prints, already reduced to numbers. */
export interface AtlasPanelStats {
  readonly countryCount: number
  /** The world total the share is measured against. */
  readonly worldCount: number
  readonly regionCount: number
  readonly visitCount: number
  /** All-time roll-up figures. `null` where no roll-up row exists yet. */
  readonly tripCount: number | null
  /** Saved stops across every trip — sights, stays, restaurants. */
  readonly placeCount: number | null
  readonly cityCount: number | null
  readonly dayCount: number | null
  readonly distanceMetres: number | null
}

/** One bucket-list row, as the atlas loader returns it. */
export interface AtlasPanelBucketItem {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly countryCode: string | null
  readonly targetYear: number | null
  readonly isAchieved: boolean
}

/* ------------------------------------------------------------------- layout */

/**
 * Held as class strings rather than typed twice, so `AtlasPanelSkeleton` is cut
 * from the same geometry as the panel it stands in for. A copied class list
 * drifts on the first edit, and a drifted skeleton moves the page under the
 * reader at the exact moment the content lands.
 */
const layout = {
  /**
   * `z-map-overlay`, and `floating={false}` on the primitive to get it.
   *
   * `GlassPanel`'s floating default is `z-dropdown` (50), which is *above*
   * `--z-nav` (40) — right for a popover, wrong for map chrome, which has to
   * pass under the app's top bar on a full-bleed page. Standing the variant down
   * and naming the tier explicitly is the honest way round; overriding it by
   * class also works now that `map-overlay` is registered in `cn()`'s `z` group,
   * and that is what the search pill above the map has to do, because it does
   * not expose the variant.
   */
  root: 'flex min-w-0 flex-col overflow-hidden z-map-overlay',
  /**
   * A two-column grid on a phone, a row from `lg`.
   *
   * The four parts are siblings rather than two nested rows because of what
   * happens at 360: the collapse toggle used to sit beside the tab strip, which
   * left the strip 272px for three labelled tabs that want 330, and
   * "Bucket list" overflowed its own trigger to within a pixel of the toggle.
   * Placed on the grid, the toggle takes the space the short headline was
   * wasting on the right and the tab strip gets the full width of the panel.
   * Both are the same row from `lg`, where there was never a shortage.
   *
   * The stated 100px from `lg` is the header holding still. The shelf is a fixed
   * box anchored to the foot of the map, so everything in it is measured down
   * from a header whose height was its own text: three lines whose sum landed a
   * fraction under 100px in the fallback face and a fraction over it in ours,
   * which rounded to a one-pixel step and moved the entire body — six stat
   * tiles, the record, the list — a quarter of a second after paint. The content
   * is fixed at this breakpoint (an 11px label, a 40px numeral, a 12px caption,
   * with the padding either side), so the box may as well be stated, and then no
   * font arriving can change it.
   */
  header:
    'grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5 sm:py-3.5 lg:flex lg:h-25 lg:gap-6',
  /**
   * A column of stated width from `lg`, not a shrink-to-fit block.
   *
   * The progress bar sits directly after it, so anything that changes the
   * headline's width moves the bar: the display face arriving is exactly that,
   * and it slid the whole row a few pixels a quarter of a second after paint.
   * 11rem holds the hero pair and its caption at every plausible count, and the
   * caption truncates rather than widening the column if a tenant ever manages
   * more.
   */
  headline: 'flex min-w-0 items-center gap-3 lg:w-44 lg:shrink-0',
  /** Fills the void between the headline and the tabs on a wide shelf, and says
      something the numerals do not: how far there is still to go. */
  progress: 'hidden min-w-0 flex-1 lg:block',
  /**
   * The collapse toggle: beside the headline on a phone, the far end from `lg`.
   *
   * It is written before the tab strip so the grid can put it on the first row
   * without either of them being positioned twice; `order-last` is what returns
   * it to the end of the header once the header is a flex row. Grid placement is
   * inert there, and `order` is inert in the grid.
   */
  toggle: 'col-start-2 row-start-1 shrink-0 justify-self-end lg:order-last',
  /** Tight leading and `tabular-nums`: the count changes, the layout must not. */
  hero: 'font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-[0.95] font-extrabold tracking-tighter tabular-nums text-ink',
  heroUnit: 'text-label font-medium tabular-nums text-ink-3',
  heroCaption: 'mt-0.5 truncate text-caption tabular-nums text-ink-2',
  /** Its own full-width row on a phone, and content-width from `lg`. */
  tabs: 'col-span-2 col-start-1 row-start-2 min-w-0 lg:w-auto lg:flex-none',
  /**
   * Two pixels off each trigger's padding below `sm`.
   *
   * Not off the type: `SectionLabel`'s 11px and the 12px caption floor are fixed
   * contracts, and shrinking a label to make a control fit is how the bar we are
   * measured against ends up with "OCEANIA" reading "OCEAN". Eight pixels a
   * trigger is what "Bucket list" needed at 360, and padding is the part of the
   * trigger that is not information.
   */
  tab: 'px-2 sm:px-3',
  /**
   * The shelf's opening height on a phone is its header alone; from `lg` the
   * screen gives it a definite 25rem, so the record and the list inside are real
   * scroll containers instead of growing the shelf off the bottom of the map.
   */
  body: 'flex min-w-0 flex-1 flex-col gap-3 overflow-hidden border-t border-glass-edge px-3 pt-3 pb-3 sm:px-5 sm:pt-3.5 sm:pb-3.5',
  content: 'mt-0 flex min-h-0 flex-1 flex-col focus-visible:outline-none',
  footer: 'shrink-0 border-t border-glass-edge pt-3',
  statGrid: 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6',
  /**
   * Every pixel the shelf takes is two pixels of world it hides, so the tiles are
   * asked to drop the desktop floor that a full-page grid of them wants. The
   * numeral, the label and the caption are all untouched.
   */
  statCard: 'min-h-0 gap-2 p-4 sm:min-h-0',
  continentRow:
    'grid grid-cols-3 gap-x-4 gap-y-2 rounded-lg bg-surface-2/70 p-3 sm:grid-cols-6',
  continentCell: 'flex min-w-0 flex-col',
  continentValue: 'font-display text-subtitle font-bold tabular-nums',
  /**
   * Record beside list from `lg`, stacked below it, and centred when the shelf is
   * wider than either needs — a 2560px screen must not stretch a list row into
   * two disconnected fragments a thousand pixels apart.
   *
   * `grid-rows-[minmax(0,1fr)]` is not decoration. A grid row sizes to its
   * content by default, so the record and the list grew straight through the
   * shelf's own key and out of the bottom of it; pinning the row to the track
   * and clipping the cells is what turns the two panes into real scroll
   * containers.
   */
  split:
    'grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3 overflow-hidden lg:grid-cols-[minmax(0,24rem)_minmax(0,52rem)] lg:justify-center',
  splitPane: 'flex min-h-0 min-w-0 flex-col overflow-hidden',
  bucketRow:
    'flex min-w-0 items-center gap-3 border-b border-edge-faint px-1 py-2.5 last:border-b-0',
  /**
   * A country on the map that is not on the record.
   *
   * Clicking one is a real question — "have I been here?" — and the honest answer
   * is a card that says no. Before this, choosing an unvisited country switched
   * to the record tab and showed "Pick a country", which reads as the app having
   * ignored the click.
   */
  unvisited: cardVariants({ variant: 'default', padding: 'md' }),
  unvisitedFlag:
    'grid size-11 shrink-0 place-items-center rounded-md border border-edge-faint bg-surface-2 text-title leading-none',
} as const

/* -------------------------------------------------------------------- panel */

export interface AtlasPanelProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'onSelect' | 'children'
> {
  readonly countries: ReadonlyArray<CountriesListCountry>
  /** The country the whole screen is about, or `null`. */
  readonly selectedCode: string | null
  /** Fired on every activation, so the map can re-frame the same country. */
  readonly onSelect: (countryCode: string) => void
  /**
   * Clears the selection. Only offered on a phone, where the record replaces the
   * list rather than sitting beside it and the reader needs a way back; omit it
   * and no button is drawn, because an action that cannot run is worse than none.
   */
  readonly onClearSelection?: () => void
  readonly tab: AtlasPanelTab
  readonly onTabChange: (tab: AtlasPanelTab) => void
  /**
   * Whether the shelf is open, or `null` for "whatever the width implies".
   *
   * Three states rather than two, and the third one is load-bearing. The shelf
   * should open by default on a desktop and stay shut on a phone, and *reading*
   * the breakpoint to decide that during render means the server and the client
   * disagree — the classic hydration mismatch. `null` defers the question to CSS
   * (`hidden lg:flex`), which both passes agree on because neither one has to
   * answer it. The moment the reader presses the toggle it becomes an explicit
   * boolean and the breakpoint stops having an opinion.
   */
  readonly expanded: boolean | null
  readonly onExpandedChange: (expanded: boolean) => void
  readonly stats: AtlasPanelStats
  readonly byContinent: ReadonlyArray<AtlasPanelContinent>
  /**
   * The rows to draw. May be the head of a longer list — see
   * {@link AtlasPanelProps.bucketTotal}.
   */
  readonly bucketList: ReadonlyArray<AtlasPanelBucketItem>
  /**
   * How many bucket-list rows exist. Defaults to what was handed over.
   *
   * The loader ships a bounded slice, because this list is neither virtualised
   * nor paginated and every row travels in the streamed document. Given the true
   * total the tab counts against it and says, in words, that it is showing the
   * top — a count that quietly disagrees with the reader's own list is worse
   * than a longer list.
   */
  readonly bucketTotal?: number
  /** How many of the whole list are ticked. Defaults to what was handed over. */
  readonly bucketAchieved?: number
}

export const AtlasPanel = React.forwardRef<HTMLDivElement, AtlasPanelProps>(
  (
    {
      countries,
      selectedCode,
      onSelect,
      onClearSelection,
      tab,
      onTabChange,
      expanded,
      onExpandedChange,
      stats,
      byContinent,
      bucketList,
      bucketTotal,
      bucketAchieved,
      className,
      ...props
    },
    ref,
  ) => {
    const bodyId = React.useId()
    const unvisitedId = React.useId()
    /**
     * What the toggle says, what a screen reader is told, and what one press of
     * it does. `null` follows the breakpoint — measured, not assumed, because
     * assuming the desktop default made the first press on a phone a no-op that
     * "closed" a drawer already closed.
     */
    const opensByDefault = useShelfOpensByDefault()
    const open = expanded ?? opensByDefault
    const share =
      stats.worldCount === 0 ? 0 : stats.countryCount / stats.worldCount
    /** Counted over the whole list when the caller knows it, not over the slice. */
    const total = bucketTotal ?? bucketList.length
    const achieved =
      bucketAchieved ?? bucketList.filter((row) => row.isAchieved).length
    const hidden = Math.max(total - bucketList.length, 0)
    const cells = React.useMemo(
      () => continentCells(byContinent),
      [byContinent],
    )

    const selectedKey =
      selectedCode === null ? null : selectedCode.trim().toUpperCase()
    const record =
      selectedKey === null
        ? null
        : (countries.find(
            (row) => row.countryCode.trim().toUpperCase() === selectedKey,
          ) ?? null)

    /** The action block's half of the record, in the shape it asks for. */
    const visitFacts: CountryActionsVisit | null =
      record === null
        ? null
        : {
            firstVisitedOn: record.firstVisitedOn,
            lastVisitedOn: record.lastVisitedOn,
            visitCount: record.visitCount,
            note: record.note,
          }

    /**
     * The selected country's entry on the bucket list, read off the rows the
     * panel was handed.
     *
     * Those rows can be the head of a longer list — see {@link
     * AtlasPanelProps.bucketTotal} — so a country sitting past the cut reads as
     * "not on the list" here. The write behind the button is idempotent against
     * exactly that: adding a country that already has an entry returns the
     * existing one rather than a second row, and the invalidation that follows
     * brings the true state back into the panel.
     */
    const bucketGoal: CountryActionsGoal | null = React.useMemo(() => {
      if (selectedKey === null) return null
      const row = bucketList.find(
        (entry) =>
          entry.kind === 'country' &&
          (entry.countryCode ?? '').trim().toUpperCase() === selectedKey,
      )
      return row === undefined
        ? null
        : {
            id: row.id,
            targetYear: row.targetYear,
            isAchieved: row.isAchieved,
          }
    }, [bucketList, selectedKey])

    return (
      <GlassPanel
        ref={ref}
        radius="2xl"
        padding="none"
        floating={false}
        className={cn(layout.root, className)}
        {...props}
      >
        <Tabs
          value={tab}
          onValueChange={(next) => {
            const resolved = asTab(next)
            if (resolved === null) return
            onTabChange(resolved)
            // Touching a tab is a request to read it, whatever the shelf was
            // doing. Cheap when it is already open.
            onExpandedChange(true)
          }}
          variant="segmented"
          size="sm"
          className="min-h-0 flex-1"
        >
          <div data-part="panel-header" className={layout.header}>
            <div className={layout.headline}>
              <div className="min-w-0">
                <SectionLabel as="h2">World coverage</SectionLabel>
                <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                  <span
                    data-part="coverage"
                    data-numeric=""
                    className={layout.hero}
                  >
                    {formatNumber(stats.countryCount)}
                  </span>
                  <span className={layout.heroUnit}>
                    of {formatNumber(stats.worldCount)}
                  </span>
                </p>
                <p data-part="coverage-caption" className={layout.heroCaption}>
                  {formatPercent(share)} of the world &middot;{' '}
                  {pluralise(stats.visitCount, 'visit')}
                </p>
              </div>
            </div>

            <div className={layout.progress}>
              <Progress
                value={stats.countryCount}
                max={Math.max(stats.worldCount, 1)}
                size="sm"
                tone="brand"
                label={
                  <span className="text-ink-2">Towards every country</span>
                }
                valueText={
                  // A stated width, right-aligned, because this end of the row
                  // is anchored to the right: let the box shrink to its text and
                  // the webfont arriving moves its left edge, which is a layout
                  // shift after paint for a string whose value never changed.
                  // 4rem holds "195 to go" in both faces with room over.
                  <span className="inline-block w-16 text-right tabular-nums text-ink-2">
                    {formatNumber(
                      Math.max(stats.worldCount - stats.countryCount, 0),
                    )}{' '}
                    to go
                  </span>
                }
              />
            </div>

            {/* Offered at every width, not only on a phone: collapsing the
                shelf is how a desktop reader gets the southern hemisphere back
                from under it. */}
            <IconButton
              variant="subtle"
              size="sm"
              label={open ? 'Hide atlas details' : 'Show atlas details'}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => onExpandedChange(!open)}
              icon={
                <ChevronDown
                  size={16}
                  className={cn(
                    'transition-transform duration-base ease-out-quint',
                    // The one place the breakpoint is taken from CSS rather than
                    // from the measurement above: this is the visible half of the
                    // state, and a glyph that spins 180° a frame after hydration
                    // is motion the reader did not ask for. Once the reader has
                    // an opinion the width stops having one.
                    expanded === null
                      ? 'rotate-180 lg:rotate-0'
                      : expanded
                        ? 'rotate-0'
                        : 'rotate-180',
                  )}
                />
              }
              className={layout.toggle}
            />

            <TabsList aria-label="Atlas sections" className={layout.tabs}>
              <TabsTrigger
                value="country"
                icon={<MapPinned />}
                className={layout.tab}
              >
                Country
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                icon={<Globe />}
                className={layout.tab}
              >
                Stats
              </TabsTrigger>
              <TabsTrigger
                value="bucket"
                icon={<Telescope />}
                className={layout.tab}
              >
                Bucket list
              </TabsTrigger>
            </TabsList>
          </div>

          <div
            id={bodyId}
            className={cn(
              layout.body,
              expanded === null
                ? 'hidden lg:flex'
                : expanded
                  ? 'flex'
                  : 'hidden',
            )}
          >
            <TabsContent value="country" className={layout.content}>
              {/* Two panes side by side from `lg`, and exactly one of them on a
                  phone: the drawer has under 200px of content in it there, and
                  splitting that between a record and a list gives neither one
                  enough to be read. So a phone shows the list until a country is
                  chosen and the record afterwards, with a way back. */}
              <div className={layout.split}>
                <div
                  className={cn(
                    layout.splitPane,
                    selectedKey === null ? 'hidden lg:flex' : 'flex',
                  )}
                >
                  {/* A phone replaces the list with whatever was chosen, so it
                      owes the reader the way back. A desktop shows both and
                      needs no such thing. */}
                  {selectedKey === null ||
                  onClearSelection === undefined ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ArrowLeft />}
                      onClick={onClearSelection}
                      className="mb-2 self-start lg:hidden"
                    >
                      All countries
                    </Button>
                  )}

                  {record === null && selectedKey !== null ? (
                    // Scrolled for the same reason the record beside it is: the
                    // shelf is a fixed box, and the card plus its two actions is
                    // taller than the drawer a phone opens. Keyed by the country
                    // so choosing another one starts at the top of it rather
                    // than wherever the last one was left.
                    <ScrollArea
                      key={selectedKey}
                      axis="vertical"
                      className="min-h-0 flex-1"
                    >
                      <article
                        aria-labelledby={unvisitedId}
                        data-country={selectedKey}
                        className={layout.unvisited}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={layout.unvisitedFlag}
                          >
                            {countryFlag(selectedKey)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3
                              id={unvisitedId}
                              className="text-balance wrap-anywhere text-subtitle font-semibold text-ink"
                            >
                              {countryName(selectedKey)}
                            </h3>
                            <p className="mt-1 text-caption font-semibold tracking-wide tabular-nums text-ink-3">
                              {selectedKey}
                            </p>
                          </div>
                        </div>
                        {/* One line, not three. The state and what each write
                            does are stated by the block below, where the
                            controls that change them are; saying it twice
                            pushed the actions off the bottom of the shelf. */}
                        <p className="mt-3 text-body text-ink-2">
                          Nothing is recorded here yet.
                        </p>

                        {/* Every fact the map can show is reachable from the
                            shelf, and so is every action: this is the keyboard
                            and touch route to both writes. */}
                        <CountryActions
                          key={selectedKey}
                          countryCode={selectedKey}
                          visit={null}
                          bucketGoal={bucketGoal}
                          headingLevel={4}
                          className="mt-4 border-t border-edge-faint pt-4"
                        />
                      </article>
                    </ScrollArea>
                  ) : record === null ? (
                    <EmptyState
                      variant="filled"
                      tone="brand"
                      size="sm"
                      icon={<Compass />}
                      title={
                        countries.length === 0
                          ? 'Your map is still blank'
                          : 'Pick a country'
                      }
                      description={
                        countries.length === 0
                          ? 'Mark a country as visited and it fills in on the map here, with its first and last visit, how many times you have been and whatever you wrote about it.'
                          : 'Choose one on the map, in the search field or from the list, and its full record opens here — first visit, last visit, the tally and your note.'
                      }
                    />
                  ) : (
                    <ScrollArea
                      key={record.countryCode}
                      axis="vertical"
                      className="min-h-0 flex-1"
                    >
                      <CountryRecord
                        countryCode={record.countryCode}
                        continent={record.continent}
                        firstVisitedOn={record.firstVisitedOn}
                        lastVisitedOn={record.lastVisitedOn}
                        visitCount={record.visitCount}
                        note={record.note}
                        hasOutline={record.hasOutline}
                        headingLevel={3}
                      />

                      {/* Under the record rather than inside it: the record is
                          what is true, and this is what a reader can change
                          about it. A visited country needs the inverse of both
                          writes as much as an unvisited one needs the writes. */}
                      <CountryActions
                        key={`${record.countryCode}-actions`}
                        countryCode={record.countryCode}
                        visit={visitFacts}
                        bucketGoal={bucketGoal}
                        headingLevel={4}
                        className="mt-3"
                      />
                    </ScrollArea>
                  )}
                </div>

                <ScrollArea
                  axis="vertical"
                  className={cn(
                    'min-h-0 min-w-0 rounded-lg border border-edge-faint bg-surface',
                    selectedKey === null ? 'block' : 'hidden lg:block',
                  )}
                >
                  <CountriesList
                    countries={countries}
                    selectedCode={selectedCode}
                    onSelect={onSelect}
                    label="Visited countries"
                  />
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="stats" className={layout.content}>
              <ScrollArea axis="vertical" className="min-h-0 flex-1">
                <div className="flex flex-col gap-4">
                  <div className={layout.statGrid}>
                    {/* Places, not countries.

                        The count of countries and its share of the world are
                        already the panel's headline, in the display face at
                        40px, 120px above this row — printing "12 of 195" and
                        "6% of the world" a second time made the first tile a
                        smaller copy of the thing directly above it and spent a
                        sixth of the row saying nothing new. The saved stops
                        behind those countries were on no surface at all. */}
                    <StatCard
                      className={layout.statCard}
                      icon={<Landmark />}
                      label="Places"
                      value={formatNumber(stats.placeCount ?? 0)}
                      caption={
                        (stats.placeCount ?? 0) === 0
                          ? 'Nothing pinned on a trip yet'
                          : 'Sights, stays and stops saved'
                      }
                    />
                    <StatCard
                      className={layout.statCard}
                      icon={<MapPin />}
                      label="Regions"
                      value={formatNumber(stats.regionCount)}
                      caption={
                        stats.regionCount === 0
                          ? 'No regions marked yet'
                          : 'States, provinces, prefectures'
                      }
                    />
                    <StatCard
                      className={layout.statCard}
                      icon={<Flag />}
                      label="Visits"
                      value={formatNumber(stats.visitCount)}
                      caption="Every recorded arrival"
                    />
                    <StatCard
                      className={layout.statCard}
                      icon={<PlaneTakeoff />}
                      label="Trips"
                      value={formatNumber(stats.tripCount ?? 0)}
                      caption={
                        stats.distanceMetres === null
                          ? 'Finished trips only'
                          : formatDistance(stats.distanceMetres, 'metric')
                      }
                    />
                    <StatCard
                      className={layout.statCard}
                      icon={<MapPinned />}
                      label="Cities"
                      value={formatNumber(stats.cityCount ?? 0)}
                      caption="Towns you slept or stopped in"
                    />
                    <StatCard
                      className={layout.statCard}
                      icon={<Sun />}
                      label="Days away"
                      value={formatNumber(stats.dayCount ?? 0)}
                      caption="Across every trip on your record"
                    />
                  </div>

                  <div>
                    <SectionLabel as="h3" className="mb-1.5">
                      Countries by continent
                    </SectionLabel>
                    <dl className={layout.continentRow}>
                      {cells.map((cell) => (
                        <div
                          key={cell.key}
                          data-continent={cell.key}
                          className={layout.continentCell}
                        >
                          <dt className="min-w-0 truncate text-caption text-ink-2">
                            {cell.label}
                          </dt>
                          {/* A zero is a figure. One step of ink separates it
                              from a live count — never a fade, never a smaller
                              size, because "none yet" is an answer the reader
                              asked for. */}
                          <dd
                            className={cn(
                              layout.continentValue,
                              cell.countryCount === 0
                                ? 'text-ink-2'
                                : 'text-ink',
                            )}
                          >
                            {formatNumber(cell.countryCount)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="bucket" className={layout.content}>
              {bucketList.length === 0 ? (
                <EmptyState
                  variant="filled"
                  size="sm"
                  icon={<Sparkles />}
                  title="Nothing on the list"
                  description="Somewhere you have always meant to go. Add it, and tick it off when you get there."
                />
              ) : (
                <>
                  <SectionLabel
                    as="h3"
                    className="mb-2"
                    action={
                      <span className="text-caption tabular-nums text-ink-2">
                        {formatNumber(achieved)} of {formatNumber(total)} done
                      </span>
                    }
                  >
                    Bucket list
                  </SectionLabel>
                  <ScrollArea axis="vertical" className="min-h-0 flex-1">
                    <ul className="min-w-0">
                      {bucketList.map((row) => (
                        <li key={row.id} className={layout.bucketRow}>
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-md border border-edge-faint bg-surface-2 text-label leading-none"
                          >
                            {row.countryCode === null ? (
                              <Compass size={14} className="text-ink-3" />
                            ) : (
                              countryFlag(row.countryCode)
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Completed rows keep full contrast. A struck-out
                                line at a muted grey was the one text pair on
                                this screen that failed AA, and the chip already
                                says "Done" in words. */}
                            <p
                              className={cn(
                                'truncate text-label',
                                row.isAchieved
                                  ? 'font-medium text-ink-2'
                                  : 'font-medium text-ink',
                              )}
                            >
                              {row.name}
                            </p>
                            <p className="truncate text-caption tabular-nums text-ink-3">
                              {humaniseToken(row.kind)}
                              {row.countryCode === null
                                ? ''
                                : ` · ${countryName(row.countryCode)}`}
                              {row.targetYear === null
                                ? ''
                                : ` · by ${row.targetYear}`}
                            </p>
                          </div>
                          {row.isAchieved ? (
                            <Badge
                              tone="success"
                              size="sm"
                              className="shrink-0"
                            >
                              Done
                            </Badge>
                          ) : (
                            <Badge
                              tone="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              To go
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Inside the scroll container, at the end of the rows it
                        is about, so a reader who scrolls to the bottom of the
                        list is told what the bottom of the list is. */}
                    {hidden === 0 ? null : (
                      <p className="border-t border-edge-faint px-1 pt-2.5 text-caption tabular-nums text-ink-3">
                        {pluralise(hidden, 'more entry', 'more entries')} on
                        your list, not shown here.
                      </p>
                    )}
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            {/* The key stays put whichever section is open: the ramp it decodes
                is on screen the whole time, and WCAG 1.4.1 is not satisfied by a
                legend a reader has to go looking for. */}
            <div className={layout.footer}>
              <AtlasLegend />
            </div>
          </div>
        </Tabs>
      </GlassPanel>
    )
  },
)
AtlasPanel.displayName = 'AtlasPanel'

/* ------------------------------------------------------------------ loading */

/**
 * The panel's loading shape, cut from the same `layout` strings.
 *
 * It reserves the header's two lines, the tab strip's height, the record and the
 * list side by side, and the key in the footer — so the swap from loading to
 * loaded moves the panel by nothing that a reader can see.
 */
export const AtlasPanelSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <GlassPanel
    ref={ref}
    radius="2xl"
    padding="none"
    floating={false}
    aria-busy="true"
    className={cn(layout.root, className)}
    {...props}
  >
    <span className="sr-only">Loading your atlas</span>

    <div data-part="panel-header" aria-hidden="true" className={layout.header}>
      <div className={layout.headline}>
        <div className="min-w-0 flex-1">
          <Skeleton radius="sm" className="h-3 w-28" />
          <Skeleton radius="md" className="mt-2 h-9 w-32" />
          <Skeleton radius="sm" className="mt-1.5 h-3 w-40" />
        </div>
      </div>
      {/* The progress column's own box. It is the flexible element in the
          header row from `lg`, so leaving it out of the loading shape let the
          tab strip slide left against the headline and then jump back when the
          read landed. */}
      <div className={layout.progress}>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <Skeleton radius="sm" className="h-3 w-36" />
          <Skeleton radius="sm" className="h-3 w-16" />
        </div>
        <Skeleton radius="full" className="h-1.5 w-full" />
      </div>

      {/* The collapse toggle's own box, so the headline column is the width it
          will be rather than 44px wider until the read lands. */}
      <Skeleton radius="full" className={cn(layout.toggle, 'size-8')} />

      {/* The `sm` segmented track's own height and the tab strip's own place on
          the grid, so nothing moves or resizes when the read lands. */}
      <Skeleton radius="full" className={cn(layout.tabs, 'h-9 lg:w-88')} />
    </div>

    <div aria-hidden="true" className={cn(layout.body, 'hidden lg:flex')}>
      <div className={layout.split}>
        <div className={layout.splitPane}>
          <CountryRecordSkeleton />
        </div>
        <div
          className={cn(
            layout.splitPane,
            'rounded-lg border border-edge-faint bg-surface',
          )}
        >
          <CountriesListSkeleton rows={3} />
        </div>
      </div>
      <div className={layout.footer}>
        <AtlasLegendSkeleton />
      </div>
    </div>
  </GlassPanel>
))
AtlasPanelSkeleton.displayName = 'AtlasPanelSkeleton'
