# Issue tracker contract

The backlog lives in **GitHub Issues** on `design4pro/planned.travel`. PRDs are parent issues; tickets are sub-issues. Sub-issue list order is execution order. Issues are closed when their work merges — a closed issue is the only record we keep (no doc rot).

Set once per session if needed: `GH_REPO=design4pro/planned.travel`.

## Reading

```bash
gh issue list --state open --json number,title,labels,body
gh issue view <n> --comments
gh api "repos/$GH_REPO/issues/<n>/sub_issues" --jq '.[].number'   # children, in execution order
```

## Writing

```bash
gh issue create --title "<title>" --label "ready-for-agent" --body-file <file>
gh issue comment <n> --body "<text>"
gh issue edit <n> --add-label "<label>" --remove-label "<label>"
gh issue close <n>
```

## Sub-issues (PRD → tickets)

```bash
ISSUE_ID=$(gh api "repos/$GH_REPO/issues/<child>" --jq '.id')
gh api -X POST "repos/$GH_REPO/issues/<parent>/sub_issues" -f sub_issue_id="$ISSUE_ID"
```

Check `gh api "repos/$GH_REPO/issues/<parent>/sub_issues" --jq 'length'` before adding, to stay idempotent.

## Dependencies

Blocking relationships use native GitHub issue dependencies (GraphQL `blockedBy` / `blocking`). A ticket is workable only when it has zero open blockers and is not itself a PRD with sub-issues. Ticket bodies must NOT contain `Closes #n` directives — closing is the merger's job.
