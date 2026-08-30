import { describe, expect, it } from 'vitest'

import { serveSandcastleCoordinator } from '../-lib/coordinator'
import { SANDCASTLE_COORDINATOR_REPO } from '#/server/do'

import type { SandcastleCoordinatorBindings } from '../-lib/coordinator'
import type { SandcastleRegistryNamespace } from '#/server/do'

const TOKEN = 'a-shared-secret-of-some-length'

interface Seen {
  url: string
  method: string
  body: string
}

/**
 * A namespace that records what reached it and answers 200. The registry's own behaviour is pinned
 * by `src/server/do/__tests__/sandcastle-registry.test.ts`; what matters here is whether a request
 * gets that far at all, and which object and path it is aimed at.
 */
function fakeNamespace(seen: Array<Seen>): SandcastleRegistryNamespace {
  return {
    idFromName: (name) => ({ name }) as unknown as DurableObjectId,
    get: (id) => ({
      fetch: async (request: Request) => {
        seen.push({
          url: request.url,
          method: request.method,
          // The shard key is not in the URL, so it is recorded through the id the stub came from.
          body: `${(id as unknown as { name: string }).name}|${await request.text()}`,
        })
        return new Response('{"ok":true}', { status: 200 })
      },
    }),
  }
}

function bindings(
  seen: Array<Seen> = [],
  overrides: Partial<SandcastleCoordinatorBindings> = {},
): SandcastleCoordinatorBindings {
  return {
    SANDCASTLE_REGISTRY: fakeNamespace(seen),
    SANDCASTLE_COORDINATOR_TOKEN: TOKEN,
    ...overrides,
  }
}

function post(path: string, body: unknown, token: string | null = TOKEN) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== null) headers.authorization = `Bearer ${token}`
  return new Request(`https://staging.planned.travel/api/sandcastle/${path}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function get(path: string, token: string | null = TOKEN) {
  const headers: Record<string, string> = {}
  if (token !== null) headers.authorization = `Bearer ${token}`
  return new Request(`https://staging.planned.travel/api/sandcastle/${path}`, {
    headers,
  })
}

const REGISTER = {
  runId: '20260830-1',
  repo: SANDCASTLE_COORDINATOR_REPO,
  origin: 'local',
  kind: 'afk-loop',
  host: 'laptop',
  integrationBranch: null,
}

describe('the coordinator gate', () => {
  it('refuses every route on a deployment with no registry bound', async () => {
    // Production and local dev. The absence of the binding *is* the statement that this deployment
    // is not the coordinator, so it must not depend on the token being absent as well.
    const response = await serveSandcastleCoordinator(
      { SANDCASTLE_COORDINATOR_TOKEN: TOKEN },
      post('runs/register', REGISTER),
      'runs/register',
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('not the sandcastle coordinator'),
    })
  })

  it('refuses when the registry is bound but no token is configured', async () => {
    // Fail closed rather than open: an unset secret must not become "no token required".
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen, { SANDCASTLE_COORDINATOR_TOKEN: undefined }),
      post('runs/register', REGISTER),
      'runs/register',
    )

    expect(response.status).toBe(503)
    expect(seen).toEqual([])
  })

  it('refuses an empty configured token rather than accepting an empty header', async () => {
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen, { SANDCASTLE_COORDINATOR_TOKEN: '' }),
      post('runs/register', REGISTER, ''),
      'runs/register',
    )

    expect(response.status).toBe(503)
    expect(seen).toEqual([])
  })

  it('answers 401 with no bearer token and 403 with the wrong one', async () => {
    const seen: Array<Seen> = []

    const anonymous = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/register', REGISTER, null),
      'runs/register',
    )
    expect(anonymous.status).toBe(401)

    const wrong = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/register', REGISTER, 'not-the-token'),
      'runs/register',
    )
    expect(wrong.status).toBe(403)

    // Neither reached the registry.
    expect(seen).toEqual([])
  })

  it('rejects a token that is a prefix of the real one', async () => {
    // The comparison hashes both sides, so a short guess cannot be told from a wrong one by
    // length. This pins that it is refused at all.
    const response = await serveSandcastleCoordinator(
      bindings(),
      post('runs/register', REGISTER, TOKEN.slice(0, 10)),
      'runs/register',
    )

    expect(response.status).toBe(403)
  })
})

