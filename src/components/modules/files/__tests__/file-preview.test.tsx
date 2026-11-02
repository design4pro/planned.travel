import '#/components/ui/__tests__/test-env'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { FilePreview } from '../file-preview'
import type { FileData } from '../types'

const { fetchBytes, save, raster } = vi.hoisted(() => ({
  fetchBytes: vi.fn(),
  save: vi.fn(),
  raster: vi.fn(),
}))
vi.mock('../preview-pdf', () => ({
  previewPdf: (_blob: Blob, target: HTMLElement, ready: () => void) => {
    target.textContent = 'Boarding PDF text'
    ready()
    return () => target.replaceChildren()
  },
}))
vi.mock('../preview-image', () => ({ previewImage: raster }))
vi.mock('../download', () => ({
  fetchTripFileBytes: fetchBytes,
  saveBlob: save,
}))
const files: FileData[] = ['one', 'two', 'three'].map((id) => ({
  id,
  filename: `${id}.png`,
  contentType: 'image/png',
  kind: 'image',
  sizeBytes: 10,
  description: null,
  uploadedBy: 'user',
  createdAt: '2026-01-01',
}))
const revoke = vi.fn()
const close = vi.fn()
beforeEach(() => {
  fetchBytes
    .mockReset()
    .mockResolvedValue(new Blob(['bytes'], { type: 'image/png' }))
  raster
    .mockReset()
    .mockResolvedValue(new Blob(['pixels'], { type: 'image/png' }))
  save.mockReset()
  revoke.mockReset()
  close.mockReset()
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: revoke,
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function open(selected = files[0]) {
  if (!selected) throw new Error('Missing fixture')
  return render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('modules', Modules),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <FilePreview
        tripId="trip"
        file={selected}
        files={files}
        onClose={close}
      />
    </I18nProvider>,
  )
}
it('loads an image, navigates with keys, respects ends and revokes on replacement and unmount', async () => {
  const view = open()
  await loadedImage('one.png')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'End' })
  await loadedImage('three.png')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
  expect(fetchBytes).toHaveBeenCalledTimes(2)
  expect(revoke).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(revoke).toHaveBeenCalledTimes(2)
})
it('shows loading, discards a completion after close without creating an object URL', async () => {
  let finish: (blob: Blob) => void = () => {}
  fetchBytes.mockReturnValue(
    new Promise<Blob>((resolve) => {
      finish = resolve
    }),
  )
  const view = open()
  expect(screen.getByRole('status')).toBeTruthy()
  view.unmount()
  finish(new Blob(['late'], { type: 'image/png' }))
  await waitFor(() => expect(URL.createObjectURL).not.toHaveBeenCalled())
})
it('shows a localized missing-copy alert for HTTP 410', async () => {
  fetchBytes.mockRejectedValue(
    Object.assign(new Error('gone'), { status: 410 }),
  )
  open()
  expect((await screen.findByRole('alert')).textContent).toContain(
    'stored copy',
  )
})
it.each(['text/plain'])('embeds only allowlisted document %s', async (type) => {
  fetchBytes.mockResolvedValue(new Blob(['bytes'], { type }))
  open()
  await waitFor(() =>
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe(
      'blob:preview',
    ),
  )
})
it('renders SVG only as a rasterized image', async () => {
  fetchBytes.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
  open()
  await loadedImage()
  expect(document.querySelector('iframe')).toBeNull()
  expect(raster).toHaveBeenCalledWith(expect.any(Blob))
  expect(URL.createObjectURL).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'image/png' }),
  )
})
it.each(['text/html', 'application/zip'])(
  'downloads unsupported %s without a preview URL',
  async (type) => {
    fetchBytes.mockResolvedValue(new Blob(['bytes'], { type }))
    open()
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(document.querySelector('iframe')).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  },
)
it('offers recovery after an image rendering error', async () => {
  open()
  fireEvent.error(await loadedImage())
  expect(screen.getByRole('alert')).toBeTruthy()
})

