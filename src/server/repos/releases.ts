/** ADR 0051: release identity, local/preview evidence fixtures and the published whitelist. */
import { and, desc, eq, isNull, isNotNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireReleasePermission } from '#/server/auth/release-authority'
import { requireUserFrom } from '#/server/auth/tenant'
import { preparePlatformAudit } from '#/server/catalog/audit'
import {
  generationSchema,
  releaseIdSchema,
  releaseLocaleSchema,
  releaseVersionSchema,
  sourceShaSchema,
  sourceHashSchema,
} from '#/server/content/collections'
import { resolveReleaseContent } from '#/server/content/resolve'
import {
  contentEntries,
  contentTranslations,
  contentVersions,
  newId,
  releasePublications,
  releaseDeployments,
  releaseDeploymentEntries,
  releaseProductionState,
} from '#/server/db/schema'
import { runAtomicDatabaseBatch } from './batch'
import { isReleaseConflict, releaseApprovalSchema } from './content'
import type { Database } from '#/server/db/types'
import type { AuthSession } from '#/server/auth/tenant'
import type { ReleaseAuthority } from '#/server/auth/release-authority'

const deploymentSchema = releaseApprovalSchema.extend({
  expectedProductionGeneration: generationSchema,
  deployment: z.strictObject({
    providerId: releaseIdSchema,
    runId: releaseIdSchema,
    attempt: z.number().int().min(1).max(100000),
    mainCommit: sourceShaSchema,
    treeSha: sourceShaSchema,
    target: z.literal('local-preview'),
    activatedAt: z.number().int().min(1).max(8640000000000000),
    receiptDigest: sourceHashSchema,
  }),
})

