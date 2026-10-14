# sentry-triage

Why the three files beside this one are shaped the way they are.

## `mcp.json`

Attached to the sweep's Claude Code session with `--mcp-config scripts/sentry-triage/mcp.json
--strict-mcp-config`, never committed as a root `.mcp.json`: a root file would attach this server to
every Claude session in the project - the implement runs and a developer's own terminal included -
and none of those has any business holding a Sentry token. `--strict-mcp-config` works the other
way round too: a developer's own MCP servers never reach the sweep.

`${VAR}` is expanded by Claude Code, so no secret is written to disk. Locally, export
`SENTRY_ACCESS_TOKEN` and `SENTRY_ORG` in the shell that runs `pnpm sentry-triage`; in CI they come
from the workflow's secrets and variables.

Three details that are each load-bearing:

- **`--skills=inspect`** makes the whole server read-only. The CLI's default is every active skill,
  which includes `update_issue` and project mutation - a triage routine has no business resolving
  somebody's Sentry issue.
- **`--organization-slug`** constrains every call to our organization.
- **The version is pinned.** `@latest` in a scheduled job is an unpinned dependency in everything
  but name: the server's top-level tool surface has changed inside a minor before now, which would
  silently make `prompt.md` wrong one morning with nobody watching. Same discipline as the
  Playwright image pin in `ci.yml`.

The token needs four read scopes and no more: `org:read`, `project:read`, `team:read`, `event:read`.

## Why the agent is given the data rather than the script fetching it

The agent reads Sentry; the script decides what to file. That split is the point: `policy.ts` holds
the thresholds, the dedup index and the ticket body, so a policy change is a reviewable diff and a
run is reproducible. The agent's own `judgement` field is ANDed with the gate, never ORed - it can
veto a candidate the numbers cannot see through ("a load test is hammering staging") and it cannot
promote one the gate rejected.

## `--force`, and the four things it does not do

`--force <SHORT-ID>` files a ticket the policy rejected. It exists because the thresholds are tuned
for production traffic and staging has one user: a defect that fires once there is invisible to
`minimumSpanMs` and to the event counts, and no amount of waiting will change that.

It overrides `selectionVerdict` and nothing else. The agent's veto, the frame-exists check, the
dedup index and both caps still apply. The split is not squeamishness - the thresholds are the only
_judgement_ in that list, and naming a ticket is how a human makes that judgement instead. The rest
answer questions of fact that naming a ticket does not settle: whether this is a duplicate, whether
the file the agent pointed at exists at HEAD. A human who wants past those is asking for a ticket
that is wrong, not for one that is small.

Two consequences worth knowing:

- **It reaches only into the population the two fixed searches returned.** A short id outside
  `--window`, resolved in Sentry, or below error level is not forceable; the run says so and exits
  non-zero rather than filing nothing quietly.
- **A forced candidate sorts first.** It is small by definition, so `filingOrder` would otherwise
  put it last and `--max` would spend itself before reaching it.

The ticket records the override: a `Policy: FORCED - <reason>` line and a footer naming the flag.
The `triage` workflow reproduces the claim at HEAD and decides whether to promote it (ADR 0006), and
it has to know the thresholds were bypassed - a single burst presented as a recurring defect puts that
decision on a false premise.

Without `--file-issues`, `--force` prints the gate's verdict and the ticket it would file, and
writes nothing.

## One sweep a day, and what the day does to the bar

The workflow runs at 06:00 UTC every day with `--window 24h` (ADR 0039). `THRESHOLDS` did not move
with it: 25 events or 5 users in production is now a bar an error has to clear **inside one day**,
where it used to have a week. That is deliberate - a daily sweep that kept the weekly numbers per
day files what is on fire, not what is merely present - and it is the first thing to revisit if the
sweep goes quiet. `--window 7d` on a manual run is the old population.

The dedup index is what makes a daily run safe: a short id with an open ticket is skipped, so the
same error is never filed on consecutive mornings.

## User feedback

A report from the in-app widget (`src/lib/sentry-feedback.ts`) is a Sentry issue of category
`feedback`, and the sweep files it as `bug` or `feature` + `priority-medium`. Four things differ
from an error, each for a reason:

- **It is searched over a fixed 7 days, not `--window`.** A report is one event. If the cap drops it
  this morning, a 24-hour search would never see it again.
- **It has no numeric bar.** One person wrote once; there is no count to threshold. The gate is
  `feedbackVerdict` (unresolved, a defect or a request, a usable summary) and the agent's veto.
- **It is filed before the errors, under the same `--max`.** A recurring error is back tomorrow; a
  report is not.
- **Nothing the person typed reaches GitHub.** The schema has no field for the message, the address
  or the screenshot. The agent reports its own one-line paraphrase, and `sanitizeFeedbackText`
  strips comment syntax, code, links, addresses, mentions and issue references from it before it is
  printed - the prompt asks for the same, and the prompt is not what is relied on.

That last point lowers the risk; it does not remove it. The paraphrase is written by a model that
has read hostile text, so a filed report carries the `sentry-issue` marker like any other finding
and no unattended run picks it up (ADR 0032).

## Why the workflow runs this script rather than `claude-code-action`

The prompt is not the whole routine: the dedup, the caps and the body live in `policy.ts`. Driving a
second copy of that policy through `claude_args` would give it two owners, which is what
`docs/SPEC.md` §8 forbids. The script runs one `claude -p` session with Bash, Edit and Write removed
from its tools, parses the `<sentry-triage>` block against `reportSchema`, and files from the result.

## Connection preflight and failure evidence

[Actions run 35721203345](https://github.com/design4pro/planned.travel/actions/runs/35721203345)
failed on 2026-09-22 in `Sweep Sentry`: the agent reported `CONNECT_TIMEOUT` after 30000 ms,
with `find_projects` and the other Sentry tools absent. This proves connection failure, not a
specific cause such as a cold npm cache. The package was already pinned to `0.39.0`.

Before either a local or scheduled sweep launches the agent, `mcp-preflight.ts` runs the same
configured command with `--help` to populate the package cache (120-second ceiling), then performs
an MCP stdio `initialize`, `notifications/initialized` and paginated `tools/list`. All six tools
used by the prompt must be present. Each connection attempt has a 30-second total ceiling,
including pagination. Only that read-only connection phase retries, at most once; package prewarm,
the agent survey and issue filing are never retried. The child process group is terminated before
the next attempt. Raw server output and credentials are not logged.

`pnpm sentry-triage --check-mcp` runs only this preflight, without GitHub access, an agent session,
Sentry tool calls or issue filing. It requires the same environment as the sweep. Discovery proves
transport and tool availability, not token authorization against Sentry data; the agent still must
successfully call `find_projects`. Either failure exits non-zero. Neither becomes an empty-findings
report. Missing workflow credentials also fail instead of silently skipping the sweep. Diagnostic
report uploads are best effort and expire after two days.

Protocol reference: [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle)
and [tools discovery](https://modelcontextprotocol.io/specification/2025-03-26/server/tools).
