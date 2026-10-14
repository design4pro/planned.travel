/**
 * Putting a chosen image on a trip that already exists.
 *
 * Two steps and their order is the contract: the file goes through the existing upload path against
 * the trip (which owns the object-first, quota-second rule and its compensating delete - this calls
 * it and does not restate it), and only then is the file recorded as the trip's cover. Neither step
 * may fail the trip: the caller gets a value to render, never an exception.
 */
import { uploadFile } from '#/components/modules/files/upload'
import { messageOf } from '#/components/modules/shared'
import { updateTripFn } from '../-server/trip-lifecycle'

export type CoverAttachment =
  | { readonly ok: true }
  | {
      readonly ok: false
      /** The file that did not become the cover, for the sentence that names it. */
      readonly filename: string
      /**
       * The file id when the upload itself succeeded and only the cover write failed, so a retry
       * records the file already stored instead of uploading - and billing - it a second time.
       */
      readonly uploadedFileId: string | null
      /** The server's own sentence when it refused the file (quota, type), otherwise `null`. */
      readonly reason: string | null
    }

export interface AttachCoverInput {
  readonly tripId: string
  readonly file: File
  readonly uploadedFileId?: string | null
  readonly onProgress?: (fraction: number) => void
}

export async function attachCover({
  tripId,
  file,
  uploadedFileId = null,
  onProgress,
}: AttachCoverInput): Promise<CoverAttachment> {
  let fileId = uploadedFileId
  if (fileId === null) {
    const answer = await uploadFile({
      file,
      tripId,
      kind: 'image',
      onProgress,
    })
    if (!answer.ok) {
      return {
        ok: false,
        filename: file.name,
        uploadedFileId: null,
        reason: answer.message,
      }
    }
    fileId = answer.file.id
  }

  try {
    await updateTripFn({ data: { tripId, coverFileId: fileId } })
    return { ok: true }
  } catch (cause) {
    return {
      ok: false,
      filename: file.name,
      uploadedFileId: fileId,
      reason: messageOf(cause, '') || null,
    }
  }
}
