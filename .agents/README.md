# Project agent tooling

- `skills/`: the complete Open Mercato collection and the user-approved Impeccable addon. The Open Mercato pin and three reviewed local repairs are recorded in `scripts/agents/skills-upstream.json`; `skills-lock.json` hashes only Open Mercato directories.
- `policies/`: mandatory repository rules, routed by `AGENTS.md` before each skill.
- `reviewers/`: independent specialist briefs for generic sub-agents.
- `workflows/`: delivery contracts read by Cezar prompts.
- `policy.json`: command and secret patterns used by static workflow tests, not an OS sandbox.

`pnpm install-skills` restores the reviewed Open Mercato pin. An explicit update uses `pnpm install-skills -- --ref <full-reviewed-SHA>`. The self-contained synchronizer validates local files before mutation, preserves reviewed repairs and stops when their upstream base changes. It preserves Impeccable without adding it to the Open Mercato manifest or lock. Unknown addons, symlinks and unreviewed Open Mercato edits are refused.

`.agents/skills-updates.json` enables the enrolled primary checkout's Cezar updater at startup and every six hours. The updater stages the complete tree, waits for idle readers and publishes skills, manifest, lock and documented pin with a recovery journal and backup. Concurrent edits anywhere in the tree, including Impeccable, defer publication. Metadata edits need a commit or an exact recorded updater transaction; never overwrite the host record to approve a dirty baseline.

See [Cezar and Codex](../docs/agents/cezar.md) and [Project-isolated Codex](../docs/agents/codex-isolation.md). Host helpers must be installed through that documented workflow after repository helper changes; this PR does not reconfigure a running host service.

Impeccable 4.9.1 is preserved from the session installation. Its native project hooks are in `.codex/hooks.json` for ordinary Codex sessions that support and approve them. The isolated runtime keeps its separate configuration and does not load personal or project hooks implicitly. `DESIGN.md` and `.impeccable/design.json` retain the project's design context. Impeccable runtime state and downloaded binaries stay ignored.

The separate `.agent/` directory is ignored session scratch space, not installed skills or project policy. Retired `.claude/`, `.ai/skills/`, persona aliases and Claude hook/settings paths are not recreated.
