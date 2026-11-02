import { afterEach, expect, it, vi } from 'vitest'
import { previewPdf } from '../preview-pdf'

const { load, destroy, render, cancel, textCancel, textRender } = vi.hoisted(
  () => ({
    load: vi.fn(),
    destroy: vi.fn(),
    render: vi.fn(),
    cancel: vi.fn(),
    textCancel: vi.fn(),
    textRender: vi.fn(),
  }),
)
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: load,
  TextLayer: class {
    constructor({ container }: { container: HTMLElement }) {
      container.textContent = 'Readable ticket'
    }
    render = textRender
    cancel = textCancel
  },
}))

afterEach(() => vi.resetAllMocks())

it('renders every page with a text layer and releases the document and renders on close', async () => {
  render.mockReturnValue({ promise: Promise.resolve(), cancel })
  textRender.mockResolvedValue(undefined)
  const page = {
    getViewport: () => ({ width: 600, height: 800 }),
    render,
    getTextContent: vi.fn().mockResolvedValue({ items: [] }),
    cleanup: vi.fn(),
  }
  load.mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(page),
    }),
    destroy,
  })
  const container = document.createElement('div')
  const ready = vi.fn()
  const fail = vi.fn()
  const blob = { arrayBuffer: async () => new ArrayBuffer(8) } as Blob
  const dispose = previewPdf(blob, container, ready, fail)
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce())
  expect(container.querySelectorAll('canvas')).toHaveLength(2)
  expect(container.textContent).toBe('Readable ticketReadable ticket')
  expect(fail).not.toHaveBeenCalled()
  dispose()
  expect(destroy).toHaveBeenCalledOnce()
  expect(cancel).toHaveBeenCalledTimes(2)
  expect(textCancel).toHaveBeenCalledTimes(2)
  expect(container.childNodes).toHaveLength(0)
})

it('reports invalid PDFs and ignores a document that finishes loading after close', async () => {
  const failed = vi.fn()
  const container = document.createElement('div')
  const blob = { arrayBuffer: async () => new ArrayBuffer(8) } as Blob
  load.mockReturnValueOnce({
    promise: Promise.reject(new Error('Invalid PDF')),
    destroy,
  })
  const dispose = previewPdf(blob, container, vi.fn(), failed)
  await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce())
  dispose()
  let finish: (value: { numPages: number }) => void = () => {}
  load.mockReturnValueOnce({
    promise: new Promise((resolve) => {
      finish = resolve
    }),
    destroy,
  })
  const ready = vi.fn()
  const close = previewPdf(blob, container, ready, failed)
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  close()
  finish({ numPages: 0 })
  await Promise.resolve()
  expect(ready).not.toHaveBeenCalled()
  expect(failed).toHaveBeenCalledOnce()
})

it('does not create a text layer when text extraction finishes after close', async () => {
  let finish: (value: { items: [] }) => void = () => {}
  const text = new Promise((resolve) => {
    finish = resolve
  })
  const getTextContent = vi.fn().mockReturnValue(text)
  render.mockReturnValue({ promise: Promise.resolve(), cancel })
  load.mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 600, height: 800 }),
        render,
        getTextContent,
        cleanup: vi.fn(),
      }),
    }),
    destroy,
  })
  const ready = vi.fn()
  const failure = vi.fn()
  const dispose = previewPdf(
    { arrayBuffer: async () => new ArrayBuffer(8) } as Blob,
    document.createElement('div'),
    ready,
    failure,
  )
  await vi.waitFor(() => expect(getTextContent).toHaveBeenCalledOnce())
  dispose()
  finish({ items: [] })
  await Promise.resolve()
  await Promise.resolve()
  expect(textRender).not.toHaveBeenCalled()
  expect(ready).not.toHaveBeenCalled()
  expect(failure).not.toHaveBeenCalled()
})
