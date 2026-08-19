/**
 * One glyph per travel mode, defined once.
 *
 * Twelve modes would be twelve tones of noise, so the mode is carried by a glyph
 * and the *status* keeps the colour. A bus drawn as a generic arrow is worse than
 * no glyph at all, which is why every mode has its own.
 */
import {
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  PlaneTakeoff,
  Route,
  Ship,
  Train,
  TrainFront,
  TramFront,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import type { TransportMode } from './leg-form'

export const MODE_ICON: { readonly [K in TransportMode]: LucideIcon } = {
  flight: PlaneTakeoff,
  train: Train,
  bus: Bus,
  ferry: Ship,
  car: Car,
  taxi: CarTaxiFront,
  transit: TrainFront,
  metro: TrainFront,
  tram: TramFront,
  bike: Bike,
  walk: Footprints,
  other: Route,
}

export function modeIcon(mode: string): LucideIcon {
  return (MODE_ICON as Record<string, LucideIcon>)[mode] ?? Route
}
