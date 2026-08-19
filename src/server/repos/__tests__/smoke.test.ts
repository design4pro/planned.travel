import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { createScope } from '../base'
import { MissingTenantContextError } from '../context'
import * as repos from '..'
import { createHarness } from './harness'

describe('smoke', () => {
  it('runs sqlite', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('create table t(a integer)')
    expect(db.prepare('select 1 as x').get()).toEqual({ x: 1 })
  })

  it('migrates the whole schema into the test database', async () => {
    const harness = await createHarness()
    try {
      const tables = harness.tableNames()

      // Both halves of the model: the auth tables and the domain tables.
      expect(tables).toContain('organization')
      expect(tables).toContain('trips')
      expect(tables).toContain('vacay_entries')
      expect(tables).toContain('app_settings')
      expect(tables.length).toBeGreaterThanOrEqual(60)
    } finally {
      harness.close()
    }
  })

  it('exposes every module through the barrel', () => {
    // Also proves the barrel loads: a cycle between two repository modules would fail here.
    for (const name of [
      'createScope',
      'createTrip',
      'getTripItinerary',
      'getMemberBalances',
      'getDashboardSummary',
      'getPlanOverview',
      'appSettingsStore',
      'runBatch',
    ]) {
      expect(repos).toHaveProperty(name)
    }
  })

  it('refuses to build a scope without a tenant context', async () => {
    const harness = await createHarness()
    try {
      expect(() => createScope(harness.db, null)).toThrow(MissingTenantContextError)
      expect(() => createScope(harness.db, { userId: 'u1' })).toThrow(MissingTenantContextError)
      expect(() =>
        createScope(harness.db, { userId: 'u1', organizationId: 'o1', role: 'superuser' }),
      ).toThrow(MissingTenantContextError)

      const scope = createScope(harness.db, {
        userId: 'u1',
        organizationId: 'o1',
        role: 'owner',
      })
      expect(scope.ctx.organizationId).toBe('o1')
      expect(Object.isFrozen(scope)).toBe(true)
    } finally {
      harness.close()
    }
  })
})
