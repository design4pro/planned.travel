import { describe, expect, it } from 'vitest'

import { ABSENT } from '#/lib/absence'
import {
  ForbiddenError,
  NotFoundError,
  TenantIsolationError,
} from '#/server/repos'

import { nullWhenMissing, orAbsent } from '../-lib/absence'

describe('orAbsent', () => {
  it('adds the found flag to a payload', async () => {
    await expect(orAbsent(async () => ({ title: 'Kyoto' }))).resolves.toEqual({
      found: true,
      title: 'Kyoto',
    })
  })

  it('answers the same bare result for any not-found error', async () => {
    for (const error of [
      new NotFoundError('trip', 'foreign-id'),
      new NotFoundError('journey', 'missing-id'),
    ]) {
      await expect(
        orAbsent(async () => {
          throw error
        }),
      ).resolves.toStrictEqual(ABSENT)
    }
  })

  it.each([
    new ForbiddenError('read', ['owner']),
    new TenantIsolationError('trip'),
    new Error('Database unavailable'),
  ])('rethrows every other failure: %s', async (error) => {
    await expect(
      orAbsent(async () => {
        throw error
      }),
    ).rejects.toBe(error)
  })
})

describe('nullWhenMissing', () => {
  it('answers the row it read', async () => {
    await expect(nullWhenMissing(async () => 'trip')).resolves.toBe('trip')
  })

  it('answers null for a not-found error and rethrows anything else', async () => {
    await expect(
      nullWhenMissing(async () => {
        throw new NotFoundError('trip', 'x')
      }),
    ).resolves.toBeNull()
    const refusal = new ForbiddenError('read', ['owner'])
    await expect(
      nullWhenMissing(async () => {
        throw refusal
      }),
    ).rejects.toBe(refusal)
  })
})
