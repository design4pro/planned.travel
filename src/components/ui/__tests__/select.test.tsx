// @vitest-environment jsdom
import './test-env'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import userEvent from '@testing-library/user-event'

import { Dialog, DialogContent, DialogTitle } from '../dialog'
import { Field } from '../field'
import { SimpleSelect } from '../select'

afterEach(cleanup)

const options = [
  { value: 'gbp', label: 'British pound', description: 'GBP' },
  { value: 'jpy', label: 'Japanese yen', description: 'JPY' },
  { value: 'eur', label: 'Euro', description: 'EUR', disabled: true },
]

describe('SimpleSelect', () => {
  it('shows the placeholder until a value is set', () => {
    render(
      <SimpleSelect
        options={options}
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Currency' }).textContent,
    ).toContain('Choose a currency')
  })

  it('opens a listbox and reports the chosen value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SimpleSelect
        options={options}
        ariaLabel="Currency"
        onValueChange={onValueChange}
      />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: /Japanese yen/ }))
    expect(onValueChange).toHaveBeenCalledWith('jpy')
  })

  it('renders the selected label on the trigger', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: /British pound/ }))
    expect(
      screen.getByRole('combobox', { name: 'Currency' }).textContent,
    ).toContain('British pound')
  })

  it('marks a disabled option as such', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    expect(
      screen
        .getByRole('option', { name: /Euro/ })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    expect(screen.queryByRole('listbox')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  /**
   * The regression this file exists to hold shut.
   *
   * Radix fills a select's trigger by portalling the chosen `Select.ItemText`
   * into the value node, and the items live inside `Select.Content`, which
   * builds its offscreen `DocumentFragment` in a layout effect. Layout effects
   * do not run on the server, so the trigger went out over the wire empty and
   * only filled in once React had hydrated: measured here as
   * `renderToStaticMarkup` of a `SimpleSelect` carrying `value="gbp"` and not
   * one occurrence of `British pound`. On a page whose client bundle had not
   * arrived, six settings controls read as blank with a clean console.
   *
   * `SimpleSelect` was handed `options`, so it knows the label and now renders
   * it itself. These three assertions pin the whole contract: the label is in
   * the server HTML, it is on the trigger with the menu shut, and supplying it
   * has not stopped the menu from opening.
   */
  it('carries the selected label in the server HTML, before any hydration', () => {
    const html = renderToStaticMarkup(
      <SimpleSelect options={options} value="gbp" ariaLabel="Currency" />,
    )
    expect(html).toContain('British pound')
  })

  it('shows the selected option label and opens a listbox on click', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} value="jpy" ariaLabel="Currency" />)
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger.textContent).toContain('Japanese yen')

    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(options.length)
  })

  it('shows the placeholder for the empty value', () => {
    render(
      <SimpleSelect
        options={options}
        value=""
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger.textContent).toContain('Choose a currency')
    expect(trigger.hasAttribute('data-placeholder')).toBe(true)
  })

  /**
   * The state a schema change leaves behind, and the second half of the
   * blank-trigger defect.
   *
   * Radix shows its own placeholder only for its "nothing chosen" sentinel, the
   * empty string. A *stored* value that no option carries — measured on
   * `/settings`, where the traveller's language override had been canonicalised
   * to `en` while the control still offered `en-GB` — is not that sentinel, so
   * Radix rendered the supplied children, and the children were `undefined`.
   * The control was an empty box with a clean console, and saving it wrote a
   * value that made the next load blank as well.
   *
   * Filling it with the placeholder cured the blank box and introduced a quieter
   * defect in its place: a control that had dropped a saved preference was
   * indistinguishable from one nobody had ever set. So it says so instead. The
   * three channels below are the contract — the stored value on the face of the
   * control, a state attribute the warning tone and border hang off, and a
   * sentence a screen reader reaches through `aria-describedby` no matter which
   * of the three ways this control got its name.
   */
  it('says a stored value was dropped rather than looking untouched', () => {
    render(
      <SimpleSelect
        options={options}
        value="chf"
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger.textContent).toContain('Unavailable: chf')
    expect(trigger.textContent).not.toContain('Choose a currency')
    expect(trigger.hasAttribute('data-orphaned')).toBe(true)
    // Not muted as untouched: that was the misreading.
    expect(trigger.hasAttribute('data-placeholder')).toBe(false)

    const describedBy = trigger.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'The saved choice chf is no longer available. Choose another.',
    )
  })

  it('leaves an untouched control untouched', () => {
    render(
      <SimpleSelect
        options={options}
        value=""
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger.hasAttribute('data-orphaned')).toBe(false)
    expect(trigger.getAttribute('aria-describedby')).toBeNull()
  })

  it('keeps the dropped-value signal in the server HTML too', () => {
    const html = renderToStaticMarkup(
      <SimpleSelect
        options={options}
        value="chf"
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    expect(html).toContain('Unavailable: chf')
    expect(html).toContain('data-orphaned')
  })

  it('keeps a Field’s own description alongside the control’s', () => {
    render(
      <Field label="Currency" error="Pick one">
        <SimpleSelect options={options} value="chf" />
      </Field>,
    )
    const ids = (
      screen.getByRole('combobox').getAttribute('aria-describedby') ?? ''
    ).split(' ')
    const text = ids.map((id) => document.getElementById(id)?.textContent)
    expect(text).toContain(
      'The saved choice chf is no longer available. Choose another.',
    )
    expect(text).toContain('Pick one')
  })

  /**
   * WCAG 2.1.1 on the control every settings screen mounts.
   *
   * The WAI-ARIA select-only combobox pattern opens on Enter, Space, ArrowDown
   * and ArrowUp, and an earlier audit reported Enter alone leaving
   * `aria-expanded="false"` with zero options on `/settings`. It did not
   * reproduce — Chromium, keyboard only, on the settled tree: all four keys give
   * `aria-expanded="true"`, one `[role="listbox"]` and nine options. The report
   * was an artefact of reading the trigger through a role locator *after* it
   * opened, because Radix marks the rest of the document `aria-hidden` while the
   * listbox is up and a role query then stops matching the trigger at all.
   *
   * These cases exist so that a regression in the trigger's key handling is
   * caught here, in a harness that reads the DOM directly, rather than by an
   * audit that has to disambiguate itself first.
   */
  for (const key of ['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}'] as const) {
    it(`opens the listbox on ${key === ' ' ? 'Space' : key.slice(1, -1)}`, async () => {
      const user = userEvent.setup()
      render(<SimpleSelect options={options} ariaLabel="Currency" />)
      const trigger = screen.getByRole('combobox', { name: 'Currency' })
      trigger.focus()
      expect(trigger.getAttribute('aria-expanded')).toBe('false')

      await user.keyboard(key)

      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1)
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(
        options.length,
      )
    })
  }

  it('commits a keyboard choice without a pointer', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SimpleSelect
        options={options}
        ariaLabel="Currency"
        onValueChange={onValueChange}
      />,
    )
    screen.getByRole('combobox', { name: 'Currency' }).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledWith('jpy')
  })

  it('announces the popup it owns', () => {
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    expect(
      screen
        .getByRole('combobox', { name: 'Currency' })
        .getAttribute('aria-haspopup'),
    ).toBe('listbox')
  })

  it('picks up the invalid and disabled state from a surrounding Field', () => {
    render(
      <Field label="Currency" error="Pick one" disabled>
        <SimpleSelect options={options} />
      </Field>,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
    // The Field owns the id, so its label points at the trigger.
    expect(screen.getByText('Currency').getAttribute('for')).toBe(trigger.id)
  })
})

