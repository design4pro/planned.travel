import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MAP_EASE_DURATION,
  MAP_FIT_DURATION,
  MAP_FLY_DURATION,
  cameraMotion,
  prefersReducedMotion,
} from '../camera'

/** Replaces `matchMedia` with one that reports the given preference. */
function withReducedMotion(reduce: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const list: Partial<MediaQueryList> = {
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
    return list as MediaQueryList
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    withReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    withReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('cameraMotion', () => {
  it('animates at the requested duration by default', () => {
    withReducedMotion(false)
    expect(cameraMotion()).toEqual({
      animate: true,
      duration: MAP_EASE_DURATION,
    })
    expect(cameraMotion({ duration: MAP_FLY_DURATION })).toEqual({
      animate: true,
      duration: MAP_FLY_DURATION,
    })
  })

  it('collapses to a single frame under reduced motion', () => {
    withReducedMotion(true)
    expect(cameraMotion({ duration: MAP_FIT_DURATION })).toEqual({
      animate: false,
      duration: 0,
    })
  })

  it('takes an explicit override, which is what the tests of consumers use', () => {
    withReducedMotion(false)
    expect(cameraMotion({ reduced: true })).toEqual({
      animate: false,
      duration: 0,
    })
    withReducedMotion(true)
    expect(cameraMotion({ reduced: false, duration: 300 })).toEqual({
      animate: true,
      duration: 300,
    })
  })

  it('keeps every duration inside the range a map move may use', () => {
    for (const duration of [
      MAP_EASE_DURATION,
      MAP_FIT_DURATION,
      MAP_FLY_DURATION,
    ]) {
      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThanOrEqual(1000)
    }
  })
})
