import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
