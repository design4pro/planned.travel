/** Rasterise the inline favicon in src/routes/__root.tsx, using Node built-ins only. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const BACKGROUND = '#16150f'
const FOREGROUND = '#f8f7f4'
const rgb = (hex) =>
  [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
const dark = rgb(BACKGROUND)
const light = rgb(FOREGROUND)
const samples = 4

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function png(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6 // Eight-bit RGBA, non-interlaced, filter zero on each row.
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++)
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// The pin's right boundary: a semicircle above y=9.2, then the SVG's cubic
// (22.2,9.2) -> (22.2,11.8) -> (18.6,15.2) -> (18.6,15.2).
// Its y coordinate is monotonic, so bisection evaluates the curve without a polygon approximation.
function pinHalfWidth(y) {
  if (y < 5.6 || y > 15.2) return -1
  if (y <= 9.2) return Math.sqrt(Math.max(0, 3.6 ** 2 - (y - 9.2) ** 2))
  let low = 0,
    high = 1
  for (let i = 0; i < 32; i++) {
    const t = (low + high) / 2
    const curveY = 9.2 + 7.8 * t + 2.4 * t ** 2 - 4.2 * t ** 3
    if (curveY < y) low = t
    else high = t
  }
  const t = (low + high) / 2
  return 3.6 - 10.8 * t ** 2 + 7.2 * t ** 3
}

function render(size, fullBleed) {
  const pixels = Buffer.alloc(size * size * 4)
  // Full-bleed variants centre and shrink the mark into the 40%-radius safe circle.
  const scale = fullBleed ? 0.72 : 1
  for (let y = 0; y < size; y++) {
    const scanlines = Array.from({ length: samples }, (_, sy) => {
      const py = (((y + (sy + 0.5) / samples) * 28) / size - 14) / scale + 14
      return { py, halfWidth: pinHalfWidth(py) }
    })
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0]
      let covered = 0
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++) {
          const bx = ((x + (sx + 0.5) / samples) * 28) / size
          const by = ((y + (sy + 0.5) / samples) * 28) / size
          // Rounded 28x28 background with radius 9, exactly as in the SVG favicon.
          if (
            !fullBleed &&
            Math.hypot(
              Math.max(9 - bx, 0, bx - 19),
              Math.max(9 - by, 0, by - 19),
            ) > 9
          )
            continue
          const px = (bx - 14) / scale + 14
          const { py, halfWidth } = scanlines[sy]
          const dot = (px - 8.6) ** 2 + (py - 20.2) ** 2 <= 2.4 ** 2
          const pin = halfWidth >= 0 && Math.abs(px - 18.6) <= halfWidth
          const hole = (px - 18.6) ** 2 + (py - 9.2) ** 2 <= 1.25 ** 2
          const colour = dot || (pin && !hole) ? light : dark
          covered++
          for (let channel = 0; channel < 3; channel++)
            sum[channel] += colour[channel]
        }
      const offset = (y * size + x) * 4
      if (covered) {
        for (let channel = 0; channel < 3; channel++)
          pixels[offset + channel] = Math.round(sum[channel] / covered)
        pixels[offset + 3] = Math.round((covered / samples ** 2) * 255)
      }
    }
  }
  return png(size, pixels)
}

const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1]))
  throw new Error(
    'Usage: node scripts/render-app-icons.mjs [--out <directory>]',
  )
const out = resolve(args[1] ?? 'public/icons')
mkdirSync(out, { recursive: true })
for (const [name, size, fullBleed] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, true],
])
  writeFileSync(resolve(out, name), render(size, fullBleed))
