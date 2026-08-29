import { useCallback, useSyncExternalStore } from 'react'

/**
 * Browser preferences: the small choices that belong to a visitor's browser
 * rather than to their account — which tab of a trip they left open, how wide
 * they dragged a rail, which widgets they folded away.
 *
 * Two factories and no free-floating getters, so no caller reaches a storage
 * object directly and every declaration states three things the module then
 * enforces: a namespaced key, a **required** storage `area`, and a guard that
 * turns a raw string back into the caller's own type. A defaulted lifetime
 * would be a product decision nobody took, so there is no default.
 *
 * Two rules hold for every consumer:
 *
 * 1. **A stored preference is never the sole source of a layout-affecting first
 *    paint.** `read()` answers with the fallback when there is no `window`, and
 *    both hooks hand `useSyncExternalStore` a `getServerSnapshot` that returns
 *    the same fallback, so the server HTML and the hydrating client agree byte
 *    for byte and the stored value arrives in the commit after. That gap is
 *    invisible for a preference that moves no box and visible for one that
 *    does; each consumer states how it satisfies the rule.
 * 2. **Storage never breaks a page.** Every read and every write is wrapped:
 *    reaching `localStorage` at all throws in Safari private browsing, and a
 *    preference is not worth a white screen. A value that fails `parse` is
 *    treated as absent.
 */

/** How long a preference lives. Required per declaration; there is no default. */
export type PreferenceArea = 'local' | 'session'

/**
 * The stamp on a keyed record. A payload that does not carry the current one is
 * discarded whole rather than migrated: a preference is cheap to lose and
 * expensive to guess at.
 */
const RECORD_VERSION = 1

interface PreferenceSpec<T> {
  readonly key: `planned.${string}`
  readonly area: PreferenceArea
  readonly fallback: T
  /**
   * The caller's own guard over the raw string the module stored, which is
   * always `JSON.stringify` of the value it was handed — a keyed record holds
   * its entries as JSON and hands each one back the same way. `undefined`
   * refuses the stored value, which then reads as absent, and so does a guard
   * that throws: neither is worth a white screen.
   */
  readonly parse: (raw: string) => T | undefined
}

export interface Preference<T> {
  readonly key: string
  readonly area: PreferenceArea
  readonly fallback: T
  read: () => T
  write: (next: T) => void
  subscribe: (listener: () => void) => () => void
}

export interface KeyedPreference<T> {
  readonly key: string
  readonly area: PreferenceArea
  readonly fallback: T
  /** How many owners the single record keeps, most recently touched first. */
  readonly limit: number
  read: (ownerId: string) => T
  write: (ownerId: string, next: T) => void
  subscribe: (listener: () => void) => () => void
}

function storageFor(area: PreferenceArea): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return area === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    // Reaching the object at all can throw when storage is blocked.
    return null
  }
}

function readRaw(area: PreferenceArea, key: string): string | null {
  const storage = storageFor(area)
  if (storage === null) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(area: PreferenceArea, key: string, raw: string): void {
  const storage = storageFor(area)
  if (storage === null) return
  try {
    storage.setItem(key, raw)
  } catch {
    // Quota, private browsing, a blocked origin: the preference simply will not
    // survive the reload. The session still updates.
  }
}

/**
 * The subscriber set, plus the single cross-tab listener a `local` preference
 * owns. `session` storage is per tab by construction, so it never has one — the
 * `storage` event does not exist for it, and attaching a listener that could
 * never fire would be a lie about how the two areas differ.
 */
function createNotifier(area: PreferenceArea, key: string) {
  const listeners = new Set<() => void>()
  let detach: (() => void) | null = null

  const onStorage = (event: StorageEvent): void => {
    // `null` is a whole-store clear, which takes this key with it.
    if (event.key !== null && event.key !== key) return
    for (const listener of listeners) listener()
  }

  return {
    emit(): void {
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      if (
        area === 'local' &&
        detach === null &&
        typeof window !== 'undefined'
      ) {
        window.addEventListener('storage', onStorage)
        detach = () => {
          window.removeEventListener('storage', onStorage)
        }
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && detach !== null) {
          detach()
          detach = null
        }
      }
    },
  }
}

