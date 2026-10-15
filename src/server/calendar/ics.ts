/**
 * A small, dependency-free iCalendar writer.
 *
 * The inverse of `src/server/queue/ics.ts`, which reads the `.ics` attachments airlines and hotels
 * send; the two share no code, and the writer's test round-trips its output through that reader.
 * Pure: no I/O, no repository, no clock. Every value that ends up on a content line goes through
 * {@link escapeIcsText} or {@link plainValue}, so a title cannot start a new line, and no
 * `VTIMEZONE` is ever written — a UTC instant carries no offset it could get wrong, and a floating
 * time carries no zone to describe.
 */

/** A point in time, in one of the three forms this product ever writes. */
export type IcsMoment =
  /** `YYYY-MM-DD`, written as `VALUE=DATE`. */
  | { readonly kind: 'date'; readonly date: string }
  /** A wall-clock time with no zone: the reader's calendar shows it as written. */
  | {
      readonly kind: 'floating'
      readonly date: string
      readonly time: string
    }
  /** An absolute instant, written in UTC with a `Z`. */
  | { readonly kind: 'utc'; readonly at: Date }

export type IcsStatus = 'CONFIRMED' | 'TENTATIVE'

export interface IcsEventInput {
  readonly uid: string
  /** Written as both `DTSTAMP` and `LAST-MODIFIED`: the last edit, not the time of the request. */
  readonly stamp: Date
  readonly start: IcsMoment
  readonly end?: IcsMoment
  readonly summary: string
  readonly description?: string
  readonly location?: string
  readonly url?: string
  readonly status?: IcsStatus
}

export interface IcsCalendarInput {
  readonly name: string
  readonly events: ReadonlyArray<IcsEventInput>
}

const CRLF = '\r\n'

/** RFC 5545 §3.1: no content line longer than 75 octets, the line break excluded. */
const MAX_LINE_OCTETS = 75

const encoder = new TextEncoder()

const TAB = 0x09
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d
const DELETE = 0x7f

/** C0 controls other than tab and the line breaks (handled separately), and DEL. */
function isStrippedControl(code: number): boolean {
  if (code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN) {
    return false
  }
  return code < 0x20 || code === DELETE
}

/** The value without the control characters a content line cannot carry. */
function withoutControls(value: string): string {
  return [...value]
    .filter((character) => !isStrippedControl(character.codePointAt(0) ?? 0))
    .join('')
}

/** Escapes a TEXT value: backslash, semicolon, comma and every kind of line break. */
export function escapeIcsText(value: string): string {
  return withoutControls(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** A value that is not TEXT (a URL, a UID): no escaping applies, so nothing line-like survives. */
function plainValue(value: string): string {
  return withoutControls(value).replace(/[\r\n]+/g, '')
}

/**
 * Folds one content line at 75 octets, counted in UTF-8 and never inside a character. Each
 * continuation starts with one space, which counts toward its own 75.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line
  }
  const physical: Array<string> = []
  let current = ''
  let used = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (used + size > MAX_LINE_OCTETS) {
      physical.push(current)
      current = ' '
      used = 1
    }
    current += character
    used += size
  }
  physical.push(current)
  return physical.join(CRLF)
}

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, '0')

function compactDate(date: string): string {
  return date.replaceAll('-', '')
}

function compactTime(time: string): string {
  const [hours = '00', minutes = '00'] = time.split(':')
  return `${hours}${minutes}00`
}

function utcStamp(at: Date): string {
  return (
    `${pad(at.getUTCFullYear(), 4)}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`
  )
}

/** `NAME:value` or `NAME;VALUE=DATE:value`: the property line for one moment. */
function momentLine(name: string, moment: IcsMoment): string {
  switch (moment.kind) {
    case 'date':
      return `${name};VALUE=DATE:${compactDate(moment.date)}`
    case 'floating':
      return `${name}:${compactDate(moment.date)}T${compactTime(moment.time)}`
    case 'utc':
      return `${name}:${utcStamp(moment.at)}`
  }
}

function eventLines(event: IcsEventInput): Array<string> {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${plainValue(event.uid)}`,
    `DTSTAMP:${utcStamp(event.stamp)}`,
    `LAST-MODIFIED:${utcStamp(event.stamp)}`,
    momentLine('DTSTART', event.start),
  ]
  if (event.end !== undefined) {
    lines.push(momentLine('DTEND', event.end))
  }
  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`)
  if (event.description !== undefined) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  }
  if (event.location !== undefined) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  }
  if (event.url !== undefined) {
    lines.push(`URL:${plainValue(event.url)}`)
  }
  if (event.status !== undefined) {
    lines.push(`STATUS:${event.status}`)
  }
  lines.push('END:VEVENT')
  return lines
}

/** One `VCALENDAR`, CRLF-terminated, with the refresh hints a subscribing client reads. */
export function writeCalendar(input: IcsCalendarInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//planned.travel//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(input.name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...input.events.flatMap(eventLines),
    'END:VCALENDAR',
  ]
  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`
}
