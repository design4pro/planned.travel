// The select mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import { CURRENCY_OPTIONS } from '#/lib/money'
import { DisplayCurrencyMenu } from '../display-currency-menu'

import type { Catalogue } from '#/lib/i18n'
import type { DisplayCurrencyMenuProps } from '../display-currency-menu'

/**
 * What the display-currency control tells a keyboard or screen-reader user (#1234): why some codes
 * cannot be chosen, and, together with the indicator, that some figures are not converted.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

function menu(overrides: Partial<DisplayCurrencyMenuProps> = {}) {
  return (
    <I18nProvider locale="en" messages={EN}>
      <DisplayCurrencyMenu
        display={{ mode: 'fixed', code: 'GBP' }}
        choices={{ workspaceCode: 'EUR', rateCodes: ['GBP'] }}
        budgetCurrency="EUR"
        saving={false}
        unconverted={false}
        onChange={() => undefined}
        {...overrides}
      />
    </I18nProvider>
  )
}

function mount(overrides: Partial<DisplayCurrencyMenuProps> = {}): void {
  render(menu(overrides))
}

function trigger(): HTMLElement {
  return screen.getByRole('combobox', { name: Costs['display.label'] })
}

function live(): Element | null {
  return document.querySelector('[data-part="display-currency-live"]')
}

describe('the display-currency control, for a keyboard and a screen reader', () => {
  it('describes the trigger with why some currencies cannot be chosen, visually hidden', () => {
    mount()

    const description = document.getElementById(
      trigger().getAttribute('aria-describedby') ?? '',
    )
    expect(description?.textContent).toBe(Costs['display.menu.disabledHint'])
    expect(description?.classList.contains('sr-only')).toBe(true)
  })

  it('adds no description when every code on the list can be chosen', () => {
    mount({
      choices: {
        workspaceCode: 'EUR',
        rateCodes: CURRENCY_OPTIONS.map((option) => option.code),
      },
    })

    expect(trigger().getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByText(Costs['display.menu.disabledHint'])).toBeNull()
  })

  it('reads the indicator alone while every figure is converted', () => {
    mount()

    expect(live()?.textContent).toBe('Also in GBP')
    expect(live()?.children).toHaveLength(0)
  })

  it('reads the indicator, then the alert title, as two elements when figures are not converted', () => {
    mount({ unconverted: true })

    const parts = Array.from(live()?.children ?? []).map(
      (child) => child.textContent,
    )
    expect(parts).toEqual(['Also in GBP', Costs['display.alert.title']])
  })

  it('reads the saving text alone while a save is in flight', () => {
    mount({ unconverted: true, saving: true })

    expect(live()?.textContent).toBe(Costs['display.menu.saving'])
    expect(live()?.children).toHaveLength(0)
  })

  it('keeps the live region mounted across the change, so the fallback is announced', () => {
    const { rerender } = render(menu())
    const region = live()

    rerender(menu({ unconverted: true }))

    expect(live()).toBe(region)
    expect(live()?.textContent).toContain(Costs['display.alert.title'])
    // Atomic, so a change inside the region (the indicator alone) is read together with the fallback.
    expect(live()?.getAttribute('aria-atomic')).toBe('true')
  })
})
