/**
 * The map-style column: what may be written to it, and what is read back out of it.
 *
 * Two rules, deliberately asymmetric. The write side refuses anything outside the catalogue in
 * `src/lib/map/basemap.ts` — the column used to take any 1-64 character string, which is how a
 * preference no map has ever heard of gets persisted for the life of a workspace. The read side
 * degrades instead: a row written before the catalogue existed resolves to `auto` rather than
 * throwing, because a settings screen that 500s on a stale string is worse than one that shows a
 * default.
 *
 * The third thing pinned here is the defect the catalogue exposed. `''` is the
 * follow-the-workspace sentinel every override field on these forms already uses, and the
 * appearance handler was the one caller that dropped it on the floor as `undefined` — so "Follow the
 * workspace" wrote nothing and the member's row kept pinning a snapshot of the workspace value.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { generateSQLiteDrizzleJson } from 'drizzle-kit/api'
import { generateSQLiteMigration } from 'drizzle-kit/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BASEMAP_IDS, resolveBasemap } from '#/lib/map/basemap'
import { overrideOrNull } from '#/routes/_app/-server/settings'
import {
  ensureOrganizationSettings,
  ensureUserSettings,
  getEffectiveSettings,
  organizationSettingsRepository,
  updateOrganizationSettingsInput,
  updateUserSettingsInput,
  userSettingsRepository,
} from '../settings'
import { createHarness } from './harness'

import type { AuthSession } from '#/server/auth/session'
import type { Harness, SeededTenant } from './harness'

/**
 * As in `settings-locale.test.ts`: the sentinel helper lives beside its server function, and that
 * module reaches a Worker binding through `cloudflare:workers`, which does not resolve in this
 * project's Node environment. Neither adapter is under test here.
 */
vi.mock('#/server/auth/session', () => ({
  getSession: async (): Promise<AuthSession | null> => null,
}))

vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('appScope is not reachable from this test')
  },
}))

/** Writes a map style straight to the column, bypassing the schema — how a legacy row got there. */
async function storeWorkspaceMapStyle(
  tenant: SeededTenant,
  mapStyle: string,
): Promise<void> {
  const row = await ensureOrganizationSettings(tenant.scope)
  await organizationSettingsRepository.requireUpdate(tenant.scope, row.id, {
    mapStyle,
  })
}

async function storeUserMapStyle(
  tenant: SeededTenant,
  mapStyle: string | null,
): Promise<void> {
  const row = await ensureUserSettings(tenant.scope)
  await userSettingsRepository.requireUpdate(tenant.scope, row.id, { mapStyle })
}

/**
 * The shipped migration, split the way drizzle-kit and wrangler both apply it.
 *
 * Read from disk rather than restated here, so an edit to the file has to keep these rows
 * resolving: the SQL is the thing under test, not a description of it. Same helper, same reason as
 * `settings-locale.test.ts`.
 */
function migrationStatements(): ReadonlyArray<string> {
  const file = path.join(process.cwd(), 'drizzle', '0010_basemap_default.sql')
  return readFileSync(file, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '')
}

