import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto'
import {
  createAuthDatabase,
  createSessionKv,
} from '#/server/fns/console/__tests__/real-auth'
import {
  backfillLegacyAuthority,
  recordAnchorBackfillCompletion,
} from '#/server/repos/account-security'
import * as securityRepo from '#/server/repos/account-security'
import { createAuthenticator } from '../passkey/__tests__/authenticator'
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
  appleCredentials: () => ({
    clientId: 'fixture-apple',
    clientSecret: 'fixture-apple-secret',
    verifyIdToken: async (token: string) => token === 'valid-provider-proof',
  }),
  authSecret: () => 'test-secret-not-used-outside-this-process',
  d1: () => ({}),
  googleCredentials: () => ({
    clientId: 'fixture-google',
    clientSecret: 'fixture-google-secret',
    verifyIdToken: async (token: string) => token === 'valid-provider-proof',
  }),
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

async function factorRegistration(
  cookie: string,
  operation: 'enable' | 'replace' | 'disable' | 'backup',
) {
  const intent = crypto.randomUUID()
  const response = await post(
    '/account-security/register-operation',
    { intent, operation },
    cookie,
  )
  expect(response.status).toBe(200)
  const { id } = (await response.json()) as { id: string }
  return {
    id,
    intent,
    operation,
    receipt: cookies(response),
    cookie: `${cookie}; ${cookies(response)}`,
  }
}
async function proposedCode() {
  const row = database.sqlite
    .prepare('select payload from factor_proposal')
    .get() as { payload: string }
  const context = await getAuth().$context
  const payload = JSON.parse(
    await symmetricDecrypt({ key: context.secretConfig, data: row.payload }),
  ) as { proposed: { secret: string } }
  const secret = await symmetricDecrypt({
    key: context.secretConfig,
    data: payload.proposed.secret,
  })
  return (await getAuth().api.generateTOTP({ body: { secret } })).code
}

