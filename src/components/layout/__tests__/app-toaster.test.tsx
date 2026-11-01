import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n/provider'
import { AppToaster } from '../app-toaster'

function mount() {
  return render(
    <I18nProvider
      locale="pl"
      messages={{ 'shell.toaster.label': 'Powiadomienia' }}
    >
      <button>Outside</button>
      <AppToaster />
    </I18nProvider>,
  )
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function notify(duration = 4000) {
  act(() => {
    toast('Saved booking has no cost line', {
      duration,
      action: { label: 'See plans', onClick: vi.fn() },
      cancel: { label: 'Close', onClick: vi.fn() },
    })
  })
  await advance(1)
}

beforeEach(() => {
  vi.useFakeTimers({ now: 10000, shouldAdvanceTime: true })
})
afterEach(() => {
  toast.dismiss()
  vi.useRealTimers()
})

describe('shared action toasts', () => {
  it('localizes the region and retains the shortcut hint', async () => {
    mount()
    await notify()
    expect(
      screen.getByRole('region', { name: 'Powiadomienia alt+T' }),
    ).toBeTruthy()
  })

  it('reserves bottom clearance without narrowing the horizontal mobile gutters', async () => {
    const { container } = mount()
    await notify()
    const list = container.querySelector<HTMLElement>('[data-sonner-toaster]')
    expect(list?.style.getPropertyValue('--mobile-offset-bottom')).toBe(
      'calc(var(--safe-bottom) + 5.25rem)',
    )
    expect(list?.style.getPropertyValue('--mobile-offset-left')).toBe('16px')
    expect(list?.style.getPropertyValue('--mobile-offset-right')).toBe('16px')
  })

  it('pauses across focus moves and resumes only the remaining lifetime on exit', async () => {
    mount()
    await notify()
    await advance(1000)
    act(() => screen.getByRole('button', { name: 'See plans' }).focus())
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    act(() => screen.getByRole('button', { name: 'Close' }).focus())
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    await advance(2500)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    await advance(800)
    expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
  })

  it('keeps hover paused when focus leaves and focus paused when the pointer leaves', async () => {
    mount()
    await notify()
    const list = screen.getByRole('list')
    fireEvent.mouseEnter(list)
    act(() => screen.getByRole('button', { name: 'See plans' }).focus())
    fireEvent.mouseLeave(list)
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    fireEvent.mouseEnter(list)
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    fireEvent.mouseLeave(list)
    await advance(4300)
    expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
  })

  it('retains an infinite toast on exit and lets the cancel button dismiss it', async () => {
    mount()
    await notify(Infinity)
    act(() => screen.getByRole('button', { name: 'Close' }).focus())
    await advance(60000)
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    await advance(60000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await advance(300)
    expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
  })
  it('preserves pointer and hidden-document pauses independently of focus', async () => {
    mount()
    await notify()
    await advance(1000)
    const list = screen.getByRole('list')
    fireEvent.pointerDown(list)
    act(() => screen.getByRole('button', { name: 'See plans' }).focus())
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    fireEvent.pointerUp(list)
    await advance(5000)
    expect(screen.queryByText('Saved booking has no cost line')).not.toBeNull()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    await advance(3300)
    expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
  })

  it('supports keyboard activation for both action and cancel', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mount()
    for (const name of ['See plans', 'Close']) {
      await notify(Infinity)
      act(() => screen.getByRole('button', { name }).focus())
      await user.keyboard('{Enter}')
      await advance(300)
      expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
    }
  })

  it('does not leave later toasts paused after the focused toast is dismissed', async () => {
    mount()
    await notify(Infinity)
    act(() => screen.getByRole('button', { name: 'Close' }).focus())
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await advance(300)
    await notify()
    await advance(4300)
    expect(screen.queryByText('Saved booking has no cost line')).toBeNull()
  })

  it('keeps new toasts available while an existing toast has focus', async () => {
    mount()
    await notify(Infinity)
    act(() => screen.getByRole('button', { name: 'Close' }).focus())
    act(() => {
      toast('Another notification', { duration: 1000 })
    })
    await advance(5000)
    expect(screen.queryByText('Another notification')).not.toBeNull()
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    await advance(1300)
    expect(screen.queryByText('Another notification')).toBeNull()
  })
})
