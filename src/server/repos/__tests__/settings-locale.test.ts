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

import type {
  generateSQLiteDrizzleJson} from 'drizzle-kit/api';
import {
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCALE_TAGS } from '#/lib/i18n/locales'
import {
  languagePreferenceInput,
  overrideOrNull,
  regionalSettingsInput,
  workspaceDefaultsInput,
} from '#/routes/_app/-server/settings'
import { ForbiddenError } from '../context'
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
import { captureError, createHarness } from './harness'

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

/**
 * The shipped migration, split into the statements wrangler would run.
 *
 * Read from disk rather than restated in the test, so an edit to the SQL has to keep these rows
 * resolving: the file is the thing under test, not a description of it.
 */
function migrationStatements(): ReadonlyArray<string> {
  const file = path.join(
    process.cwd(),
    'drizzle',
    '0002_locale_normalisation.sql',
  )
  return readFileSync(file, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '')
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

  describe('the locale-only write path', () => {
    /**
     * A chip click in the language picker changes one column, and the form input cannot express that.
     *
     * `regionalSettingsInput` requires all six regional fields, so a payload carrying only `locale`
     * never parses; and because `''` clears an override in every one of them, a client that padded
     * the other five to satisfy the schema would blank the traveller's timezone, currency, date
     * format and distance unit on the way past. Both halves of that are asserted here, because
     * either one alone would make `languagePreferenceInput` look like duplication.
     */
    it('accepts a payload the six-field form refuses', () => {
      expect(languagePreferenceInput.parse({ locale: 'pl' }).locale).toBe('pl')
      expect(() => regionalSettingsInput.parse({ locale: 'pl' })).toThrow()
    })

    it('narrows and canonicalises exactly as the form does', () => {
      expect(languagePreferenceInput.parse({ locale: 'ja-JP' }).locale).toBe(
        'ja',
      )
      expect(languagePreferenceInput.parse({ locale: '' }).locale).toBe('')
      expect(() => languagePreferenceInput.parse({ locale: 'xx-YY' })).toThrow()
      expect(() =>
        languagePreferenceInput.parse({ locale: '__proto__' }),
      ).toThrow()
    })

    it('leaves every other override on the row untouched', async () => {
      await updateUserSettings(alpha.scope, {
        locale: 'de',
        timezone: 'Europe/Warsaw',
        currency: 'PLN',
        dateFormat: 'dd MMM yyyy',
        weekStartsOn: 1,
        distanceUnit: 'imperial',
      })

      const chosen = languagePreferenceInput.parse({ locale: 'ko' })
      const row = await updateUserSettings(alpha.scope, {
        locale: overrideOrNull(chosen.locale),
      })

      expect(row.locale).toBe('ko')
      expect(row.timezone).toBe('Europe/Warsaw')
      expect(row.currency).toBe('PLN')
      expect(row.dateFormat).toBe('dd MMM yyyy')
      expect(row.weekStartsOn).toBe(1)
      expect(row.distanceUnit).toBe('imperial')
    })

    it('clears only the language when the workspace chip is clicked', async () => {
      await storeWorkspaceLocale(alpha, 'pl')
      await updateUserSettings(alpha.scope, {
        locale: 'ko',
        timezone: 'Asia/Seoul',
      })

      const cleared = languagePreferenceInput.parse({ locale: '' })
      const row = await updateUserSettings(alpha.scope, {
        locale: overrideOrNull(cleared.locale),
      })

      expect(row.locale).toBeNull()
      expect(row.timezone).toBe('Asia/Seoul')
      expect((await getEffectiveSettings(alpha.scope)).locale).toBe('pl')
    })
  })

  describe('authorisation', () => {
    /**
     * `member` is this model's least-privileged role — the one `loadOrganizationSettings` reports as
     * `viewerRole` with `canAdminister: false`, which disables the form on the screen and nothing
     * more. The workspace row it would have written is the language, currency, timezone, date
     * format, week start and distance unit that every member without an override reads, so the
     * refusal has to happen on the server.
     */
    it('refuses a viewer the workspace-wide language', async () => {
      const viewerUserId = await alpha.addUser('Viewer', 'member')
      const viewer = alpha.scopeFor(viewerUserId, 'member')
      await storeWorkspaceLocale(alpha, 'pl')

      const error = await captureError(() =>
        updateOrganizationSettings(viewer, { locale: 'ja' }),
      )
      expect(error).toBeInstanceOf(ForbiddenError)
      expect((await ensureOrganizationSettings(alpha.scope)).locale).toBe('pl')
    })

    it('refuses a viewer the other five workspace defaults too', async () => {
      const viewerUserId = await alpha.addUser('Viewer', 'member')
      const viewer = alpha.scopeFor(viewerUserId, 'member')

      for (const patch of [
        { defaultCurrency: 'USD' },
        { timezone: 'America/New_York' },
        { dateFormat: 'MM/dd/yyyy' },
        { weekStartsOn: 0 },
        { distanceUnit: 'imperial' },
      ] as const) {
        expect(
          await captureError(() => updateOrganizationSettings(viewer, patch)),
        ).toBeInstanceOf(ForbiddenError)
      }

      const row = await ensureOrganizationSettings(alpha.scope)
      expect(row.defaultCurrency).toBe('EUR')
      expect(row.timezone).toBe('UTC')
      expect(row.weekStartsOn).toBe(1)
      expect(row.distanceUnit).toBe('metric')
    })

    it('lets an admin set the workspace language, a viewer their own', async () => {
      const adminUserId = await alpha.addUser('Admin', 'admin')
      const admin = alpha.scopeFor(adminUserId, 'admin')
      const workspace = await updateOrganizationSettings(admin, {
        locale: 'sv',
      })
      expect(workspace.locale).toBe('sv')

      const viewerUserId = await alpha.addUser('Viewer', 'member')
      const viewer = alpha.scopeFor(viewerUserId, 'member')
      const own = await updateUserSettings(viewer, { locale: 'tr' })
      expect(own.locale).toBe('tr')
      expect((await getEffectiveSettings(viewer, viewerUserId)).locale).toBe(
        'tr',
      )
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
      for (const statement of migrationStatements()) {
        harness.sqlite.exec(statement)
      }
    }

    /**
     * The file claims its first half is `pnpm db:generate` output. This is that claim, checked.
     *
     * `db:generate` diffs the previous snapshot against the live schema; `drizzle-kit/api` exposes
     * exactly that pair, and the harness already uses it to build this database. So the DDL is
     * re-derived from `drizzle/meta/0001_snapshot.json` plus `src/server/db/schema.ts` and compared
     * statement by statement. What this catches is the failure the round-5 audit found: a hand-edited
     * DDL half, a schema default left at `en-GB` behind a migration that says `en`, or a
     * `meta/0002_snapshot.json` that no longer describes the SQL shipped beside it — each of which
     * makes the *next* `db:generate` emit a fourth migration undoing this one.
     */
    it('carries the DDL `pnpm db:generate` produces, statement for statement', async () => {
      const previous = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '0001_snapshot.json'),
          'utf8',
        ),
      ) as Awaited<ReturnType<typeof generateSQLiteDrizzleJson>>
      // The recorded state *after* this migration, not the live schema. Diffing against the live
      // schema only produced this migration while it was the newest one; phases A and B now sit
      // behind it, so a live diff would emit their DDL too and stall on their column rename. The
      // claim under test is about this step, and 0002_snapshot.json is what this step produced.
      const current = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '0002_snapshot.json'),
          'utf8',
        ),
      ) as Awaited<ReturnType<typeof generateSQLiteDrizzleJson>>
      const generated = (await generateSQLiteMigration(previous, current)).map(
        (statement) => statement.trim(),
      )

      const shipped = migrationStatements()
      expect(generated.length).toBeGreaterThan(0)
      expect(shipped.slice(0, generated.length)).toEqual(generated)

      // …and the hand-written half is still there, so a truncated file cannot pass the line above.
      expect(shipped.length).toBeGreaterThan(generated.length)
      expect(shipped.at(-1)).toBe('DROP TABLE `__locale_normalisation`;')
    })

    /**
     * drizzle-kit applies by journal entry and wrangler by filename, so a missing entry is how a
     * second file lands in the 0002 slot under a random name and then runs in the wrong order.
     */
    it('is recorded in drizzle’s own bookkeeping', () => {
      const journal = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '_journal.json'),
          'utf8',
        ),
      ) as { entries: ReadonlyArray<{ idx: number; tag: string }> }

      // The idx sequence has to be gapless and start at zero — that is what makes "applied in
      // order" mean anything — but its length is not this test's business. It was [0, 1, 2] when
      // this migration was the newest; phases A and B landed three more behind it in the merge, and
      // pinning the count would have made every future migration fail a locale test.
      expect(journal.entries.map((entry) => entry.idx)).toEqual(
        journal.entries.map((_, i) => i),
      )
      expect(journal.entries[2]?.tag).toBe('0002_locale_normalisation')

      const snapshot = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '0002_snapshot.json'),
          'utf8',
        ),
      ) as {
        tables: {
          organization_settings: { columns: { locale: { default: string } } }
        }
      }
      expect(snapshot.tables.organization_settings.columns.locale.default).toBe(
        "'en'",
      )
    })

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
