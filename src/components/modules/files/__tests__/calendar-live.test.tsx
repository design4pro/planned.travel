import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import { CalendarLive } from '../calendar-live'
import { ConfirmDialog } from '../../shared/controls'

const stubs = vi.hoisted(() => ({
  load: vi.fn(),
  enable: vi.fn(),
  revoke: vi.fn(),
}))
vi.mock('#/server/fns/calendar', () => ({
  loadCalendarFeedsFn: stubs.load,
  enableCalendarFeedFn: stubs.enable,
  revokeCalendarFeedFn: stubs.revoke,
}))
const url = `https://app.example/api/feed/${'A'.repeat(32)}.ics`
const feed = { id: 'feed-1', tripId: 'trip-1', on: true, lastServedAt: null }
function mount() {
  return render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('modules', Modules),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <CalendarLive tripId="trip-1" />
    </I18nProvider>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  stubs.load.mockResolvedValue(null)
  stubs.enable.mockResolvedValue({
    feedId: 'feed-1',
    url,
    webcalUrl: url.replace('https:', 'webcal:'),
    tripTitle: 'Lisbon',
  })
  stubs.revoke.mockResolvedValue({ revoked: true })
})
async function reveal() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Live calendar link' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Create a link' }),
  )
  return screen.findByRole('region', { name: 'Link address' })
}
describe('live calendar link', () => {
  it('warns before enabling, reveals once without secret-bearing anchors, and guards Done until copied', async () => {
    const user = userEvent.setup()
    mount()
    const region = await reveal()
    await waitFor(() => expect(document.activeElement).toBe(region))
    expect(screen.getByText(/Anyone with this link/)).toBeTruthy()
    expect(document.querySelector('a[href*="AAAA"]')).toBeNull()
    expect(region.closest('.sentry-block')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Close without copying the link?',
      }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Keep open' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Done' }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Link copied')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    stubs.load.mockResolvedValue(feed)
    await user.click(screen.getByRole('button', { name: 'Live calendar link' }))
    expect(await screen.findByText('Calendar link is on')).toBeTruthy()
    expect(screen.queryByText(url)).toBeNull()
  })
  it('selects the address after copy failure and preserves the revealed link on window focus', async () => {
    const user = userEvent.setup()
    mount()
    const region = await reveal()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('refused'),
    )
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText(/We couldn’t copy it/)).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(region))
    expect(window.getSelection()?.toString()).toBe(url)
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(stubs.load).toHaveBeenCalledTimes(3))
    expect(screen.getByText(url)).toBeTruthy()
  })
  it('reloads the actual state after a failed enable and keeps revoke available', async () => {
    stubs.enable.mockRejectedValueOnce(new Error('lost response'))
    stubs.load.mockResolvedValueOnce(null).mockResolvedValue(feed)
    mount()
    await userEvent.click(
      screen.getByRole('button', { name: 'Live calendar link' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create a link' }),
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Turn off' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })
  it('ignores a pre-mutation background read that finishes after enabling', async () => {
    let finish: (value: typeof feed | null) => void = () => {
      throw new Error('Read was not started')
    }
    const earlier = new Promise<typeof feed | null>((resolve) => {
      finish = resolve
    })
    stubs.load
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => earlier)
      .mockResolvedValue(feed)
    mount()
    await userEvent.click(
      screen.getByRole('button', { name: 'Live calendar link' }),
    )
    await screen.findByRole('button', { name: 'Create a link' })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create a link' }))
    await screen.findByRole('region', { name: 'Link address' })
    await act(async () => {
      finish(null)
      await earlier
    })
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Turn off this calendar link?' }),
      ).getByRole('button', { name: 'Turn off' }),
    )
    await waitFor(() =>
      expect(stubs.revoke).toHaveBeenCalledWith({ data: { feedId: 'feed-1' } }),
    )
  })

  it('shows the real off state after a revoke succeeds but its response is lost', async () => {
    stubs.load
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(feed)
      .mockResolvedValue(null)
    stubs.revoke.mockRejectedValueOnce(new Error('lost response'))
    mount()
    await reveal()
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Turn off this calendar link?' }),
      ).getByRole('button', { name: 'Turn off' }),
    )
    await screen.findByRole('alert')
    expect(
      await screen.findByRole('button', { name: 'Create a link' }),
    ).toBeTruthy()
    expect(screen.queryByText(url)).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('alert')),
    )
  })

  it('restores create focus after confirmed revocation', async () => {
    stubs.load.mockResolvedValueOnce(feed).mockResolvedValue(null)
    mount()
    await userEvent.click(
      screen.getByRole('button', { name: 'Live calendar link' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Turn off' }),
    )
    const confirm = screen.getAllByRole('button', { name: 'Turn off' }).at(-1)
    if (!confirm) throw new Error('missing confirmation')
    await userEvent.click(confirm)
    await waitFor(() =>
      expect(stubs.revoke).toHaveBeenCalledWith({ data: { feedId: 'feed-1' } }),
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Create a link' }),
      ),
    )
  })
})
it('gives shared confirmations optional action-specific busy, cancel and focus props', async () => {
  const focus = vi.fn()
  render(
    <I18nProvider locale="en" messages={namespaceCatalogue('ui', Ui)}>
      <ConfirmDialog
        request={{
          title: 'Turn off?',
          description: 'Test',
          confirmLabel: 'Turn off',
          onConfirm: vi.fn(),
        }}
        onOpenChange={vi.fn()}
        pending
        busyLabel="Turning off…"
        cancelLabel="Keep open"
        onCloseAutoFocus={focus}
      />
    </I18nProvider>,
  )
  expect(screen.getByRole('button', { name: 'Keep open' })).toBeTruthy()
  expect(screen.getByText('Turning off…')).toBeTruthy()
})
