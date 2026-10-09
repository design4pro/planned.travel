// @vitest-environment jsdom
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TripWeather } from '#/lib/weather'

const loadTripWeatherFn = vi.hoisted(() => vi.fn())

vi.mock('../../-server/weather', () => ({ loadTripWeatherFn }))

const { TRIP_WEATHER_STALE_MS, tripWeatherKey, useTripWeather } =
  await import('../use-trip-weather')

const PLAN = {}

const ANSWER: TripWeather = {
  distanceUnit: 'imperial',
  days: [
    {
      dayId: 'd1',
      status: 'ok',
      reading: {
        kind: 'forecast',
        source: 'met-norway',
        tempMinC: 1,
        tempMaxC: 2,
        symbol: 'cloudy',
        precipitationMm: null,
        precipitationProbability: null,
        windMs: null,
        slots: null,
      },
    },
    { dayId: 'd2', status: 'none' },
  ],
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  loadTripWeatherFn.mockReset()
})

describe('useTripWeather', () => {
  it('is keyed by the trip and stale after fifteen minutes', () => {
    expect(tripWeatherKey('t1')).toEqual(['trip-weather', 't1'])
    expect(TRIP_WEATHER_STALE_MS).toBe(15 * 60_000)
  })

  it('says loading for every day until the answer is in, then each day’s own entry', async () => {
    let resolve: (value: TripWeather) => void = () => undefined
    loadTripWeatherFn.mockReturnValue(
      new Promise<TripWeather>((done) => {
        resolve = done
      }),
    )
    const { result } = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(newClient()),
    })

    expect(result.current.viewOf('d1')).toEqual({ status: 'loading' })
    expect(result.current.unit).toBe('metric')

    resolve(ANSWER)
    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('ok')
    })
    expect(result.current.viewOf('d2')).toEqual({ dayId: 'd2', status: 'none' })
    expect(result.current.unit).toBe('imperial')
    expect(loadTripWeatherFn).toHaveBeenCalledWith({ data: { tripId: 't1' } })
  })

  it('shows a day the answer does not mention as nothing, not as a guess', async () => {
    loadTripWeatherFn.mockResolvedValue(ANSWER)
    const { result } = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(newClient()),
    })

    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('ok')
    })
    expect(result.current.viewOf('d9')).toEqual({ dayId: 'd9', status: 'none' })
  })

  it('turns a failed request into unavailable days rather than an error', async () => {
    loadTripWeatherFn.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(newClient()),
    })

    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('unavailable')
    })
    expect(result.current.unit).toBe('metric')
  })

  it('asks once for two readers of the same trip inside the stale window', async () => {
    loadTripWeatherFn.mockResolvedValue(ANSWER)
    const client = newClient()
    const first = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(client),
    })
    await waitFor(() => {
      expect(first.result.current.viewOf('d1').status).toBe('ok')
    })

    const second = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(client),
    })

    expect(second.result.current.viewOf('d1').status).toBe('ok')
    expect(loadTripWeatherFn).toHaveBeenCalledTimes(1)
  })

  it('keeps the forecast it has when a later refetch fails', async () => {
    loadTripWeatherFn.mockResolvedValueOnce(ANSWER)
    const client = newClient()
    const { result } = renderHook(() => useTripWeather('t1', PLAN), {
      wrapper: wrapper(client),
    })
    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('ok')
    })

    loadTripWeatherFn.mockRejectedValue(new Error('offline'))
    await client.refetchQueries({ queryKey: tripWeatherKey('t1') })

    await waitFor(() => {
      expect(loadTripWeatherFn).toHaveBeenCalledTimes(2)
    })
    expect(result.current.viewOf('d1').status).toBe('ok')
    expect(result.current.unit).toBe('imperial')
  })

  it('asks again when the plan is edited, and not before', async () => {
    loadTripWeatherFn.mockResolvedValue(ANSWER)
    let plan = {}
    const { result, rerender } = renderHook(() => useTripWeather('t1', plan), {
      wrapper: wrapper(newClient()),
    })
    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('ok')
    })

    rerender()
    expect(loadTripWeatherFn).toHaveBeenCalledTimes(1)

    plan = {}
    rerender()
    await waitFor(() => {
      expect(loadTripWeatherFn).toHaveBeenCalledTimes(2)
    })
  })

  it('asks once for a stale trip the mounted screen switches to, not again for its new plan', async () => {
    const client = newClient()
    // The second trip was read before and has gone stale, so switching to it refetches in place.
    client.setQueryData(tripWeatherKey('t2'), ANSWER, {
      updatedAt: Date.now() - 2 * TRIP_WEATHER_STALE_MS,
    })
    loadTripWeatherFn.mockResolvedValue(ANSWER)
    let trip = { id: 't1', plan: {} }
    const { result, rerender } = renderHook(
      () => useTripWeather(trip.id, trip.plan),
      { wrapper: wrapper(client) },
    )
    await waitFor(() => {
      expect(result.current.viewOf('d1').status).toBe('ok')
    })

    trip = { id: 't2', plan: {} }
    rerender()
    await waitFor(() => {
      expect(loadTripWeatherFn).toHaveBeenCalledWith({ data: { tripId: 't2' } })
    })
    await client.isFetching()

    expect(loadTripWeatherFn).toHaveBeenCalledTimes(2)
  })
})