describe('factor proof and rollout at the real auth handler', () => {
  it('refuses password-only native disable after authority cutover without changing the factor or sessions', async () => {
    const person = await enroll('lifecycle-disable@planned.travel')
    await activate()
    const before = database.sqlite
      .prepare('select * from two_factor where user_id = ?')
      .get(person.userId)
    const response = await post(
      '/two-factor/disable',
      { password: PASSWORD },
      person.cookie,
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: 'CLIENT_UPGRADE_REQUIRED',
    })
    expect(
      database.sqlite
        .prepare('select * from two_factor where user_id = ?')
        .get(person.userId),
    ).toEqual(before)
    expect(await sessionPresent(person.cookie)).toBe(true)
  })

  it('refuses password-only active-key disclosure through the in-process interface', async () => {
    const person = await enroll('lifecycle-key@planned.travel')
    await activate()
    const refusal = await getAuth()
      .api.getTOTPURI({
        headers: new Headers({ cookie: person.cookie, origin: BASE_URL }),
        body: { password: PASSWORD },
      })
      .then(
        () => null,
        (error: unknown) => error,
      )
    expect(refusal).toMatchObject({ body: { code: 'CLIENT_UPGRADE_REQUIRED' } })
    expect(await sessionPresent(person.cookie)).toBe(true)
  })

  it('registers an enable intent before staging without changing active authority', async () => {
    const person = await signup('lifecycle-proposal@planned.travel')
    await activate()
    const intent = crypto.randomUUID()
    const registration = await post(
      '/account-security/register-operation',
      { intent, operation: 'enable' },
      person.cookie,
    )
    expect(registration.status).toBe(200)
    const { id } = (await registration.json()) as { id: string }
    const prepared = await post(
      '/account-security/prepare-factor',
      {
        id,
        intent,
        operation: 'enable',
        password: PASSWORD,
      },
      `${person.cookie}; ${cookies(registration)}`,
    )
    expect(prepared.status).toBe(200)
    expect(await prepared.json()).toMatchObject({
      proposalId: expect.any(String),
      totpURI: expect.any(String),
      expiresAt: expect.any(Number),
    })
    expect(
      database.sqlite
        .prepare('select * from two_factor where user_id = ?')
        .get(person.userId),
    ).toBeUndefined()
    expect(await sessionPresent(person.cookie)).toBe(true)
  })

  it.each([
    ['/two-factor/enable', { password: PASSWORD, method: 'otp' }],
    ['/two-factor/generate-backup-codes', { password: PASSWORD }],
    ['/two-factor/verify-totp', { code: '000000' }],
    ['/two-factor/send-otp', {}],
    ['/two-factor/verify-otp', { code: '123456', trustDevice: true }],
    [
      '/two-factor/verify-backup-code',
      { code: 'unused-test-code', disableSession: true },
    ],
  ])(
    'closes the signed-in native sibling %s after cutover',
    async (path, body) => {
      const person = await enroll(
        `lifecycle-sibling-${crypto.randomUUID()}@planned.travel`,
      )
      await activate()
      const response = await post(path, body, person.cookie)
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({
        code: 'CLIENT_UPGRADE_REQUIRED',
      })
      expect(await sessionPresent(person.cookie)).toBe(true)
    },
  )

  it('does not redisplay the active backup set through the server-only API', async () => {
    const person = await enroll('lifecycle-redisplay@planned.travel')
    await activate()
    const refusal = await getAuth()
      .api.viewBackupCodes({
        body: { userId: person.userId },
      })
      .then(
        () => null,
        (error: unknown) => error,
      )
    expect(refusal).toMatchObject({ body: { code: 'CLIENT_UPGRADE_REQUIRED' } })
  })

  it('commits enable atomically, retires the old session and rejects the activation step for immediate disable', async () => {
    const person = await signup('lifecycle-complete@planned.travel')
    await activate()
    const registration = await factorRegistration(person.cookie, 'enable')
    const prepared = await post(
      '/account-security/prepare-factor',
      {
        id: registration.id,
        intent: registration.intent,
        operation: 'enable',
        password: PASSWORD,
      },
      registration.cookie,
    )
    expect(prepared.status).toBe(200)
    const { proposalId } = (await prepared.json()) as { proposalId: string }
    const code = await proposedCode()
    const committed = await post(
      '/account-security/commit-factor',
      {
        id: registration.id,
        intent: registration.intent,
        operation: 'enable',
        confirm: true,
        proposalId,
        code,
      },
      registration.cookie,
    )
    expect(committed.status).toBe(200)
    const result = (await committed.json()) as {
      status: string
      enabled: boolean
      backupCodes: Array<string>
    }
    expect(result.status).toBe('committed')
    expect(result.enabled).toBe(true)
    expect(result.backupCodes.length).toBe(10)
    const currentCookie = cookies(committed)
    expect(await sessionPresent(person.cookie)).toBe(false)
    expect(await sessionPresent(currentCookie)).toBe(true)
    expect(
      database.sqlite
        .prepare('select count(*) as count from factor_proposal')
        .get(),
    ).toEqual({ count: 0 })
    const status = await getAuth().handler(
      new Request(
        `${BASE_URL}/api/auth/account-security/operation-status?id=${registration.id}`,
        { headers: { cookie: registration.receipt } },
      ),
    )
    const recovered = (await status.json()) as Record<string, unknown>
    expect(recovered.status).toBe('committed')
    expect(recovered.enabled).toBe(true)
    expect('backupCodes' in recovered || 'token' in recovered).toBe(false)
    const challenge = await post('/sign-in/email', {
      email: 'lifecycle-complete@planned.travel',
      password: PASSWORD,
    })
    const reauthenticated = await post(
      '/two-factor/verify-backup-code',
      { code: result.backupCodes[9] },
      cookies(challenge),
    )
    expect(reauthenticated.status).toBe(200)
    for (const cookie of [currentCookie, cookies(reauthenticated)]) {
      const availability = await getAuth().handler(
        new Request(`${BASE_URL}/api/auth/account-security/availability`, {
          headers: { cookie: `${cookie}; ${registration.receipt}` },
        }),
      )
      expect(availability.status).toBe(200)
      expect(await availability.json()).toEqual({
        available: true,
        recovery: null,
      })
    }
    const disable = await factorRegistration(currentCookie, 'disable')
    const reused = await post(
      '/account-security/disable-factor',
      {
        id: disable.id,
        intent: disable.intent,
        operation: 'disable',
        confirm: true,
        password: PASSWORD,
        proof: { kind: 'totp', code },
      },
      disable.cookie,
    )
    expect(reused.status).toBe(400)
    expect(await reused.json()).toMatchObject({ code: 'FACTOR_PROOF_USED' })
    const disabled = await post(
      '/account-security/disable-factor',
      {
        id: disable.id,
        intent: disable.intent,
        operation: 'disable',
        confirm: true,
        password: PASSWORD,
        proof: { kind: 'backup', code: result.backupCodes[0] },
      },
      disable.cookie,
    )
    expect(disabled.status).toBe(200)
    expect(await disabled.json()).toMatchObject({
      status: 'committed',
      enabled: false,
    })
    expect(await sessionPresent(currentCookie)).toBe(false)
    expect(await sessionPresent(cookies(disabled))).toBe(true)
  })

  it('cancels a staged replacement without changing active factor or trust and refuses wrong-kind use', async () => {
    const person = await enroll('lifecycle-cancel@planned.travel')
    await activate()
    const before = database.sqlite
      .prepare('select secret, backup_codes from two_factor where user_id = ?')
      .get(person.userId)
    const registration = await factorRegistration(person.cookie, 'replace')
    const prepared = await post(
      '/account-security/prepare-factor',
      {
        id: registration.id,
        intent: registration.intent,
        operation: 'replace',
        password: PASSWORD,
        proof: { kind: 'totp', code: await codeFor(person.userId) },
      },
      registration.cookie,
    )
    expect(prepared.status).toBe(200)
    const wrong = await post(
      '/account-security/revoke-other-sessions',
      { id: registration.id, intent: registration.intent, confirm: true },
      registration.cookie,
    )
    expect(wrong.status).toBe(403)
    const cancelled = await post(
      '/account-security/cancel-factor',
      {
        id: registration.id,
        intent: registration.intent,
        operation: 'replace',
      },
      registration.cookie,
    )
    expect(cancelled.status).toBe(200)
    expect(await cancelled.json()).toMatchObject({ status: 'refused' })
    expect(
      database.sqlite
        .prepare(
          'select secret, backup_codes from two_factor where user_id = ?',
        )
        .get(person.userId),
    ).toEqual(before)
    expect(await sessionPresent(person.cookie)).toBe(true)
    expect(
      database.sqlite
        .prepare('select count(*) as count from factor_proposal')
        .get(),
    ).toEqual({ count: 0 })
    const next = await factorRegistration(person.cookie, 'replace')
    expect(next.id === registration.id).toBe(false)
  })

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
  it('does not present another signed-in account receipt as this account recovery', async () => {
    const first = await signup('receipt-owner@planned.travel')
    const second = await signup('receipt-unrelated@planned.travel')
    await activate()
    const intent = crypto.randomUUID()
    const registered = await post(
      '/account-security/register-operation',
      { intent },
      first.cookie,
    )
    expect(registered.status).toBe(200)
    const { id } = (await registered.json()) as { id: string }
    const receiptCookie = cookies(registered)
    const committed = await post(
      '/account-security/revoke-other-sessions',
      { id, intent, confirm: true },
      `${first.cookie}; ${receiptCookie}`,
    )
    expect(committed.status).toBe(200)
    const availability = await getAuth().handler(
      new Request(`${BASE_URL}/api/auth/account-security/availability`, {
        headers: { cookie: `${second.cookie}; ${receiptCookie}` },
      }),
    )
    expect(availability.status).toBe(200)
    expect(await availability.json()).toEqual({
      available: true,
      recovery: null,
    })
    const status = await getAuth().handler(
      new Request(
        `${BASE_URL}/api/auth/account-security/operation-status?id=${id}`,
        { headers: { cookie: receiptCookie } },
      ),
    )
    expect(status.status).toBe(200)
    expect(await status.json()).toMatchObject({ status: 'committed' })
    expect(await sessionPresent(second.cookie)).toBe(true)
    const reauthenticated = await post('/sign-in/email', {
      email: 'receipt-owner@planned.travel',
      password: PASSWORD,
    })
    expect(reauthenticated.status).toBe(200)
    const recovered = await getAuth().handler(
      new Request(`${BASE_URL}/api/auth/account-security/availability`, {
        headers: { cookie: `${cookies(reauthenticated)}; ${receiptCookie}` },
      }),
    )
    expect(recovered.status).toBe(200)
    expect(await recovered.json()).toMatchObject({
      available: true,
      recovery: { id, status: 'committed' },
    })
  })
})