/** Fixture seam only: no production caller or provider evidence adapter is authorized by #1873. */
export async function seedPreviewReleaseDeployment(
  db: Database,
  authority: ReleaseAuthority,
  input: z.input<typeof deploymentSchema>,
) {
  const data = deploymentSchema.parse(input)
  const [p] = await db
    .select()
    .from(releasePublications)
    .where(eq(releasePublications.releaseVersion, data.version))
  const [version] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, data.versionId))
  const [state] = await db
    .select()
    .from(releaseProductionState)
    .where(eq(releaseProductionState.id, 1))
  const [existing] = await db
    .select()
    .from(releaseDeployments)
    .where(
      and(
        eq(releaseDeployments.providerId, data.deployment.providerId),
        eq(releaseDeployments.runId, data.deployment.runId),
        eq(releaseDeployments.attempt, data.deployment.attempt),
      ),
    )
  const [active] = state
    ? await db
        .select({ activatedAt: releaseDeployments.activatedAt })
        .from(releaseDeployments)
        .where(eq(releaseDeployments.id, state.activeDeploymentId))
    : []
  const [link] =
    existing && p
      ? await db
          .select()
          .from(releaseDeploymentEntries)
          .where(
            and(
              eq(releaseDeploymentEntries.deploymentId, existing.id),
              eq(releaseDeploymentEntries.publicationId, p.id),
            ),
          )
      : []
  const claimId = newId()
  const actor = await requireReleasePermission(authority, 'publish')
  if (
    !p ||
    !version ||
    version.entryId !== p.entryId ||
    version.sourceHash !== data.sourceHash
  )
    return { status: 'conflict' as const }
  if (existing) {
    const sameReceipt =
      existing.receiptDigest === data.deployment.receiptDigest &&
      existing.mainCommit === data.deployment.mainCommit &&
      existing.treeSha === data.deployment.treeSha &&
      existing.target === data.deployment.target &&
      existing.activatedAt.getTime() === data.deployment.activatedAt
    if (!sameReceipt) return { status: 'conflict' as const }
    if (link)
      return {
        status:
          link.versionId === data.versionId
            ? ('unchanged' as const)
            : ('conflict' as const),
      }
  }
  if (
    p.withdrawnAt !== null ||
    p.generation !== data.expectedGeneration ||
    p.approvedVersionId !== data.versionId ||
    p.approvedHash !== data.sourceHash ||
    p.reviewedAt === null ||
    (state?.generation ?? 0) !== data.expectedProductionGeneration
  )
    return { status: 'conflict' as const }
  if (state && !existing) {
    if (!active || active.activatedAt.getTime() >= data.deployment.activatedAt)
      return { status: 'pending-evidence' as const }
  }
  const deploymentId = existing?.id ?? newId()
  const at = new Date(data.deployment.activatedAt)
  try {
    await runAtomicDatabaseBatch(db, [
      db
        .update(releasePublications)
        .set({
          visibleVersionId: data.versionId,
          visibleHash: data.sourceHash,
          visibleReviewedAt: p.reviewedAt,
          firstShippedAt: p.firstShippedAt ?? at,
          contentUpdatedAt:
            p.visibleVersionId !== null && p.visibleVersionId !== data.versionId
              ? at
              : p.contentUpdatedAt,
          generation: p.generation + 1,
          operationId: data.operationId,
          claimId,
        })
        .where(
          and(
            eq(releasePublications.id, p.id),
            eq(releasePublications.generation, data.expectedGeneration),
            eq(releasePublications.approvedVersionId, data.versionId),
            eq(releasePublications.approvedHash, data.sourceHash),
            isNull(releasePublications.withdrawnAt),
          ),
        ),
      db
        .select({
          assertion: sql`case when exists(select 1 from ${releasePublications} where id = ${p.id} and generation = ${p.generation + 1} and operation_id = ${data.operationId} and claim_id = ${claimId} and visible_version_id = ${data.versionId} and visible_hash = ${data.sourceHash}) then 1 else abs(-9223372036854775808) end`,
        })
        .from(sql`(select 1)`),
      ...(existing
        ? []
        : [
            db.insert(releaseDeployments).values({
              id: deploymentId,
              ...data.deployment,
              activatedAt: at,
            }),
            state
              ? db
                  .update(releaseProductionState)
                  .set({
                    activeDeploymentId: deploymentId,
                    generation: state.generation + 1,
                    operationId: data.operationId,
                  })
                  .where(
                    and(
                      eq(releaseProductionState.id, 1),
                      eq(
                        releaseProductionState.generation,
                        data.expectedProductionGeneration,
                      ),
                    ),
                  )
              : db.insert(releaseProductionState).values({
                  id: 1,
                  activeDeploymentId: deploymentId,
                  generation: 1,
                  operationId: data.operationId,
                }),
          ]),
      db
        .select({
          assertion: existing
            ? sql`case when exists(select 1 from ${releaseProductionState} where id = 1 and generation = ${data.expectedProductionGeneration}) then 1 else abs(-9223372036854775808) end`
            : sql`case when exists(select 1 from ${releaseProductionState} where id = 1 and generation = ${data.expectedProductionGeneration + 1} and operation_id = ${data.operationId} and active_deployment_id = ${deploymentId}) then 1 else abs(-9223372036854775808) end`,
        })
        .from(sql`(select 1)`),
      db.insert(releaseDeploymentEntries).values({
        deploymentId,
        publicationId: p.id,
        versionId: data.versionId,
      }),
      db
        .update(contentEntries)
        .set({ status: 'published', publishedVersionId: data.versionId })
        .where(eq(contentEntries.id, p.entryId)),
      preparePlatformAudit(db, actor, {
        action: 'release.deployment_recorded',
        entityId: p.id,
        operationId: data.operationId,
        versionId: data.versionId,
        sourceHash: data.sourceHash,
      }),
      preparePlatformAudit(db, actor, {
        action: 'release.published',
        entityId: p.id,
        operationId: data.operationId,
        versionId: data.versionId,
        sourceHash: data.sourceHash,
        generation: p.generation + 1,
      }),
    ])
  } catch (error) {
    if (!isReleaseConflict(error)) throw error
    return { status: 'conflict' as const }
  }
  return { status: 'applied' as const }
}

const withdrawSchema = z.strictObject({
  operationId: releaseIdSchema,
  version: releaseVersionSchema,
  expectedGeneration: generationSchema,
  reason: z.enum(['sensitive', 'inaccurate', 'other']),
})
export async function withdrawRelease(
  db: Database,
  authority: ReleaseAuthority,
  input: z.input<typeof withdrawSchema>,
) {
  const data = withdrawSchema.parse(input)
  const [p] = await db
    .select()
    .from(releasePublications)
    .where(eq(releasePublications.releaseVersion, data.version))
  const claimId = newId()
  const actor = await requireReleasePermission(authority, 'publish')
  if (!p) return { status: 'conflict' as const }
  if (
    p.operationId === data.operationId &&
    p.withdrawalReason === data.reason &&
    p.withdrawnAt !== null
  )
    return { status: 'unchanged' as const }
  if (p.generation !== data.expectedGeneration || p.withdrawnAt !== null)
    return { status: 'conflict' as const }
  try {
    await runAtomicDatabaseBatch(db, [
      db
        .update(releasePublications)
        .set({
          withdrawnAt: new Date(),
          withdrawalReason: data.reason,
          generation: p.generation + 1,
          operationId: data.operationId,
          claimId,
        })
        .where(
          and(
            eq(releasePublications.id, p.id),
            eq(releasePublications.generation, data.expectedGeneration),
            isNull(releasePublications.withdrawnAt),
          ),
        ),
      db
        .select({
          assertion: sql`case when exists(select 1 from ${releasePublications} where id = ${p.id} and generation = ${p.generation + 1} and operation_id = ${data.operationId} and claim_id = ${claimId} and withdrawn_at is not null) then 1 else abs(-9223372036854775808) end`,
        })
        .from(sql`(select 1)`),
      db
        .update(contentEntries)
        .set({ status: 'withdrawn' })
        .where(eq(contentEntries.id, p.entryId)),
      preparePlatformAudit(db, actor, {
        action: 'release.withdrawn',
        entityId: p.id,
        operationId: data.operationId,
        reason: data.reason,
        generation: p.generation + 1,
      }),
    ])
  } catch (error) {
    if (!isReleaseConflict(error)) throw error
    return { status: 'conflict' as const }
  }
  return { status: 'applied' as const }
}

