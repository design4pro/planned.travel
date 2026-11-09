import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-wide-layout')
})
afterEach(() => vi.restoreAllMocks())

describe('browser wide layout preference', () => {
  it.each([null, 'garbage', '"true"', '{}', 'false'])(
    'defaults %s to off',
    async (raw) => {
      const { wideLayoutPreference: pref, WIDE_LAYOUT_STORAGE_KEY: key } =
        await import('../wide-layout')
      if (raw !== null) localStorage.setItem(key, raw)
      expect(pref.read()).toBe(false)
    },
  )

  it('reads a persisted choice before subscription and applies off/on/off immediately', async () => {
    const { wideLayoutPreference: pref, WIDE_LAYOUT_STORAGE_KEY: key } =
      await import('../wide-layout')
    localStorage.setItem(key, 'true')
    expect(pref.read()).toBe(true)
    const changed = vi.fn()
    const stop = pref.subscribe(changed)
    for (const next of [false, true, false]) {
      pref.write(next)
      expect(pref.read()).toBe(next)
      expect(document.documentElement.hasAttribute('data-wide-layout')).toBe(
        next,
      )
      expect(localStorage.getItem(key)).toBe(String(next))
    }
    expect(changed).toHaveBeenCalledTimes(3)
    stop()
  })

  it('updates subscribers and the document on cross-tab writes, invalid values and clear', async () => {
    const { wideLayoutPreference: pref, WIDE_LAYOUT_STORAGE_KEY: key } =
      await import('../wide-layout')
    const changed = vi.fn()
    const stop = pref.subscribe(changed)
    localStorage.setItem(key, 'true')
    window.dispatchEvent(
      new StorageEvent('storage', { key, storageArea: localStorage }),
    )
    expect(pref.read()).toBe(true)
    window.dispatchEvent(
      new StorageEvent('storage', { key, storageArea: sessionStorage }),
    )
    expect(changed).toHaveBeenCalledTimes(1)
    localStorage.setItem(key, 'invalid')
    window.dispatchEvent(
      new StorageEvent('storage', { key, storageArea: localStorage }),
    )
    expect(pref.read()).toBe(false)
    pref.write(true)
    localStorage.clear()
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, storageArea: localStorage }),
    )
    expect(pref.read()).toBe(false)
    stop()
  })

  it('keeps switching on the current page when storage access throws', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied')
    })
    const { wideLayoutPreference: pref } = await import('../wide-layout')
    expect(pref.read()).toBe(false)
    const stop = pref.subscribe(vi.fn())
    for (const next of [true, false, true]) {
      expect(() => pref.write(next)).not.toThrow()
      expect(pref.read()).toBe(next)
    }
    stop()
  })

  it('keeps switching when reads or writes throw', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const { wideLayoutPreference: pref } = await import('../wide-layout')
    expect(pref.read()).toBe(false)
    pref.write(true)
    expect(pref.read()).toBe(true)
    pref.write(false)
    expect(pref.read()).toBe(false)
  })

  it.each(['true', 'false', '<script>alert(1)</script>'])(
    'bootstraps only the allowlisted value %s',
    async (raw) => {
      const { wideLayoutBootstrapScript, WIDE_LAYOUT_STORAGE_KEY: key } =
        await import('../wide-layout')
      localStorage.setItem(key, raw)
      window.eval(wideLayoutBootstrapScript)
      expect(document.documentElement.hasAttribute('data-wide-layout')).toBe(
        raw === 'true',
      )
    },
  )
})

it('keeps cross-tab updates while navigating through a public page with no subscribers', async () => {
  const { wideLayoutPreference: pref, WIDE_LAYOUT_STORAGE_KEY: key } =
    await import('../wide-layout')
  const stop = pref.subscribe(vi.fn())
  stop()
  localStorage.setItem(key, 'true')
  window.dispatchEvent(
    new StorageEvent('storage', { key, storageArea: localStorage }),
  )
  expect(pref.read()).toBe(true)
})
