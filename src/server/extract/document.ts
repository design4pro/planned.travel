/**
 * Bytes to text, and never a reservation.
 *
 * This is the first half of the confirmation import's model branch, and the split is the point:
 * the thing that reads a file and the thing that understands a booking have entirely different
 * failure modes, so they are testable apart. This module answers a `string` and knows nothing
 * about a trip, a reservation or a currency. `./booking` takes it from here.
 *
 * Three routes, decided by extension, because the R2 port a queue handler holds exposes no content
 * type (`src/server/queue/types.ts`, `TaskBindings.FILES.get` answers `{ body, size }`) and the
 * platform's conversion dispatches on the filename anyway:
 *
 * - a PDF, a web page, a Word or Excel document and an image go through `converter.toMarkdown`;
 * - `.txt` and `.md` are decoded as UTF-8, because they are already text and a conversion would be
 *   a network round trip spent on a no-op;
 * - `.eml` is decoded as UTF-8 too, with its long base64 runs stripped — see {@link BASE64_RUN}.
 *
 * **The mail message has no MIME parser and that is a decision.** `toMarkdown`'s published format
 * list does not include `message/rfc822`, and a MIME package is a `pnpm add` the dependency freeze
 * forbids (docs/SPEC.md §3). Writing one by hand means quoted-printable, nested multipart and
 * boundary handling — a real cost for a structural parse the extractor does not need, because it
 * is looking for a reference code, two dates and a place. What that gives up is stated rather than
 * hidden: a confirmation whose only detail sits inside a base64 attachment comes back as a thin row
 * needing fields filled in, which is the same outcome any thin document gets, and uploading that
 * attachment directly is a format this import accepts anyway.
 */

import { TaskPermanentError } from '../queue/types'

/** Every way an import can refuse, and the vocabulary the reader's copy is chosen from. */
export const IMPORT_REFUSAL_CODES = [
  'ceiling',
  'unreadable',
  'empty',
  'too-large',
  'unknown',
] as const

export type ImportRefusalCode = (typeof IMPORT_REFUSAL_CODES)[number]

export function isImportRefusalCode(
  value: unknown,
): value is ImportRefusalCode {
  return (
    typeof value === 'string' &&
    (IMPORT_REFUSAL_CODES as ReadonlyArray<string>).includes(value)
  )
}

/**
 * A permanent import failure that carries the code its refusal is worded from.
 *
 * A `TaskPermanentError` carries a message, and a message is the wrong thing to show a reader:
 * it is English written for a log line, and it never reaches the 23-locale catalogue. The code
 * does — `getBookingImportFn` forwards it and the dialog picks the copy — so the refusal a reader
 * sees is a designed sentence in their own language rather than the first line of a stack trace.
 */
export class ImportRefusedError extends TaskPermanentError {
  constructor(
    readonly code: ImportRefusalCode,
    message: string,
    /** The plan's allowance, on a `ceiling` refusal only, so the copy can name it. */
    readonly ceiling?: number,
  ) {
    super(message)
    this.name = 'ImportRefusedError'
  }
}

/**
 * The slice of the `AI` binding this module uses. A stub satisfies it; no test touches the network.
 *
 * The answer is typed as the platform types it — a union whose error arm carries no `data` — rather
 * than as the happy arm alone, because a conversion that failed is an ordinary outcome here and
 * pretending otherwise would push the check onto every caller.
 */
export interface DocumentConversion {
  readonly data?: string
  readonly format?: string
  readonly error?: string
}

export interface DocumentConverter {
  toMarkdown: (input: {
    name: string
    blob: Blob
  }) => Promise<DocumentConversion>
}

/**
 * How much text reaches the model.
 *
 * A cap rather than a stream: one 200-page scan must not become an unbounded prompt, and a
 * confirmation states its booking near the top. Forty thousand characters is roughly fifteen pages
 * of prose, which is more than any confirmation and less than any bill worth noticing.
 */
export const IMPORT_TEXT_MAX_CHARS = 40_000

export type DocumentTextFailure = Extract<
  ImportRefusalCode,
  'unreadable' | 'empty'
>

/** Extensions the platform conversion reads. Everything else here is already text. */
const CONVERTED_EXTENSIONS = [
  'pdf',
  'html',
  'htm',
  'docx',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'heic',
] as const

const PLAIN_TEXT_EXTENSIONS = ['txt', 'md'] as const

/**
 * A base64 block: tokens of sixty-plus base64 characters, wrapped or not, totalling two hundred.
 *
 * Sixty is what keeps prose out. MIME wraps base64 at 76 characters and an unwrapped attachment is
 * one very long token, so both shapes match; no word in any language reaches sixty letters, so a
 * paragraph never does however long it runs without punctuation. The two-hundred total is then
 * checked on the match itself rather than written into the pattern, which is what lets the two
 * shapes share one expression.
 */
const BASE64_RUN = /[A-Za-z0-9+/=]{60,}(?:\s+[A-Za-z0-9+/=]{60,})*/g

const BASE64_RUN_MIN_CHARS = 200

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Drops the base64 blocks of a saved mail message and keeps everything else as it stands. */
export function stripBase64Runs(text: string): string {
  return text.replace(BASE64_RUN, (run) =>
    run.replace(/\s+/g, '').length >= BASE64_RUN_MIN_CHARS ? ' ' : run,
  )
}

function decodeUtf8(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

async function convert(
  converter: DocumentConverter,
  input: { readonly name: string; readonly bytes: ArrayBuffer },
): Promise<string> {
  let answer: DocumentConversion
  try {
    answer = await converter.toMarkdown({
      name: input.name,
      blob: new Blob([input.bytes]),
    })
  } catch (cause) {
    throw new ImportRefusedError(
      'unreadable',
      `The conversion of ${input.name} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }
  if (answer.format === 'error' || typeof answer.data !== 'string') {
    throw new ImportRefusedError(
      'unreadable',
      `The conversion of ${input.name} answered no text: ${answer.error ?? 'no reason given'}`,
    )
  }
  return answer.data
}

/**
 * The text of an uploaded document, capped and never empty.
 *
 * A conversion that yields nothing after trimming is an `empty` refusal rather than an empty
 * string: "we could not find a booking in that file" is a designed outcome with its own copy, and
 * handing `''` to the extractor would spend a model call proving it.
 */
export async function documentToText(
  converter: DocumentConverter,
  input: { readonly name: string; readonly bytes: ArrayBuffer },
): Promise<string> {
  const extension = extensionOf(input.name)
  const raw =
    extension === 'eml'
      ? stripBase64Runs(decodeUtf8(input.bytes))
      : (PLAIN_TEXT_EXTENSIONS as ReadonlyArray<string>).includes(extension)
        ? decodeUtf8(input.bytes)
        : await convert(converter, input)

  const text = raw.trim()
  if (text.length === 0) {
    throw new ImportRefusedError(
      'empty',
      `Nothing readable was found in ${input.name}`,
    )
  }
  return text.slice(0, IMPORT_TEXT_MAX_CHARS)
}

/** Whether the conversion would be reached for this name, so a caller can say why it was not. */
export function needsConversion(name: string): boolean {
  return (CONVERTED_EXTENSIONS as ReadonlyArray<string>).includes(
    extensionOf(name),
  )
}
