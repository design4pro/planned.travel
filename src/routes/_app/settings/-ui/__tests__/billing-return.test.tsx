import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  beginWorkspaceSwitch,
  resetWorkspaceClaim,
  setWorkspaceClaim,
} from '#/lib/workspace-claim-store'
import { PLANS } from '#/lib/plans'
import {
  rememberBillingSelection,
  useBillingReturn,
} from '../../-lib/billing-return'
import type { Entitlements } from '#/server/billing/types'

const read = vi.hoisted(() => vi.fn())
vi.mock('../../../-server/local-billing', () => ({ loadLocalBilling: read }))
const initial: Entitlements = {
  organizationId: 'org_a',
  planId: 'solo',
  planName: 'Solo',
  status: 'active',
  interval: 'monthly',
  seats: 1,
  limits: PLANS.solo.limits,
  usage: { seats: 1, trips: 0, storageBytes: 0 },
  quotas: Object.fromEntries(
    ['seats', 'trips', 'storageBytes'].map((key) => [
      key,
      {
        key,
        used: 0,
        limit: null,
        remaining: null,
        ratio: 0,
        exceeded: false,
      },
    ]),
  ) as Entitlements['quotas'],
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  trialEndsAt: null,
  trialing: false,
  hasProviderCustomer: true,
  pendingChange: null,
}
function remember() {
  rememberBillingSelection(initial.organizationId, 'viewer', 'plan', {
    planId: 'solo',
    interval: 'yearly',
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  resetWorkspaceClaim()
  setWorkspaceClaim('org_a')
  sessionStorage.clear()
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
  read.mockResolvedValue({ entitlements: initial, viewerId: 'viewer' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

it('confirms interval-only convergence and stops local reads', async () => {
  remember()
  read.mockResolvedValue({
    entitlements: { ...initial, interval: 'yearly' },
    viewerId: 'viewer',
  })
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  expect(result.current.outcome).toBe('pending')
  await advance(2000)
  expect(result.current.outcome).toBe('confirmed')
  expect(result.current.state.interval).toBe('yearly')
  await advance(120000)
  expect(read).toHaveBeenCalledTimes(1)
})
it('recognizes an already-applied selection on first load', () => {
  remember()
  const { result } = renderHook(() =>
    useBillingReturn({ ...initial, interval: 'yearly' }, 'viewer', 'plan'),
  )
  expect(result.current.outcome).toBe('confirmed')
  expect(read).not.toHaveBeenCalled()
})
it('recognizes a scheduled selection without replacing effective entitlements', () => {
  remember()
  const state = {
    ...initial,
    pendingChange: {
      planId: 'solo' as const,
      interval: 'yearly' as const,
      effectiveAt: new Date(Date.now() + 86400000),
    },
  }
  const { result } = renderHook(() => useBillingReturn(state, 'viewer', 'plan'))
  expect(result.current.outcome).toBe('scheduled')
  expect(result.current.state.interval).toBe('monthly')
})
it.each(['checkout', 'plan'] as const)(
  'retains pending across reload for %s and caps reads',
  async (marker) => {
    rememberBillingSelection('org_a', 'viewer', marker, {
      planId: 'solo',
      interval: 'yearly',
    })
    const first = renderHook(() => useBillingReturn(initial, 'viewer', marker))
    first.unmount()
    const { result } = renderHook(() =>
      useBillingReturn(initial, 'viewer', marker),
    )
    await advance(61000)
    expect(result.current.outcome).toBe('delayed')
    expect(read.mock.calls.length).toBeGreaterThan(0)
    expect(read.mock.calls.length).toBeLessThanOrEqual(8)
    const count = read.mock.calls.length
    await advance(120000)
    expect(read).toHaveBeenCalledTimes(count)
    read.mockResolvedValue({
      entitlements: { ...initial, interval: 'yearly' },
      viewerId: 'viewer',
    })
    await act(() => result.current.refresh())
    expect(result.current.outcome).toBe('confirmed')
  },
)
it('pauses hidden tabs without a catch-up burst', async () => {
  remember()
  renderHook(() => useBillingReturn(initial, 'viewer', 'plan'))
  Object.defineProperty(document, 'visibilityState', { value: 'hidden' })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await advance(10000)
  expect(read).not.toHaveBeenCalled()
  Object.defineProperty(document, 'visibilityState', { value: 'visible' })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await advance(1999)
  expect(read).not.toHaveBeenCalled()
  await advance(1)
  expect(read).toHaveBeenCalledTimes(1)
})
it('read failure yields delayed feedback and manual recovery', async () => {
  remember()
  read.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  await advance(2000)
  expect(result.current.outcome).toBe('delayed')
  await advance(120000)
  expect(read).toHaveBeenCalledTimes(1)
})
it('does not poll ordinary visits or infer confirmation from an unrelated change', async () => {
  remember()
  const ordinary = renderHook(() =>
    useBillingReturn(initial, 'viewer', undefined),
  )
  await advance(10000)
  expect(read).not.toHaveBeenCalled()
  ordinary.unmount()
  remember()
  read.mockResolvedValue({
    entitlements: { ...initial, seats: 3 },
    viewerId: 'viewer',
  })
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  await advance(2000)
  expect(result.current.outcome).toBe('pending')
})
it.each([
  'missing',
  'foreign workspace',
  'foreign viewer',
  'expired',
  'invalid',
  'wrong operation',
])('keeps %s correlation generic', async (kind) => {
  remember()
  if (kind === 'missing') sessionStorage.clear()
  if (kind === 'expired') vi.setSystemTime(Date.now() + 3600000)
  if (kind === 'invalid') sessionStorage.setItem('billing-selection', '{')
  const state = {
    ...initial,
    interval: 'yearly' as const,
    organizationId: kind === 'foreign workspace' ? 'org_b' : 'org_a',
  }
  setWorkspaceClaim(state.organizationId)
  const { result } = renderHook(() =>
    useBillingReturn(
      state,
      kind === 'foreign viewer' ? 'other' : 'viewer',
      kind === 'wrong operation' ? 'checkout' : 'plan',
    ),
  )
  expect(result.current.outcome).toBe('checking')
})
it('discards in-flight results on workspace change and unmount without overlap', async () => {
  remember()
  let resolve!: (value: unknown) => void
  read.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const { result, rerender, unmount } = renderHook(
    ({ state }) => useBillingReturn(state, 'viewer', 'plan'),
    { initialProps: { state: initial } },
  )
  await advance(2000)
  await advance(4000)
  expect(read).toHaveBeenCalledTimes(1)
  act(() => setWorkspaceClaim('org_b'))
  rerender({ state: { ...initial, organizationId: 'org_b' } })
  await act(async () =>
    resolve({
      entitlements: { ...initial, interval: 'yearly' },
      viewerId: 'viewer',
    }),
  )
  expect(result.current.state.organizationId).toBe('org_b')
  expect(result.current.outcome).toBe('checking')
  unmount()
  const count = read.mock.calls.length
  await advance(120000)
  expect(read).toHaveBeenCalledTimes(count)
})
it('confirms only matching seat quantities for effective Crew plans', () => {
  rememberBillingSelection('org_a', 'viewer', 'plan', {
    planId: 'crew',
    interval: 'monthly',
    seats: 5,
  })
  const { result, rerender } = renderHook(
    ({ seats }) =>
      useBillingReturn({ ...initial, planId: 'crew', seats }, 'viewer', 'plan'),
    { initialProps: { seats: 4 } },
  )
  expect(result.current.outcome).toBe('pending')
  rerender({ seats: 5 })
  expect(result.current.outcome).toBe('confirmed')
})
it('recognizes scheduled Crew without treating its current seats as future seats', () => {
  rememberBillingSelection('org_a', 'viewer', 'plan', {
    planId: 'crew',
    interval: 'monthly',
    seats: 3,
  })
  const { result } = renderHook(() =>
    useBillingReturn(
      {
        ...initial,
        planId: 'crew',
        seats: 8,
        pendingChange: {
          planId: 'crew',
          interval: 'monthly',
          effectiveAt: new Date(Date.now() + 86400000),
        },
      },
      'viewer',
      'plan',
    ),
  )
  expect(result.current.outcome).toBe('scheduled')
  expect(result.current.state.seats).toBe(8)
})
it('bounds an unanswered read and permits manual recovery', async () => {
  remember()
  read.mockReturnValueOnce(new Promise(() => {}))
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  await advance(12000)
  expect(result.current.outcome).toBe('delayed')
  read.mockResolvedValue({
    entitlements: { ...initial, interval: 'yearly' },
    viewerId: 'viewer',
  })
  await act(() => result.current.refresh())
  expect(result.current.outcome).toBe('confirmed')
})
it('clears old display context on cancellation or an ordinary visit', () => {
  remember()
  renderHook(() => useBillingReturn(initial, 'viewer', undefined))
  expect(sessionStorage.getItem('billing-selection')).toBeNull()
})
it('discards a foreign viewer response and stops further reads', async () => {
  remember()
  read.mockResolvedValue({
    entitlements: { ...initial, interval: 'yearly' },
    viewerId: 'foreign-viewer',
  })
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  await advance(2000)
  expect(result.current.state.interval).toBe('monthly')
  expect(result.current.outcome).toBe('delayed')
  await advance(60000)
  expect(read).toHaveBeenCalledTimes(1)
})

it('aborts results when the workspace starts switching before its loader settles', async () => {
  setWorkspaceClaim('org_a')
  remember()
  let resolve!: (value: unknown) => void
  read.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'plan'),
  )
  await advance(2000)
  act(() => beginWorkspaceSwitch())
  await act(async () =>
    resolve({
      entitlements: { ...initial, interval: 'yearly' },
      viewerId: 'viewer',
    }),
  )
  expect(result.current.state.interval).toBe('monthly')
  await advance(60000)
  expect(read).toHaveBeenCalledTimes(1)
})
it('discards an old response after the viewer changes', async () => {
  remember()
  let resolve!: (value: unknown) => void
  read.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const { result, rerender } = renderHook(
    ({ viewer }) => useBillingReturn(initial, viewer, 'plan'),
    { initialProps: { viewer: 'viewer' } },
  )
  await advance(2000)
  rerender({ viewer: 'new-viewer' })
  await act(async () =>
    resolve({
      entitlements: { ...initial, interval: 'yearly' },
      viewerId: 'viewer',
    }),
  )
  expect(result.current.state.interval).toBe('monthly')
  expect(result.current.outcome).toBe('checking')
  expect(sessionStorage.getItem('billing-selection')).toBeNull()
})

it('stops when the shell clears its workspace on session exit', async () => {
  remember()
  renderHook(() => useBillingReturn(initial, 'viewer', 'plan'))
  act(() => setWorkspaceClaim(null))
  await advance(60000)
  expect(read).not.toHaveBeenCalled()
})

it('keeps manual refresh busy until failure and permits recovery', async () => {
  let reject!: (reason: Error) => void
  read.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'checkout'),
  )
  let pending!: Promise<void>
  act(() => {
    pending = result.current.refresh()
  })
  expect(result.current.refreshing).toBe(true)
  await act(async () => {
    reject(new Error('offline'))
    await pending
  })
  expect(result.current.refreshing).toBe(false)
  expect(result.current.outcome).toBe('delayed')
  await act(() => result.current.refresh())
  expect(read).toHaveBeenCalledTimes(2)
  expect(result.current.refreshing).toBe(false)
})

it('suppresses referrers for automatic and manual local reads', async () => {
  const transport = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('{}'))
  read.mockImplementation(async (options) => {
    await options.fetch('/local-billing', { signal: options.signal })
    return { entitlements: initial, viewerId: 'viewer' }
  })
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'checkout'),
  )
  await advance(2000)
  await act(() => result.current.refresh())
  expect(transport).toHaveBeenCalledTimes(2)
  for (const [, init] of transport.mock.calls) {
    expect(init?.referrerPolicy).toBe('no-referrer')
  }
  transport.mockRestore()
})

it('keeps automatic ticks quiet and shows activity when Refresh joins an active read', async () => {
  let complete!: (value: {
    entitlements: Entitlements
    viewerId: string
  }) => void
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const { result } = renderHook(() =>
    useBillingReturn(initial, 'viewer', 'checkout'),
  )
  await advance(2000)
  expect(result.current.refreshing).toBe(false)
  await act(() => result.current.refresh())
  expect(result.current.refreshing).toBe(true)
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => {
    complete({ entitlements: initial, viewerId: 'viewer' })
  })
  expect(result.current.refreshing).toBe(false)
})
