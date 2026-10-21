import * as React from 'react'
import { CircleDashed, MapPin, Route, TriangleAlert } from 'lucide-react'

import {
  Button,
  SectionLabel,
  Skeleton,
  focusRing,
  transitionBase,
} from '#/components/ui'
import { useAtlasCopy, useAtlasI18n } from '#/components/map'
import { cn } from '#/lib/cn'
import { ABSENT_FACT_MARK, countryFacts } from '#/lib/atlas/country-facts'
import { countryName } from '#/lib/atlas/country-names'
import { countryFlag, formatMonthYear, formatNumber } from '#/lib/format'

import type { Locale, Translate } from '#/lib/i18n'
import type {
  CountryFactMonth,
  CountryFactSource,
} from '#/lib/atlas/country-facts'

/**
 * One country, told on the map itself.
 *
 * The atlas has two moments where a country has to speak for itself: the
 * pointer crosses it, and the pointer clicks it. Those are one card. Written
 * twice they would drift on the first edit and the map would end up reporting
 * two different truths about the same country depending on how you touched it,
 * so this component is the only place either moment is typeset. It takes its
 * facts from `countryFacts()` and every caption from the `atlas.card.*` keys of
 * the locale catalogue, so no wording is decided anywhere else.
 *
 * It fetches nothing, knows nothing about MapLibre and holds no state. That is
 * deliberate: the hard parts of a map overlay are anchoring, collision and
 * pointer-event capture, and none of them belong to the thing being anchored.
 * The card can therefore be built, measured and proved before there is a map to
 * hang it on, and a host is free to mount it in a Radix layer, in a marker
 * portal or in a static panel without this file learning about any of them.
 *
 * **Why it is opaque.** The obvious treatment for a panel over a map is glass,
 * and the product has `GlassPanel` for exactly that. It is wrong here. This
 * card carries an 11px label ladder over a 26px numeral, and it lands on
 * whatever the reader happened to point at — pale paper land, deep pine fill,
 * a coastline, the sea. A translucent ground lets a country border run straight
 * through a date, and it makes every contrast figure conditional on geography.
 * `--color-map-card` is opaque so the ratios in `tokens.css` are true wherever
 * the card lands, and the boundary against the map is carried by whichever of
 * the face or the hairline wins on that particular fill. Measured against every
 * ground the card can land on — paper land, hovered land, the sea and the five
 * steps of the visited ramp — the winning edge never falls below 3.1987:1 in
 * light (over hovered land) or 3.4754:1 in dark (over the same), well past the
 * 3:1 a boundary owes, so the card clears WCAG 2.2 1.4.11 wherever the
 * reader points. The two remaining tokens in the country group are 1px borders
 * rather than fills; a card edge can only ever coincide with one across a
 * single pixel, and the fill on both sides of that pixel clears 3:1 on its own.
 *
 * **The type is the whole argument.** The reference this screen is judged
 * against sets its labels at 9px and 10px in whatever the OS falls back to, at
 * one flat ink, over a panel that is 60–75% opaque. Ours has three tiers doing
 * three jobs — `ink` for the name and the numerals, `ink-2` for the months,
 * `ink-3` for the unit labels — real display numerals in MuseoModerno, Geist
 * for the labels, and a floor of 11px that nothing in this file goes under.
 * Every numeral carries `tabular-nums`, because the trip count is the one
 * figure on the atlas that changes under the reader.
 *
 * Measured in a browser against the rendered `--color-map-card` face, and the
 * same over `--color-country-land` and `--color-country-visited` because the
 * face is opaque and the ground beneath it cannot reach the type — light, then
 * dark: name and numerals 18.29:1 / 15.42:1, months 10.71:1 / 11.37:1, unit
 * labels and the em dash 7.02:1 / 7.18:1, the error sentence 10.71:1 / 11.37:1,
 * its icon 6.33:1 / 7.43:1, and the hairline 4.55:1 / 4.65:1. The floor across
 * the whole card is the 11px label tier, and it clears AA by better than half
 * again in both themes. The placeholder bars are the one non-text figure the
 * card owns, and they sit on `--color-map-card-inset` at 1.19:1 light and
 * 1.20:1 dark — the same reading every other skeleton in the product gives on
 * a page.
 *
 * **Three states, one geometry.** A country with an itinerary prints its trips
 * and its trip months, headed `Trips · Places · First trip · Last trip`. A
 * country the traveller marked by hand — no trip behind it, which on a real
 * record is most of them — prints its visits and its visit months in the same
 * four cells, headed `Visits · Places · First visit · Last visit`, because the
 * alternative is a card that says nothing about the very countries the map has
 * just filled in. A country with nothing recorded at all prints `0` twice and
 * an em dash for each month, the whole grid set back an ink tier so the
 * emptiness is legible before any label is read. That is the distinction the
 * eye makes first — a card that speaks against a card gone quiet. The second
 * one, between a journey and a visit, is made twice over: by the captions, and
 * by the record mark at the end of the name line, which is a route, a pin or a
 * dashed ring. Under a moving pointer a caption is a shape rather than a
 * sentence, and the glyph answers at that speed. The dash is
 * `aria-hidden` and paired with words, because a reader hearing "dash" cannot
 * tell a missing date from a broken one. All three are the same grid, the same
 * rules and the same type ladder, so the card's height never changes as the
 * pointer crosses a border — `countryFacts()` chooses the record and this file
 * draws whatever it was handed, in the catalogue's words.
 *
 * **Both records are passed or the card lies.** The trip columns alone cannot
 * tell a country nobody has recorded from a country visited three times, and a
 * host that hands over only those turns every manually marked country into the
 * empty state — which is exactly what shipped, for three rounds, while the
 * visit columns were optional and nothing checked them. They are required
 * props, so that host no longer compiles. `countryFactColumns()` in
 * `#/lib/atlas/country-facts` projects a whole atlas record into exactly these
 * props; a host holding one should spread it rather than pick fields.
 *
 * **Every state this surface can be in ships here.** Rest and the zero state
 * are `CountryCard`; the name-only pill is its `compact` variant; loading is
 * `CountryCardSkeleton` and degraded is `CountryCardError`, both struck from
 * the same `layout` strings so all four measure identically and the swap
 * between them moves nothing. Focus is the product's own ring, drawn on the
 * card itself for a host that pins it and focuses it. There is deliberately no
 * hover and no pressed treatment: this is a fact surface, and a card that lit
 * up under the pointer would be promising an action it does not have.
 */

