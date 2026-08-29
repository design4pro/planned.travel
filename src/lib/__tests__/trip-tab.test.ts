import { beforeEach, describe, expect, it } from 'vitest'

import { TRIP_TABS } from '#/components/layout/nav-model'
import {
  DEFAULT_TRIP_TAB,
  TRIP_TAB_IDS,
  TRIP_TAB_PREFERENCE,
  TRIP_TAB_ROUTES,
  isTripTabId,
  readRememberedTripTab,
  rememberTripTab,
} from '../trip-tab'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('the tab vocabulary', () => {
  /**
   * The assertion that fails if someone adds an eighth tab without revisiting
   * this module: the strip and the memory have to name the same seven routes,
   * or a remembered tab is a redirect to a route that does not exist.
   */
  it('names exactly the tabs the sub-navigation renders, in the same order', () => {
    expect(TRIP_TAB_IDS).toHaveLength(7)
    expect([...TRIP_TAB_IDS]).toEqual(TRIP_TABS.map((tab) => tab.id))
  })

  it('routes every tab id to the path the sub-navigation links to', () => {
    expect(TRIP_TAB_IDS.map((id) => TRIP_TAB_ROUTES[id])).toEqual(
      TRIP_TABS.map((tab) => tab.to),
    )
  })

  it('opens on the plan by default', () => {
    expect(DEFAULT_TRIP_TAB).toBe('plan')
    expect(TRIP_TAB_IDS[0]).toBe('plan')
  })

  it('refuses an id it does not know', () => {
    expect(isTripTabId('costs')).toBe(true)
    expect(isTripTabId('weather')).toBe(false)
    expect(isTripTabId(undefined)).toBe(false)
  })
})

describe('the trip-tab preference', () => {
  /**
   * The assertion that fails if the lifetime is changed without changing the
   * plan: `TRP-07` asks for the tab to be *persisted*, and a session area would
   * throw the memory away with the tab that made it.
   */
  it('is declared local, keyed and bounded', () => {
    expect(TRIP_TAB_PREFERENCE.key).toBe('planned.trip-tab')
    expect(TRIP_TAB_PREFERENCE.area).toBe('local')
    expect(TRIP_TAB_PREFERENCE.limit).toBe(24)
    expect(TRIP_TAB_PREFERENCE.fallback).toBe(DEFAULT_TRIP_TAB)
  })

  it('remembers a tab per trip', () => {
    rememberTripTab('trip-1', 'costs')
    rememberTripTab('trip-2', 'files')

    expect(readRememberedTripTab('trip-1')).toBe('costs')
    expect(readRememberedTripTab('trip-2')).toBe('files')
    expect(readRememberedTripTab('trip-3')).toBe(DEFAULT_TRIP_TAB)
  })

  /**
   * A tab that is renamed or withdrawn must not strand a reader on a dead
   * route: the stored id fails the guard and reads as absent.
   */
  it('resolves an unknown stored tab id to the plan', () => {
    window.localStorage.setItem(
      'planned.trip-tab',
      JSON.stringify({ v: 1, entries: [['trip-1', 'weather']] }),
    )
    expect(readRememberedTripTab('trip-1')).toBe('plan')
  })

  it('keeps at most twenty-four trips', () => {
    for (let index = 0; index < 25; index += 1) {
      rememberTripTab(`trip-${index}`, 'costs')
    }
    expect(readRememberedTripTab('trip-24')).toBe('costs')
    expect(readRememberedTripTab('trip-0')).toBe(DEFAULT_TRIP_TAB)
  })
})
