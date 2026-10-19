/**
 * What an erasure does outside D1: the key-value purges and the stored-file metadata rewrite
 * (`.ai/specs/2026-10-08-erase-a-persons-data.md` section 6, phase 5; ADR 0043).
 *
 * Functions the erasure engine calls, nothing here is wired to a producer. Every store is a
 * parameter, so the whole module runs against fakes in plain Node and never reaches
 * `cloudflare:workers`. Each function is idempotent: a rerun after a partial failure finishes the
 * work and reports the same counts.
 *
 * ## What is purged, what is left to expire
 *
 * Purged by key: the session blobs and `active-sessions-<userId>` (the console's existing handling,
 * `auth/session-blobs` and `fns/console/session-keys`) and the per-user discount-attempt counter.
 * **Left to expire, residual stated:** `import:booking-import:…` and `task:done:…` (24 hours) and
 * `task:dead:…` (14 days) carry `requestedBy` or envelope ids that embed a user id. They hold no
 * content and cannot be found by user, so the residual is at most 14 days. The rate-limit counters
 * are keyed by IP and name no one.
 *
 * ## The metadata rewrite
 *
 * An R2 object's metadata cannot be edited in place, so the object is read and written again under
 * the same key with `uploadedBy` replaced by the workspace's Former member id. Nothing else changes:
 * the bytes, the content type and disposition and every other custom metadata field are carried over.
 */

import { MAX_FILE_BYTES } from '#/server/fns/file-policy'
import { purgeSessionBlobs } from '#/server/auth/session-blobs'
import { discountAttemptsUserKey } from '#/server/billing/discounts'
import {
  activeSessionsIndexKey,
  deleteSessionIndexKey,
} from '#/server/fns/console/session-keys'

import type {
  SessionKeyStore,
  SessionRowPage,
} from '#/server/auth/session-blobs'

/* ---------------------------------------------------------------- key-value stores -- */

/** The slice of a `KVNamespace` the purges use. */
export interface PurgeableKeyStore {
  delete: (key: string) => Promise<void>
}

export interface UserKeyPurgeStores {
  /** The `SESSIONS` namespace: session blobs and the per-user index. */
  readonly sessions: SessionKeyStore
  /** The `KV` namespace: the discount-attempt counter. */
  readonly kv: PurgeableKeyStore
}

/** Counts only. A failed session key is a session token, so it never leaves the auth module. */
export interface UserKeyPurge {
  readonly sessionBlobs: {
    readonly enumerated: number
    readonly deleted: number
    readonly failed: number
  }
  readonly indexDeleted: boolean
  readonly discountCounterDeleted: boolean
  /** True when nothing is left to retry. */
  readonly complete: boolean
}

/**
 * Purges a person's session blobs, their active-sessions index and their discount-attempt counter.
 *
 * `sessionRows` is read from D1 (`createSessionPageReader`), so this must run **before** the `user`
 * row and its `session` rows are deleted, which is where the engine's second step puts it: the blobs
 * are named by the rows. The index goes after the blobs, as the console does it.
 *
 * A key that cannot be deleted is counted, not thrown: the caller decides whether to retry, and the
 * verification sweep fails while the index key is still there.
 */
export async function purgeUserKeys(
  stores: UserKeyPurgeStores,
  userId: string,
  sessionRows: SessionRowPage,
): Promise<UserKeyPurge> {
  const blobs = await purgeSessionBlobs(stores.sessions, sessionRows)
  const indexDeleted = await deleteSessionIndexKey(stores.sessions, userId)
  const discountCounterDeleted = await stores.kv
    .delete(discountAttemptsUserKey(userId))
    .then(
      () => true,
      () => false,
    )

  return {
    sessionBlobs: {
      enumerated: blobs.enumerated,
      deleted: blobs.deleted,
      failed: blobs.failed,
    },
    indexDeleted,
    discountCounterDeleted,
    complete: blobs.failed === 0 && indexDeleted && discountCounterDeleted,
  }
}

/** The slice of a `KVNamespace` the verification reads. */
export interface ReadableKeyStore {
  get: (key: string) => Promise<string | null>
}

/** The key names the verification checks, kept beside the purge that removes them. */
export const userKeysToVerify = (userId: string): ReadonlyArray<string> => [
  activeSessionsIndexKey(userId),
  discountAttemptsUserKey(userId),
]

/* ------------------------------------------------------------------ R2 metadata -- */

