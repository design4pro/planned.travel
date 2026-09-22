/**
 * No tracked source file may look binary to git (#443).
 *
 * Git classifies a file as binary as soon as it holds a NUL byte. A raw control character typed
 * into a string literal instead of its escape is enough: from then on the file diffs as
 * `Bin N -> M bytes`, so a change to it cannot be reviewed, and `grep`/`rg` answer
 * `binary file matches` instead of the line, so every mechanical scan over the tree steps over it.
 * Nothing else notices, so this asserts it over git's own classification of the index.
 */

import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

// Extensions that are binary by nature. Anything else git calls binary is a source file that
// gained a raw control byte - write it as an escape (`\u0000`) instead.
const BINARY_EXTENSIONS = new Set([
  'avif',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'otf',
  'pdf',
  'pmtiles',
  'png',
  'ttf',
  'wasm',
  'webp',
  'woff',
  'woff2',
  'zip',
])

describe('tracked text files', { timeout: 15_000 }, () => {
  it('holds no file git treats as binary outside the binary asset types', () => {
    // `--eol` prints `i/<eol>` for the index copy; `i/-text` is git's binary verdict.
    const binary = execFileSync('git', ['ls-files', '--eol', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter((entry) => entry.startsWith('i/-text'))
      .map((entry) => entry.slice(entry.indexOf('\t') + 1))
      .filter(
        (path) =>
          !BINARY_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? ''),
      )

    expect(binary).toEqual([])
  })
})
