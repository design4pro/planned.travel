/** The transports module's public surface. */
export { ConnectionsBadge, TransportsTimeline } from './transports-timeline'
export type { TransportsTimelineProps } from './transports-timeline'

export { TransportDialog, NewTransportAction } from './leg-dialog'

export { ChainEditor } from './chain-editor'
export type { ChainEditorProps } from './chain-editor'

export {
  ConnectionSearch,
  chainFor as chainForConnection,
  connectionMode,
  journeyLegs,
  placeOf,
  rankConnections,
  refusalBody,
  refusalTitle,
} from './connection-search'
export type {
  ConnectionRefusal,
  ConnectionSearchProps,
} from './connection-search'

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
  applyStationMatch,
  applyTypedCodeMatch,
  blockingLegErrors,
  breakIntoLegs,
  chainFromTransport,
  chainPayload,
  emptyChain,
  emptyChainLeg,
  emptyTransportDraft,
  emptyStation,
  endpointLabels,
  fillStationFromCode,
  flatChain,
  hasChainErrors,
  hasTransportErrors,
  isLookupCode,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  removeStationAt,
  splitLegAt,
  stationLabel,
  suggestTransportTitle,
  transportStatusLabel,
  updateStationByKey,
  usesCodes,
  usesSeat,
  usesService,
  validateChain,
  validateTransportDraft,
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
  FlatEndpoints,
  TransportDraft,
  TransportErrors,
  StationDraft,
  StationErrors,
  StationLookup,
  TransportMode,
  TransportStatus,
} from './leg-form'

export { MODE_ICON, modeIcon } from './mode-icon'
export { transportDurationMinutes, legElapsedMinutes } from './leg-timing'
export type { TransportData, TransportDayData, TransportLegData } from './types'
