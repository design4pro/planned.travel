# Project-isolated Codex

`scripts/agents/codex-project.py` is the source for the host command
`~/.local/bin/codex-project`. It uses the existing `codex` binary on PATH and
selects a profile under `~/.local/share/codex-projects/<name>-<common-dir-hash>/`.
Linked worktrees share their primary repository's profile; different Git common
directories never share profiles. Python 3.9 or later and Git are required.

The launcher sets child-only `HOME`, `CODEX_HOME`, `CODEX_SQLITE_HOME` and XDG
directories. It does not modify the ordinary Codex command, personal configuration,
personal skills, plugins, authentication or existing sessions. This is context
and state isolation, not an operating-system sandbox.

## Usage

```sh
codex-project -C /absolute/project/path
codex-project -C /absolute/project/path --project-info
codex-project -C /absolute/project/path login --device-auth
codex-project -C /absolute/project/path exec "Implement the requested change"
codex-project -C /absolute/project/path resume --last
cezar-project --help
```

New tasks start new conversations. Resume and fork use only that project's state.
Interactive sessions bypass the shared Codex daemon. Cezar uses a separate stdio
`app-server` process. No model task or paid inference is needed to inspect skills.

Each profile requires its own Codex login unless an explicitly supplied API/access
token provides authentication. Credentials use a profile-local file, not the shared
keychain. The launcher never copies or symlinks personal Codex authentication.
Logging out through `codex-project` affects the selected profile only.

Plugin, app, memory and bundled-skill features are disabled through managed config
and CLI overrides. Personal skill directories and instructions inside a profile,
external skill symlinks, external cloud-skill snapshots, remote code hosts, shared
daemon/proxy commands and unrecognized options are rejected. Supported model and
permission options remain available; this launcher does not grant new permissions.
Admin skill installations under `/etc/codex/skills` require an explicit review.

The generated config is checked rather than silently overwritten. Review drift
before replacing it. Project trust is recorded for the primary repository; Codex
resolves its linked worktrees to that same trusted project. Repository instructions
remain authoritative and must themselves be reviewed for external references.

Git receives a separate config containing only the previously configured public
author name/email and the GitHub CLI credential helper. `GH_CONFIG_DIR` is an
explicit exception: an existing supplied path is retained, otherwise it points
to the normal GitHub CLI config. This shares the existing GitHub tool capability,
not Codex context. Cezar's `CEZ_*` environment, selected auth variables and basic
toolchain settings are preserved; arbitrary host environment variables and shell
startup overrides are dropped. `CEZ_HOME` retains the coordinator registry.
If no GitHub token variable (including enterprise variants) was supplied, the launcher asks `gh auth token`
in the original environment for its existing selected GitHub capability. A successful
result is passed to the child in the matching token variable in memory only, never printed or written
to profile files. An unavailable GitHub login is not replaced or created automatically.

## Host integration

Install copies, rather than links to a moving branch:

```sh
install -m 700 scripts/agents/codex-project.py ~/.local/bin/codex-project
install -m 700 scripts/agents/cezar-project.sh ~/.local/bin/cezar-project
install -m 700 scripts/agents/cezar-project-node.py ~/.local/bin/cezar-project-node
mkdir -p ~/.local/lib/codex-project
install -m 600 scripts/agents/cezar-project-runtime.py ~/.local/lib/codex-project/cezar-project-runtime.py
install -m 600 scripts/agents/cezar-project-skills.mjs ~/.local/lib/codex-project/cezar-project-skills.mjs
install -m 600 scripts/agents/cezar-project-updates.mjs ~/.local/lib/codex-project/cezar-project-updates.mjs
install -m 600 scripts/agents/skills-auto-update.py ~/.local/lib/codex-project/skills-auto-update.py
```

The `cezar-project` command runs the managed Cezar entrypoint under
`$CEZ_HOME/versions/current` (default `~/.cezar/versions/current`) through
`cezar-project-node`. The existing `cezar` and `node` commands are not replaced.

