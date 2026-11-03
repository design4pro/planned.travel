import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { symmetricDecrypt } from 'better-auth/crypto'
import {
  createAuthDatabase,
  createSessionKv,
} from '#/server/fns/console/__tests__/real-auth'
import {
  backfillLegacyAuthority,
  recordAnchorBackfillCompletion,
} from '#/server/repos/account-security'
import type { AuthDatabase } from '#/server/fns/console/__tests__/real-auth'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'correct-horse-battery-staple'
const fixture = vi.hoisted(() => ({
  db: null as unknown,
  kv: null as unknown,
  active: false,
  ip: 0,
}))
vi.mock('#/server/auth/db', () => ({
  authDb: () => fixture.db,
  authRepositoryDb: () => fixture.db,
}))
vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => BASE_URL,
  appleBundleIdentifier: () => undefined,
  appleCredentials: () => null,
  authSecret: () => 'test-secret-not-used-outside-this-process',
  d1: () => ({}),
  googleCredentials: () => null,
  relyingPartyId: () => 'localhost',
  sessionStore: () => fixture.kv,
  securityEnforcement: () => fixture.active,
  taskQueue: () => ({
    send: async () => undefined,
    sendBatch: async () => undefined,
  }),
  trustedOrigins: () => [BASE_URL],
}))
vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async () => undefined,
}))
const { getAuth } = await import('../index')
const { recoverAccountDeletions } = await import('../account-authority')
let database: AuthDatabase
let kv: ReturnType<typeof createSessionKv>

beforeAll(async () => {
  database = await createAuthDatabase()
  kv = createSessionKv()
  fixture.db = database.db
  fixture.kv = kv
})
beforeEach(() => {
  database.reset()
  kv.clear()
  fixture.active = false
})
afterAll(() => database.close())

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
}
function trustOnly(cookie: string): string {
  return cookie
    .split('; ')
    .filter((value) => value.startsWith('planned.trust_device='))
    .join('; ')
}
async function post(path: string, body: unknown, cookie = '') {
  return getAuth().handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: {
        origin: BASE_URL,
        cookie,
        'content-type': 'application/json',
        'cf-connecting-ip': `192.0.2.${++fixture.ip}`,
      },
      body: JSON.stringify(body),
    }),
  )
}
async function signup(email: string) {
  const response = await post('/sign-up/email', {
    email,
    name: 'Authority fixture',
    password: PASSWORD,
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { user: { id: string } }
  return { userId: body.user.id, cookie: cookies(response) }
}
async function codeFor(userId: string) {
  const row = database.sqlite
    .prepare('select secret from two_factor where user_id = ?')
    .get(userId) as { secret: string }
  const context = await getAuth().$context
  const secret = await symmetricDecrypt({
    key: context.secretConfig,
    data: row.secret,
  })
  return (await getAuth().api.generateTOTP({ body: { secret } })).code
}
async function enroll(email: string) {
  const person = await signup(email)
  expect(
    (await post('/two-factor/enable', { password: PASSWORD }, person.cookie))
      .status,
  ).toBe(200)
  const enabled = await post(
    '/two-factor/verify-totp',
    { code: await codeFor(person.userId) },
    person.cookie,
  )
  expect(enabled.status).toBe(200)
  return { ...person, cookie: cookies(enabled) }
}
async function trustedLogin(email: string, userId: string) {
  const challenge = await post('/sign-in/email', { email, password: PASSWORD })
  expect(
    ((await challenge.json()) as { twoFactorRedirect?: boolean })
      .twoFactorRedirect,
  ).toBe(true)
  const verified = await post(
    '/two-factor/verify-totp',
    { code: await codeFor(userId), trustDevice: true },
    cookies(challenge),
  )
  expect(verified.status).toBe(200)
  return cookies(verified)
}
async function activate() {
  await backfillLegacyAuthority(database.db, Date.now())
  await recordAnchorBackfillCompletion(
    database.db,
    { runId: 'fixture-complete', completedAt: new Date().toISOString() },
    Date.now(),
  )
  fixture.active = true
}
async function sessionPresent(cookie: string) {
  const response = await getAuth().handler(
    new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }),
  )
  return response.status === 200 && (await response.json()) !== null
}

