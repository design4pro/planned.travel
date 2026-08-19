/**
 * The upload pre-flight, and the kind a file lands under.
 *
 * Split out from `upload.ts` on purpose: this module reaches for nothing but the
 * shared policy, so the rules a traveller meets *before* anything is sent can be
 * exercised without a Worker runtime behind them.
 */
import {
  MAX_FILES_PER_UPLOAD,
  checkUpload,
  defaultKindFor,
  resolveContentType,
} from '#/server/fns/file-policy'

import type { FileKind, StorageBudget } from '#/server/fns/file-policy'

/**
 * The pre-flight.
 *
 * Splits a dropped or picked set into the files worth sending and the reasons the
 * rest were not — checked against the same policy the server enforces, so a
 * refusal is instant and worded identically. Each accepted file's size is carried
 * into the budget for the next one; otherwise ten 5 MB files each pass a 6 MB
 * allowance individually and blow the quota together.
 */
export function screenFiles(
  files: ReadonlyArray<File>,
  budget: StorageBudget,
): {
  readonly accepted: ReadonlyArray<File>
  readonly rejected: ReadonlyArray<{ file: File; message: string }>
} {
  const accepted: Array<File> = []
  const rejected: Array<{ file: File; message: string }> = []
  let pendingBytes = budget.pendingBytes ?? 0

  files.forEach((file, index) => {
    if (index >= MAX_FILES_PER_UPLOAD) {
      rejected.push({
        file,
        message: `Only ${MAX_FILES_PER_UPLOAD} files can be added at once, so “${file.name}” was left out. Drop it in again on its own.`,
      })
      return
    }
    const rejection = checkUpload(
      { filename: file.name, contentType: file.type, sizeBytes: file.size },
      { ...budget, pendingBytes },
    )
    if (rejection === null) {
      accepted.push(file)
      pendingBytes += file.size
    } else {
      rejected.push({ file, message: rejection.message })
    }
  })

  return { accepted, rejected }
}

/** The kind a file will land under if the uploader does not choose one. */
export function kindForFile(file: File): FileKind {
  const contentType = resolveContentType(file.name, file.type)
  return defaultKindFor(file.name, contentType ?? file.type)
}
