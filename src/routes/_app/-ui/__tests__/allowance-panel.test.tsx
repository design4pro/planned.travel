import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { encodePublicFailure } from '#/lib/errors'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import ArModules from '#/lib/i18n/messages/ar/modules'
import ArUi from '#/lib/i18n/messages/ar/ui'
import EnModules from '#/lib/i18n/messages/en/modules'
import EnUi from '#/lib/i18n/messages/en/ui'
import { AllowancePanel } from '../allowance-panel'

import type { Catalogue, Locale } from '#/lib/i18n'
import type { VacayAllowance } from '../../-server/vacay'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', EnModules),
  ...namespaceCatalogue('ui', EnUi),
}
const AR: Catalogue = {
  ...namespaceCatalogue('modules', ArModules),
  ...namespaceCatalogue('ui', ArUi),
}

/** The server function reaches `cloudflare:workers`, and `useRouter` needs a router above it. */
const setAllowance = vi.hoisted(() => vi.fn())
const loadAllowance = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/vacay', () => ({
  setAllowanceFn: setAllowance,
  loadVacayAllowance: loadAllowance,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

afterEach(() => {
  cleanup()
  setAllowance.mockReset()
  loadAllowance.mockReset()
  router.invalidate.mockReset()
})

const SAVED: VacayAllowance = {
  hasRow: true,
  entitlementDays: 25,
  carriedOverDays: 2,
  usedDays: 3,
  remainingDays: 24,
  openingBalance: true,
  previousYear: 2025,
}

const DEFAULT: VacayAllowance = {
  hasRow: false,
  entitlementDays: 25,
  carriedOverDays: 0,
  usedDays: 0,
  remainingDays: 25,
  openingBalance: true,
  previousYear: 2025,
}

function mount(
  allowance: VacayAllowance = SAVED,
  {
    locale = 'en',
    messages = EN,
    carryOverEnabled = true,
  }: {
    locale?: Locale
    messages?: Catalogue
    carryOverEnabled?: boolean
  } = {},
): void {
  render(
    <I18nProvider locale={locale} messages={messages}>
      <AllowancePanel
        planId="plan-1"
        year={2026}
        allowance={allowance}
        carryOverEnabled={carryOverEnabled}
      />
    </I18nProvider>,
  )
}

const hand = (): ReturnType<typeof userEvent.setup> =>
  userEvent.setup({ delay: null })

