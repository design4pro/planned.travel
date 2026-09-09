/**
 * The one place this product moves bytes in R2 — deleting them, and duplicating them.
 *
 * Two callers will reach it and they live on opposite sides of the request boundary: a server
 * function, which has the bucket from `filesBucket()` (`src/server/fns/context.ts`), and the
 * `trip-purge` and `trip-copy` queue handlers, which have it from `context.env.FILES`. So the bucket
 * is a **parameter** rather than something this module looks up: reading the ambient Worker
 * environment here would drag `cloudflare:workers` into the consumer's module graph — `consumer.ts`
 * imports every handler statically, and the whole server suite runs in plain Node, where that
 * specifier does not resolve. Neither caller opens the bucket for itself, which is the property the
 * split exists to keep.
 *
 * It contains no SQL and knows nothing about trips, tenants or file records. What may be deleted or
 * copied is the caller's question; this answers only *how*.
 */

/**
 * The verbs this module needs from an R2 bucket.
 *
 * Structural rather than `R2Bucket`, so the queue consumer's `TaskBindings['FILES']` satisfies it
 * as-is and a test's fake is four lines.
 *
 * `get` and `put` are **optional** and `delete` is not, because a purge needs only the third. Making
 * them required would break every fake already written against this port — in `__tests__/` and in
 * the `trip-purge` suite — for the sake of a caller half the handlers do not have. {@link copyObject}
 * says so at run time instead, with {@link ObjectCopyError}.
 */
export interface ObjectStore {
  delete: (keys: string | Array<string>) => Promise<void>
  get?: (key: string) => Promise<{
    body: ReadableStream | null
    httpMetadata?: { contentType?: string }
  } | null>
  put?: (
    key: string,
    value: ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>
}

/**
 * Thrown when a copy cannot be made: the store does not read or write, or the source is not there.
 *
 * One class with a `code` rather than two, because the only caller — the `trip-copy` handler —
 * tolerates every cover failure alike (spec Q6) and never branches on which one it was. A second
 * class would be a distinction nobody reads.
 */
export class ObjectCopyError extends Error {
  constructor(
    message: string,
    readonly code: 'unsupported-store' | 'source-missing',
  ) {
    super(message)
    this.name = 'ObjectCopyError'
  }
}

/**
 * How many keys R2 accepts in one `delete` call.
 *
 * Cloudflare's limit, not a preference: `R2Bucket.delete()` takes at most 1 000 keys per call and
 * rejects a longer array outright. A purge scales with a trip's file count, which has no product
 * ceiling — `files` is `UNLIMITED` on the business tier (`src/server/db/types.ts`) — so the bound has
 * to be held by a loop rather than by a comment, and `__tests__/objects.test.ts` holds it as a call
 * count.
 */
export const R2_DELETE_MAX_KEYS = 1_000

/**
 * Deletes every key, in chunks, and returns how many distinct keys were asked for.
 *
 * **Idempotent, because R2 is.** Deleting a key that is not there is a success, so a redelivered
 * purge finishes rather than dead-letters, and a caller never has to ask what is present first.
 * Duplicates in the input are collapsed so a cover key that is also a file key costs one slot rather
 * than two.
 */
export async function deleteObjects(
  store: ObjectStore,
  keys: ReadonlyArray<string>,
): Promise<number> {
  const unique = [...new Set(keys)]
  for (let index = 0; index < unique.length; index += R2_DELETE_MAX_KEYS) {
    await store.delete(unique.slice(index, index + R2_DELETE_MAX_KEYS))
  }
  return unique.length
}

/**
 * Streams `sourceKey` to `targetKey` — a new object, not a second name for the old bytes.
 *
 * That distinction is the whole reason a trip copy calls this: the copy has to survive the source's
 * deletion, and `trip-purge` deletes a trip's keys outright. Two objects, two keys, two lifetimes.
 *
 * **A missing source is an error, not a silent no-op.** `deleteObjects` above tolerates an absent key
 * because R2 does; a copy cannot, because "nothing to copy" and "copied nothing" are the same
 * outcome to a caller that does not ask. Whether that error matters is the caller's call — the
 * `trip-copy` handler logs it and completes the copy without a cover.
 */
export async function copyObject(
  store: ObjectStore,
  sourceKey: string,
  targetKey: string,
): Promise<void> {
  const { get, put } = store
  if (!get || !put) {
    throw new ObjectCopyError(
      'This object store does not read and write, so it cannot copy.',
      'unsupported-store',
    )
  }

  const source = await get(sourceKey)
  if (!source?.body) {
    throw new ObjectCopyError(
      `Object ${sourceKey} was not found.`,
      'source-missing',
    )
  }

  const contentType = source.httpMetadata?.contentType
  await put(
    targetKey,
    source.body,
    contentType === undefined ? undefined : { httpMetadata: { contentType } },
  )
}
