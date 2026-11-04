import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { DashboardMascot } from '../dashboard-mascot'
import { tripCard } from './fixtures'

const refresh = async () => true

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  sessionStorage.clear()
})

describe('dashboard mascot', () => {
  it('dismisses a readable reservation for this dashboard entry', async () => {
    const trip = tripCard({ startDate: '2099-01-01', endDate: '2099-01-08' })
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={trip}
          trips={[trip]}
          reservations={[
            {
              id: 'r',
              tripId: trip.id,
              status: 'confirmed',
              startDate: '2099-01-02',
            },
          ]}
          today="2099-01-01"
          userId="user"
          workspaceId="workspace"
          onRefresh={refresh}
        />
      </I18nProvider>,
    )
    expect(
      await screen.findByText('A confirmed reservation starts on 2 Jan 2099.'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByText('A confirmed reservation starts on 2 Jan 2099.'),
    ).toBeNull()
  })
  it('refreshes the eligibility window at UTC midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'))
    const trip = tripCard({ startDate: '2026-11-04', endDate: '2026-11-20' })
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={trip}
          trips={[trip]}
          reservations={[
            {
              id: 'r',
              tripId: trip.id,
              status: 'confirmed',
              startDate: '2026-11-12',
            },
          ]}
          today="2026-11-04"
          userId="user"
          workspaceId="workspace"
          onRefresh={refresh}
        />
      </I18nProvider>,
    )
    expect(
      screen.queryByText('A confirmed reservation starts on 12 Nov 2026.'),
    ).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(
      screen.queryByText('A confirmed reservation starts on 12 Nov 2026.'),
    ).not.toBeNull()
  })
  it('retains a focused suggestion on refresh but removes it when access is lost', () => {
    const trip = tripCard()
    const first = {
      id: 'r',
      tripId: trip.id,
      status: 'confirmed',
      startDate: '2026-04-02',
    }
    const second = {
      id: 's',
      tripId: trip.id,
      status: 'confirmed',
      startDate: '2026-04-01',
    }
    const view = (
      trips: (typeof trip)[],
      reservations: (typeof first)[],
      today = '2026-04-01',
    ) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={trip}
          trips={trips}
          reservations={reservations}
          today={today}
          userId="user"
          workspaceId="workspace"
          onRefresh={refresh}
        />
      </I18nProvider>
    )
    const page = render(view([trip], [first]))
    const link = screen.getByRole('link', { name: 'View reservations' })
    link.focus()
    expect(document.activeElement).toBe(link)
    page.rerender(view([trip], [first, second]))
    expect(
      screen.queryByText('A confirmed reservation starts on 2 Apr 2026.'),
    ).not.toBeNull()
    page.rerender(view([trip], [{ ...first, status: 'cancelled' }, second]))
    expect(
      screen.queryByText('A confirmed reservation starts on 2 Apr 2026.'),
    ).toBeNull()
    expect(document.activeElement).toBe(link)
    page.rerender(
      view(
        [trip],
        [{ ...first, startDate: '2026-05-01' }, second],
        '2026-04-03',
      ),
    )
    expect(
      screen.queryByText('A confirmed reservation starts on 2 Apr 2026.'),
    ).toBeNull()
    expect(document.activeElement).toBe(link)
    page.rerender(view([], [first, second]))
    expect(screen.queryByRole('link', { name: 'View reservations' })).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Open travel chat' }),
    )
  })
  it('clears entry state when the workspace changes', () => {
    const trip = tripCard()
    const reservation = {
      id: 'r',
      tripId: trip.id,
      status: 'confirmed',
      startDate: '2026-04-02',
    }
    const view = (workspaceId: string) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          key={workspaceId}
          trip={trip}
          trips={[trip]}
          reservations={[reservation]}
          today="2026-04-01"
          userId="user"
          workspaceId={workspaceId}
          onRefresh={refresh}
        />
      </I18nProvider>
    )
    const page = render(view('first'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('link', { name: 'View reservations' })).toBeNull()
    page.rerender(view('second'))
    expect(
      screen.queryByRole('link', { name: 'View reservations' }),
    ).not.toBeNull()
  })
  it('revalidates dashboard access when returning to a visible tab', async () => {
    let visible = false
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => (visible ? 'visible' : 'hidden'))
    const onRefresh = vi.fn().mockResolvedValue(true)
    const trip = tripCard()
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={trip}
          trips={[trip]}
          reservations={[]}
          today="2026-04-01"
          userId="user"
          workspaceId="workspace"
          onRefresh={onRefresh}
        />
      </I18nProvider>,
    )
    visible = true
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    expect(onRefresh).toHaveBeenCalledOnce()
    visibility.mockRestore()
  })

  it('removes stale context and cancels chat when revalidation fails', async () => {
    let signal: AbortSignal | undefined
    const adapter = {
      open: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current
        return new Promise<void>(() => {})
      },
    }
    const trip = tripCard()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    const onRefresh = vi.fn().mockResolvedValue(false)
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={trip}
          trips={[trip]}
          reservations={[
            {
              id: 'r',
              tripId: trip.id,
              status: 'confirmed',
              startDate: '2026-04-02',
            },
          ]}
          today="2026-04-01"
          userId="user"
          workspaceId="workspace"
          onRefresh={onRefresh}
          adapter={adapter}
        />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open travel chat' }))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('link', { name: 'View reservations' })).toBeNull()
    expect(signal?.aborted).toBe(true)
    visibility.mockRestore()
  })
  it('ignores a late refresh from a previous workspace and does not refresh while hidden', async () => {
    let finish: (value: boolean) => void = () => {}
    const onRefresh = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    let visible = false
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => (visible ? 'visible' : 'hidden'))
    const trip = tripCard()
    const view = (workspaceId: string) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          key={workspaceId}
          trip={trip}
          trips={workspaceId === 'first' ? [trip] : []}
          reservations={[
            {
              id: 'r',
              tripId: trip.id,
              status: 'confirmed',
              startDate: '2026-04-02',
            },
          ]}
          today="2026-04-01"
          userId="user"
          workspaceId={workspaceId}
          onRefresh={onRefresh}
        />
      </I18nProvider>
    )
    const page = render(view('first'))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(onRefresh).not.toHaveBeenCalled()
    visible = true
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(onRefresh).toHaveBeenCalledOnce()
    page.rerender(view('second'))
    await act(async () => {
      finish(true)
      await Promise.resolve()
    })
    expect(screen.queryByRole('link', { name: 'View reservations' })).toBeNull()
    visibility.mockRestore()
  })
  it('cancels chat on refresh failure even when there is no current trip', async () => {
    let signal: AbortSignal | undefined
    const adapter = {
      open: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current
        return new Promise<void>(() => {})
      },
    }
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <DashboardMascot
          trip={null}
          trips={[]}
          reservations={[]}
          today="2026-04-01"
          userId="user"
          workspaceId="workspace"
          onRefresh={async () => false}
          adapter={adapter}
        />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open travel chat' }))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(signal?.aborted).toBe(true)
    visibility.mockRestore()
  })
})

