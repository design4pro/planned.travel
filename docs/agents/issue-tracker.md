# Issue tracker contract

The backlog lives in **GitHub Issues** on `design4pro/planned.travel`. Labels are the SDLC taxonomy
(`SDLC.md`, docs/agents/triage-labels.md, ADR 0018). Every `om-*` skill reads and writes the
tracker through `.ai/trackers/github.md` (`gh api` REST, gh >= 2.82.1) and mutates labels only
through that descriptor's guards; a human uses `gh` directly.

Set once per session if needed: `GH_REPO=design4pro/planned.travel`.

## Reading

```bash
gh issue list --state open --json number,title,labels
gh issue view <n> --json state,labels,body --comments
gh pr list --state open --json number,title,labels,isDraft
```

## Writing

No label starts work (ADR 0032). Opening an issue grooms and triages it; an issue with an Agent
Brief is implemented by the two-hour schedule (`node .ai/scripts/backlog-status.mjs --next` says
which one is next); a person starts any run now from the Cezar cockpit (docs/agents/cezar.md). The
labels a person sets by hand are holds:

```bash
gh issue edit <n> --add-label blocked          # human hold; nothing starts while it is there
gh issue edit <n> --remove-label blocked       # clear it: the issue is groomed and triaged again
gh issue edit <n> --add-label do-not-close     # housekeeping must never close this one
```

On a `gh` below 2.82.1 (the VPS has 2.46.0) these abort with a `Projects (classic)` error; use the
REST form, `gh api -X POST repos/design4pro/planned.travel/issues/<n>/labels -f 'labels[]=blocked'`.

A skill claims with assignee + `in-progress` + a 🤖 comment and releases both on exit, including on
error. A skill that acts on an inline review thread replies in it and resolves it (the `develop`
ruleset merges nothing with an open thread); a thread it declines stays open for a human.
Everything else it writes (category, priority, risk, pipeline labels, review, QA request, run
summary) follows `SDLC.md` and is explained in a comment.

## Closing

A PR that implements an issue says `Closes #n` in its body (`.github/pull_request_template.md`).
GitHub does not act on it, because PRs merge into `develop` and the default branch is `main`;
`om-close-fixed-issues`, in the `housekeeping` run three times a day, does. A spec-only or partial
PR says `Refs #n`. `do-not-close` on the issue wins over both.

## Specs

A feature is specified before it is built. `om-auto-write-spec` (the `spec` workflow, from the cockpit) writes
`.ai/specs/<YYYY-MM-DD>-<slug>.md` on a design-only PR (`spec/<slug>`, `documentation`,
`skip-qa`) that references the issue; the sections a spec must carry here are in
`.ai/skills/om-auto-write-spec/SKILL.md` ("Visual change expected", "Copy"). That PR says
`Refs #n`, never a closing keyword, so the issue stays open and **is** the implementation ticket -
no second issue is filed for building what the spec describes (ADR 0018). A human merges the spec
PR, then starts `issue-autofix` on that same issue from the cockpit, and `om-auto-fix-issue`'s feature route resolves the
merged spec and hands it to `om-auto-implement-spec`; starting `implement-spec` from the cockpit
with the spec path, its issue number or the spec-PR number is that same skill by hand. Either way
the implementation ships on its own PR with `Closes #n`. Interactive thinking
before an issue exists is `brainstorm` (`om-brainstorm`), which ends by filing the issue through
`om-prepare-issue`. A spec that `afk-plan-to-spec` writes for a plan stage of `docs/plans/` is the exception to "a
human merges the spec PR": the pipeline merges it on its specialist panel's verdicts (ADR 0033), and the Reconciler
slices it. The feature-spec flow above is unchanged, and so is the spec task `implement-ticket` writes: a person merges both of those spec PRs.
