import { createServerFn } from '@tanstack/react-start'
import { galleryPreviewInput } from '#/server/community/snapshot'
import { previewGallerySubmission } from '#/server/repos/community'
import { NotFoundError } from '#/server/repos/context'
import { appScope } from './context'
import type { GalleryPreviewResult } from '#/server/community/snapshot'

export const previewGallerySubmissionFn = createServerFn({ method: 'POST' })
  .validator(galleryPreviewInput)
  .handler(async ({ data }): Promise<GalleryPreviewResult> => {
    const scope = await appScope()
    try {
      return await previewGallerySubmission(scope, data)
    } catch (error) {
      if (error instanceof NotFoundError) throw error
      return { status: 'capture-unavailable' }
    }
  })
