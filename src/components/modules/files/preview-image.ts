/** Rasterize SVG before exposing an image source that native browser actions can navigate to. */
export async function previewImage(blob: Blob): Promise<Blob> {
  // Keep markup out of object URLs, including while a closed preview finishes decoding.
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Image preview failed'))
    }
    reader.onerror = () =>
      reject(reader.error ?? new Error('Image preview failed'))
    reader.readAsDataURL(blob)
  })
  const image = new Image()
  image.src = source
  await image.decode()
  // Bound the preview bitmap; the original remains available through Download.
  const scale = Math.min(
    1,
    4096 / Math.max(image.naturalWidth, image.naturalHeight),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Image preview is unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((raster) => {
      if (raster === null) reject(new Error('Image preview failed'))
      else resolve(raster)
    }, 'image/png')
  })
}