On this macOS host, `dev.codex-project.cezar-env` is a RunAtLoad LaunchAgent whose
only action is `launchctl setenv CEZ_CODEX_BIN <absolute-launcher-path>`. It sets
the variable for newly launched GUI applications. Restart Cezar Desktop after
verifying that task and manager queues are idle. Existing shells can use
`cezar-project` immediately; no shell startup file needs modification.

The additional `dev.codex-project.cezar-runtime` LaunchAgent sets
`CEZ_DESKTOP_NODE` to the installed `cezar-project-node`. Both launchers validate
the actual Cezar package, entrypoint and patch hashes before starting it, then set
`CEZ_SKILLS_SCOPE=project` and `CEZ_CODEX_BIN` only for that child process. The Node
wrapper accepts only the reviewed entrypoint and explicit Node version probes.

### Cezar's independent skill catalog

**Changing the Codex child's HOME does not isolate Cezar's catalog.** Official
Cezar 0.20.0 independently scans the user's global skill directories and passes
that catalog to its UI, planner and workflows. This host therefore runs official
Cezar with a local, hash-pinned compatibility patch, implemented by
`scripts/agents/cezar-project-runtime.py` and `cezar-project-skills.mjs`.

In project mode, catalog discovery reads only `.agents/skills/**/SKILL.md` within
the selected checkout. It rejects external directory/file symlinks before reading
their content. Global, legacy, team and bundled skills are excluded. Remote cache
reads, imports, refresh and materialization return empty results; provisioning is
disabled, so worktrees use their own versioned skills without cross-checkout links
or generated `.claude` directories. The native global updater is bypassed before
reading global lock files or invoking `npx`. Its replacement uses the project's manifest
and explicit enrollment described below. The API marks this state as `managedByProject`;
the UI reports the real status and next check instead of a failed native installation
or global update commands. Existing conversations may still contain previously supplied
instructions; start a new task to obtain a clean conversation.

### Automatic project skill updates

This primary checkout opts into automatic installation with `.agents/skills-updates.json`.
The host also requires an explicit canonical repository/common-directory pair in
`~/.local/lib/codex-project/skills-auto-update-projects.json`. After installing and checking
the runtime patch, enroll only the requested primary checkout:

```sh
python3 ~/.local/lib/codex-project/skills-auto-update.py enroll --repo /absolute/project/path
```

Cezar checks `open-mercato/skills` on `main` at startup and every six hours while running.
The card's **Check and update now** performs the same operation immediately. Deferred or
failed checks retry after five minutes. No Codex app automation, cron job, model inference,
global skills update or automatic Cezar binary upgrade is created. Unenrolled projects keep
the neutral disabled card; linked worktrees never receive automatic installations.

The updater verifies installed hashes, stages the exact remote SHA with the repository's
installer, and preserves reviewed local repairs. It refuses unknown skill edits and changed
repair bases. It compares all publication inputs again before writing, so concurrent local
edits defer installation. Only `.agents/skills`, `scripts/agents/skills-upstream.json`,
`skills-lock.json` and the pin in `docs/agents/cezar.md` are published. Other documentation
in that file is preserved. The result is a local Git diff, without an automatic commit or push.
The manual `skills-update` workflow remains responsible for upgrade-note integration and PR review.

Installation requires a live idle Cezar dashboard and an exclusive kernel lock in the Git
common directory. `codex-project` retains a shared lock for the entire Codex process;
Cezar's catalog reads all file content while holding a shared lock. A reader starting during
publication waits or retries instead of seeing a partial collection. A durable journal
blocks readers after an interruption until the next attempt restores the previous collection.
Recovery validates every current/backup hash and stops if unknown edits appeared. Backups
and status are retained under `.ai/tmp/skills-auto-update/`; neither credentials nor the
personal Codex profile are involved. These locks coordinate the managed launchers, not
arbitrary editors or manually invoked installers; stop project readers before manual restoration.

