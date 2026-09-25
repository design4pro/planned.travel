#!/bin/bash
#
# Project setup for a Claude Code session.
#
# Runs from the SessionStart hook in .claude/settings.json, after Claude Code
# launches, on startup and on resume. All it decides is which environment this
# is; `scripts/worktree/bootstrap.sh` owns every step of the provisioning
# itself, so the two profiles cannot drift apart.
#
# The division of labour on a session VM, which the docs are firm about and
# which is easy to get backwards: the *setup script* configured at
# claude.ai/code provisions the VM (toolchains, browsers - things that belong in
# the cached filesystem snapshot), and this hook does the project setup that has
# to reflect the commit that was just cloned. See docs/CLOUD.md §2.
#
# `CLAUDE_CODE_REMOTE` is `true` only on the session VM. Everywhere else this is
# a local checkout or a `git worktree`, which needs the same four fixtures for a
# different reason: a fresh worktree carries none of them, so `/login` answers
# 500 and the whole application behind it is unreachable until they exist.
# `--if-needed` makes the common case - a resume with everything already on
# disk - cost a few milliseconds.

set -euo pipefail

# A cezar run (CEZ_TASK_ID is set) is provisioned by its workflow's own bootstrap step, so this hook
# has nothing to add there. It still cost every session 2.5-10.6 minutes before the first turn: the
# basemap check never passes on the host, so `--if-needed` never skips and each session restarted
# vite, re-seeded and re-verified a server no automated flow uses (2026-09-24/25 run logs).
if [ -n "${CEZ_TASK_ID-}" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  exec bash scripts/worktree/bootstrap.sh --profile cloud
fi

exec bash scripts/worktree/bootstrap.sh --profile worktree --if-needed
