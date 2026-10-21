/** QR's restricted byte-mode subset: level M, versions 1-10, UTF-8 input.
 * No storage, rendering or transport: callers own the secret's lifetime.
 * Block layout and polynomial arithmetic follow ISO/IEC 18004.
 */
export class MatrixCodeCapacityError extends Error {
  constructor() {
    super('Matrix code capacity exceeded')
    this.name = 'MatrixCodeCapacityError'
  }
}

const capacities = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]
const parityLengths = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const blockCounts = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const alignmentCenters = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

function multiply(a: number, b: number): number {
  let result = 0
  for (let bit = 7; bit >= 0; bit--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    result ^= ((b >>> bit) & 1) * a
  }
  return result
}

export function matrixCodeParity(
  data: ReadonlyArray<number>,
  degree: number,
): number[] {
  let divisor = [1]
  let root = 1
  for (let i = 0; i < degree; i++) {
    const next = Array<number>(divisor.length + 1).fill(0)
    for (let j = 0; j < divisor.length; j++) {
      next[j] ^= divisor[j]
      next[j + 1] ^= multiply(divisor[j], root)
    }
    divisor = next
    root = multiply(root, 2)
  }
  const remainder = Array<number>(degree).fill(0)
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.shift()
    remainder.push(0)
    for (let j = 0; j < degree; j++)
      remainder[j] ^= multiply(divisor[j + 1], factor)
  }
  return remainder
}

function codewords(bytes: Uint8Array, version: number): number[] {
  const blockCount = blockCounts[version - 1]
  const parityLength = parityLengths[version - 1]
  // Raw data modules, with alignment and (from version 7) version information removed.
  let raw = (16 * version + 128) * version + 64
  if (version >= 2) {
    const centers = Math.floor(version / 7) + 2
    raw -= (25 * centers - 10) * centers - 55
    if (version >= 7) raw -= 36
  }
  const total = Math.floor(raw / 8)
  const dataLength = total - blockCount * parityLength
  const bits: number[] = []
  const append = (value: number, width: number) => {
    for (let bit = width - 1; bit >= 0; bit--) bits.push((value >>> bit) & 1)
  }
  append(4, 4)
  append(bytes.length, version < 10 ? 8 : 16)
  for (const byte of bytes) append(byte, 8)
  append(0, Math.min(4, dataLength * 8 - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    data.push(
      bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0),
    )
  }
  for (let pad = 0; data.length < dataLength; pad++)
    data.push(pad % 2 === 0 ? 0xec : 0x11)
  const shortLength = Math.floor(dataLength / blockCount)
  const shortCount = blockCount - (total % blockCount)
  const blocks: number[][] = []
  const checks: number[][] = []
  let offset = 0
  for (let block = 0; block < blockCount; block++) {
    const length = shortLength + (block >= shortCount ? 1 : 0)
    const chunk = data.slice(offset, offset + length)
    blocks.push(chunk)
    checks.push(matrixCodeParity(chunk, parityLength))
    offset += length
  }
  const result: number[] = []
  for (let i = 0; i <= shortLength; i++) {
    for (const block of blocks) if (i < block.length) result.push(block[i])
  }
  for (let i = 0; i < parityLength; i++)
    for (const check of checks) result.push(check[i])
  return result
}

function masked(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

function penalty(matrix: boolean[][]): number {
  const size = matrix.length
  let score = 0
  let dark = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) dark++
      if (
        x + 1 < size &&
        y + 1 < size &&
        matrix[y][x] === matrix[y][x + 1] &&
        matrix[y][x] === matrix[y + 1][x] &&
        matrix[y][x] === matrix[y + 1][x + 1]
      )
        score += 3
    }
    for (const line of [matrix[y], matrix.map((row) => row[y])]) {
      let run = 1
      for (let i = 1; i < size; i++) {
        run = line[i] === line[i - 1] ? run + 1 : 1
        if (run === 5) score += 3
        else if (run > 5) score++
      }
      const bits = line.map((bit) => (bit ? '1' : '0')).join('')
      for (let i = 0; i <= size - 11; i++) {
        const pattern = bits.slice(i, i + 11)
        if (pattern === '00001011101' || pattern === '10111010000') score += 40
      }
    }
  }
  return (
    score +
    Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10
  )
}

export function encodeMatrixCode(
  input: string,
): ReadonlyArray<ReadonlyArray<boolean>> {
  // UTF-8 never uses fewer bytes than UTF-16 code units. Bound allocation before encoding.
  if (input.length > 213) throw new MatrixCodeCapacityError()
  const bytes = new TextEncoder().encode(input)
  const index = capacities.findIndex((capacity) => bytes.length <= capacity)
  if (index < 0) throw new MatrixCodeCapacityError()
  const version = index + 1
  const size = 17 + version * 4
  const grid = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  )
  const reserved = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  )
  const set = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    grid[y][x] = dark
    reserved[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        set(cx + dx, cy + dy, distance !== 2 && distance !== 4)
      }
  }
  const centers = alignmentCenters[index]
  for (let row = 0; row < centers.length; row++)
    for (let col = 0; col < centers.length; col++) {
      if (
        (row === 0 && (col === 0 || col === centers.length - 1)) ||
        (col === 0 && row === centers.length - 1)
      )
        continue
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          set(
            centers[col] + dx,
            centers[row] + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          )
        }
    }
  const format = (mask: number) => {
    // Level M has format prefix 00; BCH(15,5), then the mandated XOR mask.
    let remainder = mask
    for (let i = 0; i < 10; i++)
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
    const bits = ((mask << 10) | remainder) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) set(8, i, bit(i))
    set(8, 7, bit(6))
    set(8, 8, bit(7))
    set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
    set(8, size - 8, true)
  }
  format(0)
  if (version >= 7) {
    let remainder = version
    for (let i = 0; i < 12; i++)
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25)
    const bits = (version << 12) | remainder
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, ((bits >>> i) & 1) !== 0)
      set(b, a, ((bits >>> i) & 1) !== 0)
    }
  }
  const data = codewords(bytes, version)
  let cursor = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--
    for (let vertical = 0; vertical < size; vertical++) {
      const y = upward ? size - 1 - vertical : vertical
      for (let column = 0; column < 2; column++) {
        const x = right - column
        if (reserved[y][x]) continue
        grid[y][x] =
          cursor < data.length * 8 &&
          ((data[cursor >>> 3] >>> (7 - (cursor % 8))) & 1) !== 0
        cursor++
      }
    }
    upward = !upward
  }
  let best = grid
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    format(mask)
    const candidate = grid.map((row, y) =>
      row.map((dark, x) => dark !== (!reserved[y][x] && masked(mask, x, y))),
    )
    const score = penalty(candidate)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}
