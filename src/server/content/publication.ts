/** The operator module. Git evidence varies by adapter; storage and audit stay in their owners. */
import { z } from 'zod'
import { requireReleasePermission } from '#/server/auth/release-authority'
import {
  approveRelease,
  importRelease,
  inspectRelease,
} from '#/server/repos/content'
import { hashSecret } from '#/server/security/secret'
import {
  generationSchema,
  releaseIdSchema,
  releaseVersionSchema,
  sourceHashSchema,
  sourceShaSchema,
} from './collections'
import { parseReleaseSource, ReleaseSourceError } from './git-source'
import type { Database } from '#/server/db/types'
import type { ReleaseAuthority } from '#/server/auth/release-authority'

const base = z.strictObject({
  operationId: releaseIdSchema,
  version: releaseVersionSchema,
  sourceCommit: sourceShaSchema,
  expectedGeneration: generationSchema,
})
const review = z.strictObject({
  plainLanguage: z.literal(true),
  accuracy: z.literal(true),
  safeLinks: z.literal(true),
  privacy: z.literal(true),
  security: z.literal(true),
})
export const releaseOperationSchema = z.discriminatedUnion('operation', [
  base.extend({
    operation: z.literal('preview').default('preview'),
    sourceHash: sourceHashSchema.optional(),
  }),
  base.extend({ operation: z.literal('inspect') }),
  base.extend({
    operation: z.literal('import'),
    sourceHash: sourceHashSchema,
    screened: z.literal(true),
  }),
  base.extend({
    operation: z.literal('approve'),
    sourceHash: sourceHashSchema,
    review,
  }),
])

export type ReleaseGit = {
  /** Fixed repository and CHANGELOG.md path. Resolve only immutable full commit identities. */
  readChangelog: (commit: string) => Promise<string | null>
  /** Resolve within that same history, refusing an ambiguous or non-ancestor cutoff. */
  resolveCutoff: (ref: string, sourceCommit: string) => Promise<string | null>
}
export type ReleaseRuntime = {
  db: Database
  authority: ReleaseAuthority
  git: ReleaseGit | null
  /** Only the local test assembly grants this capability. No deployed write adapter exists. */
  writeAuthorization: 'local-fixture' | null
}
type OperationResult = {
  operationId: string
  status: 'applied' | 'unchanged' | 'conflict' | 'pending-evidence' | 'refused'
  sourceHash?: string
  versionId?: string
  reason?: string
  generation?: number
  receipt?: Awaited<ReturnType<typeof inspectRelease>>['operation']
  diff?: {
    before: ReturnType<typeof parseReleaseSource>['body'] | null
    after: ReturnType<typeof parseReleaseSource>['body']
  }
}

export async function runReleaseOperation(
  runtime: ReleaseRuntime,
  input: unknown,
): Promise<OperationResult> {
  const parsed = releaseOperationSchema.safeParse(input)
  // Return only a validated identity, never reflect arbitrary request strings in diagnostics.
  const identity = z.object({ operationId: releaseIdSchema }).safeParse(input)
  const operationId = identity.success
    ? identity.data.operationId
    : 'invalid-operation'
  if (!parsed.success)
    return { operationId, status: 'refused', reason: 'invalid-input' }
  const data = parsed.data
  try {
    await requireReleasePermission(runtime.authority, 'review')
  } catch {
    return { operationId, status: 'refused', reason: 'permission-denied' }
  }
  const state = await inspectRelease(
    runtime.db,
    runtime.authority,
    data.version,
    operationId,
  )
  if (data.operation === 'inspect')
    return {
      operationId,
      status: 'unchanged',
      generation: state.generation,
      receipt: state.operation,
    }
  if (
    !runtime.git ||
    (data.operation !== 'preview' &&
      runtime.writeAuthorization !== 'local-fixture')
  )
    return { operationId, status: 'pending-evidence', reason: 'sync-disabled' }
  const markdown = await runtime.git.readChangelog(data.sourceCommit)
  if (markdown === null)
    return {
      operationId,
      status: 'pending-evidence',
      reason: 'source-unavailable',
    }
  let source: ReturnType<typeof parseReleaseSource>
  try {
    source = parseReleaseSource(markdown, data.version)
  } catch (error) {
    if (!(error instanceof ReleaseSourceError)) throw error
    return { operationId, status: 'refused', reason: error.message }
  }
  const cutoff = await runtime.git.resolveCutoff(
    source.cutoffRef,
    data.sourceCommit,
  )
  if (!sourceShaSchema.safeParse(cutoff).success)
    return {
      operationId,
      status: 'pending-evidence',
      reason: 'cutoff-unverified',
    }
  const sourceHash = await hashSecret(JSON.stringify(source.body))
  if (data.operation === 'preview')
    return {
      operationId,
      status: 'unchanged',
      sourceHash,
      generation: state.generation,
      diff: { before: state.currentBody, after: source.body },
    }
  if (sourceHash !== data.sourceHash)
    return { operationId, status: 'conflict', sourceHash }
  const operationHash = await hashSecret(JSON.stringify({ ...data, cutoff }))
  // Resolve lost responses from persisted receipts before attempting a fresh mutation.
  if (state.operation) {
    const action =
      data.operation === 'import' ? 'release.imported' : 'release.reviewed'
    return {
      operationId,
      sourceHash,
      status:
        state.operation.action === action &&
        state.operation.metadata?.operationHash === operationHash
          ? 'unchanged'
          : 'conflict',
      versionId: state.operation.metadata?.versionId,
    }
  }
  if (data.operation === 'import') {
    const result = await importRelease(runtime.db, runtime.authority, {
      operationId,
      operationHash,
      expectedGeneration: data.expectedGeneration,
      sourceHash,
      version: data.version,
      headingDate: source.headingDate,
      sourceCommit: data.sourceCommit,
      cutoffSha: sourceShaSchema.parse(cutoff),
      body: source.body,
    })
    return { ...result, operationId }
  }
  if (!state.currentVersionId)
    return { operationId, sourceHash, status: 'conflict' }
  const result = await approveRelease(runtime.db, runtime.authority, {
    operationId,
    operationHash,
    version: data.version,
    versionId: state.currentVersionId,
    sourceHash,
    expectedGeneration: data.expectedGeneration,
  })
  return { ...result, operationId }
}