describe('map style persistence', () => {
  describe('the write path', () => {
    it('rejects an id the catalogue does not ship', () => {
      for (const unknown of [
        'planned-neon',
        'workspace',
        'PLANNED-LIGHT',
        '',
      ]) {
        expect(() =>
          updateUserSettingsInput.parse({ mapStyle: unknown }),
        ).toThrow()
        expect(() =>
          updateOrganizationSettingsInput.parse({ mapStyle: unknown }),
        ).toThrow()
      }
    })

    it('accepts every id the catalogue ships, on both rows', () => {
      for (const id of BASEMAP_IDS) {
        expect(updateUserSettingsInput.parse({ mapStyle: id }).mapStyle).toBe(
          id,
        )
        expect(
          updateOrganizationSettingsInput.parse({ mapStyle: id }).mapStyle,
        ).toBe(id)
      }
    })

    /**
     * `null` is the cleared override and has to survive the narrowing: it is what makes
     * `getEffectiveSettings` fall back to the workspace row. `undefined` is the other half — the
     * patch simply does not carry the column, and `definedOnly` keeps it out of the `SET` clause.
     */
    it('keeps `null` and absence meaningful on the member row', () => {
      expect(
        updateUserSettingsInput.parse({ mapStyle: null }).mapStyle,
      ).toBeNull()
      expect(updateUserSettingsInput.parse({}).mapStyle).toBeUndefined()
    })
  })

  /** The two halves of the appearance defect, in the one place the sentinel is converted. */
  describe('the follow-the-workspace sentinel', () => {
    it('maps the empty submission to NULL and an id to itself', () => {
      expect(overrideOrNull('')).toBeNull()
      expect(overrideOrNull('planned-dark')).toBe('planned-dark')
    })
  })

  describe('getEffectiveSettings', () => {
    let alpha: SeededTenant

    beforeEach(async () => {
      alpha = await (await createHarness()).seedTenant('alpha')
    })

    /**
     * The defect this column's default carried into the catalogue round.
     *
     * `organization_settings.map_style` defaulted to `planned-light`, and that is a *valid*
     * catalogue id, so the `.catch('auto')` on the read seam never fired for it. While the column
     * was written but never read that was inert. The moment `MapCanvas` started resolving the
     * stored id instead of `useTheme().resolved`, it stopped being inert: `BASEMAPS['planned-light']`
     * pins `palette: 'light'`, so every workspace whose owner had never opened
     * `/settings/appearance` rendered a permanently paper map under a dark chrome.
     *
     * The assertion is deliberately on the resolved palette and not just on the stored id: what
     * regressed was the map following the theme, and `auto` is only the fix because its palette is
     * `null`. A future default that is once again a pinned entry fails this, which the id-only
     * check would not catch.
     */
    it('leaves a workspace that never chose a basemap following the chrome theme', async () => {
      const effective = await getEffectiveSettings(alpha.scope)
      expect(effective.mapStyle).toBe('auto')

      for (const theme of ['light', 'dark'] as const) {
        expect(resolveBasemap(effective.mapStyle, theme).theme).toBe(theme)
      }
    })

    it('reads a stored id the catalogue no longer knows as `auto`', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-neon')
      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe('auto')

      await storeUserMapStyle(alpha, 'charcoal-v2')
      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe('auto')
    })

    it('prefers the member override and falls back to the workspace once it is cleared', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-light')
      await storeUserMapStyle(alpha, 'planned-quiet')
      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-quiet',
      )

      await storeUserMapStyle(alpha, overrideOrNull(''))
      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-light',
      )
    })

    it('keeps a member override the catalogue knows over a workspace value it does not', async () => {
      // The degrade and the precedence are separate rules, and this is the row
      // where they meet: a workspace still holding a string from before the
      // catalogue must not drag a member's good pick down to `auto` with it.
      await storeWorkspaceMapStyle(alpha, 'planned-neon')
      await storeUserMapStyle(alpha, 'planned-dark')
      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-dark',
      )
    })
  })

  /**
   * The rows written under the old default, and the default itself.
   *
   * Changing `src/server/db/schema.ts` fixes only what a *new* workspace inserts. Every workspace
   * created before this round still stores `planned-light`, so without the data half the regression
   * above survives the fix for the entire existing estate.
   */
  describe('the 0010 migration', () => {
    let harness: Harness
    let alpha: SeededTenant
    let beta: SeededTenant

    beforeEach(async () => {
      harness = await createHarness()
      alpha = await harness.seedTenant('alpha')
      beta = await harness.seedTenant('beta')
    })

    /** The shipped file, replayed against the generated schema. */
    function applyMigration(): void {
      for (const statement of migrationStatements()) {
        harness.sqlite.exec(statement)
      }
    }

    /**
     * The file claims its first half is `pnpm db:generate` output. This is that claim, checked.
     *
     * `db:generate` diffs the previous snapshot against the one this step recorded, and
     * `drizzle-kit/api` exposes exactly that pair. Re-deriving it here catches a hand-edited DDL
     * half, a schema default left at `planned-light` behind a migration that says `auto`, or a
     * `meta/0010_snapshot.json` that no longer describes the SQL shipped beside it — each of which
     * makes the next `db:generate` emit a further migration undoing this one.
     */
    it('carries the DDL `pnpm db:generate` produces, statement for statement', async () => {
      const snapshot = (
        name: string,
      ): Awaited<ReturnType<typeof generateSQLiteDrizzleJson>> =>
        JSON.parse(
          readFileSync(
            path.join(process.cwd(), 'drizzle', 'meta', name),
            'utf8',
          ),
        ) as Awaited<ReturnType<typeof generateSQLiteDrizzleJson>>

      const generated = (
        await generateSQLiteMigration(
          snapshot('0009_snapshot.json'),
          snapshot('0010_snapshot.json'),
        )
      ).map((statement) => statement.trim())

      const shipped = migrationStatements()
      expect(generated.length).toBeGreaterThan(0)
      expect(shipped.slice(0, generated.length)).toEqual(generated)

      // …and the hand-written half is still there, so a truncated file cannot pass the line above.
      // It is matched with `endsWith` rather than equality because the remap carries the prose
      // explaining itself, and comments share the statement they precede.
      expect(shipped.length).toBe(generated.length + 2)
      expect(shipped.at(-2)).toMatch(
        /^UPDATE `user_settings` SET `map_style` = NULL WHERE `map_style` = \(SELECT `os`\.`map_style` FROM `organization_settings` AS `os` WHERE `os`\.`organization_id` = `user_settings`\.`organization_id`\);$/m,
      )
      expect(shipped.at(-1)).toMatch(
        /UPDATE `organization_settings` SET `map_style` = 'auto' WHERE `map_style` = 'planned-light';$/,
      )
    })

    /**
     * drizzle-kit applies by journal entry and wrangler by filename, so a missing entry is how a
     * second file lands in this slot under a random name and then runs in the wrong order.
     */
    it('is recorded in drizzle’s own bookkeeping', () => {
      const journal = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '_journal.json'),
          'utf8',
        ),
      ) as { entries: ReadonlyArray<{ idx: number; tag: string }> }

      expect(journal.entries.map((entry) => entry.idx)).toEqual(
        journal.entries.map((_, i) => i),
      )
      expect(journal.entries[10]?.tag).toBe('0010_basemap_default')

      const snapshot = JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'drizzle', 'meta', '0010_snapshot.json'),
          'utf8',
        ),
      ) as {
        tables: {
          organization_settings: { columns: { map_style: { default: string } } }
        }
      }
      expect(
        snapshot.tables.organization_settings.columns.map_style.default,
      ).toBe("'auto'")
    })

    it('remaps the workspaces still holding the old default', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-light')
      await storeWorkspaceMapStyle(beta, 'planned-light')

      applyMigration()

      for (const tenant of [alpha, beta]) {
        const effective = await getEffectiveSettings(tenant.scope)
        expect(effective.mapStyle).toBe('auto')
        expect(resolveBasemap(effective.mapStyle, 'dark').theme).toBe('dark')
      }
    })

    /**
     * `planned-dark` was never a DDL default, so a row holding it was chosen on the appearance
     * screen and has to survive — the migration remaps an inherited default, not a preference.
     */
    it('leaves a deliberate workspace pick alone', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-dark')

      applyMigration()

      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-dark',
      )
    })

    /**
     * The member column carries the same ambiguity as the workspace one, for a different reason:
     * NULL was not the only way to say "follow the workspace". The old appearance screen wrote a
     * *snapshot* of the workspace value for that choice and read it back through the same
     * equality, so a member row equal to its workspace is a follow, not an override — and left in
     * place it would outlive the remap below it and pin paper under a dark chrome, which is the
     * regression this whole migration exists to prevent.
     */
    it('clears a member row that only snapshotted the workspace value', async () => {
      await storeWorkspaceMapStyle(beta, 'planned-light')
      await storeUserMapStyle(beta, 'planned-light')

      applyMigration()

      const effective = await getEffectiveSettings(beta.scope)
      expect(effective.mapStyle).toBe('auto')
      expect(resolveBasemap(effective.mapStyle, 'dark').theme).toBe('dark')
    })

    /** A member row that differs from its workspace is the pick the old screen showed as a pick. */
    it('keeps a member override that differs from the workspace', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-dark')
      await storeUserMapStyle(alpha, 'planned-light')

      applyMigration()

      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-light',
      )
    })

    /**
     * One tenant's member row must not be cleared by another tenant's workspace value. The
     * correlated subquery joins on `organization_id`; without that join every member row holding
     * *any* workspace's value would be wiped.
     */
    it('correlates the member clear to that member’s own workspace', async () => {
      await storeWorkspaceMapStyle(alpha, 'planned-dark')
      await storeWorkspaceMapStyle(beta, 'planned-light')
      await storeUserMapStyle(alpha, 'planned-light')
      await storeUserMapStyle(beta, 'planned-light')

      applyMigration()

      expect((await getEffectiveSettings(alpha.scope)).mapStyle).toBe(
        'planned-light',
      )
      expect((await getEffectiveSettings(beta.scope)).mapStyle).toBe('auto')
    })

    it('changes the column default so a row inserted without a style is `auto`', async () => {
      const fresh = await harness.seedTenant('delta')
      applyMigration()

      const table = harness.sqlite
        .prepare(
          "SELECT sql FROM sqlite_master WHERE name = 'organization_settings'",
        )
        .get() as { sql: string } | undefined
      expect(table?.sql).toContain("`map_style` text DEFAULT 'auto' NOT NULL")

      harness.sqlite.exec(
        `INSERT INTO organization_settings (id, organization_id, created_at, updated_at)
         VALUES ('os_basemap_probe', '${fresh.organizationId}', 0, 0)`,
      )
      const probe = harness.sqlite
        .prepare(
          "SELECT map_style FROM organization_settings WHERE id = 'os_basemap_probe'",
        )
        .get() as { map_style: string } | undefined
      expect(probe?.map_style).toBe('auto')
    })
  })
})
