// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { PaymentDialog } from '../payment-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPerson } from '#/server/fns/costs'
import type { PaymentFormValue, PaymentSeed } from '../payment-dialog'

const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

const PEOPLE: ReadonlyArray<CostsPerson> = [
  { userId: 'u1', name: 'Ada', email: '', image: null, role: 'owner' },
  { userId: 'u2', name: 'Bo', email: '', image: null, role: 'editor' },
]

function hand(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null })
}

function open(
  onSubmit: (value: PaymentFormValue) => Promise<void> = async () => {},
  onOpenChange: (open: boolean) => void = () => {},
  seed: PaymentSeed | null = null,
  people: ReadonlyArray<CostsPerson> = PEOPLE,
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        seed={seed}
        people={people}
        viewerUserId="u1"
        currency="EUR"
        today="2026-10-12"
        onSubmit={onSubmit}
      />
    </I18nProvider>,
  )
}

/** The currency picker, found by the stable attribute the browser evidence drives it through. */
function currencyPicker(): HTMLElement {
  const field = document.querySelector<HTMLElement>(
    '[data-part="payment-currency"]',
  )
  if (field === null) {
    throw new Error('the payment currency picker is not rendered')
  }
  return within(field).getByRole('combobox')
}

async function pickCurrency(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> {
  await user.click(currencyPicker())
  await user.click(
    await screen.findByRole('option', { name: new RegExp(code) }),
  )
}

describe('the payment dialog', () => {
  it('records a payment in the trip’s currency with no source figures and no converted field', async () => {
    const onSubmit = vi.fn(async (_value: PaymentFormValue) => {})
    const user = hand()
    open(onSubmit)

    expect(screen.queryByLabelText(/Converted to/)).toBeNull()
    await user.type(screen.getByLabelText(/Amount in EUR/), '40.00')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      fromUserId: 'u1',
      toUserId: 'u2',
      amountMinor: 4_000,
      originalAmountMinor: null,
      originalCurrency: null,
    })
  })

  it('reveals the converted field with the derived rate as its hint once another currency is picked', async () => {
    const user = hand()
    open()

    await pickCurrency(user, 'GBP')

    const converted = screen.getByLabelText(/Converted to EUR/)
    expect(
      screen.getByText('What GBP came to in EUR on your statement.'),
    ).toBeTruthy()
    // Nothing to derive a rate from yet, so the payment cannot be recorded.
    await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
    expect(
      screen.getByRole('button', { name: 'Record payment' }),
    ).toHaveProperty('disabled', true)

    await user.type(converted, '100.00')
    expect(screen.getByText(/^1 GBP = 1\.1\d+ EUR$/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Record payment' }),
    ).toHaveProperty('disabled', false)
  })

  it('sends the converted amount as the payment and the typed amount as its source, and no rate', async () => {
    const onSubmit = vi.fn(async (_value: PaymentFormValue) => {})
    const user = hand()
    open(onSubmit)

    await pickCurrency(user, 'GBP')
    await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
    await user.type(screen.getByLabelText(/Converted to EUR/), '100.00')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    const sent = onSubmit.mock.calls[0]?.[0]
    expect(sent).toMatchObject({
      amountMinor: 10_000,
      originalAmountMinor: 8_500,
      originalCurrency: 'GBP',
    })
    expect(Object.keys(sent ?? {})).not.toContain('exchangeRate')
  })

  it('moves the suggested amount to the converted field when another currency is picked, and back', async () => {
    const onSubmit = vi.fn(async (_value: PaymentFormValue) => {})
    const user = hand()
    open(onSubmit, () => {}, {
      fromUserId: 'u2',
      toUserId: 'u1',
      amountMinor: 4_650,
    })
    expect(screen.getByLabelText(/Amount in EUR/)).toHaveProperty(
      'value',
      '46.50',
    )

    await pickCurrency(user, 'GBP')
    expect(screen.getByLabelText(/Amount in GBP/)).toHaveProperty('value', '')
    expect(screen.getByLabelText(/Converted to EUR/)).toHaveProperty(
      'value',
      '46.50',
    )

    await pickCurrency(user, 'EUR')
    expect(screen.getByLabelText(/Amount in EUR/)).toHaveProperty(
      'value',
      '46.50',
    )
    expect(screen.queryByLabelText(/Converted to/)).toBeNull()
  })

  it('keeps everything the payer typed on screen when the write is refused', async () => {
    const onOpenChange = vi.fn()
    const user = hand()
    open(async () => {
      throw new Error('The payment could not be recorded.')
    }, onOpenChange)

    await pickCurrency(user, 'GBP')
    await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
    await user.type(screen.getByLabelText(/Converted to EUR/), '100.00')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText(/Amount in GBP/)).toHaveProperty(
      'value',
      '85.00',
    )
    expect(screen.getByLabelText(/Converted to EUR/)).toHaveProperty(
      'value',
      '100.00',
    )
    expect(currencyPicker().textContent).toContain('GBP')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('disables the picker and the converted field while the write is in flight', async () => {
    let finish: () => void = () => {}
    const user = hand()
    open(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )

    await pickCurrency(user, 'GBP')
    await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
    await user.type(screen.getByLabelText(/Converted to EUR/), '100.00')
    expect(currencyPicker()).toHaveProperty('disabled', false)

    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(currencyPicker()).toHaveProperty('disabled', true)
    expect(screen.getByLabelText(/Converted to EUR/)).toHaveProperty(
      'disabled',
      true,
    )
    finish()
  })

  describe('when the trip’s currency changed while it was open', () => {
    const REFUSAL = 'costs.refusal.tripCurrencyChanged'

    function dialog(
      currency: string,
      onSubmit: (value: PaymentFormValue) => Promise<void>,
      seed: PaymentSeed | null = null,
    ) {
      return (
        <I18nProvider locale="en" messages={EN}>
          <PaymentDialog
            open
            onOpenChange={() => {}}
            seed={seed}
            people={PEOPLE}
            viewerUserId="u1"
            currency={currency}
            today="2026-10-12"
            onSubmit={onSubmit}
          />
        </I18nProvider>
      )
    }

    async function refuseOnce() {
      const onSubmit = vi
        .fn<(value: PaymentFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
        .mockResolvedValue(undefined)
      const user = hand()
      const view = render(dialog('EUR', onSubmit))
      await user.type(screen.getByLabelText(/Amount in EUR/), '4000')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
      return { onSubmit, user, view }
    }

    it('keeps the digits, names the new currency on the amount, and shows no generic error', async () => {
      const { view, onSubmit } = await refuseOnce()

      view.rerender(dialog('JPY', onSubmit))

      const amount = await screen.findByLabelText(/Amount in JPY/)
      expect(amount).toHaveProperty('value', '4000')
      expect(amount.getAttribute('aria-invalid')).toBe('true')
      expect(
        screen.getByText(/budget currency of this trip is now JPY/),
      ).toBeTruthy()
      expect(screen.queryByText(REFUSAL)).toBeNull()
      expect(currencyPicker().textContent).toContain('JPY')
    })

    it('does not save the old digits until the reader has touched the amount, then sends them in the new currency', async () => {
      const { view, onSubmit, user } = await refuseOnce()
      view.rerender(dialog('JPY', onSubmit))
      const amount = await screen.findByLabelText(/Amount in JPY/)

      const record = screen.getByRole('button', { name: 'Record payment' })
      expect(record).toHaveProperty('disabled', true)

      await user.clear(amount)
      await user.type(amount, '4000')
      expect(record).toHaveProperty('disabled', false)
      await user.click(record)

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
      expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({
        amountMinor: 4_000,
        originalAmountMinor: null,
        originalCurrency: null,
      })
    })

    it('stops naming the currency as soon as the amount is edited', async () => {
      const { view, onSubmit, user } = await refuseOnce()
      view.rerender(dialog('JPY', onSubmit))
      const amount = await screen.findByLabelText(/Amount in JPY/)

      await user.type(amount, '5')

      expect(
        screen.queryByText(/budget currency of this trip is now/),
      ).toBeNull()
      expect(amount.getAttribute('aria-invalid')).not.toBe('true')
    })

    it('leaves a currency the payer chose on purpose alone, and drops the converted figure that was in the old currency', async () => {
      const onSubmit = vi
        .fn<(value: PaymentFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      const view = render(dialog('EUR', onSubmit))
      await pickCurrency(user, 'GBP')
      await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
      await user.type(screen.getByLabelText(/Converted to EUR/), '100.00')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())

      view.rerender(dialog('JPY', onSubmit))

      expect(await screen.findByLabelText(/Amount in GBP/)).toHaveProperty(
        'value',
        '85.00',
      )
      expect(currencyPicker().textContent).toContain('GBP')
      const converted = screen.getByLabelText(/Converted to JPY/)
      expect(converted).toHaveProperty('value', '')
      expect(
        screen.getByText(/budget currency of this trip is now JPY/),
      ).toBeTruthy()
    })

    it('takes the keyboard to the amount and says so in the dialog when the refreshed currency has not arrived', async () => {
      await refuseOnce()

      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByLabelText(/Amount in EUR/),
        ),
      )
      expect(screen.getByText('That did not save')).toBeTruthy()
      expect(
        screen.getByText(/trip changed while you were confirming/),
      ).toBeTruthy()
      expect(screen.queryByText(REFUSAL)).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Record payment' }),
      ).toHaveProperty('disabled', false)
    })

    it('takes the keyboard to the converted figure of a foreign payment once saving is over', async () => {
      const onSubmit = vi
        .fn<(value: PaymentFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      render(dialog('EUR', onSubmit))
      await pickCurrency(user, 'GBP')
      await user.type(screen.getByLabelText(/Amount in GBP/), '85.00')
      await user.type(screen.getByLabelText(/Converted to EUR/), '100.00')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))

      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByLabelText(/Converted to EUR/),
        ),
      )
    })

    it('drops a Settle-suggested amount once the trip has moved on, so it is not saved as a new-currency figure', async () => {
      const seed: PaymentSeed = {
        fromUserId: 'u2',
        toUserId: 'u1',
        amountMinor: 4_000,
      }
      const onSubmit = vi
        .fn<(value: PaymentFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      const view = render(dialog('EUR', onSubmit, seed))
      await user.click(screen.getByRole('button', { name: 'Record payment' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())

      view.rerender(dialog('JPY', onSubmit, seed))

      expect(await screen.findByLabelText(/Amount in JPY/)).toHaveProperty(
        'value',
        '',
      )
      expect(
        screen.getByRole('button', { name: 'Record payment' }),
      ).toHaveProperty('disabled', true)
    })
  })
})

