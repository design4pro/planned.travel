import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const root = read('src/routes/__root.tsx')

// Read declarations without importing the root's Worker-bound locale loader.
describe('the installed app identity', () => {
  it('declares a standalone dashboard launch and only the specified members', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'))
    expect(manifest).toEqual({
      name: 'planned.travel',
      short_name: 'planned',
      lang: 'en',
      id: '/',
      scope: '/',
      start_url: '/dashboard',
      display: 'standalone',
      theme_color: '#faf9f7',
      background_color: '#faf9f7',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    })
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    for (const icon of manifest.icons)
      expect(existsSync(join(process.cwd(), 'public', icon.src))).toBe(true)
    expect(manifest.name).toBe(root.match(/const SITE_NAME = '([^']+)'/)?.[1])
    expect(root).toMatch(
      new RegExp(
        `name: 'apple-mobile-web-app-title', content: '${manifest.short_name}'`,
      ),
    )
    const canvas = read('src/styles/tokens.css').match(
      /:root\s*\{[^}]*--color-canvas:\s*(#[\da-f]+)/,
    )?.[1]
    expect(manifest.theme_color).toBe(canvas)
    expect(manifest.background_color).toBe(canvas)
    expect(root).toMatch(
      new RegExp(
        `name: 'theme-color',\\s*content: '${canvas}',\\s*media: '\\(prefers-color-scheme: light\\)'`,
      ),
    )
  })

  it('announces a credentialed manifest and touch icon without deprecated Apple meta', () => {
    expect(root.match(/rel: 'manifest'/g)).toHaveLength(1)
    expect(root).toMatch(
      /rel: 'manifest',\s*href: '\/manifest.webmanifest',\s*crossOrigin: 'use-credentials'/,
    )
    expect(root).toMatch(
      /rel: 'apple-touch-icon',\s*href: '\/icons\/apple-touch-icon-180.png'/,
    )
    expect(root).toContain("{ name: 'mobile-web-app-capable', content: 'yes' }")
    expect(root).not.toMatch(
      /name: 'apple-mobile-web-app-(?:capable|status-bar-style)'/,
    )
    expect(root).toContain(
      "{ rel: 'icon', href: FAVICON_HREF, type: 'image/svg+xml' }",
    )
    expect(root).toContain(
      'width=device-width, initial-scale=1, viewport-fit=cover',
    )
    expect(root).toMatch(
      /content: '#121211',\s*media: '\(prefers-color-scheme: dark\)'/,
    )
  })
})
