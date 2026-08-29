# 0008. Sentry findings enter the backlog as untriaged bugs

Status: accepted
Date: 2026-08-29

## Context

Until now the loop could only work on what a human or the auditor had written down. Nothing in the
system learned that the deployed application was failing: `src/server/observability/logger.ts` emits
structured logs to Workers Observability, which is a live tail — it answers "what is happening now"
for somebody already looking, and nothing at all for an error recurring at 3am. A browser-side crash
was invisible outright.

Sentry now reports from both environments (docs/DEPLOY.md §17), which makes the recurring failures
legible for the first time. Reading them is not the same as acting on them, and a dashboard nobody
opens is the same as no dashboard.

ADR 0006 already established how an unverified finding becomes work: it is filed as
`type: bug` + `status: pending`, and a pre-triage agent reproduces it at HEAD and promotes only what
it can. That contract is what a Sentry sweep should feed, rather than inventing a second path.

## Decision

`pnpm sandcastle:sentry`, and `.github/workflows/sentry-triage.yml` weekly, read Sentry through the
Sentry MCP server (read-only, `--skills=inspect`) and file qualifying findings as
`type: bug` + `status: pending`. Never `ready-for-agent`: this routine reproduces nothing, and
ADR 0006 promotes on a reproduction.

The division of labour is deliberate. The **agent** gathers — it holds the Sentry data — and may
**veto** a candidate for a reason no threshold can see ("a load test is hammering staging"). The
**script** decides: the thresholds, the dedup index and the ticket body live in
`.sandcastle/sentry-triage/policy.ts`, so a policy change is a reviewable diff rather than a sentence
edited in a prompt, and two runs a week apart look at the same population. A `file` judgement cannot
promote a candidate the gate rejected.

Deduplication is keyed on the Sentry short id, carried as a `<!-- sentry-issue: … -->` marker, and
checked against **open and closed** issues through the issues API rather than GitHub search — the
search index lags, and two runs close together would otherwise each see nothing and file twice.

## Consequences

The backlog gains a source nobody typed into it. The brakes are: report-only by default for a human
run, at most three issues per run, and a refusal to file at all while ten untriaged bugs are already
open — the last one matters most, because the others are per-run and a misconfigured schedule still
runs.

This is also the repository's first `schedule:` trigger, which ADR 0004 deferred. It is scoped to
one read-only sweep that files at most three tickets, is pinned to this repository so a fork does not
inherit it, and files with a PAT rather than `GITHUB_TOKEN` — issues opened with the latter emit no
events, so `triage.yml` would never see them and the tickets would land and sit.

If the tickets turn out to be noisy, the first lever is the thresholds in `policy.ts`, not a return
to reading the dashboard by hand. If they turn out to be _empty_ for weeks, the first lever is the
requirement that a candidate carry a stack frame under `src/` — the strictest clause, and the one
most likely to be excluding real defects whose frames sit in a dependency.
