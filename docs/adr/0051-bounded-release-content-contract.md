# 0051. Release history uses a bounded shared content repository

Status: accepted (contract only; #1872)
Date: 2026-11-09

## Context and authorization

The Release history spec (`.ai/specs/2026-11-03-release-history-in-settings.md`, #1730)
needs immutable shared editorial content and verified production publication. Existing tenant,
catalog, account-auth and interface-message contracts cannot imply that permission.
This amendment admits the bounded design only: no runtime content SQL, permission dictionary
change, migration, Settings item, operator command, production adapter, credential or workflow
is delivered here. Future runtime work needs fresh independent security and tenancy approval
of its actual diff. Production writes require separate authorization; main promotion keeps
its existing human and release guards. No package version, release tag, blog, help, RSS,
announcement, Studio editor, second release-prose store or KV snapshot is introduced.

## Admitted tables

Exactly these seven application-wide tables have no tenant selector. All constraints below
are required of the later additive generated schema; none is created by this amendment.

| Table                        | Required identity and constraint                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_entries`            | Unique `(collection, slug)`; release entries use `collection=blog`, `category=changelog`; lifecycle and approved published-version pointer.                                                                                                             |
| `content_versions`           | Immutable; unique `(entryId, revision)`; typed English body, source commit, normalized hash and cutoff SHA.                                                                                                                                             |
| `content_translations`       | Unique `(versionId, locale)`; typed body and explicit review audit reference/time bound to that exact immutable version.                                                                                                                                              |
| `release_publications`       | Unique `(environment, releaseVersion)`, meaning `(production, headingVersion)`; environment restricted to production; source version/hash, heading date, review audit reference/time, visible pointer, first shipped time, withdrawal reason/time and CAS generation. |
| `release_deployments`        | Unique provider deployment/version identity plus run/attempt; exact main commit/tree, verified target, activation time/outcome and receipt digest; no credentials or raw logs/payloads.                                                                 |
| `release_deployment_entries` | Unique `(deploymentId, publicationId)`; binds the exact source version contained in that deployment.                                                                                                                                                    |
| `release_production_state`   | Singleton active deployment pointer and CAS generation; older evidence cannot replace current state.                                                                                                                                                    |

## SQL and published projection

Only `src/server/repos/content.ts` and `src/server/repos/releases.ts` may own SQL for these
tables, taking a plain `Database`, never a fabricated `TenantScope`. This is the fifth closed
application-SQL exception (ADR 0002 and ADR 0049): not a catalog member, not an FU-3 resolver,
and no permission for arbitrary global queries, tenant joins or other collections. Catalog's
four members and thirteen global tables remain unchanged. Routes, scripts and content
orchestration hold no SQL. Reuse these shared primitives for later Studio work; no duplicate
release prose table or alternate locale resolver.

An authenticated published listing whitelists only release version, first shipped time,
optional updated time, approved exact-version title/summary/feature/fix blocks and resolved
entry locale/direction. Every returned entry must be approved, proven shipped and non-withdrawn.
No arbitrary collection selector, organization id, draft, reviewer identity, source cutoff,
receipt, deployment coordinates or tenant content is returned. Cross-workspace negative tests
must show that workspace roles grant no platform writes and neither caller can select tenant
content; the same deliberately published platform projection is available to both.

## Authority and atomic audit

`release:review` and `release:publish` extend the documented future permission vocabulary only.
Only platform admin receives either. Curator, user, all workspace roles, banned accounts,
unauthenticated callers and impersonation are denied. Read primary role and ban state again
immediately before invoking the existing pure `requirePermission`; read failure denies.
Keep `resolvePlatformRole` as the sole role resolver. Workspace ownership, a tenant token,
MCP bearer or a system actor confers no new release permission.

All content/release writes, including import, review, translation approval, reconciliation
and withdrawal, need that fresh platform guard and their audit row in the same fail-closed
atomic database batch. Import uses `release:review`; source/translation approval also uses
`release:review`; receipt, pointer and withdrawal mutations require `release:publish`.
Approval alone never implies deployment or visibility. Conditional statements bind approved
source/hash, expected generation and operation identity to prevent a stale writer winning.
Generic publish/rollback/delete/snapshot operations must refuse changelog entries unless they
satisfy the same eligibility and withdrawal rules; ordinary content deletion cannot cascade
away publication history or deployment receipts.

`src/server/catalog/audit.ts` remains the single audit writer: its proposed
`preparePlatformAudit(db, actor, entry)` seam validates actor, closed action vocabulary and
bounded metadata, constructs an unexecuted insert and throws on invalid input. There is
no second audit writer and no catalog-to-repos import. The release repository composes that
statement with its mutation, without executing or awaiting statements independently. Metadata
contains only ids, hashes, outcomes and bounded reason codes, never prose or credentials.
Reserve closed actions `release.imported`, `release.reviewed`, `release.translation_reviewed`,
`release.deployment_recorded`, `release.published` and `release.withdrawn`, each with entity type
`release`; their later runtime validation must be added by the audit owner, not a parallel enum.

The proposed `runAtomicDatabaseBatch(db, statements)` belongs to `src/server/repos/batch.ts`.
Reuse its existing atomic owner (`runAtomicBatch(TenantScope)`) rather than inventing another
executor. Require a driver known to provide atomic batch rollback; refuse unsupported drivers
before any statement executes. There is no sequential fallback and no fabricated tenant scope.
Validation, audit construction or any statement failure leaves the entire batch unapplied.
Keep statements bounded by the existing parameter ceiling; no interactive D1 transaction or
cross-system atomicity is assumed. Later tests must inject invalid audit input, audit insert
failure, unsupported driver, lost CAS and whole-batch rollback on a real atomic test driver.

Existing `appendPlatformAudit` callers remain after-commit and non-throwing, with existing
retry/logging behavior; existing `runBatch` and scoped `runAtomicBatch` callers keep their
contracts. The prepared-statement seam is a release-only exception to ACCESS §4.3, never a
request to make existing best-effort audit failures roll back completed work. Keep their
regression suites passing when the new runtime seams are eventually implemented.

### Review provenance and identity retention

Content translations and source approvals store an opaque `reviewAuditId` and review time,
not another copy of a reviewer user id. That reference is the principal audit operation id
inserted by the same fail-closed batch; the audit owner records the current reviewer there.
Translation audit metadata binds the exact version/hash and supported locale code. No foreign
key points at the expiring audit row. Reviewer identity is recoverable only within the existing
400-day platform audit retention; the surviving review reference does not extend it. Reviewer
erasure or audit pruning must not erase content, revoke completed source approval or invalidate
an approved exact-version translation. This adds no erasure writer or release permission and
leaves ADR 0043's registry and closed retention exceptions unchanged.

## Editorial content and source grammar

Interface messages retain all 23 locales and no fallback. Only reviewed release editorial
prose has whole-entry English fallback: a missing, unreviewed or stale translation selects
the exact approved English version's entire title and body. Set `lang="en"` and `dir="ltr"`
on that entry, plus a catalogue notice in the reader's language. A reviewed translation
selects its own language and direction, bound to the same source version; no mixed paragraphs
or reuse of an old translation. `src/server/content/resolve.ts` will own this choice.

Keep `# X.Y.Z (YYYY-MM-DD)` as the release heading and Git as English authority. The restricted
import grammar accepts plain paragraphs in Highlights and unordered feature/fix lists, with
optional plain emphasis and validated HTTPS or root-relative internal links (never `//`).
Render only typed React blocks/text, never raw HTML or arbitrary Markdown. Reject scripts,
event handlers, unsafe protocols, images, remote embeds, nested lists and unknown prose blocks
with a source location and no partial import. Attribution/contributors/cutoff metadata is parsed
separately, retained as provenance and never displayed automatically. Historical entries outside
the supported grammar require a reviewed Git correction or explicit migration; nothing is
silently discarded. Define concrete input size bounds and parser fixtures before runtime import.

## Deployment identity adapter and threat model

A later dependency-injected, read-only evidence adapter supplies repository, production target,
provider deployment/version id, run/attempt, exact main commit/tree, source hashes/cutoffs,
activation time, verified outcome and retained receipt digest. It re-fetches trusted deployment
records and correlates the actually served commit plus `CF_VERSION_METADATA` identity with
that receipt. These are required internal facts, not a claim about a vendor response shape.
Capture a live redacted correlated provider sample and review the adapter before depending on
provider fields. Do not expose secrets, environment values, raw logs or payloads; a separately
reviewed minimal served-identity response may expose artifact ids only.

| Threat                                                                                                                            | Required refusal or invariant                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forged receipt, staging/preview, skipped credentials, green run without deploy, failed/cancelled/pending or inaccessible evidence | Remain approved but unshipped; browser input cannot supply authority.                                                                                     |
| Main merge or ancestry without exact deployed prose                                                                               | Verify source hash/cutoff in the deployed tree; promotion alone cannot publish.                                                                           |
| Stale role, ban or impersonated admin                                                                                             | Fresh primary read and existing permission predicate; failure refuses before writes.                                                                      |
| Draft/tenant/private/security data leakage or XSS                                                                                 | Explicit projection, reviewed prose, typed blocks and safe link grammar; exclude tenant identifiers, exploit details and unreleased security information. |
| Duplicate, conflicting or reordered receipts and rollback                                                                         | Unique production/version, immutable revisions and CAS; late evidence cannot replace active state. Withdrawal hides content without erasing evidence.     |
| Partial audit/write or lost response                                                                                              | Atomic batch rollback; stable operation id, read persisted state before retry, never blind re-import or re-approval.                                      |
| Deployment changes during reconcile                                                                                               | Re-read active production identity immediately before batch; ambiguity stays pending. No cross-system atomicity promise.                                  |

Rolling back production never removes retained historical evidence. Reappearance requires the
same approved exact revision and verified deployment; withdrawing one entry does not rewrite
Git, undo a deploy or grant another content writer a bypass.
