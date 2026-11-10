/** ADR 0051's bounded shared blog/changelog owner. No tenant selectors or generic content writes. */
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireReleasePermission } from '#/server/auth/release-authority'
import { preparePlatformAudit } from '#/server/catalog/audit'
import {
  generationSchema,
  releaseBodySchema,
  releaseIdSchema,
  releaseLocaleSchema,
  releaseVersionSchema,
  sourceHashSchema,
  sourceShaSchema,
} from '#/server/content/collections'
import { hashSecret } from '#/server/security/secret'
import {
  contentEntries,
  contentVersions,
  contentTranslations,
  newId,
  releasePublications,
} from '#/server/db/schema'
import { runAtomicDatabaseBatch } from './batch'
import type { Database } from '#/server/db/types'
import type { ReleaseAuthority } from '#/server/auth/release-authority'

const importSchema = z.strictObject({
  operationId: releaseIdSchema,
  version: releaseVersionSchema,
  headingDate: z.iso.date(),
  sourceCommit: sourceShaSchema,
  cutoffSha: sourceShaSchema,
  body: releaseBodySchema,
})
export const releaseApprovalSchema = z.strictObject({
  operationId: releaseIdSchema,
  version: releaseVersionSchema,
  versionId: releaseIdSchema,
  sourceHash: sourceHashSchema,
  expectedGeneration: generationSchema,
})

/** Only known CAS/identity conflicts become results; storage errors still fail visibly. */
export function isReleaseConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    /integer overflow|UNIQUE constraint failed/.test(error.message) ||
    isReleaseConflict(error.cause)
  )
}

/** Both initial lookup and lost-race recovery give a reused commit precedence over a hash match. */
async function findSourceVersion(
  db: Database,
  releaseVersion: string,
  sourceCommit: string,
  sourceHash: string,
) {
  const matches = await db
    .select({
      version: contentVersions,
      cutoffSha: releasePublications.cutoffSha,
      headingDate: releasePublications.headingDate,
    })
    .from(contentVersions)
    .innerJoin(
      releasePublications,
      eq(releasePublications.entryId, contentVersions.entryId),
    )
    .where(
      and(
        eq(releasePublications.releaseVersion, releaseVersion),
        or(
          eq(contentVersions.sourceCommit, sourceCommit),
          eq(contentVersions.sourceHash, sourceHash),
        ),
      ),
    )
  return (
    matches.find((row) => row.version.sourceCommit === sourceCommit) ??
    matches.find((row) => row.version.sourceHash === sourceHash)
  )
}

export async function importRelease(
  db: Database,
  authority: ReleaseAuthority,
  input: z.input<typeof importSchema>,
) {
  const data = importSchema.parse(input)
  const sourceHash = await hashSecret(JSON.stringify(data.body))
  const [publication] = await db
    .select()
    .from(releasePublications)
    .where(eq(releasePublications.releaseVersion, data.version))
  const base = { versionId: publication?.currentVersionId ?? '', sourceHash }
  if (
    publication &&
    (publication.cutoffSha !== data.cutoffSha ||
      publication.headingDate !== data.headingDate)
  ) {
    await requireReleasePermission(authority, 'review')
    return { ...base, status: 'conflict' as const }
  }
  if (publication) {
    const match = await findSourceVersion(
      db,
      data.version,
      data.sourceCommit,
      sourceHash,
    )
    const existing = match?.version
    if (existing) {
      await requireReleasePermission(authority, 'review')
      const identical =
        existing.sourceHash === sourceHash &&
        existing.cutoffSha === data.cutoffSha &&
        JSON.stringify(existing.body) === JSON.stringify(data.body)
      return {
        versionId: existing.id,
        sourceHash: existing.sourceHash,
        status: identical ? ('unchanged' as const) : ('conflict' as const),
      }
    }
  }
  const entryId = publication?.entryId ?? newId()
  const publicationId = publication?.id ?? newId()
  const versionId = newId()
  const [latest] = await db
    .select({ revision: contentVersions.revision })
    .from(contentVersions)
    .where(eq(contentVersions.entryId, entryId))
    .orderBy(desc(contentVersions.revision))
    .limit(1)
  const claimId = newId()
  const actor = await requireReleasePermission(authority, 'review')
  const audit = preparePlatformAudit(db, actor, {
    action: 'release.imported',
    entityId: publicationId,
    operationId: data.operationId,
    versionId,
    sourceHash,
  })
  const version = db.insert(contentVersions).values({
    id: versionId,
    entryId,
    revision: (latest?.revision ?? 0) + 1,
    body: data.body,
    sourceCommit: data.sourceCommit,
    sourceHash,
    cutoffSha: data.cutoffSha,
  })
  try {
    if (publication) {
      await runAtomicDatabaseBatch(db, [
        version,
        db
          .update(releasePublications)
          .set({
            currentVersionId: versionId,
            approvedVersionId: null,
            approvedHash: null,
            reviewAuditId: null,
            reviewedAt: null,
            generation: publication.generation + 1,
            operationId: data.operationId,
            claimId,
          })
          .where(
            and(
              eq(releasePublications.id, publicationId),
              eq(releasePublications.generation, publication.generation),
            ),
          ),
        db
          .select({
            assertion: sql`case when exists(select 1 from ${releasePublications} where id = ${publicationId} and generation = ${publication.generation + 1} and operation_id = ${data.operationId} and claim_id = ${claimId} and current_version_id = ${versionId}) then 1 else abs(-9223372036854775808) end`,
          })
          .from(sql`(select 1)`),
        audit,
      ])
    } else {
      await runAtomicDatabaseBatch(db, [
        db.insert(contentEntries).values({ id: entryId, slug: data.version }),
        version,
        db.insert(releasePublications).values({
          id: publicationId,
          releaseVersion: data.version,
          entryId,
          headingDate: data.headingDate,
          cutoffSha: data.cutoffSha,
          currentVersionId: versionId,
          operationId: data.operationId,
          claimId,
        }),
        audit,
      ])
    }
  } catch (error) {
    if (!isReleaseConflict(error)) throw error
    // A concurrent identical import returns the same persisted version after the losing batch rolls back.
    const winner = await findSourceVersion(
      db,
      data.version,
      data.sourceCommit,
      sourceHash,
    )
    if (
      winner &&
      winner.version.sourceHash === sourceHash &&
      winner.cutoffSha === data.cutoffSha &&
      winner.headingDate === data.headingDate &&
      JSON.stringify(winner.version.body) === JSON.stringify(data.body)
    )
      return {
        versionId: winner.version.id,
        sourceHash,
        status: 'unchanged' as const,
      }
    return { ...base, status: 'conflict' as const }
  }
  return { versionId, sourceHash, status: 'applied' as const }
}

