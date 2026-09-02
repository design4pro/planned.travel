/**
 * The one place a domain status becomes a colour.
 *
 * Keeping the mapping here means "confirmed" is the same green on the bookings
 * screen, in a trip card and in the itinerary rail — and that a new status can
 * never quietly fall back to grey in one screen and to red in another.
 */
import type { MessageKey } from '#/lib/i18n'

import {
  BedDouble,
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Coins,
  ReceiptText,
  Ship,
  ShieldCheck,
  ShoppingBag,
  Footprints,
  PlaneTakeoff,
  Route,
  Ticket,
  Train,
  TramFront,
  TrainFront,
  Utensils,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import type { BadgeTone } from '#/components/ui'

/** Every trip status, in the order a trip moves through them. */
export const TRIP_STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  planning: 'info',
  booked: 'brand',
  active: 'success',
  completed: 'outline',
  archived: 'neutral',
}

/**
 * The one place a trip status becomes a word.
 *
 * The sibling of `TRIP_STATUS_TONE`, and here for the same reason: the trips
 * index, the tile and the dashboard all showed the status by running the stored
 * column through `humaniseToken()`, which turns `booked` into `Booked` and is
 * therefore English on all twenty-three screens. The six words already existed
 * in `shell.tripStatus.*`; nothing was reading them.
 */
export const TRIP_STATUS_LABEL: Record<string, MessageKey> = {
  draft: 'shell.tripStatus.draft',
  planning: 'shell.tripStatus.planning',
  booked: 'shell.tripStatus.booked',
  active: 'shell.tripStatus.active',
  completed: 'shell.tripStatus.completed',
  archived: 'shell.tripStatus.archived',
}

export const RESERVATION_STATUS_TONE: Record<string, BadgeTone> = {
  none: 'outline',
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'neutral',
}

export const TRANSPORT_STATUS_TONE: Record<string, BadgeTone> = {
  idea: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'outline',
}

export const COLLECTION_STATUS_TONE: Record<string, BadgeTone> = {
  idea: 'neutral',
  shortlisted: 'info',
  planned: 'brand',
  visited: 'success',
  rejected: 'danger',
}

export const JOURNEY_STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'outline',
}

export const VACAY_KIND_TONE: Record<string, BadgeTone> = {
  vacation: 'brand',
  half_day: 'info',
  sick: 'danger',
  remote: 'neutral',
  holiday: 'warning',
  other: 'outline',
}

export function toneFor(
  map: Record<string, BadgeTone>,
  status: string,
): BadgeTone {
  return map[status] ?? 'neutral'
}

/** Transport modes get a glyph rather than a colour — twelve tones would be noise. */
export const TRANSPORT_MODE_ICON: Record<string, LucideIcon> = {
  walk: Footprints,
  bike: Bike,
  car: Car,
  taxi: CarTaxiFront,
  transit: TrainFront,
  bus: Bus,
  train: Train,
  tram: TramFront,
  metro: TrainFront,
  ferry: Ship,
  flight: PlaneTakeoff,
  other: Route,
}

export function transportIcon(mode: string): LucideIcon {
  return TRANSPORT_MODE_ICON[mode] ?? Route
}

/**
 * An expense's category, as a glyph and a tint.
 *
 * An expense row has no image to carry it, so the leading chip is the only thing
 * that tells a reader what kind of spend they are looking at before they read the
 * words. One shared glyph for every category is worse than none: a bank fee drawn
 * with a fork and knife is actively misleading. Every tint pairs a `-soft` ground
 * with its own hue as ink, which the token set holds at 5.3–5.6:1.
 */
export const EXPENSE_CATEGORY_ICON: Record<string, LucideIcon> = {
  accommodation: BedDouble,
  transport: TrainFront,
  food: Utensils,
  activities: Ticket,
  shopping: ShoppingBag,
  fees: ReceiptText,
  insurance: ShieldCheck,
  other: Coins,
}

export const EXPENSE_CATEGORY_TINT: Record<string, string> = {
  accommodation: 'bg-info-soft text-info',
  transport: 'bg-brand-subtle text-brand',
  food: 'bg-warning-soft text-warning',
  activities: 'bg-success-soft text-success',
  shopping: 'bg-danger-soft text-danger',
  fees: 'bg-surface-inset text-ink-3',
  insurance: 'bg-info-soft text-info',
  other: 'bg-surface-inset text-ink-3',
}

export function expenseIcon(category: string): LucideIcon {
  return EXPENSE_CATEGORY_ICON[category] ?? Coins
}

export function expenseTint(category: string): string {
  return EXPENSE_CATEGORY_TINT[category] ?? 'bg-surface-inset text-ink-3'
}

/** Ordered swatch classes for category and label chips, so colours stay stable. */
export const CATEGORY_SWATCHES: ReadonlyArray<string> = [
  'bg-brand',
  'bg-info',
  'bg-warning',
  'bg-success',
  'bg-danger',
  'bg-ink-3',
]

export function swatchFor(index: number): string {
  return CATEGORY_SWATCHES[index % CATEGORY_SWATCHES.length] ?? 'bg-ink-3'
}

/* ------------------------------------------------------- ink on a data colour */

/** `#4f8` / `#44ff88` / `#44ff88cc` → `[68, 255, 136]`. `null` for anything else. */
function parseHex(colour: string): [number, number, number] | null {
  const hex = colour.trim().replace(/^#/, '')
  const full =
    hex.length === 3 || hex.length === 4
      ? [...hex.slice(0, 3)].map((char) => char + char).join('')
      : hex.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null
  }
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

/** sRGB relative luminance, per WCAG 2.2 §Relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * The readable ink to set on a colour that came from tenant data.
 *
 * A traveller's colour, a category's colour and a map pin's colour are stored
 * once and are the same in both themes, so pairing them with a theme-flipping
 * token gets it wrong in one of the two: `text-brand-on` over a stored `#2F6F5E`
 * is white in light (5.4:1, fine) and near-black in dark (3.21:1, a fail). The
 * swatch itself is the only honest input, so this measures it.
 *
 * The threshold is the exact crossover for our two fixed inks, so this always
 * returns whichever of them contrasts better. Ordinary swatches land at 5.5–8:1;
 * a swatch sitting right on the crossover can only reach 4.08:1, which is the
 * ceiling for *any* two-ink scheme over an arbitrary colour — the way past it is
 * to constrain the colours a tenant may pick, not to pick a third ink.
 */
const INK_CROSSOVER = 0.1924

export function inkOn(colour: string | null | undefined): string {
  const rgb = colour === null || colour === undefined ? null : parseHex(colour)
  if (rgb === null) {
    return 'var(--color-on-dark)'
  }
  return luminance(rgb) > INK_CROSSOVER
    ? 'var(--color-on-light)'
    : 'var(--color-on-dark)'
}
