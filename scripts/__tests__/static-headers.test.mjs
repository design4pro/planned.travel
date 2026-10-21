import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('static asset cache boundary', () => {
  it('gives only /assets/* exactly one immutable Cache-Control header', () => {
    const lines = readFileSync('public/_headers', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    const rules = []
    for (const line of lines) {
      if (!/^\s/.test(line)) {
        rules.push({ path: line.trim(), headers: [] })
      } else {
        expect(rules.length, 'a header must follow a path').toBeGreaterThan(0)
        const match = line.trim().match(/^([^:]+):\s*(.+)$/)
        expect(match, 'every indented line must be a header').not.toBeNull()
        rules.at(-1).headers.push([match[1], match[2]])
      }
    }
    expect(rules).toEqual([
      {
        path: '/assets/*',
        headers: [['Cache-Control', 'public, max-age=31536000, immutable']],
      },
    ])
  })

  it('keeps unhashed public files outside the immutable assets namespace', () => {
    const entries = existsSync('public/assets')
      ? readdirSync('public/assets', { recursive: true })
      : []
    expect(entries).toEqual([])
  })

  it('preserves Vite defaults for public copying and content-hashed asset names', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).not.toMatch(
      /\b(publicDir|copyPublicDir|assetsDir|entryFileNames|chunkFileNames|assetFileNames)\b/,
    )
  })
})
