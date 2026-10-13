/**
 * The NASA POWER client against a recorded answer.
 *
 * The request is where the disclosure rule is kept - the provider is given a coordinate cut to one
 * decimal and a date range, and nothing else - and the answer is where the provider's own way of
 * saying "nothing here" is turned into an absent field. Nothing here touches the network; `fetch`
 * is a parameter.
 */
import { describe, expect, it } from 'vitest'

import {
  NASA_POWER_CLIMATOLOGY_ENDPOINT,
  NASA_POWER_ENDPOINT,
  POWER_LAG_DAYS,
  createNasaPowerClient,
} from '../nasa-power'
import { WeatherProviderError } from '../weather'
import { OSLO_CLIMATOLOGY } from './nasa-power-climatology.fixture'
import { OSLO_DAILY } from './nasa-power.fixture'

function answer(
  body: unknown,
  init: ResponseInit = {},
): { fetch: typeof fetch; urls: Array<string>; headers: Array<Headers> } {
  const urls: Array<string> = []
  const headers: Array<Headers> = []
  const fake = (input: string, options?: RequestInit): Promise<Response> => {
    urls.push(input)
    headers.push(new Headers(options?.headers))
    return Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200,
        ...init,
      }),
    )
  }
  return { fetch: fake as unknown as typeof fetch, urls, headers }
}

const INIT = { signal: new AbortController().signal }
const RANGE = { start: '2026-10-01', end: '2026-10-12' }

