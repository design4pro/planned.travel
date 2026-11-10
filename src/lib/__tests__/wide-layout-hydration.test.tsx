import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  useWideLayout,
  wideLayoutBootstrapScript,
  WIDE_LAYOUT_STORAGE_KEY,
} from '../wide-layout'

function Choice() {
  return <span>{String(useWideLayout())}</span>
}

it('applies saved layout before hydration while keeping server and hydrating markup identical', async () => {
  const host = document.createElement('div')
  host.innerHTML = renderToString(<Choice />)
  document.body.appendChild(host)
  expect(host.textContent).toBe('false')
  localStorage.setItem(WIDE_LAYOUT_STORAGE_KEY, 'true')
  window.eval(wideLayoutBootstrapScript)
  expect(document.documentElement.hasAttribute('data-wide-layout')).toBe(true)
  const onRecoverableError = vi.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(host, <Choice />, { onRecoverableError })
    })
    expect(host.textContent).toBe('true')
    expect(document.documentElement.hasAttribute('data-wide-layout')).toBe(true)
    expect(onRecoverableError).not.toHaveBeenCalled()
  } finally {
    await act(async () => root?.unmount())
    host.remove()
    localStorage.clear()
    document.documentElement.removeAttribute('data-wide-layout')
  }
})
