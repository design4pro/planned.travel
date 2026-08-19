import { useCallback, useSyncExternalStore } from 'react'

/**
 * The three states a user can choose from. `system` defers to the OS, which the
 * token layer already handles in pure CSS via `prefers-color-scheme`, so the
 * `data-theme` attribute is *removed* rather than set when `system` is active.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** What the user actually sees once `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeState {
  readonly mode: ThemeMode
  readonly resolved: ResolvedTheme
}

export const THEME_STORAGE_KEY = 'planned.theme'

export const THEME_MODES: ReadonlyArray<ThemeMode> = ['light', 'dark', 'system']

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Runs in `<head>` before first paint so the correct palette is committed with
 * the very first frame — no flash of the wrong theme, no layout shift. Kept
 * deliberately tiny and dependency free; it must never throw (Safari private
 * browsing can make `localStorage` access itself throw).
 */
export const themeBootstrapScript = `(function(){try{var m=localStorage.getItem("${THEME_STORAGE_KEY}");if(m==="dark"||m==="light"){var r=document.documentElement;r.setAttribute("data-theme",m);r.style.colorScheme=m}}catch(e){}})();`

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Stable identity so `useSyncExternalStore` never loops during hydration. */
const SERVER_STATE: ThemeState = { mode: 'system', resolved: 'light' }

let state: ThemeState = SERVER_STATE
let started = false

const listeners = new Set<() => void>()

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function readStoredMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(raw) ? raw : 'system'
  } catch {
    // Storage can be unavailable (private browsing, blocked cookies).
    return 'system'
  }
}

function resolve(mode: ThemeMode): ThemeState {
  return { mode, resolved: mode === 'system' ? readSystemTheme() : mode }
}

function applyToDocument(next: ThemeState): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (next.mode === 'system') {
    root.removeAttribute('data-theme')
    root.style.colorScheme = 'light dark'
  } else {
    root.setAttribute('data-theme', next.mode)
    root.style.colorScheme = next.mode
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: ThemeState): void {
  if (next.mode === state.mode && next.resolved === state.resolved) return
  state = next
  emit()
}

function handleSystemChange(): void {
  if (state.mode !== 'system') return
  commit(resolve('system'))
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
  const next = resolve(readStoredMode())
  applyToDocument(next)
  commit(next)
}

/**
 * Idempotent client bootstrap. Called from `subscribe`, i.e. after hydration,
 * so the first client render still matches the server markup exactly.
 */
function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  state = resolve(readStoredMode())
  applyToDocument(state)
  window.matchMedia(DARK_QUERY).addEventListener('change', handleSystemChange)
  window.addEventListener('storage', handleStorage)
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  // The bootstrap may have moved us off the server snapshot.
  listener()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ThemeState {
  return state
}

function getServerSnapshot(): ThemeState {
  return SERVER_STATE
}

/** Persist and apply a theme choice. Safe to call during an event handler. */
export function setThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Preference simply will not survive a reload; the session still updates.
  }
  const next = resolve(mode)
  applyToDocument(next)
  commit(next)
}

/** Read the current theme without subscribing (useful outside React). */
export function getThemeState(): ThemeState {
  return state
}

export interface UseThemeResult extends ThemeState {
  setMode: (mode: ThemeMode) => void
  /** Flip to the opposite of what is currently on screen. */
  toggle: () => void
}

export function useTheme(): UseThemeResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode)
  }, [])

  const toggle = useCallback(() => {
    setThemeMode(getThemeState().resolved === 'dark' ? 'light' : 'dark')
  }, [])

  return { mode: snapshot.mode, resolved: snapshot.resolved, setMode, toggle }
}
