/** The transports module's public surface. */
export { ConnectionsBadge, TransportsTimeline } from './transports-timeline'
export type { TransportsTimelineProps } from './transports-timeline'

export { LegDialog, NewLegAction } from './leg-dialog'

export {
  analyseConnections,
  formatGap,
  legArrivalAt,
  legDepartureAt,
  legTimingError,
  minimumConnectionMinutes,
  sortLegsByDeparture,
  summariseConnections,
} from './connections'
export type {
  Connection,
  ConnectionSeverity,
  ConnectionSummary,
  LegLike,
} from './connections'

export {
  MODE_LABELS,
  STATUS_LABELS as TRANSPORT_STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  emptyLegDraft,
  endpointLabels,
  hasLegErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestLegTitle,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateLegDraft,
} from './leg-form'
export type {
  DayChoice,
  EndpointLabels,
  LegDraft,
  LegErrors,
  TransportMode,
  TransportStatus,
} from './leg-form'

export { MODE_ICON, modeIcon } from './mode-icon'
export { legDurationMinutes } from './leg-timing'
export type { TransportData } from './types'
