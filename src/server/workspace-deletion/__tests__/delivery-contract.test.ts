import { expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
  consumeWorkspaceDeletionErasure,
  listStaleWorkspaceDeletions,
} from '#/server/catalog/workspace-deletions'
import { enterWorkspaceDeletionErasure } from '../erasure'

import {
  advanceWorkspaceDeletion,
  erasureResumeRequestSchema,
  refusalNoticeRequestSchema,
  deliveryAcceptanceSchema,
} from '../driver'
import { createWorkspaceDeletionLedgerPorts } from '../ledger'
import {
  appendWorkspaceDeletionAudit,
  PLATFORM_SYSTEM_ACTOR,
} from '#/server/catalog/audit'
import { TaskRetryableError } from '#/server/queue/types'
import { recoverWorkspaceDeletions } from '../recovery'
import type {
  ErasureResumeRequest,
  RefusalNoticeRequest,
  WorkspaceDeletionPorts,
} from '../driver'

it('retries an early canonical resume instead of acknowledging a parked success', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: 'alpha',
        initiator: 'erasure',
        erasureId: 'erase-alpha',
      },
      new Date(),
    )
    await expect(
      enterWorkspaceDeletionErasure(
        h.db,
        row.id,
        'erase-alpha',
        `person-erasure:erase-alpha:${row.id}`,
      ),
    ).rejects.toThrow('Workspace deletion is not ready')
    expect(
      h.sqlite
        .prepare(
          'select erasure_consumer from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({ erasure_consumer: null })
  } finally {
    h.close()
  }
})

/** Local adapter contract probe, deliberately outside TASK_KINDS/production handlers.
 * Every acceptance admits a delivery, even after an earlier same-id attempt exhausted.
 * Acceptance is not a permanent deduplication or successful-consumer marker.
 */
class RecordingDeliveries {
  readonly resumes: Array<ErasureResumeRequest> = []
  readonly notices: Array<RefusalNoticeRequest> = []
  readonly pending: Array<ErasureResumeRequest> = []
  readonly done = new Set<string>()
  readonly dead: Array<string> = []
  reject = false
  wrongAcceptance = false
  resume = async (request: ErasureResumeRequest) => {
    const checked = erasureResumeRequestSchema.parse(request)
    expect(Object.isFrozen(request)).toBe(true)
    expect(Object.isFrozen(request.payload)).toBe(true)
    if (this.reject) throw new Error('Delivery rejected')
    this.resumes.push(checked)
    this.pending.push(checked)
    return {
      accepted: true as const,
      id: this.wrongAcceptance ? 'wrong' : request.id,
    }
  }
  notice = async (request: RefusalNoticeRequest) => {
    expect(Object.isFrozen(request)).toBe(true)
    if (this.reject) throw new Error('Delivery rejected')
    this.notices.push(request)
    return { accepted: true as const, id: request.id }
  }
  async consume(
    h: Awaited<ReturnType<typeof createHarness>>,
    request: ErasureResumeRequest,
  ) {
    if (this.done.has(request.id)) return { outcome: 'duplicate' as const }
    const result = await enterWorkspaceDeletionErasure(
      h.db,
      request.payload.deletionId,
      request.payload.erasureId,
      request.id,
    )
    this.done.add(request.id)
    return result
  }
  async exhaust(h: Awaited<ReturnType<typeof createHarness>>) {
    const request = this.pending.shift()
    if (!request) throw new Error('No accepted delivery')
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(this.consume(h, request)).rejects.toBeInstanceOf(
        TaskRetryableError,
      )
      expect(this.done.has(request.id)).toBe(false)
    }
    this.dead.push(request.id)
  }
}

