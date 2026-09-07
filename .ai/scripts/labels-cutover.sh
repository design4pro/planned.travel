#!/usr/bin/env bash
# One-off label cutover from the ADR 0015 vocabulary to the SDLC taxonomy (ADR 0018). Dry-run
# by default; `--apply` writes. Idempotent: a label already renamed or already absent is skipped.
#
#   .ai/scripts/labels-cutover.sh [--apply]
#
# Run it on the cezar host with the operator's gh, AFTER the old automations are disabled and the
# sweeper is unloaded, and AFTER a snapshot:
#   gh label list --limit 200 --json name,color,description > docs/agents/migration/labels-$(date +%F).json
#   gh issue list --state open --limit 500 --json number,labels > docs/agents/migration/issues-$(date +%F).json
#
# What it does, in order:
#   1. strips every `status: *` label from open issues (a PR's pipeline label is the only state
#      now; an open issue without labels is the backlog);
#   2. moves `status: queued` / `status: needs-human` holders to `blocked` first, so a human hold
#      survives the strip;
#   3. renames the labels that map one-to-one; merges `type: enhancement` into `feature`. The two
#      command labels (`run: *` -> `groom` / `autofix`) move on OPEN issues only: a command on a
#      closed issue is history, and `groom` / `autofix` are live triggers that would start a run as
#      soon as the automations register. Review the open `run: *` issues before `--apply`: each one
#      becomes a pending command that starts once the automations register;
#   4. leaves `prd`, `auto-advance`, `agent-pr`, the stripped `status: *` and `needs-e2e` in place
#      - deleting them is PR C's step, once nothing reads them.
set -euo pipefail

REPO="${GH_REPO:-design4pro/planned.travel}"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

say() { printf '%s\n' "$*" >&2; }
run() { if [ "$APPLY" -eq 1 ]; then "$@"; else say "would: $*"; fi; }

have_label() { gh label list -R "$REPO" --limit 200 --json name --jq '.[].name' | grep -qxF -- "$1"; }

# 2. human holds first
for old in 'status: queued' 'status: needs-human'; do
  have_label "$old" || continue
  gh issue list -R "$REPO" --state open --label "$old" --limit 500 --json number --jq '.[].number' | while read -r n; do
    run gh issue edit "$n" -R "$REPO" --add-label blocked
  done
done

# 1. strip status:* from open issues
gh label list -R "$REPO" --limit 200 --json name --jq '.[].name | select(startswith("status: "))' | while read -r st; do
  gh issue list -R "$REPO" --state open --label "$st" --limit 500 --json number --jq '.[].number' | while read -r n; do
    run gh issue edit "$n" -R "$REPO" --remove-label "$st"
  done
done

# 3. renames (old -> new); the new label already exists from PR A, so this is a move of the issues
# followed by a delete of the old name, not `gh label edit --name` (which would collide).
# rename OLD NEW [STATE]: STATE is `all` for standing labels (history keeps its category) and
# `open` for commands, where a closed issue must not receive a live trigger. The delete at the end
# strips the old name from whatever was not moved.
rename() {
  local old="$1" new="$2" state="${3:-all}"
  have_label "$old" || { say "skip $old: absent"; return; }
  gh issue list -R "$REPO" --state "$state" --label "$old" --limit 1000 --json number --jq '.[].number' | while read -r n; do
    run gh issue edit "$n" -R "$REPO" --add-label "$new" --remove-label "$old"
  done
  gh pr list -R "$REPO" --state "$state" --label "$old" --limit 1000 --json number --jq '.[].number' | while read -r n; do
    run gh pr edit "$n" -R "$REPO" --add-label "$new" --remove-label "$old"
  done
  run gh label delete "$old" -R "$REPO" --yes
}
rename 'run: triage' groom open
rename 'run: implement' autofix open
rename 'type: bug' bug
rename 'type: feature' feature
rename 'type: enhancement' feature
rename 'type: maintenance' refactor
rename 'agent-docs' documentation
# `status: in-progress` and `status: review` are not renamed: step 1 already stripped them from
# every open issue, and moving a closed issue's history onto the live `in-progress` / `review`
# labels would be a claim or a pipeline state on something finished. PR C deletes them.

[ "$APPLY" -eq 1 ] || say "dry run; pass --apply to write"
