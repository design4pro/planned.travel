import { describe, expect, it } from 'vitest'

import {
  ACCEPT_ATTRIBUTE,
  IMPORT_ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  MAX_FILES_PER_UPLOAD,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_FILES,
  attachmentHeaders,
  checkUpload,
  contentDispositionFor,
  defaultKindFor,
  importFormatFor,
  isFileKind,
  resolveContentType,
  sanitiseFilename,
  storageKeyFor,
} from '#/server/fns/file-policy'
import { kindForFile, screenFiles } from '../screening'

const UNLIMITED = { usedBytes: 0, limitBytes: Number.POSITIVE_INFINITY }

function file(name: string, type: string, size: number): File {
  const blob = new File([new Uint8Array(Math.min(size, 8))], name, { type })
  // jsdom derives `size` from the parts, and a test must not allocate 30 MB to
  // assert a size check. The property is read-only, so it is redefined.
  Object.defineProperty(blob, 'size', { value: size })
  return blob
}

describe('resolveContentType', () => {
  it('accepts a media type on the allow-list', () => {
    expect(resolveContentType('pass.pdf', 'application/pdf')).toBe(
      'application/pdf',
    )
  })

  it('normalises a parameterised header', () => {
    expect(resolveContentType('notes.txt', 'text/plain; charset=utf-8')).toBe(
      'text/plain',
    )
  })

  it('falls back to the extension when the browser reports nothing usable', () => {
    expect(resolveContentType('pass.pdf', '')).toBe('application/pdf')
    expect(resolveContentType('pass.pdf', 'application/octet-stream')).toBe(
      'application/pdf',
    )
  })

  it('refuses a type that is not on the list', () => {
    expect(resolveContentType('run.exe', 'application/x-msdownload')).toBeNull()
    expect(resolveContentType('script.js', 'text/javascript')).toBeNull()
  })

  it('refuses a file with no extension and no usable type', () => {
    expect(resolveContentType('README', '')).toBeNull()
  })
})

describe('a wallet pass', () => {
  const PASS_TYPE = 'application/vnd.apple.pkpass'

  it.each(['', 'application/octet-stream', PASS_TYPE])(
    'resolves to the pass type through the extension when the claimed type is %j',
    (claimed) => {
      expect(resolveContentType('boarding.pkpass', claimed)).toBe(PASS_TYPE)
      expect(resolveContentType('BOARDING.PKPASS', claimed)).toBe(PASS_TYPE)
    },
  )

  it('is filed as a ticket, whichever way its type arrives', () => {
    expect(defaultKindFor('boarding.pkpass', PASS_TYPE)).toBe('ticket')
    expect(defaultKindFor('boarding.pkpass', 'application/octet-stream')).toBe(
      'ticket',
    )
    expect(kindForFile(file('boarding.pkpass', '', 128))).toBe('ticket')
    expect(kindForFile(file('boarding.pkpass', PASS_TYPE, 128))).toBe('ticket')
  })

  it('passes the upload policy with an empty or generic-binary type', () => {
    for (const contentType of ['', 'application/octet-stream']) {
      expect(
        checkUpload(
          { filename: 'boarding.pkpass', contentType, sizeBytes: 4096 },
          UNLIMITED,
        ),
      ).toBeNull()
    }
  })

  it('is offered by the file picker', () => {
    expect(ACCEPT_ATTRIBUTE.split(',')).toContain('.pkpass')
  })

  it('is still refused by the booking import, which cannot read a zip', () => {
    expect(IMPORT_ACCEPT_ATTRIBUTE.split(',')).not.toContain('.pkpass')
    expect(importFormatFor('boarding.pkpass', PASS_TYPE)).toBeNull()
  })

  it('is screened as accepted before it leaves the browser', () => {
    const { accepted, rejected } = screenFiles(
      [file('boarding.pkpass', 'application/octet-stream', 4096)],
      { usedBytes: 0, limitBytes: Number.POSITIVE_INFINITY },
    )
    expect(accepted).toHaveLength(1)
    expect(rejected).toHaveLength(0)
  })
})