/** The text a control's `aria-describedby` points at, as a screen reader would join it. */
function descriptionOf(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

/** The words a screen reader says for a control's `aria-labelledby`, in order. */
function nameOf(element: HTMLElement): string {
  return (element.getAttribute('aria-labelledby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

const attr = (element: HTMLElement, name: string): string | null =>
  element.getAttribute(name)

const tile = (value = 25): HTMLElement =>
  screen.getByRole('button', { name: `Edit days, currently ${value}` })

const field = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: /^Days/ })

/** Opens the editor and replaces what the field holds. */
async function type(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
): Promise<void> {
  await user.click(tile())
  await user.clear(field())
  if (text !== '') await user.type(field(), text)
}

describe('the allowance tile', () => {
  it('names itself by the figure and says the figure is the default when no row exists', () => {
    mount(DEFAULT)

    const button = tile()
    expect(descriptionOf(button)).toBe(
      'Default allowance. Select to set your own.',
    )
  })

  it('keeps the default caption out of the narrow tile and shows it full width under the tiles', () => {
    mount(DEFAULT)

    const caption = screen.getByText(
      'Default allowance. Select to set your own.',
    )
    expect(caption.closest('dl')).toBeNull()
    expect(caption.closest('dd')).toBeNull()
  })

  it('marks the tile as the control for the Days figure, with a pencil that is hidden from the tree', () => {
    mount()

    const button = tile()
    expect(attr(button, 'data-part')).toBe('allowance-tile')
    expect(attr(button, 'data-field')).toBe('entitlement')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('has no default caption once the traveller has set their own', () => {
    mount()

    expect(screen.queryByText(/Default allowance/)).toBeNull()
  })

  it('opens a full-width editor with a labelled field and visible Save and Cancel', async () => {
    const user = hand()
    mount()

    await user.click(tile())

    expect((field() as HTMLInputElement).value).toBe('25')
    // The visible words beside the field are its name (WCAG 2.5.3), so nothing is left to describe.
    expect(nameOf(field())).toBe('Days Your allowance for 2026')
    expect(attr(field(), 'aria-describedby')).toBeNull()
    expect(attr(field(), 'aria-invalid')).not.toBe('true')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(document.activeElement).toBe(field())
  })
})

describe('committing', () => {
  it('saves on Enter, reloads the screen, announces it and returns focus to the tile', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(setAllowance).toHaveBeenCalledTimes(1)
    expect(setAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026, entitlementDays: 30 },
    })
    expect(document.activeElement).toBe(tile())
    expect(screen.getByRole('status').textContent).toBe('Allowance saved.')
  })

  it('saves from the Save button and returns focus to the tile', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount()

    await type(user, '31')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(setAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026, entitlementDays: 31 },
    })
    expect(document.activeElement).toBe(tile())
  })

  it('writes a row for the unchanged default on the first save', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount(DEFAULT)

    await user.click(tile())
    await user.keyboard('{Enter}')

    await waitFor(() => expect(setAllowance).toHaveBeenCalledTimes(1))
    expect(setAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026, entitlementDays: 25 },
    })
  })

  it('cancels on Escape without a write and returns focus to the tile', async () => {
    const user = hand()
    mount()

    await type(user, '30')
    await user.keyboard('{Escape}')

    expect(setAllowance).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(tile())
  })

  it('cancels from the Cancel button and returns focus to the tile', async () => {
    const user = hand()
    mount()

    await type(user, '30')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(setAllowance).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(tile())
  })

  it('never commits on blur', async () => {
    const user = hand()
    mount()

    await type(user, '30')
    await user.tab()
    await user.click(document.body)

    expect(setAllowance).not.toHaveBeenCalled()
    expect((field() as HTMLInputElement).value).toBe('30')
  })

  it('sends exactly one write for Enter followed by blur', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount()

    await type(user, '30')
    const input = field()
    await user.keyboard('{Enter}')
    input.blur()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
    expect(setAllowance).toHaveBeenCalledTimes(1)
  })

  it('keeps the field read-only and busy while pending, and the Save button live', async () => {
    const user = hand()
    let finish: () => void = () => {}
    setAllowance.mockReturnValue(
      new Promise<{ row: object }>((resolve) => {
        finish = () => resolve({ row: {} })
      }),
    )
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    expect(attr(field(), 'readonly')).not.toBeNull()
    expect(attr(field(), 'aria-busy')).toBe('true')
    // The live region says it, so a screen reader hears the wait; the visible copy beside the
    // buttons is hidden from the tree so it is not read twice.
    expect(screen.getByRole('status').textContent).toBe('Saving…')
    expect(
      screen
        .getAllByText('Saving…')
        .filter((node) => node.getAttribute('aria-hidden') === 'true'),
    ).toHaveLength(1)
    const save = screen.getByRole('button', { name: 'Save' })
    expect((save as HTMLButtonElement).disabled).toBe(false)
    expect(attr(save, 'aria-busy')).toBeNull()
    expect(attr(save, 'aria-disabled')).toBeNull()

    await user.click(save)
    expect(setAllowance).toHaveBeenCalledTimes(1)

    finish()
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })

  it('reads Arabic-Indic digits under ar', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount(SAVED, { locale: 'ar', messages: AR })

    await user.click(screen.getByRole('button', { name: /25$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '٣٠')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(setAllowance).toHaveBeenCalledTimes(1))
    expect(setAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026, entitlementDays: 30 },
    })
  })

  it('announces a second, identical save again', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {} })
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Allowance saved.'),
    )
    const first = screen.getByRole('status').firstElementChild

    await type(user, '30')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(setAllowance).toHaveBeenCalledTimes(2))

    await waitFor(() =>
      expect(screen.getByRole('status').firstElementChild).not.toBe(first),
    )
    expect(screen.getByRole('status').textContent).toBe('Allowance saved.')
    expect(attr(screen.getByRole('status'), 'aria-live')).toBe('polite')
  })
})

