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
 * rule on registration, and the registration rate limits. Ticket 09-S1b: rename (ownership, the
 * strict body, the impersonation veto, its rate limit). Ticket 09-S1c: the password hint on the list
 * and delete (the identity proof, decided on the server; ownership; the impersonation veto; its rate
 * limit).
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
import { createAuthenticator } from './authenticator'
import type { TransactionalEmailMessage } from '../../email'
import type * as AuthEmailModule from '../../email'
import { MAX_PASSKEYS_PER_USER, passkey } from '../plugin'
import { PASSWORD, createAuthHarness, openAuthDatabase } from './harness'
import type { AuthHarness } from './harness'
import type { DatabaseSync } from 'node:sqlite'

const BASE_URL = 'http://localhost:3000'

const shared = vi.hoisted(() => {
  const db: { current: unknown } = { current: null }
  return {
    db,
    kv: new Map<string, string>(),
    email: vi.fn<(message: TransactionalEmailMessage) => void>(),
    queue: vi.fn(async (_body: unknown) => undefined),
  }
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
  taskQueue: () => ({ send: shared.queue }),
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.db.current,
}))

vi.mock('#/server/auth/email', async (importOriginal) => {
  const original = await importOriginal<typeof AuthEmailModule>()
  return {
    ...original,
    queueAuthEmail: async (message: TransactionalEmailMessage) => {
      shared.email(message)
      await original.queueAuthEmail(message)
    },
  }
})

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
  shared.email.mockClear()
  shared.queue.mockReset()
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

describe('POST /passkey/rename', () => {
  function rename(cookie: string | undefined, body: unknown) {
    return auth.post('/passkey/rename', body, { cookie })
  }

  it('renames the callers own passkey, trimmed, and returns it without a public key', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await rename(cookie, {
      id: 'alice-1',
      name: '  Work phone ',
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      passkey: { id: string; name: string }
    }
    expect(body.passkey).toMatchObject({ id: 'alice-1', name: 'Work phone' })
    expect(body.passkey).not.toHaveProperty('publicKey')
    expect(auth.passkeyName('alice-1')).toBe('Work phone')
  })

  it('renames a passkey that already has a name', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Old' }])
    const cookie = await auth.signIn('alice@planned.travel')

    expect((await rename(cookie, { id: 'alice-1', name: 'New' })).status).toBe(
      200,
    )
    expect(auth.passkeyName('alice-1')).toBe('New')
  })

  it('answers not-found, never forbidden, for another persons passkey and leaves its name alone', async () => {
    auth.seedPasskeys(bobId, [{ id: 'bob-1', name: 'Bobs key' }])
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await rename(cookie, { id: 'bob-1', name: 'Mine now' })

    expect(response.status).toBe(404)
    expect(((await response.json()) as ErrorBody).code).toBe(
      'PASSKEY_NOT_FOUND',
    )
    expect(auth.passkeyName('bob-1')).toBe('Bobs key')
  })

  it('answers the same not-found for an id that does not exist', async () => {
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await rename(cookie, { id: 'nobody', name: 'x' })

    expect(response.status).toBe(404)
    expect(((await response.json()) as ErrorBody).code).toBe(
      'PASSKEY_NOT_FOUND',
    )
  })

  it.each([
    ['an empty name', ''],
    ['a blank name', '   '],
    ['a 65-character name', 'a'.repeat(65)],
  ])('refuses %s and keeps the stored name', async (_label, name) => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Kept' }])
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await rename(cookie, { id: 'alice-1', name })

    expect(response.status).toBe(400)
    expect(auth.passkeyName('alice-1')).toBe('Kept')
  })

  it('accepts a 64-character name (positive control for the bound)', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
    const cookie = await auth.signIn('alice@planned.travel')

    const name = 'a'.repeat(64)
    expect((await rename(cookie, { id: 'alice-1', name })).status).toBe(200)
    expect(auth.passkeyName('alice-1')).toBe(name)
  })

  it('refuses a field the body does not declare, and writes nothing', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Kept' }])
    const cookie = await auth.signIn('alice@planned.travel')

    const response = await rename(cookie, {
      id: 'alice-1',
      name: 'New',
      userId: bobId,
    })

    expect(response.status).toBe(400)
    expect(auth.passkeyName('alice-1')).toBe('Kept')
  })

  it('answers 401 without a session', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Kept' }])

    const response = await rename(undefined, { id: 'alice-1', name: 'New' })

    expect(response.status).toBe(401)
    expect(auth.passkeyName('alice-1')).toBe('Kept')
  })

  it.each([
    ['an operator id', 'usr_operator'],
    ['an empty string', ''],
  ])(
    'refuses an impersonated session when impersonatedBy is %s, and writes nothing',
    async (_label, marker) => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1', name: 'Kept' }])
      const cookie = await auth.signIn('alice@planned.travel')
      auth.editSession(aliceId, 'impersonated_by', marker)

      const response = await rename(cookie, { id: 'alice-1', name: 'New' })

      expect(response.status).toBe(403)
      expect(((await response.json()) as ErrorBody).code).toBe(
        'PASSKEY_IMPERSONATED',
      )
      expect(auth.passkeyName('alice-1')).toBe('Kept')
    },
  )

  it('is not held back by the freshness rule, which belongs to registration', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
    const cookie = await auth.signIn('alice@planned.travel')
    auth.editSession(aliceId, 'created_at', Date.now() - 25 * HOUR_MS)

    expect(
      (await rename(cookie, { id: 'alice-1', name: 'Old session' })).status,
    ).toBe(200)
  })
})

