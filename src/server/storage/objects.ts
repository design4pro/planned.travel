/**
 * The one place this product deletes bytes from R2.
 *
 * Two callers will reach it and they live on opposite sides of the request boundary: a server
 * function, which has the bucket from `filesBucket()` (`src/server/fns/context.ts`), and the
 * `trip-purge` queue handler, which has it from `context.env.FILES`. So the bucket is a **parameter**
 * rather than something this module looks up: reading the ambient Worker environment here would drag
 * `cloudflare:workers` into the consumer's module graph — `consumer.ts` imports every handler
 * statically, and the whole server suite runs in plain Node, where that specifier does not resolve.
 * Neither caller opens the bucket for itself, which is the property the split exists to keep.
 *
 * It contains no SQL and knows nothing about trips, tenants or file records. What may be deleted is
 * the caller's question; this answers only *how*.
 */

/**
 * The one verb this module needs from an R2 bucket.
 *
 * Structural rather than `R2Bucket`, so the queue consumer's `TaskBindings['FILES']` satisfies it
 * as-is and a test's fake is four lines.
 */
export interface ObjectStore {
  delete: (keys: string | Array<string>) => Promise<void>
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
