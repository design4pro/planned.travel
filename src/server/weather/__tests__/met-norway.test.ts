/**
 * The MET Norway client against a recorded answer.
 *
 * What the provider's terms bind us to is checked at the request, because that is the only place it
 * can be seen: a coordinate with more than four decimals is answered with 403 and an anonymous
 * request is refused, so both are properties of the URL and the headers rather than of any screen.
 * Nothing here touches the network; `fetch` is a parameter.
 */
import { describe, expect, it } from 'vitest'

import {
  MET_NORWAY_ENDPOINT,
  MET_NORWAY_USER_AGENT,
  createMetNorwayClient,
} from '../met-norway'
import { WeatherProviderError } from '../weather'
import { OSLO_FORECAST_DETAIL } from './locationforecast-detail.fixture'
import { OSLO_FORECAST } from './locationforecast.fixture'

interface Sent {
  readonly url: string
  readonly headers: Record<string, string>
}

function answer(
  body: unknown,
  init: ResponseInit = {},
): { fetch: typeof fetch; sent: Array<Sent> } {
  const sent: Array<Sent> = []
  const fake = (input: string, options?: RequestInit): Promise<Response> => {
    sent.push({
      url: input,
      headers: Object.fromEntries(
        Object.entries(options?.headers ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          String(v),
        ]),
      ),
    })
    return Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200,
        ...init,
      }),
    )
  }
  return { fetch: fake as unknown as typeof fetch, sent }
}

const INIT = { signal: new AbortController().signal }

