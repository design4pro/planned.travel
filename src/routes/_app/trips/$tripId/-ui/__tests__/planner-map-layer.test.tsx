// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render as mount, screen } from '@testing-library/react'

import { MapProvider } from '#/components/map'
import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider, loadCatalogue } from '#/lib/i18n'

import type { MapContextValue, MapLibreMap } from '#/components/map'
import type { PlaceDraft } from '../plan-actions'
import type { PlannerDrop } from '../planner-map-layer'

/**
 * The drop's state machine and the listeners behind it, against a map that is only the surface the
 * layer touches: `on`/`off`, the canvas and its container, `unproject` and `getCenter`.
 *
 * What is pinned is the discipline the spec names — one MapLibre listener, every DOM listener
 * removed, a long-press measured in both time and distance, `Escape` kept from the screen — and the
 * two properties a reader would notice: a slow lookup still opens the form, and nothing arrives
 * twice.
 */

const lookup = vi.hoisted(() => ({ reverseGeocodeFn: vi.fn() }))
const toasts = vi.hoisted(() => ({ error: vi.fn() }))

vi.mock('../../-server/geocode', () => lookup)
vi.mock('sonner', () => ({ toast: toasts }))

const { PlannerMapLayer, usePlannerDrop, LOOKUP_BUDGET_MS, LONG_PRESS_MS } =
  await import('../planner-map-layer')

const MESSAGES = await loadCatalogue('en')

/* ------------------------------------------------------------------ the map */

type Handler = (event: unknown) => void

/** A coordinate as MapLibre hands one over: something with `wrap()`. */
const lngLat = (lng: number, lat: number) => ({ wrap: () => ({ lng, lat }) })

function fakeMap() {
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.tabIndex = 0
  container.appendChild(canvas)
  document.body.appendChild(container)

  const handlers = new Map<string, Handler>()
  const map = {
    on: vi.fn((type: string, handler: Handler) => handlers.set(type, handler)),
    off: vi.fn(),
    getCanvas: () => canvas,
    getCanvasContainer: () => container,
    // One pixel is a tenth of a degree, so a press's coordinate is readable in the assertion.
    unproject: ([x, y]: [number, number]) => lngLat(x / 10, y / 10),
    getCenter: () => lngLat(16.3731184, 48.2084939),
  }
  return {
    map,
    container,
    canvas,
    contextMenu: (lng: number, lat: number) => {
      const event = { lngLat: lngLat(lng, lat), preventDefault: vi.fn() }
      act(() => handlers.get('contextmenu')?.(event))
      return event
    },
  }
}

/** Enough of MapLibre's `Marker` for `MapMarker` to put the pin in the document. */
class FakeMarker {
  readonly element: HTMLElement
  constructor(options: { element: HTMLElement }) {
    this.element = options.element
  }
  setLngLat() {
    return this
  }
  addTo() {
    document.body.appendChild(this.element)
    return this
  }
  remove() {
    this.element.remove()
  }
}

function contextFor(map: ReturnType<typeof fakeMap>['map']): MapContextValue {
  return {
    map: map as unknown as MapLibreMap,
    gl: { Marker: FakeMarker } as unknown as MapContextValue['gl'],
    ready: true,
    basemap: 'available',
    engine: 'running',
    archive: null,
    theme: 'light',
    styleEpoch: 0,
    retryBasemap: () => {},
  }
}

/** A pointer event jsdom will dispatch; it has no `PointerEvent` of its own. */
function pointer(
  type: string,
  init: {
    readonly x?: number
    readonly y?: number
    readonly id?: number
    readonly pointerType?: string
  } = {},
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 100,
    clientY: init.y ?? 200,
    button: 0,
  })
  Object.defineProperties(event, {
    pointerId: { value: init.id ?? 1 },
    pointerType: { value: init.pointerType ?? 'touch' },
    isPrimary: { value: (init.id ?? 1) === 1 },
  })
  return event
}

/* ------------------------------------------------------------------ harness */

let drop: PlannerDrop
let onDropped: ReturnType<typeof vi.fn<(draft: PlaceDraft) => void>>

function Screen({
  map,
  formOpen = false,
  empty = false,
}: {
  readonly map: ReturnType<typeof fakeMap>['map']
  readonly formOpen?: boolean
  readonly empty?: boolean
}) {
  drop = usePlannerDrop({ tripId: 't1', editable: true, formOpen, onDropped })
  return (
    <MapProvider value={contextFor(map)}>
      <PlannerMapLayer drop={drop} empty={empty} />
    </MapProvider>
  )
}

