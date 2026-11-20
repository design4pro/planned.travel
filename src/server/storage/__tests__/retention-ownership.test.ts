import { describe, expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { recordFile } from '#/server/repos/files'
import { createTrip } from '#/server/repos/trips'
import { createRetentionOwnership } from '../retention-ownership'

describe('weekly storage ownership', () => {
  it('checks exact organization IDs and finds private trips and file references only inside their tenant', async () => {
    const harness = await createHarness()
    try {
      const alpha = await harness.seedTenant('alpha')
      const beta = await harness.seedTenant('beta')
      const trip = await createTrip(alpha.scope, {
        title: 'Private trip',
        visibility: 'private',
      })
      const key = `trips/${alpha.organizationId}/${trip.id}/attachment.jpg`
      await recordFile(alpha.scope, {
        tripId: trip.id,
        storageKey: key,
        sizeBytes: 4,
        filename: 'attachment.jpg',
        contentType: 'image/jpeg',
      })

      const ownership = createRetentionOwnership(harness.db)
      await expect(
        ownership.organizationExists(alpha.organizationId),
      ).resolves.toBe(true)
      await expect(
        ownership.organizationExists(`${alpha.organizationId}-lookalike`),
      ).resolves.toBe(false)
      await expect(
        ownership.hasUploadReference(alpha.organizationId, trip.id, 'missing'),
      ).resolves.toBe(true)
      await expect(
        ownership.hasUploadReference(alpha.organizationId, 'missing', key),
      ).resolves.toBe(true)
      await expect(
        ownership.hasUploadReference(beta.organizationId, trip.id, key),
      ).resolves.toBe(false)
    } finally {
      harness.close()
    }
  })
})
