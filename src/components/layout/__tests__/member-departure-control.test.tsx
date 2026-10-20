import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import { MemberDepartureControl } from '../member-departure-control'
import type { DepartureOutcome } from '../member-departure-control'

afterEach(cleanup)
function mount(
  onConfirm = vi.fn(async (): Promise<DepartureOutcome> => ({ ok: true })),
  self = false,
  onRecover = vi.fn(async (): Promise<DepartureOutcome> => ({ ok: true })),
) {
  const user = userEvent.setup()
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('settings', Settings),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <MemberDepartureControl
        name="Kasia"
        workspace="Alpine friends"
        self={self}
        onConfirm={onConfirm}
        onRecover={onRecover}
      />
    </I18nProvider>,
  )
  return { user, onConfirm }
}
it('names the person, workspace and retained data; cancel has focus and writes nothing', async () => {
  const { user, onConfirm } = mount()
  await user.click(screen.getByRole('button', { name: 'Remove member' }))
  expect(screen.getByRole('dialog').textContent).toContain(
    'Kasia will lose access to Alpine friends',
  )
  expect(screen.getByRole('dialog').textContent).toContain(
    'account and retained trips and cost records will stay',
  )
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Cancel' }),
  )
  await user.keyboard('{Enter}')
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('requires confirmation, locks pending and calls departure exactly once', async () => {
  let finish: ((outcome: DepartureOutcome) => void) | undefined
  const confirm = vi.fn(
    () =>
      new Promise<DepartureOutcome>((resolve) => {
        finish = resolve
      }),
  )
  const { user } = mount(confirm, true)
  await user.click(screen.getByRole('button', { name: 'Leave workspace' }))
  expect(confirm).not.toHaveBeenCalled()
  await user.click(
    screen
      .getAllByRole('button', { name: 'Leave workspace' })
      .at(-1) as HTMLElement,
  )
  expect(
    screen
      .getByRole('button', { name: 'Ending membership…' })
      .hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog')).toBeTruthy()
  finish?.({ ok: true })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(confirm).toHaveBeenCalledTimes(1)
})
it.each([
  'last-owner',
  'not-permitted',
  'not-found',
  'impersonated',
  'failed',
] as const)(
  'announces %s and requires a fresh view before another intent',
  async (reason) => {
    const { user, onConfirm } = mount(
      vi.fn(async () => ({ ok: false, reason }) as const),
    )
    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    await user.click(
      screen
        .getAllByRole('button', { name: 'Remove member' })
        .at(-1) as HTMLElement,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Reload workspace' }),
    ).toBeTruthy()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  },
)

it('recovers a committed departure without retrying removal or navigating before activation', async () => {
  const onConfirm = vi.fn(async (): Promise<DepartureOutcome> => ({
    ok: false,
    reason: 'activation-failed',
  }))
  const onRecover = vi.fn(async (): Promise<DepartureOutcome> => ({
    ok: false,
    reason: 'failed',
  }))
  const { user } = mount(onConfirm, true, onRecover)
  await user.click(screen.getByRole('button', { name: 'Leave workspace' }))
  await user.click(
    screen
      .getAllByRole('button', { name: 'Leave workspace' })
      .at(-1) as HTMLElement,
  )
  expect(screen.getByRole('dialog').textContent).toContain(
    'You left this workspace',
  )
  expect(
    screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Open next workspace' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(onConfirm).toHaveBeenCalledTimes(1)
  onRecover.mockResolvedValue({ ok: true })
  await user.click(screen.getByRole('button', { name: 'Open next workspace' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onRecover).toHaveBeenCalledTimes(2)
})

it.each(['last-owner', 'not-permitted', 'not-found', 'impersonated'] as const)(
  'allows a new confirmation after closing a definite %s refusal',
  async (reason) => {
    const confirm = vi
      .fn<() => Promise<DepartureOutcome>>()
      .mockResolvedValueOnce({ ok: false, reason })
      .mockResolvedValueOnce({ ok: true })
    const { user } = mount(confirm, true)
    await user.click(screen.getByRole('button', { name: 'Leave workspace' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave workspace',
      }),
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Leave workspace' }))
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave workspace',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(confirm).toHaveBeenCalledTimes(2)
  },
)

it('keeps an uncertain result on reopen instead of allowing a second removal', async () => {
  const { user, onConfirm } = mount(
    vi.fn(async () => ({ ok: false, reason: 'failed' }) as const),
  )
  await user.click(screen.getByRole('button', { name: 'Remove member' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Remove member',
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Remove member' }))
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(
    within(screen.getByRole('dialog')).queryByRole('button', {
      name: 'Remove member',
    }),
  ).toBeNull()
  expect(onConfirm).toHaveBeenCalledOnce()
})

it('identifies the target person in the departure trigger description', () => {
  mount()
  expect(
    screen.getByRole('button', { name: 'Remove member', description: 'Kasia' }),
  ).toBeTruthy()
})

it.each(['Escape', 'Close'] as const)(
  'clears a definite refusal when dismissed through %s',
  async (dismissal) => {
    const { user } = mount(
      vi.fn(async () => ({ ok: false, reason: 'last-owner' }) as const),
    )
    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Remove member',
      }),
    )
    if (dismissal === 'Escape') await user.keyboard('{Escape}')
    else await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Remove member',
      }),
    ).toBeTruthy()
  },
)
