/**
 * The erasure's verification sweep (engine step 7, `.ai/specs/2026-10-08-erase-a-persons-data.md`
 * phase 5): "done" is proven here, not assumed.
 *
 * It looks for the person in every place the registry names and reports each place that still holds
 * them:
 *
 * - every registered tenant column, in each affected workspace, through that workspace's
 *   `TenantScope` (so workspace B is neither read nor reported by A's sweep);
 * - the auth tables and the non-column places (invitations by email, `verification` rows by
 *   identifier and by value, impersonated sessions), across every workspace;
 * - the rewritten object keys, by `head`;
 * - `active-sessions-<userId>` and the discount-attempt counter, absent.
 *
 * `platform_audit_log` is the one registered exception and is not swept. The platform-table places
 * that SPEC §5 keeps behind `src/server/catalog` are reported as unverified until the change that
 * ships their scrubs supplies their counts: **any gap fails the sweep**, and a missing email is
 * never read as zero.
 *
 * **The report names places, never people.** A finding carries a `table.column` name, an opaque
 * organization id and a count. It never carries the user id, the email, a name, an object key (a key
 * holds the file's name) or a session token, and neither does the log line.
 */

import {
  countAccountPlacesUnscoped,
  countWorkspacePlaces,
  platformPlaceNames,
} from '#/server/repos/erasure-sweep'
import { activeSessionsIndexKey } from '#/server/fns/console/session-keys'
import { discountAttemptsUserKey } from '#/server/billing/discounts'
import { ownsObject } from './stores'

import type { Logger } from '#/server/observability'
import type { PlaceCount } from '#/server/repos/erasure-sweep'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { HeadableObjectStore, ReadableKeyStore } from './stores'

export type FindingKind = 'column' | 'unverified' | 'key' | 'object'

export interface Finding {
  readonly kind: FindingKind
  /** `table.column`, a store key family, or an object condition. Never a value. */
  readonly place: string
  /** The workspace a `column` or `object` finding belongs to. */
  readonly organizationId?: string
  readonly count: number
}

export interface VerificationReport {
  readonly passed: boolean
  readonly findings: ReadonlyArray<Finding>
}

export interface WorkspaceVerification {
  readonly scope: TenantScope
  /** The keys the metadata rewrite was asked to cover in this workspace. */
  readonly objectKeys: ReadonlyArray<string>
}

export interface VerifyErasureInput {
  readonly db: Database
  readonly userId: string
  /** `null` fails the sweep: the places addressed by email cannot be checked without it. */
  readonly email: string | null
  /**
   * Counts for the platform-table places (`staff_api_tokens`, `provider_registry`), read through
   * `src/server/catalog` by the change that ships their scrubs. A place left out is reported as
   * unverified.
   */
  readonly platform?: ReadonlyArray<PlaceCount>
  readonly workspaces: ReadonlyArray<WorkspaceVerification>
  readonly stores: {
    readonly sessions: ReadableKeyStore
    readonly kv: ReadableKeyStore
    readonly objects: HeadableObjectStore
  }
  readonly logger?: Logger
}

async function verifyObjects(
  input: VerifyErasureInput,
  workspace: WorkspaceVerification,
): Promise<Array<Finding>> {
  const organizationId = workspace.scope.ctx.organizationId
  const tally = { missing: 0, refused: 0, 'names-person': 0 }

  for (const key of new Set(workspace.objectKeys)) {
    const head = await input.stores.objects.head(key)
    if (head === null) {
      tally.missing += 1
    } else if (!ownsObject(organizationId, key, head)) {
      tally.refused += 1
    } else if (head.customMetadata?.uploadedBy === input.userId) {
      tally['names-person'] += 1
    }
  }

  return Object.entries(tally)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({
      kind: 'object' as const,
      place: `r2.uploaded-by.${reason}`,
      organizationId,
      count,
    }))
}

/** Runs the sweep and returns what is left; it changes nothing. */
export async function verifyErasure(
  input: VerifyErasureInput,
): Promise<VerificationReport> {
  const findings: Array<Finding> = []

  const seen = new Set<string>()
  for (const workspace of input.workspaces) {
    const organizationId = workspace.scope.ctx.organizationId
    if (seen.has(organizationId)) continue
    seen.add(organizationId)

    for (const { place, count } of await countWorkspacePlaces(
      workspace.scope,
      input.userId,
    )) {
      if (count > 0) {
        findings.push({ kind: 'column', place, organizationId, count })
      }
    }
    findings.push(...(await verifyObjects(input, workspace)))
  }

  const account = await countAccountPlacesUnscoped(input.db, {
    userId: input.userId,
    email: input.email,
  })
  for (const { place, count } of account.counts) {
    if (count > 0) findings.push({ kind: 'column', place, count })
  }
  const supplied = new Map(
    (input.platform ?? []).map(({ place, count }) => [place, count]),
  )
  for (const place of platformPlaceNames()) {
    const count = supplied.get(place)
    if (count === undefined) {
      findings.push({ kind: 'unverified', place, count: 1 })
    } else if (count > 0) {
      findings.push({ kind: 'column', place, count })
    }
  }
  for (const place of account.unverified) {
    findings.push({ kind: 'unverified', place, count: 1 })
  }

  const keys = [
    {
      place: 'kv.active-sessions-index',
      store: input.stores.sessions,
      key: activeSessionsIndexKey(input.userId),
    },
    {
      place: 'kv.discount-attempts',
      store: input.stores.kv,
      key: discountAttemptsUserKey(input.userId),
    },
  ]
  for (const { place, store, key } of keys) {
    if ((await store.get(key)) !== null) {
      findings.push({ kind: 'key', place, count: 1 })
    }
  }

  const report = { passed: findings.length === 0, findings }
  input.logger?.[report.passed ? 'info' : 'warn']('erasure verification', {
    passed: report.passed,
    workspaces: seen.size,
    findings: findings.length,
    places: [...new Set(findings.map((finding) => finding.place))],
  })
  return report
}
