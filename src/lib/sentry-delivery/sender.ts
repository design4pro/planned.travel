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

/** Registration owns no request acknowledgement; callers persist before awaiting ready. */
export function createWorkerSender(
  container: WorkerContainer,
  script: string,
  endpoint: string,
  origin: string,
) {
  let worker: WorkerReference | null = null
  let registration: Promise<void> | undefined
  const ready = (): Promise<void> => {
    if (worker?.state === 'activated') return Promise.resolve()
    if (registration) return registration
    registration = (async () => {
      const url = new URL(script, origin)
      if (url.origin !== origin) throw new Error('Foreign transaction worker')
      const scope = new URL('./sentry-delivery/', url).pathname
      const result = await container.register(url.href, {
        type: 'module',
        scope,
        updateViaCache: 'none',
      })
      const candidate = result.installing ?? result.waiting ?? result.active
      if (!candidate) throw new Error('Transaction worker unavailable')
      if (candidate.state !== 'activated')
        await new Promise<void>((resolve, reject) => {
          const changed = () => {
            if (
              candidate.state !== 'activated' &&
              candidate.state !== 'redundant'
            )
              return
            candidate.removeEventListener('statechange', changed)
            if (candidate.state === 'activated') resolve()
            else reject(new Error('Transaction worker activation failed'))
          }
          candidate.addEventListener('statechange', changed)
          changed()
        })
      worker = candidate
    })().finally(() => {
      registration = undefined
    })
    return registration
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
  return { ready, send }
}
