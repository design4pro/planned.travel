import { describe, expect, it, vi } from 'vitest'
import { EXTRACTION_MODEL, moneyFrom, textToReservations } from '../booking'

import type { BookingModel } from '../booking'

function modelAnswering(answer: unknown) {
  const run = vi.fn(async (): Promise<unknown> => answer)
  const model: BookingModel = { run }
  return { ...model, run }
}

const input = { text: 'Hotel Roma, check-in 4 March', sourceName: 'stay.pdf' }

function answerOf(bookings: Array<unknown>): unknown {
  return { response: JSON.stringify({ bookings }) }
}

describe('textToReservations', () => {
  it('maps a well-formed answer to staged reservations', async () => {
    const model = modelAnswering(
      answerOf([
        {
          kind: 'lodging',
          title: 'Hotel Roma',
          startsAt: '2026-03-04T14:00:00Z',
          endsAt: '2026-03-07T10:00:00Z',
          location: 'Via del Corso 1, Rome',
          reference: 'ABC123',
          amountMinor: 42_000,
          currency: 'eur',
        },
      ]),
    )

    const rows = await textToReservations(model, input)

    expect(model.run).toHaveBeenCalledWith(EXTRACTION_MODEL, expect.anything())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      kind: 'lodging',
      title: 'Hotel Roma',
      startsAt: '2026-03-04T14:00:00Z',
      location: 'Via del Corso 1, Rome',
      reference: 'ABC123',
      priceMinor: 42_000,
      currency: 'EUR',
      floating: false,
    })
    expect(rows[0]?.needsReview).toBeUndefined()
  })

  it('reads JSON a model wrapped in prose and a code fence', async () => {
    const model = modelAnswering({
      response: `Sure! Here you go:\n\`\`\`json\n{"bookings":[{"title":"Hotel Roma","startsAt":"2026-03-04"}]}\n\`\`\``,
    })

    const rows = await textToReservations(model, input)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('Hotel Roma')
  })

  it('accepts an answer the model returned already structured', async () => {
    const model = modelAnswering({ bookings: [{ title: 'Hotel Roma' }] })

    await expect(textToReservations(model, input)).resolves.toHaveLength(1)
  })

  it('rejects an answer missing its required field whole, and stages nothing', async () => {
    const model = modelAnswering({
      response: JSON.stringify({ rows: [{ title: 'Hotel Roma' }] }),
    })

    await expect(textToReservations(model, input)).rejects.toMatchObject({
      code: 'unreadable',
    })
  })

  it('rejects an answer that is not JSON at all', async () => {
    const model = modelAnswering({
      response: 'I could not read that document.',
    })

    await expect(textToReservations(model, input)).rejects.toMatchObject({
      code: 'unreadable',
    })
  })

  it('surfaces a model that throws as `unreadable`', async () => {
    const model = {
      run: vi.fn(async () => {
        throw new Error('inference unavailable')
      }),
    } as unknown as BookingModel

    await expect(textToReservations(model, input)).rejects.toMatchObject({
      code: 'unreadable',
    })
  })

  it('drops one unparseable row and keeps its four siblings', async () => {
    const good = (n: number) => ({
      title: `Booking ${n}`,
      startsAt: '2026-03-04',
    })
    const model = modelAnswering(
      answerOf([good(1), good(2), { title: 42 }, good(3), good(4)]),
    )

    const rows = await textToReservations(model, input)

    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.title)).toEqual([
      'Booking 1',
      'Booking 2',
      'Booking 3',
      'Booking 4',
    ])
  })

  it('drops a row that named nothing at all', async () => {
    const model = modelAnswering(answerOf([{ notes: 'see attachment' }]))

    await expect(textToReservations(model, input)).resolves.toEqual([])
  })

  it('answers an empty array when the model says the text confirms nothing', async () => {
    const model = modelAnswering(answerOf([]))

    await expect(textToReservations(model, input)).resolves.toEqual([])
  })

  it('keeps a row with no title and lets the catalogue name it', async () => {
    const model = modelAnswering(
      answerOf([{ startsAt: '2026-03-04', location: 'Rome' }]),
    )

    const rows = await textToReservations(model, input)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('Untitled booking')
  })

  it('marks a row whose start the document did not state', async () => {
    const model = modelAnswering(answerOf([{ title: 'Hotel Roma' }]))

    const rows = await textToReservations(model, input)

    expect(rows[0]).toMatchObject({ needsReview: true, startsAt: null })
  })

  it('floats a start that carries no zone and does not float one that does', async () => {
    const model = modelAnswering(
      answerOf([
        { title: 'Floating', startsAt: '2026-03-04T14:00:00' },
        { title: 'Offset', startsAt: '2026-03-04T14:00:00+01:00' },
      ]),
    )

    const rows = await textToReservations(model, input)

    expect(rows[0]?.floating).toBe(true)
    expect(rows[1]?.floating).toBe(false)
  })

  it('infers the kind when the model states one this product does not have', async () => {
    const model = modelAnswering(
      answerOf([
        { kind: 'accommodation', title: 'Hotel Roma', startsAt: '2026-03-04' },
      ]),
    )

    const rows = await textToReservations(model, input)

    expect(rows[0]?.kind).toBe('lodging')
  })

  it('caps how many rows one document may contribute', async () => {
    const model = modelAnswering(
      answerOf(
        Array.from({ length: 80 }, (_unused, index) => ({
          title: `Booking ${index}`,
          startsAt: '2026-03-04',
        })),
      ),
    )

    await expect(textToReservations(model, input)).resolves.toHaveLength(50)
  })

  it('never opens a socket — the model is the only dependency and it is a stub', async () => {
    const model = modelAnswering(
      answerOf([{ title: 'Hotel Roma', startsAt: '2026-03-04' }]),
    )

    await textToReservations(model, input)

    expect(model.run).toHaveBeenCalledTimes(1)
  })
})