/** Heading levels a host screen might legitimately need for the name. */
const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const

/** Which edge the card's pointer sits on, or `none` for an unanchored card. */
export type CountryCardPointer = 'none' | 'top' | 'right' | 'bottom' | 'left'

/**
 * The pointer's placement, per edge.
 *
 * It is an 8px square turned 45° and pulled half its side out of the card, with
 * only the two sides that face away from the card given a border — so the join
 * is seamless and the outline continues around the tip. Drawn from the card's
 * own ground and hairline tokens, because it is the card's corner rather than a
 * second object.
 */
const POINTERS = {
  none: '',
  top: 'left-1/2 -top-1 -translate-x-1/2 border-t border-l',
  right: '-right-1 top-1/2 -translate-y-1/2 border-t border-r',
  bottom: 'left-1/2 -bottom-1 -translate-x-1/2 border-r border-b',
  left: '-left-1 top-1/2 -translate-y-1/2 border-b border-l',
} as const

/**
 * The card's layout, held as class strings rather than typed out four times.
 *
 * The rest card, its strut, its skeleton and its error state are all assembled
 * from these exact strings. That is the only way the placeholder can honestly
 * claim the dimensions of the thing it stands in for: a copied class list drifts
 * on the first edit, and a placeholder that has drifted moves the page under the
 * reader at the moment the facts land — which is the one thing a placeholder
 * exists to prevent.
 */
