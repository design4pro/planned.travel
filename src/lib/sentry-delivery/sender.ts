import { deliveryReplySchema } from './worker-protocol'
import type { DeliverySender } from './recovery'

interface WorkerReference {
  readonly state: string
  postMessage: (data: unknown, transfer: Transferable[]) => void
  addEventListener: (type: 'statechange', listener: () => void) => void
  removeEventListener: (type: 'statechange', listener: () => void) => void
}
interface WorkerContainer {
  register: (
    url: string,
    options: { type: 'module'; scope: string; updateViaCache: 'none' },
  ) => Promise<{
    active: WorkerReference | null
    installing: WorkerReference | null
    waiting: WorkerReference | null
  }>
}

/** Empty initialization carries no payload; admission still precedes every dispatch. */
export function createWorkerSender(
  container: WorkerContainer,
  script: string,
  endpoint: string,
  origin: string,
  mayRegister: () => boolean = () => true,
) {
  let worker: WorkerReference | null = null
  let registration: Promise<void> | undefined
  let initialization: AbortController | undefined
  const initializing = () => registration !== undefined
  const activated = () => worker?.state === 'activated'
  const cancelInitialization = () => initialization?.abort()
  const ready = (): Promise<void> => {
    if (activated()) return Promise.resolve()
    if (registration) return registration
    if (!mayRegister())
      return Promise.reject(new Error('Transaction registration deferred'))
    const controller = new AbortController()
    initialization = controller
    let cleanup = () => {}
    let deadline: ReturnType<typeof setTimeout>
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => reject(new Error('Transaction activation ended')),
        { once: true },
      )
      deadline = setTimeout(() => controller.abort(), 10000)
    })
    const initialize = async () => {
      const url = new URL(script, origin)
      if (url.origin !== origin) throw new Error('Foreign transaction worker')
      const scope = new URL('./sentry-delivery/', url).pathname
      // No await separates this final departure check from register, including a retry.
      if (controller.signal.aborted || !mayRegister())
        throw new Error('Transaction registration deferred')
      const result = await container.register(url.href, {
        type: 'module',
        scope,
        updateViaCache: 'none',
      })
      if (controller.signal.aborted)
        throw new Error('Transaction activation ended')
      const candidate = result.installing ?? result.waiting ?? result.active
      if (!candidate) throw new Error('Transaction worker unavailable')
      if (candidate.state !== 'activated')
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            const changed = () => {
              if (
                candidate.state !== 'activated' &&
                candidate.state !== 'redundant'
              )
                return
              cleanup()
              if (candidate.state === 'activated') resolve()
              else reject(new Error('Transaction worker activation failed'))
            }
            cleanup = () =>
              candidate.removeEventListener('statechange', changed)
            candidate.addEventListener('statechange', changed)
            changed()
          }),
          aborted,
        ])
      if (controller.signal.aborted)
        throw new Error('Transaction activation ended')
      worker = candidate
    }
    const pending = Promise.race([initialize(), aborted]).finally(() => {
      clearTimeout(deadline)
      cleanup()
      if (initialization === controller) initialization = undefined
      if (registration === pending) registration = undefined
    })
    registration = pending
    return pending
  }
  const send: DeliverySender = (id, body, signal) =>
    new Promise((resolve, reject) => {
      const active = worker
      if (!active || active.state !== 'activated' || signal.aborted) {
        reject(new Error('Transaction worker unavailable'))
        return
      }
      const channel = new MessageChannel()
      let settled = false
      const finish = (error: Error | null, response?: Response) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', abort)
        active.removeEventListener('statechange', changed)
        channel.port1.close()
        channel.port2.close()
        if (error) reject(error)
        else if (response) resolve(response)
      }
      const abort = () => {
        try {
          active.postMessage({ type: 'cancel', id }, [])
        } catch {
          /* A redundant worker cannot own a new request. */
        }
        finish(new DOMException('Transaction request aborted', 'AbortError'))
      }
      const changed = () => {
        if (active.state === 'redundant') abort()
      }
      signal.addEventListener('abort', abort, { once: true })
      active.addEventListener('statechange', changed)
      channel.port1.onmessageerror = () =>
        finish(new Error('Invalid transaction response'))
      channel.port1.onmessage = (event) => {
        const parsed = deliveryReplySchema.safeParse(event.data)
        if (!parsed.success || !parsed.data.ok) {
          finish(new Error('Transaction worker request failed'))
          return
        }
        try {
          const response = parsed.data
          const headers = new Headers()
          if (response.rateLimits !== null)
            headers.set('x-sentry-rate-limits', response.rateLimits)
          if (response.retryAfter !== null)
            headers.set('retry-after', response.retryAfter)
          finish(null, new Response(null, { status: response.status, headers }))
        } catch {
          finish(new Error('Invalid transaction response headers'))
        }
      }
      try {
        active.postMessage({ type: 'send', id, url: endpoint, body }, [
          channel.port2,
        ])
      } catch {
        finish(new Error('Transaction worker dispatch failed'))
      }
    })
  return { ready, send, activated, initializing, cancelInitialization }
}
