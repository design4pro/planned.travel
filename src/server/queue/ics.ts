/**
 * A small, dependency-free iCalendar reader for booking imports.
 *
 * Airlines, hotels and rail operators all email `.ics` attachments, and that is
 * the most reliable machine-readable form of a reservation a traveller actually
 * has. This parser handles the parts of RFC 5545 those files use: line folding,
 * property parameters, escaped text and the three DATE-TIME shapes.
 */

export interface IcsEvent {
  uid: string | null
  summary: string | null
  description: string | null
  location: string | null
  organizer: string | null
  url: string | null
  /** ISO 8601. Ends in `Z` when the source was UTC. */
  start: string | null
  end: string | null
  allDay: boolean
  /** True when the source carried no timezone: interpret in the trip's local time. */
  floating: boolean
}

export interface IcsProperty {
  name: string
  params: Record<string, string>
  value: string
}

/**
 * Reverses RFC 5545 line folding: a CRLF followed by a space or tab continues
 * the previous line. Doing this first means every later step sees whole values.
 */
export function unfoldIcsLines(source: string): Array<string> {
  const raw = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines: Array<string> = []
  for (const line of raw) {
    if (line.length === 0) continue
    const continuation = line.startsWith(' ') || line.startsWith('\t')
    if (continuation && lines.length > 0) {
      lines[lines.length - 1] = `${lines[lines.length - 1] ?? ''}${line.slice(1)}`
      continue
    }
    lines.push(line)
  }
  return lines
}

export function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

export function parseIcsProperty(line: string): IcsProperty | null {
  const colon = line.indexOf(':')
  if (colon <= 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const segments = head.split(';')
  const name = (segments[0] ?? '').toUpperCase()
  if (name.length === 0) return null
  const params: Record<string, string> = {}
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=')
    if (eq <= 0) continue
    params[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name, params, value }
}

export interface ParsedIcsDate {
  iso: string
  allDay: boolean
  floating: boolean
}

const DATE_ONLY = /^(\d{4})(\d{2})(\d{2})$/
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/

export function parseIcsDate(
  value: string,
  params: Record<string, string | undefined> = {},
): ParsedIcsDate | null {
  const trimmed = value.trim()
  const dateOnly = DATE_ONLY.exec(trimmed)
  if (dateOnly) {
    const [, year = '', month = '', day = ''] = dateOnly
    return { iso: `${year}-${month}-${day}`, allDay: true, floating: params.TZID === undefined }
  }
  const dateTime = DATE_TIME.exec(trimmed)
  if (dateTime) {
    const [, year = '', month = '', day = '', hour = '', minute = '', second = '', zulu = ''] = dateTime
    const stamp = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    const isUtc = zulu === 'Z'
    return {
      iso: isUtc ? `${stamp}Z` : stamp,
      allDay: false,
      floating: !isUtc && params.TZID === undefined,
    }
  }
  return null
}

/** Parses every `VEVENT` in a calendar. Unknown components are skipped. */
export function parseIcsCalendar(source: string): Array<IcsEvent> {
  const events: Array<IcsEvent> = []
  let current: IcsEvent | null = null

  for (const line of unfoldIcsLines(source)) {
    const property = parseIcsProperty(line)
    if (!property) continue

    if (property.name === 'BEGIN' && property.value.toUpperCase() === 'VEVENT') {
      current = {
        uid: null,
        summary: null,
        description: null,
        location: null,
        organizer: null,
        url: null,
        start: null,
        end: null,
        allDay: false,
        floating: false,
      }
      continue
    }

    if (property.name === 'END' && property.value.toUpperCase() === 'VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }

    if (!current) continue

    switch (property.name) {
      case 'UID':
        current.uid = property.value.trim()
        break
      case 'SUMMARY':
        current.summary = unescapeIcsText(property.value)
        break
      case 'DESCRIPTION':
        current.description = unescapeIcsText(property.value)
        break
      case 'LOCATION':
        current.location = unescapeIcsText(property.value)
        break
      case 'ORGANIZER':
        current.organizer = property.value.replace(/^mailto:/i, '').trim()
        break
      case 'URL':
        current.url = property.value.trim()
        break
      case 'DTSTART': {
        const parsed = parseIcsDate(property.value, property.params)
        if (parsed) {
          current.start = parsed.iso
          current.allDay = parsed.allDay
          current.floating = parsed.floating
        }
        break
      }
      case 'DTEND': {
        const parsed = parseIcsDate(property.value, property.params)
        if (parsed) current.end = parsed.iso
        break
      }
      default:
        break
    }
  }

  return events
}
