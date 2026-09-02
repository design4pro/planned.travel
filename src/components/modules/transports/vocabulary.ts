/**
 * What a transport mode and a leg status are called.
 *
 * Its own file because two callers need it and one of them already imports the
 * other: `leg-form.ts` reads `legTimingError` out of `connections.ts`, and
 * `connections.ts` needs a mode's label to say how long a hand-over usually
 * takes. Everything here is a message key, so the file carries no English.
 */
import type { MessageKey } from '#/lib/i18n'

export const TRANSPORT_MODES = [
  'flight',
  'train',
  'bus',
  'ferry',
  'car',
  'taxi',
  'transit',
  'metro',
  'tram',
  'bike',
  'walk',
  'other',
] as const

export type TransportMode = (typeof TRANSPORT_MODES)[number]

export const TRANSPORT_STATUSES = [
  'idea',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const

export type TransportStatus = (typeof TRANSPORT_STATUSES)[number]

export function isTransportMode(value: string): value is TransportMode {
  return (TRANSPORT_MODES as ReadonlyArray<string>).includes(value)
}

export function isTransportStatus(value: string): value is TransportStatus {
  return (TRANSPORT_STATUSES as ReadonlyArray<string>).includes(value)
}

export const MODE_LABELS: { readonly [K in TransportMode]: MessageKey } = {
  flight: 'modules.transports.mode.flight',
  train: 'modules.transports.mode.train',
  bus: 'modules.transports.mode.bus',
  ferry: 'modules.transports.mode.ferry',
  car: 'modules.transports.mode.car',
  taxi: 'modules.transports.mode.taxi',
  transit: 'modules.transports.mode.transit',
  metro: 'modules.transports.mode.metro',
  tram: 'modules.transports.mode.tram',
  bike: 'modules.transports.mode.bike',
  walk: 'modules.transports.mode.walk',
  other: 'modules.transports.mode.other',
}

export function modeLabel(mode: string): MessageKey {
  return isTransportMode(mode)
    ? MODE_LABELS[mode]
    : 'modules.transports.mode.fallback'
}

export const STATUS_LABELS: { readonly [K in TransportStatus]: MessageKey } = {
  idea: 'modules.transports.status.idea',
  pending: 'modules.transports.status.pending',
  confirmed: 'modules.transports.status.confirmed',
  completed: 'modules.transports.status.completed',
  cancelled: 'modules.transports.status.cancelled',
}

export function transportStatusLabel(status: string): MessageKey {
  return isTransportStatus(status)
    ? STATUS_LABELS[status]
    : 'modules.transports.mode.fallback'
}
