import {
  Anchor,
  BedDouble,
  Bike,
  Building2,
  Bus,
  Camera,
  Church,
  Coffee,
  Croissant,
  FerrisWheel,
  Flag,
  Footprints,
  GraduationCap,
  Landmark,
  MapPin,
  MoonStar,
  Mountain,
  Music,
  PartyPopper,
  Plane,
  Route,
  Ship,
  ShoppingBag,
  Snowflake,
  Store,
  Tent,
  Theater,
  Ticket,
  TrainFront,
  TreePalm,
  Trees,
  Utensils,
  Wine,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

/**
 * Category glyphs.
 *
 * A tenant's taxonomy stores an icon *name* (`categories.icon`), so the map has
 * to turn a string into a component. A curated registry rather than
 * `lucide-react`'s dynamic loader: the dynamic loader ships a chunk per icon and
 * resolves after paint, which on a map means every pin visibly pops in. This set
 * covers the seeded taxonomy plus the names a workspace is likely to reach for,
 * and anything unrecognised falls back to a pin — never to nothing.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  anchor: Anchor,
  'bed-double': BedDouble,
  bike: Bike,
  'building-2': Building2,
  bus: Bus,
  camera: Camera,
  church: Church,
  coffee: Coffee,
  croissant: Croissant,
  'ferris-wheel': FerrisWheel,
  flag: Flag,
  footprints: Footprints,
  'graduation-cap': GraduationCap,
  landmark: Landmark,
  'map-pin': MapPin,
  'moon-star': MoonStar,
  mountain: Mountain,
  music: Music,
  'party-popper': PartyPopper,
  plane: Plane,
  route: Route,
  ship: Ship,
  'shopping-bag': ShoppingBag,
  snowflake: Snowflake,
  store: Store,
  tent: Tent,
  theater: Theater,
  ticket: Ticket,
  'train-front': TrainFront,
  'tree-palm': TreePalm,
  trees: Trees,
  utensils: Utensils,
  wine: Wine,
}

/** The component for an icon name, or the pin fallback. */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (name === null || name === undefined) return MapPin
  return ICONS[name] ?? MapPin
}

export interface CategoryIconProps {
  /** `categories.icon` — a kebab-case `lucide-react` name. */
  readonly name?: string | null
  readonly size?: number
  readonly strokeWidth?: number
  readonly className?: string
}

/** Renders a taxonomy icon by name. Always renders something. */
export function CategoryIcon({
  name,
  size = 16,
  strokeWidth = 2,
  className,
}: CategoryIconProps) {
  const Icon = categoryIcon(name)
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  )
}
