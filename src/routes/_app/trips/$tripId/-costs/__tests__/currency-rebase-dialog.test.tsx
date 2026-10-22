// The dialog mounts Radix-backed primitives, which need the pointer-capture and
// scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import {
  PL,
  copyOf,
  descriptionOf,
} from '#/components/costs/__tests__/localised'
import {
  COMMIT_TIMEOUT_MS,
  CurrencyRebaseDialog,
} from '../currency-rebase-dialog'

import type { Catalogue } from '#/lib/i18n'
import type { CostsPerson } from '#/server/fns/costs'
import type { CurrencyChangePreview } from '#/server/repos'
import type { CurrencyRebaseDialogProps } from '../currency-rebase-dialog'

const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const PEOPLE: ReadonlyArray<CostsPerson> = [
  { userId: 'u1', name: 'Ada', email: '', image: null, role: 'owner' },
  { userId: 'u2', name: 'Bo', email: '', image: null, role: 'editor' },
]

/** A preview as the server answers it for a trip with money in it, EUR to JPY at 165. */
function preview(
  overrides: Partial<CurrencyChangePreview> = {},
): CurrencyChangePreview {
  return {
    from: 'EUR',
    to: 'JPY',
    rate: { value: 165, source: 'recent' },
    counts: {
      expenses: 3,
      settlements: 1,
      budgetItems: 2,
      shareRows: 6,
      pinnedPrices: 4,
    },
    example: {
      original: { amountMinor: 10_000, currency: 'EUR' },
      converted: { amountMinor: 1_650_000, currency: 'JPY' },
    },
    budgetTarget: { before: 200_000, after: 33_000_000 },
    balances: { maxMovementMinor: 2, leftovers: [] },
    statements: 20,
    ceiling: 900,
    refusal: null,
    ...overrides,
  }
}

function refused(
  refusal: NonNullable<CurrencyChangePreview['refusal']>,
  overrides: Partial<CurrencyChangePreview> = {},
): CurrencyChangePreview {
  return preview({
    example: null,
    budgetTarget: null,
    balances: null,
    refusal,
    ...overrides,
  })
}

const NOTHING = preview({
  rate: null,
  counts: {
    expenses: 0,
    settlements: 0,
    budgetItems: 0,
    shareRows: 0,
    pinnedPrices: 0,
  },
  example: null,
  budgetTarget: null,
  balances: { maxMovementMinor: 0, leftovers: [] },
  statements: 1,
})

const NO_RATE = refused({ kind: 'no-rate' }, { rate: null })

type Load = CurrencyRebaseDialogProps['loadPreview']
type Commit = CurrencyRebaseDialogProps['commit']

interface Handles {
  readonly loadPreview: ReturnType<typeof vi.fn<Load>>
  readonly commit: ReturnType<typeof vi.fn<Commit>>
  readonly readCurrency: ReturnType<
    typeof vi.fn<CurrencyRebaseDialogProps['readCurrency']>
  >
  readonly onChanged: ReturnType<typeof vi.fn<(to: string) => void>>
  readonly onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>
}

function open(
  options: {
    readonly load?: Load
    readonly commit?: Commit
    readonly readCurrency?: () => Promise<string>
  } = {},
): Handles {
  const handles: Handles = {
    loadPreview: vi.fn<Load>(options.load ?? (async () => preview())),
    commit: vi.fn<Commit>(options.commit ?? (async () => undefined)),
    readCurrency: vi.fn(options.readCurrency ?? (async () => 'EUR')),
    onChanged: vi.fn<(to: string) => void>(),
    onOpenChange: vi.fn<(open: boolean) => void>(),
  }
  render(
    <I18nProvider locale="en" messages={EN}>
      <CurrencyRebaseDialog
        open
        onOpenChange={handles.onOpenChange}
        currency="EUR"
        people={PEOPLE}
        loadPreview={handles.loadPreview}
        commit={handles.commit}
        readCurrency={handles.readCurrency}
        onChanged={handles.onChanged}
      />
    </I18nProvider>,
  )
  return handles
}

function hand(
  options?: Parameters<typeof userEvent.setup>[0],
): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null, ...options })
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: /New currency/ }))
  await user.click(
    await screen.findByRole('option', { name: new RegExp(`^${code}`) }),
  )
}

function rateField(): HTMLInputElement {
  return screen.getByLabelText(/Exchange rate/) as HTMLInputElement
}

