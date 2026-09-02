/**
 * The reference demo's two clicks, and the drift between the script that makes them and the prompt
 * that tells the capture agent to use them.
 *
 * The functions take Playwright's `Page` shape, so a stub that records what was asked of it is the
 * whole browser here. What is asserted is the contract the capture depends on: entry fails loudly
 * when its control is absent (no session means every frame is the sign-in wall), dismissal never
 * fails (an overlay that did not appear is the frame wanted) but always says what it did.
 */

import { describe, expect, it } from 'vitest'

import { dismissIfPresent, enterThrough } from '../click-through.mjs'

/** A `Page` that answers `visible` for the selectors it is told to, and writes down every call. */
function stubPage({ visible = [], url = 'https://demo.example/login' } = {}) {
  const calls = []
  return {
    calls,
    url: () => url,
    async goto(target, options) {
      calls.push(['goto', target, options?.waitUntil])
    },
    async waitForTimeout(ms) {
      calls.push(['wait', ms])
    },
    locator(selector) {
      return {
        first: () => ({
          async waitFor({ state }) {
            if (state === 'visible' && visible.includes(selector)) return
            throw new Error(`Timeout waiting for ${selector}`)
          },
          async click() {
            calls.push(['click', selector])
          },
        }),
      }
    },
  }
}

describe('enterThrough', () => {
  it('lands on the URL, presses the control once and lets the page settle', async () => {
    const page = stubPage({ visible: ['button:has-text("Try the demo")'] })
    await enterThrough(page, {
      url: 'https://demo.example/trips/22',
      selector: 'button:has-text("Try the demo")',
      settleMs: 800,
    })
    expect(page.calls).toEqual([
      ['goto', 'https://demo.example/trips/22', 'commit'],
      ['click', 'button:has-text("Try the demo")'],
      ['wait', 800],
    ])
  })

  it('refuses to continue when the control is not there, and names it', async () => {
    const page = stubPage({ visible: [] })
    await expect(
      enterThrough(page, {
        url: 'https://demo.example/trips/22',
        selector: 'button:has-text("Try the demo")',
        settleMs: 800,
        timeout: 10,
      }),
    ).rejects.toThrow(
      /--enter "button:has-text\(\\"Try the demo\\"\)" was not visible/,
    )
    expect(page.calls.some(([kind]) => kind === 'click')).toBe(false)
  })
})

describe('dismissIfPresent', () => {
  it('presses an overlay that is on screen and reports it', async () => {
    const page = stubPage({ visible: ['button:has-text("Got it")'] })
    await expect(
      dismissIfPresent(page, {
        selector: 'button:has-text("Got it")',
        settleMs: 600,
      }),
    ).resolves.toBe(true)
    expect(page.calls).toEqual([
      ['click', 'button:has-text("Got it")'],
      ['wait', 600],
    ])
  })

  it('does nothing, and says so, when the overlay never appeared', async () => {
    const page = stubPage({ visible: [] })
    await expect(
      dismissIfPresent(page, {
        selector: 'button:has-text("Got it")',
        settleMs: 600,
        timeout: 10,
      }),
    ).resolves.toBe(false)
    expect(page.calls).toEqual([])
  })
})
