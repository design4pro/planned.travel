/** The transports module's public surface. */
export { ConnectionsBadge, TransportsTimeline } from './transports-timeline'
export type { TransportsTimelineProps } from './transports-timeline'

export { TransportDialog, NewTransportAction } from './leg-dialog'

export {
  analyseConnections,
  formatGap,
  transportArrivalAt,
  transportDepartureAt,
  transportTimingError,
  minimumConnectionMinutes,
  sortTransportsByDeparture,
  summariseConnections,
} from './connections'
export type {
  Connection,
  ConnectionSeverity,
  ConnectionSummary,
  TransportLike,
} from './connections'

export {
  MODE_LABELS,
  STATUS_LABELS as TRANSPORT_STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  emptyTransportDraft,
  endpointLabels,
  hasTransportErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestTransportTitle,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateTransportDraft,
} from './leg-form'
export type {
  TransportDraft,
  TransportErrors,
  TransportMode,
  TransportStatus,
} from './leg-form'

export { MODE_ICON, modeIcon } from './mode-icon'
export { transportDurationMinutes } from './leg-timing'
export type { TransportData } from './types'
