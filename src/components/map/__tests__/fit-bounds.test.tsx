import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { MAP_FIT_DURATION } from '#/lib/map/camera'
import {
  FIT_MAX_ZOOM,
  FIT_MAX_ZOOM_UNMAPPED,
  FitBounds,
  fitMapToBounds,
} from '../fit-bounds'
import { MapProvider } from '../map-context'

import type { LngLat, MapBounds } from '#/lib/map/bounds'
import type { MapContextValue, MapLibreMap } from '../map-context'

/**
 * The opening camera, read where it reaches MapLibre.
 *
 * `bounds.test.ts`, `camera.test.ts`, `layout.test.ts` and `markers.test.tsx` already cover the
 * rectangle, the motion policy, the padding and the negative half of the re-fit memo. What none of
 * them reads is the options object `map.fitBounds` is actually handed, so a ceiling or a motion
 * decision could be dropped on the floor with every one of them still green. This file reads nothing
 * else.
 *
 * The fake is the whole of MapLibre these seams touch: a container and a canvas that measure, a
 * `resize()` and a `fitBounds()` that record their calls in order. `FitBounds` takes the map from
 * context, so it is handed straight to `MapProvider` and no module has to be mocked.
 */

interface Size {
  readonly width: number
  readonly height: number
}

interface FitOptions {
  readonly padding: unknown
  readonly maxZoom: number
  readonly animate: boolean
  readonly duration: number
}

const DESKTOP: Size = { width: 1440, height: 900 }

const KYOTO: LngLat = [135.7681, 35.0116]
const TOKYO: LngLat = [139.6917, 35.6895]
const OSAKA: LngLat = [135.5023, 34.6937]

const JAPAN: MapBounds = {
  west: 135.7681,
  south: 35.0116,
  east: 139.6917,
  north: 35.6895,
}

/** jsdom lays nothing out, so a size is stated rather than measured. */
function measure(node: HTMLElement, size: Size): void {
  Object.defineProperty(node, 'clientWidth', {
    configurable: true,
    value: size.width,
  })
  Object.defineProperty(node, 'clientHeight', {
    configurable: true,
    value: size.height,
  })
}

class FakeMap {
  readonly container = document.createElement('div')
  readonly canvas = document.createElement('canvas')
  /** Every call that can move the camera or its transform, in the order it happened. */
  readonly calls: Array<'resize' | 'fitBounds'> = []
  readonly fits: Array<{ bounds: unknown; options: FitOptions }> = []

  constructor(container: Size, canvas: Size = container) {
    measure(this.container, container)
    measure(this.canvas, canvas)
  }

  getContainer(): HTMLElement {
    return this.container
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  resize(): this {
    this.calls.push('resize')
    return this
  }

  fitBounds(bounds: unknown, options: FitOptions): this {
    this.calls.push('fitBounds')
    this.fits.push({ bounds, options })
    return this
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap
  }
}

/** Answers `prefers-reduced-motion` the way the reader has set it, for the length of one test. */
function preferReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
    }),
  })
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')

afterEach(() => {
  if (originalMatchMedia === undefined) {
    Reflect.deleteProperty(window, 'matchMedia')
  } else {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia)
  }
})

function lastFit(map: FakeMap): FitOptions {
  const fit = map.fits.at(-1)
  if (fit === undefined) throw new Error('the map was never asked to fit')
  return fit.options
}

describe('fitMapToBounds — the zoom ceiling', () => {
  it('keeps the two ceilings the planner frames against', () => {
    // A street when the tiles are there; a coastline window when only the bundled ground is.
    expect(FIT_MAX_ZOOM).toBe(15)
    expect(FIT_MAX_ZOOM_UNMAPPED).toBe(6)
  })

  it('hands MapLibre FIT_MAX_ZOOM when the caller names no ceiling', () => {
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN)
    expect(lastFit(map).maxZoom).toBe(FIT_MAX_ZOOM)
  })

  it('passes a caller ceiling through unchanged, which is how the planner sends the unmapped cap', () => {
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN, { maxZoom: FIT_MAX_ZOOM_UNMAPPED })
    expect(lastFit(map).maxZoom).toBe(FIT_MAX_ZOOM_UNMAPPED)
  })
})

describe('fitMapToBounds — the motion decision', () => {
  it('eases over MAP_FIT_DURATION when the reader has not asked for less movement', () => {
    preferReducedMotion(false)
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN)
    expect(lastFit(map)).toMatchObject({
      animate: true,
      duration: MAP_FIT_DURATION,
    })
  })

  it('lands in one frame under prefers-reduced-motion', () => {
    preferReducedMotion(true)
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN)
    expect(lastFit(map)).toMatchObject({ animate: false, duration: 0 })
  })

  it('lets an explicit animate: false from the caller win over an unreduced preference', () => {
    preferReducedMotion(false)
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN, { animate: false })
    expect(lastFit(map).animate).toBe(false)
  })
})

describe('fitMapToBounds — a canvas with no area', () => {
  it.each([
    ['no width', { width: 0, height: 900 }],
    ['no height', { width: 1440, height: 0 }],
  ])('defers rather than fitting when the container has %s', (_, size) => {
    const map = new FakeMap(size)
    fitMapToBounds(map.asMap(), JAPAN)
    expect(map.calls).toEqual([])
  })

  it('resizes the map before fitting when its canvas still holds the previous size', () => {
    const map = new FakeMap(DESKTOP, { width: 1280, height: 900 })
    fitMapToBounds(map.asMap(), JAPAN)
    expect(map.calls).toEqual(['resize', 'fitBounds'])
  })

  it('does not resize when the canvas and the container already agree', () => {
    const map = new FakeMap(DESKTOP)
    fitMapToBounds(map.asMap(), JAPAN)
    expect(map.calls).toEqual(['fitBounds'])
  })
})

describe('FitBounds — when the camera is framed again', () => {
  function onMap(map: FakeMap) {
    const value: MapContextValue = {
      map: map.asMap(),
      gl: null,
      ready: true,
      basemap: 'available',
      engine: 'running',
      archive: null,
      theme: 'light',
      styleEpoch: 0,
      retryBasemap: () => {},
    }
    return (props: { points: ReadonlyArray<LngLat>; fitKey?: string }) => (
      <MapProvider value={value}>
        <FitBounds points={props.points} fitKey={props.fitKey} />
      </MapProvider>
    )
  }

  it('fits once more when the points become a genuinely different set', () => {
    const map = new FakeMap(DESKTOP)
    const View = onMap(map)
    const { rerender } = render(<View points={[KYOTO, TOKYO]} />)
    expect(map.fits).toHaveLength(1)

    rerender(<View points={[KYOTO, OSAKA]} />)
    expect(map.fits).toHaveLength(2)
    expect(map.fits[1]?.bounds).not.toEqual(map.fits[0]?.bounds)
  })

  it('fits once more when fitKey changes over an unchanged set', () => {
    const map = new FakeMap(DESKTOP)
    const View = onMap(map)
    const { rerender } = render(
      <View points={[KYOTO, TOKYO]} fitKey="rails-open" />,
    )
    expect(map.fits).toHaveLength(1)

    rerender(<View points={[KYOTO, TOKYO]} fitKey="rails-folded" />)
    expect(map.fits).toHaveLength(2)
    expect(map.fits[1]?.bounds).toEqual(map.fits[0]?.bounds)
  })
})
