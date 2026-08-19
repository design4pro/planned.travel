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

/** Hard ceiling for one object. R2 would take far more; a trip document will not. */
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
 * Accepted media types, each mapped to the kind it defaults to.
 *
 * An allow-list rather than a block-list: the bucket is served back to
 * travellers, so "anything but scripts" is not a policy we can keep correct.
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
  '.docx',
  '.xlsx',
  '.geojson',
  '.gpx',
  '.json',
  '.zip',
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
    ['geojson', { type: 'application/geo+json', kind: 'map' }],
    ['gpx', { type: 'application/gpx+xml', kind: 'map' }],
    ['json', { type: 'application/json', kind: 'document' }],
    ['zip', { type: 'application/zip', kind: 'other' }],
  ])

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
}

/**
 * The media type we will store. Browsers hand back `''` or
 * `application/octet-stream` often enough that trusting the header alone would
 * reject perfectly ordinary PDFs, so the extension is the fallback — never the
 * override.
 */
export function resolveContentType(
  filename: string,
  reported: string,
): string | null {
  const normalised = reported.split(';')[0]?.trim().toLowerCase() ?? ''
  if (ACCEPTED.has(normalised)) {
    return normalised
  }
  return BY_EXTENSION.get(extensionOf(filename))?.type ?? null
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
  'empty' | 'too-large' | 'unsupported-type' | 'quota'

export interface UploadRejection {
  readonly code: UploadRejectionCode
  readonly message: string
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