describe('the rename rate limit', () => {
  const rules = passkey({
    relyingPartyId: 'localhost',
    relyingPartyName: 'planned.travel',
    origins: [BASE_URL],
  }).rateLimit

  it('carries a rule of 5 per 300 s for /passkey/rename', () => {
    const rule = rules?.find((entry) => entry.pathMatcher('/passkey/rename'))
    expect(rule).toMatchObject({ window: 300, max: 5 })
  })

  it('answers 429 past the maximum, over HTTP', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
    const cookie = await auth.signIn('alice@planned.travel')
    const headers = {
      'cf-connecting-ip': '203.0.113.30',
      'x-forwarded-for': '198.51.100.7, 203.0.113.30',
    }
    const rename = (name: string) =>
      auth.post('/passkey/rename', { id: 'alice-1', name }, { cookie, headers })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await rename(`name ${attempt}`)).status).toBe(200)
    }
    expect((await rename('one too many')).status).toBe(429)
    expect(auth.passkeyName('alice-1')).toBe('name 4')
  })
})

/** A new account per case: these tests change the account row itself, which `alice` must keep. */
let accountSerial = 0
async function freshAccount(): Promise<{ email: string; userId: string }> {
  accountSerial += 1
  const email = `remover-${accountSerial}@planned.travel`
  return { email, userId: await auth.createAccount(email) }
}

describe('GET /passkey/list password hint', () => {
  async function hint(email: string): Promise<unknown> {
    const cookie = await auth.signIn(email)
    const response = await auth.get('/passkey/list', { cookie })
    expect(response.status).toBe(200)
    return ((await response.json()) as { requiresPassword?: unknown })
      .requiresPassword
  }

  it('is true for an account with a password', async () => {
    expect(await hint('alice@planned.travel')).toBe(true)
  })

  it('is false for an account with no credential row (social-only)', async () => {
    const { email, userId } = await freshAccount()
    const cookie = await auth.signIn(email)
    auth.removeCredentialAccount(userId)

    const response = await auth.get('/passkey/list', { cookie })
    expect(
      ((await response.json()) as { requiresPassword: boolean })
        .requiresPassword,
    ).toBe(false)
  })

  it('is false for a credential row with a null password', async () => {
    const { email, userId } = await freshAccount()
    const cookie = await auth.signIn(email)
    auth.clearPassword(userId)

    const response = await auth.get('/passkey/list', { cookie })
    expect(
      ((await response.json()) as { requiresPassword: boolean })
        .requiresPassword,
    ).toBe(false)
  })
})

