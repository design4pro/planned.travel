#!/usr/bin/env bash
# PreToolUse hook (Edit|Write). Three tiers, and they are deliberately different in reach
# (ADR 0018, narrowed by ADR 0025):
#
#   1. always  - a hand-edit of a generated file
#   2. in an agent run (CEZ_TASK_ID or GITHUB_ACTIONS) - a write outside the worktree, bar the
#      run's own scratch directory
#   3. under GITHUB_ACTIONS only - a write to a path that configures the agent
#
# Each generated file has a generator, and the generator is the source of truth. A hand-edit
# survives exactly until the next run of it, and in between produces the worst kind of failure:
# one that reproduces on one machine and not another.
#
# Tier 3 used to apply to cezar runs too, with an exception for a file the branch already changed.
# ADR 0025 removed that half. It was the whole of the edit friction the kit retirement was about -
# a correction to a skill, a hook or a workflow became a two-repository round trip - and in a cezar
# run the branch is a human's, proposed as a pull request and read by a reviewer before it merges.
# GitHub Actions may execute untrusted pull-request content. A running agent must not rewrite
# git-guardrails.sh, which is re-read on every PreToolUse. Tier 3 remains active in that context.
#
# Contract: exit 2 blocks the tool call and feeds stderr back to the model; exit 0 allows.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file_path" ] && exit 0

case "$file_path" in
  */src/routeTree.gen.ts)
    echo "BLOCKED: src/routeTree.gen.ts is generated from the files under src/routes. Run 'pnpm generate-routes' instead of editing it." >&2
    exit 2
    ;;
  */drizzle/*.sql | */drizzle/meta/*)
    echo "BLOCKED: drizzle/ is generated from src/server/db/*-schema.ts. Change the schema and run 'pnpm db:generate' instead of editing SQL or the journal by hand - a hand-written migration is invisible to the drift check in CI, and migrations must stay additive." >&2
    exit 2
    ;;
  */worker-configuration.d.ts)
    echo "BLOCKED: worker-configuration.d.ts is generated from wrangler.jsonc. Change the bindings there and run 'pnpm cf-typegen' instead of editing it." >&2
    exit 2
    ;;
esac

[ -n "${CEZ_TASK_ID:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
# Physical path, because the comparison below is only sound when both sides are spelled the same
# way. On macOS a worktree under $TMPDIR is reached through /var, a symlink to /private/var, and
# the tools hand back the resolved form - so an unresolved root reports every write as outside it,
# including the ones inside. A root that does not exist stays as written; a fixture may name one.
root=$(cd "$root" 2>/dev/null && pwd -P || printf '%s' "$root")

# Resolve to a physical path. A file being written usually does not exist yet, and often neither
# does its directory, so this walks up to the nearest ancestor that does and re-appends the rest.
# Resolving only the immediate parent is not enough: `mkdir -p`-style writes are the common case,
# and under $TMPDIR every one of them would come back unresolved and compare unequal to a root
# that is resolved - a new file in a new directory, refused for being outside the worktree it is
# plainly inside.
resolve() {
  local p="$1" dir tail=""
  case "$p" in /*) ;; *) p="$root/$p" ;; esac
  dir="$p"
  while [ ! -d "$dir" ]; do
    tail="${dir##*/}${tail:+/$tail}"
    dir="${dir%/*}"
    if [ -z "$dir" ]; then
      dir=/
      break
    fi
  done
  dir=$(cd "$dir" && pwd -P)
  # `/` would otherwise give a doubled separator. An `&&` one-liner here would be the `set -e`
  # trap: a false test makes the statement itself non-zero and kills the subshell mid-resolve.
  if [ "$dir" = / ]; then dir=""; fi
  if [ -z "$tail" ]; then
    printf '%s\n' "${dir:-/}"
  else
    printf '%s/%s\n' "$dir" "$tail"
  fi
}

deny_outside() { # reason
  echo "BLOCKED (agent run): '$file_path' $1. A run writes only inside the worktree it was given and its own scratch directory. A change that belongs to another repository - a sibling checkout on this machine, say - is proposed there as a pull request from its own clone, never by editing a sibling working tree." >&2
  exit 2
}

