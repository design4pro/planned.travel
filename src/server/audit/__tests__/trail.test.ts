/**
 * The audit trail's write boundary.
 *
 * Two properties are load-bearing and neither is visible from a call site, so both are pinned here:
 * an entry is attributed to the tenant scope and never to anything the caller passed, and a refused
 * append is swallowed rather than turned into a failed save. Everything below runs against the real
 * repository over a fully migrated in-memory database — the only thing faked is the request, which
 * is what `getRequest()` reads and what the runtime alone can supply.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { requestHandler } from '@tanstack/react-start/server'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import { createScope, listAuditLog, listEntityHistory } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { AUDIT_ACTIONS, trail } from '../trail'

import type { AuditAction } from '../trail'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

/* ------------------------------------------------------------ start context */

/**
 * Runs `fn` as if a request with these headers were in flight.
 *
 * `requestHandler` is the framework's own entry point — the function that installs the
 * `AsyncLocalStorage` store `getRequest()` resolves — so the request `trail()` reads here is
 * installed exactly the way the runtime installs it, rather than by a hand-built store keyed off a
 * symbol this test would have to keep in step with the package.
 */
async function underRequest(
  headers: Record<string, string>,
  fn: () => Promise<void>,
): Promise<void> {
  await requestHandler(async () => {
    await fn()
    return new Response(null, { status: 204 })
  })(
    new Request('https://planned.travel/_serverFn/files', {
      method: 'POST',
      headers,
    }),
    // `requestOpts` is the platform's own handle (`any` in the package's types); nothing on the
    // path under test reads it.
    {},
  )
}

/* -------------------------------------------------------------------- setup */

let harness: Harness
let tenant: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('trail')
})

afterEach(() => {
  harness.close()
})

async function entries(scope: TenantScope) {
  const page = await listAuditLog(scope)
  return page.items
}

/* ------------------------------------------------------------------- actor */

