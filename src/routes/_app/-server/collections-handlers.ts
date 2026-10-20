import { z } from 'zod'
import {
  collectionDeleteSummary,
  deleteCollection,
  setCollectionPlaceStatus,
  updateCollection,
} from '#/server/repos/collections'
import { appScope } from './context'
import {
  updateCollectionSchema,
  collectionIdSchema,
  deleteCollectionSchema,
  setPlaceStatusSchema,
} from './collections-wire'

export async function updateCollectionResult(
  input: z.infer<typeof updateCollectionSchema>,
) {
  const { collectionId, ...values } = updateCollectionSchema.parse(input)
  const collection = await updateCollection(await appScope(), collectionId, {
    ...values,
    description: values.description || null,
  })
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    colour: collection.colour,
  }
}
export async function collectionDeleteSummaryResult(
  input: z.infer<typeof collectionIdSchema>,
) {
  const { collectionId } = collectionIdSchema.parse(input)
  return collectionDeleteSummary(await appScope(), collectionId)
}
export async function deleteCollectionResult(
  input: z.infer<typeof deleteCollectionSchema>,
) {
  const { collectionId, confirmName } = deleteCollectionSchema.parse(input)
  const scope = await appScope()
  const summary = await collectionDeleteSummary(scope, collectionId)
  if (summary.requiresName) {
    z.literal(summary.name, {
      error: 'Type the collection name to confirm deletion.',
    }).parse(confirmName)
  }
  await deleteCollection(scope, collectionId)
  return { ok: true }
}
export async function setPlaceStatusResult(
  input: z.infer<typeof setPlaceStatusSchema>,
) {
  const { collectionPlaceId, status } = setPlaceStatusSchema.parse(input)
  const place = await setCollectionPlaceStatus(
    await appScope(),
    collectionPlaceId,
    status,
  )
  return { id: place.id, status: place.status }
}
