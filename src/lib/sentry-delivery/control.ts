/** This controller imports no SDK/server code; auth mutations can retire it before their effects. */
export type DeliveryScopeEvent =
  { type: 'retire' } | { type: 'fresh'; scope: string | null }
const listeners = new Set<(event: DeliveryScopeEvent) => void>()
let channel: BroadcastChannel | undefined
let started = false
let leaving = false
let generation = 0
let mutations = 0

export const DELIVERY_SCOPE_META = 'sentry-delivery-scope'
export const DELIVERY_LEAVING_KEY = '__plannedDeliveryLeaving'
/** Installed in head before asynchronous client modules can miss beforeunload. */
export const deliveryBootstrapScript = `(function(){window.${DELIVERY_LEAVING_KEY}=false;addEventListener('beforeunload',function(){window.${DELIVERY_LEAVING_KEY}=true})})();`

export function transactionDocumentLeaving(): boolean {
  if (typeof window === 'undefined') return true
  const bootstrap = window as Window & { __plannedDeliveryLeaving?: boolean }
  return leaving || bootstrap.__plannedDeliveryLeaving === true
}
export function retireTransactionRecovery(broadcast = true): void {
  if (typeof window === 'undefined') return
  generation += 1
  listeners.forEach((listener) => listener({ type: 'retire' }))
  if (broadcast) {
    try {
      channel?.postMessage({ type: 'retire' })
    } catch {
      /* No data travels in invalidation. */
    }
  }
}
export function transactionScopeGeneration(): number {
  return generation
}
/** Only an explicit fresh server result, never an unchanged meta value, can reactivate a scope. */
export function confirmTransactionDeliveryScope(
  scope: string | null,
  expectedGeneration: number,
): void {
  if (typeof window === 'undefined') return
  if (mutations > 0 || generation !== expectedGeneration) return
  listeners.forEach((listener) => listener({ type: 'fresh', scope }))
}
export function subscribeTransactionScope(
  listener: (event: DeliveryScopeEvent) => void,
): () => void {
  listeners.add(listener)
  if (!started && typeof window !== 'undefined') {
    started = true
    window.addEventListener('beforeunload', () => {
      leaving = true
    })
    window.addEventListener('pageshow', (event) => {
      leaving = false
      ;(
        window as Window & { __plannedDeliveryLeaving?: boolean }
      ).__plannedDeliveryLeaving = false
      if (event.persisted) retireTransactionRecovery()
    })
  }
  if (
    !channel &&
    typeof window !== 'undefined' &&
    typeof BroadcastChannel !== 'undefined'
  ) {
    try {
      channel = new BroadcastChannel('planned.sentry.delivery.v1')
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'retire')
          retireTransactionRecovery(false)
      }
    } catch {
      /* Fresh document scope comparison remains mandatory without cross-tab signals. */
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      channel?.close()
      channel = undefined
    }
  }
}

/** Neither an in-flight identity read nor an unknown mutation outcome can reopen the old scope. */
export async function withTransactionRecoveryRetired<T>(
  action: () => Promise<T>,
): Promise<T> {
  if (typeof window === 'undefined') return action()
  mutations += 1
  retireTransactionRecovery()
  try {
    return await action()
  } finally {
    mutations -= 1
    retireTransactionRecovery()
  }
}
/** Shared by SDK auth and the explicit raw sign-out/account-security paths. */
export function identityMutationFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase()
  const execute = () => fetch(input, init)
  return method === 'GET' || method === 'HEAD'
    ? execute()
    : withTransactionRecoveryRetired(execute)
}