export async function approveRelease(
  db: Database,
  authority: ReleaseAuthority,
  input: z.input<typeof releaseApprovalSchema>,
) {
  const data = releaseApprovalSchema.parse(input)
  const [row] = await db
    .select({ publication: releasePublications, version: contentVersions })
    .from(releasePublications)
    .innerJoin(
      contentVersions,
      eq(contentVersions.id, releasePublications.currentVersionId),
    )
    .where(eq(releasePublications.releaseVersion, data.version))
  const claimId = newId()
  const actor = await requireReleasePermission(authority, 'review')
  const result = { versionId: data.versionId, sourceHash: data.sourceHash }
  if (
    !row ||
    row.version.id !== data.versionId ||
    row.version.sourceHash !== data.sourceHash
  )
    return { ...result, status: 'conflict' as const }
  const p = row.publication
  if (
    p.operationId === data.operationId &&
    p.approvedVersionId === data.versionId &&
    p.approvedHash === data.sourceHash
  )
    return { ...result, status: 'unchanged' as const }
  if (p.generation !== data.expectedGeneration)
    return { ...result, status: 'conflict' as const }
  try {
    await runAtomicDatabaseBatch(db, [
      db
        .update(releasePublications)
        .set({
          approvedVersionId: data.versionId,
          approvedHash: data.sourceHash,
          reviewAuditId: data.operationId,
          reviewedAt: new Date(),
          generation: p.generation + 1,
          operationId: data.operationId,
          claimId,
        })
        .where(
          and(
            eq(releasePublications.id, p.id),
            eq(releasePublications.generation, data.expectedGeneration),
            eq(releasePublications.currentVersionId, data.versionId),
          ),
        ),
      db
        .select({
          assertion: sql`case when exists(select 1 from ${releasePublications} where id = ${p.id} and generation = ${p.generation + 1} and operation_id = ${data.operationId} and claim_id = ${claimId} and approved_version_id = ${data.versionId} and approved_hash = ${data.sourceHash}) then 1 else abs(-9223372036854775808) end`,
        })
        .from(sql`(select 1)`),
      preparePlatformAudit(db, actor, {
        action: 'release.reviewed',
        entityId: p.id,
        operationId: data.operationId,
        versionId: data.versionId,
        sourceHash: data.sourceHash,
        generation: p.generation + 1,
      }),
    ])
  } catch (error) {
    if (!isReleaseConflict(error)) throw error
    return { ...result, status: 'conflict' as const }
  }
  return { ...result, status: 'applied' as const }
}

const translationSchema = releaseApprovalSchema.extend({
  locale: releaseLocaleSchema.exclude(['en']),
  body: releaseBodySchema,
})
export async function approveReleaseTranslation(
  db: Database,
  authority: ReleaseAuthority,
  input: z.input<typeof translationSchema>,
) {
  const data = translationSchema.parse(input)
  const [p] = await db
    .select()
    .from(releasePublications)
    .where(eq(releasePublications.releaseVersion, data.version))
  const [version] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, data.versionId))
  const [translation] = await db
    .select()
    .from(contentTranslations)
    .where(
      and(
        eq(contentTranslations.versionId, data.versionId),
        eq(contentTranslations.locale, data.locale),
      ),
    )
  const claimId = newId()
  const actor = await requireReleasePermission(authority, 'review')
  if (
    !p ||
    version?.entryId !== p.entryId ||
    version.sourceHash !== data.sourceHash ||
    p.approvedVersionId !== data.versionId ||
    p.approvedHash !== data.sourceHash
  )
    return { status: 'conflict' as const }
  if (translation)
    return {
      status:
        JSON.stringify(translation.body) === JSON.stringify(data.body) &&
        translation.reviewedAt !== null
          ? ('unchanged' as const)
          : ('conflict' as const),
    }
  if (p.generation !== data.expectedGeneration)
    return { status: 'conflict' as const }
  try {
    await runAtomicDatabaseBatch(db, [
      db
        .update(releasePublications)
        .set({
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
          ),
        ),
      db
        .select({
          assertion: sql`case when exists(select 1 from ${releasePublications} where id = ${p.id} and generation = ${p.generation + 1} and operation_id = ${data.operationId} and claim_id = ${claimId}) then 1 else abs(-9223372036854775808) end`,
        })
        .from(sql`(select 1)`),
      db.insert(contentTranslations).values({
        versionId: data.versionId,
        locale: data.locale,
        body: data.body,
        reviewAuditId: data.operationId,
        reviewedAt: new Date(),
      }),
      preparePlatformAudit(db, actor, {
        action: 'release.translation_reviewed',
        locale: data.locale,
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