describe('the NASA POWER client', () => {
  it('asks for a point cut to one decimal, a date range and the four daily parameters, and nothing else', async () => {
    const { fetch, urls, headers } = answer(OSLO_DAILY)

    await createNasaPowerClient({ fetch }).daily(
      59.913_912_345,
      10.752_249_99,
      RANGE,
      INIT,
    )

    expect(urls).toHaveLength(1)
    const url = new URL(urls[0])
    expect(`${url.origin}${url.pathname}`).toBe(NASA_POWER_ENDPOINT)
    expect(url.searchParams.get('latitude')).toBe('59.9')
    expect(url.searchParams.get('longitude')).toBe('10.8')
    expect(url.searchParams.get('start')).toBe('20261001')
    expect(url.searchParams.get('end')).toBe('20261012')
    expect(url.searchParams.get('parameters')).toBe(
      'T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M',
    )
    expect(url.searchParams.get('community')).toBe('AG')
    expect(url.searchParams.get('time-standard')).toBe('LST')
    expect(url.searchParams.get('format')).toBe('JSON')
    expect([...url.searchParams.keys()].sort()).toEqual([
      'community',
      'end',
      'format',
      'latitude',
      'longitude',
      'parameters',
      'start',
      'time-standard',
    ])
    expect(new Headers(headers[0]).has('accept-encoding')).toBe(false)
  })

  it('never lets a coordinate with more than one decimal into the URL', async () => {
    const { fetch, urls } = answer(OSLO_DAILY)
    const client = createNasaPowerClient({ fetch })

    await client.daily(-33.868_82, 151.209_3, RANGE, INIT)
    await client.daily(0.000_04, -0.000_04, RANGE, INIT)

    for (const sent of urls) {
      const url = new URL(sent)
      for (const name of ['latitude', 'longitude']) {
        expect(url.searchParams.get(name)).toMatch(/^-?\d+\.\d$/)
      }
    }
    // Two spellings of the equator are one point.
    expect(new URL(urls[1]).searchParams.get('latitude')).toBe('0.0')
    expect(new URL(urls[1]).searchParams.get('longitude')).toBe('0.0')
  })

  it('reads each day into metric figures keyed by the ISO date', async () => {
    const { fetch } = answer(OSLO_DAILY)

    const days = await createNasaPowerClient({ fetch }).daily(
      59.9,
      10.7,
      RANGE,
      INIT,
    )

    expect(days.get('2026-10-09')).toEqual({
      tempMaxC: 8.36,
      tempMinC: 1.91,
      precipitationMm: 0.23,
      windMs: 0.85,
    })
    expect(days.get('2026-10-01')).toEqual({
      tempMaxC: 15.47,
      tempMinC: 10.11,
      precipitationMm: 0.52,
      windMs: 0.95,
    })
  })

  it('turns the fill value into an absent field and never into a number', async () => {
    const { fetch } = answer(OSLO_DAILY)

    const days = await createNasaPowerClient({ fetch }).daily(
      59.9,
      10.7,
      RANGE,
      INIT,
    )

    expect(days.get('2026-10-10')).toEqual({
      tempMaxC: null,
      tempMinC: null,
      precipitationMm: null,
      windMs: null,
    })
    for (const values of days.values()) {
      for (const figure of Object.values(values)) {
        expect(figure === null || figure > -900).toBe(true)
      }
    }
  })

  it('keeps the fields that are present when only some are the fill value', async () => {
    const body = {
      properties: {
        parameter: {
          T2M_MAX: { '20260301': 12.5 },
          T2M_MIN: { '20260301': -999 },
          PRECTOTCORR: { '20260301': 0 },
          WS2M: { '20260301': -999 },
        },
      },
      header: { fill_value: -999 },
    }
    const { fetch } = answer(body)

    const days = await createNasaPowerClient({ fetch }).daily(
      1,
      2,
      { start: '2026-03-01', end: '2026-03-01' },
      INIT,
    )

    expect(days.get('2026-03-01')).toEqual({
      tempMaxC: 12.5,
      tempMinC: null,
      precipitationMm: 0,
      windMs: null,
    })
  })

  it('answers a day a parameter does not mention as absent', async () => {
    const body = {
      properties: {
        parameter: {
          T2M_MAX: { '20260301': 12.5 },
          T2M_MIN: {},
        },
      },
    }
    const { fetch } = answer(body)

    const days = await createNasaPowerClient({ fetch }).daily(
      1,
      2,
      { start: '2026-03-01', end: '2026-03-01' },
      INIT,
    )

    expect(days.get('2026-03-01')).toEqual({
      tempMaxC: 12.5,
      tempMinC: null,
      precipitationMm: null,
      windMs: null,
    })
  })

  it('raises a typed error for a status the provider refuses with, without the URL or the body', async () => {
    const { fetch } = answer('quota exceeded for 59.9,10.7', { status: 429 })

    const failure = await createNasaPowerClient({ fetch })
      .daily(59.9, 10.7, RANGE, INIT)
      .catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(WeatherProviderError)
    expect((failure as WeatherProviderError).reason).toBe('refused')
    expect((failure as WeatherProviderError).message).toContain('429')
    expect((failure as WeatherProviderError).message).not.toContain('59.9')
    expect((failure as WeatherProviderError).message).not.toContain('quota')
  })

  it('raises a typed error for a body that is not an answer', async () => {
    const notJson = createNasaPowerClient({ fetch: answer('<html>').fetch })
    const wrongShape = createNasaPowerClient({
      fetch: answer({ properties: { parameter: { T2M_MAX: 'hot' } } }).fetch,
    })

    for (const client of [notJson, wrongShape]) {
      const failure = await client
        .daily(59.9, 10.7, RANGE, INIT)
        .catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(WeatherProviderError)
      expect((failure as WeatherProviderError).reason).toBe('malformed')
    }
  })

  it('raises a typed error when the provider cannot be reached', async () => {
    const client = createNasaPowerClient({
      fetch: (() =>
        Promise.reject(new TypeError('connection reset'))) as typeof fetch,
    })

    const failure = await client
      .daily(59.9, 10.7, RANGE, INIT)
      .catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(WeatherProviderError)
    expect((failure as WeatherProviderError).reason).toBe('unreachable')
  })

  it('rethrows an aborted call as it is, so a timeout stays a timeout', async () => {
    const controller = new AbortController()
    const reason = new Error('aborted')
    const client = createNasaPowerClient({
      fetch: (() => {
        controller.abort()
        return Promise.reject(reason)
      }) as typeof fetch,
    })

    const failure = await client
      .daily(59.9, 10.7, RANGE, { signal: controller.signal })
      .catch((cause: unknown) => cause)

    expect(failure).toBe(reason)
  })

  it('carries the publication lag it was measured to have, as a whole number of days', () => {
    expect(createNasaPowerClient({ fetch }).lagDays).toBe(POWER_LAG_DAYS)
    expect(Number.isInteger(POWER_LAG_DAYS)).toBe(true)
    expect(POWER_LAG_DAYS).toBeGreaterThan(0)
  })
})

