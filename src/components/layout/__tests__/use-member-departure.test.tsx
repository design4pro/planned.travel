import '#/components/ui/__tests__/test-env'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  renderHook,
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
import { useMemberDeparture } from '../use-member-departure'

const ports = vi.hoisted(() => ({
  depart: vi.fn(),
  recover: vi.fn(),
  announce: vi.fn(),
  refuse: vi.fn(),
  router: {
    clearCache: vi.fn(),
    invalidate: vi.fn(async () => {}),
    state: { matches: [] },
  },
}))
vi.mock('sonner', () => ({
  toast: { success: ports.announce, error: ports.refuse },
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ports.router }))
vi.mock('#/server/fns/members', () => ({
  departMemberFn: ports.depart,
  recoverDepartureWorkspaceFn: ports.recover,
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('settings', Settings),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      {children}
    </I18nProvider>
  )
}

it('reports an uncertain self-departure without activating or navigating as a success', async () => {
  ports.depart.mockRejectedValue(new Error('network response unavailable'))
  ports.recover.mockResolvedValue({ ok: true })
  const { result } = renderHook(() => useMemberDeparture(), {
    wrapper: Wrapper,
  })
  await expect(result.current.depart('self-member')).resolves.toEqual({
    ok: false,
    reason: 'failed',
  })
  expect(ports.recover).not.toHaveBeenCalled()
  expect(ports.router.clearCache).not.toHaveBeenCalled()
  expect(ports.router.invalidate).toHaveBeenCalledOnce()
})

it('announces removal and focuses the stable members table after its dialog and row unmount', async () => {
  ports.depart.mockResolvedValue({
    ok: true,
    left: false,
    activationFailed: false,
  })
  function Harness() {
    const [present, setPresent] = useState(true)
    const { depart, recover, membersRef } = useMemberDeparture()
    ports.router.invalidate.mockImplementation(async () => {
      setPresent(false)
    })
    return (
      <table aria-label="Members" tabIndex={-1} ref={membersRef}>
        <tbody>
          {present ? (
            <tr>
              <td>
                <MemberDepartureControl
                  name="Kasia"
                  workspace="Alpine friends"
                  self={false}
                  onConfirm={() => depart('target-member')}
                  onRecover={recover}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    )
  }
  const user = userEvent.setup()
  render(
    <Wrapper>
      <Harness />
    </Wrapper>,
  )
  await user.click(screen.getByRole('button', { name: 'Remove member' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Remove member',
    }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('button', { name: 'Remove member' })).toBeNull()
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('table', { name: 'Members' }),
    ),
  )
  expect(ports.announce).toHaveBeenCalledExactlyOnceWith('Member removed')
})

it.each([
  ['not-found', 'row'],
  ['not-permitted', 'control'],
  ['not-permitted', 'retained'],
] as const)(
  'preserves %s feedback when refresh leaves the %s',
  async (reason, mode) => {
    ports.depart.mockResolvedValue({ ok: false, reason })
    function Harness() {
      const [refreshed, setRefreshed] = useState(false)
      const { depart, recover, membersRef } = useMemberDeparture()
      ports.router.invalidate.mockImplementation(async () => {
        setRefreshed(true)
      })
      const control = (
        <MemberDepartureControl
          name="Kasia"
          workspace="Alpine friends"
          self={false}
          onConfirm={() => depart('target-member')}
          onRecover={recover}
        />
      )
      return (
        <table aria-label="Members" tabIndex={-1} ref={membersRef}>
          <tbody>
            {refreshed && mode === 'row' ? null : (
              <tr>
                <td>{refreshed && mode === 'control' ? 'Kasia' : control}</td>
              </tr>
            )}
          </tbody>
        </table>
      )
    }
    const user = userEvent.setup()
    render(
      <Wrapper>
        <Harness />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: 'Remove member' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Remove member',
      }),
    )
    if (mode === 'retained') {
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      await new Promise((resolve) => requestAnimationFrame(resolve))
      expect(ports.refuse).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(
        true,
      )
    } else {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(ports.refuse).toHaveBeenCalledOnce())
      expect(ports.refuse.mock.calls[0][0]).toBe(
        Settings[
          reason === 'not-found'
            ? 'workspace.departure.notFound'
            : 'workspace.departure.notPermitted'
        ],
      )
      expect(document.activeElement).toBe(
        screen.getByRole('table', { name: 'Members' }),
      )
    }
    expect(ports.depart).toHaveBeenCalledOnce()
  },
)
