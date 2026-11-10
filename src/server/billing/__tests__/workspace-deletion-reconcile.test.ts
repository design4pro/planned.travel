import './prices.fixture'
import { expect, it } from 'vitest'
import { reconcileWorkspaceDeletionBilling } from '../workspace-deletion'
import { polarSubscription, TEST_ORG_ID } from './harness'
import type { PolarClient } from '../types'

const firstId = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'

it('reconciles authoritative subscriptions on later pages and safely repeats after a failed patch', async () => {
  let fail = true
  const ending = new Set<string>()
  const patches: Array<string> = []
  const polar: PolarClient = {
    request: async (request) => {
      if (request.method === 'GET') {
        const id = request.query?.page === 1 ? firstId : secondId
        return {
          items: [
            polarSubscription({ id, cancel_at_period_end: ending.has(id) }),
          ],
          pagination: { total_count: 2, max_page: 2 },
        }
      }
      expect(request.method).toBe('PATCH')
      expect(request.body).toEqual({ cancel_at_period_end: true })
      const id = request.path.split('/').at(-1) ?? ''
      patches.push(id)
      if (id === secondId && fail) throw new Error('Provider unavailable')
      ending.add(id)
      return polarSubscription({ id, cancel_at_period_end: true })
    },
  }
  await expect(
    reconcileWorkspaceDeletionBilling(polar, TEST_ORG_ID),
  ).rejects.toThrow('Provider unavailable')
  fail = false
  await reconcileWorkspaceDeletionBilling(polar, TEST_ORG_ID)
  expect(patches).toEqual([firstId, secondId, secondId])
  expect([...ending].sort()).toEqual([firstId, secondId])
})

it('refuses foreign attribution and incomplete pagination before mutating any subscription', async () => {
  for (const fault of ['foreign', 'incomplete'] as const) {
    const writes: Array<unknown> = []
    const polar: PolarClient = {
      request: async (request) => {
        if (request.method !== 'GET') {
          writes.push(request)
          throw new Error('Must not write')
        }
        return {
          items: [
            polarSubscription({
              id: firstId,
              ...(fault === 'foreign'
                ? { customer: { id: secondId, external_id: 'beta' } }
                : {}),
            }),
          ],
          pagination: {
            total_count: fault === 'incomplete' ? 2 : 1,
            max_page: 1,
          },
        }
      },
    }
    await expect(
      reconcileWorkspaceDeletionBilling(polar, TEST_ORG_ID),
    ).rejects.toThrow()
    expect(writes).toEqual([])
  }
})
