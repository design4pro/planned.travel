import { expect, test } from '@playwright/test'
import { applyTheme } from './helpers/routes'
import { useSession } from './helpers/session'

// Exercise the real settings control against every supported adjacent surface.
// These are also the surfaces used by People, invite panels and dialogs.
for (const theme of ['light', 'dark'] as const) {
  test(`unchecked Switch boundary clears 3:1 in ${theme}`, async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    expect(await useSession(context, page, baseURL)).toBe(true)
    await page.goto('/settings/appearance')
    const control = page.getByRole('switch', {
      name: 'Reduce motion',
      exact: true,
    })
    await expect(control).toHaveAttribute('aria-checked', 'false')
    await applyTheme(page, theme)
    for (const hover of [false, true]) {
      if (hover) await control.hover()
      else await page.mouse.move(0, 0)
      await page.waitForTimeout(400)
      const measurements = await control.evaluate((element) => {
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
                channel * (track[3] / 255) +
                adjacent[index] * (1 - track[3] / 255),
            )
            const boundary = ring.map(
              (channel, index) =>
                channel * (ring[3] / 255) +
                background[index] * (1 - ring[3] / 255),
            )
            const a = luminance(boundary)
            const b = luminance(adjacent)
            return {
              surface,
              ring,
              track,
              adjacent,
              shadow: style.boxShadow,
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            }
          },
        )
        probe.remove()
        return results
      })
      await testInfo.attach(`contrast-${theme}-${hover ? 'hover' : 'rest'}`, {
        body: JSON.stringify(measurements, null, 2),
        contentType: 'application/json',
      })
      for (const measurement of measurements) {
        expect(measurement.shadow).not.toBe('none')
        expect(
          measurement.ratio,
          JSON.stringify(measurement),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })
}