describe('POST /passkey/delete', () => {
  function remove(
    cookie: string | undefined,
    body: unknown,
    headers?: Record<string, string>,
  ) {
    return auth.post('/passkey/delete', body, { cookie, headers })
  }

  async function code(response: Response): Promise<string | undefined> {
    return ((await response.json()) as ErrorBody).code
  }

  describe('on an account with a password', () => {
    it('deletes with the right password', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }, { id: 'alice-2' }])
      const cookie = await auth.signIn('alice@planned.travel')

      const response = await remove(cookie, {
        id: 'alice-1',
        password: PASSWORD,
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ deleted: true })
      expect(auth.passkeyName('alice-1')).toBeUndefined()
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })

    it('refuses a missing password with its own code and keeps the row', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')

      const response = await remove(cookie, { id: 'alice-1' })

      expect(response.status).toBe(400)
      expect(await code(response)).toBe('PASSKEY_PASSWORD_REQUIRED')
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })

    it('refuses a wrong password with its own code and keeps the row', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')

      const response = await remove(cookie, {
        id: 'alice-1',
        password: 'not-the-password',
      })

      expect(response.status).toBe(400)
      expect(await code(response)).toBe('PASSKEY_INVALID_PASSWORD')
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })

    it('does not accept session age in place of the password', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')

      // A brand-new session is fresh, and still must not delete without the password.
      expect((await remove(cookie, { id: 'alice-1' })).status).toBe(400)
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })

    it('does not need a fresh session when the password is right', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')
      auth.editSession(aliceId, 'created_at', Date.now() - 25 * HOUR_MS)

      expect(
        (await remove(cookie, { id: 'alice-1', password: PASSWORD })).status,
      ).toBe(200)
    })

    it('refuses an empty password at validation, before the handler reads it', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')

      expect(
        (await remove(cookie, { id: 'alice-1', password: '' })).status,
      ).toBe(400)
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })
  })

  describe.each([
    ['a social-only account', 'removeCredentialAccount'],
    ['a credential row with a null password', 'clearPassword'],
  ] as const)('on %s', (_label, strip) => {
    async function passwordless() {
      const { email, userId } = await freshAccount()
      const cookie = await auth.signIn(email)
      auth[strip](userId)
      auth.seedPasskeys(userId, [{ id: `${userId}-key` }])
      return { cookie, userId, id: `${userId}-key` }
    }

    it('agrees with the list hint, and a fresh session deletes without a password', async () => {
      const { cookie, userId, id } = await passwordless()

      const list = await auth.get('/passkey/list', { cookie })
      expect(
        ((await list.json()) as { requiresPassword: boolean }).requiresPassword,
      ).toBe(false)

      const response = await remove(cookie, { id })
      expect(response.status).toBe(200)
      expect(auth.passkeyCount(userId)).toBe(0)
    })

    it('ignores a password in the body and decides by session age', async () => {
      const { cookie, userId, id } = await passwordless()
      auth.editSession(userId, 'created_at', Date.now() - 25 * HOUR_MS)

      const response = await remove(cookie, { id, password: PASSWORD })

      expect(response.status).toBe(400)
      expect(await code(response)).toBe('PASSKEY_SESSION_NOT_FRESH')
      expect(auth.passkeyCount(userId)).toBe(1)
    })

    it('refuses a session older than the freshness window and keeps the row', async () => {
      const { cookie, userId, id } = await passwordless()
      auth.editSession(userId, 'created_at', Date.now() - 25 * HOUR_MS)

      const response = await remove(cookie, { id })

      expect(response.status).toBe(400)
      expect(await code(response)).toBe('PASSKEY_SESSION_NOT_FRESH')
      expect(auth.passkeyCount(userId)).toBe(1)
    })

    it('still lets a session just inside the window delete (positive control)', async () => {
      const { cookie, userId, id } = await passwordless()
      auth.editSession(userId, 'created_at', Date.now() - 23 * HOUR_MS)

      expect((await remove(cookie, { id })).status).toBe(200)
      expect(auth.passkeyCount(userId)).toBe(0)
    })

    it('refuses a session whose creation time cannot be read, rather than letting it through', async () => {
      const { cookie, userId, id } = await passwordless()
      auth.editSession(userId, 'created_at', 'not a date')

      const response = await remove(cookie, { id })

      expect(response.status).not.toBe(200)
      expect(auth.passkeyCount(userId)).toBe(1)
    })
  })

  describe('ownership', () => {
    it.each([
      ['with the right password', { password: PASSWORD }],
      ['with no password', {}],
      ['with a wrong password', { password: 'nope' }],
    ])(
      "answers not-found for another person's id %s, and leaves their row byte-identical",
      async (_label, extra) => {
        auth.seedPasskeys(bobId, [{ id: 'bob-1', name: 'Bobs key' }])
        const before = auth.passkeyRow('bob-1')
        const cookie = await auth.signIn('alice@planned.travel')

        const response = await remove(cookie, { id: 'bob-1', ...extra })

        expect(response.status).toBe(404)
        expect(await code(response)).toBe('PASSKEY_NOT_FOUND')
        expect(auth.passkeyRow('bob-1')).toEqual(before)
      },
    )

    it('answers the same not-found for an id that does not exist', async () => {
      const cookie = await auth.signIn('alice@planned.travel')

      const response = await remove(cookie, { id: 'nobody' })

      expect(response.status).toBe(404)
      expect(await code(response)).toBe('PASSKEY_NOT_FOUND')
    })

    it('answers not-found to a passwordless account for another persons id, whatever its session age', async () => {
      const { email, userId } = await freshAccount()
      const cookie = await auth.signIn(email)
      auth.removeCredentialAccount(userId)
      auth.editSession(userId, 'created_at', Date.now() - 25 * HOUR_MS)
      auth.seedPasskeys(bobId, [{ id: 'bob-1' }])
      const before = auth.passkeyRow('bob-1')

      const response = await remove(cookie, { id: 'bob-1' })

      expect(response.status).toBe(404)
      expect(auth.passkeyRow('bob-1')).toEqual(before)
    })
  })

  describe('the body', () => {
    it('refuses a field it does not declare, and deletes nothing', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')

      const response = await remove(cookie, {
        id: 'alice-1',
        password: PASSWORD,
        userId: bobId,
      })

      expect(response.status).toBe(400)
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })

    it('answers 401 without a session', async () => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])

      const response = await remove(undefined, {
        id: 'alice-1',
        password: PASSWORD,
      })

      expect(response.status).toBe(401)
      expect(auth.passkeyCount(aliceId)).toBe(1)
    })
  })

  it.each([
    ['an operator id', 'usr_operator'],
    ['an empty string', ''],
  ])(
    'refuses an impersonated session when impersonatedBy is %s, even with the right password, and keeps the row',
    async (_label, marker) => {
      auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
      const cookie = await auth.signIn('alice@planned.travel')
      auth.editSession(aliceId, 'impersonated_by', marker)

      const response = await remove(cookie, {
        id: 'alice-1',
        password: PASSWORD,
      })

      expect(response.status).toBe(403)
      expect(await code(response)).toBe('PASSKEY_IMPERSONATED')
      expect(auth.passkeyCount(aliceId)).toBe(1)
    },
  )

  it('refuses an impersonated session on a passwordless account too, where it would be fresh', async () => {
    const { email, userId } = await freshAccount()
    const cookie = await auth.signIn(email)
    auth.removeCredentialAccount(userId)
    auth.seedPasskeys(userId, [{ id: 'victim-1' }])
    auth.editSession(userId, 'impersonated_by', 'usr_operator')

    const response = await remove(cookie, { id: 'victim-1' })

    expect(response.status).toBe(403)
    expect(auth.passkeyCount(userId)).toBe(1)
  })
})

