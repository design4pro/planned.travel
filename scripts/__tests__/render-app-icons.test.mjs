import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

// Decode RGBA PNG scanlines independently of the renderer; bytes may differ across zlib versions.
function decode(path) {
  const png = readFileSync(path)
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks = []
  let width, height
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const kind = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      expect([...data.subarray(8)]).toEqual([8, 6, 0, 0, 0])
    }
    if (kind === 'IDAT') chunks.push(data)
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  expect(raw.length).toBe(height * (stride + 1))
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    expect(filter).toBe(0)
    raw.copy(pixels, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1))
  }
  return {
    width,
    height,
    pixels,
    pixel: (x, y) => [
      ...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
    ],
  }
}

const icons = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, true],
]
const dark = [22, 21, 15, 255]
const light = [248, 247, 244, 255]

describe('render-app-icons program', () => {
  it('renders the favicon geometry, safe masks and committed pixels into --out', () => {
    const out = mkdtempSync(join(tmpdir(), 'planned-icons-'))
    try {
      execFileSync(process.execPath, [
        'scripts/render-app-icons.mjs',
        '--out',
        out,
      ])
      expect(readdirSync(out).sort()).toEqual(
        icons.map(([name]) => name).sort(),
      )
      const favicon = readFileSync('src/routes/__root.tsx', 'utf8')
      const script = readFileSync('scripts/render-app-icons.mjs', 'utf8')
      for (const colour of ['#16150f', '#f8f7f4']) {
        expect(favicon).toContain(`fill="${colour}"`)
        expect(script).toContain(colour)
      }
      for (const [name, size, fullBleed] of icons) {
        const image = decode(join(out, name))
        expect([image.width, image.height]).toEqual([size, size])
        expect(image.pixel(0, 0)).toEqual(fullBleed ? dark : [0, 0, 0, 0])
        const scale = fullBleed ? 0.72 : 1
        const position = (coordinate) =>
          Math.floor(((14 + (coordinate - 14) * scale) / 28) * size)
        expect(image.pixel(position(8.6), position(20.2))).toEqual(light)
        expect(image.pixel(position(18.6), position(9.2))).toEqual(dark)
        // A pin crown and its lower tip must both survive the rasterisation.
        expect(image.pixel(position(18.6), position(6.5))).toEqual(light)
        expect(image.pixel(position(18.6), position(14))).toEqual(light)
        if (fullBleed) {
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              if (
                Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) >
                size * 0.4
              ) {
                if (!image.pixel(x, y).every((value, i) => value === dark[i]))
                  throw new Error(
                    `${name}: mark escaped safe circle at ${x},${y}`,
                  )
              }
            }
        }
        const committed = decode(resolve('public/icons', name))
        expect(committed.width).toBe(size)
        expect(committed.height).toBe(size)
        expect(committed.pixels.equals(image.pixels)).toBe(true)
      }
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