it('locks navigation while fetching the next image and recovers after a failure', async () => {
  open()
  await loadedImage('one.png')
  let fail: (error: Error) => void = () => {}
  fetchBytes.mockReturnValueOnce(
    new Promise<Blob>((_resolve, reject) => {
      fail = reject
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
  expect(
    screen
      .getByRole('button', { name: 'Next image' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'End' })
  expect(fetchBytes).toHaveBeenCalledTimes(2)
  fail(new Error('offline'))
  await screen.findByRole('alert')
  const retry = screen.getByRole('button', { name: 'Try again' })
  retry.focus()
  fireEvent.click(retry)
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'two.png' }),
  )
  await loadedImage('two.png')
})

it('navigates back and home using the gallery controls', async () => {
  open(files[2])
  await loadedImage('three.png')
  fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
  await loadedImage('two.png')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Home' })
  await loadedImage('one.png')
})

it('uses a horizontal touch swipe, ignoring vertical gestures', async () => {
  open()
  const image = await loadedImage('one.png')
  function pointer(type: string, x: number, y: number) {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, {
      pointerType: 'touch',
      pointerId: 1,
      clientX: x,
      clientY: y,
    })
    fireEvent(image, event)
  }
  pointer('pointerdown', 200, 100)
  pointer('pointerup', 190, 200)
  expect(fetchBytes).toHaveBeenCalledTimes(1)
  pointer('pointerdown', 200, 100)
  pointer('pointerup', 80, 110)
  await loadedImage('two.png')
})

it('downloads the displayed bytes from the header under the real filename', async () => {
  open()
  await loadedImage('one.png')
  fireEvent.click(screen.getByRole('button', { name: 'Download one.png' }))
  expect(save).toHaveBeenCalledWith(expect.any(Blob), 'one.png')
  expect(fetchBytes).toHaveBeenCalledTimes(1)
})

it('closes when Escape is pressed inside the plain-text document', async () => {
  fetchBytes.mockResolvedValue(
    new Blob(['boarding details'], { type: 'text/plain' }),
  )
  open()
  await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
  const frame = document.querySelector('iframe')
  if (frame === null || frame.contentDocument === null)
    throw new Error('Missing document frame')
  fireEvent.load(frame)
  fireEvent.keyDown(frame.contentDocument, { key: 'Escape' })
  expect(close).toHaveBeenCalledTimes(1)
})

it('moves focus to the filename before navigation disables its control', async () => {
  open()
  await loadedImage('one.png')
  const next = screen.getByRole('button', { name: 'Next image' })
  next.focus()
  fireEvent.click(next)
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: 'two.png' }),
  )
})

it('discards rasterization that completes after the preview closes', async () => {
  let finish: (blob: Blob) => void = () => {}
  raster.mockReturnValue(
    new Promise<Blob>((resolve) => {
      finish = resolve
    }),
  )
  fetchBytes.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
  const view = open()
  await waitFor(() => expect(raster).toHaveBeenCalledOnce())
  view.unmount()
  finish(new Blob(['pixels'], { type: 'image/png' }))
  await waitFor(() => expect(URL.createObjectURL).not.toHaveBeenCalled())
})

it('recovers from failed SVG rasterization without exposing the markup', async () => {
  raster.mockRejectedValue(new Error('Invalid SVG'))
  fetchBytes.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
  open()
  await screen.findByRole('alert')
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

it('downloads original SVG bytes while displaying rasterized pixels', async () => {
  const original = new Blob(['<svg/>'], { type: 'image/svg+xml' })
  fetchBytes.mockResolvedValue(original)
  open()
  await loadedImage()
  fireEvent.click(screen.getByRole('button', { name: 'Download one.png' }))
  expect(save).toHaveBeenCalledWith(original, 'one.png')
})

it('renders PDF text in a keyboard-focusable application document, without an iframe', async () => {
  fetchBytes.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  const view = open()
  const document = await screen.findByRole('document', { name: 'one.png' })
  await screen.findByText('Boarding PDF text')
  expect(document.getAttribute('tabindex')).toBe('0')
  expect(document.querySelector('iframe')).toBeNull()
  document.focus()
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(close).toHaveBeenCalled())
  view.unmount()
})

async function loadedImage(name?: string) {
  const image = await screen.findByRole('img', name ? { name } : undefined)
  fireEvent.load(image)
  return image
}

it('keeps gallery navigation disabled until the image has loaded', async () => {
  open()
  const image = await screen.findByRole('img', { name: 'one.png' })
  expect(
    screen
      .getByRole('button', { name: 'Next image' })
      .getAttribute('aria-disabled'),
  ).toBe('true')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'End' })
  expect(fetchBytes).toHaveBeenCalledTimes(1)
  fireEvent.load(image)
  expect(
    screen
      .getByRole('button', { name: 'Next image' })
      .getAttribute('aria-disabled'),
  ).not.toBe('true')
})
