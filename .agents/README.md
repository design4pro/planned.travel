# Project agent tooling

- `skills/`: all 74 skills from `open-mercato/skills`, plus Impeccable. Open Mercato comes from the commit recorded in `scripts/agents/skills-upstream.json`, with three reviewed repairs tracked as local hashes and patches under `scripts/agents/skill-patches/`; `skills-lock.json` records per-skill hashes.
- `personas/`: migrated reviewer and readiness prompts. These are task instructions, not automatically registered Codex subagent configurations.
- `hooks/format-file.sh`: retained file-formatting hook for optional legacy Claude use.
- `legacy/claude-settings.json`: retained Claude permissions and hooks. This is not native Codex configuration and is not automatically loaded. Opt in with `claude --settings .agents/legacy/claude-settings.json`. Local overrides remain ignored.

Codex discovers the installed skills from `.agents/skills/`. Native project Impeccable hooks are configured in `.codex/hooks.json`; approve them through Codex's hook UI when required. Repository-specific procedures and overrides, including i18n, validation and the Paperclip pilot, live in `.ai/skills/`. Read the applicable procedures from AGENTS.md; do not install them into `skills/`.

Run `pnpm install-skills` to install or update the full Open Mercato collection for Codex. This does not create `.claude/`, update global installations, or apply upstream migrations to `.ai/` artifacts. The installer pins the resolved upstream commit, verifies file hashes, reapplies the reviewed repairs and refreshes the manifest and lock. If a patch no longer applies, it stops for review. Review the applicable upgrade notes in the same change.

The separate `.agent/` directory is ignored session scratch space. It contains diagnostic scripts, screenshots and local evidence, not installed skills or project policy.

## Automatic updates in Cezar

`.agents/skills-updates.json` enables the native project updater for this primary checkout. The supported policy is Open Mercato `main`, every six hours and at startup while Cezar is running. The local host registry must also enroll the checkout. This uses Cezar, not a Codex scheduled automation.

Cezar invokes `scripts/agents/sync-skills.mjs --ref <sha>` inside its isolated staging directory. The synchronizer preserves reviewed manifest repairs, lock hashes, executable permissions and Impeccable. Cezar owns the reader lock, idle checks, publication journal and rollback. A conflicting repair stops publication.

Local modifications to `scripts/agents/skills-upstream.json` or `skills-lock.json` defer installation until they are committed or belong to a previously recorded updater transaction. Do not bypass this guard or overwrite the host installation record to approve a dirty baseline. The current state and reason are visible in Cezar's Skills settings.
