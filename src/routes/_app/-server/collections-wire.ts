import { z } from 'zod'
import { COLLECTION_PLACE_STATUSES } from '#/server/db/schema'
import {
  colourSchema,
  idSchema,
  longTextSchema,
  titleSchema,
} from '#/server/repos/validation'

export const updateCollectionSchema = z.strictObject({
  collectionId: idSchema,
  name: titleSchema,
  description: longTextSchema,
  colour: colourSchema,
})
export const collectionIdSchema = z.strictObject({ collectionId: idSchema })
export const deleteCollectionSchema = z.strictObject({
  collectionId: idSchema,
  confirmName: z.string().optional(),
})
export const setPlaceStatusSchema = z.strictObject({
  collectionPlaceId: idSchema,
  status: z.enum(COLLECTION_PLACE_STATUSES),
})