async function scenario(initiator: 'owner' | 'erasure' = 'erasure') {
  const h = await createHarness({ ddl: 'migrations' })
  let now = new Date()
  const tenant = await h.seedTenant('alpha')
  const row = await insertWorkspaceDeletion(
    h.db,
    initiator === 'erasure'
      ? {
          organizationId: tenant.organizationId,
          initiator,
          erasureId: 'erase-alpha',
        }
      : {
          organizationId: tenant.organizationId,
          initiator,
          requestedBy: tenant.ownerUserId,
          receiptTo: 'private@example.com',
          receiptName: 'Private',
        },
    now,
  )
  const sink = new RecordingDeliveries()
  const ledger = createWorkspaceDeletionLedgerPorts(h.db)
  let failAudit = false
  const ports: WorkspaceDeletionPorts = {
    now: () => now,
    ...ledger,
    billing: async () => 'allowed',
    drain: async () => 'has-other-members',
    deleteRows: async () => {
      throw new Error('Refusal cannot delete')
    },
    refusalNotice: sink.notice,
    resumeErasure: sink.resume,
    refuse: async (leased) => {
      if (failAudit) throw new Error('Audit unavailable')
      await appendWorkspaceDeletionAudit(
        h.db,
        leased,
        initiator === 'erasure'
          ? PLATFORM_SYSTEM_ACTOR
          : {
              actorKind: 'human',
              userId: tenant.ownerUserId,
              role: null,
              tokenId: null,
            },
        'deletion_refused',
        now,
      )
    },
    invalidatePlan: async () => {},
    audit: async () => {},
    receipt: async () => {},
    reconcileBilling: async () => {},
    sweep: async () => ({ drained: true, deleted: 0 }),
  }
  return {
    h,
    row,
    sink,
    ports,
    tenant,
    failAudit: (value: boolean) => {
      failAudit = value
    },
    tick: () => {
      now = new Date(now.getTime() + 900_001)
    },
    recover: () =>
      recoverWorkspaceDeletions({
        now: () => now,
        listStale: (at) => listStaleWorkspaceDeletions(h.db, at),
        advance: (id) => advanceWorkspaceDeletion(id, ports),
        stuck: () => {},
      }),
    saved: () =>
      h.sqlite
        .prepare('select * from workspace_deletions where id = ?')
        .get(row.id),
  }
}

const descriptor = {
  kind: 'person-erasure',
  id: 'person-erasure:erase-alpha:delete-alpha',
  delaySeconds: 30,
  payload: { erasureId: 'erase-alpha', deletionId: 'delete-alpha' },
}
it.each([
  { ...descriptor, kind: 'email' },
  { ...descriptor, delaySeconds: 0 },
  { ...descriptor, id: 'random' },
  { ...descriptor, payload: { erasureId: 'erase-alpha' } },
  { ...descriptor, payload: { deletionId: 'delete-alpha' } },
  {
    ...descriptor,
    payload: { ...descriptor.payload, email: 'private@example.com' },
  },
  {
    ...descriptor,
    payload: { ...descriptor.payload, erasureId: 'private@example.com' },
  },
])('rejects an invalid or non-opaque delivery descriptor %#', (request) => {
  expect(erasureResumeRequestSchema.safeParse(request).success).toBe(false)
})

