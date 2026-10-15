import { describe, expect, it } from 'vitest'

import { safePastedFilename, sanitiseFilename } from '#/server/fns/file-policy'
import { filesFromClipboard, nameForPaste, shouldTakePaste } from '../paste'

/** 2026-10-04 12:34:56 in the machine's own clock, which is what the name must show. */
const NOON = new Date(2026, 9, 4, 12, 34, 56)
const STAMP = '20261004-123456'

function file(name: string, type: string): File {
  return new File(['x'], name, { type })
}

function item(from: File | null, kind = 'file') {
  return { kind, type: from?.type ?? 'text/plain', getAsFile: () => from }
}

/** The two lists a `DataTransfer` offers, as the array-likes the reader needs. */
function clipboard(
  files: ReadonlyArray<File>,
  items: ReadonlyArray<ReturnType<typeof item>>,
) {
  return {
    files: files as unknown as FileList,
    items: items as unknown as DataTransferItemList,
  }
}

describe('safePastedFilename', () => {
  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/avif', 'avif'],
    ['image/gif', 'gif'],
    ['image/heic', 'heic'],
    ['image/svg+xml', 'svg'],
  ])('gives %s the extension .%s', (type, extension) => {
    expect(safePastedFilename(type, NOON, 1)).toBe(`${STAMP}.${extension}`)
  })

  it('takes the subtype for an image type the table does not list', () => {
    expect(safePastedFilename('image/tiff', NOON, 1)).toBe(`${STAMP}.tiff`)
  })

  it('falls back to .bin for a type that is not an image and not listed', () => {
    expect(safePastedFilename('', NOON, 1)).toBe(`${STAMP}.bin`)
    expect(safePastedFilename('application/x-unknown', NOON, 1)).toBe(
      `${STAMP}.bin`,
    )
  })

  it('numbers the second and later file of a second before the extension', () => {
    expect(safePastedFilename('image/png', NOON, 2)).toBe(`${STAMP}-2.png`)
    expect(safePastedFilename('image/png', NOON, 3)).toBe(`${STAMP}-3.png`)
  })

  it('pads every field so names sort in the order they were made', () => {
    const early = new Date(2026, 0, 2, 3, 4, 5)
    expect(safePastedFilename('image/png', early, 1)).toBe(
      '20260102-030405.png',
    )
  })

  it('keeps a hostile subtype out of the name', () => {
    const name = safePastedFilename('image/../../etc/passwd', NOON, 1)
    expect(name).toBe(sanitiseFilename(name))
    expect(name).not.toContain('/')
  })
})

describe('filesFromClipboard', () => {
  const shot = file('image.png', 'image/png')

  it('reads the file list', () => {
    expect(filesFromClipboard(clipboard([shot], []))).toEqual([shot])
  })

  it('reads the items when the file list is empty', () => {
    expect(filesFromClipboard(clipboard([], [item(shot)]))).toEqual([shot])
  })

  it('never reads both, so one paste does not upload a screenshot twice', () => {
    expect(filesFromClipboard(clipboard([shot], [item(shot)]))).toEqual([shot])
  })

  it('returns nothing for plain text', () => {
    const text = item(null, 'string')
    expect(filesFromClipboard(clipboard([], [text]))).toEqual([])
  })

  it('skips an item that offers no file', () => {
    expect(filesFromClipboard(clipboard([], [item(null)]))).toEqual([])
  })
})