/**
 * The layer a listbox lands on, read off the elements that actually render.
 *
 * Both the listbox and the dialog scrim portal to `document.body`, so the
 * browser ranks them against each other at the root stacking context. Until
 * issue #201 the listbox carried `z-dropdown` (50) against the scrim's
 * `z-overlay` (60): the options were painted behind the scrim, visibly dimmed,
 * and `document.elementFromPoint` at the centre of the list answered with the
 * scrim, so a click on an option never reached it.
 *
 * jsdom applies no stylesheet, so the tier is resolved the way the browser
 * would: take the `z-*` utility the element carries and look its token up in
 * `tokens.css`. The ordering between the tokens themselves is asserted in
 * `src/styles/__tests__/popper-stacking.test.ts`; what is asserted here is the
 * render fact — that these two elements claim those two tiers.
 */
function tierOf(element: Element, label: string): number {
  const utility = [...element.classList].find((name) =>
    /^z-[a-z-]+$/.test(name),
  )
  expect(utility, `${label} carries a z-* utility`).toBeDefined()
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../styles/tokens.css'),
    'utf8',
  )
  const declared = new RegExp(`^\\s*--${utility}:\\s*(\\d+);`, 'm').exec(css)
  expect(declared, `--${utility} in tokens.css`).not.toBeNull()
  return Number(declared?.[1])
}

describe('a Select opened inside a Dialog', () => {
  it('renders its listbox above the dialog scrim', async () => {
    const user = userEvent.setup()
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Book a day</DialogTitle>
          <SimpleSelect options={options} ariaLabel="Currency" />
        </DialogContent>
      </Dialog>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))

    // The scrim is found by the treatment that makes it a scrim, not by the
    // tier under test.
    const scrim = document.querySelector('.bg-overlay')
    expect(scrim, 'the dialog scrim').not.toBeNull()
    expect(tierOf(screen.getByRole('listbox'), 'the listbox')).toBeGreaterThan(
      tierOf(scrim as Element, 'the scrim'),
    )
  })
})