const layout = {
  /**
   * The ground every variant stands on.
   *
   * `focusRing` is inert on a card nobody focuses — `:focus-visible` cannot
   * match an element with no tab stop — and it is not decoration for a state
   * that cannot happen. A card pinned by a click is focused by its host when it
   * opens and is focused again when a roving-focus map hands it the country, and
   * without this the reader would be somewhere with no ring at all. The card
   * carries no hover or pressed treatment on purpose: it is a fact surface, not
   * a control, and lighting it up under the pointer would promise an action it
   * does not have. Every control it *contains* — the error state's retry — is a
   * `Button`, and brings its own five states with it.
   */
  surface: cn(
    'relative z-map-surface border border-map-card-edge bg-map-card shadow-popover',
    focusRing,
  ),
  /**
   * `w-72` is fixed on purpose. A card sized by its content would breathe every
   * time a trip count crossed a digit or a month changed length, and it is
   * anchored to a country, so breathing means moving. 288px is the width at
   * which the two date columns hold `September 2026` — the longest month-year
   * the formatter can produce — without either of them truncating, and it still
   * clears a 360px viewport with a 16px margin on both sides.
   *
   * The one step at `2xl` is density, not reflow: past 1536px the whole screen
   * is set looser, and a card frozen at a phone's measure stops reading as an
   * object placed on the map and starts reading as a sticker left on it. Width
   * and padding step together so the type block keeps its proportions, and the
   * step lands on every variant at once because they all take this string —
   * so the skeleton and the error state resize with the card rather than
   * against it, at every viewport.
   *
   * Nothing here scrolls and nothing here clips: the card is exactly as tall as
   * the four cells it prints, so a host can measure it once and anchor to it.
   * A fact card that cuts its own last row in half reads as a fault.
   */
  card: 'w-72 2xl:w-80 max-w-full rounded-lg text-start',
  /**
   * A single-line pill: fixed height, so a row of them never staggers. It takes
   * the same density step as the card at `2xl` — two surfaces of the same family
   * can be on screen at once, and one of them growing alone would read as two
   * unrelated objects.
   *
   * The ceiling is the card's own measure, not a narrower one of its own. A
   * pill prints exactly one thing, and a ceiling below the card's clipped the
   * only thing it has to say: measured across all 250 names in the table, one
   * of them — `South Georgia & South Sandwich Islands`, 280px — overran the old
   * 224px and arrived already shortened, on a surface with no second line to
   * shorten *into*. At the card's own measure none of the 250 does, the two
   * atlas surfaces read as one object at two sizes, and 288px is a width a
   * 360px viewport has already been shown to hold, because the card takes it.
   */
  compact:
    'inline-flex h-8 max-w-72 items-center rounded-full px-3 2xl:h-9 2xl:max-w-80 2xl:px-4',
  compactName:
    'min-w-0 truncate font-display text-label font-bold tracking-tight text-ink',
  header:
    'flex items-center gap-2 border-b border-edge-faint px-4 py-3 2xl:px-5 2xl:py-4',
  /** Decoration beside the name, never the label — see the `<span>` below. */
  flag: 'shrink-0 text-label leading-none',
  /**
   * The record mark, pushed to the far end of the header line.
   *
   * `ml-auto` rather than a spacer, and `shrink-0` so a long name truncates
   * against it instead of squeezing it away. A 16px glyph inside a 25px name
   * line adds no height, which is what lets the mark exist at all: the card is
   * anchored to a country and its height is a promise to whatever anchored it.
   */
  mark: 'ms-auto shrink-0',
  /**
   * `truncate` rather than a wrap: the name is the card's identity line and the
   * card's height is a promise to whatever anchored it. "South Georgia & South
   * Sandwich Islands" shortens itself instead of taking a second line and
   * pushing the figures down over the country they describe.
   */
  name: 'min-w-0 truncate font-display text-subtitle font-bold tracking-tight text-ink',
  /** Two columns, two rows: trips and places over first trip and last trip. */
  grid: 'grid grid-cols-2',
  cell: 'min-w-0 px-4 py-3 2xl:px-5 2xl:py-4',
  cellRule: 'border-e border-edge-faint',
  rowRule: 'border-t border-edge-faint',
  /**
   * The unit label's type, stated so a strut can measure the same as a real
   * `SectionLabel` without rendering a word inside it. 11px / 600 / 0.08em
   * uppercase — the same three numbers the primitive sets, and the floor for
   * every label on this card.
   */
  label: 'block text-micro font-semibold uppercase tracking-label',
  /**
   * The box a unit label sits in, per row: as many of the label's own lines as
   * the longest translation of that row needs, with the label set on the last
   * of them so it stays against the figure it names.
   *
   * The label wraps rather than truncates. The tally heading ends in its
   * workspace qualifier, which runs it to 116px in English and to 240px
   * elsewhere against a 112px content box (120px at `2xl`), and a truncated
   * one keeps only the head noun — `WYJAZDY PRZE…` — which is the bare label
   * the qualifier replaced. Measured in Chromium with the shipped faces, every
   * plural form of every locale's figure labels fits in three lines and every
   * month label in two, at both widths.
   *
   * The lines are reserved, not merely allowed, because the card's height is a
   * promise to whatever anchored it: a trip heading on three lines against a
   * visit heading on one would move the figures as the pointer crossed a
   * border. `lh` is the label's own line height, so the reservation follows
   * Arabic's taller leading without a second number. The skeleton and the error
   * strut take these same strings. A translation that needs a further line
   * outgrows the card in that one state, so re-measure before lengthening one.
   */
  labelSlotFigure: 'flex min-h-[3lh] flex-col justify-end text-micro',
  labelSlotMonth: 'flex min-h-[2lh] flex-col justify-end text-micro',
  figure: 'mt-1 block truncate font-display text-title tabular-nums text-ink',
  /**
   * The figures of a card with no record behind it, one ink tier back.
   *
   * Both noughts or neither, and only on the card where nothing has ever been
   * written down. `0` is a fact and it stays on the card, but on *that* card it
   * is a fact about nothing, and the two dashes below it already say so at
   * `ink-3`; at full `ink` the empty card was the loudest of the three — two
   * big black noughts announcing an absence — and it took a reading of the
   * labels to tell it from a country genuinely on the record. Set back a tier,
   * the whole grid recedes together and the eye sorts the three states before
   * it reads a word: a card that speaks, or a card that has nothing to say.
   *
   * What this must never do is grey a single cell inside a card that carries a
   * record. A country visited three times with no place saved in it has no
   * places saved in it, and dimming that one nought made the card read as the
   * empty state — the very defect the visit reading was added to remove.
   *
   * Measured at 7.02:1 light and 7.18:1 dark against the card face — the same
   * figures the unit labels carry, and comfortably past AA at this size.
   */
  figureAbsent:
    'mt-1 block truncate font-display text-title tabular-nums text-ink-3',
  month: 'mt-1 block truncate text-label font-semibold tabular-nums text-ink-2',
  /** The em dash sits a tier back: it is an absence, not a value. */
  monthAbsent:
    'mt-1 block truncate text-label font-semibold tabular-nums text-ink-3',
} as const

