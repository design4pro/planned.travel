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
import type { DeferredMessage } from '../shared/deferred-message'

/**
 * The words a traveller reads for a refusal, chosen by its `code`.
 *
 * One code at a time moves into the catalogue: a blocked type does today, and every other code
 * keeps the English `fallback` it came with (`empty`, `too-large`, `unsupported-type` and `quota`
 * are built in `file-policy.ts`). The pre-flight and the server's answer both come through here,
 * so a file only the server refuses is worded the same as one the browser caught.
 */
export function describeRejection(
  code: string,
  params: Readonly<Record<string, string | number>> | undefined,
  fallback: string,
): DeferredMessage | string {
  // Without the name the catalogue sentence would print a bare `{name}`; the English fallback
  // already names the file.
  return code === 'blocked-type' && params?.name !== undefined
    ? { key: 'modules.files.reject.blockedType', params }
    : fallback
}

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
  readonly rejected: ReadonlyArray<{
    file: File
    message: DeferredMessage | string
  }>
} {
  const accepted: Array<File> = []
  const rejected: Array<{ file: File; message: DeferredMessage | string }> = []
  let pendingBytes = budget.pendingBytes ?? 0

  files.forEach((file, index) => {
    if (index >= MAX_FILES_PER_UPLOAD) {
      rejected.push({
        file,
        message: {
          key: 'modules.files.error.tooMany',
          params: { count: MAX_FILES_PER_UPLOAD, name: file.name },
        },
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
      rejected.push({
        file,
        message: describeRejection(
          rejection.code,
          rejection.params,
          rejection.message,
        ),
      })
    }
  })

  return { accepted, rejected }
}

/** The kind a file will land under if the uploader does not choose one. */
export function kindForFile(file: File): FileKind {
  const contentType = resolveContentType(file.name, file.type)
  return defaultKindFor(file.name, contentType ?? file.type)
}
