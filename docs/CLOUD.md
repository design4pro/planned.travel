# Working on this project from the cloud

How to hand a task to an agent that runs somewhere other than your laptop, and
what has to be true of that somewhere before the answer it gives is worth
anything.

The short version: three separate mechanisms share the Claude Code name and they
are not interchangeable. §1 tells them apart. §2 configures the one that needs
configuring. §3 is the issue-to-pull-request path. §4 is the reason the visual
suite needed changing before any of this was useful. §5 is the mobile story,
which is mostly a story about what the cloud VM cannot do.

---

## 1. Three mechanisms

|                                                      | Where it runs                                                    | What starts it                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Cloud session** (`claude --cloud`, claude.ai/code) | Anthropic VM: Ubuntu 24.04 x86_64, 4 vCPU, 16 GB RAM, 30 GB disk | You, from the CLI, the web, or the phone                                    |
| **Routine**                                          | The same VM, unattended                                          | cron, an authenticated `POST`, or a GitHub `pull_request` / `release` event |
| **`@claude` GitHub Action**                          | A GitHub-hosted runner                                           | `@claude` in an issue or a review                                           |

The distinction that matters most here: **routines have no `issues` trigger.**
The supported GitHub events are pull requests and releases, and nothing else. So
"open an issue and an agent picks it up" is `.github/workflows/claude.yml`, not a
routine. Routines are for the things that happen _to_ a pull request - review it,
port it, watch its CI.

The second distinction: a cloud session runs on a machine Anthropic provisions,
so it needs its own environment configuration (§2). The GitHub Action runs on a
GitHub runner, so it uses the same `pnpm install` every other workflow does and
needs nothing extra.

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

**There is no secrets store.** Environment variables are readable by anyone who
uses the environment, and the dialog says so. The token above is the only one
that belongs here, and only because it can be scoped to `R2:read` on
`planned-travel-tiles` and nothing else - a token that can read a basemap and
perform no other operation on the account.

Nothing from `.dev.vars.example` goes here. `BETTER_AUTH_SECRET` is generated
fresh by the SessionStart hook, and a Stripe key, a Resend key or a deploy token
would be sitting in plaintext in a shared configuration for the sake of a session
that has no business making live calls anyway.

`E2E_TILES_KEY` is a repository _variable_ on GitHub as well, for the same reason
the Stripe price ids are: it is public information, and CI needs it to name the
object it pulls.

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

**`@claude` in the issue itself.** `.github/workflows/claude.yml` handles it.
It needs one secret, `CLAUDE_CODE_OAUTH_TOKEN`, generated with:

```sh
claude setup-token
```

and the Claude GitHub App installed on the repository (`/install-github-app`
from a local session does both, if you would rather not do it by hand).

Note what this _is not_: it runs on a GitHub runner, so it does not touch the
cloud environment from §2 at all. The basemap is not there, which means Claude
cannot run the visual gate from inside that job - it pushes a branch, and CI runs
the gate on that branch like it would for anyone else.

**Routines, for the pull request side.** A `pull_request.opened` trigger for a
review against your own checklist; **Auto-fix** on a specific pull request to have
a session watch its CI and its review comments and push fixes. Auto-fix is worth
knowing about before you turn it on: Claude replies to review threads _as you_,
so any automation keyed on `issue_comment` in this repository would be triggered
by it.

---

## 4. Baselines are per platform now

`e2e/__screenshots__` was recorded on macOS. A Linux runner renders the same
correct page with different font antialiasing, and at `maxDiffPixelRatio: 0.002`
that is enough to fail almost every frame that contains a paragraph. Nothing
about the design moved; the comparison was simply being asked to hold across two
rasterisers.

So `snapshotPathTemplate` now carries `{platform}`, and the two sets live side by
side:

```
e2e/__screenshots__/visual.spec.ts/atlas-dark-chromium-darwin.png   ← your machine
e2e/__screenshots__/visual.spec.ts/atlas-dark-chromium-linux.png    ← CI, cloud sessions
```

The `-darwin` set is the existing one, renamed. The `-linux` set is recorded by
the **Update e2e baselines** workflow, which is `workflow_dispatch` only and
opens a pull request rather than committing: a regenerated baseline is how a real
regression gets laundered into an accepted picture, so it goes through review like
any other change to the design.

The cost of this is honest and worth stating: a deliberate design change now
needs both sets refreshed - yours locally, the Linux ones through the workflow.
The alternative was to make Linux the only truth and take the local gate away
from you, which is worse. If you decide otherwise later, it is one token in
`playwright.config.ts` and a `git mv`.

### 4.1 What the gate needs, and why it is a composite action

`.github/actions/e2e-env` prepares both the gate job in `ci.yml` and the baseline
refresh, because two copies of this sequence would drift and the drift would
present as screenshots that only fail in one of them. It writes a throwaway
`.dev.vars`, migrates local D1, pulls the basemap out of R2 into the Miniflare
bucket, starts `pnpm dev` and seeds the demo workspace - the seed endpoint lives
inside the Worker, so there is no seeding a database without a server in front of
it.

The basemap is the interesting step. It is ~480 MB, and it is the reason the gate
could not simply be switched on: local Miniflare has it because you put it there,
and nothing else did. It is now pulled from production R2 under its dated,
immutable key and cached on that key, so the download happens once per new
basemap and every run after that is a cache hit. Both jobs skip themselves with a
warning when `CLOUDFLARE_API_TOKEN` is absent, matching the gate already at the
top of `deploy.yml`.

The gate is twelve jobs, not one. The suite is ~1250 s of CPU-bound test
execution on the standard 2-vCPU runner, and every job carries ~2.5 min of fixed
cost (image pull, install, migrations, basemap, seed) that no worker count
shortens - so one job could never answer inside five minutes, and neither could
anything queued behind `verify`. `ci.yml` therefore runs `playwright test
--shard=k/12` in twelve containers started alongside `verify`, each with one
worker (two starved the software-WebGL map tests into timeouts on 2 vCPU) and its
own D1, and an `e2e-report` job merges the blob reports into the single HTML
report the one job used to upload. Twelve because Playwright cuts shards as
contiguous runs of the test list and the atlas interaction tests sit together in
`visual.spec.ts`; six left two shards at 8.5 min. The seed is audited
(`verify.mjs`) on shard 1 only, and the basemap cache entry is saved right after
the download rather than in a post step, so a red shard still leaves the next run
a hit.

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
