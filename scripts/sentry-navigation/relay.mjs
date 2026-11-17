/** Isolated experiment only. No production import, disk queue or success-before-response. */
export function createRelayFetch(
  registration,
  {
    timeout = 5000,
    channel = () => new MessageChannel(),
    schedule = setTimeout,
    cancel = clearTimeout,
  } = {},
) {
  return async (url, options) => {
    const worker = await registration
    return new Promise((resolve, reject) => {
      const { port1, port2 } = channel()
      const finish = (error, result) => {
        cancel(timer)
        port1.close()
        port2.close()
        if (error) reject(error)
        else resolve(result)
      }
      const timer = schedule(
        () => finish(new Error('Relay response timeout')),
        timeout,
      )
      port1.onmessage = ({ data }) => {
        if (!data || typeof data !== 'object') {
          finish(new Error('Invalid relay response'))
          return
        }
        if (
          !data.error &&
          (!Number.isInteger(data.status) ||
            data.status < 200 ||
            data.status > 599)
        ) {
          finish(new Error('Invalid relay response'))
          return
        }
        if (data.error) finish(new Error('Relay request failed'))
        else
          finish(null, {
            status: data.status,
            headers: new Headers(data.headers),
          })
      }
      try {
        worker.postMessage({ url, options }, [port2])
      } catch (error) {
        finish(error)
      }
    })
  }
}

/** Register without delaying SDK initialization. Sends remain in its existing buffer. */
export async function registerRelay(script) {
  const registration = await navigator.serviceWorker.register(script)
  if (registration.active) return registration.active
  const worker = registration.installing ?? registration.waiting
  if (!worker) throw new Error('Relay worker unavailable')
  return new Promise((resolve, reject) => {
    const changed = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', changed)
        if (worker.state === 'activated') resolve(worker)
        else reject(new Error('Relay activation failed'))
      }
    }
    worker.addEventListener('statechange', changed)
    changed()
  })
}

/** The worker may contact only the experiment's owned collector. No persistent storage. */
export function relayWorkerSource(collector, shared = false) {
  const url = new URL(collector)
  if (
    url.hostname !== '127.0.0.1' ||
    url.protocol !== 'http:' ||
    url.pathname !== '/ingest'
  ) {
    throw new Error('Relay requires the owned loopback collector')
  }
  const install = shared
    ? ''
    : "self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));"
  const listen = shared
    ? "self.addEventListener('connect', connection => { const source = connection.ports[0]; source.start(); source.addEventListener('message', event => {"
    : "self.addEventListener('message', event => {"
  const wait = shared ? '(async () => {' : 'event.waitUntil((async () => {'
  const finish = shared ? '})(); }); });' : '})()); });'
  return `
${install}
${listen}
  const port = event.ports[0];
  if (!port || event.data.url !== ${JSON.stringify(collector)}) return;
  ${wait}
    try {
      const response = await fetch(event.data.url, {...event.data.options, keepalive: false});
      port.postMessage({status: response.status, headers: {
        'X-Sentry-Rate-Limits': response.headers.get('X-Sentry-Rate-Limits') ?? '',
        'Retry-After': response.headers.get('Retry-After') ?? ''
      }});
    } catch { port.postMessage({error: true}); }
    finally { port.close(); }
  ${finish}`
}
