import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { Mascot } from '../mascot'
import { tripCard } from './fixtures'

afterEach(cleanup)

describe('dashboard mascot', () => {
  it('explains unavailable chat and restores focus on Escape', async () => {
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot trip={tripCard()} today="2026-03-30" />
      </I18nProvider>,
    )
    const button = screen.getByRole('button', { name: 'Open travel chat' })
    fireEvent.click(button)
    expect(
      await screen.findByRole('heading', {
        name: 'Travel chat is unavailable',
      }),
    ).not.toBeNull()
    expect(
      screen
        .getByRole('link', { name: 'Open notifications' })
        .classList.contains('min-w-11'),
    ).toBe(true)
    expect(
      screen
        .getByRole('link', { name: 'Open notifications' })
        .getAttribute('href'),
    ).toBe('/notifications')
    expect(
      screen
        .getByRole('button', { name: 'Close' })
        .classList.contains('min-w-11'),
    ).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Travel chat is unavailable')).toBeNull()
    expect(document.activeElement).toBe(button)
  })
  it('allows dismissing a confirmed reservation suggestion', async () => {
    render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot
          trip={tripCard()}
          today="2026-03-30"
          prompt={{ id: 'r', tripId: 'trip-1', startDate: '2026-04-01' }}
          onDismiss={() => {}}
        />
      </I18nProvider>,
    )
    expect(
      screen
        .getByRole('button', { name: 'Dismiss' })
        .classList.contains('min-w-11'),
    ).toBe(true)
    expect(
      screen.getByText('A confirmed reservation starts on 1 Apr 2026.'),
    ).not.toBeNull()
    expect(
      screen
        .getByRole('link', { name: 'View reservations' })
        .classList.contains('min-w-11'),
    ).toBe(true)
    expect(
      screen
        .getByRole('link', { name: 'View reservations' })
        .getAttribute('href'),
    ).toBe('/trips/trip-1/book')
  })
  it('pauses animation in a hidden tab and preserves the pause preference', () => {
    localStorage.clear()
    let visible = true
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => (visible ? 'visible' : 'hidden'))
    const page = render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot trip={tripCard()} today="2026-03-30" />
      </I18nProvider>,
    )
    const bird = page.container.querySelector('svg[data-band]')
    expect(bird?.getAttribute('data-moving')).toBe('true')
    visible = false
    fireEvent(document, new Event('visibilitychange'))
    expect(bird?.getAttribute('data-hidden')).toBe('true')
    visible = true
    fireEvent(document, new Event('visibilitychange'))
    fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }))
    expect(localStorage.getItem('planned.mascot')).toBe('paused')
    expect(bird?.getAttribute('data-paused')).toBe('true')
    visibility.mockRestore()
  })
  it('cancels opening when the chat adapter becomes unavailable', async () => {
    let signal: AbortSignal | undefined
    const adapter = {
      open: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current
        return new Promise<void>(() => {})
      },
    }
    const view = (available: boolean) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot
          trip={tripCard()}
          today="2026-03-30"
          adapter={adapter}
          available={available}
        />
      </I18nProvider>
    )
    const page = render(view(true))
    fireEvent.click(screen.getByRole('button', { name: 'Open travel chat' }))
    page.rerender(view(false))
    expect(signal?.aborted).toBe(true)
    expect(await screen.findByText('Travel chat is unavailable')).not.toBeNull()
  })
  it('cancels an opening attempt when the current trip changes', () => {
    let signal: AbortSignal | undefined
    const adapter = {
      open: ({ signal: current }: { signal: AbortSignal }) => {
        signal = current
        return new Promise<void>(() => {})
      },
    }
    const view = (id: string) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot trip={tripCard({ id })} today="2026-03-30" adapter={adapter} />
      </I18nProvider>
    )
    const page = render(view('first'))
    fireEvent.click(screen.getByRole('button', { name: 'Open travel chat' }))
    page.rerender(view('second'))
    expect(signal?.aborted).toBe(true)
  })
  it('uses a static pose when the stored animation preference is invalid', () => {
    localStorage.setItem('planned.mascot', 'corrupt')
    const page = render(
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot trip={tripCard()} today="2026-03-30" />
      </I18nProvider>,
    )
    expect(
      page.container
        .querySelector('svg[data-band]')
        ?.hasAttribute('data-moving'),
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }))
    expect(
      page.container
        .querySelector('svg[data-band]')
        ?.getAttribute('data-moving'),
    ).toBe('true')
    localStorage.clear()
  })
  it('respects live application reduced-motion preference', () => {
    localStorage.clear()
    const view = (reduceMotion: boolean) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot
          trip={tripCard()}
          today="2026-03-30"
          reduceMotion={reduceMotion}
        />
      </I18nProvider>
    )
    const page = render(view(true))
    const bird = page.container.querySelector('svg[data-band]')
    expect(bird?.getAttribute('data-reduced')).toBe('true')
    page.rerender(view(false))
    expect(bird?.hasAttribute('data-reduced')).toBe(false)
  })
  it('opens or focuses an available chat once for pointer, Enter and Space', async () => {
    const user = userEvent.setup()
    const chat = document.createElement('button')
    document.body.appendChild(chat)
    const open = vi.fn(async () => {
      chat.focus()
    })
    try {
      render(
        <I18nProvider
          locale="en"
          messages={{
            ...namespaceCatalogue('shell', Shell),
            ...namespaceCatalogue('ui', Ui),
          }}
        >
          <Mascot trip={tripCard()} today="2026-03-30" adapter={{ open }} />
        </I18nProvider>,
      )
      const trigger = screen.getByRole('button', { name: 'Open travel chat' })
      await user.click(trigger)
      expect(open).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(chat)
      trigger.focus()
      await user.keyboard('{Enter}')
      expect(open).toHaveBeenCalledTimes(2)
      expect(document.activeElement).toBe(chat)
      trigger.focus()
      await user.keyboard(' ')
      expect(open).toHaveBeenCalledTimes(3)
      expect(document.activeElement).toBe(chat)
    } finally {
      chat.remove()
    }
  })

  it('closes an unavailable explanation after a later successful open', async () => {
    const open = vi.fn().mockResolvedValue(undefined)
    const view = (available: boolean) => (
      <I18nProvider
        locale="en"
        messages={{
          ...namespaceCatalogue('shell', Shell),
          ...namespaceCatalogue('ui', Ui),
        }}
      >
        <Mascot
          trip={tripCard()}
          today="2026-03-30"
          adapter={{ open }}
          available={available}
        />
      </I18nProvider>
    )
    const page = render(view(false))
    const trigger = screen.getByRole('button', { name: 'Open travel chat' })
    fireEvent.click(trigger)
    expect(
      await screen.findByRole('heading', {
        name: 'Travel chat is unavailable',
      }),
    ).not.toBeNull()
    page.rerender(view(true))
    fireEvent.click(trigger)
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Travel chat is unavailable' }),
      ).toBeNull(),
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it.each([
    { initial: 'playing', stored: 'paused', pressed: 'true' },
    { initial: 'paused', stored: 'playing', pressed: 'false' },
  ])(
    'restores a toggled $stored preference in a new component instance',
    ({ initial, stored, pressed }) => {
      localStorage.setItem('planned.mascot', initial)
      const view = (
        <I18nProvider
          locale="en"
          messages={{
            ...namespaceCatalogue('shell', Shell),
            ...namespaceCatalogue('ui', Ui),
          }}
        >
          <Mascot trip={tripCard()} today="2026-03-30" />
        </I18nProvider>
      )
      try {
        const first = render(view)
        fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }))
        expect(localStorage.getItem('planned.mascot')).toBe(stored)
        first.unmount()
        const next = render(view)
        expect(
          screen
            .getByRole('button', { name: 'Pause animation' })
            .getAttribute('aria-pressed'),
        ).toBe(pressed)
        const bird = next.container.querySelector('svg[data-band]')
        expect(bird?.getAttribute('data-moving')).toBe('true')
        expect(bird?.hasAttribute('data-paused')).toBe(stored === 'paused')
      } finally {
        localStorage.clear()
      }
    },
  )
})
