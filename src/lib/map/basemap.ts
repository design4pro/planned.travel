/**
 * The basemap catalogue.
 *
 * A named set of cartographies a reader can pick between, and the store that
 * carries the pick from the app shell to every mounted map.
 *
 * An entry is not a style sheet: it is a handful of overrides folded into the
 * options {@link basemapStyle} already takes. `palette` of `null` means "follow
 * the resolved colour scheme", which is what separates `auto` — the map turns
 * dark when the product does — from `planned-light`, which stays paper whatever
 * the chrome is doing. Keeping the catalogue on this side of the style module
 * is why adding an entry costs a row here and nothing in `style.ts`.
 *
 * The two ids the settings screen has always written, `planned-light` and
 * `planned-dark`, are entries like any other, so every stored preference keeps
 * resolving and no migration is owed.
 */

import { useSyncExternalStore } from 'react'

import type { ResolvedTheme } from '#/lib/theme'
import type { BasemapStyleOptions } from './style'

export const BASEMAP_IDS = [
  'auto',
  'planned-light',
  'planned-dark',
  'planned-quiet',
] as const

export type BasemapId = (typeof BASEMAP_IDS)[number]

export interface BasemapEntry {
  readonly id: BasemapId
  /** `null` means "follow the resolved colour scheme". */
  readonly palette: ResolvedTheme | null
  readonly roadLabels: boolean
  readonly poiLabels: boolean
}

export const BASEMAPS: Readonly<Record<BasemapId, BasemapEntry>> = {
  auto: {
    id: 'auto',
    palette: null,
    roadLabels: true,
    poiLabels: false,
  },
  'planned-light': {
    id: 'planned-light',
    palette: 'light',
    roadLabels: true,
    poiLabels: false,
  },
  'planned-dark': {
    id: 'planned-dark',
    palette: 'dark',
    roadLabels: true,
    poiLabels: false,
  },
  'planned-quiet': {
    id: 'planned-quiet',
    palette: null,
    roadLabels: false,
    poiLabels: false,
  },
}

function isBasemapId(value: string): value is BasemapId {
  return (BASEMAP_IDS as ReadonlyArray<string>).includes(value)
}

/**
 * Style-option overrides for an entry. An unrecognised id resolves as `auto`
 * rather than throwing: ids arrive from a database column, and a row written by
 * an older or newer build must never take the map down.
 */
export function resolveBasemap(
  id: string,
  theme: ResolvedTheme,
): Pick<BasemapStyleOptions, 'theme' | 'roadLabels' | 'poiLabels'> {
  const entry = BASEMAPS[isBasemapId(id) ? id : 'auto']
  return {
    theme: entry.palette ?? theme,
    roadLabels: entry.roadLabels,
    // Returned for completeness and deliberately unread today: `MapCanvas` keeps
    // `poiLabels` on its own props, because every entry sets it to that
    // component's default and it belongs to the screen rather than the basemap.
    // The assertion on it in the unit tests is a claim about this table, not a
    // claim that the value reaches a style.
    poiLabels: entry.poiLabels,
  }
}

/** Stable identity so `useSyncExternalStore` never loops during hydration. */
const SERVER_STATE: BasemapId = 'auto'

let state: BasemapId = SERVER_STATE

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: BasemapId): void {
  if (next === state) return
  state = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): BasemapId {
  return state
}

function getServerSnapshot(): BasemapId {
  return SERVER_STATE
}

/**
 * Publish the effective basemap id, which the app shell reads off its payload.
 *
 * **Client only.** Module scope in a Cloudflare Worker isolate is shared by
 * every request that isolate serves, so writing request state here would leak
 * one reader's preference into another's response. The server keeps the
 * constant snapshot and the value arrives after hydration instead.
 */
export function publishBasemap(id: string): void {
  if (typeof window === 'undefined') return
  commit(isBasemapId(id) ? id : 'auto')
}

/** The effective basemap id, re-rendering on every change. */
export function useBasemap(): BasemapId {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
