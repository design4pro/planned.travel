/**
 * The locale column, end to end: what may be written to it, what is read back out of it, and what
 * the migration does to the rows that were written before either rule existed.
 *
 * Three things are being pinned down here, and each of them was a real defect rather than a
 * hypothetical one. The column used to accept any 2-16 character string, so `__proto__` reached the
 * negotiator through a settings form. `getEffectiveSettings` returned the column verbatim, so a
 * caller could be handed a tag the message layer has no catalogue for. And the workspace default was
 * `en-GB` — not one of the twenty-three — so a naive membership test would have declared every
 * workspace created before this round unsupported and dropped it to `Accept-Language`, which is the
 * kind of bug a freshly seeded fixture never reproduces.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCALE_TAGS } from '#/lib/i18n/locales'
import {
  overrideOrNull,
  regionalSettingsInput,
  workspaceDefaultsInput,
} from '#/routes/_app/-server/settings'
import {
  ensureOrganizationSettings,
  ensureUserSettings,
  getEffectiveSettings,
  getUserSettings,
  localeSchema,
  organizationSettingsRepository,
  updateOrganizationSettings,
  updateUserSettings,
  userSettingsRepository,
} from '../settings'
import { createHarness } from './harness'

import type { AuthSession } from '#/server/auth/session'
import type { Harness, SeededTenant } from './harness'

/**
 * The settings form's schemas live beside their server function, and that module reaches a Worker
 * binding through `cloudflare:workers`, which does not resolve in this project's Node environment.
 * Both replacements are the same two adapters `src/server/fns/__tests__/locale.test.ts` replaces,
 * and for the same reason: neither is under test here. The schemas and the sentinel helper are pure,
 * and the repository half of the round trip runs against the real generated schema below.
 */
vi.mock('#/server/auth/session', () => ({
  getSession: async (): Promise<AuthSession | null> => null,
}))

vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('appScope is not reachable from this test')
  },
}))

/** Writes a locale straight to the column, bypassing the schema — how a legacy row got there. */
async function storeWorkspaceLocale(
  tenant: SeededTenant,
  locale: string,
): Promise<void> {
  const row = await ensureOrganizationSettings(tenant.scope)
  await organizationSettingsRepository.requireUpdate(tenant.scope, row.id, {
    locale,
  })
}

async function storeUserLocale(
  tenant: SeededTenant,
  userId: string,
  locale: string | null,
): Promise<void> {
  const row = await ensureUserSettings(tenant.scope, userId)
  await userSettingsRepository.requireUpdate(tenant.scope, row.id, { locale })
}

/** A complete regional-form submission, with one field overridden per test. */
function submission(locale: string): {
  locale: string
  timezone: string
  currency: string
  dateFormat: string
  weekStartsOn: number | null
  distanceUnit: '' | 'metric' | 'imperial'
} {
  return {
    locale,
    timezone: 'Europe/Warsaw',
    currency: 'PLN',
    dateFormat: 'dd MMM yyyy',
    weekStartsOn: 1,
    distanceUnit: 'metric',
  }
}

