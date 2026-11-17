import { createDeliveryWorker } from './worker-protocol'

interface WorkerHost {
  location: { origin: string }
  clients: {
    get: (id: string) => Promise<{ id: string; url: string } | undefined>
  }
  skipWaiting: () => Promise<void>
  addEventListener: {
    (
      type: 'install',
      listener: (event: {
        waitUntil: (work: Promise<unknown>) => void
      }) => void,
    ): void
    (type: 'message', listener: ReturnType<typeof createDeliveryWorker>): void
  }
}
const host = self as unknown as WorkerHost
const receive = createDeliveryWorker({
  origin: host.location.origin,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  fetch: globalThis.fetch.bind(globalThis),
  client: (id) => host.clients.get(id),
})
host.addEventListener(
  'install',
  (event: { waitUntil: (work: Promise<unknown>) => void }) =>
    event.waitUntil(host.skipWaiting()),
)
host.addEventListener('message', receive)