function confirm(): HTMLElement {
  return screen.getByRole('button', { name: /^Change to / })
}

function result(): HTMLElement {
  const region = document.querySelector<HTMLElement>(
    '[data-part="rebase-result"]',
  )
  if (region === null) {
    throw new Error('the result region is not rendered')
  }
  return region
}

/** Resolves once the dialog shows a settled preview for the pair it is on. */
async function settled(): Promise<void> {
  await waitFor(() => {
    expect(result().getAttribute('aria-busy')).not.toBe('true')
  })
}

/** An element is announced if it, or an ancestor, is a live region that is not switched off. */
function liveAncestors(element: HTMLElement): Array<HTMLElement> {
  const found: Array<HTMLElement> = []
  for (
    let node: HTMLElement | null = element;
    node !== null;
    node = node.parentElement
  ) {
    const live = node.getAttribute('aria-live')
    const role = node.getAttribute('role')
    const announces =
      live === null
        ? role === 'alert' || role === 'status' || role === 'log'
        : live !== 'off'
    if (announces) {
      found.push(node)
    }
  }
  return found
}

/**
 * The structural half of an accessibility scan, for what jsdom can see: every control has a name,
 * every id a `aria-describedby` or `aria-labelledby` names exists, and no id repeats. Contrast needs
 * a stylesheet, so it is read off the capture pair in both themes.
 */
