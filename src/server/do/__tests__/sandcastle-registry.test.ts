/**
 * The run registry's regression test, and the first test in this repository to construct a Durable
 * Object — which the narrow port interfaces on `SandcastleRegistry` and `TripRoom` were designed
 * for but nothing had yet taken up.
 *
 * The failure it guards is silent by construction. When two agent runs both believe they own an
 * issue, nothing throws: they simply both build it, on separate branches, and the operator finds
 * out from a merge conflict an hour later. That happened — two loops built #106 and #108
 * simultaneously and one threw its work away — so the cases below are that night's shapes, plus the
 * PRD-subtree rule that decides who may enter a tree somebody else is already inside.
 *
 * Storage is a hand-rolled in-memory fake rather than a mock, because the object's behaviour lives
 * in what it reads back after writing: a mock returning canned values would assert this test's
 * model of storage and stay green if the real read-modify-write broke. Time is injected for the
 * same reason — expiry is the mechanism that makes a crashed run's work reclaimable, and waiting
 * five real minutes to prove it is not a test.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { SANDCASTLE_LEASE_TTL_MS } from '../sandcastle-protocol'
import { SandcastleRegistry, closureOf } from '../sandcastle-registry'

import type { ClaimResult, RegistryState } from '../sandcastle-protocol'
import type {
  SandcastleRegistryOptions,
  SandcastleRegistryState,
  SandcastleRegistryStorage,
} from '../sandcastle-registry'

/* -------------------------------------------------------------- the fake -- */

/** Enough of `DurableObjectStorage` to run the registry, and nothing more. */
function createStorage(): SandcastleRegistryStorage & { alarm: number | null } {
  const data = new Map<string, unknown>()
  let alarm: number | null = null

  return {
    get alarm() {
      return alarm
    },
    get: async <T>(key: string) => data.get(key) as T | undefined,
    put: async <T>(entries: Record<string, T>) => {
      for (const [key, value] of Object.entries(entries)) data.set(key, value)
    },
    list: async <T>(options?: {
      prefix?: string
      limit?: number
      reverse?: boolean
    }) => {
      let keys = [...data.keys()].filter((key) =>
        options?.prefix === undefined ? true : key.startsWith(options.prefix),
      )
      // The real storage lists in key order; the registry's history keys are zero-padded so that
      // order is chronological, and `reverse` is how it reads "most recent first".
      keys.sort()
      if (options?.reverse === true) keys.reverse()
      if (options?.limit !== undefined) keys = keys.slice(0, options.limit)
      return new Map(keys.map((key) => [key, data.get(key) as T]))
    },
    delete: async (keys: Array<string>) => {
      let removed = 0
      for (const key of keys) if (data.delete(key)) removed++
      return removed
    },
    getAlarm: async () => alarm,
    setAlarm: async (scheduledTime: number) => {
      alarm = scheduledTime
    },
  }
}

/* ------------------------------------------------------------- the driver -- */

const REPO = 'design4pro/planned.travel'

/**
 * PRD #104 with three sibling slices under it, plus an unrelated #200. This is the real shape from
 * the night the registry was written: #106 and #108 are the two siblings both runs picked.
 */
const TREE = [
  { child: '106', parent: '104' },
  { child: '108', parent: '104' },
  { child: '117', parent: '104' },
]

class Harness {
  readonly storage = createStorage()
  private readonly registry: SandcastleRegistry
  private clock = 1_000_000

  constructor() {
    const state: SandcastleRegistryState = { storage: this.storage }
    this.registry = new SandcastleRegistry(
      state,
      {},
      { now: () => this.clock, logger: silentLogger() },
    )
  }

  advance(ms: number): void {
    this.clock += ms
  }

  get now(): number {
    return this.clock
  }