Set `enabled` to `false` in `.agents/skills-updates.json` to opt out of future automatic
checks and installation. An operation already publishing completes or recovers; do not
delete its journal. Re-enable with the documented exact source, branch and six-hour interval.
The host registry is an additional allowlist, so copying the opt-in file never enrolls another checkout.

The compatibility patch currently supports only Cezar 0.20.0. Installation checks
all reviewed hashes before writing, saves pristine module/frontend backups and is idempotent.
An import map in the no-cache HTML shell uses a revision query to invalidate Cezar's
immutable asset cache while preserving one module identity for all imports. The
index bundle stays unchanged. Upgrading the first patch accepts only its recorded exact hash, never
arbitrary local changes.
A new Cezar version or modified runtime refuses to start through these wrappers
until the patch is reviewed for that build. This intentionally prevents an update
from silently restoring global skill discovery. With `CEZ_SKILLS_SCOPE` absent,
the patched modules preserve their original behavior.

Global Codex account probes without a project intentionally fail closed. A global
account badge is not evidence that an isolated project is authenticated. Check
`codex-project -C <repo> login status` or the project app-server's `account/read`.

To disconnect the GUI integration, unload/remove only these two LaunchAgents and
restore the previous `CEZ_CODEX_BIN` and `CEZ_DESKTOP_NODE` values (unset variables
that were previously absent), then restart an idle Cezar Desktop. To restore the
reviewed runtime bytes, invoke `python3 ~/.local/lib/codex-project/cezar-project-runtime.py
~/.cezar/versions/0.20.0/node_modules/@open-mercato/cezar restore` while Cezar is stopped.
Restoration refuses unknown modifications. Leave profiles intact to preserve their
sessions and credentials. Removing the installed wrappers does not alter the primary
Codex installation.

## Verification

- `python3 scripts/agents/__tests__/codex_project_test.py` exercises distinct
  repositories, worktrees, concurrent initialization, argument preservation,
  config drift, source/argument escapes and environment isolation. Vitest's tooling
  project runs this suite through `codex-project.test.mjs` as part of the normal gate.
- `codex-project --strict-config app-server < /dev/null` validates the generated
  configuration against the installed Codex schema.
- `codex-project debug prompt-input` renders the actual prompt locally. Inspect the
  skill roots and instruction sources without submitting a model turn.
- The Cezar transport smoke uses `resolveCodexExecutable`, `spawnCodexAppServer`
  and `skills/list` from the installed runtime, with separate processes for two
  repositories and a worktree. Assert that every enabled skill belongs to the
  selected checkout, that repository profiles differ and that linked worktrees
  share the same profile. `account/read` reports authentication without credentials.
- Independently check Cezar's `/api/v1/p/<project-id>/skills` and
  `/api/v1/p/<project-id>/skills/importable`, including `wait=1`. Every returned skill
  must resolve inside that checkout's `.agents/skills`; checking Codex `skills/list`
  alone does not cover Cezar's own catalog. The runtime smoke also exercises empty
  projects, remote operations, disabled provisioning, unenrolled updating and unflagged behavior.
- `skills_auto_update_test.py` verifies interrupted publication at all eight rename points,
  rollback, concurrent reader exclusion, local-edit preservation and explicit enrollment.
  `cezar-project-updates.test.mjs` verifies the six-hour schedule, five-minute retries and
  removal of scheduled projects. A real Codex app-server check verifies inherited lock ownership.

The initial host check found 74 enabled Open Mercato skills in `planned.travel`
and its worktree. The implicit prompt catalog contains 73 because `om-harness`
declares `allow_implicit_invocation: false`. `money-tracker.online` currently has
no `.agents/skills` installation and therefore exposed zero skills. No personal
skill/plugin source appeared. Evidence is kept under `.ai/tmp/codex-project/`.

The separate Cezar catalog initially still contained 424 entries for `planned.travel`
(348 global, 74 project and two bundled). The compatibility patch corrects this
additional discovery path; the live API is part of the acceptance check.
