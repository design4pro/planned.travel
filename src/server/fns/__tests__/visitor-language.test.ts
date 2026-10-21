import { globSync, readFileSync } from 'node:fs'
import { requestHandler } from '@tanstack/react-start/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import type * as StartModule from '@tanstack/react-start'
import type * as ReposModule from '#/server/repos'

import { LOCALE_TAGS } from '#/lib/i18n/locales'
import type { TenantScope } from '#/server/repos'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  scope: {} as TenantScope,
  effective: vi.fn(),
  update: vi.fn(),
}))

// Preserve the handlers and validators; only replace the RPC transport stripped by Start.
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof StartModule>()),
  createServerFn: () => ({
    handler: <R>(handler: () => Promise<R>) => handler,
    validator: <T>(schema: ZodType<T>) => ({
      handler:
        <R>(handler: (ctx: { data: T }) => Promise<R>) =>
        async ({ data }: { data: unknown }) =>
          handler({ data: schema.parse(data) }),
    }),
  }),
}))
vi.mock('#/server/auth/session', () => ({ getSession: state.session }))
vi.mock('../context', () => ({ appScope: async () => state.scope }))
vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async () => state.scope,
}))
vi.mock('#/server/repos', async (importOriginal) => ({
  ...(await importOriginal<typeof ReposModule>()),
  updateUserSettings: state.update,
  getEffectiveSettings: state.effective,
}))

const { saveVisitorLanguage, negotiateRequestLocale } =
  await import('../locale')
const { saveLanguagePreference } =
  await import('#/routes/_app/-server/settings')

async function request(
  url: string,
  call: () => Promise<unknown>,
  headers?: HeadersInit,
) {
  let result: unknown
  const response = await requestHandler(async () => {
    result = await call()
    return new Response(null, { status: 204 })
  })(new Request(url, { method: 'POST', headers }), {})
  return { response, result }
}

beforeEach(() => {
  state.session.mockReset().mockResolvedValue(null)
  state.update
    .mockReset()
    .mockImplementation(async (_scope, patch) => ({ locale: patch.locale }))
  state.effective.mockReset().mockResolvedValue({ locale: 'pl' })
})

describe('visitor save', () => {
  it.each(LOCALE_TAGS)(
    'saves %s without a session or a database read/write',
    async (locale) => {
      const { response, result } = await request(
        'https://planned.travel/_serverFn/language',
        () => saveVisitorLanguage({ data: { locale } }),
      )
      expect(result).toEqual({ locale })
      expect(response.headers.get('set-cookie')).toBe(
        `planned.locale=${locale}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`,
      )
      expect(state.session).not.toHaveBeenCalled()
      expect(state.update).not.toHaveBeenCalled()
      expect(state.effective).not.toHaveBeenCalled()
    },
  )

  it.each(['', 'is', 'constructor', '__proto__', 'pl\r\nX-Test: injected'])(
    'rejects %s before writing',
    async (locale) => {
      await expect(
        saveVisitorLanguage({ data: { locale: locale as 'pl' } }),
      ).rejects.toThrow()
      expect(state.update).not.toHaveBeenCalled()
    },
  )

  it('omits Secure on local HTTP despite forwarded protocol claims', async () => {
    const { response } = await request(
      'http://localhost/_serverFn/language',
      () => saveVisitorLanguage({ data: { locale: 'de' } }),
      { 'x-forwarded-proto': 'https' },
    )
    expect(response.headers.get('set-cookie')).toBe(
      'planned.locale=de; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax',
    )
  })

  it('wires the anonymous cookie into request negotiation', async () => {
    const { result } = await request(
      'https://planned.travel/',
      () => negotiateRequestLocale(),
      { cookie: 'planned.locale=pl', 'accept-language': 'de' },
    )
    expect(result).toEqual({ locale: 'pl', dir: 'ltr', signedIn: false })
    expect(state.session).toHaveBeenCalledTimes(1)
    expect(state.effective).not.toHaveBeenCalled()
  })
})

describe('signed-in language save', () => {
  it.each([
    { choice: 'de', effective: 'de', stored: 'de' },
    { choice: '', effective: 'pl', stored: null },
  ] as const)(
    'writes the effective choice after $choice',
    async ({ choice, effective, stored }) => {
      state.effective.mockResolvedValue({ locale: effective })
      const { response, result } = await request(
        'https://planned.travel/_serverFn/language',
        () => saveLanguagePreference({ data: { locale: choice } }),
      )
      expect(result).toEqual({ locale: stored })
      expect(state.update).toHaveBeenCalledWith(state.scope, { locale: stored })
      expect(state.effective).toHaveBeenCalledWith(state.scope)
      expect(response.headers.get('set-cookie')).toContain(
        `planned.locale=${effective};`,
      )
      expect(state.update.mock.invocationCallOrder[0]).toBeLessThan(
        state.effective.mock.invocationCallOrder[0],
      )
    },
  )

  it('does not set the cookie if the write fails', async () => {
    state.update.mockRejectedValue(new Error('write failed'))
    const { response } = await request(
      'https://planned.travel/_serverFn/language',
      () => saveLanguagePreference({ data: { locale: 'de' } }),
    )
    expect(response.status).toBe(500)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(state.effective).not.toHaveBeenCalled()
  })

  it('does not set the cookie if the effective-language read fails', async () => {
    state.effective.mockRejectedValue(new Error('read failed'))
    const { response } = await request(
      'https://planned.travel/_serverFn/language',
      () => saveLanguagePreference({ data: { locale: '' } }),
    )
    expect(response.status).toBe(500)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('pins the stored-language writers and the unused regional RPC', () => {
    const settings = readFileSync('src/routes/_app/-server/settings.ts', 'utf8')
    const localeWrites = [
      ...settings.matchAll(/updateUserSettings\(scope,\s*\{\s*locale:/g),
    ]
    expect(localeWrites).toHaveLength(2)
    const files = globSync('src/**/*.{ts,tsx}')
      .filter((path) => !path.includes('__tests__'))
      .map((path) => ({ path, content: readFileSync(path, 'utf8') }))
    const writers = files.flatMap(({ path, content }) =>
      [
        ...content.matchAll(/updateUserSettings\([^,]+,\s*\{[^}]*\blocale:/g),
      ].map(() => path),
    )
    expect(writers).toEqual([
      'src/routes/_app/-server/settings.ts',
      'src/routes/_app/-server/settings.ts',
    ])
    const callers = files.filter(({ content }) =>
      /saveRegionalSettings\s*\(/.test(content),
    )
    expect(callers).toEqual([])
  })
})
