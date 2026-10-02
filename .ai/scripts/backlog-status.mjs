#!/usr/bin/env node
// Was rendered from design4pro/agent-kit until the kit was retired (ADR 0025). Edit it here.
//
// Reports where every open issue sits in the SDLC flow and the single next step that moves it,
// with `--next` names the one issue the scheduled implement-ticket run takes next, and with `--plan`
// prints everything the Reconciler (docs/agents/cezar.md, ADR 0033) may start right now, at most one
// action per kind.
// Read-only: it never applies a label. No label marks an issue ready (ADR 0032); readiness is the
// rule in `classify`, so the report a person reads and the pick a run makes cannot disagree.
//
// It keeps no knowledge of its own that another file already holds:
//   - the category, priority and risk labels come from .ai/agentic.config.json;
//   - the trusted authors are the `authors` gates of the issue automations in
//     docs/agents/cezar-automations.json, plus the retired agent account: an issue anyone else
//     opened is never auto-implemented, and neither is one scripts/sentry-triage filed (its
//     `sentry-issue` marker), whoever ran it;
//   - "not ready" is read through the 🤖 comment marker every skill writes
//     (.ai/trackers/github.md) - a groom's not-ready comment, or the `STOP:` comment implement-ticket
//     leaves on an issue it would not take - so a human comment newer than it is the answer, and the
//     schedule never picks the same refused issue every tick. So is a later trusted `🤖 RESOLVED:`
//     comment, which is how `unblock` answers one on a specialist's verdict. A comment that says
//     `HUMAN-ONLY:` names what only a person can do, and no run is started on that issue;
//   - the run queue comes from .ai/cezar/runs.json when the host has one.
//
// Why it parses pull-request linkage itself rather than asking the tracker: pull requests here
// target the base branch while the repository's default branch is another, and GitHub populates
// `closingIssuesReferences` / `closedByPullRequestsReferences` for neither side of that pairing.
// Measured on money-tracker.online: 15 of 15 recently merged pull requests carrying an explicit
// closing keyword report an empty list, including one whose body opens with `Closes #163`. Reading
// that field would mean the IN_REVIEW state could never once fire.
//
// Usage: node .ai/scripts/backlog-status.mjs [--json | --next | --plan] [--stale-hours N]

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const AUTOMATIONS = "docs/agents/cezar-automations.json";
const CONFIG = ".ai/agentic.config.json";
const RUNS = ".ai/cezar/runs.json";
const SPECS = ".ai/specs";
const PLANS = "docs/plans";

/**
 * The cockpit statuses (`runStatusSchema`) that mean a run still holds its issue: it is queued,
 * running, parked for an answer (`waiting`) or parked at the review gate (`review`). `monitoring` is
 * not a status but an `activity` of a `running` run, so it needs no entry. A `failed` run is alive
 * only while `autoResumeAt` says the cockpit will resume it after a usage limit (see `isAlive`).
 */
const ACTIVE_RUN_STATES = new Set(["queued", "running", "waiting", "review"]);

/**
 * Open PRs waiting for a person at which `--next` and `--plan` stop handing out implementation, so
 * the queue never outruns the review only a person can give. PRs the pipeline merges by itself do
 * not count (ADR 0033).
 */
export const WIP_LIMIT = 3;

/**
 * Accounts that no longer exist but whose work is still on the tracker. `design4pro-agent` was the
 * agent identity until the owner retired it (ADR 0031, amendment of 2026-10-01); every issue and PR
 * it filed came out of an agent run the maintainer launched, and it can file nothing new, so
 * trusting its past output adds no input an outsider could produce.
 */
export const RETIRED_AGENT_LOGINS = ["design4pro-agent"];
const HOLD_LABELS = ["blocked", "do-not-merge", "do-not-close"];

export const PRIORITY_ORDER = [
  "priority-extreme",
  "priority-high",
  "priority-medium",
  "priority-low",
];

export const STATE_ORDER = [
  "BLOCKED",
  "RUNNING",
  "QUEUED",
  "STUCK",
  "IN_REVIEW",
  "TRACKING",
  "WAITING",
  "NOT_READY",
  "EXTERNAL",
  "NEEDS_TRIAGE",
  "READY",
];

/**
 * Text with fenced blocks and inline backtick spans removed.
 *
 * A closing keyword inside a code sample is a quotation, not a link - `om-close-fixed-issues`
 * rejects those matches and so does this.
 */
export const stripCode = (text) =>
  String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ");

