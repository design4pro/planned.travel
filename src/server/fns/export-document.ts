/** Pure snapshot builder. Schema bounds and the queue byte budget are independent limits. */
import { formatDate, formatNumber, formatTime } from '#/lib/format'
import type { Locale } from '#/lib/i18n'
import type { Translate } from '#/lib/i18n/types'
import type {
  Trip,
  Day,
  DayNote,
  DayAccommodation,
  Reservation,
  Transport,
  Place,
  DayAssignment,
} from '#/server/db/types'
import type { ExportDocument } from '#/server/queue/types'

export interface ExportDocumentInput {
  trip: Pick<
    Trip,
    'title' | 'destination' | 'summary' | 'timezone' | 'startDate' | 'endDate'
  >
  days: ReadonlyArray<{
    day: Pick<Day, 'id' | 'dayNumber' | 'date'>
    stops: ReadonlyArray<{
      place: Pick<Place, 'name' | 'address' | 'city'>
      assignment: Pick<DayAssignment, 'startTime'>
    }>
    accommodations: ReadonlyArray<
      Pick<
        DayAccommodation,
        | 'id'
        | 'name'
        | 'address'
        | 'confirmationNumber'
        | 'startDayId'
        | 'endDayId'
      >
    >
  }>
  notes: ReadonlyArray<Pick<DayNote, 'dayId' | 'body' | 'detail'>>
  reservations: ReadonlyArray<
    Pick<
      Reservation,
      | 'title'
      | 'provider'
      | 'location'
      | 'status'
      | 'confirmationNumber'
      | 'startDate'
      | 'startTime'
    >
  >
  transports: ReadonlyArray<
    Pick<
      Transport,
      | 'title'
      | 'carrier'
      | 'serviceNumber'
      | 'status'
      | 'bookingCode'
      | 'seat'
      | 'departureName'
      | 'departureCode'
      | 'arrivalName'
      | 'arrivalCode'
      | 'departureDate'
      | 'departureTime'
    >
  >
}

export const EXPORT_DOCUMENT_BYTES = 100_000
const MAX_DAYS = 56

/** Cut at a UTF-16 bound without leaving an unpaired surrogate for the queue to escape. */
function cut(text: string, max: number): string {
  return text
    .replaceAll(/\p{Surrogate}/gu, '')
    .slice(0, max)
    .replace(/[\uD800-\uDBFF]$/u, '')
}

