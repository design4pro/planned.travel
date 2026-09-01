/**
 * Furniture shared by the module screens: the controls every row needs, the
 * typeset-data primitives, and the two hooks that make a write feel instant
 * without letting the screen disagree with the server.
 */
export { FactList, FactNote } from './facts'
export type { FactItem, FactListProps } from './facts'

export { ConfirmDialog, CopyValue, RowMenu, StatusMenu } from './controls'
export type { ConfirmRequest, RowMenuItem, StatusOption } from './controls'

export { MASK_CHARACTER, MaskedCode, maskCode } from './masked-code'
export type { MaskedCodeProps } from './masked-code'

export { ModulePanel, ModuleRow, FilterRow } from './panel'
export type { ModulePanelProps } from './panel'

export { NOT_SET, fromSelectValue, toSelectValue } from './optional-select'

export { messageOf, useAction } from './use-action'
export type { Action, ActionOptions } from './use-action'

export {
  emptyOptimistic,
  isSettling,
  moveItem,
  optimisticReducer,
} from './optimistic'
export type {
  OptimisticAction,
  OptimisticClaim,
  OptimisticState,
} from './optimistic'

export { useOptimistic } from './use-optimistic'
export type { OptimisticOverlay } from './use-optimistic'
