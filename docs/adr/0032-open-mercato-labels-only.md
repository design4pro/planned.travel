# 0032. Open Mercato labels only

Status: accepted
Date: 2026-10-01
Amends: ADR 0018 (the `groom` / `autofix` / `spec` command labels are gone), ADR 0031 (the
promotion carries `do-not-merge`). Retires the intake labels, which arrived with the agent kit and
were never recorded in an ADR.

## Context

Beside the taxonomy the Open Mercato skills define (`open-mercato/skills`, `SDLC.md` § Label
state machine: pipeline, category, meta, priority, risk, plus `do-not-close`), this repository ran
three label families of its own:

- the **intake labels** `needs-triage`, `needs-info`, `ready-for-agent` and `ready-for-human`,
  which said who acts on an issue next;
- the **command labels** `groom`, `autofix` and `spec`, which a person added to start one run;
- `promotion`, added on 2026-10-01 to keep the `develop` -> `main` release out of the unattended
  merge once every PR was authored by the one account.

None of them is read by an Open Mercato skill. Each one needed its own override text, its own
automation, its own row in `backlog-status.mjs`, and its own rule about who may set it and when.
The Open Mercato skills answer the same questions without labels: an issue is ready when it meets
the Definition of Ready, which `om-auto-manage-issues` and `om-auto-fix-issue` check themselves,
and a person's hold is `blocked`, `do-not-merge` or `do-not-close`. The owner's direction
(2026-10-01) is that no label outside that taxonomy is created or used.

## Decision

1. The vocabulary is exactly `labels` in `.ai/agentic.config.json`: the Open Mercato taxonomy and
   `do-not-close`. Every other label is deleted from the repository. Dependabot names
   `dependencies` explicitly, so its per-ecosystem defaults (`javascript`, `github_actions`) are
   never created again.
2. **Readiness is an Agent Brief, not a label.** An issue is ready for an unattended implementation
   when it was opened by an author the issue automations' `authors` gate trusts and was not filed
   by `sentry-triage`, carries an `## Agent Brief` (in a trusted author's comment, written by
   `afk-triage`, or in the body of a ticket `afk-to-tickets` filed), has a category, a priority
   and a risk, every issue it names under "Blocked by" is closed, no open PR addresses it, no 🤖
   not-ready or `STOP:` comment waits for an answer (so an issue `implement-ticket` refused is not
   picked again every tick), and it carries no `blocked`, `do-not-merge`, `do-not-close` or
   `in-progress`.
3. **A schedule starts implementation.** "Implement the next ready issue" runs `implement-ticket`
   every two hours. Its first step asks `node .ai/scripts/backlog-status.mjs --next` for the one
   highest-priority, oldest ready issue, and the script answers nothing while three agent PRs are
   still open (the WIP limit) - every open PR the maintainer authored except the `do-not-merge`
   promotion, so a stalled draft counts as much as one in `review`. The schedule replaces `ready-for-agent`, `autofix` and the ticket
   frontier `afk-to-tickets` used to promote: a ticket becomes ready the moment its blockers close.
4. **New issues are groomed and triaged in one run.** `issue.opened` by the maintainer runs
   `issue-groom`: `om-auto-manage-issues`, then `afk-triage`. Two automations on the same event
   would race on the same labels.
5. **A person's hold is `blocked` plus a 🤖 comment.** What `ready-for-human` and `needs-info`
   said is now `blocked` and a comment naming the one thing a person has to do (the cases
   `.ai/skills/afk-decide/SKILL.md` § 5 reserves). Skills set it on issues; only a person clears
   it, and clearing it (`issue.unlabeled`) grooms and triages the issue again. Open Mercato says
   `blocked` is set by humans; on an issue, here, a skill sets it too, always with that comment.
6. **The promotion PR carries `do-not-merge`** instead of `merge-queue` and `promotion`, and
   `promote-develop.yml` puts it back on every push to `develop`. Every merge path already refuses
   `do-not-merge`, and `set_pipeline_label` never removes it. The rule that an unattended run
   merges only into base `develop` stays as a second layer.
7. `groom`, `autofix` and `spec` and their automations are gone. Their workflows stay, for a run a
   person starts from the Cezar cockpit.

## Consequences

- Every issue the maintainer opens is groomed, triaged and, when ready, implemented and merged
  into `develop` without a person in between. The brakes are the ones that were already there:
  the `authors` filter, the specialist verdict `risk-high` and `security` work needs before a claim,
  the WIP limit, `maxParallel`, and the owner's `qa-approved` on `risk-high`.
- An issue opened by anyone else is never groomed, triaged or implemented by automation, and
  neither is a Sentry ticket, whoever filed it: its body quotes production error data. A
  maintainer who vouches for one re-files it, or starts the runs from the cockpit. This includes
  the issues the retired `design4pro-agent` account opened.
- `backlog-status.mjs` reads only the `authors` gates from the automations file: there is no
  trigger label to diagnose.
- Implementation is at most one issue per two hours, by design. A person who wants one sooner
  starts `implement-ticket` on it from the cockpit.