# Confinement, and the first thing checked, because every rule below reasons about a path relative
# to the root and an outside path has no such form: `${file_path#"$root"/}` leaves it absolute, the
# anchored pattern cannot match an absolute path, and so the whole of this hook reads as "not
# guarded". A pr-autopilot run took `../agent-kit/templates/...` on exactly that route and rewrote
# eight files in a sibling checkout a human was working in, replacing template sources with one
# repository's render. Nothing downstream could tell: the next sync reported "no change".
#
# Edit and Write are what this covers, which is what that incident used. A Bash redirect still
# reaches outside - which paths a shell command writes is not a question a matcher can answer, and
# git-guardrails.sh says why at length - so this is the boundary for the file-writing tools rather
# than a sandbox.
#
# A `..` component is refused outright rather than resolved: it cannot be resolved lexically when
# the directory does not exist, and a run names files by their plain path.
#
# The one directory outside the worktree a run does write is its own scratch space: cezar points
# TMPDIR at `<main>/.ai/cezar/tmp/$CEZ_TASK_ID`, where `<main>` is the checkout the worktree
# (`<main>/.ai/cezar/worktrees/<id>`) hangs off, and a review draft or a cloned upstream belongs
# there. It is derived from the root and CEZ_TASK_ID, never read from TMPDIR, so another run's
# directory - or /tmp, when a run has no directory of its own - stays outside.
case "$file_path" in ..|../*|*/..|*/../*) deny_outside "walks through '..'" ;; esac
abs=$(resolve "$file_path")
own_tmp=""
if [ -n "${CEZ_TASK_ID:-}" ]; then
  main="$root"
  case "$root" in
    */.ai/cezar/worktrees/*/*) ;;
    */.ai/cezar/worktrees/?*) main="${root%/.ai/cezar/worktrees/*}" ;;
  esac
  case "$CEZ_TASK_ID" in
    . | .. | *[!A-Za-z0-9._-]*) ;;
    *) own_tmp=$(resolve "$main/.ai/cezar/tmp/$CEZ_TASK_ID") ;;
  esac
fi
case "$abs" in
  "$root" | "$root"/*) ;;
  # With no directory of its own this arm reads `/*` and matches everything, hence the test.
  "$own_tmp"/*) [ -n "$own_tmp" ] || deny_outside "is outside the worktree" ;;
  *) deny_outside "is outside the worktree" ;;
esac

# Tier 3, and under GITHUB_ACTIONS alone. A cezar run reaches this line and stops here.
[ -n "${GITHUB_ACTIONS:-}" ] || exit 0

# The agent's own configuration: hooks, settings, Cezar workflows, the om config, tracker and
# browser descriptors, the skill overrides and the validation entrypoints under .ai/scripts/ (a
# run must not rewrite the gate it is about to be judged by). docs/agents/reference.md and
# out-of-scope.md are the clean-room rule and the product boundary, governance a run reads and
# never edits.
#
# `.claude/hooks/` is the load-bearing entry. `git-guardrails.sh` is re-read on every PreToolUse;
# an Actions agent able to rewrite it could disable tracker-mutation checks mid-run.
# scripts/ci/ and the two docs/agents/cezar-*.json extend the same boundary to CI verdicts and
# the automations/prompts installed in the cockpit.
rel="${abs#"$root"/}"

if printf '%s' "$rel" | grep -Eq '^(\.github/|\.claude/|\.husky/|\.ai/cezar/|\.ai/agentic\.config\.json$|\.ai/trackers/|\.ai/browsers/|\.ai/skills/|\.ai/scripts/|scripts/ci/|docs/agents/cezar-(automations|prompt-templates)\.json$|\.npmrc$|pnpm-workspace\.yaml$|docs/agents/reference\.md$|docs/agents/out-of-scope\.md$)'; then
  echo "BLOCKED (GitHub Actions): '$rel' configures the agent; a run started by a pull request never edits it. Note it under 'Noticed but not touching' and carry on." >&2
  exit 2
fi

exit 0
