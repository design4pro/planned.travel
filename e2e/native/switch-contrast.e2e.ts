import { describe, test } from '@e2e-dev/web'
import type { Browser } from '@e2e-dev/web'
import { expect } from 'e2e'

async function measureContrast(browser: Browser) {
  return browser.evaluate(() => {
    const element = document.querySelector(
      '[role="switch"][aria-label="Reduce motion"]',
    )
    if (!element) throw new Error('Reduce motion switch is missing')

    const style = getComputedStyle(element)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    const probe = document.createElement('span')
    document.body.appendChild(probe)
    const rgba = (color: string) => {
      probe.style.color = color
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = getComputedStyle(probe).color
      ctx.fillRect(0, 0, 1, 1)
      return Array.from(ctx.getImageData(0, 0, 1, 1).data)
    }
    const luminance = (rgb: number[]) => {
      const linear = rgb.slice(0, 3).map((value) => {
        const channel = value / 255
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      })
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const ring = rgba(style.getPropertyValue('--tw-ring-color'))
    const track = rgba(style.backgroundColor)
    const results = ['canvas', 'surface', 'surface-2', 'surface-inset'].map(
      (surface) => {
        const adjacent = rgba(`var(--color-${surface})`)
        const background = track.map(
          (channel, index) =>
            channel * (track[3] / 255) + adjacent[index] * (1 - track[3] / 255),
        )
        const boundary = ring.map(
          (channel, index) =>
            channel * (ring[3] / 255) + background[index] * (1 - ring[3] / 255),
        )
        const a = luminance(boundary)
        const b = luminance(adjacent)
        return {
          surface,
          ring,
          track,
          adjacent,
          shadow: style.boxShadow,
          settled: element
            .getAnimations()
            .every((animation) => animation.playState !== 'running'),
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        }
      },
    )
    probe.remove()
    return results
  })
}

describe('unchecked Switch contrast', { session: 'owner' }, () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const hover of [false, true]) {
      test(`clears 3:1 on every adjacent surface in ${theme} at ${hover ? 'hover' : 'rest'}`, async ({
        app,
        browser,
        screen,
      }) => {
        await browser.emulateMedia({ colorScheme: theme })
        await app.open('/settings/appearance')
        const control = screen.getByRole('switch', 'Reduce motion', {
          exact: true,
        })
        await control.waitFor()
        const checked = await control.getAttribute('aria-checked')

        if (hover) await control.hover()
        else await browser.mouse.move(0, 0)

        // Poll the actual transition outcome instead of sleeping for 400 ms.
        await expect
          .poll(async () => {
            const measurements = await measureContrast(browser)
            return measurements.every(
              (measurement) =>
                measurement.settled &&
                measurement.shadow !== 'none' &&
                measurement.ratio >= 3,
            )
          })
          .toBe(true)
        const measurements = await measureContrast(browser)
        expect(checked).toBe('false')
        for (const measurement of measurements) {
          expect(measurement.shadow, JSON.stringify(measurement)).not.toBe(
            'none',
          )
          expect(
            measurement.ratio,
            JSON.stringify(measurement),
          ).toBeGreaterThanOrEqual(3)
        }
      })
    }
  }
})
