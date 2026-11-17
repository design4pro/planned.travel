import { z } from 'zod'
import { MAX_TRANSACTION_BYTES, readTransaction } from './transaction'

const requestId = z.string().uuid()
const sendSchema = z
  .object({
    type: z.literal('send'),
    id: requestId,
    url: z.string().max(2048),
    body: z.string().max(MAX_TRANSACTION_BYTES),
  })
  .strict()
const cancelSchema = z
  .object({ type: z.literal('cancel'), id: requestId })
  .strict()
export const deliveryReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(false) }).strict(),
  z
    .object({
      ok: z.literal(true),
      status: z.number().int().min(200).max(599),
      rateLimits: z.string().max(8192).nullable(),
      retryAfter: z.string().max(8192).nullable(),
    })
    .strict(),
])
interface ClientIdentity {
  id: string
  url: string
}
interface WorkerEvent {
  data: unknown
  source: ClientIdentity | null
  ports: ReadonlyArray<Pick<MessagePort, 'postMessage' | 'close'>>
  waitUntil: (work: Promise<unknown>) => void
}
export interface DeliveryWorkerPorts {
  origin: string
  dsn: string | undefined
  fetch: typeof fetch
  client: (id: string) => Promise<ClientIdentity | undefined>
}

/** Only the build-configured project is a worker capability; messages cannot choose an endpoint. */
export function permitsDeliveryUrl(
  dsn: string | undefined,
  target: string,
): boolean {
  try {
    if (!dsn) return false
    const configured = new URL(dsn)
    const request = new URL(target)
    const slash = configured.pathname.lastIndexOf('/')
    const project = configured.pathname.slice(slash + 1)
    if (
      !/^\d+$/.test(project) ||
      !configured.username ||
      configured.password ||
      configured.search ||
      configured.hash
    )
      return false
    if (
      configured.protocol !== 'https:' &&
      !(configured.protocol === 'http:' && configured.hostname === '127.0.0.1')
    )
      return false
    if (
      request.origin !== configured.origin ||
      request.username ||
      request.password ||
      request.hash
    )
      return false
    if (
      request.pathname !==
      configured.pathname.slice(0, slash) + '/api/' + project + '/envelope/'
    )
      return false
    if (
      request.searchParams.get('sentry_key') !==
        decodeURIComponent(configured.username) ||
      request.searchParams.get('sentry_version') !== '7'
    )
      return false
    return [...request.searchParams.keys()].every(
      (key) =>
        ['sentry_key', 'sentry_version', 'sentry_client'].includes(key) &&
        request.searchParams.getAll(key).length === 1,
    )
  } catch {
    return false
  }
}

/** No fetch listener, credentials, storage or retry. Every request belongs to its actual source client. */
export function createDeliveryWorker(ports: DeliveryWorkerPorts) {
  const active = new Map<
    string,
    { owner: string; controller: AbortController }
  >()
  return (event: WorkerEvent): void => {
    const reply = event.ports[0]
    const cancel = cancelSchema.safeParse(event.data)
    if (cancel.success) {
      const request = active.get(
        (event.source?.id ?? '') + ':' + cancel.data.id,
      )
      try {
        if (
          request &&
          request.owner === event.source?.id &&
          new URL(event.source.url).origin === ports.origin
        )
          request.controller.abort()
      } catch {
        /* Invalid origins grant no cancellation capability. */
      }
      reply?.close()
      return
    }
    const respond = (value: unknown) => {
      try {
        reply?.postMessage(value)
      } catch {
        /* A destroyed document cannot observe its response. */
      } finally {
        reply?.close()
      }
    }
    const input = sendSchema.safeParse(event.data)
    if (!reply || !input.success || !event.source) {
      respond({ ok: false })
      return
    }
    const { id, url, body } = input.data
    const source = event.source
    const key = source.id + ':' + id
    try {
      if (
        new URL(source.url).origin !== ports.origin ||
        !permitsDeliveryUrl(ports.dsn, url)
      )
        throw new Error('Invalid sender')
      if (
        active.has(key) ||
        active.size >= 160 ||
        [...active.values()].filter((request) => request.owner === source.id)
          .length >= 40
      )
        throw new Error('Sender capacity')
    } catch {
      respond({ ok: false })
      return
    }
    // Reservation and deadline precede every asynchronous lookup, so cancellation cannot miss it.
    const controller = new AbortController()
    active.set(key, { owner: source.id, controller })
    let failAbort: () => void
    const aborted = new Promise<never>((_, reject) => {
      failAbort = () =>
        reject(new DOMException('Transaction delivery ended', 'AbortError'))
      controller.signal.addEventListener('abort', failAbort, { once: true })
    })
    const deadline = setTimeout(() => controller.abort(), 10000)
    const deliver = async () => {
      try {
        const client = await Promise.race([ports.client(source.id), aborted])
        if (
          controller.signal.aborted ||
          !client ||
          client.id !== source.id ||
          new URL(client.url).origin !== ports.origin
        )
          throw new Error('Sender disappeared')
        const transaction = readTransaction(body)
        if (!transaction || transaction.body !== body)
          throw new Error('Invalid transaction')
        const response = await Promise.race([
          ports.fetch(url, {
            method: 'POST',
            body,
            credentials: 'omit',
            redirect: 'error',
            referrerPolicy: 'strict-origin',
            keepalive: false,
            signal: controller.signal,
          }),
          aborted,
        ])
        if (
          controller.signal.aborted ||
          response.status < 200 ||
          response.status > 599
        )
          throw new Error('Delivery ended')
        respond({
          ok: true,
          status: response.status,
          rateLimits: response.headers.get('x-sentry-rate-limits'),
          retryAfter: response.headers.get('retry-after'),
        })
      } catch {
        respond({ ok: false })
      } finally {
        clearTimeout(deadline)
        controller.signal.removeEventListener('abort', failAbort)
        active.delete(key)
      }
    }
    event.waitUntil(deliver())
  }
}