/** The http metadata fields R2 keeps beside the bytes; all are carried over untouched. */
export interface StoredHttpMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export interface StoredObjectHead {
  readonly etag: string
  readonly size: number
  readonly customMetadata?: Record<string, string>
  readonly httpMetadata?: StoredHttpMetadata
}

/** The verbs the rewrite needs from the `FILES` bucket; structural so a test's fake is short. */
export interface RewritableObjectStore {
  head: (key: string) => Promise<StoredObjectHead | null>
  get: (key: string) => Promise<{ readonly body: ReadableStream } | null>
  /** Resolves `null` when the `onlyIf` precondition fails, as R2 does. */
  put: (
    key: string,
    value: ReadableStream,
    options: {
      httpMetadata?: StoredHttpMetadata
      customMetadata?: Record<string, string>
      onlyIf?: { etagMatches: string }
    },
  ) => Promise<unknown>
}

export type RewriteFailureReason =
  /** The key is not under this workspace's prefix, or the object is tagged with another workspace. */
  | 'refused'
  | 'missing'
  | 'too-large'
  /** The object changed between the read and the write. */
  | 'changed'
  | 'failed'

export interface RewriteFailure {
  /** For the caller's retry. Never logged: a key carries the file's name. */
  readonly key: string
  readonly reason: RewriteFailureReason
}

export interface MetadataRewrite {
  readonly rewritten: number
  /** Already carrying no trace of the person; nothing was written. */
  readonly unchanged: number
  readonly failures: ReadonlyArray<RewriteFailure>
}

export interface RewriteInput {
  readonly organizationId: string
  readonly userId: string
  readonly formerMemberId: string
  readonly keys: ReadonlyArray<string>
}

/** `trips/<org>/`, trailing slash included: `trips/<org>x/` is another workspace's prefix. */
export function workspaceObjectPrefix(organizationId: string): string {
  return `trips/${organizationId}/`
}

/**
 * Whether an object may be touched by this workspace's erasure: its key is under the workspace's
 * prefix and its own metadata says it belongs to that workspace.
 */
export function ownsObject(
  organizationId: string,
  key: string,
  head: StoredObjectHead,
): boolean {
  return (
    key.startsWith(workspaceObjectPrefix(organizationId)) &&
    head.customMetadata?.organizationId === organizationId
  )
}

/**
 * Re-writes each reported key under the same key with `uploadedBy` replaced by the Former member id.
 *
 * - Only an object whose `uploadedBy` is the erased person is written; anyone else's upload is left
 *   alone, and one already rewritten is `unchanged`, so a rerun succeeds.
 * - The write is conditional on the etag read a moment earlier, so a concurrent change is reported
 *   as `changed` instead of being overwritten with stale bytes.
 * - A missing object, one over {@link MAX_FILE_BYTES} (nothing the product accepted) and any store
 *   error are returned as failures to retry. They are not thrown, and they keep the verification
 *   sweep failing until fixed.
 */
export async function rewriteUploaderMetadata(
  store: RewritableObjectStore,
  input: RewriteInput,
): Promise<MetadataRewrite> {
  let rewritten = 0
  let unchanged = 0
  const failures: Array<RewriteFailure> = []
  const fail = (key: string, reason: RewriteFailureReason) =>
    failures.push({ key, reason })

  for (const key of new Set(input.keys)) {
    try {
      const head = await store.head(key)
      if (head === null) {
        fail(key, 'missing')
        continue
      }
      if (!ownsObject(input.organizationId, key, head)) {
        fail(key, 'refused')
        continue
      }
      if (head.customMetadata?.uploadedBy !== input.userId) {
        unchanged += 1
        continue
      }
      if (head.size > MAX_FILE_BYTES) {
        fail(key, 'too-large')
        continue
      }

      const source = await store.get(key)
      if (source === null) {
        fail(key, 'missing')
        continue
      }
      const stored = await store.put(key, source.body, {
        ...(head.httpMetadata === undefined
          ? {}
          : { httpMetadata: head.httpMetadata }),
        customMetadata: {
          ...head.customMetadata,
          uploadedBy: input.formerMemberId,
        },
        onlyIf: { etagMatches: head.etag },
      })
      if (stored === null) {
        fail(key, 'changed')
        continue
      }
      rewritten += 1
    } catch {
      fail(key, 'failed')
    }
  }

  return { rewritten, unchanged, failures }
}

/** The slice of the bucket the verification reads. */
export interface HeadableObjectStore {
  head: (key: string) => Promise<StoredObjectHead | null>
}
