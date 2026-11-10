import { useSyncExternalStore } from 'react'

import type { Preference } from './local-preference'

export const WIDE_LAYOUT_STORAGE_KEY = 'planned.wide-layout'

// Constant application code: stored text is compared, never evaluated or interpolated.
export const wideLayoutBootstrapScript = `(function(){try{document.documentElement.toggleAttribute("data-wide-layout",localStorage.getItem("${WIDE_LAYOUT_STORAGE_KEY}")==="true")}catch(e){}})();`

let started = false
const listeners = new Set<() => void>()

function apply(enabled: boolean): void {
  document.documentElement.toggleAttribute('data-wide-layout', enabled)
}

function stored(): boolean {
  try {
    return window.localStorage.getItem(WIDE_LAYOUT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  apply(stored())
  window.addEventListener('storage', onStorage)
}

function read(): boolean {
  start()
  return (
    typeof document !== 'undefined' &&
    document.documentElement.hasAttribute('data-wide-layout')
  )
}

function emit(): void {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== WIDE_LAYOUT_STORAGE_KEY) return
  try {
    if (event.storageArea !== window.localStorage) return
  } catch {
    return
  }
  apply(stored())
  emit()
}

/** The document is the live snapshot, so denied writes still work for this page. */
export const wideLayoutPreference: Preference<boolean> = {
  key: WIDE_LAYOUT_STORAGE_KEY,
  area: 'local',
  fallback: false,
  read,
  write(enabled) {
    start()
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WIDE_LAYOUT_STORAGE_KEY, String(enabled))
    } catch {
      // Persistence is optional; the current page must still switch reversibly.
    }
    apply(enabled)
    emit()
  },
  subscribe(listener) {
    start()
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Hydrating markup stays off; CSS already uses the prepaint document state. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(wideLayoutPreference.subscribe, read, () => false)
}
