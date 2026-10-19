import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import EnModules from '#/lib/i18n/messages/en/modules'
import EnUi from '#/lib/i18n/messages/en/ui'
import { PlanSettingsDialog } from '../plan-settings-dialog'

import type { Catalogue } from '#/lib/i18n'

const EN: Catalogue = {
  ...namespaceCatalogue('modules', EnModules),
  ...namespaceCatalogue('ui', EnUi),
}

/** The server function reaches `cloudflare:workers`, and `useRouter` needs a router above it. */
const updatePlan = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('../../-server/vacay', () => ({ updateVacayPlanFn: updatePlan }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

afterEach(() => {
  cleanup()
  updatePlan.mockReset()
  router.invalidate.mockReset()
})

function mount(
  props: { carryOverEnabled?: boolean; defaultEntitlementDays?: number } = {},
): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <PlanSettingsDialog
        planId="plan-1"
        carryOverEnabled={props.carryOverEnabled ?? true}
        defaultEntitlementDays={props.defaultEntitlementDays ?? 25}
      />
    </I18nProvider>,
  )
}

const hand = (): ReturnType<typeof userEvent.setup> =>
  userEvent.setup({ delay: null })

const opener = (): HTMLElement =>
  screen.getByRole('button', { name: 'Leave plan settings' })
const dialog = (): HTMLElement => screen.getByRole('dialog')
const queryDialog = (): HTMLElement | null => screen.queryByRole('dialog')
const field = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'Default allowance (days per year)' })
const carryOver = (): HTMLElement =>
  screen.getByRole('checkbox', { name: 'Carry unused days into the next year' })
const save = (): HTMLElement =>
  screen.getByRole('button', { name: 'Save settings' })

async function replace(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
): Promise<void> {
  await user.clear(field())
  await user.type(field(), text)
}

describe('the plan settings button', () => {
  it('is a labelled button that opens a dialog, and is marked for the browser journey', () => {
    mount()

    expect(opener().getAttribute('data-part')).toBe('vacay-settings')
    expect(opener().getAttribute('aria-haspopup')).toBe('dialog')
    expect(queryDialog()).toBeNull()
  })

  it('is at least 44px tall below the sm breakpoint', () => {
    mount()

    // jsdom has no layout, so the class that sets the height is what is asserted.
    expect(opener().className).toContain('h-11')
    expect(opener().className).toContain('sm:h-8')
  })
})

describe('the dialog', () => {
  it('opens with the plan’s values, a titled and described dialog, and Save and Cancel', async () => {
    const user = hand()
    mount({ carryOverEnabled: false, defaultEntitlementDays: 30 })

    await user.click(opener())

    expect(dialog().getAttribute('aria-labelledby')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Leave plan settings' }),
    ).toBeTruthy()
    expect(carryOver().getAttribute('aria-checked')).toBe('false')
    expect(field().value).toBe('30')
    expect(field().getAttribute('aria-describedby')).toBeTruthy()
    expect(save()).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('closes without a request when nothing changed and returns focus to the button', async () => {
    const user = hand()
    mount()

    await user.click(opener())
    await user.click(save())

    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(updatePlan).not.toHaveBeenCalled()
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener())
  })

  it('discards edits on Cancel and shows the plan’s values again next time', async () => {
    const user = hand()
    mount()

    await user.click(opener())
    await replace(user, '40')
    await user.click(carryOver())
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(updatePlan).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener())
    await user.click(opener())
    expect(field().value).toBe('25')
    expect(carryOver().getAttribute('aria-checked')).toBe('true')
  })
})

