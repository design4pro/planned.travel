/**
 * The design system's public surface.
 *
 * Every screen in the product imports from here and nowhere deeper, so a
 * primitive can be reshaped, split or rebuilt without a single import in
 * `src/routes` or `src/components/<module>` needing to change.
 *
 * Nothing in this directory fetches data or imports from `src/server` — these
 * are presentation primitives only.
 */

/* ------------------------------------------------------------------ helpers */
export * from './shared'

/* ------------------------------------------------------------------ surfaces */
export * from './card'
export * from './glass-panel'
export * from './stat-card'
export * from './separator'
export * from './scroll-area'

/* -------------------------------------------------------------------- action */
export * from './button'
export * from './icon-button'
export * from './fab'
export * from './chip'

/* --------------------------------------------------------------------- forms */
export * from './field'
export * from './input'
export * from './textarea'
export * from './select'
export * from './combobox'
export * from './checkbox'
export * from './radio-group'
export * from './switch'
export * from './slider'
export * from './calendar'
export * from './date-picker'
export * from './date-range-picker'

/* ------------------------------------------------------------------- layers */
export * from './dialog'
export * from './sheet'
export * from './popover'
export * from './tooltip'
export * from './dropdown-menu'
export * from './context-menu'
export * from './toast'

/* --------------------------------------------------------------- navigation */
export * from './tabs'
export * from './pagination'

/* ------------------------------------------------------------ data display */
export * from './table'
export * from './badge'
export * from './avatar'
export * from './avatar-stack'
export * from './sparkline'
export * from './section-label'
export * from './kbd'

/* -------------------------------------------------------------------- state */
export * from './alert'
export * from './empty-state'
export * from './progress'
export * from './skeleton'
export * from './spinner'

export { CodeInput } from './code-input'