describe('the money rule', () => {
  it('takes an integer count of minor units beside an ISO-4217 code', () => {
    expect(moneyFrom(125_050, 'EUR')).toEqual({
      priceMinor: 125_050,
      currency: 'EUR',
      dropped: false,
    })
  })

  it('drops an amount that is not an integer, and marks that it saw one', () => {
    expect(moneyFrom(1250.5, 'EUR')).toEqual({ dropped: true })
  })

  it('drops a printed string the server may not parse', () => {
    expect(moneyFrom('1.250,50', 'EUR')).toEqual({ dropped: true })
  })

  it('drops an amount with no currency, and a currency with no amount', () => {
    expect(moneyFrom(42_000, undefined)).toEqual({ dropped: true })
    expect(moneyFrom(undefined, 'EUR')).toEqual({ dropped: true })
  })

  it('drops a currency that is not three letters', () => {
    expect(moneyFrom(42_000, 'euro')).toEqual({ dropped: true })
  })

  it('says nothing was dropped when the document stated no price at all', () => {
    expect(moneyFrom(undefined, undefined)).toEqual({ dropped: false })
    expect(moneyFrom(null, null)).toEqual({ dropped: false })
  })

  it('refuses a negative amount rather than storing a credit as a price', () => {
    expect(moneyFrom(-4200, 'EUR')).toEqual({ dropped: true })
  })
})

describe('a row whose price was dropped', () => {
  it('carries neither money field and is marked for review', async () => {
    const model = modelAnswering(
      answerOf([
        {
          title: 'Hotel Roma',
          startsAt: '2026-03-04T14:00:00Z',
          amountMinor: 1250.5,
          currency: 'EUR',
        },
      ]),
    )

    const rows = await textToReservations(model, input)

    expect(rows[0]?.priceMinor).toBeUndefined()
    expect(rows[0]?.currency).toBeUndefined()
    expect(rows[0]?.needsReview).toBe(true)
  })
})
