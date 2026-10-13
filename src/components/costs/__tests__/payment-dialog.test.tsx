// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { PaymentDialog } from '../payment-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPerson } from '#/server/fns/costs'
import type { PaymentFormValue } from '../payment-dialog'

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
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        seed={null}
        people={PEOPLE}
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
})