describe('an invalid value', () => {
  it.each(['', '366', '12.5', 'abc'])(
    'keeps the editor open for %j with a linked message and no write',
    async (text) => {
      const user = hand()
      mount()

      await type(user, text)
      await user.keyboard('{Enter}')

      expect(setAllowance).not.toHaveBeenCalled()
      expect(attr(field(), 'aria-invalid')).toBe('true')
      expect(descriptionOf(field())).toMatch(
        /Enter a whole number from 0 to 365\./,
      )
      expect(document.activeElement).toBe(field())
    },
  )

  it('announces the message again when the same invalid value is submitted twice', async () => {
    const user = hand()
    mount()

    await type(user, '999')
    await user.keyboard('{Enter}')
    const first = screen.getByRole('alert')
    await user.keyboard('{Enter}')

    expect(screen.getByRole('alert')).not.toBe(first)
  })

  it('announces the message when Enter keeps focus in the field', async () => {
    const user = hand()
    mount()

    await type(user, '999')
    await user.keyboard('{Enter}')

    // Focus never moves, so only an alert makes a screen reader say it.
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number from 0 to 365.',
    )
  })

  it('clears the message once the value is edited again', async () => {
    const user = hand()
    mount()

    await type(user, '999')
    await user.keyboard('{Enter}')
    await user.type(field(), '{Backspace}')

    expect(attr(field(), 'aria-invalid')).not.toBe('true')
  })
})

describe('a failed write', () => {
  const FAILURES = {
    'a transport failure': new TypeError('Failed to fetch'),
    'a server failure': new Error(
      encodePublicFailure({ kind: 'unexpected', reference: 'ref-1' }),
    ),
  }

  it.each(Object.entries(FAILURES))(
    'keeps the typed value, alerts, and offers a retry after %s',
    async (_label, failure) => {
      const user = hand()
      setAllowance.mockRejectedValueOnce(failure)
      setAllowance.mockResolvedValueOnce({ row: {} })
      loadAllowance.mockResolvedValue(SAVED)
      mount()

      await type(user, '30')
      await user.keyboard('{Enter}')

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(
        'Your allowance could not be saved. 2026 still shows 25 days.',
      )
      expect((field() as HTMLInputElement).value).toBe('30')
      expect(attr(field(), 'readonly')).toBeNull()
      expect(router.invalidate).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(1))
      expect(setAllowance).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).toBeNull()
    },
  )

  it('offers no retry when the re-read fails too, as after a refusal that arrives as unexpected', async () => {
    const user = hand()
    // `NotFoundError` and `PlanOwnerOnlyError` are not public failures, so they reach the client as
    // `unexpected`, exactly like a server error; only the re-read tells them apart.
    setAllowance.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-2' }),
      ),
    )
    loadAllowance.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-3' }),
      ),
    )
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be saved')
    expect(loadAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026 },
    })
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect((field() as HTMLInputElement).value).toBe('30')
  })

  it('does not re-read after a validation failure', async () => {
    const user = hand()
    setAllowance.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'validation', message: 'Too many days.' }),
      ),
    )
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    await screen.findByRole('alert')
    expect(loadAllowance).not.toHaveBeenCalled()
    expect(attr(field(), 'aria-invalid')).toBe('true')
    await user.type(field(), '{Backspace}')
    expect(attr(field(), 'aria-invalid')).not.toBe('true')
  })

  it('never says "Allowance saved." after a save that failed', async () => {
    const user = hand()
    setAllowance.mockResolvedValueOnce({ row: {} })
    setAllowance.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    loadAllowance.mockResolvedValue(SAVED)
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Allowance saved.'),
    )

    await type(user, '31')
    await user.keyboard('{Enter}')
    await screen.findByRole('alert')

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('shows Cancel as unavailable while a save is pending', async () => {
    const user = hand()
    let finish: () => void = () => {}
    setAllowance.mockReturnValue(
      new Promise<{ row: object }>((resolve) => {
        finish = () => resolve({ row: {} })
      }),
    )
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(attr(cancel, 'aria-disabled')).toBe('true')
    await user.click(cancel)
    expect(screen.queryByRole('textbox')).not.toBeNull()

    finish()
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
  })

  it('puts focus back in the field after a failed Save click', async () => {
    const user = hand()
    setAllowance.mockRejectedValue(new TypeError('Failed to fetch'))
    mount()

    await type(user, '30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('alert')
    expect(document.activeElement).toBe(field())
  })

  it('ignores the tile while the editor is open, so a pending draft is not reset', async () => {
    const user = hand()
    let fail: (cause: unknown) => void = () => {}
    setAllowance.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject
      }),
    )
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')
    await user.click(tile())

    fail(new TypeError('Failed to fetch'))
    await screen.findByRole('alert')
    expect((field() as HTMLInputElement).value).toBe('30')
  })

  it.each([
    [
      'a refusal',
      { kind: 'refusal', message: 'You may not change this plan.' },
    ],
    ['a validation failure', { kind: 'validation', message: 'Too many days.' }],
  ] as const)(
    'offers no retry after %s and shows its sentence',
    async (_l, failure) => {
      const user = hand()
      setAllowance.mockRejectedValue(new Error(encodePublicFailure(failure)))
      mount()

      await type(user, '30')
      await user.keyboard('{Enter}')

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(failure.message)
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      expect((field() as HTMLInputElement).value).toBe('30')
    },
  )
})