/**
 * Which of the three records the card is speaking from, said as a shape.
 *
 * The captions already say it in words — `Trips` against `Visits`, `First trip`
 * against `First visit` — and words are what a reader who is *reading* the card
 * gets. But this card exists under a moving pointer: it appears, it is glanced
 * at, and it is replaced by the next country a second later, and at that speed
 * an 11px caption is a shape rather than a sentence. So the state is also
 * carried by a glyph at the end of the name line, where the eye already is: a
 * route for a country with an itinerary behind it, a pin for one the traveller
 * marked by hand, and a dashed ring for one nothing has ever been written
 * about.
 *
 * It is redundant on purpose. Nothing here is the only carrier of anything —
 * the glyph is `aria-hidden`, the captions are the accessible reading, and the
 * two tones say only "there is a record here" against "there is not", which the
 * receded figures below already say. A reader who cannot resolve a 16px glyph
 * loses nothing; a reader glancing across a map gains the answer half a beat
 * earlier.
 *
 * `--color-brand` on the card face measures 7.09:1 light and 7.16:1 dark, and
 * `--color-ink-3` 7.02:1 and 7.18:1 — every one of them past the 3:1 a
 * non-text graphic owes, several times over.
 */
const RECORD_MARKS = {
  trips: { Glyph: Route, tone: 'text-brand' },
  visits: { Glyph: MapPin, tone: 'text-brand' },
  none: { Glyph: CircleDashed, tone: 'text-ink-3' },
} as const

/** The glyph at the end of the name line, for one of the three records. */
function RecordMark({ source }: { readonly source: CountryFactSource }) {
  const { Glyph, tone } = RECORD_MARKS[source]
  return (
    <Glyph
      size={16}
      aria-hidden="true"
      data-part="record"
      className={cn(layout.mark, tone)}
    />
  )
}

/** The pointer element, or nothing when the card is not anchored to anything. */
function Pointer({ side }: { readonly side: CountryCardPointer }) {
  if (side === 'none') {
    return null
  }
  return (
    <span
      aria-hidden="true"
      data-part="pointer"
      className={cn(
        'absolute size-2 rotate-45 border-map-card-edge bg-map-card',
        POINTERS[side],
      )}
    />
  )
}

/** One label-and-value cell of the 2×2 fact grid. */
function FactCell({
  label,
  rule,
  row,
  valueClassName,
  children,
}: {
  readonly label: string
  /** Draws the vertical rule between the two columns. */
  readonly rule: boolean
  /** Draws the horizontal rule between the two rows. */
  readonly row: boolean
  readonly valueClassName: string
  readonly children: React.ReactNode
}) {
  return (
    <div
      data-part="cell"
      className={cn(
        layout.cell,
        rule && layout.cellRule,
        row && layout.rowRule,
      )}
    >
      <dt className={row ? layout.labelSlotMonth : layout.labelSlotFigure}>
        <SectionLabel as="span" truncate={false}>
          {label}
        </SectionLabel>
      </dt>
      <dd className={valueClassName}>{children}</dd>
    </div>
  )
}

