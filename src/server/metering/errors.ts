/**
 * The one error the metering layer raises.
 *
 * Deliberately not a queue error class. A refused provider means something different at each call
 * site — a PDF falls back to print markup, an email has no fallback at all and must dead-letter,
 * and billing may never be refused — so the class carries the facts and each caller decides what
 * its own user sees. Making it a `TaskPermanentError` here would decide that for all three, and two
 * of the three answers would be wrong.
 */

import type { MeteredProvider, ProviderLimitWindow } from '#/server/db/types'

/** Raised *before* the outbound call, when a blocking ceiling is spent. */
export class ProviderBlockedError extends Error {
  readonly provider: MeteredProvider
  readonly operation: string
  readonly callLimit: number
  readonly used: number
  readonly limitWindow: ProviderLimitWindow

  constructor(detail: {
    readonly provider: MeteredProvider
    readonly operation: string
    readonly callLimit: number
    readonly used: number
    readonly limitWindow: ProviderLimitWindow
  }) {
    super(
      `Provider '${detail.provider}' is over its ${detail.limitWindow} ceiling of ${detail.callLimit} calls (${detail.used} used) and its policy is to block.`,
    )
    this.name = 'ProviderBlockedError'
    this.provider = detail.provider
    this.operation = detail.operation
    this.callLimit = detail.callLimit
    this.used = detail.used
    this.limitWindow = detail.limitWindow
  }
}

/** Narrows an unknown rejection to the block, for a caller deciding on its own fallback. */
export function isProviderBlockedError(
  cause: unknown,
): cause is ProviderBlockedError {
  return cause instanceof ProviderBlockedError
}
