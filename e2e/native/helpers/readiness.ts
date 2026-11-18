import type { Browser } from '@e2e-dev/web'
import { expect } from 'e2e'

/** Match the legacy settle helper's hydration contract before submitting SSR forms. */
export async function waitForHydration(browser: Browser, selector = 'main') {
  await expect
    .poll(
      () =>
        browser.evaluate((path) => {
          const root = document.querySelector(path)
          const claimed = (node: Element) =>
            Object.keys(node).some((key) => key.startsWith('__reactFiber$'))
          if (!root || !claimed(root)) return false
          const nodes = root.querySelectorAll('*')
          return nodes.length === 0 || claimed(nodes[nodes.length - 1])
        }, selector),
      { timeout: 15_000 },
    )
    .toBe(true)
}
