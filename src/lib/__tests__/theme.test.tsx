import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const key = 'planned.theme'
let prefersDark: boolean
let systemChange: () => void

function expectTheme(
  mode: 'light' | 'dark' | 'system',
  resolved: 'light' | 'dark',
) {
  expect(document.documentElement.getAttribute('data-theme')).toBe(
    mode === 'system' ? null : mode,
  )
  const metas = document.head.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  expect(Array.from(metas, (meta) => meta.content)).toEqual([
    resolved === 'dark' ? '#121211' : '#faf9f7',
  ])
  expect(metas[0]?.hasAttribute('media')).toBe(false)
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
  prefersDark = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') === prefersDark,
    addEventListener: (_event: string, listener: () => void) => {
      systemChange = listener
    },
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
  document.head.replaceChildren()
})

describe('document theme colour', () => {
  it.each(['light', 'dark'] as const)(
    'bootstraps saved %s against the opposite system scheme',
    async (mode) => {
      prefersDark = mode === 'light'
      window.localStorage.setItem(key, mode)
      const { themeBootstrapScript } = await import('../theme')
      new Function(themeBootstrapScript)()
      expectTheme(mode, mode)
    },
  )

  it('follows explicit choices, system changes and cross-tab changes', async () => {
    const { useTheme } = await import('../theme')
    const { result } = renderHook(useTheme)
    act(() => result.current.setMode('dark'))
    expectTheme('dark', 'dark')
    prefersDark = true
    act(() => systemChange())
    act(() => result.current.setMode('light'))
    expectTheme('light', 'light')
    act(() => result.current.setMode('system'))
    expectTheme('system', 'dark')
    prefersDark = false
    act(() => systemChange())
    expectTheme('system', 'light')
    window.localStorage.setItem(key, 'dark')
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })))
    expectTheme('dark', 'dark')
    window.localStorage.clear()
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })))
    expectTheme('system', 'light')
  })

  it('falls back to System with unavailable storage and still applies session choices', async () => {
    prefersDark = true
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('unavailable')
    })
    const { themeBootstrapScript, useTheme } = await import('../theme')
    expect(() => new Function(themeBootstrapScript)()).not.toThrow()
    expectTheme('system', 'dark')
    const { result } = renderHook(useTheme)
    act(() => result.current.setMode('light'))
    expectTheme('light', 'light')
  })
})
