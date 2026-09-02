# Issue tracker contract

The backlog lives in **GitHub Issues** on `design4pro/planned.travel`. A PRD is a parent issue; its
tickets are sub-issues; order comes from the native dependency graph. Labels are the state machine
(docs/agents/triage-labels.md, ADR 0015). Issues are closed when their work merges, by the sweeper,
never by a `Closes #n` (PRs target `develop`, where closing keywords do nothing).

Set once per session if needed: `GH_REPO=design4pro/planned.travel`.

## Reading

```bash
gh issue list --state open --json number,title,labels,parent
gh issue view <n> --json state,labels,body,blockedBy,subIssuesSummary --comments
gh api "repos/$GH_REPO/issues/<n>/sub_issues" --jq '.[].number'
```

## Writing

Humans and the scripts in `scripts/agent/` write labels, comments and issues; an agent never does so
directly. The two commands a human gives are labels: `run: triage` and `run: implement`. Planning is
started from the cezar cockpit (GitHub tab → issue → "Hand this to the agent" → workflow `plan`,
prompt `spec`, `prd` or `tickets`), and each artefact stops at `status: review` for a human.

```bash
gh issue edit <n> --add-label "run: implement"        # the only way work starts
gh issue edit <n> --add-label "auto-advance"          # PRD only: children start on their own as they unblock
gh issue comment <n> --body-file <file>
```

## Sub-issues and dependencies (what `publish-tickets.sh` does)

Both APIs want the numeric REST `id`, not the number and not the GraphQL node id:

```bash
ID=$(gh api "repos/$GH_REPO/issues/<child>" --jq '.id')
gh api -X POST "repos/$GH_REPO/issues/<parent>/sub_issues" -F sub_issue_id="$ID"
BLOCKER=$(gh api "repos/$GH_REPO/issues/<blocker>" --jq '.id')
gh api -X POST "repos/$GH_REPO/issues/<child>/dependencies/blocked_by" -F issue_id="$BLOCKER"
gh issue view <child> --json blockedBy                # verify the wave
```

Order matters: create the children as `status: queued`, attach `sub_issues`, attach `blocked_by`,
and only then move the unblocked ones to `status: ready`. A ticket labelled before its blockers
exist is a ticket a run could claim too early. Dependencies live only in GitHub; a body never
mirrors them.

## Body schemas

Each body starts with `<!-- schema: <name> -->`; the publish scripts validate the sections.

**`ticket/v2`** (a sub-issue; no `type:` label, it inherits the PRD's): Summary · Current behaviour ·
Desired behaviour · Fix direction · Key interfaces (optional) · Definition of Done (at most three
acceptance criteria) · Owned paths · Tenant isolation test · Verification · Visual change expected
(optional) · Out of scope. Estimated scope `XS`-`L`; `XL` only with `wave: solo`, when one concept
owns the whole round (SPEC §8). Never `Closes #n`.

**`spec/v1`** (written into the originating issue): Problem statement · Goals · Non-goals · Success
criteria · Constraints · Boundaries (Always / Ask first / Never) · Decisions log · Open questions; the
original request is kept in a `<details>` block. Open questions block the PRD step.

**`prd/v1`** (same issue, retitled `PRD: …`, labelled `prd`): everything in `spec/v1` plus Solution ·
User stories · Implementation decisions · Testing decisions · Module table (one concept, one owner) ·
Out of scope · Further notes.
