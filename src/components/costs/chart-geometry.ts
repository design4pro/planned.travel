/**
 * The arithmetic behind the costs charts, pure and free of any browser.
 *
 * Two jobs live here because they must agree: how many degrees of the ring a category
 * gets, and which whole percent the legend prints beside it. Both start from integer
 * minor units, never from a formatted string, and both keep the order of the rows they
 * are given - the caller owns the order, so a segment never jumps when a total changes.
 */
import { formatPercent } from '#/lib/format'

import type { Locale } from '#/lib/i18n'

/**
 * The least a segment may sweep, so a sliver of spend is still a visible mark.
 *
 * The gap between neighbours is a 1.5-unit stroke centred on each edge, so it covers
 * 0.75 units of the segment at both ends. At the inner radius (31 of 100) a segment
 * must be wider than that plus a pixel or so to show any fill: 5 degrees is 2.7 units.
 */
export const MIN_SWEEP_DEGREES = 5

/** The share below which a category reads `<1%` instead of a rounded `0%` or `1%`. */
const BELOW_ONE_SHARE = 0.01

export interface RingRow {
  readonly key: string
  /** Integer minor units. Anything that is not a positive finite number counts as zero. */
  readonly spentMinor: number
}

export interface RingSegment {
  readonly key: string
  /** The real share of the total, between 0 and 1 - not the allocated whole percent. */
  readonly share: number
  /** Degrees clockwise from 12 o'clock. A segment starts where the previous one ended. */
  readonly startDegrees: number
  readonly endDegrees: number
  readonly sweepDegrees: number
  /** The one segment of a ring that has a single category: a closed circle, not an arc. */
  readonly full: boolean
}

export type RingGeometry =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ring'; readonly segments: ReadonlyArray<RingSegment> }

