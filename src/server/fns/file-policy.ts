/**
 * What may be uploaded to a trip, expressed once.
 *
 * This module is deliberately pure — no bindings, no session, no Zod schema that
 * needs a request — so the same rules run in three places: the file picker's
 * `accept` list, the browser-side pre-flight that rejects a 60 MB video before a
 * single byte leaves the machine, and the server handler that must not trust
 * either of them.
 */
import { formatStorage } from '#/lib/plans'

/**
 * Hard ceiling for one object. R2 would take far more; a trip document will not.
 *
 * A storage-cost decision, not a technical limit: a larger ceiling doubles the worst case that
 * every plan's `storage_bytes` quota has to absorb without moving a published number. Changing it
 * is a pricing change, not an edit.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Objects one request may carry, so a stray loop cannot fan out into the bucket. */
export const MAX_FILES_PER_UPLOAD = 12

export const FILE_KIND_VALUES = [
  'document',
  'image',
  'ticket',
  'receipt',
  'map',
  'other',
] as const

export type FileKind = (typeof FILE_KIND_VALUES)[number]

export function isFileKind(value: string): value is FileKind {
  return (FILE_KIND_VALUES as ReadonlyArray<string>).includes(value)
}

/**
 * Extensions refused whatever media type is claimed: XML-family markup that can carry script.
 *
 * Checked before the size and before the allow-list, so a later widening of the allow-list cannot
 * re-admit one of these.
 */
const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  'xhtml',
  'xml',
  'svgz',
])

/** Media types refused under any filename, except for {@link XML_EXCEPTION_EXTENSION}. */
const BLOCKED_CLAIMED_TYPES: ReadonlySet<string> = new Set([
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
])

/**
 * The one XML-based format the product stores: a route file. An operating system may label a
 * `.gpx` as `application/xml`, so that claim is not refused for it. Written here, not implied.
 */
const XML_EXCEPTION_EXTENSION = 'gpx'

/**
 * The two accepted markup types and the only extensions that may carry them.
 *
 * For any other extension the extension decides the type instead (a PDF that claims `text/html` is
 * stored as a PDF), and a file with no extension keeps its claimed type, because the booking import
 * reads an extensionless stored file by its media type (`IMPORT_READERS_BY_TYPE`).
 *
 * **`.html`, `.htm` and `.svg` stay accepted, on purpose and on the same footing.** A hotel's
 * confirmation page saved from a browser is a format the booking import reads (ADR 0012), through
 * this same upload operation, and nothing tells an import from a library upload. Refusing them
 * would delete a shipped capability. A stored-script attack needs a same-origin navigation to the
 * markup, and this product offers none. Five controls together are the mitigation, and **any one
 * going away reopens the decision**:
 *
 * - (a) the `FILES` bucket is served to a browser only through `downloadTripFileFn` and
 *   `downloadTripExportFn` (the booking-import queue handler reads it server-side);
 *   `grep -rn FILES_PUBLIC_BASE src/` finds only its type;
 * - (b) that response is `content-disposition: attachment`, `cache-control: private, no-store` and
 *   `x-content-type-options: nosniff` ({@link attachmentHeaders}). This protects a **direct** fetch
 *   of the URL. It does not protect the in-app download, because `download.ts` reads the response
 *   into a blob that keeps the stored media type and the app sets no Content-Security-Policy
 *   header;
 * - (c) every **uploaded** object (`uploadTripFileFn`) is **stored** with
 *   `contentDisposition: attachment`, so a public domain would serve it as a download. `trip-copy`
 *   copies the cover through `copyObject`, which carries the disposition over with the type;
 * - (d) **no client code gives the user a same-origin object URL typed `text/html` or
 *   `image/svg+xml`**: `download.ts` re-types a blob of those two types to
 *   `application/octet-stream` before `URL.createObjectURL`, and `export-download.ts` does so for
 *   every trip export;
 * - (e) the file preview never shows an `image/svg+xml` file through a same-origin blob or object
 *   URL: an SVG gets no inline preview, or a sandboxed or rasterised one. "No open-in-new-tab
 *   button" is not enough, because the browser's own context menu offers "Open image in new tab"
 *   on any `<img>`.
 *
 * **Hand-off.** `wrangler.jsonc` declares `FILES_PUBLIC_BASE: https://files.planned.travel`, and
 * `docs/plans/13-content-studio.md` plans to serve a public bucket for `cms/` keys. Whether a
 * custom domain is bound to the `FILES` bucket is not visible from the repository. Before any stage
 * binds that domain, it must confirm that **every key outside `cms/`** is unreachable through it:
 * `trips/`, `exports/` (the PDF export stores HTML as `text/html` with no attachment disposition)
 * and the dead-letter prefix.
 */
