/**
 * What a workspace owns in R2, and the sweep that removes all of it.
 *
 * Deleting a workspace removes its rows by cascade and none of its objects, so the objects are
 * swept by key. The key families are the ones written today: `trips/<org>/<trip>/...` (files and
 * covers, `tripStoragePrefix`), `exports/<org>/<trip>/...` (`exportPrefix`) and `avatars/<org>/...`
 * (the portrait key plan 09 fixes). Plan 09's own sweep prefix, `<org>/`, matches none of them.
 *
 * Journey photos are swept by their owned prefix even after their rows go. New photo
 * keys live under `journeys/<org>/`; unsafe foreign and legacy keys are skipped and their objects
 * retained. The generic work - listing, chunking, an absent key being a success - is `./objects`.
 */

import { deleteObjects, drainPrefix } from './objects'

import type { PrefixStore } from './objects'

/** The key families that sit directly under a workspace id. */
export const WORKSPACE_KEY_FAMILIES = [
  'trips',
  'exports',
  'avatars',
  'journeys',
] as const

/** What `newId()` and Better Auth mint: a bounded run of URL-safe characters, never a `/`. */
const ORGANIZATION_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Every prefix a workspace's objects live under. **The trailing slash is the point**: without it
 * `trips/org-a` also matches `trips/org-ab/...`, another workspace's files.
 */
export function workspaceObjectPrefixes(organizationId: string): Array<string> {
  if (!ORGANIZATION_ID.test(organizationId)) {
    throw new Error('A workspace sweep needs a well-formed organization id.')
  }
  return WORKSPACE_KEY_FAMILIES.map((family) => `${family}/${organizationId}/`)
}

/**
 * Deletes everything the workspace has in the bucket plus `extraKeys`, and returns how many objects
 * it asked R2 to delete. Compatibility helper for callers that require completion; new deletion
 * drivers use `drainWorkspaceObjects` to yield after one bounded run.
 *
 * `extraKeys` come from `listWorkspaceJourneyPhotoKeys`. A tenant-scoped row is not proof of object
 * ownership: only keys within this workspace's exact namespaces may be deleted.
 */
export async function sweepWorkspaceObjects(
  store: PrefixStore,
  organizationId: string,
  extraKeys: ReadonlyArray<string> = [],
): Promise<number> {
  const prefixes = workspaceObjectPrefixes(organizationId)
  const ownedKeys = extraKeys.filter((key) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  )
  let deleted = await deleteObjects(store, ownedKeys)
  for (;;) {
    const progress = await drainWorkspaceObjects(store, organizationId)
    deleted += progress.deleted
    if (progress.drained) return deleted
  }
}

/** One workspace-wide budget, including journey photos without retaining their rows. */
export async function drainWorkspaceObjects(
  store: PrefixStore,
  organizationId: string,
): Promise<{ deleted: number; batches: number; drained: boolean }> {
  const prefixes = workspaceObjectPrefixes(organizationId)
  let deleted = 0
  let batches = 0
  for (const prefix of prefixes) {
    if (batches === 20) return { deleted, batches, drained: false }
    const progress = await drainPrefix(store, prefix, 20 - batches)
    deleted += progress.deleted
    batches += progress.batches
    if (!progress.drained) return { deleted, batches, drained: false }
  }
  return { deleted, batches, drained: true }
}