/**
 * A month, or an em dash that a screen reader hears as words.
 *
 * The printable month is re-derived here rather than taken off
 * `CountryFactMonth.value`, which `#/lib/atlas/country-facts` renders in the
 * source locale. Both go through `formatMonthYear()`, the product's single
 * frozen formatter, so the only difference is which locale's frozen table it
 * reads — never which library named the month.
 */
function MonthValue({
  month,
  source,
  locale,
  t,
}: {
  readonly month: CountryFactMonth
  /** The raw day column the month was coarsened from. */
  readonly source: string | null
  readonly locale: Locale
  readonly t: Translate
}) {
  const printed = source === null ? null : formatMonthYear(source, locale)
  if (month.iso === null || printed === null) {
    return (
      <>
        <span aria-hidden="true">{ABSENT_FACT_MARK}</span>
        <span className="sr-only">{t('atlas.card.absent')}</span>
      </>
    )
  }
  return <time dateTime={month.iso}>{printed}</time>
}

/** A non-breaking space: an empty line box that still has a real height. */
const STRUT = '\u00A0'

/**
 * The card's body, rendered as pure line boxes.
 *
 * Used by the error state, which has to occupy the card's rest height exactly
 * and has nothing of its own to fill it with. Letting the browser measure the
 * real grid, in the real type styles, removes every guess — and it keeps
 * working when the type scale is retuned, which a hand-picked `h-32` would not.
 * Marked `aria-hidden` and `invisible` rather than `hidden`, because an element
 * with no box has no height to lend.
 */
function BodyStrut() {
  return (
    <div aria-hidden="true" data-part="strut" className="invisible">
      <div className={layout.grid}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              layout.cell,
              index % 2 === 0 && layout.cellRule,
              index > 1 && layout.rowRule,
            )}
          >
            <span
              className={
                index > 1 ? layout.labelSlotMonth : layout.labelSlotFigure
              }
            >
              <span className={layout.label}>{STRUT}</span>
            </span>
            <span className={index > 1 ? layout.month : layout.figure}>
              {STRUT}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A placeholder bar struck inside a real line box of the real type style.
 *
 * Sizing a skeleton bar with a hand-picked height is how a loading state ends
 * up shorter than the text it replaces — 13px label copy at our 1.4 leading is
 * an 18.2px line, not 16. The invisible strut inside makes the browser do the
 * measuring instead.
 *
 * The bar stands on `--color-map-card-inset`, which is the card's own ground
 * rather than the page's. `Skeleton`'s default `--color-surface-inset` is
 * measured against `--color-surface`, and over the darker over-map face it
 * falls to 1.13:1 where the same bar on a page reads 1.20:1 — a third quieter,
 * for no reason but which surface it happened to borrow. The card's own token
 * lands on 1.19:1 in light and 1.20:1 in dark against `--color-map-card`, so a
 * card waiting over the map reads exactly as loud as one waiting on a page.
 * `--color-surface-2` was tried before either and dropped: it lands at 1.13:1
 * in light and 1.03:1 in dark, where the bars stop being visible at all.
 */
function LineSkeleton({
  width,
  className,
}: {
  readonly width: string
  readonly className: string
}) {
  return (
    // `block` trails `className` so it wins the display conflict: one of the
    // strings handed in is the card's name line, which is inline by default and
    // has no box for an absolutely-positioned bar to sit inside.
    <span className={cn('relative', className, 'block')}>
      <span className="invisible">{STRUT}</span>
      <Skeleton
        radius="sm"
        className={cn('absolute inset-y-0.5 start-0 bg-map-card-inset', width)}
      />
    </span>
  )
}

interface CountryCardBaseProps extends Omit<
  React.ComponentPropsWithoutRef<'article'>,
  'children'
> {
  /** ISO 3166-1 alpha-2, in whatever case the row happened to store it. */
  readonly countryCode: string
  /** Which edge the pointer sits on. `bottom` floats the card above its anchor. */
  readonly pointer?: CountryCardPointer
  /**
   * `true` when the surface that opened this card already carries the same
   * facts as its accessible name — a hovered map polygon, for instance. The
   * card becomes purely visual and the reader hears the country once instead of
   * twice. The host builds that accessible name itself.
   */
  readonly decorative?: boolean
}