describe('locale persistence', () => {
  let harness: Harness
  let alpha: SeededTenant
  let beta: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    beta = await harness.seedTenant('beta')
  })

  describe('the write path', () => {
    it('rejects a tag the product does not ship, before it reaches D1', async () => {
      await expect(
        updateUserSettings(alpha.scope, { locale: 'xx-YY' }),
      ).rejects.toThrow()
      await expect(
        updateOrganizationSettings(alpha.scope, { locale: 'xx-YY' }),
      ).rejects.toThrow()

      const [user, workspace] = await Promise.all([
        getUserSettings(alpha.scope),
        ensureOrganizationSettings(alpha.scope),
      ])
      expect(user?.locale ?? null).toBeNull()
      expect(workspace.locale).toBe('en')
    })

    it('rejects the inherited property names free text used to let through', async () => {
      for (const attack of [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
      ]) {
        expect(() => localeSchema.parse(attack)).toThrow()
      }
    })

    it('rejects a form submission carrying an unshipped tag', () => {
      expect(() => regionalSettingsInput.parse(submission('xx-YY'))).toThrow()
      expect(() =>
        workspaceDefaultsInput.parse({
          ...submission('xx-YY'),
          defaultCurrency: 'PLN',
        }),
      ).toThrow()
    })

    it('accepts every tag the registry ships, and only those', () => {
      for (const tag of LOCALE_TAGS) {
        expect(localeSchema.parse(tag)).toBe(tag)
      }
      expect(() => localeSchema.parse('')).toThrow()
      expect(() => localeSchema.parse('e')).toThrow()
      expect(() => localeSchema.parse('en_GB')).toThrow()
    })

    it('canonicalises a legacy tag rather than refusing it', async () => {
      const cases: ReadonlyArray<readonly [string, string]> = [
        ['en-GB', 'en'],
        ['en-US', 'en'],
        ['pl-PL', 'pl'],
        ['ja-JP', 'ja'],
        ['de-DE', 'de'],
        ['pt-PT', 'pt-BR'],
        ['zh-TW', 'zh-Hant'],
        ['zh-Hant-TW', 'zh-Hant'],
        ['ZH-cn', 'zh-Hans'],
        ['  fr-FR  ', 'fr'],
      ]

      for (const [stored, shipped] of cases) {
        const row = await updateUserSettings(alpha.scope, { locale: stored })
        expect(row.locale).toBe(shipped)
      }

      const workspace = await updateOrganizationSettings(alpha.scope, {
        locale: 'en-GB',
      })
      expect(workspace.locale).toBe('en')
    })

    it('refuses a tag long enough to be an attack rather than a mistake', () => {
      expect(() => localeSchema.parse(`en-${'x-'.repeat(200)}`)).toThrow()
    })
  })

  describe('the follow-the-workspace sentinel', () => {
    it('maps the empty submission to NULL and a tag to itself', () => {
      expect(overrideOrNull('')).toBeNull()
      expect(overrideOrNull('pl')).toBe('pl')
    })

    it("round-trips `''` back to NULL so the workspace default takes over again", async () => {
      await storeWorkspaceLocale(alpha, 'ja-JP')

      const chosen = regionalSettingsInput.parse(submission('pl-PL'))
      await updateUserSettings(alpha.scope, {
        locale: overrideOrNull(chosen.locale),
      })
      expect((await getUserSettings(alpha.scope))?.locale).toBe('pl')
      expect((await getEffectiveSettings(alpha.scope)).locale).toBe('pl')

      const cleared = regionalSettingsInput.parse(submission(''))
      expect(cleared.locale).toBe('')
      await updateUserSettings(alpha.scope, {
        locale: overrideOrNull(cleared.locale),
      })

      expect((await getUserSettings(alpha.scope))?.locale).toBeNull()
      expect((await getEffectiveSettings(alpha.scope)).locale).toBe('ja')
    })
  })

  describe('getEffectiveSettings', () => {
    it('narrows a legacy workspace row to a shipped tag', async () => {
      for (const [stored, shipped] of [
        ['en-GB', 'en'],
        ['pl-PL', 'pl'],
        ['ja-JP', 'ja'],
        ['zh-Hant-TW', 'zh-Hant'],
      ] as const) {
        await storeWorkspaceLocale(alpha, stored)
        expect((await getEffectiveSettings(alpha.scope)).locale).toBe(shipped)
      }
    })

    it('defers an unresolvable personal override to the workspace, exactly as an absent one', async () => {
      await storeWorkspaceLocale(alpha, 'pl-PL')
      await storeUserLocale(alpha, alpha.ownerUserId, 'xx-YY')

      expect((await getEffectiveSettings(alpha.scope)).locale).toBe('pl')
    })

    it('falls back to the source locale when nothing stored resolves', async () => {
      await storeWorkspaceLocale(alpha, 'klingon')
      await storeUserLocale(alpha, alpha.ownerUserId, '__proto__')

      const settings = await getEffectiveSettings(alpha.scope)
      expect(settings.locale).toBe('en')
    })

    it('reads the traveller’s own write back from D1 in the same request', async () => {
      await updateUserSettings(alpha.scope, { locale: 'uk' })
      expect((await getEffectiveSettings(alpha.scope)).locale).toBe('uk')
    })

    it('gives a workspace created today a shipped tag, not the legacy default', async () => {
      const fresh = await harness.seedTenant('gamma')
      expect((await ensureOrganizationSettings(fresh.scope)).locale).toBe('en')
      expect((await getEffectiveSettings(fresh.scope)).locale).toBe('en')
    })
  })

  describe('tenancy', () => {
    it('cannot write another workspace’s language', async () => {
      await storeWorkspaceLocale(beta, 'ja-JP')
      await updateOrganizationSettings(alpha.scope, { locale: 'pl' })
      await updateUserSettings(alpha.scope, { locale: 'cs' })

      expect((await ensureOrganizationSettings(beta.scope)).locale).toBe(
        'ja-JP',
      )
      expect((await getEffectiveSettings(beta.scope)).locale).toBe('ja')
      expect((await getUserSettings(beta.scope))?.locale ?? null).toBeNull()
    })
  })

  describe('the 0002 migration', () => {
    /**
     * The shipped file, replayed against the generated schema.
     *
     * It is read from disk rather than restated here so that an edit to the migration has to keep
     * these rows resolving — the SQL is the thing under test, not a description of it.
     */
    function applyMigration(): void {
      const file = path.join(
        process.cwd(),
        'drizzle',
        '0002_locale_normalisation.sql',
      )
      const statements = readFileSync(file, 'utf8')
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter((statement) => statement !== '')

      for (const statement of statements) {
        harness.sqlite.exec(statement)
      }
    }

    it('normalises both columns and leaves a shipped tag alone', async () => {
      const traveller = await alpha.addUser('Second traveller')
      const third = await alpha.addUser('Third traveller')
      const betaTraveller = await beta.addUser('Beta traveller')

      await storeWorkspaceLocale(alpha, 'en-GB')
      await storeWorkspaceLocale(beta, 'ja-JP')
      await storeUserLocale(alpha, alpha.ownerUserId, 'pl-PL')
      await storeUserLocale(alpha, traveller, 'zh-TW')
      await storeUserLocale(alpha, third, 'xx-YY')
      await storeUserLocale(beta, betaTraveller, 'PT-pt')
      await storeUserLocale(beta, beta.ownerUserId, null)

      applyMigration()

      expect((await ensureOrganizationSettings(alpha.scope)).locale).toBe('en')
      expect((await ensureOrganizationSettings(beta.scope)).locale).toBe('ja')
      expect(
        (await getUserSettings(alpha.scope, alpha.ownerUserId))?.locale,
      ).toBe('pl')
      expect((await getUserSettings(alpha.scope, traveller))?.locale).toBe(
        'zh-Hant',
      )
      expect((await getUserSettings(alpha.scope, third))?.locale).toBeNull()
      expect((await getUserSettings(beta.scope, betaTraveller))?.locale).toBe(
        'pt-BR',
      )
      expect(
        (await getUserSettings(beta.scope, beta.ownerUserId))?.locale,
      ).toBeNull()
    })

    it('changes the column default so a row inserted without a locale is `en`', async () => {
      const fresh = await harness.seedTenant('delta')
      applyMigration()

      const table = harness.sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name = 'organization_settings'",
        )
        .get() as { sql: string } | undefined
      expect(table?.sql).toContain("`locale` text DEFAULT 'en' NOT NULL")

      harness.sqlite.exec(
        `INSERT INTO organization_settings (id, organization_id, created_at, updated_at)
         VALUES ('os_default_probe', '${fresh.organizationId}', 0, 0)`,
      )
      const probe = harness.sqlite
        .prepare(
          "SELECT locale FROM organization_settings WHERE id = 'os_default_probe'",
        )
        .get() as { locale: string } | undefined
      expect(probe?.locale).toBe('en')
    })

    it('leaves every shipped tag untouched', async () => {
      await storeWorkspaceLocale(alpha, 'zh-Hans')
      await storeUserLocale(alpha, alpha.ownerUserId, 'pt-BR')

      applyMigration()

      expect((await ensureOrganizationSettings(alpha.scope)).locale).toBe(
        'zh-Hans',
      )
      expect(
        (await getUserSettings(alpha.scope, alpha.ownerUserId))?.locale,
      ).toBe('pt-BR')
    })
  })
})
