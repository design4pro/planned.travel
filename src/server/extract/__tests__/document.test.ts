import { describe, expect, it, vi } from 'vitest'
import {
  IMPORT_TEXT_MAX_CHARS,
  ImportRefusedError,
  documentToText,
  extensionOf,
  needsConversion,
  stripBase64Runs,
} from '../document'

import type { DocumentConversion, DocumentConverter } from '../document'

function bytesOf(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text)
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  )
}

function converterAnswering(answer: DocumentConversion | (() => never)) {
  const toMarkdown = vi.fn(async (): Promise<DocumentConversion> => {
    if (typeof answer === 'function') return answer()
    return answer
  })
  const converter: DocumentConverter = { toMarkdown }
  return { ...converter, toMarkdown }
}

describe('extensionOf', () => {
  it('lowercases the last segment and answers empty for a name without one', () => {
    expect(extensionOf('Confirmation.PDF')).toBe('pdf')
    expect(extensionOf('archive.tar.gz')).toBe('gz')
    expect(extensionOf('confirmation')).toBe('')
  })
})

describe('routing by extension', () => {
  it('sends a PDF through the conversion', async () => {
    const converter = converterAnswering({
      data: 'Hotel Roma, 4 March',
      format: 'markdown',
    })

    const text = await documentToText(converter, {
      name: 'booking.pdf',
      bytes: bytesOf('%PDF-1.7 binary'),
    })

    expect(converter.toMarkdown).toHaveBeenCalledTimes(1)
    expect(text).toBe('Hotel Roma, 4 March')
  })

  it('does not send a .txt through the conversion — it is already text', async () => {
    const converter = converterAnswering({ data: 'never used' })

    const text = await documentToText(converter, {
      name: 'notes.txt',
      bytes: bytesOf('  Flight LH123 on 4 March  '),
    })

    expect(converter.toMarkdown).not.toHaveBeenCalled()
    expect(text).toBe('Flight LH123 on 4 March')
  })

  it('reads a saved mail message as text without a MIME parser', async () => {
    const converter = converterAnswering({ data: 'never used' })

    const text = await documentToText(converter, {
      name: 'confirmation.eml',
      bytes: bytesOf('Subject: Your stay\r\n\r\nCheck-in 4 March.'),
    })

    expect(converter.toMarkdown).not.toHaveBeenCalled()
    expect(text).toContain('Check-in 4 March.')
  })

  it('names the conversion formats it would reach for', () => {
    expect(needsConversion('a.pdf')).toBe(true)
    expect(needsConversion('a.jpeg')).toBe(true)
    expect(needsConversion('a.txt')).toBe(false)
    expect(needsConversion('a.eml')).toBe(false)
  })
})

describe('the base64 strip', () => {
  it('keeps the prose of an .eml and drops a 400-character base64 run', async () => {
    const run = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5'.repeat(9)
    expect(run.length).toBeGreaterThan(400)
    const converter = converterAnswering({ data: 'never used' })

    const text = await documentToText(converter, {
      name: 'confirmation.eml',
      bytes: bytesOf(
        [
          'Subject: Your reservation at Hotel Roma',
          '',
          'Dear traveller, your stay is confirmed for 4 March. Reference ABC123.',
          '',
          '--boundary',
          'Content-Transfer-Encoding: base64',
          '',
          run,
          '--boundary--',
        ].join('\r\n'),
      ),
    })

    expect(text).toContain('your stay is confirmed for 4 March')
    expect(text).toContain('ABC123')
    expect(text).not.toContain(run)
  })

  it('keeps a base64-wrapped run that is shorter than the floor', () => {
    const short = 'QUJDRE'.repeat(12)
    expect(short.length).toBeLessThan(200)
    expect(stripBase64Runs(`before ${short} after`)).toContain(short)
  })

  it('keeps a long stretch of prose that carries no punctuation', () => {
    const prose = Array.from({ length: 60 }, () => 'confirmation').join(' ')
    expect(prose.length).toBeGreaterThan(200)
    expect(stripBase64Runs(prose)).toBe(prose)
  })

  it('drops a run wrapped at MIME line length', () => {
    const line =
      'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5MDEyMzQ1Njc4OQ=='
    const wrapped = Array.from({ length: 6 }, () => line).join('\r\n')
    const stripped = stripBase64Runs(
      `Reference ABC123.\r\n${wrapped}\r\nRegards.`,
    )

    expect(stripped).toContain('Reference ABC123.')
    expect(stripped).toContain('Regards.')
    expect(stripped).not.toContain(line)
  })
})

describe('the cap', () => {
  it('truncates text past the cap at exactly the cap', async () => {
    const converter = converterAnswering({
      data: 'x'.repeat(IMPORT_TEXT_MAX_CHARS + 500),
    })

    const text = await documentToText(converter, {
      name: 'scan.pdf',
      bytes: bytesOf('binary'),
    })

    expect(text).toHaveLength(IMPORT_TEXT_MAX_CHARS)
  })
})

describe('refusals', () => {
  it('refuses a conversion that answers an empty string as `empty`', async () => {
    const converter = converterAnswering({ data: '   ' })

    await expect(
      documentToText(converter, {
        name: 'blank.pdf',
        bytes: bytesOf('binary'),
      }),
    ).rejects.toMatchObject({ code: 'empty' })
  })

  it('refuses a plain-text file holding only whitespace as `empty`', async () => {
    const converter = converterAnswering({ data: 'never used' })

    await expect(
      documentToText(converter, {
        name: 'blank.txt',
        bytes: bytesOf('\n\n  '),
      }),
    ).rejects.toBeInstanceOf(ImportRefusedError)
  })

  it('surfaces a conversion that throws as `unreadable`', async () => {
    const converter = converterAnswering(() => {
      throw new Error('conversion unavailable')
    })

    await expect(
      documentToText(converter, { name: 'scan.pdf', bytes: bytesOf('binary') }),
    ).rejects.toMatchObject({ code: 'unreadable' })
  })

  it('surfaces the conversion error arm as `unreadable` rather than as no text', async () => {
    const converter = converterAnswering({
      format: 'error',
      error: 'unsupported',
    })

    await expect(
      documentToText(converter, { name: 'scan.pdf', bytes: bytesOf('binary') }),
    ).rejects.toMatchObject({ code: 'unreadable' })
  })
})