/**
 * The full card: name, the leading tally, places, and the two months.
 *
 * Both records are taken, not one, and **both are required**. The trip columns
 * are the more specific thing to know and win whenever there is a trip; the
 * visit columns are what the atlas's manual half writes, and they are what most
 * countries on a real record have instead. A host that hands over only the trip
 * half cannot tell a country nobody has recorded from a country visited three
 * times, so every such country renders as the empty state — a defect that
 * survived three rounds precisely because the visit columns were optional and
 * the type checker had nothing to say about a host that dropped them. They are
 * required now, so dropping them is a build failure rather than a card that
 * quietly prints four dashes over a country the map has just filled in.
 *
 * `countryFactColumns()` in `#/lib/atlas/country-facts` projects a whole atlas
 * record into exactly these eight fields; a host holding one should spread its
 * result rather than pick fields by hand.
 */
export interface CountryCardFactsProps extends CountryCardBaseProps {
  readonly variant?: 'card'
  readonly tripCount: number
  readonly placeCount: number
  readonly firstTripOn: string | null
  readonly lastTripOn: string | null
  /** Visits on the record, whether or not a trip is attached to any of them. */
  readonly visitCount: number
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  /** The name is a heading; the host decides at what depth. */
  readonly headingLevel?: 2 | 3 | 4
}

/**
 * The name alone, as a pill.
 *
 * For a country with nothing recorded against it, where four cells of zeroes
 * would be four cells of noise. It takes no counts and no dates because it
 * prints none: a host that has the facts should show the card.
 */
export interface CountryCardCompactProps extends CountryCardBaseProps {
  readonly variant: 'compact'
}

export type CountryCardProps = CountryCardFactsProps | CountryCardCompactProps

export const CountryCard = React.forwardRef<HTMLElement, CountryCardProps>(
  (props, ref) => {
    const headingId = React.useId()

    if (props.variant === 'compact') {
      const {
        variant,
        countryCode,
        pointer = 'none',
        decorative = false,
        className,
        ...rest
      } = props
      const code = countryCode.trim().toUpperCase()
      return (
        <div
          // The forwarded ref is typed to the element the full card renders,
          // which is the wider of the two. A pill is not an `<article>` — it is
          // one name, not a self-contained composition — so the narrowing is
          // stated here rather than by loosening the ref for both variants.
          ref={ref as React.Ref<HTMLDivElement>}
          aria-hidden={decorative ? true : undefined}
          data-variant={variant}
          data-country={code}
          className={cn(
            layout.surface,
            layout.compact,
            transitionBase,
            className,
          )}
          {...rest}
        >
          <p className={layout.compactName}>{countryName(code)}</p>
          <Pointer side={pointer} />
        </div>
      )
    }

    const {
      variant = 'card',
      countryCode,
      tripCount,
      placeCount,
      firstTripOn,
      lastTripOn,
      visitCount,
      firstVisitedOn,
      lastVisitedOn,
      headingLevel = 3,
      pointer = 'none',
      decorative = false,
      className,
      ...rest
    } = props
    const Heading = HEADINGS[headingLevel]
    const { locale, t } = useAtlasI18n()
    const facts = countryFacts({
      countryCode,
      tripCount,
      placeCount,
      firstTripOn,
      lastTripOn,
      visitCount,
      firstVisitedOn,
      lastVisitedOn,
    })
    // Per card, not per cell. A nought inside a card that carries a record is
    // a measured fact — a country visited three times with no place saved in
    // it has *no* places saved in it, and dimming that one figure made the
    // card read as the empty state it is not, which is the exact defect this
    // component was widened to remove. So the tier answers one question, once:
    // is there a record here at all? Either the whole grid speaks at full ink,
    // or the whole grid recedes.
    const figureTier =
      facts.source === 'none' ? layout.figureAbsent : layout.figure
    /**
     * Which of the two records the four cells speak for. `countryFacts()` has
     * already decided it — the trip columns win whenever there is a trip, and
     * the visit columns answer for the manual half of the atlas — so the card
     * only picks the words, and picks the raw day columns from the same side so
     * the months and their headings can never come from different records.
     */
    const spoken = facts.source === 'visits'
    const firstOn = spoken ? firstVisitedOn : firstTripOn
    const lastOn = spoken ? lastVisitedOn : lastTripOn

    return (
      <article
        ref={ref}
        aria-hidden={decorative ? true : undefined}
        aria-labelledby={decorative ? undefined : headingId}
        data-variant={variant}
        // The code the map, the panel and an end-to-end test all key on, so a
        // host can find one card without inventing its own id scheme.
        data-country={facts.code}
        data-visited={String(facts.visited)}
        // Which record the cells speak for, so a host or an end-to-end test can
        // assert the state without parsing the labels back out of the DOM.
        data-record={facts.source}
        className={cn(layout.surface, layout.card, transitionBase, className)}
        {...rest}
      >
        <div data-part="header" className={layout.header}>
          {/* Decoration: the name beside it is the real label, and a reader
              whose platform has no flag glyphs loses nothing. */}
          <span aria-hidden="true" className={layout.flag}>
            {countryFlag(facts.code)}
          </span>
          <Heading id={headingId} className={layout.name}>
            {facts.name}
          </Heading>
          <RecordMark source={facts.source} />
        </div>

        <dl className={layout.grid}>
          <FactCell
            label={t(spoken ? 'atlas.card.visits' : 'atlas.card.trips', {
              count: facts.tally.count,
            })}
            rule
            row={false}
            valueClassName={figureTier}
          >
            {formatNumber(facts.tally.count, locale)}
          </FactCell>
          <FactCell
            label={t('atlas.card.places', { count: facts.places.count })}
            rule={false}
            row={false}
            valueClassName={figureTier}
          >
            {formatNumber(facts.places.count, locale)}
          </FactCell>
          <FactCell
            label={t(spoken ? 'atlas.card.firstVisit' : 'atlas.card.firstTrip')}
            rule
            row
            valueClassName={
              facts.first.iso === null ? layout.monthAbsent : layout.month
            }
          >
            <MonthValue
              month={facts.first}
              source={firstOn}
              locale={locale}
              t={t}
            />
          </FactCell>
          <FactCell
            label={t(spoken ? 'atlas.card.lastVisit' : 'atlas.card.lastTrip')}
            rule={false}
            row
            valueClassName={
              facts.last.iso === null ? layout.monthAbsent : layout.month
            }
          >
            <MonthValue
              month={facts.last}
              source={lastOn}
              locale={locale}
              t={t}
            />
          </FactCell>
        </dl>

        <Pointer side={pointer} />
      </article>
    )
  },
)
CountryCard.displayName = 'CountryCard'

