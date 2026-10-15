# 0040. Sentry tickets are triaged unattended

Status: accepted
Date: 2026-10-15
Amends: ADR 0032 (a Sentry ticket is no longer kept from every unattended run), ADR 0039 (point 4).

## Context

ADR 0039 made the sweep file production errors and user feedback every morning, and kept point 4
of ADR 0032: a ticket carrying the `sentry-issue` marker waits for a person to read it and start a
run. In practice that leaves every report on the backlog until someone looks, and the owner wants
the morning's findings worked on the same day.

The reason for the rule still holds. The body is drawn from production data: the feedback summary is
a model's paraphrase of a stranger's text, and an error message can carry user input. Every run has
Bash with no allowlist and push rights, so the body is still a path for an instruction to reach one.

## Decision

1. **The Reconciler starts `triage` on a Sentry ticket.** `backlog-status.mjs` reports it
   NEEDS_TRIAGE when the sweep filed it (as `app/github-actions`) or a trusted author did. The
   marker in anyone else's issue changes nothing: that issue stays EXTERNAL.
2. **Only a trusted comment's brief makes it ready.** A brief in the body of a Sentry ticket does
   not count, so the text the sweep filed can never make the ticket ready by itself.
3. **afk-triage briefs it from the code.** It confirms the report at HEAD, writes the brief in its
   own words and never copies the body into it. A report it cannot confirm, or a request the product
   owner specialist declines, gets a `🤖 HUMAN-ONLY:` hold that points a person at Sentry.
4. **Once briefed, the ticket follows the ordinary rules.** implement-ticket takes it when ready,
   and `risk-high` or `security` still needs the security specialist's approving verdict (SDLC.md).
5. **What stays as it was.** `om-auto-manage-issues` never grooms a Sentry ticket (grooming rewrites
   the description from the body), and `afk-unblock` never lifts a hold on one: a hold on a report
   triage could not confirm is a person's to read.

## Consequences

- A morning's findings can reach a pull request the same day with no person in between.
- The prompt-injection risk is reduced, not removed. The brief is written from the code, but
  triage and implement-ticket still read the body, and the paraphrase was written by a model that
  read hostile text. `sanitizeFeedbackText` and the brief-from-the-code rule are the mitigations;
  this ADR accepts the rest.
- Up to three tickets a day can each start a triage run, bounded by `BACKLOG_PRESSURE_LIMIT`, the
  per-run cap and the Reconciler's per-project limit.
