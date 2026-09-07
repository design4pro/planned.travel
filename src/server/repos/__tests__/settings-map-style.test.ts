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

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BASEMAP_IDS } from '#/lib/map/basemap'
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
import type { SeededTenant } from './harness'

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
  })
})
