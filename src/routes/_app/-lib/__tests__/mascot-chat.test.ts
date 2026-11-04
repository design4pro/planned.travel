import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatLauncher } from '../mascot-chat'

afterEach(() => vi.useRealTimers())

describe('chat launcher', () => {
  it('coalesces activations and cancels timed-out work', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    let finish = () => {}
    const open = vi.fn(({ signal: attemptSignal }: { signal: AbortSignal }) => {
      signal = attemptSignal
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const launcher = createChatLauncher({ open })
    const first = launcher.open()
    expect(launcher.open()).toBe(first)
    expect(open).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await first).toBe('unavailable')
    expect(signal?.aborted).toBe(true)
    finish()
    await Promise.resolve()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('passes only the authorized entity and reports a successful open', async () => {
    const open = vi.fn(async () => {})
    const launcher = createChatLauncher({ open })
    expect(await launcher.open({ kind: 'trip', id: 'trip-1' })).toBe('opened')
    expect(open).toHaveBeenCalledWith({
      source: 'dashboard-mascot',
      entity: { kind: 'trip', id: 'trip-1' },
      signal: expect.any(AbortSignal),
    })
  })

  it('cancels an active attempt when availability is lost', async () => {
    let signal: AbortSignal | undefined
    const launcher = createChatLauncher({
      open: ({ signal: current }) => {
        signal = current
        return new Promise(() => {})
      },
    })
    const pending = launcher.open()
    launcher.setAvailable(false)
    expect(signal?.aborted).toBe(true)
    expect(await pending).toBe('unavailable')
    expect(await launcher.open()).toBe('unavailable')
  })

  it('reports absent and rejected adapters and cancels on scope change', async () => {
    expect(await createChatLauncher().open()).toBe('unavailable')
    expect(
      await createChatLauncher({
        open: async () => {
          throw new Error('failed')
        },
      }).open(),
    ).toBe('unavailable')
    let signal: AbortSignal | undefined
    const launcher = createChatLauncher({
      open: ({ signal: s }) => {
        signal = s
        return new Promise(() => {})
      },
    })
    const pending = launcher.open()
    launcher.cancel()
    expect(signal?.aborted).toBe(true)
    expect(await pending).toBe('cancelled')
  })
})