const BOUND_TYPES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['text/html', new Set(['html', 'htm'])],
  ['image/svg+xml', new Set(['svg'])],
])

/**
 * Accepted media types, each mapped to the kind it defaults to.
 *
 * An allow-list rather than a block-list: the bucket is served back to
 * travellers, so "anything but scripts" is not a policy we can keep correct.
 * What the list must never re-admit is stated beside it ({@link BLOCKED_EXTENSIONS},
 * {@link BLOCKED_CLAIMED_TYPES}) and tested.
 */
const ACCEPTED: ReadonlyMap<string, FileKind> = new Map<string, FileKind>([
  ['application/pdf', 'document'],
  ['image/png', 'image'],
  ['image/jpeg', 'image'],
  ['image/webp', 'image'],
  ['image/avif', 'image'],
  ['image/gif', 'image'],
  ['image/heic', 'image'],
  ['image/heif', 'image'],
  ['image/svg+xml', 'image'],
  ['text/plain', 'document'],
  ['text/csv', 'document'],
  ['text/calendar', 'document'],
  ['text/markdown', 'document'],
  // Two the booking import reads and the library did not hold: a hotel's confirmation page saved
  // from a browser, and a confirmation email saved from a mail client.
  ['text/html', 'document'],
  ['message/rfc822', 'document'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'document',
  ],
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'document',
  ],
  ['application/geo+json', 'map'],
  ['application/gpx+xml', 'map'],
  ['application/json', 'document'],
  ['application/zip', 'other'],
  // An airline's wallet pass. Most senders label it `application/octet-stream`, so the extension
  // table below is the path that fires in practice.
  ['application/vnd.apple.pkpass', 'ticket'],
])

/** The `accept` attribute for the file input, so the OS dialog filters too. */
export const ACCEPT_ATTRIBUTE = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.heic',
  '.svg',
  '.txt',
  '.csv',
  '.ics',
  '.md',
  '.html',
  '.htm',
  '.eml',
  '.docx',
  '.xlsx',
  '.geojson',
  '.gpx',
  '.json',
  '.zip',
  '.pkpass',
].join(',')

/** Extensions we can classify when the browser sends no usable media type. */
const BY_EXTENSION: ReadonlyMap<string, { type: string; kind: FileKind }> =
  new Map([
    ['pdf', { type: 'application/pdf', kind: 'document' }],
    ['png', { type: 'image/png', kind: 'image' }],
    ['jpg', { type: 'image/jpeg', kind: 'image' }],
    ['jpeg', { type: 'image/jpeg', kind: 'image' }],
    ['webp', { type: 'image/webp', kind: 'image' }],
    ['avif', { type: 'image/avif', kind: 'image' }],
    ['gif', { type: 'image/gif', kind: 'image' }],
    ['heic', { type: 'image/heic', kind: 'image' }],
    ['svg', { type: 'image/svg+xml', kind: 'image' }],
    ['txt', { type: 'text/plain', kind: 'document' }],
    ['csv', { type: 'text/csv', kind: 'document' }],
    ['ics', { type: 'text/calendar', kind: 'document' }],
    ['md', { type: 'text/markdown', kind: 'document' }],
    ['html', { type: 'text/html', kind: 'document' }],
    ['htm', { type: 'text/html', kind: 'document' }],
    ['eml', { type: 'message/rfc822', kind: 'document' }],
    ['geojson', { type: 'application/geo+json', kind: 'map' }],
    ['gpx', { type: 'application/gpx+xml', kind: 'map' }],
    ['json', { type: 'application/json', kind: 'document' }],
    ['zip', { type: 'application/zip', kind: 'other' }],
    ['pkpass', { type: 'application/vnd.apple.pkpass', kind: 'ticket' }],
  ])

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
}

/**
 * The media type we will store. Browsers hand back `''` or
 * `application/octet-stream` often enough that trusting the header alone would
 * reject perfectly ordinary PDFs, so the extension is the fallback — never the
 * override. The two exceptions are {@link BOUND_TYPES}: `text/html` and `image/svg+xml` are
 * honoured only for their own extensions.
 */
