# Remote development environments

## 1. Runner and ownership

Use the official Cezar CLI with Codex, or a direct Codex session. `AGENTS.md` routes the
project instructions and `.agents/skills/` contains the only installed skills. Follow
[the Cezar guide](agents/cezar.md) for workflows, claims and host cutover. The former
Claude Cloud hook configuration is retired; no automatic session provisioning is installed.
The legacy `scripts/cloud/session-start.sh` remains an explicit compatibility helper only.

A remote checkout does not inherit local credentials, MCP connections or host schedules.
Configure the selected runner's environment explicitly. No change here provisions a cloud
account, installs a global CLI or starts an allocator.

## 2. Provisioning

Use Node 24.x, matching `.github/actions/setup/action.yml`, and the package manager version
in `package.json`. Install the browsers required by both e2e-inc engines using the repository's installed
`pnpm exec e2e-web install chromium webkit` and `pnpm exec playwright install chromium webkit`
commands. The portable and custom engines have independent lockfile-resolved Playwright
owners whose browser builds may differ. The host needs package registry, GitHub and
browser download access; grant provider access only when the task requires it.

For ordinary development, run `pnpm worktree:bootstrap` from the checkout. For an ephemeral
VM whose test suite seeds its own database, select the cloud profile explicitly:

```sh
bash scripts/worktree/bootstrap.sh --profile cloud
```

The cloud profile uses port 3000 and throwaway local secrets, provisions local D1, and does
not seed or start the app. Follow the commands printed by bootstrap when a demo workspace
is needed. [The bootstrap guide](../scripts/worktree/README.md) defines the profiles and
ownership checks. Automated browser rounds use `.ai/scripts/test-env-up.sh` and its reserved
port range; do not point a test at another checkout's server.

### 2.3 Optional basemap

Critical CI journeys do not require a basemap (ADR 0016). A deliberate real-map session may
need `CLOUDFLARE_ACCOUNT_ID`, an R2-read-only `CLOUDFLARE_API_TOKEN`, and `E2E_TILES_KEY`.
Supply these through the runner's environment without printing them. Never copy production
application secrets into a development session.

`E2E_TILES_KEY` must name a verified regional extract. It is not `TILES_ARCHIVE_KEY` and must
not be synchronized to the deployed planet archive: bootstrap downloads the complete object.
Verify the object's extent and size using `docs/DEPLOY.md` before selecting it. Do not assume
an old object is small from its name alone.

## 3. Verification and delivery

Run the configured gate with `node scripts/ci/validation.mjs`. Use Node 24 directly on PATH;
a shell wrapper around `node` can change process identities used by lifecycle tests.
UI changes also require the applicable journeys and visual evidence in
`.agents/policies/verification.md`. Run only against the environment owned by this checkout. During the e2e-inc migration,
`pnpm e2e:all` executes both required runners; `E2E_BASE_URL` and
`PLAYWRIGHT_BASE_URL` must name that same server. See [End-to-end testing](testing/e2e.md)
for native scenarios, the retained browser assertions and Codex MCP/Actions usage.

A remote result does not bypass review, QA, CI or merge ownership. Preserve the `develop`
base and existing production promotion rules. Do not run a second allocator alongside a
live owner; [the automation audit](agents/automation-audit.md) records the required cutover.
