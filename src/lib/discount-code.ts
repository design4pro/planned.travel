/**
 * The shape of a promotion code, shared by the billing screen and the server that resolves it, so
 * a code the field accepts is never one the server function's validator refuses.
 */

/** Codes are letters and digits; the cap bounds what we forward to a paged lookup. */
export const DISCOUNT_CODE_PATTERN = /^[A-Za-z0-9]{3,64}$/
