import { z } from 'zod'
import {
  releaseLocaleSchema,
  releaseVersionSchema,
} from '#/server/content/collections'
import type { listReleaseHistory } from '#/server/repos/releases'

const cursorTuple = z.strictObject({
  shippedAt: z.number().int().min(1).max(8640000000000000),
  version: releaseVersionSchema,
})
type Cursor = z.infer<typeof cursorTuple>

export function encodeReleaseCursor(cursor: Cursor): string {
  return btoa(JSON.stringify(cursor))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
export function decodeReleaseCursor(cursor: string): Cursor {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(cursor))
    throw new Error('Invalid release cursor')
  const decoded = cursorTuple.parse(
    JSON.parse(atob(cursor.replaceAll('-', '+').replaceAll('_', '/'))),
  )
  if (encodeReleaseCursor(decoded) !== cursor)
    throw new Error('Invalid release cursor')
  return decoded
}
export const releaseHistoryInput = z.strictObject({
  locale: releaseLocaleSchema,
  cursor: z
    .string()
    .max(512)
    .refine((value) => {
      try {
        decodeReleaseCursor(value)
        return true
      } catch {
        return false
      }
    })
    .optional(),
  limit: z.number().int().min(1).max(50).default(20),
})
export type ReleaseHistoryInput = z.input<typeof releaseHistoryInput>
export type ReleaseHistoryPage = Omit<
  Awaited<ReturnType<typeof listReleaseHistory>>,
  'nextCursor'
> & { nextCursor: string | null }
