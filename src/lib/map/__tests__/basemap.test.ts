import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  BASEMAP_IDS,
  BASEMAPS,
  publishBasemap,
  resolveBasemap,
  useBasemap,
} from '../basemap'

import type { ResolvedTheme } from '#/lib/theme'

/**
 * The catalogue is a table, so what is worth checking is not its shape — the
 * compiler has that — but the promises the table makes: that a stored id keeps
 * resolving, that an entry with a fixed palette ignores the chrome around it,
 * and that the store hands the same id to every map exactly once per change.
 */

const THEMES: readonly ResolvedTheme[] = ['light', 'dark']

/** The store is module scope, so each test starts from the server snapshot. */
beforeEach(() => {
  publishBasemap('auto')
})

describe('the catalogue', () => {
  it('lists every id once and keys each entry by its own id', () => {
    expect(new Set(BASEMAP_IDS).size).toBe(BASEMAP_IDS.length)
    for (const id of BASEMAP_IDS) {
      expect(BASEMAPS[id].id).toBe(id)
    }
  })

  /**
   * The two ids `/settings/appearance` has written since it shipped. They must
   * keep resolving: that is the whole of the "no migration" claim, and a stored
   * row that stopped resolving would silently reset a reader's preference.
   */
  it('still resolves the two ids already stored in the database', () => {
    expect(resolveBasemap('planned-light', 'dark').theme).toBe('light')
    expect(resolveBasemap('planned-dark', 'light').theme).toBe('dark')
  })
})

describe('resolveBasemap', () => {
  it('follows the resolved theme for `auto`', () => {
    for (const theme of THEMES) {
      expect(resolveBasemap('auto', theme)).toEqual({
        theme,
        roadLabels: true,
        poiLabels: false,
      })
    }
  })

  /** The point of naming these beside `Automatic`: they pin the palette. */
  it('pins the palette for `planned-light` and `planned-dark` under both themes', () => {
    for (const theme of THEMES) {
      expect(resolveBasemap('planned-light', theme).theme).toBe('light')
      expect(resolveBasemap('planned-dark', theme).theme).toBe('dark')
    }
  })

  it('drops road labels for `planned-quiet` but keeps following the theme', () => {
    for (const theme of THEMES) {
      expect(resolveBasemap('planned-quiet', theme)).toEqual({
        theme,
        roadLabels: false,
        poiLabels: false,
      })
    }
  })

  it('resolves an unrecognised id as `auto` rather than throwing', () => {
    for (const theme of THEMES) {
      expect(resolveBasemap('planned-neon', theme)).toEqual(
        resolveBasemap('auto', theme),
      )
    }
  })
})

describe('the store', () => {
  it('re-renders once per distinct change and not at all for a repeat', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useBasemap()
    })

    expect(result.current).toBe('auto')
    const mounted = renders

    act(() => {
      publishBasemap('planned-quiet')
    })
    expect(result.current).toBe('planned-quiet')
    expect(renders).toBe(mounted + 1)

    act(() => {
      publishBasemap('planned-quiet')
    })
    expect(renders).toBe(mounted + 1)
  })

  it('narrows an unrecognised published id to `auto`', () => {
    const { result } = renderHook(() => useBasemap())

    act(() => {
      publishBasemap('planned-dark')
    })
    expect(result.current).toBe('planned-dark')

    act(() => {
      publishBasemap('planned-neon')
    })
    expect(result.current).toBe('auto')
  })
})
