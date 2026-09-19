import { describe, expect, it } from 'vitest'

import { importFormatFor, importReaderFor } from '../file-policy'

describe('importReaderFor', () => {
  it('reads an extensionless text or mail upload by its media type', () => {
    expect(importReaderFor('confirmation', 'text/plain')).toBe('text')
    expect(importReaderFor('confirmation', 'message/rfc822')).toBe('mail')
    expect(importReaderFor('confirmation', 'application/pdf')).toBe('convert')
  })

  it('lets the extension decide whenever there is one', () => {
    expect(importReaderFor('confirmation.eml', 'text/plain')).toBe('mail')
    expect(importReaderFor('notes.txt', 'application/pdf')).toBe('text')
    expect(importReaderFor('pass.pkpass', 'text/plain')).toBeNull()
  })

  it('reads the last extension, whatever its case', () => {
    expect(importReaderFor('Confirmation.PDF', '')).toBe('convert')
    expect(importReaderFor('archive.tar.gz', 'application/pdf')).toBeNull()
  })

  it('agrees with importFormatFor on every file, so the boundary and the reader cannot drift', () => {
    const cases: Array<[string, string]> = [
      ['trip.ics', 'text/calendar'],
      ['export.json', 'application/json'],
      ['stay.pdf', 'application/pdf'],
      ['notes.txt', 'text/plain'],
      ['mail.eml', 'message/rfc822'],
      ['confirmation', 'text/plain'],
      ['confirmation', 'message/rfc822'],
      ['confirmation', 'application/pdf'],
      ['confirmation', 'application/zip'],
      ['pass.pkpass', 'application/pdf'],
    ]

    for (const [filename, contentType] of cases) {
      const reader = importReaderFor(filename, contentType)
      const expected =
        reader === 'text' || reader === 'mail' || reader === 'convert'
          ? 'document'
          : reader
      expect(importFormatFor(filename, contentType)).toBe(expected)
    }
  })
})
