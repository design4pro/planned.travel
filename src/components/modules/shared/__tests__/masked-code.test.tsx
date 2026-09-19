/**
 * The mask, at the two seams the timelines depend on: the glyph count, which is
 * what keeps a revealed code from moving the row it sits in, and the rule for
 * when a code is masked — which only an intent-bearing gesture lifts, and only
 * until the reader moves on. The control's own states are `copy-value.test.tsx`.
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

  /** A pointer crossing a row is not a decision to read the code on it. */
  it('a hover no longer reveals the code', async () => {
    const user = userEvent.setup()
    render(inEnglish(<MaskedCode value="HG-8842190" label={LABEL} masked />))

    await user.hover(screen.getByRole('button', { name: `Show ${LABEL}` }))

    expect(document.body.textContent).not.toContain('HG-8842190')
  })

  it('moving on masks the code again', async () => {
    const user = userEvent.setup()
    render(
      inEnglish(
        <>
          <MaskedCode value="HG-8842190" label={LABEL} masked />
          <button type="button">Elsewhere</button>
        </>,
      ),
    )

    await user.click(screen.getByRole('button', { name: `Show ${LABEL}` }))
    expect(document.body.textContent).toContain('HG-8842190')

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(document.body.textContent).not.toContain('HG-8842190')
    expect(screen.getByRole('button', { name: `Show ${LABEL}` })).toBeDefined()
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
