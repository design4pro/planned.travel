import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'

import type { NamespaceModule } from '../catalogue'

/**
 * WCAG 2.5.3 Label in Name for the forecast badge: its name is the localised "Forecast" word, then
 * the visible figures as one run. The component supplies `{figures}`; this holds every locale's
 * template to it, so a translation cannot slip the placeholder out or split it.
 */
const trips = import.meta.glob<NamespaceModule>('../messages/*/trips.ts', {
  eager: true,
})

const KEYS = [
  'plan.weather.badge.forecast',
  'plan.weather.badge.forecastNoCondition',
] as const

describe('the forecast badge name templates', () => {
  it.each(LOCALE_TAGS)(
    '%s carries {figures} once, right after the prefix',
    (tag) => {
      const messages = trips[`../messages/${tag}/trips.ts`]?.default
      expect(messages).toBeDefined()

      for (const key of KEYS) {
        const template = String(messages?.[key])
        expect(template.split('{figures}')).toHaveLength(2)
        // The prefix is one word, a colon and a space at most: no other placeholder before it.
        expect(template.indexOf('{figures}')).toBeLessThan(
          template.indexOf('{max}'),
        )
        expect(template.slice(0, template.indexOf('{figures}'))).not.toContain(
          '{',
        )
      }
    },
  )
})
