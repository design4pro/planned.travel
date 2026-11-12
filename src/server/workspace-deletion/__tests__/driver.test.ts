import { expect, it } from 'vitest'
import { advanceWorkspaceDeletion } from '../driver'
import { createWorkspaceDeletionLedgerPorts } from '../ledger'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'
import type { WorkspaceDeletionPorts } from '../driver'
import type { WorkspaceDeletion } from '#/server/db/types'

const start = new Date('2026-11-09T00:00:00Z')

it('binds real catalog leases to the selected row and persists driver progress', async () => {
  const database = await createPlatformTables()
  try {
    const alpha = await insertWorkspaceDeletion(
      database.db,
      {
        organizationId: 'alpha',
        initiator: 'owner',
        requestedBy: 'owner-alpha',
      },
      start,
    )
    const beta = await insertWorkspaceDeletion(
      database.db,
      {
        organizationId: 'beta',
        initiator: 'owner',
        requestedBy: 'owner-beta',
      },
      start,
    )
    const h = fixture()
    const touched: Array<string> = []
    const ports = {
      ...h.ports,
      ...createWorkspaceDeletionLedgerPorts(database.db),
      drain: async (row: WorkspaceDeletion) => {
        touched.push(row.organizationId)
        return 'drained' as const
      },
    }
    expect(
      (
        await Promise.all([
          advanceWorkspaceDeletion(alpha.id, ports),
          advanceWorkspaceDeletion(alpha.id, ports),
        ])
      ).sort(),
    ).toEqual(['advanced', 'busy'])
    expect(touched).toEqual(['alpha'])
    const a = await leaseWorkspaceDeletion(database.db, alpha.id, start)
    const b = await leaseWorkspaceDeletion(database.db, beta.id, start)
    if (!a || a === 'busy' || !b || b === 'busy')
      throw new Error('Missing lease')
    expect(a.row.state).toBe('drained')
    expect(b.row.state).toBe('requested')
  } finally {
    database.close()
  }
})

function fixture() {
  let instant = start
  let held = false
  let row: WorkspaceDeletion = {
    id: 'delete-alpha',
    organizationId: 'alpha',
    initiator: 'owner',
    requestedBy: 'owner-alpha',
    erasureId: null,
    erasureConsumer: null,
    state: 'requested',
    leaseUntil: null,
    leaseToken: null,
    attempts: 0,
    lastError: null,
    refusalReason: null,
    snapshot: {},
    receiptTo: null,
    receiptName: null,
    requestedAt: start,
    updatedAt: start,
    sweptAt: null,
    doneAt: null,
  }
  let drained = false
  const ports: WorkspaceDeletionPorts = {
    now: () => instant,
    lease: async () => {
      if (held) return 'busy'
      held = true
      return { row: structuredClone(row), token: 'lease-alpha' }
    },
    checkpoint: async (_row, _token, next, patch) => {
      const { receiptQueued, ...stored } = patch
      row = {
        ...row,
        ...stored,
        state: next,
        updatedAt: instant,
        ...(next === 'swept' && row.state !== next ? { sweptAt: instant } : {}),
        ...(receiptQueued ? { receiptTo: null, receiptName: null } : {}),
      }
      held = false
      return true
    },
    billing: async () => 'allowed',
    drain: async () => (drained ? 'drained' : 'pending'),
    recordRefusal: async (_row, _token, reason) => {
      row = { ...row, refusalReason: reason }
      return true
    },
    refusalNotice: async (request) => ({ accepted: true, id: request.id }),
    refuse: async () => {},
    resumeErasure: async (request) => ({ accepted: true, id: request.id }),
    deleteRows: async () => 'deleted',
    invalidatePlan: async () => {},
    audit: async () => {},
    receipt: async () => {},
    reconcileBilling: async () => {},
    sweep: async () => ({ drained: true, deleted: 0 }),
  }
  return {
    ports,
    row: () => row,
    finishDrain: () => {
      drained = true
    },
    setTime: (date: Date) => {
      instant = date
    },
    setRow: (patch: Partial<WorkspaceDeletion>) => {
      row = { ...row, ...patch }
    },
  }
}

it('keeps bounded drain progress resumable and admits only one concurrent driver', async () => {
  const h = fixture()
  const results = await Promise.all([
    advanceWorkspaceDeletion('delete-alpha', h.ports),
    advanceWorkspaceDeletion('delete-alpha', h.ports),
  ])
  expect(results.sort()).toEqual(['busy', 'pending'])
  expect(h.row().state).toBe('requested')
  h.finishDrain()
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'advanced',
  )
  expect(h.row().state).toBe('drained')
})

it('resumes after each state and catches a late object only after the fifteen-minute wait', async () => {
  const h = fixture()
  h.finishDrain()
  h.setRow({ receiptTo: 'owner@example.com', receiptName: 'Alpha' })
  const evidence = new Set<string>()
  const messages = new Set<string>()
  let objects = 1
  h.ports.audit = async (row) => {
    evidence.add(row.id)
  }
  h.ports.receipt = async (row) => {
    messages.add(row.id)
  }
  h.ports.sweep = async () => {
    const deleted = objects
    objects = 0
    return { drained: true, deleted }
  }
  for (const expected of [
    'drained',
    'rows_deleted',
    'audited',
    'swept',
  ] as const) {
    if (expected === 'audited') {
      expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
        'pending',
      )
    }
    expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
      'advanced',
    )
    expect(h.row().state).toBe(expected)
  }
  expect(h.row().receiptTo).toBeNull()
  expect(evidence.size).toBe(1)
  expect(messages.size).toBe(1)
  objects = 1
  h.setTime(new Date(start.getTime() + 899_999))
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'pending',
  )
  expect(objects).toBe(1)
  h.setTime(new Date(start.getTime() + 900_000))
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'advanced',
  )
  expect(h.row().state).toBe('done')
  expect(objects).toBe(0)
  expect(h.row().snapshot.r2ObjectsDeleted).toBe(2)
})