describe('the NASA POWER climatology call', () => {
  it('asks for a point cut to one decimal and the three climate parameters, with no dates and no wind', async () => {
    const { fetch, urls } = answer(OSLO_CLIMATOLOGY)

    await createNasaPowerClient({ fetch }).climatology(
      59.913_912_345,
      10.752_249_99,
      INIT,
    )

    expect(urls).toHaveLength(1)
    const url = new URL(urls[0])
    expect(`${url.origin}${url.pathname}`).toBe(NASA_POWER_CLIMATOLOGY_ENDPOINT)
    expect(url.searchParams.get('latitude')).toBe('59.9')
    expect(url.searchParams.get('longitude')).toBe('10.8')
    // The mean temperature and the mean daily range, never `T2M_MAX` / `T2M_MIN` or their `_AVG`
    // variants: those are the hottest and coldest hour of the month, and drawn as "typical" they
    // would send a traveller to Tokyo in October for 27 and 9 degrees.
    expect(url.searchParams.get('parameters')).toBe('T2M,T2M_RANGE,PRECTOTCORR')
    expect([...url.searchParams.keys()].sort()).toEqual([
      'community',
      'format',
      'latitude',
      'longitude',
      'parameters',
    ])
  })

  it('reads twelve months, January first, and leaves the annual figure out', async () => {
    const { fetch } = answer(OSLO_CLIMATOLOGY)

    const months = await createNasaPowerClient({ fetch }).climatology(
      59.9,
      10.8,
      INIT,
    )

    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({
      tempMaxC: -3.45,
      tempMinC: -8.43,
      precipitationMm: 2.5,
    })
    expect(months[9]).toEqual({
      tempMaxC: 7.38,
      tempMinC: 1.57,
      precipitationMm: 3.35,
    })
  })

  it('turns the fill value into an absent field and never into a number', async () => {
    const body = structuredClone(OSLO_CLIMATOLOGY) as unknown as {
      properties: { parameter: Record<string, Record<string, number>> }
    }
    body.properties.parameter.T2M_RANGE.JUL = -999
    body.properties.parameter.PRECTOTCORR.JUL = -999
    const { fetch } = answer(body)

    const months = await createNasaPowerClient({ fetch }).climatology(
      59.9,
      10.8,
      INIT,
    )

    // The typical high and low are the mean moved half the range either way, so one missing
    // figure takes both away.
    expect(months[6]).toEqual({
      tempMaxC: null,
      tempMinC: null,
      precipitationMm: null,
    })
  })

  it('answers a month a parameter does not mention as absent', async () => {
    const { fetch } = answer({
      properties: {
        parameter: {
          T2M: { JAN: 1 },
          T2M_RANGE: { JAN: 2 },
          PRECTOTCORR: { FEB: 3 },
        },
      },
    })

    const months = await createNasaPowerClient({ fetch }).climatology(
      0,
      0,
      INIT,
    )

    expect(months[0]).toEqual({
      tempMaxC: 2,
      tempMinC: 0,
      precipitationMm: null,
    })
    expect(months[1]).toEqual({
      tempMaxC: null,
      tempMinC: null,
      precipitationMm: 3,
    })
  })

  it('raises a typed error for a refusal and for a body that is not an answer', async () => {
    const refused = answer('nope', { status: 503 })
    await expect(
      createNasaPowerClient({ fetch: refused.fetch }).climatology(1, 1, INIT),
    ).rejects.toMatchObject({ name: 'WeatherProviderError', reason: 'refused' })

    const malformed = answer({
      properties: { parameter: { T2M: 'hot' } },
    })
    await expect(
      createNasaPowerClient({ fetch: malformed.fetch }).climatology(1, 1, INIT),
    ).rejects.toBeInstanceOf(WeatherProviderError)
  })
})