function scan(): void {
  const dialog = screen.getByRole('dialog')
  const ids = [...dialog.querySelectorAll('[id]')].map((node) => node.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const node of dialog.querySelectorAll(
    '[aria-describedby],[aria-labelledby]',
  )) {
    const refs = [
      node.getAttribute('aria-describedby'),
      node.getAttribute('aria-labelledby'),
    ]
      .filter((value): value is string => value !== null)
      .flatMap((value) => value.split(/\s+/))
    for (const ref of refs) {
      expect(document.getElementById(ref), `#${ref} exists`).not.toBeNull()
    }
  }
  for (const control of dialog.querySelectorAll(
    'button,input,[role="combobox"]',
  )) {
    const name =
      control.getAttribute('aria-label') ||
      control.textContent?.trim() ||
      (control as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
      ''
    expect(name.length, `${control.outerHTML} has a name`).toBeGreaterThan(0)
  }
  expect(
    screen.getByRole('dialog').getAttribute('aria-describedby'),
  ).not.toBeNull()
}

const UNCONFIRMED =
  "We couldn't confirm whether the budget currency changed to JPY. Reload the page to check before trying again."

describe('the budget currency dialog: before a currency is chosen', () => {
  it('says what will happen and offers only the currency select', () => {
    const { loadPreview } = open()

    expect(
      screen.getByRole('heading', { name: 'Change the budget currency' }),
    ).toBeTruthy()
    expect(
      screen.getByText(/The amounts you typed stay as you typed them/),
    ).toBeTruthy()
    expect(screen.queryByLabelText(/Exchange rate/)).toBeNull()
    expect(document.querySelector('[data-part="rebase-result"]')).toBeNull()
    expect(
      (
        screen.getByRole('button', {
          name: 'Change budget currency',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(loadPreview).not.toHaveBeenCalled()
    scan()
  })

  it('does not offer the trip’s own currency', async () => {
    open()
    const user = hand()

    await user.click(screen.getByRole('combobox', { name: /New currency/ }))

    expect(screen.queryByRole('option', { name: /^EUR/ })).toBeNull()
    expect(await screen.findByRole('option', { name: /^JPY/ })).toBeTruthy()
  })
})

describe('the budget currency dialog: the preview', () => {
  it('asks for the preview as soon as a currency is chosen, and holds confirm while it works', async () => {
    let finish: (value: CurrencyChangePreview) => void = () => {}
    const { loadPreview } = open({
      load: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    const user = hand()

    await pick(user, 'JPY')

    expect(loadPreview).toHaveBeenCalledExactlyOnceWith({
      to: 'JPY',
      rate: undefined,
    })
    expect(result().getAttribute('aria-busy')).toBe('true')
    expect(
      within(result()).getByText('Working out the conversion'),
    ).toBeTruthy()
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    scan()

    await act(async () => finish(preview()))
    await settled()
    expect((confirm() as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows the arithmetic: the example, one line per non-zero count, the pinned prices, the budget and the rounding', async () => {
    open()
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    const region = within(result())
    expect(
      region.getByText(
        '€100.00 stays as you typed it and is counted as ¥1,650,000.',
      ),
    ).toBeTruthy()
    expect(region.getByText('3 expenses will be counted in JPY.')).toBeTruthy()
    expect(region.getByText('1 payment will be counted in JPY.')).toBeTruthy()
    expect(
      region.getByText('2 planned items will be counted in JPY.'),
    ).toBeTruthy()
    expect(
      region.getByText(
        'Prices on places, reservations, stays and transport stay in EUR.',
      ),
    ).toBeTruthy()
    expect(
      region.getByText('The trip budget €2,000.00 becomes ¥33,000,000.'),
    ).toBeTruthy()
    expect(
      region.getByText(
        'Each amount is rounded once, so a balance can move by up to ¥2.',
      ),
    ).toBeTruthy()
    scan()
  })

  it('leaves out a line whose count is zero', async () => {
    open({
      load: async () =>
        preview({
          counts: {
            expenses: 1,
            settlements: 0,
            budgetItems: 0,
            shareRows: 2,
            pinnedPrices: 0,
          },
          budgetTarget: null,
          balances: { maxMovementMinor: 0, leftovers: [] },
        }),
    })
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    const region = within(result())
    expect(region.getByText('1 expense will be counted in JPY.')).toBeTruthy()
    expect(region.queryByText(/payment/)).toBeNull()
    expect(region.queryByText(/planned item/)).toBeNull()
    expect(region.queryByText(/Prices on places/)).toBeNull()
    expect(region.queryByText(/The trip budget/)).toBeNull()
    expect(region.queryByText(/rounded once/)).toBeNull()
  })

  it('names who would owe whom when everybody was square and is not after', async () => {
    open({
      load: async () =>
        preview({
          balances: {
            maxMovementMinor: 1,
            leftovers: [{ userId: 'u2', otherUserId: 'u1', amountMinor: 1 }],
          },
        }),
    })
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    expect(
      within(result()).getByText('After the change, Bo would owe Ada ¥1.'),
    ).toBeTruthy()
  })

  it('says so when nothing on the trip is priced, and lets the owner confirm without a rate', async () => {
    const { commit } = open({ load: async () => NOTHING })
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    expect(
      within(result()).getByText(
        'Nothing on this trip is priced yet, so nothing needs converting.',
      ),
    ).toBeTruthy()
    expect((confirm() as HTMLButtonElement).disabled).toBe(false)

    await user.click(confirm())

    expect(commit).toHaveBeenCalledExactlyOnceWith({
      from: 'EUR',
      to: 'JPY',
      rate: undefined,
    })
  })
})

describe('the budget currency dialog: the rate', () => {
  it('is a labelled field, prefilled from where it came from, with the inverse beside it', async () => {
    open()
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    const field = rateField()
    expect(field.value).toBe('165')
    expect(field.getAttribute('inputmode')).toBe('decimal')
    expect(
      screen.getByLabelText('Exchange rate (1 EUR in JPY)', { exact: false }),
    ).toBe(field)
    const hint = field
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
    expect(hint).toContain('The last rate used in this workspace')
    expect(hint).toContain('That is 1 JPY = 0.00606061 EUR.')
    scan()
  })

  it('runs the preview on input after a pause, never before, and holds confirm meanwhile', async () => {
    const { loadPreview } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), '170')

    expect(loadPreview).not.toHaveBeenCalled()
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    expect(loadPreview).toHaveBeenCalledWith({ to: 'JPY', rate: 170 })
  })

  it('accepts the locale’s decimal comma', async () => {
    const { loadPreview } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), '165,5')

    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    expect(loadPreview).toHaveBeenCalledWith({ to: 'JPY', rate: 165.5 })
  })

  it('ties an unusable rate to its field as an error and asks nothing', async () => {
    const { loadPreview } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), 'abc')

    const field = rateField()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const describedBy = (field.getAttribute('aria-describedby') ?? '').split(
      ' ',
    )
    const messages = describedBy.map(
      (id) => document.getElementById(id)?.textContent,
    )
    expect(messages).toContain('Enter a rate greater than zero.')
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(loadPreview).not.toHaveBeenCalled()
    scan()
  })

  it('refuses a rate outside the bounds before the server has to', async () => {
    const { loadPreview } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), '99999999')

    expect(rateField().getAttribute('aria-invalid')).toBe('true')
    expect(
      screen.getByText(/That rate looks far too large or too small/),
    ).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(loadPreview).not.toHaveBeenCalled()
  })

  it('is empty and required when no rate is on record, with the reason said once, as the hint', async () => {
    open({ load: async () => NO_RATE })
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    expect(rateField().value).toBe('')
    expect(
      rateField().required || rateField().getAttribute('aria-required'),
    ).toBeTruthy()
    expect(
      screen.getAllByText(
        'There is no rate on record for EUR to JPY. Enter the rate you want to use.',
      ),
    ).toHaveLength(1)
    expect(
      within(result()).getByText(
        'The preview appears as soon as there is a rate.',
      ),
    ).toBeTruthy()
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    scan()
  })

  it('previews the rate typed after none was on record, and then confirms exactly it', async () => {
    const { loadPreview, commit } = open({
      load: async ({ rate }) =>
        rate === undefined
          ? NO_RATE
          : preview({ rate: { value: rate, source: 'manual' } }),
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.type(rateField(), '160')
    await waitFor(
      () => expect((confirm() as HTMLButtonElement).disabled).toBe(false),
      { timeout: 2_000 },
    )
    expect(loadPreview).toHaveBeenLastCalledWith({ to: 'JPY', rate: 160 })
    expect(screen.getByText(/The rate you entered/)).toBeTruthy()

    await user.click(confirm())

    expect(commit).toHaveBeenCalledExactlyOnceWith({
      from: 'EUR',
      to: 'JPY',
      rate: 160,
    })
  })

  it('previews on Enter at once and never commits on it', async () => {
    const { loadPreview, commit } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), '170{Enter}')

    await waitFor(() =>
      expect(loadPreview).toHaveBeenCalledWith({ to: 'JPY', rate: 170 }),
    )
    expect(commit).not.toHaveBeenCalled()
    await settled()
    await user.type(rateField(), '{Enter}')
    expect(commit).not.toHaveBeenCalled()
  })

  it('holds confirm on the preview of the pair it was computed for when the currency changes', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { commit, loadPreview } = open({
      load: async ({ to }) => {
        if (to === 'PLN') await gate
        return preview({
          to,
          rate: { value: to === 'JPY' ? 165 : 4, source: 'recent' },
        })
      },
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    await pick(user, 'PLN')

    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    release()
    await settled()
    await user.click(confirm())

    expect(loadPreview).toHaveBeenLastCalledWith({ to: 'PLN', rate: undefined })
    expect(commit).toHaveBeenCalledExactlyOnceWith({
      from: 'EUR',
      to: 'PLN',
      rate: 4,
    })
  })
})

describe('the budget currency dialog: refusals', () => {
  const REFUSALS: ReadonlyArray<{
    readonly name: string
    readonly refusal: NonNullable<CurrencyChangePreview['refusal']>
    readonly text: RegExp
  }> = [
    {
      name: 'entries in another currency',
      refusal: { kind: 'unconverted-rows', count: 2 },
      text: /2 entries are in a currency other than EUR and cannot be converted automatically/,
    },
    {
      name: 'one entry in another currency',
      refusal: { kind: 'unconverted-rows', count: 1 },
      text: /1 entry is in a currency other than EUR/,
    },
    {
      name: 'too large',
      refusal: { kind: 'too-large', statements: 1200, ceiling: 900 },
      text: /too many entries to change in one step: it would need 1,200 changes at once and the limit is 900/,
    },
    {
      name: 'a copy in progress',
      refusal: { kind: 'copy-pending' },
      text: /This trip is still being copied/,
    },
    {
      name: 'a split that cannot be carried over',
      refusal: { kind: 'unsplittable', count: 3 },
      text: /3 expenses have a split that cannot be carried over/,
    },
    {
      name: 'the currency the trip is already in',
      refusal: { kind: 'same-currency' },
      text: /The budget is already in JPY/,
    },
    {
      name: 'an amount out of range',
      refusal: { kind: 'amount-out-of-range' },
      text: /too large to store in JPY/,
    },
  ]

  for (const { name, refusal, text } of REFUSALS) {
    it(`shows ${name} inside the one live region and holds confirm`, async () => {
      open({ load: async () => refused(refusal) })
      const user = hand()

      await pick(user, 'JPY')
      await settled()

      const message = within(result()).getByText(text)
      expect((confirm() as HTMLButtonElement).disabled).toBe(true)
      // One announcer: the result region speaks, the warning inside it stays quiet.
      expect(liveAncestors(message)).toEqual([result()])
      scan()
    })
  }
})

describe('the budget currency dialog: a preview that fails', () => {
  it('says nothing was changed outside the live region, with a retry that asks again', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(preview())
    const { loadPreview } = open({ load })
    const user = hand()

    await pick(user, 'JPY')
    const message = await screen.findByText(
      'The conversion could not be loaded. Nothing was changed.',
    )

    expect(result().contains(message)).toBe(false)
    expect(liveAncestors(message).length).toBe(1)
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    scan()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await settled()

    expect(loadPreview).toHaveBeenCalledTimes(2)
    expect((confirm() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the budget currency dialog: committing', () => {
  it('sends exactly the previewed pair, then reports the change and closes', async () => {
    const { commit, onChanged, onOpenChange } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    expect(commit).toHaveBeenCalledExactlyOnceWith({
      from: 'EUR',
      to: 'JPY',
      rate: 165,
    })
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledExactlyOnceWith('JPY'),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('makes everything inert while it waits, and ignores Escape and an outside press', async () => {
    let finish: () => void = () => {}
    const { commit, onOpenChange, onChanged } = open({
      commit: () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined)
        }),
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    await waitFor(() => expect(commit).toHaveBeenCalled())
    expect(confirm().getAttribute('aria-busy')).toBe('true')
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(rateField().disabled).toBe(true)
    expect(
      screen
        .getByRole('combobox', { name: /New currency/ })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    await user.keyboard('{Escape}')
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('dialog')).toBeTruthy()

    await act(async () => finish())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('gives up after 30 seconds so nobody is trapped, and says nothing was changed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { commit } = open({
      commit: () => new Promise(() => {}),
      readCurrency: async () => 'EUR',
    })
    const user = hand({ advanceTimers: vi.advanceTimersByTime })
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())
    await waitFor(() => expect(commit).toHaveBeenCalled())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COMMIT_TIMEOUT_MS + 100)
    })

    expect(await screen.findByText(UNCONFIRMED)).toBeTruthy()
    expect(confirm().getAttribute('aria-busy')).not.toBe('true')
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })
})

describe('the budget currency dialog: a commit that fails', () => {
  it('says nothing was changed and puts focus on the retry, which sends the same pair again', async () => {
    const commit = vi
      .fn<Commit>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined)
    const { onChanged, readCurrency } = open({ commit })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    const message = await screen.findByText(
      "We couldn't change the budget currency. Nothing was changed.",
    )
    expect(liveAncestors(message).length).toBe(1)
    expect(result().contains(message)).toBe(false)
    const retry = screen.getByRole('button', { name: 'Try again' })
    await waitFor(() => expect(document.activeElement).toBe(retry))
    expect(readCurrency).toHaveBeenCalledTimes(1)
    expect(onChanged).not.toHaveBeenCalled()
    scan()

    await user.click(retry)

    await waitFor(() => expect(commit).toHaveBeenCalledTimes(2))
    expect(commit).toHaveBeenLastCalledWith({
      from: 'EUR',
      to: 'JPY',
      rate: 165,
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('JPY'))
  })

  it('shows success when the response was lost but the trip already changed', async () => {
    const { onChanged } = open({
      commit: async () => {
        throw new Error('network')
      },
      readCurrency: async () => 'JPY',
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledExactlyOnceWith('JPY'),
    )
    expect(screen.queryByText(/Nothing was changed/)).toBeNull()
  })

  it('reports the failure, not success, when re-reading the trip fails too', async () => {
    const { onChanged } = open({
      commit: async () => {
        throw new Error('network')
      },
      readCurrency: async () => {
        throw new Error('offline')
      },
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    expect(await screen.findByText(UNCONFIRMED)).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('re-runs the preview when the trip changed while the owner was confirming', async () => {
    const commit = vi
      .fn<Commit>()
      .mockRejectedValueOnce(new Error('costs.refusal.rebaseChanged'))
    const { loadPreview, onChanged } = open({ commit })
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    expect(loadPreview).toHaveBeenCalledTimes(1)

    await user.click(confirm())

    const message = await screen.findByText(
      'The trip changed while you were confirming, so nothing was changed. Check the new figures and confirm again.',
    )
    // Focus moves to the notice and its label is its text, so the live region stays off: once, not twice.
    expect(liveAncestors(message).length).toBe(0)
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-labelledby')).toBe(
        message.id,
      ),
    )
    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(2))
    await settled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalledTimes(1)
    // The new figures are on screen and confirm is available again for them.
    expect((confirm() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the budget currency dialog: a commit that is still in doubt', () => {
  it('does not send a second commit while the trip is being re-read', async () => {
    const { commit, readCurrency } = open({
      commit: async () => {
        throw new Error('network')
      },
      readCurrency: () => new Promise(() => {}),
    })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())
    await waitFor(() => expect(readCurrency).toHaveBeenCalled())
    await user.click(confirm())

    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('announces that it is working while the commit runs', async () => {
    const { commit } = open({ commit: () => new Promise(() => {}) })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())
    await waitFor(() => expect(commit).toHaveBeenCalled())

    expect(
      within(result()).getByText('Changing the budget currency'),
    ).toBeTruthy()
    expect(document.activeElement).toBe(result())
  })
})

describe('the budget currency dialog: when the trip moved under it', () => {
  it('holds confirm and says to reopen when the preview is for another currency than the dialog opened on', async () => {
    const { commit } = open({ load: async () => preview({ from: 'USD' }) })
    const user = hand()

    await pick(user, 'JPY')
    await settled()

    expect(
      within(result()).getByText(
        "The trip's budget currency is now USD, not EUR. Close this dialog and open it again.",
      ),
    ).toBeTruthy()
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    expect(commit).not.toHaveBeenCalled()
  })

  it('sends the currency the dialog opened on, not the one the preview happened to read', async () => {
    const { commit } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'EUR' }),
    )
  })

  it('shows success when a commit that timed out landed meanwhile and the retry is refused', async () => {
    const commit = vi
      .fn<Commit>()
      .mockRejectedValue(new Error('costs.refusal.rebaseChanged'))
    const { onChanged } = open({ commit, readCurrency: async () => 'JPY' })
    const user = hand()
    await pick(user, 'JPY')
    await settled()

    await user.click(confirm())

    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledExactlyOnceWith('JPY'),
    )
  })

  it('does not call a number that is still being typed an error', async () => {
    const { loadPreview } = open()
    const user = hand()
    await pick(user, 'JPY')
    await settled()
    loadPreview.mockClear()

    await user.clear(rateField())
    await user.type(rateField(), '0.')

    expect(rateField().getAttribute('aria-invalid')).not.toBe('true')
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)
    await user.type(rateField(), '85')
    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    expect(loadPreview).toHaveBeenCalledWith({ to: 'JPY', rate: 0.85 })
  })
})

describe('the budget currency dialog: its code', () => {
  it('imports nothing at run time from the server layer', () => {
    const source = readFileSync(
      join(import.meta.dirname, '..', 'currency-rebase-dialog.tsx'),
      'utf8',
    )

    // A type-only import is erased; any other import from `#/server` would reach the Worker.
    expect(source).not.toMatch(/^import(?!\s+type)[^']*?from\s+'#\/server/ms)
    expect(source).toMatch(/^import type [^']*?from\s+'#\/server/ms)
  })
})

describe('the currency picker in the reader’s language (#1217)', () => {
  it('names a catalogued and an uncatalogued currency in Polish, never the English literal', async () => {
    const user = hand()
    render(
      <I18nProvider locale={PL.locale} messages={PL.messages}>
        <CurrencyRebaseDialog
          open
          onOpenChange={() => {}}
          currency="EUR"
          people={PEOPLE}
          loadPreview={async () => preview()}
          commit={async () => undefined}
          readCurrency={async () => 'EUR'}
          onChanged={() => {}}
        />
      </I18nProvider>,
    )

    await user.click(
      screen.getByRole('combobox', {
        name: copyOf(PL.messages, 'costs.rebase.to'),
      }),
    )

    expect(descriptionOf('PLN')).toBe('złoty polski')
    const forint = descriptionOf('HUF')
    expect(forint).toMatch(/forint/i)
    expect(forint).not.toBe('Hungarian forint')
  })
})