describe('the MET Norway client', () => {
  it('asks for a point cut to four decimals, with an identifying agent and no encoding of its own', async () => {
    const { fetch, sent } = answer(OSLO_FORECAST)

    await createMetNorwayClient({ fetch }).forecast(
      59.913_912_345,
      10.752_249_99,
      INIT,
    )

    expect(sent).toHaveLength(1)
    const url = new URL(sent[0].url)
    expect(`${url.origin}${url.pathname}`).toBe(MET_NORWAY_ENDPOINT)
    expect(url.searchParams.get('lat')).toBe('59.9139')
    expect(url.searchParams.get('lon')).toBe('10.7522')
    expect(sent[0].headers['user-agent']).toBe(MET_NORWAY_USER_AGENT)
    expect(MET_NORWAY_USER_AGENT).toMatch(
      /^planned\.travel\/\S+ \(\+https:\/\//,
    )
    // The Workers runtime negotiates compression on every outbound fetch; setting it by hand is
    // how a body ends up compressed twice.
    expect(sent[0].headers).not.toHaveProperty('accept-encoding')
  })

  it('never carries more than four decimals, whatever the coordinate', async () => {
    const { fetch, sent } = answer(OSLO_FORECAST)
    const client = createMetNorwayClient({ fetch })

    for (const [lat, lng] of [
      [0.000_049, -0.000_049],
      [-33.868_820_1, 151.209_295_5],
      [89.999_999_9, -179.999_999_9],
      [12, -7],
    ] as const) {
      await client.forecast(lat, lng, INIT)
    }

    for (const { url } of sent) {
      const { searchParams } = new URL(url)
      for (const name of ['lat', 'lon']) {
        const value = searchParams.get(name) ?? ''
        expect(value, `${name} in ${url}`).toMatch(/^-?\d+(\.\d{1,4})?$/)
        expect(value).not.toBe('-0')
        expect(value).not.toBe('-0.0000')
      }
    }
  })

  it('reads the steps off the recorded answer, and the expiry off the header', async () => {
    const { fetch } = answer(OSLO_FORECAST, {
      headers: { Expires: 'Thu, 08 Oct 2026 19:29:27 GMT' },
    })

    const result = await createMetNorwayClient({ fetch }).forecast(
      59.9139,
      10.7522,
      INIT,
    )

    expect(result.expires?.toISOString()).toBe('2026-10-08T19:29:27.000Z')
    expect(result.series).toHaveLength(
      OSLO_FORECAST.properties.timeseries.length,
    )
    expect(result.series[0]).toEqual({
      time: '2026-10-08T18:00:00Z',
      tempC: 7.5,
      // The six-hour summary wins over the one-hour one, with its day/night suffix removed.
      symbol: 'partlycloudy',
      // This recording was trimmed to temperatures and symbols: no wind, no amounts.
      windMs: null,
      precipitationMm: null,
      precipitationProbability: null,
    })
    // The last step carries no summary at all, which is a symbol-less step rather than a bad one.
    expect(result.series.at(-1)).toEqual({
      time: '2026-10-18T18:00:00Z',
      tempC: 9.6,
      symbol: null,
      windMs: null,
      precipitationMm: null,
      precipitationProbability: null,
    })
  })

  it('reports no expiry when the header is absent or unreadable', async () => {
    const absent = await createMetNorwayClient(answer(OSLO_FORECAST)).forecast(
      59.9,
      10.7,
      INIT,
    )
    const garbled = await createMetNorwayClient(
      answer(OSLO_FORECAST, { headers: { Expires: 'next Tuesday' } }),
    ).forecast(59.9, 10.7, INIT)

    expect(absent.expires).toBeNull()
    expect(garbled.expires).toBeNull()
  })

  it('drops a step that has no temperature instead of inventing one', async () => {
    const { fetch } = answer({
      properties: {
        timeseries: [
          { time: '2026-10-08T18:00:00Z', data: { instant: { details: {} } } },
          {
            time: '2026-10-08T19:00:00Z',
            data: { instant: { details: { air_temperature: 3 } } },
          },
        ],
      },
    })

    const result = await createMetNorwayClient({ fetch }).forecast(1, 2, INIT)

    expect(result.series).toEqual([
      {
        time: '2026-10-08T19:00:00Z',
        tempC: 3,
        symbol: null,
        windMs: null,
        precipitationMm: null,
        precipitationProbability: null,
      },
    ])
  })

  describe('the fuller reading', () => {
    const forecast = async (body: unknown) =>
      (await createMetNorwayClient(answer(body)).forecast(1, 2, INIT)).series

    it('reads the wind off every step', async () => {
      const series = await forecast(OSLO_FORECAST_DETAIL)

      expect(series[0].windMs).toBe(0.7)
      expect(series[1].windMs).toBe(1.5)
    })

    it('takes the hourly amount where a step has one, and never adds the overlapping six-hourly one', async () => {
      const series = await forecast(OSLO_FORECAST_DETAIL)
      const wire = OSLO_FORECAST_DETAIL.properties.timeseries
      // A step carrying both, with different amounts, so that reading the wrong one shows.
      const index = wire.findIndex((step) => {
        const hour = step.data.next_1_hours?.details.precipitation_amount
        const six = step.data.next_6_hours?.details.precipitation_amount
        return hour !== undefined && six !== undefined && hour !== six
      })

      expect(index).toBeGreaterThanOrEqual(0)
      expect(series[index].precipitationMm).toBe(
        wire[index].data.next_1_hours?.details.precipitation_amount,
      )
    })

    it('takes the six-hourly amount where the step has no hourly one', async () => {
      const series = await forecast(OSLO_FORECAST_DETAIL)
      const index = OSLO_FORECAST_DETAIL.properties.timeseries.findIndex(
        (step) => !('next_1_hours' in step.data) && 'next_6_hours' in step.data,
      )

      expect(index).toBeGreaterThan(0)
      expect(series[index].precipitationMm).toBe(
        OSLO_FORECAST_DETAIL.properties.timeseries[index].data.next_6_hours
          ?.details.precipitation_amount,
      )
    })

    it('has no amount for the last step, which has nothing after it', async () => {
      expect((await forecast(OSLO_FORECAST_DETAIL)).at(-1)).toMatchObject({
        precipitationMm: null,
        precipitationProbability: null,
      })
    })

    it('has no chance of rain from the compact product, which does not send one', async () => {
      const series = await forecast(OSLO_FORECAST_DETAIL)

      expect(
        series.every((step) => step.precipitationProbability === null),
      ).toBe(true)
    })

    it('carries the chance of rain when a summary states one', async () => {
      const [step] = await forecast({
        properties: {
          timeseries: [
            {
              time: '2026-10-08T19:00:00Z',
              data: {
                instant: { details: { air_temperature: 3 } },
                next_6_hours: {
                  summary: { symbol_code: 'rain' },
                  details: {
                    precipitation_amount: 2.5,
                    probability_of_precipitation: 70,
                  },
                },
              },
            },
          ],
        },
      })

      expect(step).toMatchObject({
        precipitationMm: 2.5,
        precipitationProbability: 70,
      })
    })
  })

  it.each([
    ['a refusal', { status: 403 }],
    ['a throttle', { status: 429 }],
    ['a server error', { status: 503 }],
  ])(
    'throws a typed error for %s, quoting neither the URL nor the body',
    async (_, init) => {
      const { fetch } = answer('secret body', init)

      const failure = await createMetNorwayClient({ fetch })
        .forecast(59.9139, 10.7522, INIT)
        .catch((cause: unknown) => cause)

      expect(failure).toBeInstanceOf(WeatherProviderError)
      expect((failure as Error).message).toContain(String(init.status))
      expect((failure as Error).message).not.toContain('59.9139')
      expect((failure as Error).message).not.toContain('secret body')
    },
  )

  it('throws a typed error for an answer it cannot read', async () => {
    for (const body of ['<html>', '{}', '{"properties":{"timeseries":"no"}}']) {
      const failure = await createMetNorwayClient(answer(body))
        .forecast(1, 2, INIT)
        .catch((cause: unknown) => cause)
      expect(failure, body).toBeInstanceOf(WeatherProviderError)
    }
  })

  it('lets a transport failure surface as a typed error too', async () => {
    const failing = (() => Promise.reject(new TypeError('offline'))) as never

    const failure = await createMetNorwayClient({ fetch: failing })
      .forecast(1, 2, INIT)
      .catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(WeatherProviderError)
  })
})