it('recovers an accepted wake after audit failure and five exhausted attempts with the SAME ID', async () => {
  const s = await scenario()
  try {
    s.failAudit(true)
    const canonical = `person-erasure:erase-alpha:${s.row.id}`
    for (let n = 0; n < 12; n++)
      expect(
        await enterWorkspaceDeletionErasure(
          s.h.db,
          s.row.id,
          'erase-alpha',
          'original',
        ),
      ).toEqual({ outcome: 'parked' })
    await expect(advanceWorkspaceDeletion(s.row.id, s.ports)).rejects.toThrow(
      'Audit unavailable',
    )
    expect(s.sink.resumes[0]).toEqual({
      kind: 'person-erasure',
      id: canonical,
      delaySeconds: 30,
      payload: { erasureId: 'erase-alpha', deletionId: s.row.id },
    })
    expect(s.saved()).toMatchObject({
      state: 'requested',
      erasure_consumer: null,
      refusal_reason: 'has-other-members',
    })
    await s.sink.exhaust(s.h)
    expect(s.sink.dead).toEqual([canonical])
    // Cron, rather than a person-erasure cron/handler, owns issuing another delivery.
    s.tick()
    expect((await s.recover())[0].status).toBe('rejected')
    expect(s.sink.resumes.map((r) => r.id)).toEqual([canonical, canonical])
    expect(s.sink.pending).toHaveLength(1)
    await s.sink.exhaust(s.h)
    s.failAudit(false)
    s.tick()
    expect((await s.recover())[0]).toEqual({
      status: 'fulfilled',
      value: 'advanced',
    })
    const wake = s.sink.pending.shift()
    expect(wake?.id).toBe(canonical)
    expect(s.sink.done.has(canonical)).toBe(false)
    const results = await Promise.all(
      [canonical, 'competing-envelope'].map((id) =>
        enterWorkspaceDeletionErasure(s.h.db, s.row.id, 'erase-alpha', id),
      ),
    )
    expect(results).toEqual([
      { outcome: 'refused', reason: `workspace-refused:${s.row.id}` },
      { outcome: 'stale' },
    ])
    expect(
      await enterWorkspaceDeletionErasure(
        s.h.db,
        s.row.id,
        'erase-alpha',
        canonical,
      ),
    ).toEqual(results[0])
    expect(s.saved()).toMatchObject({
      state: 'refused',
      erasure_consumer: canonical,
    })
  } finally {
    s.h.close()
  }
})

it.each(['reject', 'wrongAcceptance'] as const)(
  'retains the row when wake %s prevents acceptance',
  async (mode) => {
    const s = await scenario()
    try {
      s.sink[mode] = true
      await expect(
        advanceWorkspaceDeletion(s.row.id, s.ports),
      ).rejects.toThrow()
      expect(s.saved()).toMatchObject({
        state: 'requested',
        erasure_consumer: null,
      })
      expect(
        s.h.sqlite
          .prepare('select id from organization where id = ?')
          .get(s.tenant.organizationId),
      ).toBeDefined()
    } finally {
      s.h.close()
    }
  },
)

it('retains owner PII on notice rejection and accepted notice plus failed audit, then clears on terminal CAS', async () => {
  const s = await scenario('owner')
  try {
    s.sink.reject = true
    await expect(advanceWorkspaceDeletion(s.row.id, s.ports)).rejects.toThrow(
      'Delivery rejected',
    )
    expect(s.saved()).toMatchObject({
      state: 'requested',
      receipt_to: 'private@example.com',
    })
    s.tick()
    s.sink.reject = false
    s.failAudit(true)
    await expect(advanceWorkspaceDeletion(s.row.id, s.ports)).rejects.toThrow(
      'Audit unavailable',
    )
    expect(s.saved()).toMatchObject({
      state: 'requested',
      receipt_to: 'private@example.com',
    })
    s.tick()
    s.failAudit(false)
    expect(await advanceWorkspaceDeletion(s.row.id, s.ports)).toBe('advanced')
    expect(s.sink.notices).toHaveLength(2)
    expect(s.sink.notices[0]).toEqual(s.sink.notices[1])
    expect(s.sink.notices[0]).toEqual({
      kind: 'workspace-deletion-refused',
      id: `workspace-deletion:${s.row.id}:refused`,
      deletionId: s.row.id,
      reason: 'has-other-members',
      to: 'private@example.com',
      name: 'Private',
    })
    expect(s.saved()).toMatchObject({
      state: 'refused',
      receipt_to: null,
      receipt_name: null,
    })
  } finally {
    s.h.close()
  }
})

