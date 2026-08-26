#!/usr/bin/env bash
#
# Resolve the dev server an /ultrabuild agent should talk to.
#
# This script is the single source of truth for the port pool. It exists because the rule used to
# be prose in four separate agent prompts: every agent re-interpreted it, sixteen concurrent
# `pnpm dev` servers once put this machine at a load average of 563, and a whole round's gate came
# back as 64 timeouts with not one pixel difference among them. Twenty-three findings across ten
# rounds were about port resolution and nothing else. A script cannot be re-interpreted.
#
# Usage:
#   scripts/ultrabuild/resolve-port.sh            # print the port of a running server, or exit 1
#   scripts/ultrabuild/resolve-port.sh --start    # ... or start exactly one and print its port
#
# Prints ONLY the port number on stdout. Everything else goes to stderr, so
# `PORT=$(scripts/ultrabuild/resolve-port.sh --start)` is safe.

set -euo pipefail

POOL_LO=3000
POOL_HI=3010
START=0
[[ ${1:-} == "--start" ]] && START=1

repo_root() { cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd; }
ROOT="$(repo_root)"

# Identity, not liveness — and identity means THIS WORKING TREE, not merely this project.
#
# /api/dev/seed is this repo's own endpoint, so a match proves the server is a dev build of this
# app. That is necessary and it is not sufficient: every git worktree of this repo answers it
# identically. Measured, and expensively — this machine was running three worktrees at once, and
# the probe happily handed back main's server on 3005 and a third worktree's on 3001. Five rounds
# of Playwright results were therefore measured against source the branch under test did not have
# (main was 2433 insertions ahead, including 376 lines of styles.css and tokens.css), and the
# page-height differences that produced were reported as regressions of this branch.
#
# So the second half of the check asks the kernel whose tree the listening process is actually
# serving, and only a process whose cwd is $ROOT counts as ours.
serving_root() {
  local pid
  pid="$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1)"
  [[ -n "$pid" ]] || return 1
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

is_ours() {
  curl -fsS -m 3 "http://localhost:$1/api/dev/seed" 2>/dev/null | grep -q '"ok"' || return 1
  local cwd
  cwd="$(serving_root "$1")" || return 1
  [[ "$cwd" == "$ROOT" ]]
}

port_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# 1. Reuse first: the lowest port in the pool that identifies as this app.
for p in $(seq "$POOL_LO" "$POOL_HI"); do
  if is_ours "$p"; then
    echo >&2 "resolve-port: reusing the server already answering on $p"
    echo "$p"
    exit 0
  fi
done

if [[ $START -eq 0 ]]; then
  echo >&2 "resolve-port: no server in $POOL_LO-$POOL_HI identifies as this app."
  echo >&2 "resolve-port: re-run with --start, or report and stop. Never start one by hand."
  exit 1
fi

# 2. Start exactly one, on the lowest FREE port in the pool. A busy port that is not ours belongs
#    to someone else; a busy port that is ours was caught above. Either way we never kill it.
FREE=""
for p in $(seq "$POOL_LO" "$POOL_HI"); do
  if port_free "$p"; then FREE="$p"; break; fi
done

if [[ -z "$FREE" ]]; then
  echo >&2 "resolve-port: every port in $POOL_LO-$POOL_HI is taken and none is ours. Report and stop."
  exit 1
fi

# `pnpm dev` is `vite dev --port 3000`, and appending a second --port relies on the last flag
# winning. Calling vite directly means the port we asked for is the port we get.
LOG="${TMPDIR:-/tmp}/ultrabuild-dev-$FREE.log"
echo >&2 "resolve-port: no server in the pool — starting one on $FREE (log: $LOG)"
# A server started from an agent's background shell does NOT outlive that shell here: the harness
# takes the whole tree down when the task ends, and a POSIX::setsid wrapper was tried and changed
# nothing. So do not plan on a server surviving between rounds — each round's own agent starts one
# and uses it for as long as it runs, which is all the gate actually needs.
(cd "$ROOT" && nohup pnpm exec vite dev --port "$FREE" >"$LOG" 2>&1 &)

for _ in $(seq 1 60); do
  if is_ours "$FREE"; then
    echo >&2 "resolve-port: started and answering on $FREE"
    echo "$FREE"
    exit 0
  fi
  sleep 2
done

echo >&2 "resolve-port: started a server on $FREE but it never identified as ours. See $LOG"
exit 1