function render(ui: React.ReactElement) {
  const wrap = (node: React.ReactElement) => (
    <I18nProvider locale="en" messages={MESSAGES}>
      {node}
    </I18nProvider>
  )
  const result = mount(wrap(ui))
  return {
    ...result,
    rerender: (next: React.ReactElement) => result.rerender(wrap(next)),
  }
}

/** A lookup the test settles by hand. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (cause: unknown) => void = () => {}
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.useFakeTimers()
  onDropped = vi.fn()
  lookup.reverseGeocodeFn.mockReset()
  lookup.reverseGeocodeFn.mockResolvedValue({ address: 'Stephansplatz 3' })
  toasts.error.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

/* -------------------------------------------------------------------- cases */

describe('PlannerMapLayer', () => {
  it('drops on a context-click, rounded to six places, and opens the form with the address', async () => {
    const surface = fakeMap()
    render(<Screen map={surface.map} />)

    const event = surface.contextMenu(16.37311849, 48.20849351)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(lookup.reverseGeocodeFn).toHaveBeenCalledExactlyOnceWith({
      data: { tripId: 't1', lat: 48.208494, lng: 16.373118, language: 'en' },
    })
    expect(onDropped).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        lat: '48.208494',
        lng: '16.373118',
        address: 'Stephansplatz 3',
        name: '',
      }),
    )
  })

  it('stands a named pin at the point while it looks the address up, until the form closes', async () => {
    const pending = deferred<{ address: string | null }>()
    lookup.reverseGeocodeFn.mockReturnValue(pending.promise)
    const surface = fakeMap()
    const { rerender } = render(<Screen map={surface.map} />)

    surface.contextMenu(16.37, 48.2)
    expect(screen.getByRole('img', { name: 'New place' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Finding the address…')

    await act(async () => {
      pending.resolve({ address: null })
      await vi.advanceTimersByTimeAsync(0)
    })
    rerender(<Screen map={surface.map} formOpen />)
    expect(screen.getByRole('img', { name: 'New place' })).toBeDefined()

    rerender(<Screen map={surface.map} formOpen={false} />)
    expect(screen.queryByRole('img', { name: 'New place' })).toBeNull()
  })

  it('opens the form without an address once the budget runs out, and ignores the late answer', async () => {
    const pending = deferred<{ address: string | null }>()
    lookup.reverseGeocodeFn.mockReturnValue(pending.promise)
    const surface = fakeMap()
    render(<Screen map={surface.map} />)

    surface.contextMenu(16.37, 48.2)
    await act(() => vi.advanceTimersByTimeAsync(LOOKUP_BUDGET_MS - 1))
    expect(onDropped).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onDropped).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ address: '' }),
    )

    await act(async () => {
      pending.resolve({ address: 'Too late' })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(onDropped).toHaveBeenCalledOnce()
  })

  it('ignores a second trigger while the first is still dropping', async () => {
    lookup.reverseGeocodeFn.mockReturnValue(new Promise(() => {}))
    const surface = fakeMap()
    render(<Screen map={surface.map} />)

    surface.contextMenu(16.37, 48.2)
    act(() => {
      // Android: the same long-press also reaches the recogniser.
      surface.container.dispatchEvent(pointer('pointerdown'))
      vi.advanceTimersByTime(LONG_PRESS_MS)
    })

    expect(lookup.reverseGeocodeFn).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('img', { name: 'New place' })).toHaveLength(1)
  })

  it('withdraws the pin and opens nothing when the lookup is refused', async () => {
    lookup.reverseGeocodeFn.mockRejectedValue(
      new Error(
        encodePublicFailure({
          kind: 'refusal',
          message: 'This trip is archived.',
        }),
      ),
    )
    const surface = fakeMap()
    render(<Screen map={surface.map} />)

    surface.contextMenu(16.37, 48.2)
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(onDropped).not.toHaveBeenCalled()
    expect(toasts.error).toHaveBeenCalledExactlyOnceWith(
      'This trip is archived.',
    )
    expect(screen.queryByRole('img', { name: 'New place' })).toBeNull()
  })

  describe('long-press', () => {
    it('drops after a still press of the full threshold, at the pressed point', async () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => {
        surface.container.dispatchEvent(
          pointer('pointerdown', { x: 120, y: 450 }),
        )
        vi.advanceTimersByTime(LONG_PRESS_MS - 1)
      })
      expect(lookup.reverseGeocodeFn).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(1))
      expect(lookup.reverseGeocodeFn).toHaveBeenCalledExactlyOnceWith({
        data: expect.objectContaining({ lng: 12, lat: 45 }) as unknown,
      })
    })

    it('does not drop when the finger lifts before the threshold', () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => {
        surface.container.dispatchEvent(pointer('pointerdown'))
        vi.advanceTimersByTime(LONG_PRESS_MS - 1)
        surface.container.dispatchEvent(pointer('pointerup'))
        vi.advanceTimersByTime(LONG_PRESS_MS)
      })
      expect(lookup.reverseGeocodeFn).not.toHaveBeenCalled()
    })

    it('does not drop when the press moves more than the tolerance', () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => {
        surface.container.dispatchEvent(pointer('pointerdown', { x: 100 }))
        surface.container.dispatchEvent(pointer('pointermove', { x: 111 }))
        vi.advanceTimersByTime(LONG_PRESS_MS)
      })
      expect(lookup.reverseGeocodeFn).not.toHaveBeenCalled()
    })

    it('does not drop when a second finger joins', () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => {
        surface.container.dispatchEvent(pointer('pointerdown', { id: 1 }))
        surface.container.dispatchEvent(pointer('pointerdown', { id: 2 }))
        vi.advanceTimersByTime(LONG_PRESS_MS)
      })
      expect(lookup.reverseGeocodeFn).not.toHaveBeenCalled()
    })
  })

  describe('armed', () => {
    it('shows the banner, focuses the map, and drops at the centre on Enter', async () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => drop.arm(null))
      expect(screen.getByRole('status').textContent).toContain(
        'Click the map where it goes',
      )
      expect(document.activeElement).toBe(surface.canvas)
      expect(surface.canvas.style.cursor).toBe('crosshair')

      const enter = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      act(() => surface.canvas.dispatchEvent(enter))
      await act(() => vi.advanceTimersByTimeAsync(0))

      expect(enter.defaultPrevented).toBe(true)
      expect(surface.canvas.style.cursor).toBe('')
      expect(onDropped).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ lat: '48.208494', lng: '16.373118' }),
      )
    })

    it('drops where a short click lands', () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => drop.arm(null))
      act(() => {
        surface.container.dispatchEvent(
          pointer('pointerdown', { x: 30, y: 40, pointerType: 'mouse' }),
        )
        surface.container.dispatchEvent(
          pointer('pointerup', { x: 30, y: 40, pointerType: 'mouse' }),
        )
      })

      expect(lookup.reverseGeocodeFn).toHaveBeenCalledExactlyOnceWith({
        data: expect.objectContaining({ lng: 3, lat: 4 }) as unknown,
      })
    })

    it('cancels on Escape without a write, keeps it from the screen, and returns focus', () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      act(() => drop.arm(trigger))
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      act(() => surface.canvas.dispatchEvent(escape))

      expect(escape.defaultPrevented).toBe(true)
      expect(drop.state).toBe('idle')
      expect(screen.queryByRole('status')).toBeNull()
      expect(document.activeElement).toBe(trigger)
      expect(lookup.reverseGeocodeFn).not.toHaveBeenCalled()
      expect(onDropped).not.toHaveBeenCalled()
    })

    it('leaves Escape to the screen while idle', () => {
      const surface = fakeMap()
      render(<Screen map={surface.map} />)

      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      act(() => surface.canvas.dispatchEvent(escape))
      expect(escape.defaultPrevented).toBe(false)
    })
  })

  it('names the gesture over an empty map', () => {
    const surface = fakeMap()
    render(<Screen map={surface.map} empty />)

    expect(
      screen.getByText(
        'Right-click the map, or press and hold, to add a place right there.',
      ),
    ).toBeDefined()
  })

  it('holds exactly one map listener and every DOM listener only while mounted', () => {
    const surface = fakeMap()
    const added = vi.spyOn(surface.container, 'addEventListener')
    const removed = vi.spyOn(surface.container, 'removeEventListener')
    const { unmount } = render(<Screen map={surface.map} />)

    expect(surface.map.on).toHaveBeenCalledOnce()
    expect(surface.map.on).toHaveBeenCalledWith(
      'contextmenu',
      expect.any(Function),
    )
    expect(surface.container.getAttribute('data-part')).toBe('planner-canvas')
    expect(drop.ready).toBe(true)

    unmount()

    const [, handler] = surface.map.on.mock.calls[0] ?? []
    expect(surface.map.off).toHaveBeenCalledExactlyOnceWith(
      'contextmenu',
      handler,
    )
    expect(
      removed.mock.calls.map(([type, listener]) => [type, listener]),
    ).toEqual(added.mock.calls.map(([type, listener]) => [type, listener]))
    expect(added).toHaveBeenCalledTimes(5)
    expect(surface.container.hasAttribute('data-part')).toBe(false)
  })
})