it.each(['inside-original', 'after-last-read'] as const)(
  'delivers completion %s and recovers crash after consume',
  async (schedule) => {
    const s = await scenario()
    try {
      // The original engine call either invokes the driver before its handshake, or parks first.
      if (schedule === 'after-last-read')
        expect(
          await enterWorkspaceDeletionErasure(
            s.h.db,
            s.row.id,
            'erase-alpha',
            'original',
          ),
        ).toEqual({ outcome: 'parked' })
      s.ports.drain = async () => 'drained'
      expect(await advanceWorkspaceDeletion(s.row.id, s.ports)).toBe('advanced')
      s.ports.deleteRows = async () => 'deleted'
      expect(await advanceWorkspaceDeletion(s.row.id, s.ports)).toBe('advanced')
      expect(await advanceWorkspaceDeletion(s.row.id, s.ports)).toBe('advanced')
      const request = s.sink.resumes[0]
      const winner = schedule === 'inside-original' ? 'original' : request.id
      // Lost response after terminal-only CAS, before the handshake's re-read.
      expect(
        await consumeWorkspaceDeletionErasure(
          s.h.db,
          s.row.id,
          'erase-alpha',
          winner,
        ),
      ).toBe(true)
      expect(
        await enterWorkspaceDeletionErasure(
          s.h.db,
          s.row.id,
          'erase-alpha',
          winner,
        ),
      ).toEqual({ outcome: 'ready' })
      expect(
        await enterWorkspaceDeletionErasure(
          s.h.db,
          s.row.id,
          'erase-alpha',
          winner === 'original' ? request.id : 'original',
        ),
      ).toEqual({ outcome: 'stale' })
    } finally {
      s.h.close()
    }
  },
)

it.each([
  undefined,
  { accepted: false, id: 'id' },
  { accepted: true },
  { accepted: true, id: 'id', email: 'private@example.com' },
])(
  'rejects absent, negative or content-bearing acceptance %#',
  (acceptance) => {
    expect(deliveryAcceptanceSchema.safeParse(acceptance).success).toBe(false)
  },
)

it('rejects an owner notice with an unbound identity or extra content', () => {
  const request = {
    kind: 'workspace-deletion-refused',
    id: 'workspace-deletion:deletion:refused',
    deletionId: 'deletion',
    reason: 'has-other-members',
    to: 'owner@example.com',
    name: null,
  }
  expect(refusalNoticeRequestSchema.safeParse(request).success).toBe(true)
  expect(
    refusalNoticeRequestSchema.safeParse({ ...request, id: 'unbound' }).success,
  ).toBe(false)
  expect(
    refusalNoticeRequestSchema.safeParse({
      ...request,
      tenantContent: 'private',
    }).success,
  ).toBe(false)
})

it('reissues the accepted canonical wake after a real terminal lease replacement defeats CAS', async () => {
  const s = await scenario()
  try {
    let replace = true
    const ledger = createWorkspaceDeletionLedgerPorts(s.h.db)
    s.ports.checkpoint = async (...args) => {
      if (args[2] === 'refused' && replace) {
        replace = false
        s.tick()
        expect(
          await leaseWorkspaceDeletion(s.h.db, s.row.id, s.ports.now()),
        ).not.toBe('busy')
      }
      return ledger.checkpoint(...args)
    }
    expect(await advanceWorkspaceDeletion(s.row.id, s.ports)).toBe('lost-lease')
    expect(s.saved()).toMatchObject({
      state: 'requested',
      erasure_consumer: null,
    })
    await s.sink.exhaust(s.h)
    s.tick()
    expect((await s.recover())[0]).toEqual({
      status: 'fulfilled',
      value: 'advanced',
    })
    expect(s.sink.resumes[0]).toEqual(s.sink.resumes[1])
    expect(
      await enterWorkspaceDeletionErasure(
        s.h.db,
        s.row.id,
        'erase-alpha',
        s.sink.resumes[1].id,
      ),
    ).toEqual({ outcome: 'refused', reason: `workspace-refused:${s.row.id}` })
  } finally {
    s.h.close()
  }
})