describe('trail', () => {
  it('attributes the entry to the scope and not to anything the caller passed', async () => {
    const impostor = await tenant.addUser('Impostor')

    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entityType: 'file',
      entityId: 'file_1',
      // A caller cannot name the actor: the field is not on the input type, and the repository
      // stamps `actorUserId` from the scope regardless.
      metadata: { actorUserId: impostor, filename: 'itinerary.pdf' },
    })

    const rows = await entries(tenant.scope)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorUserId).toBe(tenant.ownerUserId)
    expect(rows[0]?.actorUserId).not.toBe(impostor)
    expect(rows[0]?.action).toBe('file.uploaded')
    expect(rows[0]?.metadata).toEqual({
      actorUserId: impostor,
      filename: 'itinerary.pdf',
    })
  })

  it('records the entry under the acting member, not the workspace owner', async () => {
    const memberId = await tenant.addUser('Second traveller')

    await trail(tenant.scopeFor(memberId), {
      action: AUDIT_ACTIONS.RESERVATION_CREATED,
      entityType: 'reservation',
      entityId: 'res_1',
    })

    const rows = await entries(tenant.scope)
    expect(rows[0]?.actorUserId).toBe(memberId)
  })

  /* --------------------------------------------------------------- request */

  it('captures the client IP and user agent from the request', async () => {
    await underRequest(
      { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'Mozilla/5.0 (test)' },
      () =>
        trail(tenant.scope, {
          action: AUDIT_ACTIONS.WORKSPACE_DEFAULTS_CHANGED,
          entityType: 'organization',
          entityId: tenant.organizationId,
        }),
    )

    const rows = await entries(tenant.scope)
    expect(rows[0]?.ip).toBe('203.0.113.7')
    expect(rows[0]?.userAgent).toBe('Mozilla/5.0 (test)')
  })

  it('writes a row with a null IP and user agent when no request is in scope', async () => {
    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: 'file',
      entityId: 'file_2',
    })

    const rows = await entries(tenant.scope)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.ip).toBeNull()
    expect(rows[0]?.userAgent).toBeNull()
  })

  it('treats a request without the two headers as no IP and no user agent', async () => {
    await underRequest({}, () =>
      trail(tenant.scope, {
        action: AUDIT_ACTIONS.FILE_DELETED,
        entityType: 'file',
        entityId: 'file_3',
      }),
    )

    const rows = await entries(tenant.scope)
    expect(rows[0]?.ip).toBeNull()
    expect(rows[0]?.userAgent).toBeNull()
  })

  it('keeps the row when the user agent is longer than the column input allows', async () => {
    const userAgent = `Mozilla/5.0 ${'x'.repeat(400)}`

    await underRequest({ 'user-agent': userAgent }, () =>
      trail(tenant.scope, {
        action: AUDIT_ACTIONS.FILE_UPLOADED,
        entityType: 'file',
        entityId: 'file_4',
      }),
    )

    const rows = await entries(tenant.scope)
    expect(rows).toHaveLength(1)
    // Bounded to what `shortTextSchema` accepts, keeping the head of the value rather than losing
    // the whole entry to a field nobody reads.
    expect(rows[0]?.userAgent).toBe(userAgent.slice(0, 200))
  })

  /* ----------------------------------------------------------- impersonation */

  it('stamps the operator into metadata when the scope is an impersonated session', async () => {
    const operator = await tenant.addUser('Operator')
    const scope = createScope(harness.db, {
      ...tenant.scope.ctx,
      impersonatedBy: operator,
    })

    await underRequest({ 'cf-connecting-ip': '203.0.113.9' }, () =>
      trail(scope, {
        action: AUDIT_ACTIONS.FILE_UPLOADED,
        entityType: 'file',
        entityId: 'file_imp',
        metadata: { filename: 'itinerary.pdf' },
      }),
    )

    const rows = await entries(tenant.scope)
    expect(rows).toHaveLength(1)
    // Attributed to the account owner as ever; the operator rides in metadata beside what the
    // caller recorded, and reads back through the entity history as well.
    expect(rows[0]?.actorUserId).toBe(tenant.ownerUserId)
    expect(rows[0]?.metadata).toEqual({
      filename: 'itinerary.pdf',
      impersonatedBy: operator,
    })
    const history = await listEntityHistory(tenant.scope, 'file', 'file_imp')
    expect(history[0]?.metadata).toMatchObject({ impersonatedBy: operator })
  })

  it('records an impersonated entry when no request is in scope', async () => {
    const scope = createScope(harness.db, {
      ...tenant.scope.ctx,
      impersonatedBy: 'usr_operator',
    })

    await trail(scope, {
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: 'file',
      entityId: 'file_imp_2',
    })

    const rows = await entries(tenant.scope)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.ip).toBeNull()
    expect(rows[0]?.metadata).toEqual({ impersonatedBy: 'usr_operator' })
  })

  it('never lets a caller-supplied impersonatedBy win over the derived one', async () => {
    const scope = createScope(harness.db, {
      ...tenant.scope.ctx,
      impersonatedBy: 'usr_operator',
    })

    await trail(scope, {
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entityType: 'file',
      entityId: 'file_imp_3',
      metadata: { impersonatedBy: 'usr_someone_else' },
    })

    const rows = await entries(tenant.scope)
    expect(rows[0]?.metadata).toEqual({ impersonatedBy: 'usr_operator' })
  })

  it('adds no impersonatedBy key for an ordinary session, and keeps a null-metadata entry null', async () => {
    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entityType: 'file',
      entityId: 'file_plain',
      metadata: { filename: 'a.pdf' },
    })
    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: 'file',
      entityId: 'file_plain_2',
    })
    // A caller cannot manufacture the stamp on an ordinary session by naming the key either.
    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: 'file',
      entityId: 'file_plain_3',
      metadata: { impersonatedBy: 'usr_forged' },
    })

    const byEntity = new Map(
      (await entries(tenant.scope)).map((row) => [row.entityId, row.metadata]),
    )
    expect(byEntity.get('file_plain')).toEqual({ filename: 'a.pdf' })
    expect(byEntity.get('file_plain_2') ?? null).toBeNull()
    expect(byEntity.get('file_plain_3') ?? null).toEqual({})
  })

  /* ------------------------------------------------------------- swallowing */

  it('does not propagate a refused append, and reports it once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken: Database = drizzle(async () => {
      throw new Error('D1 is unavailable')
    })
    const scope = createScope(broken, tenant.scope.ctx)

    await expect(
      trail(scope, {
        action: AUDIT_ACTIONS.RESERVATION_DELETED,
        entityType: 'reservation',
        entityId: 'res_2',
      }),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const line = String(warn.mock.calls[0]?.[0])
    expect(line).toContain('reservation.deleted')
    expect(line).toContain('D1 is unavailable')
  })

  it('rejects a malformed action key at the boundary rather than writing it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      trail(tenant.scope, {
        action: 'Reservation Updated' as AuditAction,
        entityType: 'reservation',
        entityId: 'res_3',
      }),
    ).resolves.toBeUndefined()

    expect(await entries(tenant.scope)).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('is silent on the path that succeeds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await trail(tenant.scope, {
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      entityType: 'reservation',
      entityId: 'res_4',
    })

    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(
      await listEntityHistory(tenant.scope, 'reservation', 'res_4'),
    ).toHaveLength(1)
  })

  /* ------------------------------------------------------------- call sites */

  /**
   * The three write paths this trail was built for, checked at the source.
   *
   * A source rule rather than a driven handler, for one reason: those three modules are owned
   * elsewhere and carry no unit test of their own, so there is nowhere to assert this from that a
   * later stage would not have to move. It is a weak check and a real one — it fails if a call site
   * is deleted, renamed away, or quietly left recording nothing, which is the regression that would
   * otherwise show up as an empty audit table on `/admin` and nowhere else.
   *
   * Matched by name rather than by literal line, so reformatting a call site never fails this.
   */
  /** This file sits four directories below the repository root. */
  const repoRoot = new URL('../../../../', import.meta.url)

  const callSites: ReadonlyArray<
    readonly [path: string, actions: ReadonlyArray<keyof typeof AUDIT_ACTIONS>]
  > = [
    ['src/server/fns/files.ts', ['FILE_UPLOADED', 'FILE_DELETED']],
    [
      'src/server/fns/reservations.ts',
      ['RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_DELETED'],
    ],
    ['src/routes/_app/-server/settings.ts', ['WORKSPACE_DEFAULTS_CHANGED']],
    ['src/server/fns/trip-currency.ts', ['TRIP_CURRENCY_CHANGED']],
    ['src/server/fns/member-role-writes.ts', ['MEMBER_ROLE_CHANGED']],
  ]

  it.each(callSites)('%s records through trail()', (path, actions) => {
    const source = readFileSync(fileURLToPath(new URL(path, repoRoot)), 'utf8')

    expect(source).toContain("from '#/server/audit/trail'")
    for (const action of actions) {
      expect(source).toMatch(new RegExp(`\\bAUDIT_ACTIONS\\.${action}\\b`))
    }
  })

  /* ------------------------------------------------------------- vocabulary */

  it('names every action entity-first, in the shape the repository accepts', () => {
    const actions = Object.values(AUDIT_ACTIONS)
    expect(actions).toEqual([
      'file.uploaded',
      'file.deleted',
      'reservation.created',
      'reservation.updated',
      'reservation.deleted',
      'workspace.defaults_changed',
      'trip.currency_changed',
      'member.role_changed',
      'member.removed',
      'member.left',
      'trip_invite.rotated',
      'trip_invite.updated',
      'trip.member_joined',
    ])
    // The rule is imported, never re-declared — docs/ACCESS.md §4.2, and the guard in
    // `src/server/catalog/__tests__/audit.test.ts` fails this file for spelling it out again.
    for (const action of actions) {
      expect(action).toMatch(AUDIT_ACTION_PATTERN)
    }
  })
})
