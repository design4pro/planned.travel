/**
 * The reference demo's two clicks, and the drift between the script that makes them and the prompt
 * that tells the capture agent to use them.
 *
 * The functions take Playwright's `Page` shape, so a stub that records what was asked of it is the
 * whole browser here. What is asserted is the contract the capture depends on: entry fails loudly
 * when its control is absent (no session means every frame is the sign-in wall), dismissal never
 * fails (an overlay that did not appear is the frame wanted) but always says what it did.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { dismissIfPresent, enterThrough } from '../click-through.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

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

/* ------------------------------------------------------------------ drift */

const CAPTURE_SCRIPT = 'scripts/visual/capture.mjs'
const CAPTURE_PROMPT = '.sandcastle/pixel-capture-prompt.md'

/**
 * The flags the script reads: `opt.<name>`, `need('<name>')` and `flag('<name>')` are the three
 * ways `args()`'s result is consulted, and a `--<name>` reaches the script through no other.
 */
function flagsRead(source) {
  return new Set(
    [...source.matchAll(/\bopt\.(\w+)\b|\b(?:need|flag)\('(\w+)'\)/g)].map(
      (m) => m[1] ?? m[2],
    ),
  )
}

/** Every `--<flag>` the prompt's reference invocation hands the script. */
function flagsInReferenceInvocation(prompt) {
  const section = prompt.split('## The reference side')[1]?.split('\n## ')[0]
  return new Set([...(section ?? '').matchAll(/--(\w+)/g)].map((m) => m[1]))
}

describe('drift between the capture prompt and the script', () => {
  const script = readFileSync(`${REPO_ROOT}${CAPTURE_SCRIPT}`, 'utf8')
  const prompt = readFileSync(`${REPO_ROOT}${CAPTURE_PROMPT}`, 'utf8')

  it('tells the capture agent to enter the reference and dismiss its overlay', () => {
    // Without both, the agent re-derives the procedure — see click-through.mjs for what that cost.
    const used = flagsInReferenceInvocation(prompt)
    expect([...used]).toEqual(expect.arrayContaining(['enter', 'dismiss']))
  })

  it('hands the script only flags it reads', () => {
    const read = flagsRead(script)
    for (const flag of flagsInReferenceInvocation(prompt)) {
      expect(
        read.has(flag),
        `${CAPTURE_PROMPT} passes --${flag}, which ${CAPTURE_SCRIPT} never reads`,
      ).toBe(true)
    }
  })
})
