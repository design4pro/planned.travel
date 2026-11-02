import { afterEach, expect, it, vi } from 'vitest'
import { previewImage } from '../preview-image'

afterEach(() => vi.unstubAllGlobals())

it('exposes only PNG pixels, bounds dimensions and revokes the private SVG source', async () => {
  const raster = new Blob(['pixels'], { type: 'image/png' })
  const revoke = vi.fn()
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
    createObjectURL: () => 'blob:private-svg',
    revokeObjectURL: revoke,
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
  expect(revoke).toHaveBeenCalledWith('blob:private-svg')
})

it('revokes the private source when image decoding fails', async () => {
  const revoke = vi.fn()
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:private-svg',
    revokeObjectURL: revoke,
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
  expect(revoke).toHaveBeenCalledWith('blob:private-svg')
})