export type CountryCardSkeletonProps = React.ComponentPropsWithoutRef<'div'> & {
  readonly pointer?: CountryCardPointer
  /**
   * The country whose figures are on their way, when the host already knows it
   * — a click surface does. Naming it turns "loading" into "loading France",
   * which is the difference between a reader knowing the card they opened is
   * still coming and a reader hearing that something, somewhere, is busy.
   */
  readonly countryCode?: string
}

/**
 * The card's loading shape.
 *
 * Assembled from `layout` — the same strings the card itself is built from — so
 * every box measures the same in both themes and at every viewport: the header's
 * 25px name line, the 13px unit labels, the 30px numerals and the 18px months,
 * with the same rules between them. Nothing here is an eyeballed height, so the
 * two components cannot drift apart, and nothing moves when the facts land.
 *
 * **It is audible.** `aria-busy` on a subtree that is also `aria-hidden` says
 * nothing to anybody: hiding the subtree removes the very node the busy state
 * was declared on. So the root carries `aria-busy` and one `sr-only` sentence,
 * and only the drawing below it is hidden — the same division `Skeleton` itself
 * documents, and the same one `CountriesListSkeleton` uses.
 *
 * There is no compact skeleton, because the compact pill has nothing to wait
 * for: its only datum is the country's name, which is a frozen table lookup.
 */
export const CountryCardSkeleton = React.forwardRef<
  HTMLDivElement,
  CountryCardSkeletonProps
