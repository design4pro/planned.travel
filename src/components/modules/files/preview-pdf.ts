import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'

GlobalWorkerOptions.workerSrc = workerUrl

const assets = import.meta.glob<string>(
  '/node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*.{bcmap,ttf,pfb,wasm}',
  { eager: true, query: '?url', import: 'default' },
)

class LocalPdfData {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const directories: Record<string, string> = {
      cMapUrl: 'cmaps',
      standardFontDataUrl: 'standard_fonts',
      wasmUrl: 'wasm',
    }
    const url =
      assets[`/node_modules/pdfjs-dist/${directories[kind]}/${filename}`]
    if (!url) throw new Error('Missing PDF asset')
    const response = await fetch(url)
    if (!response.ok) throw new Error('Unable to load PDF asset')
    return new Uint8Array(await response.arrayBuffer())
  }
}

export function previewPdf(
  blob: Blob,
  container: HTMLElement,
  onReady: () => void,
  onError: () => void,
) {
  let live = true
  let destroy = () => {}
  const layers: TextLayer[] = []
  const renders: Array<{ cancel: () => void }> = []
  void blob
    .arrayBuffer()
    .then(async (data) => {
      if (!live) return
      const task = getDocument({
        data,
        useWorkerFetch: false,
        BinaryDataFactory: LocalPdfData,
      })
      destroy = () => {
        void task.destroy()
      }
      const pdf = await task.promise
      for (let number = 1; number <= pdf.numPages && live; number++) {
        const page = await pdf.getPage(number)
        if (!live) return
        const original = page.getViewport({ scale: 1 })
        const scale = Math.min(
          (container.clientWidth || 800) / original.width,
          2,
          4096 / Math.max(original.width, original.height),
        )
        const viewport = page.getViewport({ scale })
        const wrapper = document.createElement('div')
        wrapper.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto 16px;background:white;--total-scale-factor:${scale}`
        const canvas = document.createElement('canvas')
        canvas.setAttribute('aria-hidden', 'true')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const text = document.createElement('div')
        text.className = 'textLayer'
        wrapper.appendChild(canvas)
        wrapper.appendChild(text)
        container.appendChild(wrapper)
        const render = page.render({ canvas, viewport })
        renders.push(render)
        await render.promise
        if (!live) return
        const textContent = await page.getTextContent()
        if (!live) return
        const layer = new TextLayer({
          container: text,
          viewport,
          textContentSource: textContent,
        })
        layers.push(layer)
        await layer.render()
        page.cleanup()
      }
      if (live) onReady()
    })
    .catch(() => {
      if (live) onError()
    })
  return () => {
    live = false
    for (const layer of layers) layer.cancel()
    for (const render of renders) render.cancel()
    destroy()
    container.replaceChildren()
  }
}
