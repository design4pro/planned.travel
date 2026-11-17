import { makeFetchTransport } from '@sentry/react'
import workerScript from './worker.ts?worker&url'
import { holdsSensitiveLocation } from '#/lib/sentry-scrub'
import { watchLocation } from '#/lib/location-watch'
import {
  subscribeWorkspaceClaim,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'
import {
  DELIVERY_SCOPE_META,
  subscribeTransactionScope,
  retireTransactionRecovery,
  transactionDocumentLeaving,
} from './control'
import { createRecoveryTransport } from './recovery'
import { createWorkerSender } from './sender'
import type { TransportOptions } from './transaction'

function eligibleLocation(): boolean {
  return (
    !holdsSensitiveLocation(window.location.href) &&
    !/^\/(?:login|register|reset-password|forgot-password|two-factor|verify-email|join)(?:\/|$)/.test(
      window.location.pathname,
    )
  )
}

/** Called synchronously by Sentry's client constructor before fetch instrumentation is installed. */
export function makeNavigationTransport(options: TransportOptions) {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    options.tunnel ||
    options.headers ||
    options.fetchOptions
  )
    return makeFetchTransport(options)
  const nativeFetch = window.fetch.bind(window)
  let storage: Storage | null = null
  try {
    storage = window.sessionStorage
  } catch {
    /* The recovery module exposes native-only admission. */
  }
  const endpoint = new URL(options.url)
  const project =
    endpoint.origin +
    endpoint.pathname +
    '|' +
    (import.meta.env.VITE_SENTRY_RELEASE ?? '')
  const bootstrap =
    document.querySelector<HTMLMetaElement>(
      `meta[name="${DELIVERY_SCOPE_META}"]`,
    )?.content ?? null
  const sender = createWorkerSender(
    navigator.serviceWorker,
    workerScript,
    options.url,
    window.location.origin,
    () =>
      !transactionDocumentLeaving() &&
      eligibleLocation() &&
      !workspaceClaimState().switching &&
      !workspaceClaimState().stale,
  )
  const recovery = createRecoveryTransport(options, {
    storage,
    scope: eligibleLocation() ? bootstrap : null,
    project,
    ...sender,
    nativeFetch,
    leaving: transactionDocumentLeaving,
    eligible: () =>
      eligibleLocation() &&
      !workspaceClaimState().switching &&
      !workspaceClaimState().stale,
  })
  const reconcileLocation = () => {
    if (!eligibleLocation()) retireTransactionRecovery()
  }
  watchLocation(reconcileLocation)
  subscribeTransactionScope((event) => {
    const current = workspaceClaimState()
    if (
      event.type === 'retire' ||
      !eligibleLocation() ||
      current.switching ||
      current.stale
    )
      recovery.retire()
    else recovery.confirmScope(event.scope)
  })
  subscribeWorkspaceClaim(() => {
    const current = workspaceClaimState()
    if (current.switching || current.stale) retireTransactionRecovery()
  })
  return recovery.transport
}
