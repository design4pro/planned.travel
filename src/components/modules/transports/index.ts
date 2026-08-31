/** The transports module's public surface. */
export { ConnectionsBadge, TransportsTimeline } from './transports-timeline'
export type { TransportsTimelineProps } from './transports-timeline'

export { LegDialog, NewLegAction } from './leg-dialog'

export { ChainEditor } from './chain-editor'
export type { ChainEditorProps } from './chain-editor'

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
  CHAIN_MAX_LEGS,
  MODE_LABELS,
  STATUS_LABELS as TRANSPORT_STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  applyStationMatch,
  blockingLegErrors,
  breakIntoLegs,
  chainFromTransport,
  chainPayload,
  emptyChain,
  emptyChainLeg,
  emptyLegDraft,
  emptyStation,
  endpointLabels,
  fillStationFromCode,
  flatChain,
  hasChainErrors,
  hasLegErrors,
  isLookupCode,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  removeStationAt,
  splitLegAt,
  stationLabel,
  suggestLegTitle,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateChain,
  validateLegDraft,
} from './leg-form'
export type {
  ChainDraft,
  ChainErrors,
  ChainLegDraft,
  ChainLegErrors,
  ChainLegPayload,
  ChainOwnedField,
  ChainPayload,
  ChainStationPayload,
  DayChoice,
  EndpointLabels,
  LegDraft,
  LegErrors,
  StationDraft,
  StationErrors,
  StationLookup,
  TransportMode,
  TransportStatus,
} from './leg-form'

export { MODE_ICON, modeIcon } from './mode-icon'
export { legDurationMinutes } from './leg-timing'
export type { TransportData, TransportDayData, TransportLegData } from './types'
