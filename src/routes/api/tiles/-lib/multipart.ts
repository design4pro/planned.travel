/**
 * `multipart/byteranges` assembly for multi-range tile reads (RFC 9110 §14.6).
 *
 * Multi-range responses are assembled in memory rather than streamed: the range
 * count and total byte budget are both capped upstream, and a buffered body is
 * what lets the finished response be stored in the edge cache as a single
 * entry — a streamed body would have to be re-assembled on every hit.
 */

import { formatContentRange, rangeLength } from './range'
import type { ByteRange } from './range'

export interface MultipartPart {
  readonly range: ByteRange
  readonly bytes: Uint8Array
}

const CRLF = '\r\n'
const encoder = new TextEncoder()

/** Boundary token: 32 hex characters, which can never occur in a header line. */
export function newMultipartBoundary(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

export function multipartContentType(boundary: string): string {
  return `multipart/byteranges; boundary=${boundary}`
}

function partHeader(
  boundary: string,
  contentType: string,
  range: ByteRange,
  size: number,
): Uint8Array {
  const lines = [
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    `Content-Range: ${formatContentRange(range, size)}`,
    '',
    '',
  ]
  return encoder.encode(lines.join(CRLF))
}

/**
 * Concatenates parts into a single `multipart/byteranges` body.
 *
 * Throws if a part's byte length disagrees with its declared range: that can
 * only mean the object changed under us mid-read, and a body whose part lengths
 * contradict their `Content-Range` headers would silently corrupt the client's
 * view of the archive.
 */
export function buildMultipartBody(options: {
  readonly parts: ReadonlyArray<MultipartPart>
  readonly boundary: string
  readonly contentType: string
  readonly size: number
}): Uint8Array<ArrayBuffer> {
  const { parts, boundary, contentType, size } = options
  const chunks: Array<Uint8Array> = []

  for (const part of parts) {
    if (part.bytes.byteLength !== rangeLength(part.range)) {
      throw new Error(
        `multipart part ${part.range.start}-${part.range.end} carries ${part.bytes.byteLength} bytes`,
      )
    }
    chunks.push(partHeader(boundary, contentType, part.range, size))
    chunks.push(part.bytes)
    chunks.push(encoder.encode(CRLF))
  }
  chunks.push(encoder.encode(`--${boundary}--${CRLF}`))

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const body = new Uint8Array(new ArrayBuffer(total))
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}