describe('contentDispositionFor', () => {
  it('is an attachment carrying the encoded name', () => {
    expect(contentDispositionFor('Boarding pass.pkpass')).toBe(
      "attachment; filename*=UTF-8''Boarding%20pass.pkpass",
    )
  })

  it('encodes a non-Latin name so the header stays ASCII', () => {
    expect(contentDispositionFor('京都.pdf')).toBe(
      "attachment; filename*=UTF-8''%E4%BA%AC%E9%83%BD.pdf",
    )
  })
})

describe('attachmentHeaders', () => {
  it('serves a wallet pass under the pass type, as an uncached attachment', () => {
    const headers = attachmentHeaders({
      filename: 'boarding.pkpass',
      contentType: 'application/vnd.apple.pkpass',
      sizeBytes: 4096,
    })
    expect(headers).toEqual({
      'content-type': 'application/vnd.apple.pkpass',
      'content-length': '4096',
      'content-disposition': contentDispositionFor('boarding.pkpass'),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    })
  })

  it('echoes a stored text/html type verbatim and still forbids sniffing', () => {
    const headers = attachmentHeaders({
      filename: 'page.html',
      contentType: 'text/html',
      sizeBytes: 12,
    })
    expect(headers['content-type']).toBe('text/html')
    expect(headers['content-disposition']).toMatch(/^attachment;/u)
    expect(headers['cache-control']).toBe('private, no-store')
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
})

describe('defaultKindFor', () => {
  it('files a photo as an image and a PDF as a document', () => {
    expect(defaultKindFor('shrine.jpg', 'image/jpeg')).toBe('image')
    expect(defaultKindFor('insurance.pdf', 'application/pdf')).toBe('document')
  })

  it('files a route export as a map', () => {
    expect(defaultKindFor('walk.gpx', 'application/gpx+xml')).toBe('map')
  })

  it('falls back to "other" for anything it cannot place', () => {
    expect(defaultKindFor('mystery', 'application/octet-stream')).toBe('other')
  })

  it('agrees with the kind guard', () => {
    expect(isFileKind(defaultKindFor('shrine.jpg', 'image/jpeg'))).toBe(true)
    expect(isFileKind('spreadsheet')).toBe(false)
  })
})

describe('sanitiseFilename', () => {
  it('keeps an ordinary name intact', () => {
    expect(sanitiseFilename('Boarding pass.pdf')).toBe('Boarding pass.pdf')
  })

  it('strips a directory traversal attempt down to the basename', () => {
    expect(sanitiseFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitiseFilename('..\\..\\windows\\system32')).toBe('system32')
  })

  it('removes quotes, which would break a content-disposition header', () => {
    expect(sanitiseFilename('a"b\'c`d.pdf')).toBe('abcd.pdf')
  })

  it('removes control characters', () => {
    expect(sanitiseFilename('tick\u0000et\u001f.pdf')).toBe('ticket.pdf')
  })

  it('collapses runs of whitespace', () => {
    expect(sanitiseFilename('two    spaces.pdf')).toBe('two spaces.pdf')
  })

  it('keeps non-Latin names, which are perfectly valid', () => {
    expect(sanitiseFilename('京都の切符.pdf')).toBe('京都の切符.pdf')
  })

  it('never returns an empty name', () => {
    expect(sanitiseFilename('')).toBe('attachment')
    expect(sanitiseFilename('///')).toBe('attachment')
    expect(sanitiseFilename('"""')).toBe('attachment')
  })

  it('caps the length so a key cannot be pushed past R2 limits', () => {
    expect(sanitiseFilename(`${'a'.repeat(400)}.pdf`).length).toBe(160)
  })
})

describe('storageKeyFor', () => {
  it('puts the tenant first, so a bucket listing is scoped', () => {
    expect(
      storageKeyFor({
        organizationId: 'org-1',
        tripId: 'trip-1',
        fileId: 'file-1',
        filename: 'pass.pdf',
      }),
    ).toBe('trips/org-1/trip-1/file-1-pass.pdf')
  })

  it('sanitises the filename it embeds', () => {
    expect(
      storageKeyFor({
        organizationId: 'org-1',
        tripId: 'trip-1',
        fileId: 'file-1',
        filename: '../secrets.pdf',
      }),
    ).toBe('trips/org-1/trip-1/file-1-secrets.pdf')
  })
})

describe('checkUpload', () => {
  it('accepts an ordinary document', () => {
    expect(
      checkUpload(
        {
          filename: 'pass.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
        },
        UNLIMITED,
      ),
    ).toBeNull()
  })

  it('refuses an empty file', () => {
    expect(
      checkUpload(
        { filename: 'pass.pdf', contentType: 'application/pdf', sizeBytes: 0 },
        UNLIMITED,
      )?.code,
    ).toBe('empty')
  })

  it('refuses a file over the per-object ceiling', () => {
    const rejection = checkUpload(
      {
        filename: 'video.pdf',
        contentType: 'application/pdf',
        sizeBytes: MAX_FILE_BYTES + 1,
      },
      UNLIMITED,
    )
    expect(rejection?.code).toBe('too-large')
    expect(rejection?.message).toContain('video.pdf')
  })

  it('refuses a type that is not accepted', () => {
    expect(
      checkUpload(
        {
          filename: 'run.exe',
          contentType: 'application/x-msdownload',
          sizeBytes: 1024,
        },
        UNLIMITED,
      )?.code,
    ).toBe('unsupported-type')
  })

  it('refuses a file that would break the plan quota, and says how much is left', () => {
    const rejection = checkUpload(
      { filename: 'pass.pdf', contentType: 'application/pdf', sizeBytes: 600 },
      { usedBytes: 700, limitBytes: 1000 },
    )
    expect(rejection?.code).toBe('quota')
    expect(rejection?.message).toContain('300 B')
  })

  it('counts bytes already pending in the same batch against the quota', () => {
    expect(
      checkUpload(
        {
          filename: 'pass.pdf',
          contentType: 'application/pdf',
          sizeBytes: 200,
        },
        { usedBytes: 0, limitBytes: 1000, pendingBytes: 900 },
      )?.code,
    ).toBe('quota')
  })

  it('treats an infinite limit as no limit', () => {
    expect(
      checkUpload(
        {
          filename: 'pass.pdf',
          contentType: 'application/pdf',
          sizeBytes: MAX_FILE_BYTES,
        },
        { usedBytes: 10 ** 12, limitBytes: Number.POSITIVE_INFINITY },
      ),
    ).toBeNull()
  })

  it('checks the size before the type, so the bigger problem is reported first', () => {
    expect(
      checkUpload(
        {
          filename: 'huge.exe',
          contentType: 'application/x-msdownload',
          sizeBytes: MAX_FILE_BYTES + 1,
        },
        UNLIMITED,
      )?.code,
    ).toBe('too-large')
  })
})

describe('screenFiles', () => {
  it('splits a drop into what will be sent and what will not', () => {
    const good = file('pass.pdf', 'application/pdf', 1024)
    const bad = file('run.exe', 'application/x-msdownload', 1024)

    const { accepted, rejected } = screenFiles([good, bad], UNLIMITED)

    expect(accepted).toEqual([good])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.file).toBe(bad)
    expect(rejected[0]?.message).toContain('run.exe')
  })

  it('carries each accepted size into the budget for the next file', () => {
    const first = file('one.pdf', 'application/pdf', 600)
    const second = file('two.pdf', 'application/pdf', 600)

    const { accepted, rejected } = screenFiles([first, second], {
      usedBytes: 0,
      limitBytes: 1000,
    })

    expect(accepted).toEqual([first])
    expect(rejected[0]?.file).toBe(second)
    expect(rejected[0]?.message).toContain('plan')
  })

  it('keeps two files that happen to share a name apart', () => {
    const first = file('pass.pdf', 'application/pdf', 1024)
    const second = file('pass.pdf', 'application/pdf', 1024)

    const { accepted } = screenFiles([first, second], UNLIMITED)

    expect(accepted).toHaveLength(2)
    expect(accepted[0]).toBe(first)
    expect(accepted[1]).toBe(second)
  })

  it('caps how many files one drop may carry', () => {
    const files = Array.from({ length: MAX_FILES_PER_UPLOAD + 2 }, (_, index) =>
      file(`pass-${index}.pdf`, 'application/pdf', 16),
    )

    const { accepted, rejected } = screenFiles(files, UNLIMITED)

    expect(accepted).toHaveLength(MAX_FILES_PER_UPLOAD)
    expect(rejected).toHaveLength(2)
    expect(rejected[0]?.message).toContain('at once')
  })

  it('accepts an empty drop without complaint', () => {
    expect(screenFiles([], UNLIMITED)).toEqual({ accepted: [], rejected: [] })
  })
})

describe('kindForFile', () => {
  it('reads the kind through the extension fallback', () => {
    expect(kindForFile(file('shrine.JPG', '', 128))).toBe('image')
  })

  it('prefers a usable reported media type', () => {
    expect(kindForFile(file('ticket', 'application/pdf', 128))).toBe('document')
  })
})

describe('importFormatFor', () => {
  it('routes the two formats with a grammar to the deterministic parsers', () => {
    expect(importFormatFor('trip.ics', 'text/calendar')).toBe('ics')
    expect(importFormatFor('export.json', 'application/json')).toBe('json')
  })

  it('routes everything else it reads to the document branch', () => {
    expect(importFormatFor('stay.pdf', 'application/pdf')).toBe('document')
    expect(importFormatFor('mail.eml', 'message/rfc822')).toBe('document')
    expect(importFormatFor('page.html', 'text/html')).toBe('document')
    expect(importFormatFor('voucher.jpg', 'image/jpeg')).toBe('document')
    expect(
      importFormatFor(
        'itinerary.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('document')
  })

  it('answers null for a stored format an import cannot read', () => {
    expect(
      importFormatFor('pass.pkpass', 'application/octet-stream'),
    ).toBeNull()
    expect(importFormatFor('bundle.zip', 'application/zip')).toBeNull()
    expect(importFormatFor('clip.mp4', 'video/mp4')).toBeNull()
    expect(importFormatFor('route.gpx', 'application/gpx+xml')).toBeNull()
  })

  it('reads the format from the extension when the browser reported nothing usable', () => {
    expect(importFormatFor('trip.ics', '')).toBe('ics')
    expect(importFormatFor('mail.eml', 'application/octet-stream')).toBe(
      'document',
    )
  })

  it('never lets a reported media type widen what an import reads', () => {
    expect(importFormatFor('pass.pkpass', 'application/pdf')).toBeNull()
  })

  it('falls back to the media type only for a stored file with no extension', () => {
    expect(importFormatFor('ticket', 'application/pdf')).toBe('document')
    expect(importFormatFor('ticket', 'application/zip')).toBeNull()
  })

  it('resolves every extension its own accept attribute offers', () => {
    const extensions = IMPORT_ACCEPT_ATTRIBUTE.split(',')

    expect(extensions.length).toBeGreaterThan(0)
    for (const extension of extensions) {
      expect(importFormatFor(`confirmation${extension}`, '')).not.toBeNull()
    }
  })

  it('keeps the import ceiling below the ceiling on a stored file', () => {
    expect(MAX_IMPORT_BYTES).toBeLessThan(MAX_FILE_BYTES)
    expect(MAX_IMPORT_FILES).toBeLessThan(MAX_FILES_PER_UPLOAD)
  })
})
