# 0041. An Unscoped repos read for the calendar feed, not a third catalog member

Status: accepted
Date: 2026-10-16
Issue: #900

## Context

A bearer calendar request has no session or tenant until its digest resolves a feed row.
Fabricating a tenant context from request input would defeat the repository boundary.
SPEC §5 already has exactly two catalog members: twelve global tables and one bounded cron
reminder discovery query. A credential lookup is neither. Billing already uses five bounded
`…Unscoped` functions; ACCESS FU-3 asked SPEC to name their shape.

ADR 0035 is governance and remains unchanged. The calendar spec's reference to ADR 0035 for
this lookup predates that allocation; this decision uses the next free number, 0041.

## Decision

Keep the SQL in `src/server/repos/calendar-feeds.ts`. `findLiveFeedByDigestUnscoped` takes a
plain `Database` and digest, performs a unique point lookup excluding revoked rows, and returns
only `{ id, organizationId, userId, scope, tripId, lastServedAt }`, never tenant content, secret
or digest. Its sole production caller is `src/server/public/calendar-feed.ts`.

FU-3 names the general shape in SPEC §5/§6: the `Unscoped` suffix, a file-header justification,
one named production caller per function and a narrow projection without tenant content.
Review greps every `Unscoped` caller; an additional caller is a blocker. Catalog retains its
closed list of exactly two members. A future share resolver adopts this shape rather than
adding a catalog member.

`ResolvedFeed` is branded next to repo `openFeedScope`; only the resolver produces it and only
that seam constructs the owner-bound scope. The brand prevents accidental misuse, not malicious
code. Every fetch rechecks current membership, active ban and arming time, including current
trip membership for a trip feed. An old secret predating either membership stays refused after
a re-add without hooks or revocation writes. All content reads remain scoped; `readFeedSource`
uses nine statements, one trip read and eight content reads.

## Consequences

The public handler has no SQL or scope construction. Tenant isolation and the mechanical
Unscoped shape/caller guard remain required. A coordinate lookup cannot become a general tenant
content query by extending a serializer.

This decision does not approve platform exposure of bearer URLs. ACCESS §3.4a requires renewed
security approval, an explicit owner decision covering invocation logs and OTLP traces, and a
Cloudflare zone rate limit before merge. Panel QA alone cannot substitute for that decision;
the eventual PR retains `do-not-merge` until the prerequisites are recorded.

### 2026-10-17 platform-control execution record

After the concrete package was presented on PR #1334, the owner instructed autonomous
completion. The approved implementation disables invocation logs and platform traces/OTLP
export for both production and staging, retaining custom logs and application instrumentation.
Live readback confirmed both settings and unchanged bindings, annotations and deployed versions.
The shared `sentry-traces` destination was retained. Free zone ruleset
`699f480b7ba0468c919cbffaf18f42f2`, rule `297bfe6ddc154c41a05cc322ab333dea`,
protects `/api/feed/*` on all zone hosts/methods: block, IP + colocation, 100 requests/10 seconds,
10-second mitigation. Repository settings preserve this policy on subsequent deployments.
This record does not itself grant security shipping approval: live enforcement verification and
renewed independent security approval remain required.
[Execution evidence](https://github.com/design4pro/planned.travel/pull/1334#issuecomment-6228009286)
records configuration readback and matching pre-Worker request traces. Runtime threshold
enforcement was not measured: staging probes were intercepted by unchanged Cloudflare Access.