export function resolveContentType(
  filename: string,
  reported: string,
): string | null {
  const normalised = normaliseType(reported)
  const extension = extensionOf(filename)
  const bound = BOUND_TYPES.get(normalised)
  const claimHolds =
    bound === undefined || extension === '' || bound.has(extension)
  if (ACCEPTED.has(normalised) && claimHolds) {
    return normalised
  }
  return BY_EXTENSION.get(extension)?.type ?? null
}

function normaliseType(reported: string): string {
  return reported.split(';')[0]?.trim().toLowerCase() ?? ''
}

/**
 * Whether the file is XML-family markup the product never stores, whatever else it claims.
 *
 * By extension for `.xhtml`, `.xml` and `.svgz`; by claimed media type for `application/xhtml+xml`,
 * `application/xml` and `text/xml` under any filename, except a `.gpx`. The name is trimmed first,
 * because the stored name is, and `notes.xml ` must not pass as an unknown extension.
 */
function isBlockedType(filename: string, reported: string): boolean {
  const extension = extensionOf(filename.trimEnd())
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return true
  }
  return (
    BLOCKED_CLAIMED_TYPES.has(normaliseType(reported)) &&
    extension !== XML_EXCEPTION_EXTENSION
  )
}

/** The kind a file lands under when the uploader does not pick one. */
export function defaultKindFor(
  filename: string,
  contentType: string,
): FileKind {
  return (
    ACCEPTED.get(contentType) ??
    BY_EXTENSION.get(extensionOf(filename))?.kind ??
    'other'
  )
}

/**
 * Characters a filename may not contribute to a storage key or to a
 * `content-disposition` header. Filtered by code point rather than by a pattern,
 * because the set includes the C0 controls and a control character inside a
 * regex is exactly the thing static analysis is right to complain about.
 */
const FORBIDDEN_PUNCTUATION = '"\'`<>|?*:\\/'

function stripUnsafe(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) {
      continue
    }
    if (FORBIDDEN_PUNCTUATION.includes(char)) {
      continue
    }
    out += char
  }
  return out
}

/**
 * A filename safe to put in a storage key and in a `content-disposition` header.
 * Keeps the extension, drops path separators, control characters and quotes.
 */
export function sanitiseFilename(filename: string): string {
  const base = filename
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .at(-1)
  const cleaned = stripUnsafe(base ?? '')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 160)
  return cleaned.length === 0 ? 'attachment' : cleaned
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `YYYYMMDD-HHmmss` in the clock of the machine that pasted. The seed of every pasted name, and the
 * key under which the screen counts the files of one second.
 */
