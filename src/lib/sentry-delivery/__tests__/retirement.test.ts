import { afterEach, describe, expect, it, vi } from 'vitest'
import { authClient } from '#/lib/auth/client'
import {
  confirmTransactionDeliveryScope,
  retireTransactionRecovery,
  subscribeTransactionScope,
  transactionScopeGeneration,
  withTransactionRecoveryRetired,
} from '../control'

const requestFetch = vi.hoisted(() => {
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  return request
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('retirement happens before identity mutations', () => {
  it('retires Better Auth sign-out before issuing the request', async () => {
    const order: string[] = []
    const stop = subscribeTransactionScope((event) => order.push(event.type))
    requestFetch.mockImplementation(async () => {
      order.push('fetch')
      return Response.json({ success: true })
    })
    try {
      await authClient.signOut()
      expect(order[0]).toBe('retire')
      expect(order).toContain('fetch')
    } finally {
      stop()
    }
  })
  it('does not reactivate a retired context from a meta element', () => {
    const events: string[] = []
    const stop = subscribeTransactionScope((event) => events.push(event.type))
    try {
      retireTransactionRecovery(false)
      const meta = document.createElement('meta')
      meta.name = 'sentry-delivery-scope'
      meta.content = 'anonymous'
      document.head.appendChild(meta)
      expect(events).toEqual(['retire'])
      confirmTransactionDeliveryScope('anonymous', transactionScopeGeneration())
      expect(events).toEqual(['retire', 'fresh'])
      meta.remove()
    } finally {
      stop()
    }
  })
})

it('does not reactivate from a server result started before retirement', () => {
  const events: string[] = []
  const stop = subscribeTransactionScope((event) => events.push(event.type))
  try {
    const token = transactionScopeGeneration()
    retireTransactionRecovery(false)
    confirmTransactionDeliveryScope('anonymous', token)
    expect(events).toEqual(['retire'])
    confirmTransactionDeliveryScope('anonymous', transactionScopeGeneration())
    expect(events).toEqual(['retire', 'fresh'])
  } finally {
    stop()
  }
})

it('rejects fresh scope read during a mutation and after its completion', async () => {
  const events: string[] = []
  const stop = subscribeTransactionScope((event) => events.push(event.type))
  let finish!: () => void
  const pending = withTransactionRecoveryRetired(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const token = transactionScopeGeneration()
  confirmTransactionDeliveryScope('anonymous', token)
  expect(events).toEqual(['retire'])
  finish()
  await pending
  confirmTransactionDeliveryScope('anonymous', token)
  expect(events).toEqual(['retire', 'retire'])
  confirmTransactionDeliveryScope('anonymous', transactionScopeGeneration())
  expect(events).toEqual(['retire', 'retire', 'fresh'])
  stop()
})

it('keeps overlapping identity mutations retired until all settle, including a network error', async () => {
  const events: string[] = []
  const stop = subscribeTransactionScope((event) => events.push(event.type))
  let resolveFirst!: () => void
  let rejectLast!: (error: Error) => void
  const first = withTransactionRecoveryRetired(
    () =>
      new Promise<void>((resolve) => {
        resolveFirst = resolve
      }),
  )
  const last = withTransactionRecoveryRetired(
    () =>
      new Promise<void>((resolve, reject) => {
        void resolve
        rejectLast = reject
      }),
  )
  const rejected = expect(last).rejects.toThrow('unknown network outcome')
  resolveFirst()
  await first
  confirmTransactionDeliveryScope('anonymous', transactionScopeGeneration())
  expect(events.every((event) => event === 'retire')).toBe(true)
  rejectLast(new Error('unknown network outcome'))
  await rejected
  confirmTransactionDeliveryScope('anonymous', transactionScopeGeneration())
  expect(events.at(-1)).toBe('fresh')
  stop()
})

it('retires BFCache restoration without accepting unchanged document metadata', () => {
  const events: string[] = []
  const stop = subscribeTransactionScope((event) => events.push(event.type))
  const restored = new Event('pageshow')
  Object.defineProperty(restored, 'persisted', { value: true })
  window.dispatchEvent(restored)
  expect(events).toEqual(['retire'])
  stop()
})

it('accepts payload-free cross-tab retirement without rebroadcasting it', () => {
  let deliver: ((event: { data: unknown }) => void) | undefined
  const post = vi.fn()
  const close = vi.fn()
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      postMessage = post
      close = close
      set onmessage(value: typeof deliver) {
        deliver = value
      }
    },
  )
  const events: string[] = []
  const stop = subscribeTransactionScope((event) => events.push(event.type))
  deliver?.({ data: { type: 'retire' } })
  expect(events).toEqual(['retire'])
  expect(post).not.toHaveBeenCalled()
  stop()
  expect(close).toHaveBeenCalledOnce()
})
