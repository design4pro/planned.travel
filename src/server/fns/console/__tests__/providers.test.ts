/**
 * The provider screen's server surface, at the layer where its one real bug lived.
 *
 * `../console.test.ts` drives this directory against the shipped Better Auth, because every claim
 * that file makes is a claim about that library. Nothing here is: the guard is exercised one layer
 * down in `src/server/catalog/__tests__/provider-usage.test.ts`, where `requirePermission` runs for
 * real against a hand-built session. What is left for this file is the seam between the two — which
 * slug goes where, and which refusal becomes which code — so `../context` and `../bindings` are
 * replaced and the function under test runs whole.
 *
 * The case that earns the file is `saves a ceiling for a provider that has no client`. The published
 * reason for listing HERE, Geoapify, Workers AI and the unwritten D1 export is that a ceiling can be
 * agreed before the first call; this path used to cast the slug to a `MeteredProvider` and hand it
 * to a usage read that parses with `z.enum(METERED_PROVIDERS)`, so the first ceiling anybody entered
 * for Geoapify would have thrown. The cast is what kept the compiler quiet, and a cast is not
 * something a type test can catch — only running it can.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger, createMemorySink } from '#/server/observability'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { providerRegistry } from '#/server/db/schema'
import type { PlatformTables } from '#/server/catalog/__tests__/platform-tables'
import type { AuthSession } from '#/server/auth/tenant'
import type { Database } from '#/server/db/types'
import type { ConsoleCall } from '../context'
import type * as ConsoleContext from '../context'

interface RecordedEntry {
  action: string
  entityId?: string | null
  changes?: unknown
}

/**
 * Annotated rather than inferred, because `vi.hoisted` lifts the call above the imports and the
 * inferred shape would then be narrowed to the initial values — `null` and the literal `'admin'` —
 * which neither the database handed in by `beforeEach` nor a curator role could be assigned to.
 * Type annotations are erased, so naming the shape here costs the hoist nothing.
 */
interface Shared {
  db: { current: Database | null }
  recorded: Array<RecordedEntry>
  role: { current: string | null }
}

const shared = vi.hoisted((): Shared => ({
  db: { current: null },
  recorded: [],
  role: { current: 'admin' },
}))

function operator(role: string | null): AuthSession {
  return {
    user: {
      id: 'usr_ops',
      email: 'ops@planned.travel',
      name: 'Ops',
      emailVerified: true,
      image: null,
      twoFactorEnabled: true,
      role,
      banned: false,
      banReason: null,
      banExpires: null,
    },
    session: {
      id: 'ses_1',
      token: 'tok_1',
      userId: 'usr_ops',
      activeOrganizationId: 'org_1',
      expiresAt: new Date('2026-09-30T10:00:00.000Z'),
      impersonatedBy: null,
    },
  }
}

vi.mock('../bindings', () => ({
  platformDb: () => shared.db.current,
}))

vi.mock('../context', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleContext>()
  return {
    ...actual,
    // The real `openConsoleCall` needs h3's event store for its headers and IP, which only
    // `requestHandler()` installs. What it decides — the permission — is asserted for real against
    // the shipped guard one layer down, so here it is supplied.
    openConsoleCall: async (): Promise<ConsoleCall> => ({
      session: operator(shared.role.current),
      actor: {
        userId: 'usr_ops',
        actorKind: 'human',
        role: shared.role.current,
        tokenId: null,
      },
      headers: new Headers(),
      ip: null,
      userAgent: null,
      logger: createLogger({ level: 'error', sink: createMemorySink() }),
    }),
    recordConsoleAction: async (_call: ConsoleCall, entry: RecordedEntry) => {
      shared.recorded.push(entry)
    },
  }
})

const { saveProviderLimit } = await import('../providers')
const { ConsoleActionError } = await import('../errors')

let tables: PlatformTables

const INPUT = {
  label: 'Resend',
  limitWindow: 'month',
  callLimit: 1000,
  policy: 'allow',
  warnPercent: 70,
  criticalPercent: 90,
  notes: null,
} as const

beforeEach(async () => {
  tables = await createPlatformTables()
  shared.db.current = tables.db
  shared.recorded.length = 0
  shared.role.current = 'admin'
})

describe('saveProviderLimit', () => {
  it('saves a ceiling for a metered provider and reports its counters', async () => {
    const panel = await saveProviderLimit({ ...INPUT, slug: 'resend' })

    expect(panel).toMatchObject({
      slug: 'resend',
      integrated: true,
      callLimit: 1000,
      monthToDate: 0,
    })
  })

  it('saves a ceiling for a provider that has no client, without reading usage it cannot have', async () => {
    const panel = await saveProviderLimit({
      ...INPUT,
      slug: 'geoapify',
      label: 'Geoapify',
      limitWindow: 'day',
      callLimit: 3000,
    })

    expect(panel).toMatchObject({
      slug: 'geoapify',
      integrated: false,
      limitWindow: 'day',
      callLimit: 3000,
    })
    // Structurally zero rather than measured, which is what `integrated: false` tells the screen.
    expect(panel.series).toEqual([])
    expect(panel.measuringSince).toBeNull()
  })

  it('refuses a slug nobody has declared, rather than creating a row for a typo', async () => {
    await expect(
      saveProviderLimit({ ...INPUT, slug: 'geopify' as never }),
    ).rejects.toThrow()

    expect(await tables.db.select().from(providerRegistry)).toHaveLength(0)
  })

  it('records the ceiling change on a first save, because none is the biggest move there is', async () => {
    await saveProviderLimit({ ...INPUT, slug: 'resend' })

    expect(shared.recorded).toHaveLength(1)
    expect(shared.recorded[0]).toMatchObject({
      action: 'provider.limit_changed',
      entityId: 'resend',
      changes: { callLimit: { from: null, to: 1000 } },
    })
  })

  it('records the policy change apart from the ceiling, because they answer different questions', async () => {
    await saveProviderLimit({ ...INPUT, slug: 'resend' })
    shared.recorded.length = 0

    await saveProviderLimit({ ...INPUT, slug: 'resend', policy: 'block' })

    expect(shared.recorded.map((entry) => entry.action)).toEqual([
      'provider.policy_changed',
    ])
  })

  it('writes nothing to the ledger when a save changes neither fact', async () => {
    await saveProviderLimit({ ...INPUT, slug: 'resend' })
    shared.recorded.length = 0

    await saveProviderLimit({ ...INPUT, slug: 'resend', notes: 'unchanged' })

    expect(shared.recorded).toEqual([])
  })

  it('turns the unblockable refusal into a code the dialog can render', async () => {
    const rejection = await saveProviderLimit({
      ...INPUT,
      slug: 'polar',
      label: 'Polar',
      policy: 'block',
    }).catch((cause: unknown) => cause)

    expect(rejection).toBeInstanceOf(ConsoleActionError)
    expect(rejection).toMatchObject({
      code: 'provider-not-blockable',
      status: 409,
    })
    // The message is the advice, so it must survive the translation between layers.
    expect(String((rejection as Error).message)).toContain('polar')
  })
})
