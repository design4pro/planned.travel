import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { previewImage } from '../preview-image'

beforeEach(() => {
  vi.stubGlobal(
    'FileReader',
    class {
      result = 'data:image/svg+xml;base64,PHN2Zy8+'
      onload = () => {}
      readAsDataURL() {
        this.onload()
      }
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

it('exposes only PNG pixels, bounds dimensions and never creates an SVG object URL', async () => {
  const raster = new Blob(['pixels'], { type: 'image/png' })
  const create = vi.fn()
  const draw = vi.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: draw }),
    toBlob: (callback: BlobCallback, type: string) => {
      expect(type).toBe('image/png')
      callback(raster)
    },
  }
  vi.stubGlobal('URL', {
    createObjectURL: create,
  })
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      naturalWidth = 8192
      naturalHeight = 4096
      decode = vi.fn().mockResolvedValue(undefined)
    },
  )
  vi.stubGlobal('document', { createElement: () => canvas })
  expect(
    await previewImage(new Blob(['<svg/>'], { type: 'image/svg+xml' })),
  ).toBe(raster)
  expect([canvas.width, canvas.height]).toEqual([4096, 2048])
  expect(draw).toHaveBeenCalledOnce()
  expect(create).not.toHaveBeenCalled()
})

it('propagates image decoding failures without creating a markup URL', async () => {
  const create = vi.fn()
  vi.stubGlobal('URL', {
    createObjectURL: create,
  })
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      decode = vi.fn().mockRejectedValue(new Error('Invalid image'))
    },
  )
  await expect(previewImage(new Blob(['invalid']))).rejects.toThrow(
    'Invalid image',
  )
  expect(create).not.toHaveBeenCalled()
})