export function buildExportDocument(
  input: ExportDocumentInput,
  t: Translate,
  locale: Locale,
  { includeReferences }: { includeReferences: boolean },
): ExportDocument {
  const { trip, days } = input
  const join = (...parts: ReadonlyArray<string | null | undefined>) =>
    parts.filter(Boolean).join(' · ')
  const date = (value: string | null) =>
    value === null ? '' : (formatDate(value, locale) ?? value)
  const reference = (value: string | null) =>
    includeReferences && value
      ? t('modules.files.export.doc.reference', { code: value })
      : ''
  const sections: ExportDocument['sections'] = []
  const totals: Array<number> = []
  const baseNotes: Array<string> = []
  const noteTotals: Array<number> = []
  function section(
    heading: string,
    rows: ExportDocument['sections'][number]['rows'],
    note = '',
  ) {
    totals.push(rows.length)
    baseNotes.push(cut(note, 1600))
    noteTotals.push(note.length)
    sections.push({
      heading: cut(heading, 120),
      note: cut(note, 1600),
      rows: rows.slice(0, 500).map((row) => ({
        label: cut(row.label, 200) || ' ',
        value: cut(row.value, 2000),
        meta: cut(row.meta ?? '', 200),
      })),
    })
  }
  section(
    t('modules.files.export.doc.overview'),
    [
      {
        label: t('modules.files.export.doc.timezone'),
        value: trip.timezone ?? 'UTC',
      },
      {
        label: t('modules.files.export.doc.days'),
        value: formatNumber(days.length, locale),
      },
    ],
    join(
      days.length > MAX_DAYS
        ? t('modules.files.export.doc.truncatedDays', { count: MAX_DAYS })
        : '',
      trip.summary,
    ),
  )
  for (const item of days.slice(0, MAX_DAYS)) {
    const heading =
      item.day.date === null
        ? t('modules.files.export.doc.dayUndated', {
            count: item.day.dayNumber,
          })
        : t('modules.files.export.doc.day', {
            count: item.day.dayNumber,
            date: date(item.day.date),
          })
    section(
      heading,
      item.stops.map(({ place, assignment }) => ({
        label: place.name,
        value: place.address ?? place.city ?? '',
        meta: formatTime(assignment.startTime) ?? '',
      })),
      join(
        ...input.notes
          .filter((note) => note.dayId === item.day.id)
          .map((note) => join(note.body, note.detail)),
        item.stops.length === 0 ? t('modules.files.export.doc.dayEmpty') : '',
      ),
    )
  }
  section(
    t('modules.files.export.doc.reservations'),
    input.reservations
      .filter((row) => row.status !== 'cancelled')
      .map((row) => ({
        label: row.title,
        value: join(
          row.provider,
          row.location,
          reference(row.confirmationNumber),
        ),
        meta: join(date(row.startDate), formatTime(row.startTime)),
      })),
  )
  section(
    t('modules.files.export.doc.transport'),
    input.transports
      .filter((row) => row.status !== 'cancelled' && row.status !== 'idea')
      .map((row) => ({
        label: join(row.title, row.carrier, row.serviceNumber),
        value: join(
          t('modules.files.export.doc.route', {
            from: row.departureName ?? row.departureCode ?? '',
            to: row.arrivalName ?? row.arrivalCode ?? '',
          }),
          row.seat,
          reference(row.bookingCode),
        ),
        meta: join(date(row.departureDate), formatTime(row.departureTime)),
      })),
  )
  const stays = new Map<
    string,
    ExportDocumentInput['days'][number]['accommodations'][number]
  >()
  for (const day of days) {
    for (const stay of day.accommodations) {
      if (!stays.has(stay.id)) stays.set(stay.id, stay)
    }
  }
  const numbers = new Map(days.map(({ day }) => [day.id, day.dayNumber]))
  section(
    t('modules.files.export.doc.stays'),
    [...stays.values()].map((stay) => ({
      label: stay.name,
      value: join(stay.address, reference(stay.confirmationNumber)),
      meta: t('modules.files.export.doc.nights', {
        count: Math.max(
          0,
          (numbers.get(stay.endDayId) ?? 0) -
            (numbers.get(stay.startDayId) ?? 0),
        ),
      }),
    })),
  )
  const document: ExportDocument = {
    title: cut(trip.title, 200),
    subtitle: cut(
      join(trip.destination, date(trip.startDate), date(trip.endDate)),
      200,
    ),
    sections,
  }
  function markCut(index: number) {
    const item = sections[index]
    if (item === undefined) return
    const total = totals[index] ?? 0
    const note = baseNotes[index] ?? ''
    const noteTotal = noteTotals[index] ?? 0
    item.note = cut(
      join(
        note,
        noteTotal > note.length
          ? t('modules.files.export.doc.truncatedRows', {
              count: note.length,
              total: formatNumber(noteTotal, locale),
            })
          : '',
        total > item.rows.length
          ? t('modules.files.export.doc.truncatedRows', {
              count: item.rows.length,
              total: formatNumber(total, locale),
            })
          : '',
      ),
      2000,
    )
  }
  sections.forEach((_item, index) => markCut(index))
  const encoder = new TextEncoder()
  const size = (value: unknown) => encoder.encode(JSON.stringify(value)).length
  // Account for each removed row and note delta, rather than serialising megabytes on every cut.
  const rowBytes = sections.map((item) => item.rows.map(size))
  let bytes = size(document)
  while (bytes > EXPORT_DOCUMENT_BYTES) {
    let index = 0
    for (let candidate = 1; candidate < sections.length; candidate += 1) {
      if (
        (sections[candidate]?.rows.length ?? 0) >
        (sections[index]?.rows.length ?? 0)
      )
        index = candidate
    }
    const item = sections[index]
    if (item === undefined) break
    if (item.rows.length === 0) {
      // A long trip may have only notes. They must fit even when there are no rows left to drop.
      index = baseNotes.reduce(
        (longest, note, candidate) =>
          note.length > (baseNotes[longest]?.length ?? 0) ? candidate : longest,
        0,
      )
      const noteSection = sections[index]
      const note = baseNotes[index] ?? ''
      if (noteSection === undefined || note.length === 0) break
      const before = size(noteSection.note)
      baseNotes[index] = cut(note, Math.floor(note.length / 2))
      markCut(index)
      bytes += size(noteSection.note) - before
      continue
    }
    const before = size(item.note)
    const comma = item.rows.length > 1 ? 1 : 0
    item.rows.pop()
    bytes -= (rowBytes[index]?.pop() ?? 0) + comma
    markCut(index)
    bytes += size(item.note) - before
  }
  return document
}