describe('the delete rate limit', () => {
  const rules = passkey({
    relyingPartyId: 'localhost',
    relyingPartyName: 'planned.travel',
    origins: [BASE_URL],
  }).rateLimit

  it('carries a rule of 5 per 300 s for /passkey/delete', () => {
    const rule = rules?.find((entry) => entry.pathMatcher('/passkey/delete'))
    expect(rule).toMatchObject({ window: 300, max: 5 })
  })

  it('answers 429 past the maximum, over HTTP, and the refused call deletes nothing', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-1' }])
    const cookie = await auth.signIn('alice@planned.travel')
    const headers = {
      'cf-connecting-ip': '203.0.113.40',
      'x-forwarded-for': '198.51.100.7, 203.0.113.40',
    }
    const attempt = (password: string) =>
      auth.post(
        '/passkey/delete',
        { id: 'alice-1', password },
        { cookie, headers },
      )

    for (let tries = 0; tries < 5; tries += 1) {
      expect((await attempt('wrong')).status).toBe(400)
    }
    // The right password past the budget is still refused: the limiter runs before the handler.
    expect((await attempt(PASSWORD)).status).toBe(429)
    expect(auth.passkeyCount(aliceId)).toBe(1)
  })
})

describe('passkey owner notices', () => {
  it('notifies only the owner after an actual removal, never a repeated request', async () => {
    auth.seedPasskeys(aliceId, [{ id: 'alice-notice' }])
    auth.seedPasskeys(bobId, [{ id: 'bob-notice' }])
    const cookie = await auth.signIn('alice@planned.travel')
    shared.email.mockClear()
    const body = { id: 'alice-notice', password: PASSWORD }
    const removed = await auth.post('/passkey/delete', body, { cookie })
    expect(removed.status).toBe(200)
    expect(shared.email).toHaveBeenCalledExactlyOnceWith({
      kind: 'auth.passkey-removed',
      to: 'alice@planned.travel',
      eventId: expect.any(String),
    })
    const repeated = await auth.post('/passkey/delete', body, { cookie })
    expect(repeated.status).toBe(404)
    expect(shared.email).toHaveBeenCalledTimes(1)
    expect(auth.passkeyCount(bobId)).toBe(1)
  })
})

