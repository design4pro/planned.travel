import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { I18nProvider } from '#/lib/i18n'
import modules from '#/lib/i18n/messages/en/modules'
import { REQUIRED_SWATCHES, SWATCHES } from '#/lib/swatches'
import { SwatchPicker } from '../swatch-picker'

import type { Catalogue } from '#/lib/i18n'

/**
 * The real source catalogue, namespaced the way the provider expects.
 *
 * Built from the shipped file rather than stubbed, so a swatch whose `label`
 * points at a key nobody wrote fails here instead of rendering the key itself —
 * which is exactly how five raw keys reached the screen earlier in this module's
 * migration.
 */
const EN: Catalogue = Object.fromEntries(
  Object.entries(modules).map(([key, message]) => [`modules.${key}`, message]),
)

/**
 * The colour picker, and the two things about it no render can be trusted to
 * show: it lives inside a dialog, so it never reaches a server-rendered page and
 * a screenshot of any route is a picture of a closed dialog.
 *
 * What is asserted here is what the palette *means*, not how it looks. A
 * nullable colour offers the absence of one; a `notNull` colour cannot, and
 * offers a neutral instead. Getting those two the wrong way round is invisible
 * until a collection is saved with an empty string the column rejects.
 */

function picker(props: Partial<Parameters<typeof SwatchPicker>[0]> = {}) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <SwatchPicker value="" onChange={() => {}} legend="Colour" {...props} />
    </I18nProvider>,
  )
}

describe('SwatchPicker', () => {
  it('offers the absence of a colour by default', () => {
    picker()
    expect(screen.getAllByRole('button')).toHaveLength(SWATCHES.length)
    expect(screen.getByRole('button', { name: 'No colour' })).not.toBeNull()
  })

  it('offers a neutral instead where the column cannot be empty', () => {
    picker({ swatches: REQUIRED_SWATCHES, value: '#256256' })
    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))

    expect(names).toHaveLength(REQUIRED_SWATCHES.length)
    expect(names).toContain('Slate')
    // The whole point of the second composition: no empty value to submit.
    expect(names).not.toContain('No colour')
    expect(REQUIRED_SWATCHES.every((swatch) => swatch.value !== '')).toBe(true)
  })

  /**
   * `surface-inset` reads 1.19:1 against the surface and `edge-faint` around it
   * 1.32:1, so before this the empty chip was a control with no visible
   * boundary at all — invisible until it happened to be the selected one.
   */
  it('draws the empty chip a boundary and a stroke', () => {
    picker()
    const none = screen.getByRole('button', { name: 'No colour' })

    expect(none.className).toContain('border-edge-strong')
    expect(none.querySelector('span[aria-hidden]')).not.toBeNull()
  })

  it('leaves a hue to carry its own boundary', () => {
    picker()
    const pine = screen.getByRole('button', { name: 'Pine' })

    expect(pine.className).toContain('border-edge-faint')
    expect(pine.querySelector('span[aria-hidden]')).toBeNull()
  })

  /**
   * A selected swatch is announced *and* ringed: colour alone cannot say which
   * one is chosen, least of all between two swatches a reader cannot tell apart.
   */
  it('says which swatch is chosen without relying on its colour', () => {
    picker({ value: '#256256' })
    const pine = screen.getByRole('button', { name: 'Pine' })

    expect(pine.getAttribute('aria-pressed')).toBe('true')
    expect(pine.className).toContain('ring-2')
  })

  /** A hover lift is motion, and a reader who asked for less does not get it. */
  it('holds still on hover for a reader who asked it to', () => {
    picker()
    const pine = screen.getByRole('button', { name: 'Pine' })

    expect(pine.className).toContain('motion-reduce:hover:scale-100')
  })
})
