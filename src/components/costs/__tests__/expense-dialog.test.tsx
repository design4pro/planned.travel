// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { ExpenseDialog } from '../expense-dialog'

import type { Catalogue } from '#/lib/i18n'
import type {
  CostsDepartedPerson,
  CostsExpense,
  CostsPayload,
  CostsPerson,
} from '#/server/fns/costs'
import type { ReactElement } from 'react'
import type { ExpenseFormValue } from '../expense-dialog'

const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

// Each test chains several Radix combobox and typing interactions: about 1.7 s locally and past the
// default 5 s on a loaded CI runner (#1242), so this file carries its own ceiling.
vi.setConfig({ testTimeout: 20_000 })

const PEOPLE: ReadonlyArray<CostsPerson> = [
  { userId: 'u1', name: 'Ada', email: '', image: null, role: 'owner' },
  { userId: 'u2', name: 'Bo', email: '', image: null, role: 'editor' },
]

const SUGGESTED: CostsPayload['suggestedRate'] = {
  GBP: { rate: 1.15, observedOn: '2026-05-12' },
  USD: { rate: 0.5, observedOn: '2026-05-13' },
}

/** The static hint a foreign expense shows until both figures parse. */
const STATIC_HINT = 'What GBP came to in EUR on your statement.'
const SUGGESTED_HINT =
  'Suggested from the rate used on this trip on 12 May 2026 (\u20661 GBP = 1.15 EUR\u2069). Change it to match your statement.'

function expenseRow(overrides: Partial<CostsExpense>): CostsExpense {
  return {
    id: 'e1',
    title: 'Dinner',
    category: 'food',
    amountMinor: 6_000,
    currency: 'EUR',
    originalAmountMinor: null,
    originalCurrency: null,
    exchangeRate: null,
    convertedMinor: null,
    spentOn: '2026-05-10',
    paidBy: 'u1',
    splitMethod: 'equal',
    notes: null,
    shares: [],
    ...overrides,
  }
}

function hand(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null })
}

function open(
  suggestedRate: CostsPayload['suggestedRate'] | undefined,
  {
    onSubmit = async () => {},
    expense = null,
    departedPeople,
    people = PEOPLE,
  }: {
    onSubmit?: (value: ExpenseFormValue) => Promise<void>
    expense?: CostsExpense | null
    departedPeople?: ReadonlyArray<CostsDepartedPerson>
    people?: ReadonlyArray<CostsPerson>
  } = {},
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <ExpenseDialog
        open
        onOpenChange={() => {}}
        expense={expense}
        people={people}
        departedPeople={departedPeople}
        viewerUserId="u1"
        tripCurrency="EUR"
        categories={[{ value: 'food', label: 'Food', icon: null }]}
        defaultCategory="food"
        today="2026-10-12"
        suggestedRate={suggestedRate}
        onSubmit={onSubmit}
      />
    </I18nProvider>,
  )
}

