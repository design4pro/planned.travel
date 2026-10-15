# 0039. The Sentry sweep runs daily and files user feedback

Status: accepted
Date: 2026-10-13
Amends: ADR 0008 (the cadence, and what counts as a Sentry finding).
Amended by: ADR 0040 (point 4: a Sentry ticket is triaged unattended).

## Context

ADR 0008 set the sweep to one run a week over a seven-day window, and to errors only. Two things
changed. The application now ships a feedback widget (`src/lib/sentry-feedback.ts`), so Sentry
holds reports people wrote on purpose, and nothing carried them to the backlog. And a week is a long
time for a report or a new production error to wait before anybody is told.

## Decision

1. **The sweep runs every day at 06:00 UTC over the last 24 hours.** `THRESHOLDS` is unchanged, so
   the bar is now per day. The dedup index keeps a tracked short id from being filed twice.
2. **A feedback report is a Sentry finding.** It is filed as `bug` or `feature` + `priority-medium`,
   with the same `sentry-issue` marker, under the same per-run cap and backlog-pressure limit, and
   ahead of the errors. It is searched over a fixed seven days because it never recurs.
3. **Nothing a user typed is copied to GitHub.** The ticket carries the agent's paraphrase, passed
   through `sanitizeFeedbackText`; the message, the address and the screenshot stay in Sentry.
4. **ADR 0032 stands.** A ticket with the marker is still never groomed, briefed or implemented by
   an unattended run. A person reads it and starts a run from the cockpit.

## Consequences

- At today's traffic no error clears 25 events or 5 users in a day, so until traffic grows the
  daily sweep files feedback and little else. Lowering the bar is a separate decision.
- Up to three tickets a day instead of three a week. `BACKLOG_PRESSURE_LIMIT` (10 open) is the
  brake, and it now also bounds how much anyone can add by sending reports.
- The dedup index reads `feature` tickets as well as `bug`, or a filed request would be filed again
  every morning.
- The paraphrase is written by a model that has read untrusted text. Sanitising it lowers the risk
  of an instruction reaching a later run and does not remove it, which is why point 4 is not
  relaxed here.