/**
 * The issue numbers a text closes, by the rule in `om-close-fixed-issues`: one of the English
 * keywords, preceded by start-of-text or a character that is neither a letter, a digit nor `_`,
 * followed by whitespace and `#{digits}`.
 *
 * Deliberately not wrapped in `\b`: that boundary is ASCII-only and fails silently on a keyword
 * whose first or last character is not ASCII. A bare `#N` mention is never a link.
 */
export function closeKeywordTargets(text) {
  const pattern =
    /(^|[^A-Za-z0-9_])(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  const found = new Set();
  for (const match of stripCode(text).matchAll(pattern))
    found.add(Number(match[2]));
  return [...found];
}

/**
 * The issue a branch name claims, by the `<type>/issue-<n>-<slug>` convention.
 *
 * The type segment is deliberately open rather than a list: both repositories have cut branches
 * under more prefixes than their own documentation names, and a closed list would quietly stop
 * matching the next one somebody invents.
 */
export function branchIssue(headRefName) {
  const match = /^[^/]+\/issue-(\d+)(?:-|$)/.exec(String(headRefName ?? ""));
  return match ? Number(match[1]) : null;
}

/**
 * The issues listed under a `## Blocked by` heading (the afk-to-tickets ticket shape), read up to
 * the next heading. "None - can start immediately" lists nothing.
 */
export function blockedBy(body) {
  const section = /^#{2,3}\s*Blocked by[ \t]*$([\s\S]*?)(?=^#{1,3}\s|(?![\s\S]))/im.exec(
    stripCode(body),
  );
  return section ? [...section[1].matchAll(/#(\d+)/g)].map((match) => Number(match[1])) : [];
}

/**
 * Open pull requests keyed by the issue each one addresses.
 *
 * Two signals, and which one matched is kept rather than collapsed: a keyword is the author saying
 * the pull request closes the issue, while a branch name says only that the work belongs to it.
 * `#268` on money-tracker.online is the case that fixes the distinction in place - a deliberate
 * partial fix whose branch names issue 189 and whose body says, in its first paragraph, that it
 * does not close it. So a branch-only link raises a question for a human and never a suggested
 * edit; treating it as a missing keyword would have closed an open defect.
 */
export function linkOpenPrs(prs) {
  const byIssue = new Map();
  const add = (issue, pr, viaKeyword) => {
    const links = byIssue.get(issue) ?? [];
    const existing = links.find((l) => l.number === pr.number);
    if (existing) existing.viaKeyword ||= viaKeyword;
    else links.push({ number: pr.number, title: pr.title, viaKeyword });
    byIssue.set(issue, links);
  };

  for (const pr of prs) {
    const keyworded = new Set([
      ...closeKeywordTargets(pr.body),
      ...closeKeywordTargets(pr.title),
    ]);
    for (const issue of keyworded) add(issue, pr, true);
    const claimed = branchIssue(pr.headRefName);
    if (claimed !== null) add(claimed, pr, keyworded.has(claimed));
  }
  return byIssue;
}

/**
 * The logins the issue automations trust: the union of their `authors` gates. An automation with
 * no gate adds nobody, so a missing gate makes nothing ready rather than everything.
 */
export function readTrusted(automations) {
  const trusted = new Set();
  for (const automation of automations) {
    if (!(automation.events ?? []).some((event) => event.startsWith("issue."))) continue;
    for (const login of automation.filters?.authors ?? []) trusted.add(login);
  }
  return trusted;
}

/**
 * The authors a run may act on: the gated logins plus the retired agent account. A repository whose
 * automations gate nobody trusts nobody - the retired logins do not turn a missing gate into an
 * open door.
 */
export function trustedAuthors(automations) {
  const gated = readTrusted(automations);
  return gated.size === 0 ? gated : new Set([...gated, ...RETIRED_AGENT_LOGINS]);
}

const hasLabel = (pr, name) => pr.labels.some((label) => label.name === name);

/**
 * How long a PR labelled `changes-requested` may sit untouched before it counts as parked: a run
 * that is still fixing the review pushes within that time, so a PR idle past it is one the autopilot
 * stopped on a decision only a person takes (its result comment says so).
 */
export const PARKED_HOURS = 24;

/**
 * A PR sits with a person when no run can move it: QA the unattended sign-off may not give
 * (`needs-qa` still without `qa-approved`), a diff the owner signs off (`risk-high`, `security`), a
 * hold, or `changes-requested` left untouched for `PARKED_HOURS`. Everything else - `review`, a
 * fresh `changes-requested`, `merge-queue`, a plain draft - is on its way to
 * `om-pr-autopilot --allow-merge`, which merges it into `develop` without anyone. `now` is passed in
 * (epoch ms) so the rule stays pure; a PR with no `updatedAt` is never taken for parked.
 */
export const waitsForPerson = (pr, now) =>
  (hasLabel(pr, "needs-qa") && !hasLabel(pr, "qa-approved")) ||
  ["risk-high", "security", "blocked"].some((label) => hasLabel(pr, label)) ||
  (hasLabel(pr, "changes-requested") && (now - Date.parse(pr.updatedAt)) / 36e5 >= PARKED_HOURS);

/**
 * The WIP the cap counts: open PRs by a trusted author that wait for a person. Counting every agent
 * PR throttled the pipeline on work it was about to merge itself (ADR 0033), while the queue the
 * cap has to protect - what only a person can clear - is exactly this set. The promotion
 * (`do-not-merge`) is the release, not work in flight, and dependabot is not a trusted author.
 */
export const countWip = (prs, trusted, now) =>
  prs.filter(
    (pr) =>
      trusted.has(pr.author?.login) && !hasLabel(pr, "do-not-merge") && waitsForPerson(pr, now),
  ).length;

// A 🤖-prefixed comment is a skill's; anything else is a human's (.ai/trackers/github.md).
const isAgentComment = (comment) => String(comment.body).trimStart().startsWith("🤖");
// `afk-triage` and `afk-to-tickets` open their comments with a "generated by AI" quote instead of
// the 🤖. It speaks for an agent too, but widening `isAgentComment` to it would turn a brief that
// happens to say "not ready" into a not-ready comment; only the unblock rules read this wider mark.
const AI_QUOTE = /^>\s*[_*]This was generated by AI/;
const speaksForAgent = (comment) =>
  isAgentComment(comment) || AI_QUOTE.test(String(comment.body).trimStart());
// `unblock` answers a not-ready or `STOP:` comment with `🤖 RESOLVED: ...` (afk-unblock).
const isResolved = (comment) => /^🤖\s*RESOLVED:/.test(String(comment.body).trimStart());
// What only a person can do (afk-decide § 5); no run is started on an issue whose comment says so.
const HUMAN_ONLY = /\bHUMAN-ONLY:/;
// An issue `afk-plan-to-spec` files for a stage only a person can decide opens its body with it.
const HUMAN_ONLY_BODY = /^🤖\s*HUMAN-ONLY:/;
const hasBrief = (text) => /^#{2,3}\s*Agent Brief\b/m.test(stripCode(text));
const SENTRY_MARKER = /<!--\s*sentry-issue:/;

/** One issue's state and the single next step that moves it. Pure: every input is passed in. */
export function classify(
  issue,
  { trusted, sdlcLabels, openIssues, runs, prLinks, staleHours, now },
) {
  const labels = issue.labels.map((label) => label.name);
  const has = (label) => labels.includes(label);
  const comments = issue.comments ?? [];
  const run = runs.get(issue.number);
  const prs = prLinks.get(issue.number) ?? [];

  // A `RESOLVED:` comment is the answer, never the question, even when it quotes the `STOP:` it
  // answers.
  const notReady = comments
    .filter(
      (c) =>
        isAgentComment(c) &&
        !isResolved(c) &&
        (c.body.includes("not ready") || /\bSTOP:/.test(c.body)),
    )
    .at(-1);
  const answered =
    notReady &&
    comments.some(
      (c) =>
        c.createdAt > notReady.createdAt &&
        // A human's reply, the readiness verifier resolving the gap in the human's place
        // (SDLC.md § Definition of Ready), afk-triage settling it into an Agent Brief, or
        // afk-unblock resolving it on a specialist's verdict (`🤖 RESOLVED:`).
        // Only a trusted author answers: READY starts an unattended run, so a stranger's "+1" must
        // not re-open an issue whose last run stopped.
        trusted.has(c.author?.login) &&
        (!isAgentComment(c) ||
          isResolved(c) ||
          c.body.includes("readiness verified") ||
          hasBrief(c.body)),
    );
  // Only a trusted author's brief counts: the body is the reporter's, so for an issue someone
  // else opened, a brief they wrote into it would be a self-approval.
  const briefed =
    hasBrief(issue.body) ||
    comments.some((c) => trusted.has(c.author?.login) && hasBrief(c.body));
  const missingLabels = Object.entries(sdlcLabels)
    .filter(([, names]) => !names.some(has))
    .map(([group]) => group);
  const waitingOn = blockedBy(issue.body).filter((number) => openIssues.has(number));
  const hoursIdle = (now - Date.parse(issue.updatedAt)) / 36e5;

  // `canUnblock` marks the two states an `unblock` run may try to lift, and only on an issue a run
  // may read at all: its author is trusted and it is no Sentry ticket (the same gate that keeps such
  // an issue out of READY). The rest is what separates a hold an agent set from one a person did.
  const unblockable = trusted.has(issue.author?.login) && !SENTRY_MARKER.test(issue.body ?? "");
  // Every run acts as the maintainer, so a comment speaks for an agent only when a trusted author
  // wrote it: anyone else's `🤖` line is a stranger's text, and must neither start an `unblock` run
  // nor switch one off (afk-unblock reads the same comments as data).
  const agentVoice = (c) => trusted.has(c.author?.login) && speaksForAgent(c);
  const state = (name, next, warning, canUnblock = false) => ({
    ...issue,
    labels,
    state: name,
    next,
    warning: warning ?? null,
    prs,
    canUnblock: unblockable && canUnblock,
  });

  const hold = HOLD_LABELS.filter(has);
  if (hold.length) {
    // An agent set the hold when its explanation is the last word on the issue: a person who
    // commented after it has taken the hold over, and one who set the label without a comment left
    // no explanation to lift. `blocked` alone: `do-not-merge` and `do-not-close` are always a
    // person's.
    // The rest is what afk-unblock step 1 refuses outright, so no run is started for it: a claim
    // on the issue, or an open PR that names it.
    const last = comments.at(-1);
    const agentHold =
      hold.length === 1 &&
      hold[0] === "blocked" &&
      !has("in-progress") &&
      prs.length === 0 &&
      last !== undefined &&
      agentVoice(last) &&
      !HUMAN_ONLY.test(last.body);
    return state(
      "BLOCKED",
      agentHold
        ? "An agent set `blocked`: the `unblock` run lifts it on a specialist's verdict, or leaves a `HUMAN-ONLY:` comment naming what a person must do."
        : `A person clears \`${hold.join("`, `")}\`: the 🤖 comment names what they must do first.`,
      undefined,
      agentHold,
    );
  }

  if (has("in-progress"))
    return hoursIdle > staleHours
      ? state(
          "STUCK",
          `Claimed but idle for ${Math.round(hoursIdle)}h - check the run, then \`gh issue edit ${issue.number} --remove-label in-progress\`.`,
        )
      : state("RUNNING", `A run holds the claim (${run?.workflow ?? "cockpit"}). Wait.`);

  if (run)
    return state("QUEUED", `Cezar has a ${run.status} \`${run.workflow}\` run for it. Wait.`);

  if (prs.length) {
    const numbers = prs.map((pr) => `#${pr.number}`).join(", ");
    const branchOnly = prs.filter((pr) => !pr.viaKeyword);
    const warning = branchOnly.length
      ? `${branchOnly.map((pr) => `#${pr.number}`).join(", ")} names this issue in its branch but no closing keyword links it. Does it close the issue? If it does, the body needs \`Closes #${issue.number}\` or housekeeping will leave this open; if it is a partial fix, nothing to change.`
      : null;
    return state(
      "IN_REVIEW",
      `${numbers} open - drive it with \`/om-pr-autopilot ${prs[0].number}\`.`,
      warning,
    );
  }

  // The parent afk-to-tickets files for a spec: its tickets carry the work, it carries none.
  if (/^Spec: \.ai\/specs\//.test(issue.body ?? ""))
    return state("TRACKING", "A spec parent: its tickets carry the work. Nothing to do.");

  if (waitingOn.length)
    return state(
      "WAITING",
      `Blocked by open ${waitingOn.map((n) => `#${n}`).join(", ")} - the schedule takes it once they close.`,
    );

  if (notReady && !answered) {
    // A `HUMAN-ONLY:` comment at or after the unanswered one is `unblock` (or the skill that
    // stopped) saying no agent can answer it.
    const humanOnly = comments.some(
      (c) => agentVoice(c) && c.createdAt >= notReady.createdAt && HUMAN_ONLY.test(c.body),
    );
    // A comment of anyone else's that came last is a person speaking: afk-unblock step 1 leaves it.
    const lastIsAgent = agentVoice(comments.at(-1));
    return state(
      "NOT_READY",
      humanOnly
        ? "Answer the not-ready or `STOP:` comment: a `HUMAN-ONLY:` comment names what only a person can do."
        : "Answer the not-ready or `STOP:` comment, or let the `unblock` run settle it, then start `issue-groom` on it from the cockpit.",
      undefined,
      !humanOnly && lastIsAgent,
    );
  }

  // The body quotes production error data, which anyone who can make the app fail can write -
  // and a local `pnpm sentry-triage --file-issues` files it as the maintainer.
  if (SENTRY_MARKER.test(issue.body ?? ""))
    return state(
      "EXTERNAL",
      "Filed by sentry-triage from production error data: read it, then start `issue-groom` or `implement-ticket` on it from the cockpit.",
    );

  if (!trusted.has(issue.author?.login))
    return state(
      "EXTERNAL",
      `Opened by ${issue.author?.login ?? "an unknown author"}, whom no automation trusts: read it, then start \`issue-groom\` or \`implement-ticket\` on it from the cockpit, or open it again yourself.`,
    );

  // `afk-plan-to-spec` files a stage only a person can decide as an issue whose body opens with
  // `HUMAN-ONLY:`. Without this it has no brief and reads NEEDS_TRIAGE, and a triage run would then
  // settle the decision it was filed to hand over. A maintainer's comment is the answer.
  if (
    HUMAN_ONLY_BODY.test((issue.body ?? "").trimStart()) &&
    !comments.some((c) => trusted.has(c.author?.login) && !isAgentComment(c))
  )
    return state(
      "NOT_READY",
      "Decide what the `HUMAN-ONLY:` line in the body names, then comment on the issue: triage takes it from there.",
    );

  const missing = [
    ...(briefed ? [] : ["Agent Brief"]),
    ...missingLabels.map((group) => `${group} label`),
  ];
  if (missing.length)
    return state(
      "NEEDS_TRIAGE",
      `No ${missing.join(", ")} yet: start \`issue-groom\` on it from the cockpit.`,
    );

  return state(
    "READY",
    "Ready: the scheduled `implement-ticket` run takes it, or start one on it from the cockpit.",
  );
}

const priorityRank = (labels) => {
  const index = PRIORITY_ORDER.findIndex((label) => labels.includes(label));
  return index === -1 ? PRIORITY_ORDER.indexOf("priority-medium") : index;
};

export const sortIssues = (issues) =>
  [...issues].sort(
    (a, b) =>
      STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
      priorityRank(a.labels) - priorityRank(b.labels) ||
      a.number - b.number,
  );

/**
 * The issue the scheduled run takes: the first READY one in report order (highest priority, then
 * oldest), or null while `WIP_LIMIT` PRs wait for a person or nothing is ready.
 */
export function pickNext(sortedIssues, wip) {
  if (wip >= WIP_LIMIT) return null;
  return sortedIssues.find((issue) => issue.state === "READY")?.number ?? null;
}

/** The `Status` row of a spec's metadata table (.ai/specs/AGENTS.md), or null without one. */
export const specStatus = (text) =>
  /^\|\s*\*\*Status\*\*\s*\|\s*([^|\s]+)\s*\|/m.exec(text)?.[1] ?? null;

/**
 * The specs `afk-to-tickets` has not sliced yet, oldest first: `ready` (merged, waiting for a build)
 * and with no issue, open or closed, whose body starts `Spec: <path>` - the parent it files.
 * There is no age window: a spec that merged last month is as sliceable as one that merged
 * today, which the old "added in the last 14 days" rule got wrong for every spec that sat
 * in review longer than that. `specs` are the files directly in `.ai/specs/`; the status
 * directories hold specs whose build is done or dropped.
 */
export function unslicedSpecs(specs, issues) {
  const parents = issues.map((issue) => String(issue.body ?? "").trimStart());
  return [...specs]
    .sort((a, b) => a.path.localeCompare(b.path))
    .filter((spec) => specStatus(spec.text) === "ready")
    .filter((spec) => !parents.some((body) => body.startsWith(`Spec: ${spec.path}`)));
}

/**
 * The plan files `docs/plans/README.md` lists as migrated to the tracker (`**Migrated -> PRD #N;
 * frozen.**` in the file's table row). The tracker is their authority and the file takes no
 * further edits, so a spec written from one of its stages would contradict the tracker.
 */
export function frozenPlans(readme) {
  const table = String(readme ?? "").replace(/```[\s\S]*?```/g, " ");
  return new Set(
    [...table.matchAll(/^\|\s*`(\d{2}-[a-z0-9-]+\.md)`\s*\|\s*\*\*Migrated\b/gm)].map((m) => m[1]),
  );
}

/**
 * Every `## Stage NN-SM` of the plans in `docs/plans/`, in file-name order and then document order:
 * the sequence the plan was written to be built in. Only `NN-area.md` files are plans (the README,
 * the TEMPLATE and the generated findings register are not), and a heading inside a code sample is
 * a quotation. `ambiguous` marks an id two plan files both use (`13-S1` is in two of them today):
 * for those an id alone does not say which stage a mention covers.
 *
 * `delivered` is set when the stage's own section - its heading to the next `## ` heading - has a
 * line starting `Delivered:`, which `afk-plan-to-spec` writes when the code already does what the
 * stage asks. `frozen` is set for every stage of a plan the README lists as migrated. Neither kind
 * of stage can ever get a spec, so `pickStage` must not name it.
 */
export function planStages(planFiles) {
  const stages = [];
  const frozen = frozenPlans(planFiles.find((file) => file.name === "README.md")?.text);
  const plans = planFiles
    .filter((file) => /^\d{2}-[a-z0-9-]+\.md$/.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const plan of plans) {
    const text = stripCode(plan.text);
    for (const match of text.matchAll(/^##\s+Stage\s+(\d{2}-S\d+[a-z]?)\b/gm)) {
      const rest = text.slice(match.index + match[0].length);
      const end = rest.search(/^##\s/m);
      const section = end < 0 ? rest : rest.slice(0, end);
      stages.push({
        id: match[1],
        file: `${PLANS}/${plan.name}`,
        ambiguous: false,
        delivered: /^Delivered:/m.test(section),
        frozen: frozen.has(plan.name),
      });
    }
  }
  for (const stage of stages)
    stage.ambiguous = stages.some((other) => other.id === stage.id && other.file !== stage.file);
  return stages;
}

/**
 * Whether a text covers a stage: it names the id, and, for an ambiguous id, the plan file too. A
 * trailing letter still counts (`01-S9a` covers `01-S9`: the stage was cut into slices) but a longer
 * number does not (`02-S10` is not `02-S1`).
 */
export function coversStage(text, stage) {
  if (!new RegExp(`(?<![A-Za-z0-9])${stage.id}(?![0-9])`).test(text)) return false;
  return !stage.ambiguous || text.includes(stage.file);
}

/**
 * The first plan stage no spec and no issue, open or closed, mentions, and no run is writing: the
 * next stage whose spec nobody has started. An issue counts because a stage held back by a decision
 * only a person can take is filed as one (afk-plan-to-spec), and that is as covered as a spec.
 * A stage marked `Delivered:` in its plan is covered too, and so is one in a frozen plan: without
 * that, a stage `afk-plan-to-spec` can only end with `NO_ACTION_NEEDED` stays the first candidate,
 * is named on every tick, and the stages behind it are never reached.
 * `corpus` is the text of every spec at any depth plus every issue's title and body.
 */
export function pickStage({ stages, corpus, activeTasks }) {
  return (
    stages.find(
      (stage) =>
        !stage.delivered &&
        !stage.frozen &&
        !corpus.some((text) => coversStage(text, stage)) &&
        !activeTasks.some((task) => coversStage(task, stage)),
    ) ?? null
  );
}

/**
 * Whether an open PR adds a spec. `gh pr list --json files` carries no change type, so "adds" is a
 * file in `.ai/specs/` with no deleted line: a new document, where a status flip or a move
 * deletes the line it replaces. The generated index and the agent rules are not specs.
 */
export const addsSpec = (pr) =>
  (pr.files ?? []).some(
    (file) =>
      file.path.startsWith(`${SPECS}/`) &&
      file.path.endsWith(".md") &&
      !/\/(?:README|AGENTS)\.md$/.test(file.path) &&
      file.additions > 0 &&
      file.deletions === 0,
  );

/**
 * The branch prefix of the docs-only PR `afk-plan-to-spec` opens to mark delivered stages. Until it
 * merges, the stages it marks are still uncovered on the base branch, so the next tick would start
 * the same run on the first of them again. The prefix names that one PR: a person's own edit to
 * `docs/plans/` has some other branch and holds nothing.
 */
export const DELIVERED_BRANCH_PREFIX = "docs/plan-delivered-";

/** Whether an open PR is the one that marks delivered plan stages. */
export const marksDelivered = (pr) => String(pr.headRefName ?? "").startsWith(DELIVERED_BRANCH_PREFIX);

/** The workflow each kind of action starts, in the order `--plan` lists them. */
export const PLAN_WORKFLOWS = {
  implement: "implement-ticket",
  unblock: "unblock",
  triage: "triage",
  slice: "spec-to-tickets",
  "write-spec": "plan-to-spec",
};

/**
 * What the Reconciler may start right now: at most one action per kind, in `PLAN_WORKFLOWS` order,
 * a kind with no candidate left out. Pure, and the only place the five candidate rules live:
 *
 * - implement: `pickNext`, so the pick and `--next` cannot disagree;
 * - unblock: the first issue in report order whose hold or not-ready comment an agent may lift;
 * - triage: the first NEEDS_TRIAGE issue in report order;
 * - slice: the oldest `ready` spec with no parent issue (`unslicedSpecs`);
 * - write-spec: the first stage of `docs/plans/` nothing covers (`pickStage`: no mention, not marked
 *   `Delivered:`, not in a frozen plan), but only while no PR adds a spec or marks delivered
 *   stages (`marksDelivered`) and there is no slice candidate. A spec a run is already slicing is not a
 *   candidate, so the next stage is written meanwhile; a spec that waits for a run is, and holds it
 *   back. One spec ahead of the slicing at a time keeps the review panel's merge order and the
 *   plan's wave order the same thing.
 *
 * Every candidate is dropped while a run already holds it: an issue by its `issueNumber`, a spec
 * path or a stage id by the task text of the live runs.
 */
export function buildPlan({
  issues,
  wip,
  runs,
  activeTasks,
  specs,
  stages,
  allIssues,
  specCorpus,
  openPrs,
}) {
  const actions = [];
  const onIssue = (kind, number, task) =>
    actions.push({ kind, target: `#${number}`, workflow: PLAN_WORKFLOWS[kind], task });
  const idle = (issue) => !runs.has(issue.number);

  const implement = pickNext(issues, wip);
  if (implement !== null) onIssue("implement", implement, `Implement issue #${implement}.`);

  const unblock = issues.find((issue) => issue.canUnblock && idle(issue));
  if (unblock) onIssue("unblock", unblock.number, `Resolve the hold on issue #${unblock.number}.`);

  const triage = issues.find((issue) => issue.state === "NEEDS_TRIAGE" && idle(issue));
  if (triage) onIssue("triage", triage.number, `Triage issue #${triage.number}.`);

  const unsliced = unslicedSpecs(specs, allIssues);
  const slice = unsliced.find((spec) => !activeTasks.some((task) => task.includes(spec.path)));
  if (slice)
    actions.push({
      kind: "slice",
      target: slice.path,
      workflow: PLAN_WORKFLOWS.slice,
      task: `Slice the spec ${slice.path} into tickets.`,
    });

  const stage =
    slice === undefined && !openPrs.some((pr) => addsSpec(pr) || marksDelivered(pr))
      ? pickStage({ stages, corpus: [...specCorpus, ...allIssues.map(issueText)], activeTasks })
      : null;
  if (stage)
    actions.push({
      kind: "write-spec",
      target: stage.id,
      workflow: PLAN_WORKFLOWS["write-spec"],
      task: `Write the spec for plan stage ${stage.id} (${stage.file}).`,
    });

  return { wip: { waitingForPerson: wip, limit: WIP_LIMIT }, actions };
}

const issueText = (issue) => `${issue.title ?? ""}\n${issue.body ?? ""}`;

const gh = (args) =>
  JSON.parse(
    execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
  );

/**
 * A run still holds its issue while the cockpit works on it or will: an active status, or a
 * `failed` run with `autoResumeAt`, which the cockpit resumes by itself after a provider usage
 * limit. Any other failure is the Reconciler's to repair, and it does that by continuing the run.
 */
export const isAlive = (run) =>
  ACTIVE_RUN_STATES.has(run.status) || (run.status === "failed" && Boolean(run.autoResumeAt));

/** The live runs keyed by the issue each one works on. Runs without an `issueNumber` are left out. */
export function runsByIssue(records) {
  const byIssue = new Map();
  for (const run of records) {
    if (!run.issueNumber || !isAlive(run)) continue;
    byIssue.set(Number(run.issueNumber), { status: run.status, workflow: run.workflow });
  }
  return byIssue;
}

/** The cockpit's run records. Absent on a non-cockpit host, where nothing is queued. */
const readRunRecords = () => (existsSync(RUNS) ? JSON.parse(readFileSync(RUNS, "utf8")) : []);

/** Every `.md` under `dir`, at any depth, as `{ path, text }`; empty when `dir` is absent. */
function readMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return readMarkdown(path);
    return entry.name.endsWith(".md") ? [{ path, text: readFileSync(path, "utf8") }] : [];
  });
}

/**
 * Reads `--stale-hours` only when the flag is present, and throws on a malformed value or an
 * argument it does not know: a typo must be as red as a real failure, never a silent default.
 */
export function parseArgs(argv) {
  const options = { asJson: false, next: false, plan: false, staleHours: 24 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") options.asJson = true;
    else if (argv[i] === "--next") options.next = true;
    else if (argv[i] === "--plan") options.plan = true;
    else if (argv[i] === "--stale-hours") {
      const value = argv[++i];
      if (!/^\d+$/.test(value ?? "") || Number(value) === 0)
        throw new Error(`--stale-hours needs a positive whole number of hours, got ${value ?? "nothing"}`);
      options.staleHours = Number(value);
    } else throw new Error(`unknown argument ${argv[i]} - usage: [--json | --next | --plan] [--stale-hours N]`);
  }
  if ([options.asJson, options.next, options.plan].filter(Boolean).length > 1)
    throw new Error("--json, --next and --plan are separate outputs - pick one");
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`backlog-status: ${error.message}`);
    process.exit(2);
  }
  const { asJson, next, plan, staleHours } = options;

  const { labels } = JSON.parse(readFileSync(CONFIG, "utf8"));
  const trusted = trustedAuthors(JSON.parse(readFileSync(AUTOMATIONS, "utf8")));
  const prs = gh([
    "pr", "list", "--state", "open", "--limit", "200",
    "--json", `number,title,body,headRefName,author,labels,updatedAt${plan ? ",files" : ""}`,
  ]);
  const openIssues = gh([
    "issue", "list", "--state", "open", "--limit", "200",
    "--json", "number,title,url,labels,updatedAt,body,comments,author",
  ]);

  const records = readRunRecords();
  const context = {
    trusted,
    sdlcLabels: { category: labels.category, priority: labels.priority, risk: labels.risk },
    openIssues: new Set(openIssues.map((issue) => issue.number)),
    runs: runsByIssue(records),
    prLinks: linkOpenPrs(prs),
    staleHours,
    now: Date.now(),
  };
  const issues = sortIssues(openIssues.map((issue) => classify(issue, context)));

  if (next) {
    const picked = pickNext(issues, countWip(prs, trusted, context.now));
    if (picked !== null) console.log(picked);
    return;
  }

  if (plan) {
    const specFiles = readMarkdown(SPECS);
    const specs = specFiles.filter(
      (file) => dirname(file.path) === SPECS && !/(?:README|AGENTS)\.md$/.test(file.path),
    ).map((file) => ({ path: file.path, text: file.text }));
    const stages = planStages(
      readMarkdown(PLANS).map((file) => ({ name: basename(file.path), text: file.text })),
    );
    // Every issue in any state, in one call: a spec may be sliced and its parent closed, a stage may
    // be covered by an issue long done. Only needed when a spec or a plan can yield a candidate.
    const allIssues =
      specs.length || stages.length
        ? gh(["issue", "list", "--state", "all", "--limit", "3000", "--json", "number,title,body"])
        : [];
    console.log(
      JSON.stringify(
        buildPlan({
          issues,
          wip: countWip(prs, trusted, context.now),
          runs: context.runs,
          activeTasks: records.filter(isAlive).map((run) => String(run.task ?? "")),
          specs,
          stages,
          allIssues,
          specCorpus: specFiles.map((file) => file.text),
          openPrs: prs,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        issues.map(({ number, title, url, labels, state, next, warning, prs }) => ({
          number, title, url, labels, state, next, warning, prs,
        })),
        null,
        2,
      ),
    );
    return;
  }

  let current = null;
  for (const issue of issues) {
    if (issue.state !== current) console.log(`\n## ${(current = issue.state)}`);
    const priority = PRIORITY_ORDER.find((label) => issue.labels.includes(label)) ?? "priority-medium";
    console.log(`#${issue.number} [${priority.replace("priority-", "")}] ${issue.title}`);
    console.log(`    labels: ${issue.labels.join(", ") || "(none)"}`);
    console.log(`    next:   ${issue.next}`);
    if (issue.warning) console.log(`    ⚠️      ${issue.warning}`);
  }

  const counts = issues.reduce(
    (acc, issue) => ({ ...acc, [issue.state]: (acc[issue.state] ?? 0) + 1 }),
    {},
  );
  console.log(
    `\n${issues.length} open issues - ${Object.entries(counts)
      .map(([state, count]) => `${state} ${count}`)
      .join(", ")}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2));
