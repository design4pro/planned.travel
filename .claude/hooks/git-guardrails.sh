#!/usr/bin/env bash
# PreToolUse hook (Bash): blocks destructive git commands for everyone, and in agent mode
# (CEZ_TASK_ID or GITHUB_ACTIONS set) the two things an om-* run never needs: dumping the
# environment (the worktree holds live secrets in .dev.vars) and changing the pinned stack
# (docs/SPEC.md §3). GitHub mutations, `git add -A`, closing keywords and `pnpm exec` are the
# om-* skills' ordinary tools (tracker descriptor .ai/trackers/github.md, SDLC.md) and stay open
# under Cezar. Under GitHub Actions they stay blocked: see the last section.
# Contract: exit 2 blocks the tool call and feeds stderr back to the model; exit 0 allows.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

[ -z "$command" ] && exit 0

block() {
  echo "BLOCKED: '$command' matches dangerous pattern '$1'. The user has prevented you from doing this." >&2
  exit 2
}

case "$command" in
  *"git push"*--force*develop*|*"git push"*--force*main*|*"git push"*-f\ *develop*|*"git push"*-f\ *main*)
    block "force-push to develop/main" ;;
esac

echo "$command" | grep -Eq 'git\s+reset\s+--hard' && block 'git reset --hard'
echo "$command" | grep -Eq 'git\s+clean\s+-[a-zA-Z]*f' && block 'git clean -f'
echo "$command" | grep -Eq 'git\s+branch\s+-D\b' && block 'git branch -D'
echo "$command" | grep -Eq 'git\s+(checkout|restore)\s+\.' && block 'git checkout/restore .'

# Everything below applies to agent runs only; a developer at the keyboard keeps pnpm and env.
[ -n "${CEZ_TASK_ID:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || exit 0

agent_block() {
  echo "BLOCKED (agent run): '$command' matches '$1'. $2" >&2
  exit 2
}

echo "$command" | grep -Eq '(^|[^[:alnum:]_/-])pnpm\s+(add|remove|rm|uninstall|update|up|upgrade)\b' \
  && agent_block 'pnpm add|remove|update' 'The stack is pinned (docs/SPEC.md §3); end the run as blocked and name the dependency.'
echo "$command" | grep -Eq '(^|[^[:alnum:]_/-])printenv\b' && agent_block 'printenv' 'The environment holds secrets.'
echo "$command" | grep -Eq '(^|[^[:alnum:]_/-])env(\s*$|\s*\||\s+-0|\s*;|\s*&&)' && agent_block 'env dump' 'The environment holds secrets.'

# GitHub Actions only. .github/workflows/claude-code-review.yml runs on every pull_request
# with `--permission-mode bypassPermissions` and a pull-requests:write token, so the diff it
# reads is untrusted input and this hook is the only thing between a crafted PR and
# `gh pr review --approve`. A Cezar run (CEZ_TASK_ID) is different: it runs on the
# operator's host, on work the operator queued, and mutates GitHub through the tracker
# descriptor by design, so these blocks do not apply there.
[ -n "${GITHUB_ACTIONS:-}" ] || exit 0

actions_block() {
  echo "BLOCKED (GitHub Actions): '$command' matches '$1'. The review job posts one comment and nothing else." >&2
  exit 2
}

echo "$command" | grep -Eq 'gh\s+(issue|pr)\s+(create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock|merge|review|ready|checkout)\b' && actions_block 'gh issue|pr mutation'
# `comment` is the one verb with an exception. The code review posts its summary with
# `gh pr comment`, and that job is the one agent run whose whole purpose is to write to a pull
# request. Only .github/workflows/claude-code-review.yml sets the variable, and a pull request
# cannot set it for itself: editing that workflow makes the action's OIDC exchange refuse to run
# the review at all. `gh issue comment` stays blocked either way.
comment_targets='issue|pr'
[ "${CLAUDE_REVIEW_PR_COMMENT:-}" = 1 ] && comment_targets='issue'
echo "$command" | grep -Eq "gh\s+($comment_targets)\s+comment\b" && actions_block 'gh issue|pr mutation'
echo "$command" | grep -Eq 'gh\s+(label|release|repo|secret|variable|workflow|run)\s' && actions_block 'gh mutation surface'
if echo "$command" | grep -Eq '(^|[^[:alnum:]_/-])gh\s+api\b'; then
  echo "$command" | grep -Eq '(--method|-X)[[:space:]=]*(POST|PATCH|PUT|DELETE)|(^|\s)(-f|-F|--field|--raw-field|--input)(\s|=)' && actions_block 'gh api non-GET'
fi

exit 0