describe('nameForPaste', () => {
  it('renames a screenshot that carries the browser placeholder name', () => {
    const [named] = nameForPaste(
      [file('image.png', 'image/png')],
      NOON,
      new Map(),
    )
    expect(named?.name).toBe(`${STAMP}.png`)
    expect(named?.type).toBe('image/png')
  })

  it('renames a file with no name, and matches the placeholder in any case', () => {
    const named = nameForPaste(
      [file('', 'image/jpeg'), file('IMAGE.PNG', 'image/png')],
      NOON,
      new Map(),
    )
    expect(named.map((entry) => entry.name)).toEqual([
      `${STAMP}.jpg`,
      `${STAMP}-2.png`,
    ])
  })

  it('keeps the real name of a file copied from a file manager', () => {
    const [kept] = nameForPaste(
      [file('Hotel-Lisbon-booking.pdf', 'application/pdf')],
      NOON,
      new Map(),
    )
    expect(kept?.name).toBe('Hotel-Lisbon-booking.pdf')
  })

  it('names a pasted TIFF .tiff, so the refusal names what was pasted', () => {
    const [named] = nameForPaste(
      [file('image.tiff', 'image/tiff')],
      NOON,
      new Map(),
    )
    expect(named?.name).toBe(`${STAMP}.tiff`)
  })

  it('gives two screenshots of one paste distinct names', () => {
    const named = nameForPaste(
      [file('image.png', 'image/png'), file('image.png', 'image/png')],
      NOON,
      new Map(),
    )
    expect(named.map((entry) => entry.name)).toEqual([
      `${STAMP}.png`,
      `${STAMP}-2.png`,
    ])
  })

  it('keeps counting across pastes of the same second', () => {
    const seen = new Map<string, number>()
    const first = nameForPaste([file('image.png', 'image/png')], NOON, seen)
    const again = nameForPaste([file('image.png', 'image/png')], NOON, seen)
    expect(first[0]?.name).toBe(`${STAMP}.png`)
    expect(again[0]?.name).toBe(`${STAMP}-2.png`)
  })

  it('starts again at the next second', () => {
    const seen = new Map<string, number>()
    nameForPaste([file('image.png', 'image/png')], NOON, seen)
    const later = nameForPaste(
      [file('image.png', 'image/png')],
      new Date(2026, 9, 4, 12, 34, 57),
      seen,
    )
    expect(later[0]?.name).toBe('20261004-123457.png')
  })

  it('does not count a file that kept its name', () => {
    const seen = new Map<string, number>()
    nameForPaste([file('ticket.pdf', 'application/pdf')], NOON, seen)
    const [named] = nameForPaste([file('image.png', 'image/png')], NOON, seen)
    expect(named?.name).toBe(`${STAMP}.png`)
  })
})

describe('shouldTakePaste', () => {
  function pasteOn(
    target: EventTarget | null,
    defaultPrevented = false,
  ): Pick<Event, 'defaultPrevented' | 'target'> {
    return { defaultPrevented, target }
  }

  /** A paste as `document` receives it from inside an open shadow root: retargeted to the host. */
  function pasteFromShadow(html: string): Pick<
    Event,
    'defaultPrevented' | 'target'
  > & {
    composedPath: () => Array<EventTarget>
  } {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = html
    const inner = root.querySelector('[data-target]')
    if (inner === null) throw new Error('fixture has no target')
    return {
      defaultPrevented: false,
      target: host,
      composedPath: () => [inner, root, host, document.body],
    }
  }

  function mount(html: string): Element {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    const target = host.querySelector('[data-target]')
    if (target === null) throw new Error('fixture has no target')
    return target
  }

  it('takes a paste on the page body', () => {
    expect(shouldTakePaste(pasteOn(document.body))).toBe(true)
  })

  it('takes a paste while a button has focus', () => {
    expect(
      shouldTakePaste(pasteOn(mount('<button data-target>Go</button>'))),
    ).toBe(true)
  })

  it.each([
    ['an input', '<input data-target />'],
    ['a textarea', '<textarea data-target></textarea>'],
    ['a select', '<select data-target></select>'],
    ['a contenteditable', '<div data-target contenteditable="true"></div>'],
    [
      'inside a dialog',
      '<div role="dialog"><button data-target>x</button></div>',
    ],
    [
      'inside an alert dialog',
      '<div role="alertdialog"><button data-target>x</button></div>',
    ],
    ['inside a menu', '<div role="menu"><button data-target>x</button></div>'],
    [
      'inside a native dialog',
      '<dialog open><button data-target>x</button></dialog>',
    ],
  ])('ignores a paste on %s', (_name, html) => {
    expect(shouldTakePaste(pasteOn(mount(html)))).toBe(false)
  })

  it('ignores a paste into a field inside a shadow root, as the feedback form is', () => {
    expect(
      shouldTakePaste(pasteFromShadow('<textarea data-target></textarea>')),
    ).toBe(false)
    expect(
      shouldTakePaste(
        pasteFromShadow('<dialog open><button data-target>x</button></dialog>'),
      ),
    ).toBe(false)
  })

  it('takes a paste from a button inside a shadow root', () => {
    expect(
      shouldTakePaste(pasteFromShadow('<button data-target>Go</button>')),
    ).toBe(true)
  })

  it('ignores a paste something already handled', () => {
    expect(shouldTakePaste(pasteOn(document.body, true))).toBe(false)
  })

  it('takes a paste whose target is not an element', () => {
    expect(shouldTakePaste(pasteOn(null))).toBe(true)
  })
})