describe('the payment dialog when recording fails', () => {
  it('says the catalogue line, never the failure envelope, for an unexpected failure', async () => {
    const user = hand()
    open(async () => {
      throw new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      )
    })

    await user.type(screen.getByLabelText(/Amount in EUR/), '40.00')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByText(Costs['payment.failed'])).toBeTruthy()
    expect(screen.queryByText(/planned-travel\/failure/)).toBeNull()
  })
})

describe('the payment dialog once someone has left the workspace (#1034)', () => {
  const WITH_LEAVER: ReadonlyArray<CostsPerson> = [
    ...PEOPLE,
    {
      userId: 'u3',
      name: 'Dee',
      email: '',
      image: null,
      role: 'editor',
      leftWorkspace: true,
    },
  ]

  async function optionsOf(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ): Promise<Array<string>> {
    await user.click(screen.getByRole('combobox', { name }))
    const names = (await screen.findAllByRole('option')).map(
      (option) => option.textContent ?? '',
    )
    await user.keyboard('{Escape}')
    return names
  }

  it('offers her on neither side of a blank payment', async () => {
    const user = hand()
    open(undefined, undefined, null, WITH_LEAVER)

    for (const name of ['Who is paying', 'Who is being paid']) {
      expect((await optionsOf(user, name)).join('|')).not.toContain('Dee')
    }
  })

  it('still offers her on a payment that already carries her', async () => {
    const user = hand()
    open(
      undefined,
      undefined,
      { fromUserId: 'u3', toUserId: 'u1', amountMinor: 500 },
      WITH_LEAVER,
    )

    expect((await optionsOf(user, 'Who is paying')).join('|')).toContain('Dee')
  })
})