describe('the carried tile', () => {
  /** A year calculated from the one before, with a half day left over. */
  const DERIVED: VacayAllowance = {
    ...SAVED,
    carriedOverDays: 8,
    remainingDays: 30,
    openingBalance: false,
  }

  const carriedTile = (value = 2): HTMLElement =>
    screen.getByRole('button', {
      name: `Edit carried days, currently ${value}`,
    })

  const carriedField = (): HTMLInputElement =>
    screen.getByRole('textbox', { name: /^Carried/ })

  it('is a second editable tile for an opening balance, with its hint linked to it', () => {
    mount()

    const button = carriedTile()
    expect(attr(button, 'data-part')).toBe('allowance-tile')
    expect(attr(button, 'data-field')).toBe('carried')
    expect(descriptionOf(button)).toBe(
      'Brought in from before 2026. Select to edit.',
    )
  })

  it('is plain text captioned with the year it comes from when it is calculated', () => {
    mount(DERIVED)

    expect(
      screen.queryByRole('button', { name: /Edit carried days/ }),
    ).toBeNull()
    expect(screen.getByText('Carried from 2025')).toBeTruthy()
    expect(
      screen.getByText('8').closest('dd')?.querySelector('button'),
    ).toBeNull()
  })

  it('is plain text that says carry-over is off, whatever kind of year it is', () => {
    mount(SAVED, { carryOverEnabled: false })

    expect(
      screen.queryByRole('button', { name: /Edit carried days/ }),
    ).toBeNull()
    expect(screen.getByText('Carry-over is off')).toBeTruthy()
    expect(screen.queryByText(/Brought in from before/)).toBeNull()
  })

  it('names its field by the visible words and sends only the carried figure', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {}, superseded: null })
    mount()

    await user.click(carriedTile())

    expect(document.activeElement).toBe(carriedField())
    expect(nameOf(carriedField())).toBe(
      'Carried Carried days brought into 2026',
    )
    await user.clear(carriedField())
    await user.type(carriedField(), '5{Enter}')

    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(setAllowance).toHaveBeenCalledWith({
      data: { planId: 'plan-1', year: 2026, carriedOverDays: 5 },
    })
    expect(document.activeElement).toBe(carriedTile())
  })

  it('opens the other editor in place of the first when its tile is pressed, discarding the draft', async () => {
    const user = hand()
    mount()

    await type(user, '30')
    await user.click(carriedTile())

    expect(carriedField().value).toBe('2')
    expect(screen.queryByRole('textbox', { name: /^Days/ })).toBeNull()
  })

  it('says the carried figure could not be saved, with the carried figure it still shows', async () => {
    const user = hand()
    setAllowance.mockRejectedValue(new TypeError('Failed to fetch'))
    loadAllowance.mockResolvedValue(SAVED)
    mount()

    await user.click(carriedTile())
    await user.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'Your carried days could not be saved. 2026 still shows 2 days.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('explains that the year is now calculated, moves focus to the message and offers no retry', async () => {
    const user = hand()
    setAllowance.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-9' }),
      ),
    )
    loadAllowance.mockResolvedValue(DERIVED)
    mount()

    await user.click(carriedTile())
    await user.clear(carriedField())
    await user.type(carriedField(), '9{Enter}')

    const message = await screen.findByText(
      'Carried days for 2026 are now calculated from 2025, so they cannot be edited.',
    )
    const alert = message.closest('[tabindex="-1"]')
    await waitFor(() => expect(document.activeElement).toBe(alert))
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('does not call a failure derived when the re-read still shows an opening balance', async () => {
    const user = hand()
    setAllowance.mockRejectedValue(
      new Error(
        encodePublicFailure({ kind: 'unexpected', reference: 'ref-9' }),
      ),
    )
    loadAllowance.mockResolvedValue(SAVED)
    mount()

    await user.click(carriedTile())
    await user.keyboard('{Enter}')

    await screen.findByRole('alert')
    expect(screen.queryByText(/now calculated from/)).toBeNull()
    expect(carriedField()).toBeTruthy()
  })
})

