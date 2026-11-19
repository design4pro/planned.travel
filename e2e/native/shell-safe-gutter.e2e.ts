import { describe, test } from '@e2e-dev/web'
import type { Browser } from '@e2e-dev/web'
import { expect } from 'e2e'
import { waitForHydration } from './helpers/readiness'

const LEFT_INSET = 53
const RIGHT_INSET = 21

async function setInsets(browser: Browser, left: number, right: number) {
  await browser.evaluate(
    ({ left: screenLeft, right: screenRight }) => {
      const { style } = document.documentElement
      style.setProperty('--safe-left', `${screenLeft}px`)
      style.setProperty('--safe-right', `${screenRight}px`)
      return null
    },
    { left, right },
  )
}

async function readRows(browser: Browser, selectors: string[]) {
  return browser.evaluate(
    (paths) =>
      paths.map((selector) => {
        const element = document.querySelector(selector)
        if (!element) throw new Error(`Missing row: ${selector}`)
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        const left = parseFloat(style.paddingLeft)
        const right = parseFloat(style.paddingRight)
        return {
          left,
          right,
          contentLeft: rect.left + left,
          contentRight: innerWidth - rect.right + right,
        }
      }),
    selectors,
  )
}

describe('shell safe-area gutters', () => {
  for (const scenario of [
    {
      name: 'signed-in navigation and content',
      path: '/dashboard',
      selectors: ['header > div', 'main'],
      session: 'owner',
    },
    {
      name: 'marketing header and footer',
      path: '/',
      selectors: [
        'header > div',
        'section[aria-labelledby="hero-heading"] > div.gutter-x',
        'main > section:not([aria-labelledby="hero-heading"]) > div.gutter-x',
        'footer > div',
      ],
    },
    {
      name: 'pricing plans and comparison',
      path: '/pricing',
      selectors: ['#plans > div.gutter-x', '#compare > div'],
    },
    {
      name: 'legal body',
      path: '/legal/terms',
      selectors: ['main > div'],
    },
  ]) {
    test(
      `${scenario.name} clear a notched phone`,
      { session: scenario.session },
      async ({ app, browser }) => {
        await app.open(scenario.path)
        const { selectors } = scenario
        for (const selector of scenario.selectors)
          await browser.locator(selector).first().waitFor()

        for (const [width, gutter] of [
          [600, 16],
          [800, 24],
          [1100, 32],
        ]) {
          await browser.setViewport({ width, height: 500 })
          await setInsets(browser, 0, 0)
          for (const row of await readRows(browser, selectors)) {
            expect(row.left).toBe(gutter)
            expect(row.right).toBe(gutter)
          }
          await setInsets(browser, LEFT_INSET, RIGHT_INSET)
          for (const dir of ['ltr', 'rtl']) {
            await browser.evaluate((direction) => {
              document.documentElement.dir = direction
              return null
            }, dir)
            for (const row of await readRows(browser, selectors)) {
              expect(row.left).toBe(Math.max(gutter, LEFT_INSET))
              expect(row.right).toBe(Math.max(gutter, RIGHT_INSET))
              expect(row.contentLeft).toBeGreaterThanOrEqual(LEFT_INSET)
              expect(row.contentRight).toBeGreaterThanOrEqual(RIGHT_INSET)
            }
          }
        }
      },
    )
  }

  test(
    'both trip navigation rows clear the safe rectangle',
    { session: 'owner' },
    async ({ app, browser }) => {
      await app.open('/trips/demo-trip-01-tokyo-and-kyoto/plan')
      const tabRow = 'div.gutter-x:has(> nav[aria-label])'
      const titleRow = 'div.gutter-x:has(+ div.gutter-x > nav[aria-label])'
      await browser.locator(tabRow).waitFor()
      for (const [width, gutter] of [
        [600, 16],
        [800, 24],
        [1100, 32],
      ]) {
        await browser.setViewport({ width, height: 520 })
        const selectors = width < 1024 ? [titleRow, tabRow] : [tabRow]
        for (const direction of ['ltr', 'rtl']) {
          await browser.evaluate((dir) => {
            document.documentElement.dir = dir
            return null
          }, direction)
          for (const [left, right] of [
            [0, 0],
            [LEFT_INSET, RIGHT_INSET],
          ]) {
            await setInsets(browser, left, right)
            for (const row of await readRows(browser, selectors)) {
              expect(row.contentLeft).toBe(Math.max(gutter, left))
              expect(row.contentRight).toBe(Math.max(gutter, right))
            }
          }
        }
      }
    },
  )

  test('feedback actor spends its existing SDK margin before adding clearance', async ({
    app,
    browser,
  }) => {
    await app.open('/')
    await browser.locator('footer').waitFor()
    await browser.evaluate(() => {
      if (!document.querySelector('#sentry-feedback')) {
        // Sentry is off without a DSN. Use the SDK's positioning contract
        // without enabling reporting in the test environment.
        const host = document.createElement('div')
        host.id = 'sentry-feedback'
        host.style.setProperty('--page-margin', '16px')
        const actor = document.createElement('button')
        actor.className = 'widget__actor'
        actor.style.cssText =
          'position: fixed; margin: var(--page-margin); inset: var(--actor-inset); width: 48px; height: 48px'
        host.attachShadow({ mode: 'open' }).appendChild(actor)
        document.body.appendChild(host)
      }
      return null
    })
    for (const direction of ['ltr', 'rtl']) {
      await browser.evaluate((dir) => {
        document.documentElement.dir = dir
        return null
      }, direction)
      for (const [left, right] of [
        [0, 0],
        [LEFT_INSET, RIGHT_INSET],
      ]) {
        await setInsets(browser, left, right)
        const end = await browser.evaluate(() => {
          const actor = document
            .querySelector('#sentry-feedback')
            ?.shadowRoot?.querySelector('.widget__actor')
          if (!actor) throw new Error('Missing feedback actor')
          const rect = actor.getBoundingClientRect()
          return document.documentElement.dir === 'rtl'
            ? rect.left
            : innerWidth - rect.right
        })
        expect(end).toBe(Math.max(16, direction === 'rtl' ? left : right))
      }
    }
  })

  for (const panel of [
    {
      name: 'dialog',
      path: '/trips',
      trigger: 'button[aria-haspopup="dialog"]:has-text("New trip")',
    },
    {
      name: 'sheet',
      path: '/dashboard',
      trigger: '[data-part="dashboard-widgets-trigger"]',
    },
  ]) {
    test(
      `${panel.name} dismiss control stays inside the safe rectangle`,
      { session: 'owner' },
      async ({ app, browser }) => {
        await browser.setViewport({ width: 450, height: 520 })
        await app.open(panel.path)
        await waitForHydration(browser)
        const trigger = browser.locator(panel.trigger).first()
        await trigger.tap()
        const close = '[role="dialog"] button[aria-label="Close"]'
        await browser.locator(close).waitFor()
        await browser.evaluate(async () => {
          const dialog = document.querySelector('[role="dialog"]')
          await Promise.allSettled(
            dialog?.getAnimations().map((animation) => animation.finished) ??
              [],
          )
          return null
        })
        for (const direction of ['ltr', 'rtl']) {
          await browser.evaluate((dir) => {
            document.documentElement.dir = dir
            return null
          }, direction)
          await setInsets(browser, 0, 0)
          const [before] = await readRows(browser, [close])
          const baseline =
            direction === 'ltr'
              ? before.contentRight - before.right
              : before.contentLeft - before.left
          expect(baseline).toBe(14)
          await setInsets(browser, LEFT_INSET, RIGHT_INSET)
          const [after] = await readRows(browser, [close])
          const content = await browser.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')
            if (!dialog) throw new Error('Missing panel')
            const elements = dialog.querySelectorAll(
              'h2, input:not([type="hidden"],[aria-hidden="true"]), button:not([aria-label="Close"])',
            )
            return Array.from(elements, (element) => {
              const { width, height, left, right } =
                element.getBoundingClientRect()
              return {
                width,
                height,
                left,
                right: innerWidth - right,
                label:
                  element.getAttribute('aria-label') ??
                  element.getAttribute('type') ??
                  element.textContent?.trim(),
              }
            }).filter(({ width, height }) => width > 1 && height > 1)
          })
          expect(content.length).toBeGreaterThan(1)
          for (const bounds of content) {
            expect(
              bounds.left,
              bounds.label ?? undefined,
            ).toBeGreaterThanOrEqual(LEFT_INSET)
            expect(
              bounds.right,
              bounds.label ?? undefined,
            ).toBeGreaterThanOrEqual(RIGHT_INSET)
          }
          const clearance =
            direction === 'ltr'
              ? after.contentRight - after.right
              : after.contentLeft - after.left
          expect(clearance).toBe(direction === 'ltr' ? RIGHT_INSET : LEFT_INSET)
        }
        if (panel.name === 'dialog') {
          await browser.setViewport({ width: 1100, height: 800 })
          const [before] = await readRows(browser, [close])
          await setInsets(browser, 0, 0)
          expect(await readRows(browser, [close])).toEqual([before])
        }
        await browser.setViewport({ width: 450, height: 400 })
        await setInsets(browser, LEFT_INSET, RIGHT_INSET)
        const canScroll = await browser.evaluate(() => {
          const body = document.querySelector<HTMLElement>(
            '[role="dialog"] .overflow-y-auto',
          )
          if (!body) throw new Error('Missing scrolling panel body')
          body.scrollTop = 0
          body.scrollTop = 60
          return body.scrollTop > 0
        })
        expect(canScroll).toBe(true)
        await browser.locator(close).tap()
        await expect(browser.locator(close)).toHaveCount(0)
        const focusIsRestored = await browser.evaluate((name) => {
          const active = document.activeElement
          return name === 'sheet'
            ? (active?.matches('[data-part="dashboard-widgets-trigger"]') ??
                false)
            : active?.matches('button[aria-haspopup="dialog"]') === true &&
                active.textContent?.includes('New trip') === true
        }, panel.name)
        expect(focusIsRestored).toBe(true)
      },
    )
  }

  test(
    'Atlas keeps the shelf inside the safe rectangle and the map full bleed',
    {
      session: 'owner',
    },
    async ({ app, browser }) => {
      await app.open('/atlas')
      const shelf = '[data-part="atlas-shelf"]'
      const surfaces = '[data-part="country-surfaces"]'
      const search = 'button[aria-label="Find a country"]'
      await browser.locator(shelf).waitFor()
      await browser.locator(search).waitFor()

      for (const [width, gutter] of [
        [800, 12],
        [1100, 16],
      ]) {
        await browser.setViewport({ width, height: 820 })
        await setInsets(browser, 0, 0)
        const [baseline] = await readRows(browser, [shelf])
        expect(baseline.contentLeft - baseline.left).toBe(gutter)
        expect(baseline.contentRight - baseline.right).toBe(gutter)

        await setInsets(browser, LEFT_INSET, RIGHT_INSET)
        const [panel, map] = await readRows(browser, [shelf, surfaces])
        expect(panel.contentLeft - panel.left).toBe(LEFT_INSET)
        expect(panel.contentRight - panel.right).toBe(RIGHT_INSET)
        expect(map.contentLeft).toBe(0)
        expect(map.contentRight).toBe(0)
        for (const direction of ['ltr', 'rtl']) {
          await browser.evaluate((dir) => {
            document.documentElement.dir = dir
            return null
          }, direction)
          const [control] = await readRows(browser, [search])
          expect(control.contentLeft - control.left).toBeGreaterThanOrEqual(
            LEFT_INSET,
          )
          expect(control.contentRight - control.right).toBeGreaterThanOrEqual(
            RIGHT_INSET,
          )
        }
      }
    },
  )
})
