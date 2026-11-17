import { holdsSensitiveLocation } from '#/lib/sentry-scrub'

/** Auth entry matches the application's case-insensitive routes, including native URL normalization. */
export function permitsTransactionRecoveryLocation(href: string): boolean {
  try {
    const url = new URL(href)
    return (
      !holdsSensitiveLocation(href) &&
      !/^\/(?:login|register|reset-password|forgot-password|two-factor|verify-email|accept-invitation|join)(?:\/|$)/i.test(
        url.pathname,
      )
    )
  } catch {
    return false
  }
}
