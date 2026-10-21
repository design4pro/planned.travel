// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  encodeMatrixCode,
  MatrixCodeCapacityError,
  matrixCodeParity,
} from '../encode'
import vectors from './vectors.json'

/** Independent byte/M vectors: Nayuki QR Code generator, boostecl=False, masks 0-7.
 * https://www.nayuki.io/page/qr-code-generator-library
 * Full matrices cover RS block splitting/interleaving, version information and masking.
 */
describe('restricted matrix code', () => {
  for (const [index, vector] of vectors.entries()) {
    it(`matches independent full-symbol vector ${index}`, () => {
      const matrix = encodeMatrixCode(vector.value)
      expect(matrix).toHaveLength(vector.side)
      expect(matrix.every((row) => row.length === vector.side)).toBe(true)
      const bits = matrix
        .flat()
        .map((dark) => (dark ? '1' : '0'))
        .join('')
      expect(vector.hashes).toContain(
        createHash('sha256').update(bits).digest('hex'),
      )
    })
  }

  it.each([14, 26, 42, 62, 84, 106, 122, 152, 180, 213])(
    'selects the smallest symbol at capacity %i',
    (capacity) => {
      const version =
        [14, 26, 42, 62, 84, 106, 122, 152, 180, 213].indexOf(capacity) + 1
      expect(encodeMatrixCode('a'.repeat(capacity))).toHaveLength(
        17 + 4 * version,
      )
      if (version < 10)
        expect(encodeMatrixCode('a'.repeat(capacity + 1))).toHaveLength(
          21 + 4 * version,
        )
    },
  )

  it('rejects overflow in UTF-8 bytes with a named error and no input in the message', () => {
    expect(() => encodeMatrixCode('a'.repeat(214))).toThrow(
      MatrixCodeCapacityError,
    )
    expect(() => encodeMatrixCode('é'.repeat(107))).toThrow(
      MatrixCodeCapacityError,
    )
    expect(encodeMatrixCode('é'.repeat(106))).toHaveLength(57)
    expect(() => encodeMatrixCode('secret'.repeat(100))).toThrow(
      'Matrix code capacity exceeded',
    )
  })
})

// Published worked RS example, level M (16 data codewords, 10 parity codewords):
// https://www.thonky.com/qr-code-tutorial/error-correction-coding
it('matches the published Reed-Solomon worked example', () => {
  expect(
    matrixCodeParity(
      [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17],
      10,
    ),
  ).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23])
})

// Published format-information table, level M masks 0-7:
// https://www.thonky.com/qr-code-tutorial/format-version-tables
it('writes both copies of a valid level-M format word', () => {
  const formats = [
    0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
  ]
  for (const vector of vectors) {
    const matrix = encodeMatrixCode(vector.value)
    const first = [0, 1, 2, 3, 4, 5, 7, 8]
      .map((y) => matrix[y][8])
      .concat(
        [matrix[8][7]],
        [5, 4, 3, 2, 1, 0].map((x) => matrix[8][x]),
      )
    const second = Array.from(
      { length: 8 },
      (_, i) => matrix[8][matrix.length - 1 - i],
    ).concat(
      Array.from({ length: 7 }, (_, i) => matrix[matrix.length - 7 + i][8]),
    )
    const word = first.reduce(
      (value, dark, bit) => value | (Number(dark) << bit),
      0,
    )
    expect(formats).toContain(word)
    expect(second).toEqual(first)
  }
})
