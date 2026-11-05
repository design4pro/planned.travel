import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { DayRoutes, ROUTE_LAYER_IDS } from '../day-routes'
import { EMPTY_ROUTES, routeCollection } from '#/lib/map/routes'

const harness = vi.hoisted(() => {
  const source = { setData: vi.fn() }
  const map = {
    getSource: vi.fn(() => source),
    getLayer: vi.fn(() => ({})),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    setPaintProperty: vi.fn(),
  }
  return { source, map }
})

vi.mock('../map-context', () => ({
  useMapContext: () => ({
    map: harness.map,
    ready: true,
    styleEpoch: 0,
    theme: 'light',
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('sends separate stretches to MapLibre and emphasises them by their shared Day', () => {
  const days = [
    {
      dayNumber: 1,
      points: [
        [10, 1],
        [10, 2],
      ] as const,
    },
    {
      dayNumber: 1,
      points: [
        [10, 3],
        [10, 4],
      ] as const,
    },
    {
      dayNumber: 2,
      points: [
        [10, 5],
        [10, 6],
      ] as const,
    },
  ]
  const { rerender } = render(<DayRoutes days={days} activeDay={1} />)
  expect(harness.source.setData).toHaveBeenLastCalledWith(routeCollection(days))
  expect(harness.map.setPaintProperty).toHaveBeenCalledWith(
    ROUTE_LAYER_IDS.line,
    'line-opacity',
    ['case', ['==', ['get', 'day'], 1], 0.9, 0.9 * 0.26],
  )
  rerender(<DayRoutes days={days} activeDay={2} visible={false} />)
  expect(harness.source.setData).toHaveBeenLastCalledWith(EMPTY_ROUTES)
  expect(harness.map.setPaintProperty).toHaveBeenLastCalledWith(
    ROUTE_LAYER_IDS.line,
    'line-opacity',
    ['case', ['==', ['get', 'day'], 2], 0.9, 0.9 * 0.26],
  )
  rerender(<DayRoutes days={days} activeDay={null} />)
  expect(harness.source.setData).toHaveBeenLastCalledWith(routeCollection(days))
  expect(harness.map.setPaintProperty).toHaveBeenLastCalledWith(
    ROUTE_LAYER_IDS.line,
    'line-opacity',
    0.9,
  )
})