describe('factor lifecycle recovery and contested proofs', () => {
  it('recovers an entirely lost registration response idempotently for the same intent, including reversed responses around staging', async () => {
    const person = await signup('lost-register@planned.travel')
    await activate()
    const intent = crypto.randomUUID()
    const first = await post(
      '/account-security/register-operation',
      { intent, operation: 'enable' },
      person.cookie,
    )
    const initial = (await first.json()) as { id: string }
    const retried = await post(
      '/account-security/register-operation',
      { intent, operation: 'enable' },
      person.cookie,
    )
    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({ id: initial.id })
    expect(
      (
        await post(
          '/account-security/register-operation',
          { intent: crypto.randomUUID(), operation: 'enable' },
          person.cookie,
        )
      ).status,
    ).toBe(403)
    const body = {
      id: initial.id,
      intent,
      operation: 'enable',
      password: PASSWORD,
    }
    expect(cookies(first)).toBe(cookies(retried))
    expect(
      (
        await post(
          '/account-security/prepare-factor',
          body,
          `${person.cookie}; ${cookies(retried)}`,
        )
      ).status,
    ).toBe(200)
    const before = database.sqlite
      .prepare(
        'select receipt_digest, expires_at from account_security_operation',
      )
      .get()
    const lateRetry = await post(
      '/account-security/register-operation',
      { intent, operation: 'enable' },
      person.cookie,
    )
    expect(lateRetry.status).toBe(200)
    expect(cookies(lateRetry)).toBe(cookies(first))
    const cancelled = await post(
      '/account-security/cancel-factor',
      { id: initial.id, intent, operation: 'enable' },
      `${person.cookie}; ${cookies(first)}`,
    )
    expect(cancelled.status).toBe(200)
    expect(
      database.sqlite
        .prepare(
          'select receipt_digest, expires_at from account_security_operation',
        )
        .get(),
    ).toEqual(before)
  })
  it.each(['backup', 'replace'] as const)(
    'commits %s with old backup possession, rotates this session and retires all other authority',
    async (operation) => {
      const email = `change-${operation}@planned.travel`
      const person = await enroll(email)
      const other = await trustedLogin(email, person.userId)
      await activate()
      const context = await getAuth().$context
      const old = database.sqlite
        .prepare(
          'select secret, backup_codes from two_factor where user_id = ?',
        )
        .get(person.userId) as { secret: string; backup_codes: string }
      const oldCodes = JSON.parse(
        await symmetricDecrypt({
          key: context.secretConfig,
          data: old.backup_codes,
        }),
      ) as Array<string>
      const registered = await factorRegistration(person.cookie, operation)
      const body = {
        id: registered.id,
        intent: registered.intent,
        operation,
        password: PASSWORD,
        proof: { kind: 'backup', code: oldCodes[0] },
        confirm: true,
      }
      let response: Response
      if (operation === 'replace') {
        const { confirm: _, ...prepare } = body
        const staged = await post(
          '/account-security/prepare-factor',
          prepare,
          registered.cookie,
        )
        expect(staged.status).toBe(200)
        const { proposalId } = (await staged.json()) as { proposalId: string }
        expect(
          database.sqlite
            .prepare(
              'select secret, backup_codes from two_factor where user_id = ?',
            )
            .get(person.userId),
        ).toEqual(old)
        response = await post(
          '/account-security/commit-factor',
          {
            id: registered.id,
            intent: registered.intent,
            operation,
            proposalId,
            code: await proposedCode(),
            confirm: true,
          },
          registered.cookie,
        )
      } else
        response = await post(
          '/account-security/replace-backup-codes',
          body,
          registered.cookie,
        )
      expect(response.status).toBe(200)
      const result = (await response.json()) as { backupCodes: Array<string> }
      expect(result.backupCodes.length).toBe(10)
      expect(result.backupCodes.includes(oldCodes[0])).toBe(false)
      expect(await sessionPresent(person.cookie)).toBe(false)
      expect(await sessionPresent(other)).toBe(false)
      expect(await sessionPresent(cookies(response))).toBe(true)
      const trust = await post(
        '/sign-in/email',
        { email, password: PASSWORD },
        trustOnly(other),
      )
      expect(await trust.json()).toMatchObject({ twoFactorRedirect: true })
      const repeated = await post(
        '/account-security/replace-backup-codes',
        body,
        registered.cookie,
      )
      expect(repeated.status).not.toBe(200)
      const status = await getAuth().handler(
        new Request(
          `${BASE_URL}/api/auth/account-security/operation-status?id=${registered.id}`,
          { headers: { cookie: registered.receipt } },
        ),
      )
      expect(await status.json()).toEqual({
        status: 'committed',
        operation,
        enabled: true,
        cleanupPending: expect.any(Boolean),
      })
    },
  )
  it.each(['expired', 'session', 'credential'] as const)(
    'preserves active authority when a proposal becomes %s',
    async (change) => {
      const person = await enroll(`stale-${change}@planned.travel`)
      await activate()
      const registered = await factorRegistration(person.cookie, 'replace')
      const staged = await post(
        '/account-security/prepare-factor',
        {
          id: registered.id,
          intent: registered.intent,
          operation: 'replace',
          password: PASSWORD,
          proof: { kind: 'totp', code: await codeFor(person.userId) },
        },
        registered.cookie,
      )
      expect(staged.status).toBe(200)
      const { proposalId } = (await staged.json()) as { proposalId: string }
      const code = await proposedCode()
      if (change === 'expired')
        database.sqlite
          .prepare('update factor_proposal set expires_at = ?')
          .run(Date.now() - 1)
      if (change === 'session')
        database.sqlite
          .prepare('update session set created_at = ? where user_id = ?')
          .run(Date.now() - 300001, person.userId)
      if (change === 'credential')
        database.sqlite
          .prepare(
            "update account set password = 'changed-hash' where user_id = ? and provider_id = 'credential'",
          )
          .run(person.userId)
      const before = database.sqlite
        .prepare('select * from two_factor where user_id = ?')
        .get(person.userId)
      const response = await post(
        '/account-security/commit-factor',
        {
          id: registered.id,
          intent: registered.intent,
          operation: 'replace',
          proposalId,
          code,
          confirm: true,
        },
        registered.cookie,
      )
      expect(response.status).not.toBe(200)
      expect(
        database.sqlite
          .prepare('select * from two_factor where user_id = ?')
          .get(person.userId),
      ).toEqual(before)
      expect(
        database.sqlite
          .prepare(
            'select revision, trust_revision from account_security where user_id = ?',
          )
          .get(person.userId),
      ).toEqual({ revision: 0, trust_revision: 0 })
    },
  )
  it('shares the native and management account budget and reports its remaining deadline', async () => {
    const email = 'shared-budget@planned.travel'
    const person = await enroll(email)
    await activate()
    const registered = await factorRegistration(person.cookie, 'disable')
    const signed = await post('/sign-in/email', { email, password: PASSWORD })
    const challenge = cookies(signed)
    for (let index = 0; index < 4; index++) {
      expect(
        (await post('/two-factor/verify-totp', { code: 'invalid' }, challenge))
          .status,
      ).toBe(401)
      expect(
        (
          await post(
            '/account-security/disable-factor',
            {
              id: registered.id,
              intent: registered.intent,
              operation: 'disable',
              confirm: true,
              password: PASSWORD,
              proof: { kind: 'totp', code: '000000' },
            },
            registered.cookie,
          )
        ).status,
      ).toBe(400)
    }
    database.sqlite
      .prepare(
        "update factor_budget set recovery_at = ? where user_id = ? and domain = 'active'",
      )
      .run(Date.now() + 23000, person.userId)
    const denied = await post(
      '/two-factor/verify-totp',
      { code: await codeFor(person.userId) },
      challenge,
    )
    expect(denied.status).toBe(429)
    expect(Number(denied.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(Number(denied.headers.get('retry-after'))).toBeLessThanOrEqual(23)
    const deniedManagement = await post(
      '/account-security/disable-factor',
      {
        id: registered.id,
        intent: registered.intent,
        operation: 'disable',
        confirm: true,
        password: PASSWORD,
        proof: { kind: 'totp', code: await codeFor(person.userId) },
      },
      registered.cookie,
    )
    expect(deniedManagement.status).toBe(429)
    expect(await sessionPresent(person.cookie)).toBe(true)
  })
  it('sanitizes malformed decrypted material before error logging or serialization', async () => {
    const person = await signup('bad-material@planned.travel')
    await activate()
    const registered = await factorRegistration(person.cookie, 'enable')
    const staged = await post(
      '/account-security/prepare-factor',
      {
        id: registered.id,
        intent: registered.intent,
        operation: 'enable',
        password: PASSWORD,
      },
      registered.cookie,
    )
    const { proposalId } = (await staged.json()) as { proposalId: string }
    const plaintext = 'private-fixture-material-not-valid-json'
    const context = await getAuth().$context
    database.sqlite
      .prepare('update factor_proposal set payload = ?')
      .run(
        await symmetricEncrypt({ key: context.secretConfig, data: plaintext }),
      )
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const response = await post(
        '/account-security/commit-factor',
        {
          id: registered.id,
          intent: registered.intent,
          operation: 'enable',
          proposalId,
          code: '123456',
          confirm: true,
        },
        registered.cookie,
      )
      expect(response.status).toBe(503)
      expect((await response.text()).includes(plaintext)).toBe(false)
      expect(JSON.stringify(error.mock.calls).includes(plaintext)).toBe(false)
    } finally {
      error.mockRestore()
    }
  })
})

function barrier() {
  let entered!: () => void
  let release!: () => void
  const reached = new Promise<void>((resolve) => {
    entered = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    reached,
    release,
    stop: async () => {
      entered()
      await released
    },
  }
}
async function stage(
  cookie: string,
  operation: 'enable' | 'replace',
  proof?: { kind: 'totp' | 'backup'; code: string },
) {
  const registered = await factorRegistration(cookie, operation)
  const response = await post(
    '/account-security/prepare-factor',
    {
      id: registered.id,
      intent: registered.intent,
      operation,
      password: PASSWORD,
      ...(proof ? { proof } : {}),
    },
    registered.cookie,
  )
  expect(response.status).toBe(200)
  const { proposalId } = (await response.json()) as { proposalId: string }
  return {
    registered,
    body: {
      id: registered.id,
      intent: registered.intent,
      operation,
      proposalId,
      code: await proposedCode(),
      confirm: true,
    },
  }
}
async function backupFor(userId: string) {
  const row = database.sqlite
    .prepare('select backup_codes from two_factor where user_id = ?')
    .get(userId) as { backup_codes: string }
  return JSON.parse(
    await symmetricDecrypt({
      key: (await getAuth().$context).secretConfig,
      data: row.backup_codes,
    }),
  ) as Array<string>
}
describe.each(['enable', 'replace'] as const)(
  'provider exemptions after an atomic %s with authority cutover active',
  (operation) => {
    it.each(['google', 'apple', 'passkey'] as const)(
      'accepts fresh %s proof at the final revision without bypassing or removing TOTP',
      async (providerId) => {
        const email = `${providerId}-${operation}@planned.travel`
        const person = await (operation === 'enable' ? signup : enroll)(email)
        const other = await enroll('other-provider-account@planned.travel')
        const otherFactor = database.sqlite
          .prepare('select * from two_factor where user_id = ?')
          .get(other.userId)
        const device = await createAuthenticator()
        const provider = (await getAuth().$context).socialProviders.find(
          (entry) => entry.id === providerId,
        )
        // Only the external provider proof/profile boundary is replaced; session authority is real.
        const profile = provider
          ? vi.spyOn(provider, 'getUserInfo').mockResolvedValue({
              user: { name: 'Provider fixture', email, emailVerified: true },
              data: { sub: `${providerId}-subject`, email },
            })
          : undefined
        try {
          if (providerId === 'passkey') {
            const options = await post(
              '/passkey/register/options',
              {},
              person.cookie,
            )
            expect(options.status).toBe(200)
            const { challenge } = (await options.json()) as {
              challenge: string
            }
            const registered = await post(
              '/passkey/register/verify',
              device.registration(challenge),
              person.cookie,
            )
            expect(registered.status).toBe(200)
          } else {
            const linked = await post(
              '/link-social',
              {
                provider: providerId,
                idToken: { token: 'valid-provider-proof' },
              },
              person.cookie,
            )
            expect(linked.status).toBe(200)
          }
          await activate()
          const proposal = await stage(
            person.cookie,
            operation,
            operation === 'replace'
              ? { kind: 'backup', code: (await backupFor(person.userId))[0] }
              : undefined,
          )
          const committed = await post(
            '/account-security/commit-factor',
            proposal.body,
            proposal.registered.cookie,
          )
          expect(committed.status).toBe(200)
          expect(await committed.json()).toMatchObject({
            status: 'committed',
            enabled: true,
          })
          expect(await sessionPresent(person.cookie)).toBe(false)
          expect(await sessionPresent(cookies(committed))).toBe(true)
          const finalFactor = database.sqlite
            .prepare('select * from two_factor where user_id = ?')
            .get(person.userId)
          expect(finalFactor).toBeDefined()

          async function signIn(valid: boolean) {
            if (providerId !== 'passkey') {
              return post('/sign-in/social', {
                provider: providerId,
                idToken: {
                  token: valid
                    ? 'valid-provider-proof'
                    : 'invalid-provider-proof',
                },
              })
            }
            const options = await post('/passkey/authenticate/options', {
              email,
            })
            expect(options.status).toBe(200)
            const { challenge } = (await options.json()) as {
              challenge: string
            }
            const proof = await device.authentication(challenge)
            if (!valid) {
              const signature = Buffer.from(
                proof.credential.response.signature,
                'base64url',
              )
              signature[0] ^= 1
              proof.credential.response.signature =
                signature.toString('base64url')
            }
            return post('/passkey/authenticate/verify', proof)
          }
          const refused = await signIn(false)
          expect(refused.status).toBe(401)
          expect(await sessionPresent(cookies(refused))).toBe(false)
          const signedIn = await signIn(true)
          expect(signedIn.status).toBe(200)
          expect(await signedIn.json()).not.toHaveProperty(
            'twoFactorRedirect',
            true,
          )
          expect(signedIn.headers.get('location')).toBeNull()
          const current = await getAuth().handler(
            new Request(`${BASE_URL}/api/auth/get-session`, {
              headers: { cookie: cookies(signedIn) },
            }),
          )
          expect(current.status).toBe(200)
          expect(await current.json()).toMatchObject({
            user: { id: person.userId, twoFactorEnabled: true },
            session: { userId: person.userId },
          })
          expect(
            database.sqlite
              .prepare('select * from two_factor where user_id = ?')
              .get(person.userId),
          ).toEqual(finalFactor)
          const password = await post('/sign-in/email', {
            email,
            password: PASSWORD,
          })
          expect(await password.json()).toMatchObject({
            twoFactorRedirect: true,
          })
          expect(await sessionPresent(cookies(password))).toBe(false)
          const verified = await post(
            '/two-factor/verify-totp',
            { code: proposal.body.code },
            cookies(password),
          )
          expect(verified.status).toBe(200)
          expect(await sessionPresent(cookies(verified))).toBe(true)
          expect(await sessionPresent(other.cookie)).toBe(true)
          expect(
            database.sqlite
              .prepare('select * from two_factor where user_id = ?')
              .get(other.userId),
          ).toEqual(otherFactor)
        } finally {
          profile?.mockRestore()
        }
      },
    )
  },
)

describe('native proof races against factor commits', () => {
  it.each(['before', 'after'] as const)(
    'cannot accept old password proof paused %s session insertion across enable',
    async (timing) => {
      const email = `race-signin-${timing}@planned.travel`
      const person = await signup(email)
      await activate()
      const proposal = await stage(person.cookie, 'enable')
      const gate = barrier()
      const original = securityRepo.insertNativeSession
      const spy = vi
        .spyOn(securityRepo, 'insertNativeSession')
        .mockImplementation(async (...args) => {
          const targeted =
            args[0].userId === person.userId && args[3] === 'password-pending'
          if (targeted && timing === 'before') await gate.stop()
          const result = await original(...args)
          if (targeted && timing === 'after') await gate.stop()
          return result
        })
      const pending = post('/sign-in/email', {
        email,
        password: PASSWORD,
      }).catch((error: unknown) => {
        expect(error).toBeInstanceOf(securityRepo.AccountAuthorityError)
        return null
      })
      try {
        await gate.reached
        const changed = await post(
          '/account-security/commit-factor',
          proposal.body,
          proposal.registered.cookie,
        )
        expect(changed.status).toBe(200)
        gate.release()
        const stale = await pending
        if (stale) expect(await sessionPresent(cookies(stale))).toBe(false)
        expect(await sessionPresent(cookies(changed))).toBe(true)
        expect(await sessionPresent(person.cookie)).toBe(false)
      } finally {
        gate.release()
        await pending
        spy.mockRestore()
      }
    },
  )
  it('cannot rotate old browser trust into the revision committed by authenticator replacement', async () => {
    const email = 'race-trust@planned.travel'
    const person = await enroll(email)
    const trusted = await trustedLogin(email, person.userId)
    await activate()
    const proposal = await stage(person.cookie, 'replace', {
      kind: 'backup',
      code: (await backupFor(person.userId))[0],
    })
    const gate = barrier()
    const original = securityRepo.insertNativeVerification
    const spy = vi
      .spyOn(securityRepo, 'insertNativeVerification')
      .mockImplementation(async (...args) => {
        if (
          args[0].userId === person.userId &&
          args[1].identifier.startsWith('trust-device-')
        )
          await gate.stop()
        return original(...args)
      })
    const pending = post(
      '/sign-in/email',
      { email, password: PASSWORD },
      trustOnly(trusted),
    )
    try {
      await gate.reached
      const changed = await post(
        '/account-security/commit-factor',
        proposal.body,
        proposal.registered.cookie,
      )
      expect(changed.status).toBe(200)
      gate.release()
      const stale = await pending
      expect(await sessionPresent(cookies(stale))).toBe(false)
      expect(await sessionPresent(cookies(changed))).toBe(true)
      const retry = await post(
        '/sign-in/email',
        { email, password: PASSWORD },
        trustOnly(cookies(stale)) || trustOnly(trusted),
      )
      expect(await retry.json()).toMatchObject({ twoFactorRedirect: true })
    } finally {
      gate.release()
      await pending
      spy.mockRestore()
    }
  })
  it.each(['login', 'disable'] as const)(
    'allows only one consumer of the same backup proof when %s waits',
    async (waiting) => {
      const email = `race-backup-${waiting}@planned.travel`
      const person = await enroll(email)
      await activate()
      const code = (await backupFor(person.userId))[0]
      const registered = await factorRegistration(person.cookie, 'disable')
      const challenge = await post('/sign-in/email', {
        email,
        password: PASSWORD,
      })
      const gate = barrier()
      const originalConsume = securityRepo.consumeNativeBackup
      const originalCommit = securityRepo.commitFactor
      const consumeSpy = vi
        .spyOn(securityRepo, 'consumeNativeBackup')
        .mockImplementation(async (...args) => {
          if (waiting === 'login' && args[0].userId === person.userId)
            await gate.stop()
          return originalConsume(...args)
        })
      const commitSpy = vi
        .spyOn(securityRepo, 'commitFactor')
        .mockImplementation(async (...args) => {
          if (waiting === 'disable' && args[0].userId === person.userId)
            await gate.stop()
          return originalCommit(...args)
        })
      const login = () =>
        post('/two-factor/verify-backup-code', { code }, cookies(challenge))
      const disable = () =>
        post(
          '/account-security/disable-factor',
          {
            id: registered.id,
            intent: registered.intent,
            operation: 'disable',
            confirm: true,
            password: PASSWORD,
            proof: { kind: 'backup', code },
          },
          registered.cookie,
        )
      const pending = waiting === 'login' ? login() : disable()
      try {
        await gate.reached
        const winner = await (waiting === 'login' ? disable() : login())
        expect(winner.status).toBe(200)
        gate.release()
        const loser = await pending
        expect(loser.status).not.toBe(200)
        expect(await sessionPresent(cookies(winner))).toBe(true)
        const factor = database.sqlite
          .prepare('select * from two_factor where user_id = ?')
          .get(person.userId)
        if (waiting === 'login') expect(factor).toBeUndefined()
        else {
          expect(factor).toBeTruthy()
          expect((await backupFor(person.userId)).includes(code)).toBe(false)
          expect(
            database.sqlite
              .prepare(
                'select revision from account_security where user_id = ?',
              )
              .get(person.userId),
          ).toEqual({ revision: 0 })
        }
      } finally {
        gate.release()
        await pending
        consumeSpy.mockRestore()
        commitSpy.mockRestore()
      }
    },
  )
})
