import { describe, expect, it } from 'vitest'
import { buildExportDocument } from '../export-document'
import { createTranslator, loadCatalogue } from '#/lib/i18n/catalogue'
import { pdfExportPayloadSchema } from '#/server/queue/types'

describe('the bounded trip document', () => {
  it('bounds a multibyte 90-day, 700-reservation trip and reports every cut', async () => {
    const t = createTranslator('en', await loadCatalogue('en'))
    const document = buildExportDocument(
      {
        trip: {
          title: '旅'.repeat(200),
          destination: '京都',
          summary: 'Summary',
          timezone: 'Asia/Tokyo',
          startDate: null,
          endDate: null,
        },
        days: Array.from({ length: 90 }, (_, i) => ({
          day: { id: String(i), dayNumber: i + 1, date: null },
          stops: [],
          accommodations: [],
        })),
        notes: [],
        reservations: Array.from({ length: 700 }, () => ({
          title: '旅'.repeat(200),
          provider: '旅'.repeat(2000),
          location: '京都',
          status: 'confirmed',
          confirmationNumber: 'SECRET',
          startDate: '2027-02-01',
          startTime: null,
        })),
        transports: [],
      },
      t,
      'en',
      { includeReferences: false },
    )
    expect(
      pdfExportPayloadSchema.safeParse({
        tripId: 'trip',
        requestedBy: 'user',
        document,
      }).success,
    ).toBe(true)
    expect(
      new TextEncoder().encode(JSON.stringify(document)).length,
    ).toBeLessThanOrEqual(100_000)
    expect(document.sections).toHaveLength(60)
    expect(document.sections[0]?.note).toContain('56')
    expect(
      document.sections.find((s) => s.heading === 'Reservations')?.note,
    ).toContain('700')
    expect(JSON.stringify(document)).not.toContain('SECRET')
  })
})

it('exports real travel records in the requester’s language and includes codes only on opt-in', async () => {
  const t = createTranslator('pl', await loadCatalogue('pl'))
  const stay = {
    id: 'stay',
    name: 'Hotel',
    address: 'Kyoto',
    confirmationNumber: 'HOTEL-SECRET',
    startDayId: 'day-1',
    endDayId: 'day-2',
  }
  const reservation = {
    title: 'Museum',
    provider: 'Tickets',
    location: 'Kyoto',
    status: 'confirmed',
    confirmationNumber: 'RESERVATION-SECRET',
    startDate: '2027-02-01',
    startTime: '10:00',
  }
  const transport = {
    title: 'Train',
    carrier: 'Rail',
    serviceNumber: '123',
    status: 'confirmed',
    seat: '1A',
    bookingCode: 'TRAIN-SECRET',
    departureName: 'Kyoto',
    departureCode: null,
    arrivalName: 'Tokyo',
    arrivalCode: null,
    departureDate: '2027-02-01',
    departureTime: '08:00',
  }
  const input = {
    trip: {
      title: 'Japan',
      destination: 'Kyoto',
      summary: 'Our plan',
      timezone: 'Asia/Tokyo',
      startDate: '2027-02-01',
      endDate: '2027-02-02',
    },
    days: [
      {
        day: { id: 'day-1', dayNumber: 1, date: '2027-02-01' },
        stops: [
          {
            place: { name: 'Park', address: 'Street', city: 'Kyoto' },
            assignment: { startTime: '09:00' },
          },
        ],
        accommodations: [stay],
      },
      {
        day: { id: 'day-2', dayNumber: 2, date: '2027-02-02' },
        stops: [],
        accommodations: [stay],
      },
    ],
    notes: [{ dayId: 'day-1', body: 'Take water', detail: 'A long walk' }],
    reservations: [
      reservation,
      { ...reservation, title: 'Cancelled reservation', status: 'cancelled' },
    ],
    transports: [
      transport,
      { ...transport, title: 'Idea transport', status: 'idea' },
      { ...transport, title: 'Cancelled transport', status: 'cancelled' },
    ],
  }
  const without = buildExportDocument(input, t, 'pl', {
    includeReferences: false,
  })
  const withCodes = buildExportDocument(input, t, 'pl', {
    includeReferences: true,
  })
  expect(JSON.stringify(without)).not.toContain('SECRET')
  for (const code of ['HOTEL-SECRET', 'RESERVATION-SECRET', 'TRAIN-SECRET']) {
    expect(JSON.stringify(withCodes)).toContain(code)
  }
  const text = JSON.stringify(withCodes)
  expect(text).not.toMatch(/Cancelled|Idea transport|→/u)
  expect(text).toContain('Kyoto do Tokyo')
  expect(text).toContain('Take water')
  expect(withCodes.sections[0]?.heading).toBe('Przegląd')
  expect(
    withCodes.sections.find((s) => s.heading === 'Gdzie nocujemy')?.rows,
  ).toHaveLength(1)
  expect(withCodes.sections[1]?.heading).toContain('1 lut 2027')
})

it('also bounds multibyte notes on an otherwise empty long trip', async () => {
  const t = createTranslator('ja', await loadCatalogue('ja'))
  const days = Array.from({ length: 90 }, (_, i) => ({
    day: { id: String(i), dayNumber: i + 1, date: null },
    stops: [],
    accommodations: [],
  }))
  const document = buildExportDocument(
    {
      trip: {
        title: '旅行',
        destination: null,
        summary: '旅'.repeat(2000),
        timezone: null,
        startDate: null,
        endDate: null,
      },
      days,
      notes: days.map(({ day }) => ({
        dayId: day.id,
        body: '旅'.repeat(2000),
        detail: '旅'.repeat(2000),
      })),
      reservations: [],
      transports: [],
    },
    t,
    'ja',
    { includeReferences: false },
  )
  expect(
    new TextEncoder().encode(JSON.stringify(document)).length,
  ).toBeLessThanOrEqual(100_000)
  expect(
    pdfExportPayloadSchema.safeParse({
      tripId: 'trip',
      requestedBy: 'user',
      document,
    }).success,
  ).toBe(true)
})
