# Working on this project from the cloud

How to hand a task to an agent that runs somewhere other than your laptop, and
what has to be true of that somewhere before the answer it gives is worth
anything.

The short version: cloud sessions and Cezar runs serve different purposes and they
are not interchangeable. §1 tells them apart. §2 configures the one that needs
configuring. §3 is the issue-to-pull-request path. §4 is the reason the visual
suite needed changing before any of this was useful. §5 is the mobile story,
which is mostly a story about what the cloud VM cannot do.

---

## 1. Execution environments

|                                                      | Where it runs                                                    | What starts it                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Cloud session** (`claude --cloud`, claude.ai/code) | Anthropic VM: Ubuntu 24.04 x86_64, 4 vCPU, 16 GB RAM, 30 GB disk | You, from the CLI, the web, or the phone                                    |
| **Routine**                                          | The same VM, unattended                                          | cron, an authenticated `POST`, or a GitHub `pull_request` / `release` event |

Issue intake and pull-request review run through Cezar (see `docs/agents/cezar.md`).
The `@claude` GitHub Action and automatic Claude review have been retired. Cloud sessions
still need their own environment configuration (§2); Cezar provisions implementation worktrees
through the repository bootstrap.

---

## 2. The cloud environment

A cloud environment is a saved configuration - network policy, environment
variables, and a setup script - attached to your account at
[claude.ai/code](https://claude.ai/code) through the cloud icon above the message
box. Every cloud session and every routine runs in one.

Two things provision a session, and putting a step in the wrong one is the usual
reason a session starts slowly or starts broken:

- **The setup script** provisions the _VM_: toolchains and browsers. It runs once
  and the filesystem is then snapshotted, so later sessions start with its work
  already on disk. It must exit zero and finish inside about five minutes, or the
  snapshot never builds and every session pays for it again.
- **The SessionStart hook** (`.claude/settings.json` →
  `scripts/cloud/session-start.sh`, both committed) does the _project_ setup that
  has to match the commit that was just cloned: install, route tree, `.dev.vars`,
  D1 migrations, the basemap. It runs on every start and resume, and each step
  skips itself when its result is already there.

  `session-start.sh` only picks a profile off `CLAUDE_CODE_REMOTE` (and exits at once in a cezar
  run, where `CEZ_TASK_ID` is set and the workflow bootstraps itself); the steps
  themselves live in `scripts/worktree/bootstrap.sh`, which the same hook uses to
  provision a local `git worktree`. That is deliberate: one owner means the cloud
  path cannot quietly drift from the local one. The `cloud` profile is what this
  section describes, including not seeding - see `scripts/worktree/README.md`.

### 2.1 The setup script

Paste this into the environment's **Setup script** field:

```bash
#!/bin/bash
# Node: the image carries 20, 21 and 22 with 22 on PATH. CI runs 24.x. Vite 8
# is happy on 22, so this does not install another runtime - but if the two ever
# have to agree exactly, this is where 24 would go.
corepack enable || true
corepack prepare pnpm@latest --activate || true

# Playwright's browsers are not in the image. `--with-deps` pulls the system
# libraries WebKit needs, which is the half that fails silently without it.
# Keep the version in step with the @playwright/test devDependency.
npx -y playwright@1.62.1 install --with-deps chromium webkit || true

exit 0
```

Every command ends in `|| true` on purpose: a non-zero exit fails the session
outright, and an intermittent registry hiccup is not a reason to lose a session.

### 2.2 Network access

**`Trusted` is not enough for this project.** Set **Network access** to
**Custom**, tick _Also include default list of common package managers_, and add:

```
cdn.playwright.dev
playwright.download.prss.microsoft.com
*.cloudflare.com
api.cloudflare.com
planned.travel
*.expo.dev
```

Why each one:

- the two Playwright hosts serve the browser binaries; without them §2.1 fails
- `*.cloudflare.com` is `wrangler`, including the R2 read in §2.3
- `planned.travel` lets a session smoke-check production the way `deploy.yml` does
- `*.expo.dev` is only needed if a session drives EAS through the CLI rather than
  through the connector (§5)

GitHub traffic does **not** go through this list - it has its own proxy - and
neither does MCP connector traffic, which is relayed through Anthropic's servers.

### 2.3 Environment variables, and the thing that is not one

```
E2E_TILES_KEY=basemaps/planet-20260818.pmtiles
CLOUDFLARE_ACCOUNT_ID=…
CLOUDFLARE_API_TOKEN=…
```

**`E2E_TILES_KEY` is not `TILES_ARCHIVE_KEY`, and must never be synced to it.**
Since 2026-09-10 the deployed key names the whole planet - about 137.9 GB
(docs/DEPLOY.md §7.8). `pull_basemap_from_r2()` in `scripts/worktree/bootstrap.sh`
downloads whatever this variable names _in full_ into `.e2e-tiles/`, so pointing
it at the deployed key turns every cold session bootstrap into a 137.9 GB
download over the session's own network. This variable names a **regional
extract** - a few hundred megabytes - and stays on one whatever production does.
Before changing it, confirm the object's real extent with §7.4's header read-back:
bytes 102-117 carry the bounding box, and anything spanning the planet does not
belong here.

The value above is the previous production key, and §7.8 records its extent as
**unverified** - nobody has read its header back. Sessions have bootstrapped from
it at a few hundred megabytes, which is why it is believed to be the corridor
extract under a planet's name, but "believed" is the honest word until someone
runs that read-back. Do it the next time you are in the bucket, and if it turns
out to be a real planet, repoint this at `basemaps/japan-<YYYYMMDD>.pmtiles`.

**There is no secrets store.** Environment variables are readable by anyone who
uses the environment, and the dialog says so. The token above is the only one
that belongs here, and only because it can be scoped to `R2:read` on
`planned-travel-tiles` and nothing else - a token that can read a basemap and
perform no other operation on the account.

Since ADR 0016 CI no longer pulls the basemap, so `E2E_TILES_KEY` and the token
are needed here only by a session that wants real tiles in its own dev server -
`pnpm worktree:bootstrap`, or the `basemap` input of `.github/actions/e2e-env`
switched on deliberately.

Nothing from `.dev.vars.example` goes here. `BETTER_AUTH_SECRET` is generated
fresh by the SessionStart hook, and a Stripe key, a Resend key or a deploy token
would be sitting in plaintext in a shared configuration for the sake of a session
that has no business making live calls anyway.

`E2E_TILES_KEY` is a repository _variable_ on GitHub as well, for the same reason
the Stripe price ids are: it is public information. CI no longer reads it (ADR
0016); it stays for the deliberate `basemap: true` path.

### 2.4 What does not come across

Committed files reach a cloud session; your machine does not. In particular
**`.mcp.json` is gitignored**, so the Polar and Expo servers declared there are
_absent_ from every cloud session and routine. To use them there, add them as
connectors at [claude.ai/customize/connectors](https://claude.ai/customize/connectors),
which is also what makes them available to routines.

`~/.claude/` - your personal `CLAUDE.md`, skills, agents, commands - stays on your
machine too. `AGENTS.md`, `.claude/agents/`, `.claude/commands/` and
`.claude/settings.json` are committed and do come across.

---

## 3. From an issue to a pull request

Three ways in, in ascending order of setup:

**Ad hoc, from your terminal.** Nothing to configure beyond a connected GitHub
account:

```sh
claude --cloud "Implement issue #123. Read the description, run the e2e gate, \
open a PR that explains the approach."
```

The VM clones the GitHub remote at your current branch, not your working tree, so
push first. `claude --teleport <session-id>` pulls the session - branch and full
conversation - back into your terminal when you want to take over.

For anything with an architecture decision in it, the pattern that works is to
plan locally and execute remotely: `claude --permission-mode plan`, commit the
plan under `docs/`, then `claude --cloud "execute the plan in docs/….md"`.

**From the issue tracker.** Use the existing issue and the Cezar workflow in
`docs/agents/issue-tracker.md`. Reviews run independently in Cezar and name the assessed SHA.
Additional opinions and repairs are requested explicitly; do not configure a parallel automatic
review or autofix loop.

---

## 4. The journeys, and what the cloud can run

There are no baselines any more. ADR 0016 retired `toHaveScreenshot`,
`e2e/__screenshots__` and the platform-split `{platform}` template that came with
it; a cloud session that opens a pull request no longer has to think about which
rasteriser recorded what. What `pnpm e2e` runs is twenty declarations that assert
a screen answers, renders its own content, hydrates, says nothing in the console
and can be acted on. Nothing is compared byte for byte.

The visual judgement moved to the blind A/B pair,
`node scripts/visual/capture.mjs`, which writes **outside** the repository and is
read at review rather than at commit. A cloud session can run it; a cloud session
cannot decide with it, because the deciding is somebody looking.

### 4.1 What the journeys need, and why it is a composite action

`.github/actions/e2e-env` prepares the `e2e` job in `ci.yml`: it writes a
throwaway `.dev.vars`, migrates local D1, starts `pnpm dev` and seeds the demo
workspace - the seed endpoint lives inside the Worker, so there is no seeding a
database without a server in front of it.

**The basemap is no longer part of that.** It used to be the expensive step, ~480
MB pulled from production R2 under its dated key and cached on it, and it was the
reason the job needed an `R2:read` token and therefore could not run on a fork.
Measured on the branch that retired the baselines: the six atlas journeys are
green against an empty `.e2e-tiles/`. `src/lib/map/world.ts` draws land, water and
borders from Natural Earth 1:110m in the bundle precisely because the archive is
routinely absent in development and on a cold bucket, and `map-canvas.tsx` probes
it once and builds the map either way. The composite action keeps a `basemap`
input, off by default, so it can be switched back on if a future journey needs a
real tile.

The job is two shards, not twelve. Twelve was sized for eighty-seven test
instances a project; twenty declarations do not divide usefully past two. Each
shard runs one Playwright worker (two starved the software-WebGL map tests into
timeouts on 2 vCPU) in its own container with its own D1, started alongside
`verify` rather than behind it, and an `e2e-report` job merges the blob reports
into one HTML report. The seed is audited (`verify.mjs`) on shard 1 only.

Because there is no R2 credential left to gate on, the job runs on every pull
request - including one from a fork.

---

## 5. Mobile, and the hard edge of the cloud VM

The session VM is headless Linux. No macOS, no GUI, no iOS simulator, no Android
emulator. An agent there cannot run Expo Go, cannot drive a simulator, and cannot
run Detox. That is not a configuration problem and no setup script fixes it.

What does work, and is enough for most of the loop:

- **EAS Build and EAS Workflows.** The agent writes the code and hands the build
  to Expo's own infrastructure, then reads the logs, the TestFlight crashes, the
  Play Store crashes and the store reviews back. The Expo MCP server exposes all
  of it. Remember §2.4: declared in `.mcp.json` it is invisible to a cloud
  session, so add it as a connector on your account.
- **Maestro**, run as an EAS workflow, for mobile end-to-end. Detox on iOS needs a
  `macos-latest` GitHub runner, which is a GitHub Actions job, not a cloud session.
- **The `mobile-safari` Playwright project** already in this repository runs
  perfectly well in the cloud: it is headless WebKit at an iPhone viewport, not a
  phone.

---

## 6. What a cloud session still cannot do

- **Deploy.** `wrangler login` is an interactive browser flow and there is none.
  Deploys stay in `deploy.yml`, where the credentials already are.
- **GitHub Projects v2.** The GitHub proxy serves a pinned set of GraphQL
  operations and rejects the rest; Projects v2 exists only in GraphQL.
- **Heavy builds.** 16 GB of RAM and 4 vCPUs. A build that needs more is a job
  for Remote Control, which runs the session against your own machine.
- **Outlive itself.** Sessions stop after a period of inactivity and the VM is
  reclaimed. Reopening restores the conversation onto a fresh VM - which is
  exactly why the SessionStart hook has to be idempotent and cheap.
