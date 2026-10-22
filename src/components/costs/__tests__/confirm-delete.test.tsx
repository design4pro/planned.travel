// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import { ConfirmDeleteDialog } from '../confirm-delete'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

async function confirmFailing(
  cause: Error,
  subject?: 'expense' | 'payment',
): Promise<void> {
  const user = userEvent.setup({ delay: null })
  render(
    <I18nProvider locale="en" messages={EN}>
      <ConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        title="Dinner"
        subject={subject}
        amountMinor={6_000}
        currency="EUR"
        affects={[]}
        onConfirm={async () => {
          throw cause
        }}
      />
    </I18nProvider>,
  )
  await user.click(
    screen.getByRole('button', {
      name: Costs[
        subject === 'payment' ? 'delete.payment.confirm' : 'delete.confirm'
      ],
    }),
  )
}

describe('the delete confirmation when the delete fails', () => {
  it('says the catalogue line, never the failure envelope, for an unexpected failure', async () => {
    await confirmFailing(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      ),
    )

    expect(await screen.findByText(Costs['delete.failedBody'])).toBeTruthy()
    expect(screen.queryByText(/planned-travel\/failure/)).toBeNull()
  })
})

describe('the delete confirmation for a payment', () => {
  function mountPayment(onConfirm: () => Promise<void>) {
    render(
      <I18nProvider locale="en" messages={EN}>
        <ConfirmDeleteDialog
          open
          onOpenChange={() => {}}
          subject="payment"
          title="You → Anna"
          amountMinor={1_000}
          currency="EUR"
          affects={['Rafał', 'Anna']}
          onConfirm={onConfirm}
        />
      </I18nProvider>,
    )
  }

  it('asks about the payment, names the two people and the amount, and says what a correction is', () => {
    mountPayment(async () => {})

    expect(screen.getByText(Costs['delete.payment.title'])).toBeTruthy()
    expect(
      screen.getByText(
        Costs['delete.payment.description'].replace('{title}', 'You → Anna'),
      ),
    ).toBeTruthy()
    expect(screen.getByText('Balances change for Rafał and Anna.')).toBeTruthy()
    expect(screen.getByText('€10.00')).toBeTruthy()
    expect(screen.queryByText(Costs['delete.title'])).toBeNull()
  })

  it('confirms through the payment’s own button', async () => {
    const user = userEvent.setup({ delay: null })
    const onConfirm = vi.fn(async () => {})
    mountPayment(onConfirm)

    await user.click(
      screen.getByRole('button', { name: Costs['delete.payment.confirm'] }),
    )

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('says the payment’s own line when the delete fails', async () => {
    await confirmFailing(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_9z9z9z' }),
      ),
      'payment',
    )

    expect(
      await screen.findByText(Costs['delete.payment.failedBody']),
    ).toBeTruthy()
  })
})

describe('the delete confirmation while the delete is in flight', () => {
  function mountPending() {
    let finish: () => void = () => {}
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const onOpenChange = vi.fn()
    render(
      <I18nProvider locale="en" messages={EN}>
        <ConfirmDeleteDialog
          open
          onOpenChange={onOpenChange}
          subject="payment"
          title="Rafał → Anna"
          amountMinor={1_000}
          currency="EUR"
          affects={['Rafał', 'Anna']}
          onConfirm={onConfirm}
        />
      </I18nProvider>,
    )
    return { finish: () => finish(), onOpenChange }
  }

  it('cannot be dismissed, so "Keep it" never closes a delete that still goes through', async () => {
    const user = userEvent.setup({ delay: null })
    const { finish, onOpenChange } = mountPending()

    await user.click(
      screen.getByRole('button', { name: Costs['delete.payment.confirm'] }),
    )

    const keep = screen.getByRole('button', { name: Ui['action.keep'] })
    expect((keep as HTMLButtonElement).disabled).toBe(true)
    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()

    finish()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('can be dismissed again once the delete has failed', async () => {
    const user = userEvent.setup({ delay: null })
    const onOpenChange = vi.fn()
    render(
      <I18nProvider locale="en" messages={EN}>
        <ConfirmDeleteDialog
          open
          onOpenChange={onOpenChange}
          title="Dinner"
          amountMinor={6_000}
          currency="EUR"
          affects={[]}
          onConfirm={async () => {
            throw new Error('refused')
          }}
        />
      </I18nProvider>,
    )

    await user.click(
      screen.getByRole('button', { name: Costs['delete.confirm'] }),
    )
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: Ui['action.keep'] }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('where focus goes when the delete confirmation closes', () => {
  it('lets the caller name the place, because the row that opened it is gone', async () => {
    const user = userEvent.setup({ delay: null })
    const onCloseAutoFocus = vi.fn()

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <I18nProvider locale="en" messages={EN}>
          <ConfirmDeleteDialog
            open={open}
            onOpenChange={setOpen}
            subject="payment"
            title="Rafał → Anna"
            amountMinor={1_000}
            currency="EUR"
            affects={[]}
            onConfirm={async () => {}}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        </I18nProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: Ui['action.keep'] }))

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledTimes(1))
  })
})
