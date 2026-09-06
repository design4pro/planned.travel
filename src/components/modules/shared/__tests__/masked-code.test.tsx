/**
 * The mask, at the two seams the timelines depend on: the glyph count, which is
 * what keeps a revealed code from moving the row it sits in, and the reveal
 * itself — which is a control swap, and therefore a place a keyboard reader can
 * be dropped.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import modules from '#/lib/i18n/messages/en/modules'
import { MASK_CHARACTER, MaskedCode, maskCode } from '../masked-code'

import type { Catalogue } from '#/lib/i18n'
import type { ReactNode } from 'react'

const LABEL = 'the confirmation number for Hotel Gracery'

/**
 * The real source catalogue, namespaced the way the provider expects.
 *
 * The reveal's accessible name is a key rather than a template now, so every
 * render of the masked state needs a provider above it — and reading the shipped
 * file rather than a stub means a key nobody wrote fails here.
 */
const EN: Catalogue = Object.fromEntries(
  Object.entries(modules).map(([key, message]) => [`modules.${key}`, message]),
)

function inEnglish(node: ReactNode) {
  return (
    <I18nProvider locale="en" messages={EN}>
      {node}
    </I18nProvider>
  )
}

describe('maskCode', () => {
  it('masks a code to its own length, so the shape is kept and the value is not', () => {
    const masked = maskCode('ABC123XYZ')
    expect(masked).toHaveLength(9)
    expect(masked).not.toContain('A')
    expect(masked).toBe(MASK_CHARACTER.repeat(9))
  })

  /**
   * An empty code masks to nothing rather than to a row of dots: a mask over an
   * absent value tells the reader a confirmation number exists when none does.
   */
  it('masks an empty code to nothing at all', () => {
    expect(maskCode('')).toBe('')
    expect(maskCode('   ')).toBe('')
  })

  it('counts characters rather than bytes, so a surrogate pair masks to one', () => {
    expect(maskCode('A🙂B')).toHaveLength(3)
  })
})

describe('MaskedCode', () => {
  it('keeps the value out of the document until it is revealed', () => {
    const { container } = render(
      inEnglish(<MaskedCode value="HG-8842190" label={LABEL} masked />),
    )

    expect(container.textContent).not.toContain('HG-8842190')
    expect(screen.getByRole('button', { name: `Show ${LABEL}` })).toBeDefined()
  })

  it('shows the code, and the control that copies it, once asked', async () => {
    const user = userEvent.setup()
    render(inEnglish(<MaskedCode value="HG-8842190" label={LABEL} masked />))

    await user.click(screen.getByRole('button', { name: `Show ${LABEL}` }))

    expect(
      screen.getByRole('button', { name: `Copy ${LABEL}` }).textContent,
    ).toContain('HG-8842190')
  })

  /**
   * The reveal unmounts the button doing the revealing, so without the handover
   * a reader who tabbed onto the mask is returned to the top of the document by
   * the act of opening it.
   */
  it('hands the focus to the revealed control when it was revealed from the keyboard', async () => {
    render(inEnglish(<MaskedCode value="HG-8842190" label={LABEL} masked />))

    screen.getByRole('button', { name: `Show ${LABEL}` }).focus()

    const copy = await screen.findByRole('button', { name: `Copy ${LABEL}` })
    expect(document.activeElement).toBe(copy)
  })

  /** A hover never held the focus, so it must not take it either. */
  it('leaves the focus alone when a pointer reveals the code', async () => {
    const user = userEvent.setup()
    render(
      inEnglish(
        <>
          <button type="button">Elsewhere</button>
          <MaskedCode value="HG-8842190" label={LABEL} masked />
        </>,
      ),
    )

    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    await user.hover(screen.getByRole('button', { name: `Show ${LABEL}` }))

    expect(screen.getByRole('button', { name: `Copy ${LABEL}` })).toBeDefined()
    expect(document.activeElement).toBe(elsewhere)
  })

  it('never masks when the preference is off, or when there is no code', () => {
    const { rerender } = render(
      inEnglish(<MaskedCode value="HG-8842190" label={LABEL} masked={false} />),
    )
    expect(screen.getByRole('button', { name: `Copy ${LABEL}` })).toBeDefined()

    rerender(inEnglish(<MaskedCode value="" label={LABEL} masked />))
    expect(screen.queryByRole('button', { name: `Show ${LABEL}` })).toBeNull()
  })
})