async function pickCurrency(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> {
  await user.click(
    screen.getByRole('combobox', {
      name: 'Currency this receipt was written in',
    }),
  )
  await user.click(
    await screen.findByRole('option', { name: new RegExp(code) }),
  )
}

const amountField = (): HTMLElement => screen.getByLabelText(/^Amount/)
const convertedField = (): HTMLElement =>
  screen.getByLabelText(/^Converted to EUR/)
const valueOf = (field: HTMLElement): string =>
  (field as HTMLInputElement).value

// Each test opens the currency list several times with a real pointer; on the CI runner a test with
// three or four picks passes 5 s (#1238 failed on it three times, #1242).
describe('the expense dialog’s suggested converted figure', { timeout: 20_000 }, () => {
  it('pre-fills the figure the last frozen rate implies when the currency is picked before the amount', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    expect(valueOf(convertedField())).toBe('')
    await user.type(amountField(), '100.00')

    expect(valueOf(convertedField())).toBe('115.00')
    expect(screen.getByText(SUGGESTED_HINT)).toBeTruthy()
  })

  it('pre-fills it just the same when the amount is typed before the currency is picked', async () => {
    const user = hand()
    open(SUGGESTED)

    await user.type(amountField(), '100.00')
    await pickCurrency(user, 'GBP')

    expect(valueOf(convertedField())).toBe('115.00')
  })

  it('follows later changes of the amount and of the currency', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')
    await user.clear(amountField())
    await user.type(amountField(), '200.00')
    expect(valueOf(convertedField())).toBe('230.00')

    await pickCurrency(user, 'USD')
    expect(valueOf(convertedField())).toBe('100.00')
  })

  it('shows an empty field and today’s hint for a currency with no suggestion, and for an empty amount', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    expect(screen.getByText(STATIC_HINT)).toBeTruthy()

    await user.type(amountField(), '100.00')
    await pickCurrency(user, 'JPY')
    expect(valueOf(convertedField())).toBe('')
    expect(
      screen.getByText('What JPY came to in EUR on your statement.'),
    ).toBeTruthy()

    // The flag stays up: going back to a suggested currency suggests again.
    await pickCurrency(user, 'GBP')
    expect(valueOf(convertedField())).toBe('115.00')
  })

  it('stops following the moment the reader types in the field, and then says what today’s hint says', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')
    await user.type(convertedField(), '0')
    expect(valueOf(convertedField())).toBe('115.000')

    await user.clear(amountField())
    await user.type(amountField(), '200.00')
    await pickCurrency(user, 'USD')

    expect(valueOf(convertedField())).toBe('115.000')
    expect(screen.queryByText(/Suggested from the rate/)).toBeNull()
    expect(screen.getByText(/^1 USD = /)).toBeTruthy()
  })

  it('does not bring the suggestion back after the reader clears the field', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')
    await user.clear(convertedField())
    await user.clear(amountField())
    await user.type(amountField(), '200.00')

    expect(valueOf(convertedField())).toBe('')
    expect(screen.getByText(STATIC_HINT)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('never suggests for an expense that was already foreign, even after an amount or currency change', async () => {
    const user = hand()
    open(SUGGESTED, {
      expense: expenseRow({
        amountMinor: 11_000,
        originalAmountMinor: 10_000,
        originalCurrency: 'GBP',
      }),
    })

    expect(valueOf(convertedField())).toBe('110.00')
    await user.clear(amountField())
    await user.type(amountField(), '200.00')
    expect(valueOf(convertedField())).toBe('110.00')

    await pickCurrency(user, 'USD')
    expect(valueOf(convertedField())).toBe('110.00')
    expect(screen.queryByText(/Suggested from the rate/)).toBeNull()
  })

  it('names the trip’s own rate in the hint, not the one the rounded figure implies', async () => {
    const user = hand()
    open({ GBP: { rate: 1.1537, observedOn: '2026-05-12' } })

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '1.00')

    // 1.00 GBP rounds to 1.15 EUR, which would imply 1.15, not the 1.1537 the trip froze.
    expect(valueOf(convertedField())).toBe('1.15')
    expect(
      screen.getByText(
        /^Suggested from the rate used on this trip on 12 May 2026 \(\u20661 GBP = 1\.1537 EUR\u2069\)\./,
      ),
    ).toBeTruthy()
  })

  it('suggests nothing when the typed amount converts to less than the smallest unit', async () => {
    const user = hand()
    open({ GBP: { rate: 0.001, observedOn: '2026-05-12' } })

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '1.00')

    expect(valueOf(convertedField())).toBe('')
    expect(screen.getByText(STATIC_HINT)).toBeTruthy()
    expect(screen.queryByText(/Suggested from the rate/)).toBeNull()
  })

  it('suggests for a trip-currency expense that is switched to a foreign currency', async () => {
    const user = hand()
    open(SUGGESTED, { expense: expenseRow({}) })

    await pickCurrency(user, 'GBP')

    // The seeded 60.00 is now read as pounds.
    expect(valueOf(convertedField())).toBe('69.00')
    expect(
      screen.getByText(/^Suggested from the rate used on this trip/),
    ).toBeTruthy()
  })

  it.each([
    ['a null suggestedRate', null],
    ['a missing suggestedRate', undefined],
    ['an empty map', {}],
  ])('behaves exactly as before with %s', async (_name, suggestedRate) => {
    const user = hand()
    open(suggestedRate)

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')

    expect(valueOf(convertedField())).toBe('')
    expect(convertedField().getAttribute('placeholder')).toBe('0.00')
    expect(screen.getByText(STATIC_HINT)).toBeTruthy()
    expect(screen.queryByText(/Suggested from the rate/)).toBeNull()
  })

  it('reaches screen readers through the field’s described-by wiring, with no live region', async () => {
    const user = hand()
    open(SUGGESTED)

    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')

    const hint = screen.getByText(SUGGESTED_HINT)
    const describedBy = convertedField().getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toContain(hint.id)
    expect(document.querySelector('[aria-live]')).toBeNull()
    expect(document.activeElement).not.toBe(convertedField())
  })

  it('saves exactly the figure shown, as an amount pair and no rate', async () => {
    const onSubmit = vi.fn(async (_value: ExpenseFormValue) => {})
    const user = hand()
    open(SUGGESTED, { onSubmit })

    await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
    await pickCurrency(user, 'GBP')
    await user.type(amountField(), '100.00')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    const sent = onSubmit.mock.calls[0]?.[0]
    expect(sent).toMatchObject({
      amountMinor: 11_500,
      originalAmountMinor: 10_000,
      originalCurrency: 'GBP',
    })
    expect(Object.keys(sent ?? {})).not.toContain('exchangeRate')
  })

  describe('when the trip’s currency changed while it was open', () => {
    const REFUSAL = 'costs.refusal.tripCurrencyChanged'

    function dialog(
      tripCurrency: string,
      onSubmit: (value: ExpenseFormValue) => Promise<void>,
      expense: CostsExpense | null = null,
    ) {
      return (
        <I18nProvider locale="en" messages={EN}>
          <ExpenseDialog
            open
            onOpenChange={() => {}}
            expense={expense}
            people={PEOPLE}
            viewerUserId="u1"
            tripCurrency={tripCurrency}
            categories={[{ value: 'food', label: 'Food', icon: null }]}
            defaultCategory="food"
            today="2026-10-12"
            suggestedRate={null}
            onSubmit={onSubmit}
          />
        </I18nProvider>
      )
    }

    async function refuseOnce(user: ReturnType<typeof userEvent.setup>) {
      const onSubmit = vi
        .fn<(value: ExpenseFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
        .mockResolvedValue(undefined)
      const view = render(dialog('EUR', onSubmit))
      await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
      await user.type(amountField(), '4000')
      await user.click(screen.getByRole('button', { name: 'Add expense' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
      return { onSubmit, view }
    }

    it('keeps the digits, names the new currency on the amount and moves the currency control to it', async () => {
      const user = hand()
      const { view, onSubmit } = await refuseOnce(user)

      view.rerender(dialog('JPY', onSubmit))

      expect(await screen.findByDisplayValue('4000')).toBe(amountField())
      expect(amountField().getAttribute('aria-invalid')).toBe('true')
      expect(
        screen.getByText(/budget currency of this trip is now JPY/),
      ).toBeTruthy()
      expect(
        screen.getByRole('combobox', {
          name: 'Currency this receipt was written in',
        }).textContent,
      ).toContain('JPY')
      expect(screen.queryByText(REFUSAL)).toBeNull()
    })

    it('does not save the old digits until the reader has touched the amount, then sends them in the new currency', async () => {
      const user = hand()
      const { view, onSubmit } = await refuseOnce(user)
      view.rerender(dialog('JPY', onSubmit))
      await screen.findByDisplayValue('4000')

      const add = screen.getByRole('button', { name: 'Add expense' })
      expect(add).toHaveProperty('disabled', true)

      await user.clear(amountField())
      await user.type(amountField(), '4000')
      expect(add).toHaveProperty('disabled', false)
      await user.click(add)

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
      expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({
        amountMinor: 4_000,
        currency: 'JPY',
        originalAmountMinor: null,
        originalCurrency: null,
      })
    })

    it('stops naming the currency as soon as the amount is edited', async () => {
      const user = hand()
      const { view, onSubmit } = await refuseOnce(user)
      view.rerender(dialog('JPY', onSubmit))
      await screen.findByDisplayValue('4000')

      await user.type(amountField(), '5')

      expect(
        screen.queryByText(/budget currency of this trip is now/),
      ).toBeNull()
    })

    it('leaves a receipt currency the reader chose on purpose, and drops the converted figure that was in the old currency', async () => {
      const onSubmit = vi
        .fn<(value: ExpenseFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      const view = render(dialog('EUR', onSubmit))
      await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
      await pickCurrency(user, 'GBP')
      await user.type(amountField(), '100.00')
      await user.type(convertedField(), '115.00')
      await user.click(screen.getByRole('button', { name: 'Add expense' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())

      view.rerender(dialog('JPY', onSubmit))

      expect(await screen.findByDisplayValue('100.00')).toBe(amountField())
      expect(
        screen.getByRole('combobox', {
          name: 'Currency this receipt was written in',
        }).textContent,
      ).toContain('GBP')
      expect(screen.getByLabelText(/^Converted to JPY/)).toHaveProperty(
        'value',
        '',
      )
      expect(
        screen.getByText(/budget currency of this trip is now JPY/),
      ).toBeTruthy()
    })

    it('takes the keyboard to the amount and says so in the dialog when the refreshed currency has not arrived', async () => {
      const user = hand()
      await refuseOnce(user)

      await vi.waitFor(() => expect(document.activeElement).toBe(amountField()))
      expect(screen.getByText('That did not save')).toBeTruthy()
      expect(
        screen.getByText(/trip changed while you were confirming/),
      ).toBeTruthy()
      expect(screen.queryByText(REFUSAL)).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Add expense' }),
      ).toHaveProperty('disabled', false)
    })

    it('keeps the stored receipt amount of a foreign-currency expense and only drops the converted figure', async () => {
      const onSubmit = vi
        .fn<(value: ExpenseFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      const stored = expenseRow({
        amountMinor: 11_500,
        currency: 'EUR',
        originalAmountMinor: 10_000,
        originalCurrency: 'GBP',
        exchangeRate: 1.15,
        shares: [
          { userId: 'u1', shareMinor: 5_750, weight: 1, isSettled: false },
          { userId: 'u2', shareMinor: 5_750, weight: 1, isSettled: false },
        ],
      })
      const view = render(dialog('EUR', onSubmit, stored))
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())

      view.rerender(dialog('JPY', onSubmit, stored))

      expect(await screen.findByText(/now JPY/)).toBeTruthy()
      expect(amountField()).toHaveProperty('value', '100.00')
      expect(screen.getByLabelText(/^Converted to JPY/)).toHaveProperty(
        'value',
        '',
      )
    })

    it('drops the stored digits of an edited expense once the trip has moved on, so they are not saved as new-currency figures', async () => {
      const onSubmit = vi
        .fn<(value: ExpenseFormValue) => Promise<void>>()
        .mockRejectedValueOnce(new Error(REFUSAL))
      const user = hand()
      const stored = expenseRow({
        amountMinor: 6_000,
        currency: 'EUR',
        shares: [
          { userId: 'u1', shareMinor: 3_000, weight: 1, isSettled: false },
          { userId: 'u2', shareMinor: 3_000, weight: 1, isSettled: false },
        ],
      })
      const view = render(dialog('EUR', onSubmit, stored))
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())

      view.rerender(dialog('JPY', onSubmit, stored))

      expect(await screen.findByText(/now JPY/)).toBeTruthy()
      expect(amountField()).toHaveProperty('value', '')
      expect(
        screen.getByRole('button', { name: 'Save changes' }),
      ).toHaveProperty('disabled', true)
    })

    it('adopts the new currency once when the screen refreshes before the refusal arrives, as it does in the app', async () => {
      const user = hand()
      let rerender: (ui: ReactElement) => void = () => {}
      const onSubmit = vi
        .fn<(value: ExpenseFormValue) => Promise<void>>()
        .mockImplementationOnce(async () => {
          rerender(dialog('JPY', onSubmit))
          throw new Error(REFUSAL)
        })
        .mockResolvedValue(undefined)
      rerender = render(dialog('EUR', onSubmit)).rerender
      await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
      await user.type(amountField(), '4000')
      await user.click(screen.getByRole('button', { name: 'Add expense' }))

      expect(await screen.findByText(/now JPY/)).toBeTruthy()
      await vi.waitFor(() => expect(document.activeElement).toBe(amountField()))
      expect(amountField()).toHaveProperty('value', '4000')
      expect(screen.queryByText('That did not save')).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Add expense' }),
      ).toHaveProperty('disabled', true)
    })
  })
})

describe('the split of an expense that names someone who has left the trip', () => {
  const DEPARTED: ReadonlyArray<CostsDepartedPerson> = [
    { userId: 'u9', name: 'Cy', image: null },
  ]
  const DINNER = expenseRow({
    shares: [
      { userId: 'u1', shareMinor: 2_000, weight: 1, isSettled: false },
      { userId: 'u2', shareMinor: 2_000, weight: 1, isSettled: false },
      { userId: 'u9', shareMinor: 2_000, weight: 1, isSettled: false },
    ],
  })
  const cyBox = (): HTMLElement =>
    screen.getByRole('checkbox', { name: 'Include Cy in this split' })

  async function saveWith(
    act: (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
  ): Promise<ExpenseFormValue | undefined> {
    const onSubmit = vi.fn(async (_value: ExpenseFormValue) => {})
    const user = hand()
    open(undefined, { expense: DINNER, departedPeople: DEPARTED, onSubmit })
    await act(user)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    return onSubmit.mock.calls[0]?.[0]
  }

  it('shows their share under their name, marked as having left', () => {
    open(undefined, { expense: DINNER, departedPeople: DEPARTED })

    const row = cyBox().closest('li')
    expect(row?.textContent).toContain('Cy')
    expect(row?.textContent).toContain('Left the trip')
    expect(cyBox().getAttribute('aria-checked')).toBe('true')
  })

  it('words someone the workspace no longer knows from the catalogue, not as a blank row', () => {
    open(undefined, {
      expense: DINNER,
      departedPeople: [{ userId: 'u9', name: null, image: null }],
    })

    const row = screen
      .getByRole('checkbox', { name: 'Include Removed traveller in this split' })
      .closest('li')
    expect(row?.textContent).toContain('Removed traveller')
  })

  it('says that unticking them removes the share for good', () => {
    open(undefined, { expense: DINNER, departedPeople: DEPARTED })

    expect(screen.getByText(/removes their share for good/)).toBeTruthy()
  })

  it('sends every stored share back when the split is not touched', async () => {
    const sent = await saveWith(async () => {})

    expect(sent?.participants.map((row) => row.userId)).toEqual([
      'u1',
      'u2',
      'u9',
    ])
    expect(sent?.shares).toEqual([
      { userId: 'u1', shareMinor: 2_000, weight: 1 },
      { userId: 'u2', shareMinor: 2_000, weight: 1 },
      { userId: 'u9', shareMinor: 2_000, weight: 1 },
    ])
  })

  it('drops their share only when the editor unticks it', async () => {
    const sent = await saveWith(async (user) => {
      await user.click(cyBox())
    })

    expect(sent?.participants.map((row) => row.userId)).toEqual(['u1', 'u2'])
    expect(sent?.shares.map((row) => row.shareMinor)).toEqual([3_000, 3_000])
  })

  it('leaves them alone for both "Nobody" and "Everyone": only their own checkbox removes the share', async () => {
    const sent = await saveWith(async (user) => {
      await user.click(screen.getByRole('button', { name: 'Nobody' }))
      await user.click(screen.getByRole('button', { name: 'Everyone' }))
    })

    expect(sent?.participants.map((row) => row.userId)).toEqual([
      'u1',
      'u2',
      'u9',
    ])
  })

  it('ties their checkbox to the warning that unticking is final', () => {
    open(undefined, { expense: DINNER, departedPeople: DEPARTED })

    const hint = screen.getByText(/removes their share for good/)
    expect(cyBox().getAttribute('aria-describedby')).toBe(hint.id)
    expect(
      screen
        .getByRole('checkbox', { name: /Include Ada/ })
        .getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('shows only the departed people this expense names', () => {
    open(undefined, {
      expense: expenseRow({
        shares: [
          { userId: 'u1', shareMinor: 6_000, weight: 1, isSettled: false },
        ],
      }),
      departedPeople: DEPARTED,
    })

    expect(screen.queryByRole('checkbox', { name: /Cy/ })).toBeNull()
  })

  it('shows none on a new expense', () => {
    open(undefined, { departedPeople: DEPARTED })

    expect(screen.queryByRole('checkbox', { name: /Cy/ })).toBeNull()
    expect(screen.queryByText('Left the trip')).toBeNull()
  })
})

describe('the people a new line of money may name, once someone has left the workspace (#1034)', () => {
  // Dee is still on the trip but no longer in the workspace: the server refuses her on new money.
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
  const deeBox = (): HTMLElement | null =>
    screen.queryByRole('checkbox', { name: 'Include Dee in this split' })

  async function payerNames(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<Array<string>> {
    await user.click(screen.getByRole('combobox', { name: 'Who paid' }))
    return (await screen.findAllByRole('option')).map(
      (option) => option.textContent,
    )
  }

  it('offers her neither as payer nor in the split of a new expense, and never sends her', async () => {
    const onSubmit = vi.fn(async (_value: ExpenseFormValue) => {})
    const user = hand()
    open(undefined, { people: WITH_LEAVER, onSubmit })

    expect(deeBox()).toBeNull()
    expect(screen.getByRole('checkbox', { name: /Include Bo/ })).toBeTruthy()
    const names = await payerNames(user)
    expect(names.some((name) => name?.includes('Bo'))).toBe(true)
    expect(names.some((name) => name?.includes('Dee'))).toBe(false)

    await user.keyboard('{Escape}')
    await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
    await user.type(amountField(), '9.00')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(
      onSubmit.mock.calls[0]?.[0].participants.map((row) => row.userId),
    ).toEqual(['u1', 'u2'])
  })

  it('keeps her where the expense being edited already names her', async () => {
    const user = hand()
    open(undefined, {
      people: WITH_LEAVER,
      expense: expenseRow({
        paidBy: 'u3',
        shares: [
          { userId: 'u1', shareMinor: 3_000, weight: 1, isSettled: false },
          { userId: 'u3', shareMinor: 3_000, weight: 1, isSettled: false },
        ],
      }),
    })

    expect(deeBox()?.getAttribute('aria-checked')).toBe('true')
    expect((await payerNames(user)).some((name) => name?.includes('Dee'))).toBe(
      true,
    )
  })

  it('keeps her in the split of an edited expense she shares but did not pay', () => {
    open(undefined, {
      people: WITH_LEAVER,
      expense: expenseRow({
        paidBy: 'u1',
        shares: [
          { userId: 'u1', shareMinor: 3_000, weight: 1, isSettled: false },
          { userId: 'u3', shareMinor: 3_000, weight: 1, isSettled: false },
        ],
      }),
    })

    expect(deeBox()?.getAttribute('aria-checked')).toBe('true')
  })

  it('keeps her as the payer of an edited expense she has no share in', async () => {
    const user = hand()
    open(undefined, {
      people: WITH_LEAVER,
      expense: expenseRow({
        paidBy: 'u3',
        shares: [
          { userId: 'u1', shareMinor: 6_000, weight: 1, isSettled: false },
        ],
      }),
    })

    expect((await payerNames(user)).some((name) => name?.includes('Dee'))).toBe(
      true,
    )
  })

  it('does not offer her on an edited expense that does not carry her', async () => {
    const user = hand()
    open(undefined, {
      people: WITH_LEAVER,
      expense: expenseRow({
        shares: [
          { userId: 'u1', shareMinor: 6_000, weight: 1, isSettled: false },
        ],
      }),
    })

    expect(deeBox()).toBeNull()
    expect((await payerNames(user)).some((name) => name?.includes('Dee'))).toBe(
      false,
    )
  })
})

describe('the expense dialog when the save fails', () => {
  async function failWith(cause: Error): Promise<void> {
    const user = hand()
    open(undefined, {
      onSubmit: async () => {
        throw cause
      },
    })
    await user.type(screen.getByLabelText(/^What was it for/), 'Pub lunch')
    await user.type(amountField(), '10.00')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
  }

  it('says the catalogue line, never the failure envelope, for an unexpected failure', async () => {
    await failWith(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'evt_1a2b3c' }),
      ),
    )

    expect(await screen.findByText(Costs['expense.saveFallback'])).toBeTruthy()
    expect(screen.queryByText(/planned-travel\/failure/)).toBeNull()
  })

  it('says the sentence a validation failure names the field with', async () => {
    await failWith(
      new Error(
        encodePublicFailure({
          kind: 'validation',
          message: 'The amount must be more than zero.',
        }),
      ),
    )

    expect(
      await screen.findByText('The amount must be more than zero.'),
    ).toBeTruthy()
  })
})
