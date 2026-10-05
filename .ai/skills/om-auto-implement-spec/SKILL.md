---
name: om-auto-implement-spec
description: planned.travel extension of the installed om-auto-implement-spec skill. Spec lifecycle bookkeeping - the metadata table, the status directories and the generated index. The installed workflow applies unchanged.
---

Extends the installed skill: read `.claude/skills/om-auto-implement-spec/SKILL.md` and follow it. On
top:

- `$SPECS_DIR` is `.ai/specs` and it has **status directories**: a spec is at the root while it is
  unbuilt, in `implemented/` once every phase has shipped, in `archived/` when it was superseded or
  abandoned. Spec resolution searches all three, so a `{spec}` slug that matches
  `implemented/2026-09-09-geocoding-proxy.md` resolves to that path. `assets/` is not a status
  directory and holds no specs. The rules are `.ai/specs/AGENTS.md`; read it before touching the
  directory.
- Every spec carries a metadata table directly under its `H1` (`Status`, `Issue`, `Spec PR`,
  `Implementation`). **This skill owns the last two rows of its lifecycle.** When the implementation
  PR opens, set `Status` to `in-progress` on the implementation branch. When a phase merges, append
  its PR number to `Implementation`, in merge order.
- When the **final** phase merges, `git mv` the spec into `.ai/specs/implemented/` and set `Status` to
  `implemented` in the same commit. A spec whose phases ship on more than one PR stays at the root
  with `Status: in-progress` until the last one lands - partial delivery is not `implemented`, and
  `.ai/specs/AGENTS.md` → Ask First covers the judgement call.
- A spec the build shows should not be built as written goes to `archived/`, with `Status: archived`
  and a fifth `Superseded by` row naming the issue or pull request that replaced it.
  `.ai/specs/archived/2026-09-09-member-population-materialization.md` is the worked example. That
  move is an Ask First, not a decision this skill makes on its own.
- After a `git mv`, repoint anything that follows the spec today - an `assets/` README, a code
  comment. `.ai/runs/`, a merged PR body and the spec's own prose are dated records and stay as they
  are.
- Anything that shipped differently from the design is an `## Amendment` section in the spec naming
  its PR, not a silent divergence.
- Run `pnpm generate-spec-index` after any of the above and commit `.ai/specs/README.md` with the
  change. It is generated, `.ai/scripts/check-generated.sh` compares it, and
  `scripts/specs/__tests__/spec-registry.test.ts` fails when a table disagrees with the directory
  holding it.
- The implementation PR is the one that carries all of this. The spec PR stays design-only, exactly as
  the installed skill says.

**Protected writes are declared up front, and a refusal is handed over once.** Check the intended write paths before diagnosis or implementation. ADR 0025 removes upstream ownership, not runtime permissions: protected configuration (`.claude/**`, `.husky/*`) can still require supervision. Declare known protected writes in Cezar `writePaths` (or `cezar task --write-path`) before bootstrap or diagnosis, when the dispatch mechanism allows it, so preflight can stop before expensive work. After a denial, stop the unattended run once and hand the exact diff, the worktree and the paths, with the configuration guardian verdict from `.ai/skills/afk-decide/SKILL.md`, to a supervised run with approval limited to those paths. Never enable global `bypassPermissions`, switch tools to evade denial, or repeat diagnosis and tests for the same refusal. Changes outside this repository belong in their own pull request.