const cursorSchema = z.strictObject({
  shippedAt: z.number().int().min(1).max(8640000000000000),
  version: releaseVersionSchema,
})
const listingSchema = z.strictObject({
  locale: releaseLocaleSchema,
  cursor: cursorSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

/** Authenticated platform projection; organization, collection and status are not selectors. */
export async function listReleaseHistory(
  db: Database,
  session: AuthSession | null,
  input: z.input<typeof listingSchema>,
) {
  requireUserFrom(session)
  const data = listingSchema.parse(input)
  const cursor = data.cursor
  const rows = await db
    .select({
      version: releasePublications.releaseVersion,
      shippedAt: releasePublications.firstShippedAt,
      updatedAt: releasePublications.contentUpdatedAt,
      body: contentVersions.body,
      translation: {
        body: contentTranslations.body,
        reviewAuditId: contentTranslations.reviewAuditId,
        reviewedAt: contentTranslations.reviewedAt,
      },
    })
    .from(releasePublications)
    .innerJoin(
      contentEntries,
      and(
        eq(contentEntries.id, releasePublications.entryId),
        eq(
          contentEntries.publishedVersionId,
          releasePublications.visibleVersionId,
        ),
        eq(contentEntries.collection, 'blog'),
        eq(contentEntries.category, 'changelog'),
        eq(contentEntries.status, 'published'),
      ),
    )
    .innerJoin(
      contentVersions,
      and(
        eq(contentVersions.id, releasePublications.visibleVersionId),
        eq(contentVersions.entryId, releasePublications.entryId),
        eq(contentVersions.sourceHash, releasePublications.visibleHash),
      ),
    )
    .leftJoin(
      contentTranslations,
      and(
        eq(contentTranslations.versionId, contentVersions.id),
        eq(contentTranslations.locale, data.locale),
      ),
    )
    .where(
      and(
        isNull(releasePublications.withdrawnAt),
        isNotNull(releasePublications.firstShippedAt),
        isNotNull(releasePublications.visibleReviewedAt),
        eq(releasePublications.environment, 'production'),
        sql`exists(select 1 from ${releaseDeploymentEntries} as proof join ${releaseDeployments} as deployment on deployment.id = proof.deployment_id where proof.publication_id = ${releasePublications.id} and proof.version_id = ${contentVersions.id} and deployment.outcome = 'verified')`,
        cursor
          ? or(
              lt(
                releasePublications.firstShippedAt,
                new Date(cursor.shippedAt),
              ),
              and(
                eq(
                  releasePublications.firstShippedAt,
                  new Date(cursor.shippedAt),
                ),
                sql`${releasePublications.releaseVersion} collate binary < ${cursor.version}`,
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(releasePublications.firstShippedAt),
      sql`${releasePublications.releaseVersion} collate binary desc`,
    )
    .limit(data.limit + 1)
  const page = rows.slice(0, data.limit)
  const last = page.at(-1)
  return {
    items: page.map((row) => {
      if (!row.shippedAt) throw new Error('Missing shipped release timestamp.')
      return {
        version: row.version,
        shippedAt: row.shippedAt.getTime(),
        ...(row.updatedAt ? { updatedAt: row.updatedAt.getTime() } : {}),
        ...resolveReleaseContent(row.body, data.locale, row.translation),
      }
    }),
    nextCursor:
      rows.length > data.limit && last?.shippedAt
        ? { shippedAt: last.shippedAt.getTime(), version: last.version }
        : null,
  }
}