export function pastedFilenameStamp(now: Date): string {
  const date = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`
  return `${date}-${time}`
}

/** The extension a pasted file's media type earns: the table's, else an image's subtype, else `bin`. */
function extensionForPasted(mediaType: string): string {
  const type = normaliseType(mediaType)
  for (const [extension, entry] of BY_EXTENSION) {
    if (entry.type === type) {
      return extension
    }
  }
  if (type.startsWith('image/')) {
    const subtype = type.slice('image/'.length).replaceAll(/[^a-z0-9]/gu, '')
    if (subtype.length > 0) {
      return subtype.slice(0, 16)
    }
  }
  return 'bin'
}

/**
 * The name a pasted screenshot is stored under: `YYYYMMDD-HHmmss.<ext>`, with `-<n>` before the
 * extension from the second file of a second on.
 *
 * Digits only, because the name shows in the queue row, the toast and the table in every locale, so
 * no English word can be in it. The extension comes from the media type; an unlisted image type
 * keeps its subtype (a pasted TIFF is refused as `….tiff`, not as `….bin`). The result goes through
 * {@link sanitiseFilename}, like every upload.
 */
export function safePastedFilename(
  mediaType: string,
  now: Date,
  sequence: number,
): string {
  const suffix = sequence >= 2 ? `-${sequence}` : ''
  return sanitiseFilename(
    `${pastedFilenameStamp(now)}${suffix}.${extensionForPasted(mediaType)}`,
  )
}

/**
 * The one `content-disposition` a stored file is served and written under: always an attachment.
 *
 * Shared by {@link attachmentHeaders} and by the metadata written when an object is stored, so the
 * two cannot drift.
 */
export function contentDispositionFor(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/**
 * The response headers for downloading a stored file.
 *
 * `content-type` is the stored media type echoed as it is, never re-derived, so a wallet pass
 * leaves as `application/vnd.apple.pkpass`. The file is always an attachment, private to the
 * workspace and uncached, and `nosniff` stops a browser reinterpreting the bytes as another type.
 */
export function attachmentHeaders(file: {
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
}): Record<string, string> {
  return {
    'content-type': file.contentType,
    'content-length': String(file.sizeBytes),
    'content-disposition': contentDispositionFor(file.filename),
    // Attachments are private to a workspace; nothing may hold a copy.
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  }
}

/** Object key inside the `FILES` bucket. Tenant first, so a listing is scoped. */
export function storageKeyFor(input: {
  readonly organizationId: string
  readonly tripId: string
  readonly fileId: string
  readonly filename: string
}): string {
  return [
    'trips',
    input.organizationId,
    input.tripId,
    `${input.fileId}-${sanitiseFilename(input.filename)}`,
  ].join('/')
}

export type UploadRejectionCode =
  'empty' | 'blocked-type' | 'too-large' | 'unsupported-type' | 'quota'

export interface UploadRejection {
  readonly code: UploadRejectionCode
  /** English, built here; the words a traveller reads can come from the catalogue by `code`. */
  readonly message: string
  /** Values a catalogue sentence for this `code` interpolates. */
  readonly params?: Readonly<Record<string, string | number>>
}

export interface UploadCandidate {
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
}

export interface StorageBudget {
  /** Bytes the workspace already holds. */
  readonly usedBytes: number
  /**
   * The plan's ceiling in bytes. `Number.POSITIVE_INFINITY` — the sentinel the
   * quota table uses — or any negative number means the plan does not cap it.
   */
  readonly limitBytes: number
  /** Bytes already committed by earlier files in the same batch. */
  readonly pendingBytes?: number
}

/**
 * The one gate. Returns `null` when the file may be stored, or the reason it may
 * not — phrased for a person, because this string is what they read.
 *
 * The order is fixed: empty, blocked type, too large, allow-list, quota. A blocked type comes
 * before the size so an oversized `.xml` is told what it is, and before the allow-list so a later
 * widening of the list cannot re-admit it.
 */
export function checkUpload(
  candidate: UploadCandidate,
  budget: StorageBudget,
): UploadRejection | null {
  if (candidate.sizeBytes <= 0) {
    return {
      code: 'empty',
      message: `“${candidate.filename}” is empty, so there is nothing to store.`,
    }
  }
  if (isBlockedType(candidate.filename, candidate.contentType)) {
    return {
      code: 'blocked-type',
      message: `“${candidate.filename}” is a kind of file this workspace does not store.`,
      params: { name: candidate.filename },
    }
  }
  if (candidate.sizeBytes > MAX_FILE_BYTES) {
    return {
      code: 'too-large',
      message: `“${candidate.filename}” is ${formatStorage(candidate.sizeBytes)}. Single files are limited to ${formatStorage(MAX_FILE_BYTES)}.`,
    }
  }
  if (resolveContentType(candidate.filename, candidate.contentType) === null) {
    return {
      code: 'unsupported-type',
      message: `“${candidate.filename}” is not a file type this workspace accepts. Try a PDF, an image, a document or a calendar file.`,
    }
  }

  const limit = budget.limitBytes
  if (Number.isFinite(limit) && limit >= 0) {
    const projected =
      budget.usedBytes + (budget.pendingBytes ?? 0) + candidate.sizeBytes
    if (projected > limit) {
      const remaining = Math.max(
        limit - budget.usedBytes - (budget.pendingBytes ?? 0),
        0,
      )
      return {
        code: 'quota',
        message: `Storing “${candidate.filename}” needs ${formatStorage(candidate.sizeBytes)} but only ${formatStorage(remaining)} of your plan's ${formatStorage(limit)} is left. Remove a file or upgrade the plan.`,
      }
    }
  }

  return null
}

/* ------------------------------------------------------------- booking import -- */

/**
 * Which stored formats an *import* can read — a different question from which may be stored.
 *
 * The accepted-media-type table above is not widened for this: every format below is already
 * storable. What refusing at the upload boundary needs is the other answer, and nothing else in the
 * product could give it. A reader who drops a `.pkpass` is told so by name, with the list that
 * works, rather than having the file accepted and the job fail twenty seconds later.
 */
export type ImportFormat = 'ics' | 'json' | 'document'

/** Files one drop may carry. Wider is a fan-out of model calls, narrower is a second drop. */
export const MAX_IMPORT_FILES = 5

