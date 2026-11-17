/** One history patch owns location observation for telemetry privacy guards. */
const listeners = new Set<() => void>()
let started = false
export function watchLocation(listener: () => void): () => void {
  listeners.add(listener)
  if (!started && typeof window !== 'undefined') {
    started = true
    const notify = () => listeners.forEach((callback) => callback())
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = window.history[method]
      window.history[method] = function (
        this: History,
        ...args: Parameters<History[typeof method]>
      ) {
        original.apply(this, args)
        notify()
      }
    }
    window.addEventListener('popstate', notify)
    window.addEventListener('hashchange', notify)
  }
  return () => {
    listeners.delete(listener)
  }
}
