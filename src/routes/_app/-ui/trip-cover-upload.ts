/**
 * Putting a chosen image on a trip that already exists.
 *
 * Two steps and their order is the contract: the file goes through the existing upload path against
 * the trip (which owns quota reservation, create-only storage and settlement - this calls
 * it and does not restate it), and only then is the file recorded as the trip's cover. Neither step
 * may fail the trip: the caller gets a value to render, never an exception.
 */
import { uploadFile } from '#/components/modules/files/upload'
import { formatStorageSize } from '#/components/layout/storage-size'
import { readPublicFailure } from '#/lib/errors'
import { TRIP_ARCHIVED_KEY } from '#/lib/trip-refusals'
import { MAX_FILE_BYTES } from '#/server/fns/file-policy'

import type {
  UploadAnswer,
  UploadInput,
} from '#/components/modules/files/upload'
import type { Locale, useTranslate } from '#/lib/i18n'
import type { UploadFailure } from '#/server/fns/files'
import { updateTripFn } from '../-server/trip-lifecycle'

const COVER_UPLOAD_TIMEOUT_MS = 300_000

export async function uploadCover(
  input: Pick<UploadInput, 'file' | 'tripId' | 'onProgress'>,
): Promise<UploadAnswer> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  // Settle the attempt at the deadline even if the upload adapter answers after abort.
  const deadline = new Promise<UploadFailure>((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, code: 'timeout', message: '' })
      controller.abort()
    }, COVER_UPLOAD_TIMEOUT_MS)
  })
  try {
    return await Promise.race([
      deadline,
      uploadFile({
        ...input,
        kind: 'image',
        signal: controller.signal,
        onProgress: (fraction) => {
          if (!controller.signal.aborted) input.onProgress?.(fraction)
        },
      }),
    ])
  } catch {
    return { ok: false, code: 'rejected', message: '' }
  } finally {
    clearTimeout(timer)
  }
}

export function coverFailureMessage(
  failure: Pick<UploadFailure, 'code' | 'params'>,
  file: File,
  locale: Locale,
  t: ReturnType<typeof useTranslate>,
): string {
  switch (failure.code) {
    case TRIP_ARCHIVED_KEY:
      return t(TRIP_ARCHIVED_KEY)
    case 'timeout':
      return t('modules.files.error.timeout')
    case 'aborted':
      return t('modules.files.error.cancelled')
    case 'network':
      return t('modules.files.error.connection')
    case 'blocked-type':
      return t('modules.files.reject.blockedType', {
        name:
          typeof failure.params?.name === 'string'
            ? failure.params.name
            : file.name,
      })
    case 'unsupported-type':
      return t('shell.newTrip.coverTypeError', { name: file.name })
    case 'too-large':
      return t('shell.newTrip.coverSizeError', {
        name: file.name,
        max: formatStorageSize(MAX_FILE_BYTES, locale),
      })
    case 'quota':
      return t('modules.files.storage.full')
    default:
      return t('modules.files.toast.uploadFailed')
  }
}

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
      readonly failure: Pick<UploadFailure, 'code' | 'params'>
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
    const answer = await uploadCover({
      file,
      tripId,
      onProgress,
    })
    if (!answer.ok) {
      return {
        ok: false,
        filename: file.name,
        uploadedFileId: null,
        failure: answer,
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
      failure: {
        code:
          readPublicFailure(cause).message === TRIP_ARCHIVED_KEY
            ? TRIP_ARCHIVED_KEY
            : 'rejected',
      },
    }
  }
}