describe('the whole-days line', () => {
  const HALF: VacayAllowance = {
    ...SAVED,
    usedDays: 2.5,
    remainingDays: 24.5,
  }
  const LINE =
    'Only whole days carry into the next year; the leftover half day does not.'

  it('shows when carry-over is on and the leftover is positive with a fractional part', () => {
    mount(HALF)

    expect(screen.getByText(LINE)).toBeTruthy()
  })

  it.each([
    ['a whole-number leftover', SAVED, true],
    ['a debt with a fraction', { ...HALF, remainingDays: -0.5 }, true],
    ['a fractional leftover while carry-over is off', HALF, false],
  ] as const)('is absent for %s', (_label, allowance, carryOverEnabled) => {
    mount(allowance, { carryOverEnabled })

    expect(screen.queryByText(LINE)).toBeNull()
  })
})

describe('a replaced opening balance', () => {
  const REPLACED = { row: {}, superseded: { year: 2027, was: 6 } }
  const NOTICE =
    'Carried days for 2027 are now calculated from 2026. You had entered 6 days.'

  it('is shown as visible text in an info alert, once, and the live region does not repeat it', async () => {
    const user = hand()
    setAllowance.mockResolvedValue(REPLACED)
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    const notice = await screen.findByText(NOTICE)
    expect(notice.closest('[role="status"]')).not.toBeNull()
    expect(screen.getAllByText(NOTICE)).toHaveLength(1)
    expect(
      screen
        .getAllByRole('status')
        .filter((node) => node.textContent?.includes('2027')),
    ).toHaveLength(1)
  })

  it('stays until it is dismissed', async () => {
    const user = hand()
    setAllowance.mockResolvedValue(REPLACED)
    mount()
    await type(user, '30')
    await user.keyboard('{Enter}')
    await screen.findByText(NOTICE)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it('goes away with the next save', async () => {
    const user = hand()
    setAllowance.mockResolvedValueOnce(REPLACED)
    setAllowance.mockResolvedValueOnce({ row: {}, superseded: null })
    mount()
    await type(user, '30')
    await user.keyboard('{Enter}')
    await screen.findByText(NOTICE)

    await type(user, '31')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(setAllowance).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(NOTICE)).toBeNull())
  })

  it('is not made up when a save replaced nothing', async () => {
    const user = hand()
    setAllowance.mockResolvedValue({ row: {}, superseded: null })
    mount()

    await type(user, '30')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(router.invalidate).toHaveBeenCalled())
    expect(screen.queryByText(/You had entered/)).toBeNull()
  })
})