describe('factor proof and rollout at the real auth handler', () => {
  it('does not launder legacy browser trust through expand rotation into cutover authority', async () => {
    const email = 'legacy-lineage@planned.travel'
    const person = await enroll(email)
    const trusted = await trustedLogin(email, person.userId)
    database.sqlite.exec('delete from verification_authority')
    const expanded = await post(
      '/sign-in/email',
      { email, password: PASSWORD },
      trustOnly(trusted),
    )
    expect(expanded.status).toBe(200)
    expect(
      ((await expanded.json()) as { twoFactorRedirect?: boolean })
        .twoFactorRedirect,
    ).not.toBe(true)
    const rotated = trustOnly(cookies(expanded))
    expect(rotated.length > 0).toBe(true)
    await activate()
    const afterCutover = await post(
      '/sign-in/email',
      { email, password: PASSWORD },
      rotated,
    )
    expect(
      ((await afterCutover.json()) as { twoFactorRedirect?: boolean })
        .twoFactorRedirect,
    ).toBe(true)
    expect(await sessionPresent(cookies(afterCutover))).toBe(false)
  })

  it('preserves verified browser trust and requires completed factor hooks before granting a session', async () => {
    const email = 'verified-lineage@planned.travel'
    const person = await enroll(email)
    const trusted = await trustedLogin(email, person.userId)
    await activate()
    const accepted = await post(
      '/sign-in/email',
      { email, password: PASSWORD },
      trustOnly(trusted),
    )
    expect(accepted.status).toBe(200)
    expect(
      ((await accepted.json()) as { twoFactorRedirect?: boolean })
        .twoFactorRedirect,
    ).not.toBe(true)
    expect(await sessionPresent(cookies(accepted))).toBe(true)
    const context = await getAuth().$context
    const failure = vi
      .spyOn(context.internalAdapter, 'findVerificationValue')
      .mockRejectedValueOnce(new Error('fixture trust storage failure'))
    const interrupted = await post(
      '/sign-in/email',
      { email, password: PASSWORD },
      trustOnly(cookies(accepted)),
    )
    failure.mockRestore()
    expect(interrupted.status >= 400).toBe(true)
    expect(await sessionPresent(cookies(interrupted))).toBe(false)
    const provisional = database.sqlite
      .prepare(
        "select count(*) as total from session_authority where method = 'password-pending'",
      )
      .get() as { total: number }
    expect(provisional.total).toBe(1)
  })

  it('keeps D1 enforcement active if the activation setting is later cleared', async () => {
    const person = await signup('irreversible-cutover@planned.travel')
    await activate()
    expect(await sessionPresent(person.cookie)).toBe(true)
    fixture.active = false
    database.sqlite.exec('delete from session_authority')
    expect(await sessionPresent(person.cookie)).toBe(false)
  })

  it('refuses stale and impersonated self-service registrations', async () => {
    const person = await signup('self-service-gate@planned.travel')
    await activate()
    database.sqlite
      .prepare('update session set created_at = ? where user_id = ?')
      .run(Date.now() - 300001, person.userId)
    const stale = await post(
      '/account-security/register-operation',
      { intent: crypto.randomUUID() },
      person.cookie,
    )
    expect(stale.status >= 400).toBe(true)
    database.sqlite
      .prepare(
        'update session set created_at = ?, impersonated_by = ? where user_id = ?',
      )
      .run(Date.now(), 'fixture-operator', person.userId)
    const impersonated = await post(
      '/account-security/register-operation',
      { intent: crypto.randomUUID() },
      person.cookie,
    )
    expect(impersonated.status >= 400).toBe(true)
    const operations = database.sqlite
      .prepare('select count(*) as total from account_security_operation')
      .get() as { total: number }
    expect(operations.total).toBe(0)
  })
  it('refuses native account deletion before touching sessions or credentials while cleanup is pending', async () => {
    const operator = await signup('cleanup-operator@planned.travel')
    database.sqlite
      .prepare('update user set role = ? where id = ?')
      .run('admin', operator.userId)
    const admin = await post('/sign-in/email', {
      email: 'cleanup-operator@planned.travel',
      password: PASSWORD,
    })
    const target = await signup('cleanup-delete-target@planned.travel')
    const signedIn = await post('/sign-in/email', {
      email: 'cleanup-delete-target@planned.travel',
      password: PASSWORD,
    })
    const currentCookie = cookies(signedIn)
    await activate()
    const intent = crypto.randomUUID()
    const registration = await post(
      '/account-security/register-operation',
      { intent },
      currentCookie,
    )
    expect(registration.status).toBe(200)
    const registered = (await registration.json()) as { id: string }
    const operationCookie = `${currentCookie}; ${cookies(registration)}`
    const committed = await post(
      '/account-security/revoke-other-sessions',
      { id: registered.id, intent, confirm: true },
      operationCookie,
    )
    expect(committed.status).toBe(200)
    const before = database.sqlite
      .prepare(
        'select count(*) as total from session_authority where user_id = ?',
      )
      .get(target.userId)
    const credentials = database.sqlite
      .prepare('select count(*) as total from account where user_id = ?')
      .get(target.userId)
    await expect(
      getAuth().api.removeUser({
        headers: new Headers({ cookie: cookies(admin), origin: BASE_URL }),
        body: { userId: target.userId },
      }),
    ).rejects.toThrow()
    expect(
      database.sqlite
        .prepare(
          'select count(*) as total from session_authority where user_id = ?',
        )
        .get(target.userId),
    ).toEqual(before)
    expect(
      database.sqlite
        .prepare('select count(*) as total from account where user_id = ?')
        .get(target.userId),
    ).toEqual(credentials)
    expect(await sessionPresent(currentCookie)).toBe(true)
  })

  it('resumes an interrupted authorized deletion after restart without reviving the account', async () => {
    const target = await signup('restart-delete@planned.travel')
    await activate()
    const context = await getAuth().$context
    database.sqlite.exec(
      "create trigger interrupt_account_delete before delete on account begin select raise(abort, 'fixture interruption'); end",
    )
    await expect(
      context.internalAdapter.deleteUser(target.userId),
    ).rejects.toThrow()
    expect(await sessionPresent(target.cookie)).toBe(false)
    expect(
      database.sqlite
        .prepare('select deletion_id from account_security where user_id = ?')
        .get(target.userId),
    ).toEqual({ deletion_id: expect.any(String) })
    database.sqlite.exec('drop trigger interrupt_account_delete')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000)
    try {
      await recoverAccountDeletions(database.db, Date.now(), async (userId) => {
        await context.internalAdapter.deleteUser(userId)
      })
      expect(
        database.sqlite
          .prepare('select id from user where id = ?')
          .get(target.userId),
      ).toBeUndefined()
    } finally {
      clock.mockRestore()
    }
  })

  it('backfills a dormant account before allowing its first cutover sign-in', async () => {
    const email = 'dormant-expand@planned.travel'
    const target = await signup(email)
    database.sqlite
      .prepare('delete from session where user_id = ?')
      .run(target.userId)
    database.sqlite.exec(
      'delete from account_security; delete from account_security_fence',
    )
    await activate()
    const response = await post('/sign-in/email', {
      email,
      password: PASSWORD,
    })
    expect(response.status).toBe(200)
    expect(await sessionPresent(cookies(response))).toBe(true)
  })

  it('budgets two primary reads per warm in-process session acceptance', async () => {
    const target = await signup('primary-budget@planned.travel')
    await activate()
    const headers = new Headers({ cookie: target.cookie })
    await getAuth().api.getSession({ headers })
    const samples: Array<number> = []
    for (let index = 0; index < 20; index++) {
      database.queries.length = 0
      const started = performance.now()
      expect((await getAuth().api.getSession({ headers }))?.user.id).toBe(
        target.userId,
      )
      samples.push(performance.now() - started)
      expect(database.queries).toHaveLength(2)
      expect(
        database.queries.every((query) => query.startsWith('select')),
      ).toBe(true)
    }
    samples.sort((a, b) => a - b)
    process.stdout.write(
      `Account authority local SQLite wall latency: median=${samples[10].toFixed(2)}ms p95=${samples[19].toFixed(2)}ms, primary reads=2\n`,
    )
  })
})