>(({ pointer = 'none', countryCode, className, ...props }, ref) => {
  const t = useAtlasCopy()
  const code = countryCode?.trim().toUpperCase()
  return (
    <div
      ref={ref}
      aria-busy="true"
      data-variant="skeleton"
      data-country={code}
      className={cn(layout.surface, layout.card, transitionBase, className)}
      {...props}
    >
      <span className="sr-only">
        {code === undefined
          ? t('atlas.card.loading')
          : t('atlas.card.loadingNamed', { name: countryName(code) })}
      </span>

      <div aria-hidden="true">
        <div data-part="header" className={layout.header}>
          {/* Matched to a flag glyph's own box rather than to a round number, so
              the header's baseline does not move when the country lands. */}
          <Skeleton
            radius="sm"
            className="h-3.5 w-5 shrink-0 bg-map-card-inset"
          />
          {/* `flex-1` is load-bearing: the name line carries `min-w-0` and
              `truncate`, so as a flex item with only an invisible strut inside
              it it would measure four pixels wide and clip its own bar away. */}
          <LineSkeleton
            width="w-32 max-w-full"
            className={cn(layout.name, 'flex-1')}
          />
        </div>

        <div className={layout.grid}>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              data-part="cell"
              className={cn(
                layout.cell,
                index % 2 === 0 && layout.cellRule,
                index > 1 && layout.rowRule,
              )}
            >
              <span
                className={
                  index > 1 ? layout.labelSlotMonth : layout.labelSlotFigure
                }
              >
                <LineSkeleton
                  width={index > 1 ? 'w-16 max-w-full' : 'w-10 max-w-full'}
                  className={layout.label}
                />
              </span>
              <LineSkeleton
                width={index > 1 ? 'w-24 max-w-full' : 'w-8 max-w-full'}
                className={index > 1 ? layout.month : layout.figure}
              />
            </div>
          ))}
        </div>
      </div>

      <Pointer side={pointer} />
    </div>
  )
})
CountryCardSkeleton.displayName = 'CountryCardSkeleton'

export type CountryCardErrorProps = Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'children'
> & {
  /** The card still names its country: only the figures went missing. */
  readonly countryCode: string
  readonly pointer?: CountryCardPointer
  /** Omit it and no button is offered — an action that cannot run is worse
      than none. A card that only exists while the pointer is over it should
      omit it; a card pinned by a click should not. */
  readonly onRetry?: () => void
  /** Holds the button in its pending state while the refetch is in air. */
  readonly retrying?: boolean
}

/**
 * The degraded card.
 *
 * Deliberately not a zero state: `0 trips` is a fact about a country, and
 * printing it because a read failed would be a lie the reader has no way to
 * detect. The header still names the country, so the card that opened is still
 * the card you are looking at, and the body says plainly that the figures did
 * not arrive.
 *
 * It occupies the rest card's exact height by rendering the real body as an
 * invisible strut and floating the message over it, so a retry that succeeds
 * swaps content without moving the card off the country it is anchored to.
 *
 * `role="status"` rather than `role="alert"`: a figure that failed to arrive is
 * worth telling the reader about, and it is not worth interrupting them
 * mid-sentence to do it. The whole card is the live region, so the one polite
 * announcement carries the country, the sentence and the fact that there is a
 * retry — the reader never has to hunt for which card went wrong.
 */
export const CountryCardError = React.forwardRef<
  HTMLDivElement,
  CountryCardErrorProps
>(
  (
    {
      countryCode,
      pointer = 'none',
      onRetry,
      retrying = false,
      className,
      ...props
    },
    ref,
  ) => {
    const t = useAtlasCopy()
    const code = countryCode.trim().toUpperCase()
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        data-variant="error"
        data-country={code}
        className={cn(layout.surface, layout.card, transitionBase, className)}
        {...props}
      >
        <div data-part="header" className={layout.header}>
          <span aria-hidden="true" className={layout.flag}>
            {countryFlag(code)}
          </span>
          <p className={layout.name}>{countryName(code)}</p>
        </div>

        <div className="relative overflow-hidden">
          <BodyStrut />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center 2xl:px-5">
            <TriangleAlert
              size={16}
              aria-hidden="true"
              className="shrink-0 text-warning"
            />
            {/* Balanced rather than ragged: two sentences in a 288px column
                otherwise break with `lost.` alone on the last line, and a
                one-word last line in a card this small reads as a truncation
                the reader is meant to do something about. */}
            <p className="text-balance text-caption text-ink-2">
              {t('atlas.card.error.body')}
            </p>
            {onRetry === undefined ? null : (
              <Button
                variant="secondary"
                size="sm"
                loading={retrying}
                loadingLabel={t('atlas.card.loading')}
                onClick={onRetry}
              >
                {t('atlas.card.error.retry')}
              </Button>
            )}
          </div>
        </div>

        <Pointer side={pointer} />
      </div>
    )
  },
)
CountryCardError.displayName = 'CountryCardError'