describe('saving', () => {
  it('sends only what changed, reloads the screen, closes onto the button and announces it', async () => {
    const user = hand()
    updatePlan.mockResolvedValue({})
    mount()

    await user.click(opener())
    await user.click(carryOver())
    await user.click(save())

    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(updatePlan).toHaveBeenCalledTimes(1)
    expect(updatePlan).toHaveBeenCalledWith({
      data: { planId: 'plan-1', carryOverEnabled: false },
    })
    expect(router.invalidate).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(opener())
    expect(screen.getByRole('status').textContent).toBe(
      'Leave plan settings saved.',
    )
  })

  it('sends both values when both changed', async () => {
    const user = hand()
    updatePlan.mockResolvedValue({})
    mount()

    await user.click(opener())
    await user.click(carryOver())
    await replace(user, '28')
    await user.click(save())

    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(updatePlan).toHaveBeenCalledWith({
      data: {
        planId: 'plan-1',
        carryOverEnabled: false,
        defaultEntitlementDays: 28,
      },
    })
  })

  it('submits on Enter in the default-allowance field', async () => {
    const user = hand()
    updatePlan.mockResolvedValue({})
    mount()

    await user.click(opener())
    await replace(user, '31')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(updatePlan).toHaveBeenCalledTimes(1))
    expect(updatePlan).toHaveBeenCalledWith({
      data: { planId: 'plan-1', defaultEntitlementDays: 31 },
    })
    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(document.activeElement).toBe(opener())
  })

  it('reads digits typed in another script as the number they are', async () => {
    const user = hand()
    updatePlan.mockResolvedValue({})
    mount()

    await user.click(opener())
    await replace(user, '٣٠')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(updatePlan).toHaveBeenCalledTimes(1))
    expect(updatePlan).toHaveBeenCalledWith({
      data: { planId: 'plan-1', defaultEntitlementDays: 30 },
    })
  })

  it('announces a second save again after the dialog is opened and saved a second time', async () => {
    const user = hand()
    updatePlan.mockResolvedValue({})
    mount()

    await user.click(opener())
    await user.click(carryOver())
    await user.click(save())
    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(screen.getByRole('status').textContent).toBe(
      'Leave plan settings saved.',
    )

    await user.click(opener())
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('ignores Escape and the Cancel button while a save is in flight', async () => {
    const user = hand()
    let finish: (value: unknown) => void = () => undefined
    updatePlan.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    mount()

    await user.click(opener())
    await user.click(carryOver())
    await user.click(save())
    await user.keyboard('{Escape}')

    expect(queryDialog()).not.toBeNull()
    expect(updatePlan).toHaveBeenCalledTimes(1)

    finish({})
    await waitFor(() => expect(queryDialog()).toBeNull())
  })
})

describe('an invalid default allowance', () => {
  it.each(['', '-1', '366', '2.5', 'abc'])(
    'refuses %j, moves focus to the field and links the message to it',
    async (text) => {
      const user = hand()
      mount()

      await user.click(opener())
      await user.clear(field())
      if (text !== '') await user.type(field(), text)
      await user.click(save())

      expect(updatePlan).not.toHaveBeenCalled()
      expect(queryDialog()).not.toBeNull()
      expect(document.activeElement).toBe(field())
      expect(field().getAttribute('aria-invalid')).toBe('true')
      const described = (field().getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
      expect(described).toContain('Enter a whole number from 0 to 365.')
    },
  )

  it('is cleared as soon as the value is edited', async () => {
    const user = hand()
    mount()

    await user.click(opener())
    await replace(user, '999')
    await user.keyboard('{Enter}')
    expect(field().getAttribute('aria-invalid')).toBe('true')

    await replace(user, '20')

    expect(field().getAttribute('aria-invalid')).not.toBe('true')
  })
})

describe('a failed save', () => {
  it('keeps the dialog open with the values as typed and moves focus to the alert', async () => {
    const user = hand()
    updatePlan.mockRejectedValue(new Error('unexpected'))
    mount()

    await user.click(opener())
    await user.click(carryOver())
    await replace(user, '33')
    await user.click(save())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'The leave plan settings could not be saved. Nothing was changed.',
    )
    await waitFor(() => expect(document.activeElement).toBe(alert))
    expect(queryDialog()).not.toBeNull()
    expect(field().value).toBe('33')
    expect(carryOver().getAttribute('aria-checked')).toBe('false')
    expect(router.invalidate).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('moves focus to the alert again when the retry fails too, and saves when the retry succeeds', async () => {
    const user = hand()
    updatePlan.mockRejectedValueOnce(new Error('unexpected'))
    updatePlan.mockRejectedValueOnce(new Error('unexpected'))
    updatePlan.mockResolvedValueOnce({})
    mount()

    await user.click(opener())
    await replace(user, '33')
    await user.click(save())
    const first = await screen.findByRole('alert')
    await waitFor(() => expect(document.activeElement).toBe(first))

    await user.click(save())
    await waitFor(() => expect(updatePlan).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('alert')),
    )

    await user.click(save())
    await waitFor(() => expect(queryDialog()).toBeNull())
    expect(updatePlan).toHaveBeenCalledTimes(3)
    expect(document.activeElement).toBe(opener())
  })
})
