/**
 * The passkey plugin's HTTP surface, driven through a real in-memory Better Auth instance with
 * real cookies and passkey rows seeded through SQL (docs/ACCESS.md §6.4).
 *
 * The `passkey` table is keyed on the user and has no `organization_id`, so the isolation boundary
 * here is user to user and lives in this file rather than in `tenant-isolation.test.ts`, whose
 * contract is organisation to organisation and could not fail for a table no `TenantScope`
 * reaches.
 *
 * Ticket 09-S1a: list isolation, the per-user ceiling, the impersonation veto and the freshness
 * rule on registration, and the registration rate limits. Tickets b and c append their cases to
 * this file and reuse `./harness`.
 *
 * The mocks are the ones `../../__tests__/auth-handler-closure.test.ts` establishes: `env`
 * imports `cloudflare:workers`, so it is replaced with plain values, the database is an
 * in-memory SQLite behind the Drizzle proxy driver, and the KV is a `Map`.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { MAX_PASSKEYS_PER_USER, passkey } from '../plugin'
import { createAuthHarness, openAuthDatabase } from './harness'
import type { AuthHarness } from './harness'
import type { DatabaseSync } from 'node:sqlite'

const BASE_URL = 'http://localhost:3000'

const shared = vi.hoisted(() => {
  const db: { current: unknown } = { current: null }
  return { db, kv: new Map<string, string>() }
})

vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => BASE_URL,
  appleBundleIdentifier: () => undefined,
  appleCredentials: () => null,
  authSecret: () => 'test-secret-not-used-outside-this-process',
  d1: () => ({}),
  googleCredentials: () => null,
  relyingPartyId: () => 'localhost',
  sessionStore: () => ({
    get: async (key: string, type?: string) => {
      const value = shared.kv.get(key)
      if (value === undefined) return null
      return type === 'json' ? JSON.parse(value) : value
    },
    put: async (key: string, value: string) => {
      shared.kv.set(key, value)
    },
    delete: async (key: string) => {
      shared.kv.delete(key)
    },
  }),
  taskQueue: () => {
    throw new Error('The queue is not exercised by an HTTP-surface test.')
  },
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.db.current,
}))

vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async () => undefined,
}))

const { getAuth } = await import('../../index')

let sqlite: DatabaseSync
let auth: AuthHarness
let aliceId: string
let bobId: string

beforeAll(async () => {
  const opened = await openAuthDatabase()
  sqlite = opened.sqlite
  shared.db.current = opened.database
  auth = createAuthHarness({
    sqlite,
    handler: () => (request) => getAuth().handler(request),
    kv: shared.kv,
  })
  aliceId = await auth.createAccount('alice@planned.travel')
  bobId = await auth.createAccount('bob@planned.travel')
})

afterAll(() => {
  sqlite.close()
})

// Rate-limit counters live in the KV, keyed on address and path. Every test starts with none, and
// with every session read going to the database, which is where the tests edit the session row.
beforeEach(() => {
  shared.kv.clear()
  sqlite.exec('delete from passkey')
  sqlite.exec("delete from verification where identifier like 'passkey-%'")
})

type ErrorBody = { code?: string; message?: string }

const HOUR_MS = 60 * 60 * 1000

/** A registration body that passes the endpoint's Zod schema without being a real attestation. */
function dummyCredential(challenge = 'dummy') {
  return {
    credential: {
      id: 'credential',
      rawId: 'credential',
      type: 'public-key',
      response: {
        clientDataJSON: Buffer.from(JSON.stringify({ challenge })).toString(
          'base64url',
        ),
        attestationObject: 'attestation',
      },
    },
  }
}

