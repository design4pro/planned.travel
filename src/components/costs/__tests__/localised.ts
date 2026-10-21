/**
 * What the costs dialog tests need to render in a locale other than English, and the two
 * assertions both of them make about a localised picker.
 *
 * Not a `.test.ts`, so vitest collects no suite from it.
 */

import { expect } from 'vitest'
import { screen } from '@testing-library/react'

import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import JaCosts from '#/lib/i18n/messages/ja/costs'
import JaModules from '#/lib/i18n/messages/ja/modules'
import JaSettings from '#/lib/i18n/messages/ja/settings'
import JaUi from '#/lib/i18n/messages/ja/ui'
import EnCosts from '#/lib/i18n/messages/en/costs'
import EnModules from '#/lib/i18n/messages/en/modules'
import EnSettings from '#/lib/i18n/messages/en/settings'
import EnUi from '#/lib/i18n/messages/en/ui'
import PlCosts from '#/lib/i18n/messages/pl/costs'
import PlModules from '#/lib/i18n/messages/pl/modules'
import PlSettings from '#/lib/i18n/messages/pl/settings'
import PlUi from '#/lib/i18n/messages/pl/ui'
import ZhCosts from '#/lib/i18n/messages/zh-Hans/costs'
import ZhModules from '#/lib/i18n/messages/zh-Hans/modules'
import ZhSettings from '#/lib/i18n/messages/zh-Hans/settings'
import ZhUi from '#/lib/i18n/messages/zh-Hans/ui'

import type { Catalogue, Locale } from '#/lib/i18n'

function catalogue(
  costs: Parameters<typeof namespaceCatalogue>[1],
  modules: Parameters<typeof namespaceCatalogue>[1],
  settings: Parameters<typeof namespaceCatalogue>[1],
  ui: Parameters<typeof namespaceCatalogue>[1],
): Catalogue {
  return {
    ...namespaceCatalogue('costs', costs),
    ...namespaceCatalogue('modules', modules),
    ...namespaceCatalogue('settings', settings),
    ...namespaceCatalogue('ui', ui),
  }
}

/** The locales the label-in-name assertion runs for: the source, a CJK pair that failed, and one more. */
export const LOCALISED: ReadonlyArray<{
  locale: Locale
  messages: Catalogue
}> = [
  {
    locale: 'en',
    messages: catalogue(EnCosts, EnModules, EnSettings, EnUi),
  },
  {
    locale: 'ja',
    messages: catalogue(JaCosts, JaModules, JaSettings, JaUi),
  },
  {
    locale: 'zh-Hans',
    messages: catalogue(ZhCosts, ZhModules, ZhSettings, ZhUi),
  },
]

export const PL: { locale: Locale; messages: Catalogue } = {
  locale: 'pl',
  messages: catalogue(PlCosts, PlModules, PlSettings, PlUi),
}

/** A label's text as a reader gets it: the required marker is `aria-hidden` and drops out. */
function visibleText(label: HTMLLabelElement): string {
  const copy = label.cloneNode(true) as HTMLLabelElement
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove()
  }
  return (copy.textContent ?? '').trim()
}

/**
 * Every select and date picker in `root` is named by its own visible `<label for>`, and by nothing
 * that overrides it (WCAG 2.2 SC 2.5.3 Label in Name). The label text is read from the DOM, so the
 * assertion holds in whatever locale rendered it; `expected` pins how many controls there are, so a
 * control that stops being found fails here rather than passing an empty loop.
 */
export function expectNamedByVisibleLabel(
  root: HTMLElement,
  expected: number,
): void {
  const controls = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[role="combobox"], button[aria-haspopup="dialog"]',
    ),
  )
  expect(controls).toHaveLength(expected)

  for (const control of controls) {
    expect(control.hasAttribute('aria-label'), control.id).toBe(false)
    const label = root.querySelector<HTMLLabelElement>(
      `label[for="${control.id}"]`,
    )
    expect(label, `a visible label for ${control.id}`).not.toBeNull()
    const role = control.getAttribute('role') ?? 'button'
    const named = screen.getByRole(role, {
      name: visibleText(label as HTMLLabelElement),
    })
    expect(named).toBe(control)
  }
}

/** The description line of the option whose label is `code`, as a screen reader reads it. */
export function descriptionOf(code: string): string {
  const option = screen.getByRole('option', { name: code })
  const id = option.getAttribute('aria-describedby')
  return (id === null ? null : document.getElementById(id)?.textContent) ?? ''
}
