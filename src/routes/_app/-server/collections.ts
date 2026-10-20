import { createServerFn } from '@tanstack/react-start'
import {
  updateCollectionSchema,
  collectionIdSchema,
  deleteCollectionSchema,
  setPlaceStatusSchema,
} from './collections-wire'
import {
  updateCollectionResult,
  collectionDeleteSummaryResult,
  deleteCollectionResult,
  setPlaceStatusResult,
} from './collections-handlers'

export const updateCollectionFn = createServerFn({ method: 'POST' })
  .validator(updateCollectionSchema)
  .handler(({ data }) => updateCollectionResult(data))
export const collectionDeleteSummaryFn = createServerFn({ method: 'GET' })
  .validator(collectionIdSchema)
  .handler(({ data }) => collectionDeleteSummaryResult(data))
export const deleteCollectionFn = createServerFn({ method: 'POST' })
  .validator(deleteCollectionSchema)
  .handler(({ data }) => deleteCollectionResult(data))
export const setPlaceStatusFn = createServerFn({ method: 'POST' })
  .validator(setPlaceStatusSchema)
  .handler(({ data }) => setPlaceStatusResult(data))
