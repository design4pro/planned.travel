import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import { PromotionCodeField, usePromotionCode } from '../promotion-code'

import type { Catalogue } from '#/lib/i18n'
import type { DiscountRejectionReason } from '#/server/billing/discounts'

const EN: Catalogue = {
  ...namespaceCatalogue('settings', Settings),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

/**
 * The page as far as the code is concerned: the field, and a plan button that sends whatever
 * `read()` returns — or nothing, when it returns `null` — and puts a refusal back under the field.
 */
function Page({
  canApply = true,
  send,
  refusal = null,
}: {
  canApply?: boolean
  send: (code: string | undefined) => void
  refusal?: DiscountRejectionReason | null
}) {
  const state = usePromotionCode()

  function choose(): void {
    const code = state.read()
    if (code === null) return
    send(code)
    if (refusal !== null) state.reject(refusal)
  }

  return (
    <>
      <PromotionCodeField
        state={state}
        canApply={canApply}
        applyPending={false}
        disabled={false}
        onApply={choose}
      />
      <button type="button" onClick={choose}>
        Choose Crew
      </button>
    </>
  )
}

function renderPage(props: Parameters<typeof Page>[0]) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <Page {...props} />
    </I18nProvider>,
  )
}

const toggle = () =>
  screen.getByRole('button', { name: 'Have a promotion code?' })

describe('the promotion-code field', () => {
  it('starts collapsed behind a real disclosure button', async () => {
    const user = userEvent.setup()
    renderPage({ send: vi.fn(), canApply: false })

    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Promotion code')).toBeNull()

    await user.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    const input = screen.getByLabelText('Promotion code')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect(
      screen.queryByText('Applied to the plan you choose next.'),
    ).not.toBeNull()
  })

  it('sends no code at all when the field is empty', async () => {
    const user = userEvent.setup()
    const send = vi.fn()
    renderPage({ send })

    await user.click(screen.getByRole('button', { name: 'Choose Crew' }))
    expect(send).toHaveBeenCalledWith(undefined)
  })

  it('sends the trimmed code with the plan choice', async () => {
    const user = userEvent.setup()
    const send = vi.fn()
    renderPage({ send })

    await user.click(toggle())
    await user.type(screen.getByLabelText('Promotion code'), ' summer20 ')
    await user.click(screen.getByRole('button', { name: 'Choose Crew' }))
    expect(send).toHaveBeenCalledWith('summer20')
  })

  it('sends nothing for a code of the wrong shape, and says why at the field', async () => {
    const user = userEvent.setup()
    const send = vi.fn()
    renderPage({ send })

    await user.click(toggle())
    const input = screen.getByLabelText('Promotion code')
    await user.type(input, 'NO-GOOD')
    await user.click(screen.getByRole('button', { name: 'Choose Crew' }))

    expect(send).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Codes are 3 to 64 letters and digits.'),
    ).not.toBeNull()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(input)
  })

  it.each([
    ['invalid', 'That code isn’t valid. Check it and try again.'],
    ['not_applicable', 'That code doesn’t apply to this plan.'],
    ['rate_limited', 'Too many codes tried. Try again in an hour.'],
    ['busy', 'Codes can’t be checked right now. Try again in a minute.'],
  ] as const)(
    'shows the %s refusal under the field and focuses it',
    async (reason, message) => {
      const user = userEvent.setup()
      renderPage({ send: vi.fn(), refusal: reason })

      await user.click(toggle())
      await user.type(screen.getByLabelText('Promotion code'), 'SUMMER20')
      // Collapsed again before the answer: a refusal must reopen it.
      await user.click(toggle())
      await user.click(screen.getByRole('button', { name: 'Choose Crew' }))

      const input = screen.getByLabelText('Promotion code')
      expect(toggle().getAttribute('aria-expanded')).toBe('true')
      expect(screen.queryByText(normalise(message))).not.toBeNull()
      expect(document.activeElement).toBe(input)
    },
  )

  it('offers Apply to current plan only when there is a subscription', async () => {
    const user = userEvent.setup()
    renderPage({ send: vi.fn(), canApply: false })

    await user.click(toggle())
    expect(
      screen.queryByRole('button', { name: 'Apply to current plan' }),
    ).toBeNull()
  })

  it('names both paths in the hint when the code can go on the current plan', async () => {
    const user = userEvent.setup()
    renderPage({ send: vi.fn() })

    await user.click(toggle())
    expect(
      screen.queryByText(
        'Apply it to your current plan, or choose a plan below.',
      ),
    ).not.toBeNull()
    expect(
      screen.queryByText('Applied to the plan you choose next.'),
    ).toBeNull()
  })

  it('applies a typed code to the current plan', async () => {
    const user = userEvent.setup()
    const send = vi.fn()
    renderPage({ send })

    await user.click(toggle())
    const apply = screen.getByRole('button', { name: 'Apply to current plan' })
    expect(apply.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByLabelText('Promotion code'), 'SUMMER20')
    await user.click(apply)
    expect(send).toHaveBeenCalledWith('SUMMER20')
  })
})

/** The catalogue may write the apostrophe straight or curly; match whichever it holds. */
function normalise(message: string): RegExp {
  return new RegExp(`^${message.replace(/’/g, "['’]").replace(/\./g, '\\.')}$`)
}