function seed(userId: string, count: number, prefix = 'seed'): void {
  auth.seedPasskeys(
    userId,
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-${userId}-${index}`,
    })),
  )
}

describe('GET /passkey/list', () => {
  it("returns only the caller's passkeys and never a public key", async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Work phone' }])
    auth.seedPasskeys(bobId, [{ id: 'bob-1' }, { id: 'bob-2' }])

    const cookie = await auth.signIn('alice@planned.travel')
    const response = await auth.get('/passkey/list', { cookie })
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      passkeys: Array<{ id: string }>
    }
    expect(body.passkeys.map((entry) => entry.id)).toEqual(['alice-1'])
    expect(JSON.stringify(body)).not.toContain('public-key')
    expect(body.passkeys[0]).not.toHaveProperty('publicKey')
  })

  it('answers 401 without a session', async () => {
    const response = await auth.get('/passkey/list')
    expect(response.status).toBe(401)
  })
})

describe('the per-user ceiling', () => {
  it('lets register/options through one below the ceiling (positive control)', async () => {
    seed(aliceId, MAX_PASSKEYS_PER_USER - 1)
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await auth.post(
      '/passkey/register/options',
      {},
      { cookie },
    )
    expect(response.status).toBe(200)
    expect(auth.challengeCount()).toBe(1)
  })

  it('refuses register/options at the ceiling and writes no challenge row', async () => {
    seed(aliceId, MAX_PASSKEYS_PER_USER)
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await auth.post(
      '/passkey/register/options',
      {},
      { cookie },
    )
    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).code).toBe(
      'PASSKEY_LIMIT_REACHED',
    )
    expect(auth.challengeCount()).toBe(0)
    expect(auth.passkeyCount(aliceId)).toBe(MAX_PASSKEYS_PER_USER)
  })

  it('refuses register/verify at the ceiling before the challenge is consumed', async () => {
    seed(aliceId, MAX_PASSKEYS_PER_USER - 1)
    const cookie = await auth.signIn('alice@planned.travel')
    const options = await auth.post('/passkey/register/options', {}, { cookie })
    const { challenge } = (await options.json()) as { challenge: string }
    expect(auth.challengeCount()).toBe(1)

    // A twentieth passkey lands between the options call and the verify call.
    seed(aliceId, 1, 'late')

    const response = await auth.post(
      '/passkey/register/verify',
      dummyCredential(challenge),
      { cookie },
    )
    expect(response.status).toBe(400)
    expect(((await response.json()) as ErrorBody).code).toBe(
      'PASSKEY_LIMIT_REACHED',
    )
    // Refused before `consumeCeremony`: the challenge is still there, and no row was added.
    expect(auth.challengeCount()).toBe(1)
    expect(auth.passkeyCount(aliceId)).toBe(MAX_PASSKEYS_PER_USER)
  })

  it('counts the ceiling per user, not per table', async () => {
    seed(bobId, MAX_PASSKEYS_PER_USER)
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await auth.post(
      '/passkey/register/options',
      {},
      { cookie },
    )
    expect(response.status).toBe(200)
  })

  // Known property, not asserted away: the count and the write are two statements, so two
  // ceremonies started at 19 can both finish and leave 21. The ceiling bounds storage; it is not a
  // quota anyone sells (spec: Ceiling).
})

describe('an impersonated session cannot register a passkey', () => {
  it.each([
    ['an operator id', 'usr_operator'],
    ['an empty string', ''],
  ])(
    'refuses both endpoints when impersonatedBy is %s',
    async (_label, marker) => {
      const cookie = await auth.signIn('alice@planned.travel')
      auth.editSession(aliceId, 'impersonated_by', marker)

      const options = await auth.post(
        '/passkey/register/options',
        {},
        { cookie },
      )
      expect(options.status).toBe(403)
      expect(((await options.json()) as ErrorBody).code).toBe(
        'PASSKEY_IMPERSONATED',
      )

      const verify = await auth.post(
        '/passkey/register/verify',
        dummyCredential(),
        { cookie },
      )
      expect(verify.status).toBe(403)
      expect(((await verify.json()) as ErrorBody).code).toBe(
        'PASSKEY_IMPERSONATED',
      )

      expect(auth.challengeCount()).toBe(0)
      expect(auth.passkeyCount(aliceId)).toBe(0)
    },
  )
})

describe('registration needs a fresh session, for every account', () => {
  it('lets a fresh session through (positive control)', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    const response = await auth.post(
      '/passkey/register/options',
      {},
      { cookie },
    )
    expect(response.status).toBe(200)
  })

  it('refuses a session older than the freshness window on both endpoints', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    auth.editSession(aliceId, 'created_at', Date.now() - 25 * HOUR_MS)

    const options = await auth.post('/passkey/register/options', {}, { cookie })
    expect(options.status).toBe(400)
    expect(((await options.json()) as ErrorBody).code).toBe(
      'PASSKEY_SESSION_NOT_FRESH',
    )

    const verify = await auth.post(
      '/passkey/register/verify',
      dummyCredential(),
      { cookie },
    )
    expect(verify.status).toBe(400)
    expect(((await verify.json()) as ErrorBody).code).toBe(
      'PASSKEY_SESSION_NOT_FRESH',
    )
    expect(auth.challengeCount()).toBe(0)
  })

  it('refuses, rather than lets through, a session whose creation time cannot be read', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    auth.editSession(aliceId, 'created_at', 'not a date')

    const options = await auth.post('/passkey/register/options', {}, { cookie })
    expect(options.status).not.toBe(200)
    expect(auth.challengeCount()).toBe(0)
  })

  it('refuses a stale session whether or not the account has a password', async () => {
    // Carol's credential row has its password taken away after she signs in, which leaves a
    // stale session on a passwordless account: it must meet the same refusal as Alice's.
    const carolId = await auth.createAccount('carol@planned.travel')
    const cookie = await auth.signIn('carol@planned.travel')
    sqlite
      .prepare('update account set password = null where user_id = ?')
      .run(carolId)
    auth.editSession(carolId, 'created_at', Date.now() - 25 * HOUR_MS)

    const options = await auth.post('/passkey/register/options', {}, { cookie })
    expect(((await options.json()) as ErrorBody).code).toBe(
      'PASSKEY_SESSION_NOT_FRESH',
    )
  })
})

describe('register/verify keeps the challenge bound to its owner', () => {
  it("refuses a challenge that belongs to another user's ceremony", async () => {
    const aliceCookie = await auth.signIn('alice@planned.travel')
    const options = await auth.post(
      '/passkey/register/options',
      {},
      { cookie: aliceCookie },
    )
    const { challenge } = (await options.json()) as { challenge: string }

    const bobCookie = await auth.signIn('bob@planned.travel')
    const response = await auth.post(
      '/passkey/register/verify',
      dummyCredential(challenge),
      { cookie: bobCookie },
    )
    expect(response.status).toBe(400)
    expect(auth.passkeyCount(bobId)).toBe(0)
    expect(auth.passkeyCount(aliceId)).toBe(0)
  })
})

describe('the registration rate limits', () => {
  const rules = passkey({
    relyingPartyId: 'localhost',
    relyingPartyName: 'planned.travel',
    origins: [BASE_URL],
  }).rateLimit

  it.each(['/passkey/register/options', '/passkey/register/verify'])(
    'carries a rule of 10 per 300 s for %s',
    (path) => {
      const rule = rules?.find((entry) => entry.pathMatcher(path))
      expect(rule).toMatchObject({ window: 300, max: 10 })
    },
  )

  it('matches no other path', () => {
    for (const path of ['/passkey/list', '/passkey/authenticate/verify']) {
      expect(rules?.some((entry) => entry.pathMatcher(path))).toBe(false)
    }
  })

  /**
   * The shape Cloudflare delivers: `cf-connecting-ip` carries the client, and
   * `x-forwarded-for` is the client's own value with the client appended, so a visitor who sends
   * the header yields two values (`@better-auth/core` resolves a multi-value header to no address).
   */
  function behindCloudflare(address: string, spoofed = '198.51.100.7') {
    return {
      'cf-connecting-ip': address,
      'x-forwarded-for': `${spoofed}, ${address}`,
    }
  }

  async function register(cookie: string, headers: Record<string, string>) {
    return auth.post('/passkey/register/options', {}, { cookie, headers })
  }

  it('answers 429 past the maximum, over HTTP', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    const headers = behindCloudflare('203.0.113.10')

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await register(cookie, headers)).status).toBe(200)
    }
    expect((await register(cookie, headers)).status).toBe(429)
  })

  it('tells two clients apart, and a spoofed forwarded address does not help one of them', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    const first = '203.0.113.10'
    const second = '203.0.113.20'

    for (let attempt = 0; attempt < 10; attempt += 1) {
      // A new spoofed value each time: the bucket must not follow it.
      const response = await register(
        cookie,
        behindCloudflare(first, `198.51.100.${attempt}`),
      )
      expect(response.status).toBe(200)
    }
    expect((await register(cookie, behindCloudflare(first))).status).toBe(429)

    // Another client is untouched by the first one's budget.
    expect((await register(cookie, behindCloudflare(second))).status).toBe(200)
  })
})
