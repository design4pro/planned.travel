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
import type { MessageKey } from '#/lib/i18n'
import type { DeferredMessage } from '../shared/deferred-message'

const REJECTION_MESSAGES: ReadonlyMap<
  string,
  { readonly key: MessageKey; readonly required: ReadonlyArray<string> }
> = new Map([
  [
    'blocked-type',
    { key: 'modules.files.reject.blockedType', required: ['name'] },
  ],
  ['empty', { key: 'modules.files.reject.empty', required: ['name'] }],
  [
    'too-large',
    {
      key: 'modules.files.reject.tooLarge',
      required: ['name', 'size', 'limit'],
    },
  ],
  [
    'unsupported-type',
    { key: 'modules.files.reject.unsupportedType', required: ['name'] },
  ],
  [
    'quota',
    {
      key: 'modules.files.reject.quota',
      required: ['name', 'size', 'remaining', 'limit'],
    },
  ],
])

/** Maps refusals from both pre-flight and the server to the same catalogue messages. */
export function describeRejection(
  code: string,
  params: Readonly<Record<string, string | number>> | undefined,
  fallback: string,
): DeferredMessage | string {
  const message = REJECTION_MESSAGES.get(code)
  if (
    !message ||
    !params ||
    !message.required.every((name) => params[name] !== undefined)
  ) {
    return fallback
  }
  return { key: message.key, params }
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