describe('passkey security notice delivery', () => {
  async function register(cookie: string) {
    const device = await createAuthenticator()
    const options = await auth.post('/passkey/register/options', {}, { cookie })
    expect(options.status).toBe(200)
    const { challenge } = (await options.json()) as { challenge: string }
    const body = device.registration(challenge)
    const response = await auth.post('/passkey/register/verify', body, {
      cookie,
    })
    return { device, body, response }
  }

  it('queues one owner-only notice per registration, with distinct event identities and no credential data', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    shared.email.mockClear()
    shared.queue.mockClear()
    const first = await register(cookie)
    expect(first.response.status).toBe(200)
    const second = await register(cookie)
    expect(second.response.status).toBe(200)
    const notices = shared.email.mock.calls.map(([message]) => message)
    expect(notices).toHaveLength(2)
    expect(notices[0]).toEqual({
      kind: 'auth.passkey-added',
      to: 'alice@planned.travel',
      eventId: expect.any(String),
    })
    expect(notices[1]).toEqual({ ...notices[0], eventId: expect.any(String) })
    expect(notices[0]).not.toEqual(notices[1])
    const replay = await auth.post('/passkey/register/verify', first.body, {
      cookie,
    })
    expect(replay.status).toBe(400)
    expect(shared.email).toHaveBeenCalledTimes(2)
    expect(shared.queue).toHaveBeenCalledTimes(2)
    expect(shared.queue.mock.calls.map(([body]) => body)).toEqual(
      notices.map((message) =>
        expect.objectContaining({
          kind: 'email',
          orgId: 'system',
          payload: expect.objectContaining({
            to: ['alice@planned.travel'],
            eventId: 'eventId' in message ? message.eventId : undefined,
          }),
        }),
      ),
    )
    const serialized = JSON.stringify(shared.queue.mock.calls)
    expect(serialized).not.toContain(first.body.credential.id)
    expect(serialized).not.toContain('publicKey')
    expect(serialized).not.toContain('bob@planned.travel')
    expect(serialized).toContain('/passkeys')
    expect(serialized).toContain('A password reset does not remove passkeys.')
  })

  it.each(['add', 'remove'])(
    'preserves a committed %s when enqueue fails and logs no provider diagnostics',
    async (operation) => {
      const cookie = await auth.signIn('alice@planned.travel')
      shared.queue.mockRejectedValueOnce(
        new Error('secret-token-from-provider'),
      )
      const error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      try {
        if (operation === 'add') {
          expect((await register(cookie)).response.status).toBe(200)
          expect(auth.passkeyCount(aliceId)).toBe(1)
        } else {
          auth.seedPasskeys(aliceId, [{ id: 'remove-failed-enqueue' }])
          const response = await auth.post(
            '/passkey/delete',
            { id: 'remove-failed-enqueue', password: PASSWORD },
            { cookie },
          )
          expect(response.status).toBe(200)
          expect(auth.passkeyCount(aliceId)).toBe(0)
        }
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('email.queue_failed'),
        )
        expect(JSON.stringify(error.mock.calls)).not.toContain(
          'secret-token-from-provider',
        )
      } finally {
        error.mockRestore()
      }
    },
  )

  it('does not notify for options, rename, invalid verification, unauthorized, foreign, missing or impersonated mutations', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    auth.seedPasskeys(aliceId, [{ id: 'alice-refused' }])
    auth.seedPasskeys(bobId, [{ id: 'bob-refused' }])
    shared.email.mockClear()
    expect(
      (await auth.post('/passkey/register/options', {}, { cookie })).status,
    ).toBe(200)
    expect(
      (
        await auth.post(
          '/passkey/rename',
          { id: 'alice-refused', name: '<script>untrusted</script>' },
          { cookie },
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await auth.post('/passkey/register/verify', dummyCredential(), {
          cookie,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await auth.post('/passkey/delete', {
          id: 'alice-refused',
          password: PASSWORD,
        })
      ).status,
    ).not.toBe(200)
    for (const id of ['missing', 'bob-refused']) {
      expect(
        (
          await auth.post(
            '/passkey/delete',
            { id, password: PASSWORD },
            { cookie },
          )
        ).status,
      ).toBe(404)
    }
    expect(
      (
        await auth.post(
          '/passkey/delete',
          { id: 'alice-refused', password: 'wrong-password' },
          { cookie },
        )
      ).status,
    ).toBe(400)
    auth.editSession(aliceId, 'impersonated_by', bobId)
    expect(
      (
        await auth.post(
          '/passkey/delete',
          { id: 'alice-refused', password: PASSWORD },
          { cookie },
        )
      ).status,
    ).toBe(403)
    expect(
      (await auth.post('/passkey/register/options', {}, { cookie })).status,
    ).toBe(403)
    expect(shared.email).not.toHaveBeenCalled()
  })

  it('retains working passkeys after password reset while revoking the old sessions', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    const { response, device } = await register(cookie)
    expect(response.status).toBe(200)
    shared.email.mockClear()
    expect(
      (
        await auth.post('/request-password-reset', {
          email: 'alice@planned.travel',
          redirectTo: `${BASE_URL}/reset-password`,
        })
      ).status,
    ).toBe(200)
    const reset = shared.email.mock.calls
      .map(([message]) => message)
      .find((message) => message.kind === 'auth.reset-password')
    if (!reset || reset.kind !== 'auth.reset-password')
      throw new Error('missing reset email')
    const token = reset.url.split('/').pop()?.split('?')[0]
    expect(token).toBeTruthy()
    expect(
      (await auth.post('/reset-password', { token, newPassword: PASSWORD }))
        .status,
    ).toBe(200)
    expect((await auth.get('/passkey/list', { cookie })).status).toBe(401)
    expect(auth.passkeyCount(aliceId)).toBe(1)
    const options = await auth.post('/passkey/authenticate/options', {
      email: 'alice@planned.travel',
    })
    const { challenge } = (await options.json()) as { challenge: string }
    const signedIn = await auth.post(
      '/passkey/authenticate/verify',
      await device.authentication(challenge),
    )
    expect(signedIn.status).toBe(200)
    expect(
      signedIn.headers
        .getSetCookie()
        .some((value) => value.startsWith('planned.session_token=')),
    ).toBe(true)
    expect(shared.email.mock.calls.map(([message]) => message.kind)).toEqual([
      'auth.reset-password',
    ])
  })
})

describe('concurrent passkey removal notices', () => {
  it('queues exactly once when two requests race to remove one credential', async () => {
    const cookie = await auth.signIn('alice@planned.travel')
    auth.seedPasskeys(aliceId, [{ id: 'racing-delete' }])
    shared.email.mockClear()
    shared.queue.mockClear()
    const responses = await Promise.all([
      auth.post(
        '/passkey/delete',
        { id: 'racing-delete', password: PASSWORD },
        { cookie },
      ),
      auth.post(
        '/passkey/delete',
        { id: 'racing-delete', password: PASSWORD },
        { cookie },
      ),
    ])
    expect(responses.some((response) => response.status === 200)).toBe(true)
    expect(
      responses.every(
        (response) => response.status === 200 || response.status === 404,
      ),
    ).toBe(true)
    expect(auth.passkeyCount(aliceId)).toBe(0)
    expect(shared.email).toHaveBeenCalledTimes(1)
    expect(shared.queue).toHaveBeenCalledTimes(1)
  })
})
