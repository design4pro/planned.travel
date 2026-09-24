#!/usr/bin/env bash
# PreToolUse hook (Read|Glob|Grep). Two tiers.
#
# Tier one - the secret files, refused to every caller: .dev.vars*, .env*, .ai/qa/test-env.env and
# the basemap cache. Since `.claude/settings.json` became hooks-only this hook is what carries that
# rule for the file-reading tools. It guards those tools only: `cat .dev.vars` is a Bash call and
# reaches git-guardrails.sh instead, which does not stop it - so this is a guard against the
# obvious read, not a containment boundary.
#
# Tier two - agent runs only (CEZ_TASK_ID or GITHUB_ACTIONS): a run reads inside its own worktree
# and never another run's state or git internals, while a developer at the keyboard legitimately
# reads outside the checkout. .ai/runs, .ai/analysis, .ai/qa and .ai/tmp stay readable either way -
# the om-* skills write their artefacts there; only the test-env credentials file under .ai/qa/ is
# denied. Three places outside the worktree are the run's own and stay readable: its Claude Code
# transcript directory (`<config dir>/projects/<slug of the project dir>`, where oversized tool
# output is parked), its scratch directory (`<main>/.ai/cezar/tmp/$CEZ_TASK_ID`, what cezar sets
# TMPDIR to), and - for a cezar worktree at `<main>/.ai/cezar/worktrees/<id>` - the main checkout
# it hangs off, minus `<main>/.ai/cezar/` (every other run's state) and `<main>/.git/`.
#
# Contract: exit 2 blocks the tool call and feeds stderr back to the model; exit 0 allows.
set -euo pipefail

agent_run() { [ -n "${CEZ_TASK_ID:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; }

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')
target=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
pattern=$(printf '%s' "$input" | jq -r '.tool_input.pattern // empty')
glob=$(printf '%s' "$input" | jq -r '.tool_input.glob // empty')

# Which input names a path depends on the tool. `Glob` matches its `pattern` against paths, but
# `Grep` searches file *contents* with it and filters paths with `glob` - so `process.env` is a
# search for that source expression, not a request to read `.env`.
case "$tool" in
  Grep) path_pattern="$glob" ;;
  Glob) path_pattern="${pattern:-$glob}" ;;
  *)
    # No `tool_name` in the payload: `pattern` could be either, so it counts as a path only when
    # it is shaped like one - a separator or a glob metacharacter. That keeps `**/.dev.vars`
    # denied without reading a bare content regex as a request for the file it names.
    case "$pattern" in
      */* | *\** | *\?* | *\[*) path_pattern="$pattern" ;;
      *) path_pattern="$glob" ;;
    esac
    ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
root=$(cd "$root" && pwd -P)

# Resolve to a physical path; a file that does not exist yet resolves through its parent.
resolve() {
  local p="$1" dir base
  case "$p" in /*) ;; *) p="$root/$p" ;; esac
  if [ -d "$p" ]; then
    (cd "$p" && pwd -P)
  else
    dir=$(dirname "$p"); base=$(basename "$p")
    [ -d "$dir" ] || { printf '%s\n' "$p"; return; }
    printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
  fi
}

# What a run may read beyond its worktree. `main` is the checkout a cezar worktree hangs off, found
# by stripping `/.ai/cezar/worktrees/<id>` from the root; anywhere else - GitHub Actions, a run in
# the checkout itself - it is the root, which widens nothing. The scratch directory is derived from
# `main` and CEZ_TASK_ID rather than taken from TMPDIR, which can name /tmp as readily as the run's
# own directory; both sides are compared resolved, so a TMPDIR that spells it differently still
# matches. The transcript slug is the project dir with every non-alphanumeric character turned into
# `-`, which is how Claude Code names it - one run's slug, never a prefix of another's.
main="$root"
own_tmp=""
if [ -n "${CEZ_TASK_ID:-}" ]; then
  case "$root" in
    */.ai/cezar/worktrees/*/*) ;;
    */.ai/cezar/worktrees/?*) main="${root%/.ai/cezar/worktrees/*}" ;;
  esac
  case "$CEZ_TASK_ID" in
    . | .. | *[!A-Za-z0-9._-]*) ;;
    *) own_tmp=$(resolve "$main/.ai/cezar/tmp/$CEZ_TASK_ID") ;;
  esac
fi
transcripts="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}/projects"
project_dir="${CLAUDE_PROJECT_DIR:-$root}"
# Both spellings of the project dir: the one the harness was handed and the resolved one.
own_transcripts=$(resolve "$transcripts/${project_dir//[!A-Za-z0-9]/-}")
own_transcripts_resolved=$(resolve "$transcripts/${root//[!A-Za-z0-9]/-}")

deny() {
  echo "BLOCKED: reading '$1' is not allowed ($2). The user has prevented you from doing this." >&2
  exit 2
}

deny_agent() {
  echo "BLOCKED (agent run): reading '$1' is outside what a run may see ($2)." >&2
  exit 2
}

check() { # path
  local abs rel
  abs=$(resolve "$1")
  # Outside the worktree `rel` stays absolute, so the patterns below still match a secret file
  # sitting in some other checkout.
  rel="${abs#"$root"/}"

  # Tier one: refused in every session.
  case "$rel" in
    .dev.vars*|*/.dev.vars*|.env|.env.*|*/.env|*/.env.*)
      case "$rel" in *.example) ;; *) deny "$1" "environment file" ;; esac ;;
  esac
  case "$rel" in
    .ai/qa/test-env.env|*/.ai/qa/test-env.env) deny "$1" "test-env credential file" ;;
    .e2e-tiles|.e2e-tiles/*|*/.e2e-tiles|*/.e2e-tiles/*) deny "$1" "basemap cache" ;;
  esac

  # Tier two: confinement, for agent runs only.
  agent_run || return 0
  # A `..` component cannot be resolved lexically when the directory does not exist, so
  # it is refused outright; a run names files by their plain path.
  case "$1" in ..|../*|*/..|*/../*) deny_agent "$1" "outside the worktree" ;; esac
  if [ -n "$own_tmp" ]; then
    case "$abs" in "$own_tmp"|"$own_tmp"/*) return 0 ;; esac
  fi
  # First match wins, so the worktree - itself under `$main/.ai/cezar/` - is decided before the
  # main checkout's run state is refused; with `main` equal to the root the last three never fire.
  case "$abs" in
    "$own_transcripts"|"$own_transcripts"/*|"$own_transcripts_resolved"|"$own_transcripts_resolved"/*) return 0 ;;
    "$root"|"$root"/*) ;;
    "$main"/.ai/cezar|"$main"/.ai/cezar/*) deny_agent "$1" "cezar run state" ;;
    "$main"/.git|"$main"/.git/*) deny_agent "$1" "git internals" ;;
    "$main"/*) return 0 ;;
    *) deny_agent "$1" "outside the worktree" ;;
  esac
  case "$rel" in
    .ai/cezar/runs*|.ai/cezar/worktrees*|.ai/cezar/tmp*) deny_agent "$1" "cezar run state" ;;
    .git/*) deny_agent "$1" "git internals" ;;
  esac
}

[ -n "$target" ] && check "$target"
# A path pattern that walks upwards or names a denied file is a read of it.
case "$path_pattern" in
  '') ;;
  ../*|*/../*|/*) check "$path_pattern" ;;
esac
case "$path_pattern" in
  '') ;;
  *.dev.vars*|*.env|*.env.*|*.e2e-tiles*|*test-env.env*) deny "$path_pattern" "pattern names a protected file" ;;
esac

exit 0