function isSpend(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/**
 * Lays the rows out as consecutive arcs of one ring.
 *
 * The last segment ends at exactly 360 by assignment rather than by summing, so the
 * ring closes with no gap and no overlap whatever the floating point does in between.
 * A segment under `MIN_SWEEP_DEGREES` is raised to it and the others shrink together by
 * one factor, applied once, to pay for it.
 */
export function ringGeometry(rows: ReadonlyArray<RingRow>): RingGeometry {
  const spending = rows.filter((row) => isSpend(row.spentMinor))
  const total = spending.reduce((sum, row) => sum + row.spentMinor, 0)
  if (spending.length === 0 || !Number.isFinite(total) || total <= 0) {
    return { kind: 'empty' }
  }

  const shares = spending.map((row) => row.spentMinor / total)
  const raw = shares.map((share) => share * 360)
  const slivers = raw.filter((sweep) => sweep < MIN_SWEEP_DEGREES).length
  const roomy = raw.reduce(
    (sum, sweep) => (sweep < MIN_SWEEP_DEGREES ? sum : sum + sweep),
    0,
  )
  const scale = roomy > 0 ? (360 - slivers * MIN_SWEEP_DEGREES) / roomy : 1
  const sweeps = raw.map((sweep) =>
    sweep < MIN_SWEEP_DEGREES ? MIN_SWEEP_DEGREES : sweep * scale,
  )

  const last = spending.length - 1
  let cursor = 0
  const segments = spending.map((row, index): RingSegment => {
    const startDegrees = cursor
    const endDegrees = index === last ? 360 : cursor + sweeps[index]
    cursor = endDegrees
    return {
      key: row.key,
      share: shares[index],
      startDegrees,
      endDegrees,
      sweepDegrees: endDegrees - startDegrees,
      full: spending.length === 1,
    }
  })

  return { kind: 'ring', segments }
}

/** A coordinate rounded for the path string; `+ 0` turns a negative zero into zero. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000 + 0
}

/** The point at `degrees` clockwise from 12 o'clock on a circle around `(cx, cy)`. */
function pointOn(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): string {
  const radians = (degrees * Math.PI) / 180
  return `${round(cx + radius * Math.sin(radians))} ${round(cy - radius * Math.cos(radians))}`
}

/**
 * The outline of one segment as an annulus sector, to be filled.
 *
 * A single full segment cannot be one arc - its start and its end are the same point,
 * which SVG draws as nothing - so it becomes two half-turns on each edge and wants
 * `fill-rule="evenodd"` to leave the hole.
 */
export function ringPath(
  segment: RingSegment,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
): string {
  if (segment.full) {
    const circle = (radius: number, sweepFlag: 0 | 1): string =>
      `M${cx} ${round(cy - radius)} ` +
      `A${radius} ${radius} 0 1 ${sweepFlag} ${cx} ${round(cy + radius)} ` +
      `A${radius} ${radius} 0 1 ${sweepFlag} ${cx} ${round(cy - radius)} Z`
    return `${circle(outerRadius, 1)} ${circle(innerRadius, 0)}`
  }

  const large = segment.sweepDegrees > 180 ? 1 : 0
  const { startDegrees, endDegrees } = segment
  return (
    `M${pointOn(cx, cy, outerRadius, startDegrees)} ` +
    `A${outerRadius} ${outerRadius} 0 ${large} 1 ${pointOn(cx, cy, outerRadius, endDegrees)} ` +
    `L${pointOn(cx, cy, innerRadius, endDegrees)} ` +
    `A${innerRadius} ${innerRadius} 0 ${large} 0 ${pointOn(cx, cy, innerRadius, startDegrees)} Z`
  )
}

/**
 * Whole percents that add up to exactly 100, by the largest-remainder method.
 *
 * Floor every share, then hand the leftover points one each to the biggest fractional
 * parts, ties going to the earlier row. A row never reaches 100 while another row has
 * spend, so the legend cannot print "100%" beside a category that is not nothing: the
 * point goes to the next remainder instead. Leaving the whole residue on the largest row
 * would misstate it by up to `n - 1` points: eight categories at 12.5% would print 16%
 * on one. A value that is not a positive finite number gets 0.
 */
export function allocatePercents(values: ReadonlyArray<number>): Array<number> {
  const weights = values.map((value) => (isSpend(value) ? value : 0))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) {
    return weights.map(() => 0)
  }

  const exact = weights.map((weight) => (weight * 100) / total)
  const percents = exact.map((share) => Math.floor(share))
  let leftover = 100 - percents.reduce((sum, percent) => sum + percent, 0)

  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .filter(({ index }) => weights[index] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  const sharedAmongSeveral = byRemainder.length > 1
  for (const { index } of byRemainder) {
    if (leftover <= 0) {
      break
    }
    if (sharedAmongSeveral && percents[index] >= 99) {
      continue
    }
    percents[index] += 1
    leftover -= 1
  }
  return percents
}

export interface FormattedShare {
  /** True for a real share between 0 and 1%, which is read `<1%` and never `0%`. */
  readonly belowOne: boolean
  /**
   * The localised percent: the allocated whole percent, or - when `belowOne` - the
   * localised one percent that the `<{percent}` message wraps.
   */
  readonly text: string
}

/**
 * What a reader sees for one share, for the donut legend and the member list alike.
 *
 * `share` is the real ratio; `allocated` is the whole percent `allocatePercents` gave
 * the same row. `formatPercent` takes a ratio, so the integer goes in as `n / 100`.
 */
export function formatSharePercent(
  share: number,
  allocated: number,
  locale: Locale,
): FormattedShare {
  if (share > 0 && share < BELOW_ONE_SHARE) {
    return { belowOne: true, text: formatPercent(BELOW_ONE_SHARE, locale) }
  }
  return { belowOne: false, text: formatPercent(allocated / 100, locale) }
}

/** The most people the member bar names before it folds the rest into "others". */
const MEMBER_NAMES_SHOWN = 3

export interface MemberShare {
  readonly userId: string
  /** Already resolved for the reader: the viewer's "You", a removed traveller's fallback. */
  readonly name: string
  /** Integer minor units of the trip's spend this person's share covers. */
  readonly shareMinor: number
}

interface MemberSegmentBase {
  /** Integer minor units of the spend this segment stands for. */
  readonly weightMinor: number
  /** The real share of the whole, between 0 and 1 - not the allocated whole percent. */
  readonly share: number
  /** The whole percent `allocatePercents` gave this segment; the segments add up to 100. */
  readonly percent: number
}

export type MemberSegment =
  | (MemberSegmentBase & {
      readonly kind: 'member'
      readonly userId: string
      readonly name: string
    })
  | (MemberSegmentBase & {
      readonly kind: 'others'
      /** How many people the segment stands for. */
      readonly count: number
    })
  | (MemberSegmentBase & { readonly kind: 'unassigned' })

type MemberDraft<S extends MemberSegment = MemberSegment> = S extends S
  ? Omit<S, 'share' | 'percent'>
  : never

/**
 * Splits the trip's spend into the segments of the member bar.
 *
 * Widths are measured against the spend, so when the shares fall short (an expense can
 * have no participants) the gap is its own `unassigned` segment and nobody is
 * overstated. Should the shares ever exceed the spend, the sum is the whole instead.
 * A zero share is left out; past four people the top three by share keep their names
 * and the rest fold into one `others` segment, so there are at most five segments.
 * Order is share descending, ties by ascending user id, then `others`, then
 * `unassigned` - the order the bar and the list beneath it are both drawn in.
 */
export function memberSegments(
  members: ReadonlyArray<MemberShare>,
  spentMinor: number,
): Array<MemberSegment> {
  const sharing = members
    .filter((member) => isSpend(member.shareMinor))
    .sort(
      (a, b) => b.shareMinor - a.shareMinor || (a.userId < b.userId ? -1 : 1),
    )
  const shared = sharing.reduce((sum, member) => sum + member.shareMinor, 0)
  if (shared <= 0) {
    return []
  }
  const whole = isSpend(spentMinor) ? Math.max(spentMinor, shared) : shared

  // Four people are all named: an "others" row for one would take the line of a name.
  const named =
    sharing.length > MEMBER_NAMES_SHOWN + 1
      ? MEMBER_NAMES_SHOWN
      : sharing.length
  const folded = sharing.slice(named)
  const drafts: Array<MemberDraft> = sharing.slice(0, named).map((member) => ({
    kind: 'member',
    userId: member.userId,
    name: member.name,
    weightMinor: member.shareMinor,
  }))
  if (folded.length > 0) {
    drafts.push({
      kind: 'others',
      count: folded.length,
      weightMinor: folded.reduce((sum, member) => sum + member.shareMinor, 0),
    })
  }
  if (whole > shared) {
    drafts.push({ kind: 'unassigned', weightMinor: whole - shared })
  }

  const percents = allocatePercents(drafts.map((draft) => draft.weightMinor))
  return drafts.map((draft, index): MemberSegment => ({
    ...draft,
    share: draft.weightMinor / whole,
    percent: percents[index],
  }))
}