export function definePreference<T>(spec: PreferenceSpec<T>): Preference<T> {
  const { key, area, fallback, parse } = spec
  const notifier = createNotifier(area, key)

  /**
   * `useSyncExternalStore` compares snapshots by identity and re-renders in a
   * loop when a fresh object comes back from an unchanged store, so the parsed
   * value is memoised against the exact string it was parsed from.
   */
  let cachedRaw: string | null = null
  let cachedValue: T = fallback
  let cached = false

  function read(): T {
    const raw = readRaw(area, key)
    if (cached && raw === cachedRaw) return cachedValue
    cachedRaw = raw
    cached = true
    cachedValue = fallback
    if (raw !== null) {
      try {
        const parsed = parse(raw)
        if (parsed !== undefined) cachedValue = parsed
      } catch {
        // A guard that throws is a refusal like any other.
      }
    }
    return cachedValue
  }

  function write(next: T): void {
    writeRaw(area, key, JSON.stringify(next))
    // The `storage` event never fires in the tab that wrote, so this tab's own
    // subscribers are told directly.
    notifier.emit()
  }

  return { key, area, fallback, read, write, subscribe: notifier.subscribe }
}

interface KeyedPreferenceSpec<T> extends PreferenceSpec<T> {
  readonly limit: number
}

type StoredEntry = readonly [string, unknown]

/**
 * The record every keyed preference holds under its single key. One key per
 * owner would grow without bound and nothing would ever collect it — a
 * workspace with four hundred trips leaves four hundred dead keys behind. This
 * is self-pruning and its worst case is a few hundred bytes.
 */
function decodeEntries(raw: string): Array<StoredEntry> | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null
  }
  const record = payload as { v?: unknown; entries?: unknown }
  if (record.v !== RECORD_VERSION || !Array.isArray(record.entries)) return null
  const entries: Array<StoredEntry> = []
  for (const entry of record.entries as Array<unknown>) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [ownerId, value] = entry as [unknown, unknown]
    if (typeof ownerId !== 'string') continue
    entries.push([ownerId, value])
  }
  return entries
}

export function defineKeyedPreference<T>(
  spec: KeyedPreferenceSpec<T>,
): KeyedPreference<T> {
  const { key, area, fallback, limit, parse } = spec
  const notifier = createNotifier(area, key)

  let cachedRaw: string | null = null
  let cachedEntries: Array<StoredEntry> = []
  let cachedValues = new Map<string, T>()
  let cached = false

  /** Re-decode only when the stored string is not the one already decoded. */
  function sync(): void {
    const raw = readRaw(area, key)
    if (cached && raw === cachedRaw) return
    cachedRaw = raw
    cached = true
    cachedEntries = raw === null ? [] : (decodeEntries(raw) ?? [])
    cachedValues = new Map()
    for (const [ownerId, value] of cachedEntries) {
      try {
        const parsed = parse(JSON.stringify(value))
        if (parsed !== undefined) cachedValues.set(ownerId, parsed)
      } catch {
        // A guard that throws is a refusal like any other.
      }
    }
  }

  function read(ownerId: string): T {
    sync()
    const hit = cachedValues.get(ownerId)
    return hit === undefined ? fallback : hit
  }

  function write(ownerId: string, next: T): void {
    sync()
    // Most recently touched first, truncated at the limit, so what the ceiling
    // drops is always the entry nobody has come back to — never the one this
    // call just wrote.
    const entries: Array<StoredEntry> = [
      [ownerId, next] as StoredEntry,
      ...cachedEntries.filter(([id]) => id !== ownerId),
    ].slice(0, limit)
    writeRaw(area, key, JSON.stringify({ v: RECORD_VERSION, entries }))
    notifier.emit()
  }

  return {
    key,
    area,
    fallback,
    limit,
    read,
    write,
    subscribe: notifier.subscribe,
  }
}

export function useLocalPreference<T>(
  pref: Preference<T>,
): readonly [T, (next: T) => void] {
  const getServerSnapshot = useCallback(() => pref.fallback, [pref])
  const value = useSyncExternalStore(
    pref.subscribe,
    pref.read,
    getServerSnapshot,
  )
  const write = useCallback(
    (next: T) => {
      pref.write(next)
    },
    [pref],
  )
  return [value, write] as const
}

export function useKeyedPreference<T>(
  pref: KeyedPreference<T>,
  ownerId: string,
): readonly [T, (next: T) => void] {
  const getSnapshot = useCallback(() => pref.read(ownerId), [pref, ownerId])
  const getServerSnapshot = useCallback(() => pref.fallback, [pref])
  const value = useSyncExternalStore(
    pref.subscribe,
    getSnapshot,
    getServerSnapshot,
  )
  const write = useCallback(
    (next: T) => {
      pref.write(ownerId, next)
    },
    [pref, ownerId],
  )
  return [value, write] as const
}
