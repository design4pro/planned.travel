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

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  exec bash scripts/worktree/bootstrap.sh --profile cloud
fi

exec bash scripts/worktree/bootstrap.sh --profile worktree --if-needed