  private post(path: string, body: unknown): Promise<Response> {
    return this.registry.fetch(
      new Request(`https://sandcastle-registry.internal${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    )
  }

  async register(runId: string): Promise<{ resumed: boolean }> {
    const response = await this.post('/runs/register', {
      runId,
      repo: REPO,
      origin: 'local',
      kind: 'afk-loop',
      host: 'test',
      integrationBranch: `sandcastle/run-${runId}`,
    })
    expect(response.status).toBe(200)
    return response.json()
  }

  async claim(
    runId: string,
    candidates: Array<string>,
    edges = TREE,
  ): Promise<ClaimResult> {
    const response = await this.post(`/runs/${runId}/claim`, {
      candidates,
      edges,
    })
    expect(response.status).toBe(200)
    return response.json()
  }

  /** Status code only, for the paths where the registry is expected to refuse. */
  async claimRaw(runId: string, candidates: Array<string>): Promise<number> {
    const response = await this.post(`/runs/${runId}/claim`, {
      candidates,
      edges: [],
    })
    return response.status
  }

  async heartbeat(runId: string, stage = 'implementing'): Promise<Response> {
    return this.post(`/runs/${runId}/heartbeat`, { stage })
  }

  async wip(
    runId: string,
    issueId: string,
    branch: string,
    commits: number,
  ): Promise<void> {
    const response = await this.post(`/runs/${runId}/wip`, {
      issueId,
      branch,
      commits,
    })
    expect(response.status).toBe(200)
  }

  async release(runId: string, ids?: Array<string>): Promise<void> {
    const response = await this.post(
      `/runs/${runId}/release`,
      ids ? { ids } : {},
    )
    expect(response.status).toBe(200)
  }

  async finish(
    runId: string,
    status: 'finished' | 'failed' = 'finished',
  ): Promise<void> {
    const response = await this.post(`/runs/${runId}/finish`, {
      status,
      summary: '',
    })
    expect(response.status).toBe(200)
  }

  async state(): Promise<RegistryState> {
    const response = await this.registry.fetch(
      new Request('https://sandcastle-registry.internal/state'),
    )
    expect(response.status).toBe(200)
    return response.json()
  }

  alarm(): Promise<void> {
    return this.registry.alarm()
  }
}

/** Keeps the suite's output readable; the registry logs an expiry warning on half these cases. */
function silentLogger(): NonNullable<SandcastleRegistryOptions['logger']> {
  const noop = () => undefined
  const logger = {
    level: 'error',
    context: {},
    enabled: () => false,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => logger,
    time: <T>(_msg: string, fn: () => Promise<T>) => fn(),
  }
  return logger as unknown as NonNullable<SandcastleRegistryOptions['logger']>
}

/* ------------------------------------------------------------------ tests -- */

describe('closureOf', () => {
  const parents = new Map(TREE.map((e) => [e.child, e.parent]))
  const children = new Map([['104', ['106', '108', '117']]])

  it('carries a leaf up to its PRD', () => {
    expect([...closureOf('106', parents, children)].sort()).toEqual([
      '104',
      '106',
    ])
  })

  it('carries a PRD down to every slice', () => {
    expect([...closureOf('104', parents, children)].sort()).toEqual([
      '104',
      '106',
      '108',
      '117',
    ])
  })

  it('does not join siblings to each other', () => {
    expect(closureOf('106', parents, children).has('108')).toBe(false)
  })

  it('terminates on a cycle rather than hanging the whole fleet', () => {
    const cyclic = new Map([
      ['1', '2'],
      ['2', '1'],
    ])
    expect([...closureOf('1', cyclic, new Map())].sort()).toEqual(['1', '2'])
  })
})

describe('claiming', () => {
  let h: Harness

  beforeEach(async () => {
    h = new Harness()
    await h.register('20260829-1')
    await h.register('20260829-2')
  })

  it('grants an uncontested issue', async () => {
    expect(await h.claim('20260829-1', ['106'])).toMatchObject({
      granted: ['106'],
      denied: [],
    })
  })

  it('denies a leaf to a second run once the first holds it', async () => {
    await h.claim('20260829-1', ['106'])

    expect(await h.claim('20260829-2', ['106'])).toMatchObject({
      granted: [],
      denied: [{ id: '106', heldBy: '20260829-1', via: '106' }],
    })
  })

  it('locks every slice when a run takes the PRD', async () => {
    await h.claim('20260829-1', ['104'])

    // The PRD was claimed, the slices were not — but the closure covers them, which is what makes
    // "no other run may enter this PRD" true without having to lease 17 issues one by one.
    expect(await h.claim('20260829-2', ['106', '108', '117'])).toMatchObject({
      granted: [],
      denied: [
        { id: '106', heldBy: '20260829-1', via: '104' },
        { id: '108', heldBy: '20260829-1', via: '104' },
        { id: '117', heldBy: '20260829-1', via: '104' },
      ],
    })
  })

  it('denies the whole PRD while another run holds one slice of it', async () => {
    await h.claim('20260829-1', ['106'])

    expect(await h.claim('20260829-2', ['104'])).toMatchObject({
      granted: [],
      denied: [{ id: '104', heldBy: '20260829-1', via: '106' }],
    })
  })

  it('leaves sibling slices free to run in parallel', async () => {
    await h.claim('20260829-1', ['106'])

    // The decision this design turns on: #106 and #108 have disjoint Owned paths, so a second run
    // may work #108 while the first works #106. A strict whole-subtree lock would refuse here.
    expect(await h.claim('20260829-2', ['108'])).toMatchObject({
      granted: ['108'],
      denied: [],
    })
  })

  it('grants what is free and denies what is not, in one request', async () => {
    await h.claim('20260829-1', ['106'])

    expect(await h.claim('20260829-2', ['106', '108'])).toMatchObject({
      granted: ['108'],
      denied: [{ id: '106', heldBy: '20260829-1' }],
    })
  })

  it('is idempotent for the run that already holds the issue', async () => {
    await h.claim('20260829-1', ['106'])
    expect(await h.claim('20260829-1', ['106'])).toMatchObject({
      granted: ['106'],
    })
  })

  it('refuses a claim from a run that never registered', async () => {
    // Registering is what makes a run heartbeat-able. A lease taken without one would be held by
    // nobody and expired by nothing.
    expect(await h.claimRaw('20260829-9', ['106'])).toBe(409)
  })

  it('treats an unknown issue with no edges as its own closure', async () => {
    await h.claim('20260829-1', ['200'], [])
    expect(await h.claim('20260829-2', ['106'])).toMatchObject({
      granted: ['106'],
    })
  })
})

describe('leases and liveness', () => {
  it('lets another run take the issue once the holder stops heartbeating', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])

    h.advance(SANDCASTLE_LEASE_TTL_MS + 1)

    // Run 1 crashed. Nothing cleaned up after it, and nothing had to.
    await h.register('20260829-2')
    expect(await h.claim('20260829-2', ['106'])).toMatchObject({
      granted: ['106'],
    })
  })

  it('keeps the lease while the holder heartbeats', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])

    h.advance(SANDCASTLE_LEASE_TTL_MS - 1_000)
    expect((await h.heartbeat('20260829-1')).status).toBe(200)
    h.advance(SANDCASTLE_LEASE_TTL_MS - 1_000)

    await h.register('20260829-2')
    expect(await h.claim('20260829-2', ['106'])).toMatchObject({ granted: [] })
  })

  it('tells a lapsed run which issues it lost', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])
    await h.wip('20260829-1', '106', 'sandcastle/issue-106-20260829-1', 2)

    h.advance(SANDCASTLE_LEASE_TTL_MS + 1)
    await h.register('20260829-2')
    await h.claim('20260829-2', ['106'])

    // Run 1 comes back from a stall. It must learn its work was taken — continuing would put two
    // fleets back on one issue, which is the failure this whole object exists to prevent.
    await h.register('20260829-1')
    const beat = await h.heartbeat('20260829-1')
    expect(await beat.json()).toMatchObject({ revoked: ['106'] })
  })

  it('releases only its own leases', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.register('20260829-2')
    await h.claim('20260829-1', ['106'])
    await h.claim('20260829-2', ['108'])

    await h.release('20260829-2')

    const state = await h.state()
    expect(state.active.find((r) => r.runId === '20260829-1')?.issues).toEqual([
      '106',
    ])
    expect(state.active.find((r) => r.runId === '20260829-2')?.issues).toEqual(
      [],
    )
  })

  it('reclaims a resumed run its own leases rather than making it fight for them', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])

    // `pnpm sandcastle --run 1` again, inside the TTL.
    expect(await h.register('20260829-1')).toMatchObject({ resumed: true })
    expect(await h.claim('20260829-1', ['106'])).toMatchObject({
      granted: ['106'],
    })
  })
})

describe('work in progress', () => {
  it('offers an orphaned branch to the next run that claims the issue', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])
    await h.wip('20260829-1', '106', 'sandcastle/issue-106-20260829-1', 3)

    h.advance(SANDCASTLE_LEASE_TTL_MS + 1)

    // The lease died with the run; the three commits did not. Losing them is what happened the
    // night this was written.
    await h.register('20260829-2')
    expect(await h.claim('20260829-2', ['106'])).toMatchObject({
      granted: ['106'],
      adopt: { '106': 'sandcastle/issue-106-20260829-1' },
    })
  })

  it('does not offer a run its own branch back', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])
    await h.wip('20260829-1', '106', 'sandcastle/issue-106-20260829-1', 3)

    expect(await h.claim('20260829-1', ['106'])).toMatchObject({ adopt: {} })
  })

  it('does not offer an empty branch', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['108'])
    await h.wip('20260829-1', '108', 'sandcastle/issue-108-20260829-1', 0)

    h.advance(SANDCASTLE_LEASE_TTL_MS + 1)
    await h.register('20260829-2')
    expect(await h.claim('20260829-2', ['108'])).toMatchObject({ adopt: {} })
  })

  it('marks a branch orphaned once nobody holds its issue', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.claim('20260829-1', ['106'])
    await h.wip('20260829-1', '106', 'sandcastle/issue-106-20260829-1', 3)

    expect((await h.state()).wip[0]).toMatchObject({ orphaned: false })
    await h.release('20260829-1')
    expect((await h.state()).wip[0]).toMatchObject({ orphaned: true })
  })
})

describe('run lifecycle', () => {
  it('moves a finished run into history and frees its issues', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    await h.register('20260829-2')
    await h.claim('20260829-1', ['106'])
    await h.finish('20260829-1')

    const state = await h.state()
    expect(state.active.map((r) => r.runId)).toEqual(['20260829-2'])
    expect(state.recent[0]).toMatchObject({
      runId: '20260829-1',
      status: 'finished',
    })
    expect(await h.claim('20260829-2', ['106'])).toMatchObject({
      granted: ['106'],
    })
  })

  it('records a run that died as expired rather than dropping it', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    h.advance(SANDCASTLE_LEASE_TTL_MS + 1)
    await h.alarm()

    // "Did it finish, or did it die?" is the question the dashboard exists to answer, and a run
    // that simply vanished from the list answers neither.
    const state = await h.state()
    expect(state.active).toEqual([])
    expect(state.recent[0]).toMatchObject({
      runId: '20260829-1',
      status: 'expired',
    })
  })

  it('schedules an alarm while runs are live and not once they are gone', async () => {
    const h = new Harness()
    await h.register('20260829-1')
    expect(h.storage.alarm).not.toBeNull()

    await h.finish('20260829-1')
    const settled = h.storage.alarm
    await h.alarm()
    // Nothing live left to expire: the object is allowed to go idle instead of waking forever.
    expect(h.storage.alarm).toBe(settled)
  })
})
