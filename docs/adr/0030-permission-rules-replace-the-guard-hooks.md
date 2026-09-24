# 0030. Permission rules replace the guard hooks

Status: accepted
Date: 2026-09-24
Amends: ADR 0018 (the hooks are no longer the gate for a step with no `bashAllowlist`), ADR 0025
(`guard-generated.sh`, `git-guardrails.sh` and `guard-read.sh` do not stay; they go).

## Context

ADR 0018 made three `PreToolUse` hooks the boundary of an agent run: `git-guardrails.sh` (Bash),
`guard-read.sh` (Read, Glob, Grep) and `guard-generated.sh` (Edit, Write). With their test suite
they grew to about 900 lines of shell and 1,400 lines of tests, touched by 49 commits in four
weeks, almost all of them a newly found way to spell a refused command - a line continuation, a
heredoc, `bash -lc`, a symlink, a `..` - and the test that closed it. `money-tracker.online`
carries a copy, so every fix was paid twice. The hooks' own headers name the problem: a denylist
of ways to run a string "is a list that is always missing one", and `guard-read.sh` is "not a
containment boundary".

Nothing outside this repository asks for them: cezar does not depend on project hooks.

cezar starts Claude Code with `--permission-mode dontAsk`. Claude Code's own `permissions.deny`
rules hold in that mode, apply to every subcommand of a compound command, to `cat`/`sed` and
redirections in Bash as well as to the file tools, and need no parser of ours. `permissions.ask`
prompts a developer and is refused in `dontAsk`, which is the agent-run tier without an environment
check. Checked on 2026-09-24 against a copy of the new `.claude/settings.json`: Read and `cat` of
`.dev.vars`, an Edit of `src/routeTree.gen.ts`, `echo && npx wrangler secret put` and
`git push --force-with-lease` were denied, `.dev.vars.example` stayed readable, and
`wrangler deploy` was refused.

## Decision

1. `git-guardrails.sh`, `guard-read.sh`, `guard-generated.sh` and `.claude/hooks/__tests__/hooks.test.ts`
   are deleted. `format-file.sh` stays; it formats, it does not guard.
2. `.claude/settings.json` carries the few operations nothing recovers from as `deny` (secrets,
   generated files, history rewrites, `--no-verify`, a written Cloudflare secret, a deleted Cloudflare
   store or Worker) and deploys and remote D1 commands as `ask`. Refusing rules belong in that file
   now.
3. The GitHub Actions tier goes with the hooks: no workflow in `.github/workflows/` runs Claude Code.

## Consequences

- A write outside the worktree is no longer refused. A bare `Edit` or `Write` in `--allowedTools`
  reaches any path the user can write, and Claude Code has no write counterpart to
  `blockReadsOutsideWorkingDirectories`. This is accepted: it is what `guard-generated.sh` caught
  after a `pr-autopilot` run rewrote eight files in a sibling checkout, and the fix, if it recurs,
  is path-scoped `--allowedTools` in cezar rather than a hook here.
- Reads outside the worktree, environment dumps, `pnpm add` and recursive deletes are no longer
  refused in an agent run. One worktree per run, the PAT scopes, branch protection and review of
  every pull request are what bound them.
- A permission rule matches the command as written, not `bash -c '…'` or `/usr/bin/…` - the same
  gap the hooks had, without the code that pretended to close it.
- `.husky/pre-commit`'s test moves to `scripts/__tests__/pre-commit.test.ts`.
