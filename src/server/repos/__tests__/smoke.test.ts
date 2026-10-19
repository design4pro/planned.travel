import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { inArray } from 'drizzle-orm'
import { trips } from '#/server/db/schema'
import { createScope } from '../base'
import { MAX_BOUND_PARAMETERS } from '../batch'
import { MissingTenantContextError } from '../context'
import * as repos from '..'
import { captureError, constraintName, createHarness } from './harness'

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

  it('refuses a statement D1 would refuse for its bound parameters', async () => {
    const harness = await createHarness()
    const ids = (count: number) =>
      Array.from({ length: count }, (_, index) => `trip-${index}`)
    try {
      const atCeiling = harness.db
        .select({ id: trips.id })
        .from(trips)
        .where(inArray(trips.id, ids(MAX_BOUND_PARAMETERS)))
      await expect(atCeiling).resolves.toEqual([])

      const overCeiling = harness.db
        .select({ id: trips.id })
        .from(trips)
        .where(inArray(trips.id, ids(MAX_BOUND_PARAMETERS + 1)))
      const error = await captureError(() => overCeiling)
      expect(constraintName(error)).toMatch(/101 bound parameters/)
    } finally {
      harness.close()
    }
  })

  it('refuses to build a scope without a tenant context', async () => {
    const harness = await createHarness()
    try {
      expect(() => createScope(harness.db, null)).toThrow(
        MissingTenantContextError,
      )
      expect(() => createScope(harness.db, { userId: 'u1' })).toThrow(
        MissingTenantContextError,
      )
      expect(() =>
        createScope(harness.db, {
          userId: 'u1',
          organizationId: 'o1',
          role: 'superuser',
          impersonatedBy: null,
        }),
      ).toThrow(MissingTenantContextError)

      const scope = createScope(harness.db, {
        userId: 'u1',
        organizationId: 'o1',
        role: 'owner',
        impersonatedBy: null,
      })
      expect(scope.ctx.organizationId).toBe('o1')
      expect(Object.isFrozen(scope)).toBe(true)
    } finally {
      harness.close()
    }
  })
})