it('opens the inbox for an action notification ahead of a later reservation', async () => {
  vi.setSystemTime(new Date('2026-01-08T12:00:00Z'))
  const trip = tripCard()
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('ui', Ui),
        'shell.dashboard.mascot.actionNotification':
          'A notification is waiting for your response.',
      }}
    >
      <DashboardMascot
        trip={trip}
        trips={[trip]}
        reservations={[]}
        today="2026-01-08"
        userId="user"
        workspaceId="workspace"
        onRefresh={refresh}
        candidates={[
          {
            source: 'reservation',
            id: 'r',
            tripId: trip.id,
            occurrence: '2026-01-09',
          },
          {
            source: 'notification',
            id: 'n',
            occurrence: '2026-01-08T11:00:00Z',
            action: true,
          },
        ]}
      />
    </I18nProvider>,
  )
  expect(
    (
      await screen.findByRole('link', { name: 'Open notifications' })
    ).getAttribute('href'),
  ).toBe('/notifications')
})

it('keeps a working notification visible and retries a failed source', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-08T12:00:00Z'))
  const retry = vi.fn(async () => true)
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <DashboardMascot
        trip={null}
        trips={[]}
        reservations={[]}
        today="2026-01-08"
        userId="user"
        workspaceId="workspace"
        onRefresh={retry}
        partial
        candidates={[
          {
            source: 'notification',
            id: 'n',
            occurrence: '2026-01-08T11:00:00Z',
            action: false,
          },
        ]}
      />
    </I18nProvider>,
  )
  expect(screen.getByText('A notification is waiting.')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(retry).toHaveBeenCalledOnce()
})