/**
 * The ceiling on one file an import reads, and it is deliberately below {@link MAX_FILE_BYTES}.
 *
 * The queue handler refuses past it rather than streaming it into memory, and a confirmation that
 * does not fit in five mebibytes is a scan at a resolution nobody needs. Declared here rather than
 * beside that refusal so the dialog can state the same number it will be judged by.
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

/**
 * The branch an import takes for each extension it reads.
 *
 * **Keyed on the extension rather than on the media type, and that is the whole of the answer.**
 * The platform's document conversion dispatches on the filename, so an import that decided from a
 * reported media type would be answering a different question from the one the engine will ask —
 * and a `.pkpass` announced as `application/pdf` would be accepted here and refused twenty seconds
 * later by a job nobody is watching. A media type is consulted only for a stored file with no
 * extension at all.
 *
 * `ics` and `json` have grammars and go to the deterministic parsers; everything else becomes text
 * and then rows through the model. An extension absent from this map is storable but unreadable by
 * an import, which is exactly what the boundary refusal needs to know.
 *
 * The values are {@link ImportReader}s rather than formats, because the document branch itself
 * reads three ways and the queue's reader must take the same one the boundary accepted.
 */
const IMPORT_READERS: ReadonlyMap<string, ImportReader> = new Map<
  string,
  ImportReader
>([
  ['ics', 'ics'],
  ['json', 'json'],
  ['pdf', 'convert'],
  ['html', 'convert'],
  ['htm', 'convert'],
  ['eml', 'mail'],
  ['txt', 'text'],
  ['md', 'text'],
  ['png', 'convert'],
  ['jpg', 'convert'],
  ['jpeg', 'convert'],
  ['webp', 'convert'],
  ['heic', 'convert'],
  ['docx', 'convert'],
  ['xlsx', 'convert'],
])

/**
 * The `accept` attribute for the import picker: narrower than {@link ACCEPT_ATTRIBUTE}.
 *
 * Derived from {@link IMPORT_READERS} rather than written beside it, so the list the OS dialog
 * filters by and the list the server refuses against cannot drift apart.
 */
export const IMPORT_ACCEPT_ATTRIBUTE = [...IMPORT_READERS.keys()]
  .map((extension) => `.${extension}`)
  .join(',')

/** The media types an extensionless stored file may still be read as. */
const IMPORT_READERS_BY_TYPE: ReadonlyMap<string, ImportReader> = new Map<
  string,
  ImportReader
>([
  ['text/calendar', 'ics'],
  ['application/json', 'json'],
  ['application/pdf', 'convert'],
  ['text/html', 'convert'],
  ['message/rfc822', 'mail'],
  ['text/plain', 'text'],
  ['text/markdown', 'text'],
  ['image/png', 'convert'],
  ['image/jpeg', 'convert'],
  ['image/webp', 'convert'],
  ['image/heic', 'convert'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'convert',
  ],
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'convert',
  ],
])

/**
 * How an import reads one file — one step finer than {@link ImportFormat}.
 *
 * The `document` branch splits three ways because its reader does: `text` is decoded as it stands,
 * `mail` is decoded with its base64 runs stripped, and `convert` goes through the platform's
 * document conversion.
 */
export type ImportReader = 'ics' | 'json' | 'text' | 'mail' | 'convert'

const FORMAT_OF_READER: Readonly<Record<ImportReader, ImportFormat>> = {
  ics: 'ics',
  json: 'json',
  text: 'document',
  mail: 'document',
  convert: 'document',
}

/**
 * The reader an import would use for this file, or `null` when it cannot read it at all.
 *
 * The one resolution both the upload boundary ({@link importFormatFor}) and the queue's document
 * reader (`documentToText`) ask, so the policy that accepted a file and the code that reads it
 * cannot disagree about it. The extension decides; the stored media type is consulted only for a
 * file with no extension at all.
 */
export function importReaderFor(
  filename: string,
  contentType: string,
): ImportReader | null {
  const extension = extensionOf(filename)
  if (extension.length > 0) {
    return IMPORT_READERS.get(extension) ?? null
  }
  const resolved = resolveContentType(filename, contentType)
  return resolved === null
    ? null
    : (IMPORT_READERS_BY_TYPE.get(resolved) ?? null)
}

/**
 * The format an import would read this file as, or `null` when it cannot read it at all.
 *
 * Takes the stored filename and the stored media type — never a format a client sent — because a
 * format from a browser routes a PDF past the parser that would have refused it.
 */
export function importFormatFor(
  filename: string,
  contentType: string,
): ImportFormat | null {
  const reader = importReaderFor(filename, contentType)
  return reader === null ? null : FORMAT_OF_READER[reader]
}