describe('routing', () => {
  it('forwards a register to the repository object', async () => {
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/register', REGISTER),
      'runs/register',
    )

    expect(response.status).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toContain('/runs/register')
    expect(seen[0].body).toContain(SANDCASTLE_COORDINATOR_REPO)
  })

  it('carries the run id in the path for every per-run verb', async () => {
    const seen: Array<Seen> = []
    const cases: Array<[string, unknown]> = [
      ['claim', { candidates: ['104'], edges: [] }],
      ['heartbeat', { stage: 'implementing' }],
      ['wip', { issueId: '106', branch: 'sandcastle/issue-106', commits: 3 }],
      ['release', { ids: ['106'] }],
      ['finish', { status: 'finished', summary: '' }],
    ]

    for (const [verb, body] of cases) {
      const response = await serveSandcastleCoordinator(
        bindings(seen),
        post(`runs/20260830-1/${verb}`, body),
        `runs/20260830-1/${verb}`,
      )
      expect(response.status).toBe(200)
    }

    expect(seen.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/runs/20260830-1/claim',
      '/runs/20260830-1/heartbeat',
      '/runs/20260830-1/wip',
      '/runs/20260830-1/release',
      '/runs/20260830-1/finish',
    ])
  })

  it('shards every request onto the one object named for the repository', async () => {
    // The whole guarantee rests on this: one object per repo means one thread decides every claim.
    const seen: Array<Seen> = []
    await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/register', REGISTER),
      'runs/register',
    )
    await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/20260830-2/claim', { candidates: ['106'], edges: [] }),
      'runs/20260830-2/claim',
    )

    expect(
      seen.every((entry) =>
        entry.body.startsWith(`${SANDCASTLE_COORDINATOR_REPO}|`),
      ),
    ).toBe(true)
  })

  it('reads the dashboard state over GET', async () => {
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen),
      get('state'),
      'state',
    )

    expect(response.status).toBe(200)
    expect(new URL(seen[0].url).pathname).toBe('/state')
    expect(seen[0].method).toBe('GET')
  })

  it('answers 404 for an unknown verb, an unknown shape and a GET at a POST path', async () => {
    const seen: Array<Seen> = []
    const paths: Array<[string, Request]> = [
      ['runs/20260830-1/steal', post('runs/20260830-1/steal', {})],
      ['runs', post('runs', {})],
      ['runs/20260830-1', post('runs/20260830-1', {})],
      ['jobs/20260830-1/claim', post('jobs/20260830-1/claim', {})],
      ['runs/20260830-1/claim', get('runs/20260830-1/claim')],
      ['', post('', {})],
    ]

    for (const [splat, request] of paths) {
      const response = await serveSandcastleCoordinator(
        bindings(seen),
        request,
        splat,
      )
      expect(response.status, splat).toBe(404)
    }

    expect(seen).toEqual([])
  })
})

describe('body validation', () => {
  it('answers 400 for a body that is not JSON', async () => {
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/20260830-1/claim', 'not json at all'),
      'runs/20260830-1/claim',
    )

    expect(response.status).toBe(400)
    expect(seen).toEqual([])
  })

  it('answers 400, with the issues, for a body that fails the schema', async () => {
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/20260830-1/claim', { candidates: ['not-a-number'] }),
      'runs/20260830-1/claim',
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Body failed validation.',
      issues: expect.any(Array),
    })
    expect(seen).toEqual([])
  })

  it('refuses a register for another repository', async () => {
    // One coordinator, one backlog. Accepting a foreign repo would silently file its runs under
    // this one's object and let them contend with issues they have nothing to do with.
    const seen: Array<Seen> = []
    const response = await serveSandcastleCoordinator(
      bindings(seen),
      post('runs/register', { ...REGISTER, repo: 'someone/else' }),
      'runs/register',
    )

    expect(response.status).toBe(400)
    expect(seen).toEqual([])
  })
})