it('keeps erasure fenced on transient billing failure but refuses the owner request', async () => {
  const owner = fixture()
  owner.setRow({ receiptTo: 'owner@example.com' })
  owner.ports.billing = async () => 'billing-unavailable'
  expect(await advanceWorkspaceDeletion('delete-alpha', owner.ports)).toBe(
    'advanced',
  )
  expect(owner.row().state).toBe('refused')
  const erasure = fixture()
  erasure.setRow({
    initiator: 'erasure',
    requestedBy: null,
    erasureId: 'erase-alpha',
  })
  erasure.ports.billing = async () => 'billing-unavailable'
  expect(await advanceWorkspaceDeletion('delete-alpha', erasure.ports)).toBe(
    'pending',
  )
  expect(erasure.row().state).toBe('requested')
  expect(erasure.row().lastError).toBe('billing-unavailable')
})

it('cannot finish an erasure refusal before its resume is queued', async () => {
  const h = fixture()
  h.setRow({
    initiator: 'erasure',
    requestedBy: null,
    erasureId: 'erase-alpha',
  })
  h.ports.drain = async () => 'has-other-members'
  h.ports.resumeErasure = async () => {
    throw new Error('queue unavailable')
  }
  await expect(
    advanceWorkspaceDeletion('delete-alpha', h.ports),
  ).rejects.toThrow('queue unavailable')
  expect(h.row().state).toBe('requested')
  h.ports.resumeErasure = async (request) => ({
    accepted: true,
    id: request.id,
  })
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'advanced',
  )
  expect(h.row().state).toBe('refused')
})

it('retries rows_deleted after billing failure without losing receipt or audit evidence', async () => {
  const h = fixture()
  h.setRow({ state: 'rows_deleted', receiptTo: 'owner@example.com' })
  const audits = new Set<string>()
  const receipts = new Set<string>()
  h.ports.audit = async (row) => {
    audits.add(row.id)
  }
  h.ports.receipt = async (row) => {
    receipts.add(row.id)
  }
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'pending',
  )
  h.ports.reconcileBilling = async () => {
    throw new Error('provider unavailable')
  }
  await expect(
    advanceWorkspaceDeletion('delete-alpha', h.ports),
  ).rejects.toThrow('provider unavailable')
  expect(h.row().state).toBe('rows_deleted')
  expect(h.row().receiptTo).toBeNull()
  h.ports.reconcileBilling = async () => {}
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'advanced',
  )
  expect(h.row().state).toBe('audited')
  expect([...audits]).toEqual(['delete-alpha'])
  expect([...receipts]).toEqual(['delete-alpha'])
})

it('leaves rows_deleted recoverable when the erasure resume cannot be queued', async () => {
  const h = fixture()
  h.setRow({
    state: 'rows_deleted',
    initiator: 'erasure',
    requestedBy: null,
    erasureId: 'erase-alpha',
  })
  let accepted = 0
  h.ports.resumeErasure = async () => {
    throw new Error('queue unavailable')
  }
  await expect(
    advanceWorkspaceDeletion('delete-alpha', h.ports),
  ).rejects.toThrow('queue unavailable')
  expect(h.row().state).toBe('rows_deleted')
  h.ports.resumeErasure = async (request) => {
    accepted += 1
    return { accepted: true, id: request.id }
  }
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'advanced',
  )
  expect(accepted).toBe(1)
})

it('never reports an advanced state after a lease overrun loses compare-and-set', async () => {
  const h = fixture()
  h.finishDrain()
  h.ports.checkpoint = async () => false
  expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
    'lost-lease',
  )
  expect(h.row().state).toBe('requested')
})

it.each([
  ['requested', 'billing', 'drained'],
  ['requested', 'drain', 'drained'],
  ['drained', 'deleteRows', 'rows_deleted'],
  ['drained', 'invalidatePlan', 'rows_deleted'],
  ['rows_deleted', 'audit', 'audited'],
  ['rows_deleted', 'reconcileBilling', 'audited'],
  ['audited', 'sweep', 'swept'],
  ['swept', 'sweep', 'done'],
] as const)(
  'recovers %s after interruption at %s',
  async (state, effect, next) => {
    const h = fixture()
    h.finishDrain()
    h.setRow({ state, sweptAt: start })
    h.setTime(new Date(start.getTime() + 900_000))
    const broken = {
      ...h.ports,
      [effect]: async () => {
        throw new Error('process interrupted')
      },
    }
    await expect(
      advanceWorkspaceDeletion('delete-alpha', broken),
    ).rejects.toThrow('process interrupted')
    expect(h.row().state).toBe(state)
    expect(h.row().lastError).toBe('step-unavailable')
    expect(await advanceWorkspaceDeletion('delete-alpha', h.ports)).toBe(
      'advanced',
    )
    expect(h.row().state).toBe(next)
  },
)
