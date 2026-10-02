/**
 * Was rendered from design4pro/agent-kit until the kit was retired (ADR 0025). Edit it here.
 *
 * The pure half of `backlog-status.mjs` is the whole judgement: everything around it is one `gh`
 * read and a print. What can go wrong here is never an exit code, it is advice - telling a
 * developer to groom an issue whose work is already on an open pull request, or to add a closing
 * keyword to a pull request that deliberately does not close its issue.
 *
 * Both of those shipped once and are pinned below: `linkOpenPrs` keeps *which* signal matched, and
 * a branch-only link is a question rather than an instruction.
 *
 * Since ADR 0032 the same judgement is also a pick: `--next` names the issue a scheduled run
 * implements with nobody watching, so the cases that keep an issue OUT of READY - an author no
 * automation trusts, a brief a stranger wrote, an open blocker, the WIP limit - matter most.
 *
 * Since ADR 0033 `--plan` is five picks at once, for the Reconciler: the cases that matter there are
 * the ones that would start a second run on work a run already holds, slice a spec twice, or lift a
 * hold a person set.
 */

import { describe, expect, it } from "vitest";

import {
  PLAN_WORKFLOWS,
  RETIRED_AGENT_LOGINS,
  WIP_LIMIT,
  addsSpec,
  blockedBy,
  branchIssue,
  buildPlan,
  classify,
  closeKeywordTargets,
  countWip,
  coversStage,
  frozenPlans,
  isAlive,
  linkOpenPrs,
  parseArgs,
  pickNext,
  pickStage,
  planStages,
  readTrusted,
  runsByIssue,
  sortIssues,
  specStatus,
  trustedAuthors,
  unslicedSpecs,
  waitsForPerson,
} from "../backlog-status.mjs";

const NOW = Date.parse("2026-09-13T12:00:00Z");
const OWNER = { login: "rafalwolak" };

const AUTOMATIONS = [
  { name: "Groom", events: ["issue.opened"], filters: { authors: ["rafalwolak"] } },
  { name: "Ungated", events: ["issue.labeled"], filters: {} },
  { name: "Autopilot", events: ["pull_request.opened"], filters: { authors: ["someone-else"] } },
];

const trusted = new Set(["rafalwolak"]);

const sdlcLabels = {
  category: ["bug", "feature"],
  priority: ["priority-low", "priority-medium", "priority-high"],
  risk: ["risk-low", "risk-high"],
};

const BRIEF = "## Agent Brief\n\n**Category:** bug";
const agent = (body, createdAt = "2026-09-01T00:00:00Z") => ({ body: `🤖 ${body}`, createdAt, author: OWNER });
const human = (body, createdAt = "2026-09-02T00:00:00Z", author = OWNER) => ({ body, createdAt, author });

const issue = (over = {}) => ({
  number: 42,
  title: "an issue",
  author: OWNER,
  labels: [{ name: "bug" }, { name: "priority-medium" }, { name: "risk-low" }],
  comments: [agent(`triage\n\n${BRIEF}`)],
  body: "",
  updatedAt: "2026-09-13T11:00:00Z",
  ...over,
});

const decide = (over = {}, context = {}) =>
  classify(issue(over), {
    trusted,
    sdlcLabels,
    openIssues: new Set(),
    runs: new Map(),
    prLinks: new Map(),
    staleHours: 24,
    now: NOW,
    ...context,
  });

describe("readTrusted", () => {
  it("trusts the authors gating an issue automation", () => {
    expect(readTrusted(AUTOMATIONS)).toEqual(new Set(["rafalwolak"]));
  });

  it("trusts nobody when no issue automation is gated", () => {
    expect(readTrusted([AUTOMATIONS[1]]).size).toBe(0);
  });
});

describe("trustedAuthors", () => {
  it("adds the retired agent account to the gated logins", () => {
    expect(RETIRED_AGENT_LOGINS).toEqual(["design4pro-agent"]);
    expect(trustedAuthors(AUTOMATIONS)).toEqual(new Set(["rafalwolak", "design4pro-agent"]));
  });

  it("still trusts nobody when no issue automation is gated", () => {
    expect(trustedAuthors([AUTOMATIONS[1]]).size).toBe(0);
  });
});

describe("closeKeywordTargets", () => {
  it("reads every English closing keyword", () => {
    expect(closeKeywordTargets("Closes #163")).toEqual([163]);
    expect(closeKeywordTargets("fixes #12 and resolved #13")).toEqual([12, 13]);
  });

  it("ignores a bare mention, which is not a link", () => {
    expect(closeKeywordTargets("follow-up to #12")).toEqual([]);
    expect(closeKeywordTargets("refs #12")).toEqual([]);
  });

  it("refuses a keyword that is only the tail of a longer word", () => {
    expect(closeKeywordTargets("discloses #9")).toEqual([]);
  });

  it("does not read a keyword quoted as code", () => {
    expect(closeKeywordTargets("write `Closes #7` in the body")).toEqual([]);
    expect(closeKeywordTargets("```\nCloses #7\n```")).toEqual([]);
  });
});

describe("branchIssue", () => {
  it("reads the issue out of any type prefix, not a fixed list", () => {
    expect(branchIssue("fix/issue-189-e2e-wedge")).toBe(189);
    expect(branchIssue("refactor/issue-184-migrations")).toBe(184);
  });

  it("is null for a branch that claims no issue", () => {
    expect(branchIssue("develop")).toBeNull();
    expect(branchIssue("chore/backlog-status-command")).toBeNull();
    expect(branchIssue("")).toBeNull();
  });
});

describe("linkOpenPrs", () => {
  it("keeps which signal matched, so a branch-only link stays distinguishable", () => {
    const links = linkOpenPrs([
      { number: 269, title: "fix(i18n): date ranges (#163)", body: "Closes #163", headRefName: "fix/issue-163-dates" },
      { number: 268, title: "fix(e2e): name the wedge", body: "This PR does not stop the wedge.", headRefName: "fix/issue-189-e2e-wedge" },
    ]);
    expect(links.get(163)).toEqual([{ number: 269, title: expect.any(String), viaKeyword: true }]);
    expect(links.get(189)).toEqual([{ number: 268, title: expect.any(String), viaKeyword: false }]);
  });

  it("records a pull request once when both signals name the same issue", () => {
    const links = linkOpenPrs([
      { number: 7, title: "t", body: "Fixes #5", headRefName: "feat/issue-5-thing" },
    ]);
    expect(links.get(5)).toHaveLength(1);
    expect(links.get(5)[0].viaKeyword).toBe(true);
  });

  it("links an issue the body closes but the branch does not name", () => {
    const links = linkOpenPrs([
      { number: 8, title: "t", body: "Closes #5\nCloses #6", headRefName: "feat/issue-5-thing" },
    ]);
    expect(links.get(6)).toEqual([{ number: 8, title: "t", viaKeyword: true }]);
  });
});

describe("blockedBy", () => {
  it("reads the issues under the ticket's Blocked by heading, up to the next heading", () => {
    expect(blockedBy("## Acceptance\n- see #3\n\n## Blocked by\n- #12\n- #13\n\n## Notes\n#99")).toEqual([12, 13]);
  });

  it("lists nothing for a ticket that can start immediately, or has no section", () => {
    expect(blockedBy("## Blocked by\n- None - can start immediately")).toEqual([]);
    expect(blockedBy("fixes a thing, see #4")).toEqual([]);
  });
});

describe("classify", () => {
  it("puts a hold ahead of everything, including a claim", () => {
    for (const hold of ["blocked", "do-not-merge", "do-not-close"]) {
      const seen = decide({ labels: [{ name: hold }, { name: "in-progress" }] });
      expect(seen.state).toBe("BLOCKED");
      expect(seen.next).toContain(hold);
    }
  });

  it("reads a fresh claim as running and a stale one as stuck", () => {
    expect(decide({ labels: [{ name: "in-progress" }] }).state).toBe("RUNNING");
    expect(
      decide({ labels: [{ name: "in-progress" }], updatedAt: "2026-09-10T11:00:00Z" }).state,
    ).toBe("STUCK");
  });

  it("is queued while a cockpit run holds it", () => {
    const runs = new Map([[42, { status: "queued", workflow: "implement-ticket" }]]);
    expect(decide({}, { runs }).state).toBe("QUEUED");
  });

  it("sends an issue with an open pull request to review, not to triage", () => {
    const prLinks = new Map([[42, [{ number: 269, title: "t", viaKeyword: true }]]]);
    const seen = decide({ comments: [] }, { prLinks });
    expect(seen.state).toBe("IN_REVIEW");
    expect(seen.warning).toBeNull();
  });

  it("asks about a branch-only link instead of prescribing a closing keyword", () => {
    const prLinks = new Map([[42, [{ number: 268, title: "t", viaKeyword: false }]]]);
    const seen = decide({}, { prLinks });
    expect(seen.state).toBe("IN_REVIEW");
    expect(seen.warning).toContain("Does it close the issue?");
    expect(seen.warning).toContain("if it is a partial fix, nothing to change");
  });

  it("tracks a spec parent instead of asking to triage it", () => {
    expect(decide({ comments: [], body: "Spec: .ai/specs/2026-09-01-x.md\n\n- [ ] #43" }).state).toBe("TRACKING");
  });

  it("waits while an issue it is blocked by is open, and is ready once it closes", () => {
    const body = "## Blocked by\n- #7";
    expect(decide({ body }, { openIssues: new Set([7]) }).state).toBe("WAITING");
    expect(decide({ body }).state).toBe("READY");
  });

  it("holds a not-ready issue until a human answers it", () => {
    const unanswered = [agent(`triage\n\n${BRIEF}`), agent("not ready", "2026-09-03T00:00:00Z")];
    expect(decide({ comments: unanswered }).state).toBe("NOT_READY");
    expect(decide({ comments: [...unanswered, human("ready as is", "2026-09-04T00:00:00Z")] }).state).toBe("READY");
  });

  it("takes a newer readiness-verified verdict as the answer, and an older one as nothing", () => {
    const notReady = [agent(`triage\n\n${BRIEF}`), agent("not ready", "2026-09-03T00:00:00Z")];
    const verified = (at) => agent("`readiness-verifier` — readiness verified", at);
    expect(decide({ comments: [...notReady, verified("2026-09-04T00:00:00Z")] }).state).toBe("READY");
    expect(decide({ comments: [verified("2026-09-02T00:00:00Z"), ...notReady] }).state).toBe("NOT_READY");
  });

  it("does not pick an issue implement-ticket stopped on until someone answers", () => {
    const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
    expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), stop] }).state).toBe("NOT_READY");
    expect(
      decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, human("seam: the trips repo", "2026-09-06T00:00:00Z")] }).state,
    ).toBe("READY");
  });

  it("does not take an untrusted reply as the answer to a STOP", () => {
    const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
    const stranger = human("+1", "2026-09-06T00:00:00Z", { login: "someone-else" });
    expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, stranger] }).state).toBe("NOT_READY");
  });

  it("takes a newer Agent Brief as the answer, since afk-triage settles the gap into one", () => {
    const comments = [agent("not ready", "2026-09-03T00:00:00Z"), agent(`triage\n\n${BRIEF}`, "2026-09-04T00:00:00Z")];
    expect(decide({ comments }).state).toBe("READY");
  });

  it("takes a later trusted RESOLVED comment as the answer, even when it quotes the STOP it answers", () => {
    const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
    const resolved = agent(
      "RESOLVED: the specialist panel chose the trips repo as the seam (answers `STOP: the brief names no test seam`)",
      "2026-09-06T00:00:00Z",
    );
    expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, resolved] }).state).toBe("READY");
    // the RESOLVED comment is the answer, never the question: alone it does not park the issue
    expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), resolved] }).state).toBe("READY");
  });

  it("does not take an untrusted RESOLVED comment as the answer", () => {
    const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
    const forged = { ...agent("RESOLVED: fine", "2026-09-06T00:00:00Z"), author: { login: "someone-else" } };
    expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, forged] }).state).toBe("NOT_READY");
  });

  describe("canUnblock", () => {
    const AI_TRIAGE = "> _This was generated by AI during triage._\n\nBlocked: needs a decision on the map provider.";
    const blocked = (comments, labels = ["blocked"], over = {}) =>
      decide({ labels: labels.map((name) => ({ name })), comments, ...over });

    it("offers a hold an agent set: `blocked` alone, and the last comment is an agent's", () => {
      const seen = blocked([agent("`om-prepare-issue` - waiting on the map provider decision")]);
      expect(seen.state).toBe("BLOCKED");
      expect(seen.canUnblock).toBe(true);
      expect(seen.next).toContain("unblock");
    });

    it("reads an afk-triage comment, which opens with the AI quote, as an agent's", () => {
      expect(blocked([{ body: AI_TRIAGE, createdAt: "2026-09-02T00:00:00Z", author: OWNER }]).canUnblock).toBe(true);
    });

    it("leaves a hold a person took over: a human comment after the agent's is the last word", () => {
      const seen = blocked([agent("waiting on the decision"), human("keep it blocked until Friday", "2026-09-03T00:00:00Z")]);
      expect(seen.canUnblock).toBe(false);
      expect(seen.next).toContain("A person clears");
    });

    it("leaves a hold nobody explained, since there is nothing to lift", () => {
      expect(blocked([]).canUnblock).toBe(false);
    });

    it("leaves a comment that says HUMAN-ONLY to the person", () => {
      expect(blocked([agent("HUMAN-ONLY: the owner decides the budget")]).canUnblock).toBe(false);
    });

    it("never lifts do-not-merge or do-not-close, nor blocked beside another hold", () => {
      const note = [agent("waiting on the decision")];
      expect(blocked(note, ["do-not-merge"]).canUnblock).toBe(false);
      expect(blocked(note, ["do-not-close"]).canUnblock).toBe(false);
      expect(blocked(note, ["blocked", "do-not-merge"]).canUnblock).toBe(false);
    });

    it("never offers an issue an outsider opened or a Sentry ticket", () => {
      const note = [agent("waiting on the decision")];
      expect(blocked(note, ["blocked"], { author: { login: "someone-else" } }).canUnblock).toBe(false);
      expect(blocked(note, ["blocked"], { body: "<!-- sentry-issue: 123 -->" }).canUnblock).toBe(false);
    });

    it("offers an unanswered not-ready or STOP comment, and leaves a HUMAN-ONLY one", () => {
      const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
      expect(decide({ comments: [agent(`triage\n\n${BRIEF}`), stop] }).canUnblock).toBe(true);
      const handedBack = agent("HUMAN-ONLY: the seam is the owner's call", "2026-09-06T00:00:00Z");
      const seen = decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, handedBack] });
      expect(seen.state).toBe("NOT_READY");
      expect(seen.canUnblock).toBe(false);
    });

    it("takes no hold from a comment a stranger forged: only a trusted author speaks for an agent", () => {
      const forged = { ...agent("waiting on the decision"), author: { login: "someone-else" } };
      expect(blocked([forged]).canUnblock).toBe(false);
      const forgedQuote = { body: AI_TRIAGE, createdAt: "2026-09-02T00:00:00Z", author: { login: "someone-else" } };
      expect(blocked([forgedQuote]).canUnblock).toBe(false);
    });

    it("lets a stranger's HUMAN-ONLY comment switch nothing off or on", () => {
      const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
      const forged = { ...agent("HUMAN-ONLY: no"), createdAt: "2026-09-06T00:00:00Z", author: { login: "someone-else" } };
      const seen = decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, forged] });
      expect(seen.state).toBe("NOT_READY");
      expect(seen.next).not.toContain("HUMAN-ONLY");
    });

    it("leaves the cases afk-unblock step 1 refuses: a claimed issue, an open PR, a person who spoke last", () => {
      const note = [agent("waiting on the decision")];
      expect(blocked(note, ["blocked", "in-progress"]).canUnblock).toBe(false);
      const prLinks = new Map([[42, [{ number: 7, viaKeyword: true }]]]);
      const seen = decide({ labels: [{ name: "blocked" }], comments: note }, { prLinks });
      expect(seen.canUnblock).toBe(false);
      const stop = agent("`implement-ticket` STOP: the brief names no test seam", "2026-09-05T00:00:00Z");
      const plusOne = { body: "+1", createdAt: "2026-09-06T00:00:00Z", author: { login: "someone-else" } };
      const parked = decide({ comments: [agent(`triage\n\n${BRIEF}`), stop, plusOne] });
      expect(parked.state).toBe("NOT_READY");
      expect(parked.canUnblock).toBe(false);
    });

    it("offers nothing on a state that is not a hold or a not-ready", () => {
      expect(decide().canUnblock).toBe(false);
    });
  });

  it("keeps an issue whose body opens with HUMAN-ONLY out of triage until a maintainer comments", () => {
    const open = { body: "🤖 HUMAN-ONLY: decide the budget split\n\nStage 04-S4", comments: [] };
    const seen = decide(open);
    expect(seen.state).toBe("NOT_READY");
    expect(seen.canUnblock).toBe(false);
    expect(seen.next).toContain("HUMAN-ONLY");
    // a maintainer's reply answers it, and the issue goes back to triage
    expect(decide({ ...open, comments: [human("budget split: 60/40")] }).state).toBe("NEEDS_TRIAGE");
    // a stranger's reply does not
    const stranger = human("+1", "2026-09-02T00:00:00Z", { login: "someone-else" });
    expect(decide({ ...open, comments: [stranger] }).state).toBe("NOT_READY");
    // and the marker only counts in the body of an issue a trusted author opened
    expect(decide({ ...open, author: { login: "someone-else" } }).state).toBe("EXTERNAL");
  });

  it("never makes an issue someone else opened ready, whatever it carries", () => {
    const stranger = { login: "github-actions" };
    const seen = decide({ author: stranger, body: BRIEF });
    expect(seen.state).toBe("EXTERNAL");
    expect(seen.next).toContain("github-actions");
  });

  it("never makes a Sentry ticket ready, even one the maintainer filed", () => {
    const seen = decide({ body: `<!-- sentry-issue: PLANNED-TRAVEL-4KQ -->\n\n${BRIEF}` });
    expect(seen.state).toBe("EXTERNAL");
    expect(seen.next).toContain("sentry-triage");
  });

  it("does not count a brief an untrusted commenter wrote", () => {
    const comments = [human(BRIEF, "2026-09-02T00:00:00Z", { login: "drive-by" })];
    expect(decide({ comments }).state).toBe("NEEDS_TRIAGE");
  });

  it("takes a brief from the body of a ticket the maintainer filed", () => {
    expect(decide({ comments: [], body: `> *This was generated by AI.*\n\n${BRIEF}` }).state).toBe("READY");
  });

  it("does not read a brief heading quoted as code", () => {
    expect(decide({ comments: [], body: "```\n## Agent Brief\n```" }).state).toBe("NEEDS_TRIAGE");
  });

  it("needs triage when the brief or an SDLC label group is missing, and names what", () => {
    expect(decide({ comments: [] }).next).toContain("No Agent Brief yet");
    const seen = decide({ labels: [{ name: "bug" }] });
    expect(seen.state).toBe("NEEDS_TRIAGE");
    expect(seen.next).toContain("No priority label, risk label yet");
  });

  it("calls a briefed, labelled, unclaimed, unblocked issue ready", () => {
    expect(decide().state).toBe("READY");
  });
});

describe("sortIssues", () => {
  it("orders by state, then priority, then number", () => {
    const rows = [
      { number: 2, state: "READY", labels: ["priority-low"] },
      { number: 1, state: "READY", labels: ["priority-high"] },
      { number: 3, state: "BLOCKED", labels: ["priority-low"] },
      { number: 4, state: "READY", labels: [] },
    ];
    expect(sortIssues(rows).map((row) => row.number)).toEqual([3, 1, 4, 2]);
  });
});

describe("waitsForPerson", () => {
  const pr = (...names) => ({ labels: names.map((name) => ({ name })) });

  it("waits for a person on QA nobody has signed, a high-risk or security diff, or a hold", () => {
    expect(waitsForPerson(pr("needs-qa"))).toBe(true);
    expect(waitsForPerson(pr("risk-high"))).toBe(true);
    expect(waitsForPerson(pr("security"))).toBe(true);
    expect(waitsForPerson(pr("blocked"))).toBe(true);
  });

  it("does not wait once QA is approved, nor for a PR the pipeline merges by itself", () => {
    expect(waitsForPerson(pr("needs-qa", "qa-approved"))).toBe(false);
    expect(waitsForPerson(pr("review"))).toBe(false);
    expect(waitsForPerson(pr("risk-low", "merge-queue"))).toBe(false);
    expect(waitsForPerson(pr())).toBe(false);
  });

  it("still waits for a person when a high-risk PR also has QA approved", () => {
    expect(waitsForPerson(pr("risk-high", "needs-qa", "qa-approved"))).toBe(true);
  });
});

describe("countWip", () => {
  const pr = (labels, login = "rafalwolak") => ({
    author: { login },
    labels: labels.map((name) => ({ name })),
  });

  it("counts only the trusted PRs a person has to clear, not the ones the pipeline merges", () => {
    const prs = [
      pr(["review"]),
      pr([]),
      pr(["changes-requested", "risk-low"]),
      pr(["needs-qa"]),
      pr(["risk-high"]),
      pr(["security"]),
      pr(["blocked"]),
      pr(["needs-qa", "qa-approved"]),
    ];
    expect(countWip(prs, trusted)).toBe(4);
  });

  it("skips the promotion and another author's PR, and counts the retired agent's once it is trusted", () => {
    const prs = [
      pr(["risk-high", "do-not-merge"]),
      pr(["risk-high"], "dependabot[bot]"),
      pr(["risk-high"], "design4pro-agent"),
    ];
    expect(countWip(prs, trusted)).toBe(0);
    expect(countWip(prs, trustedAuthors(AUTOMATIONS))).toBe(1);
  });
});

describe("pickNext", () => {
  const rows = sortIssues([
    { number: 5, state: "READY", labels: ["priority-low"] },
    { number: 9, state: "READY", labels: ["priority-high"] },
    { number: 1, state: "NEEDS_TRIAGE", labels: ["priority-extreme"] },
  ]);

  it("takes the highest-priority ready issue, then the oldest", () => {
    expect(pickNext(rows, 0)).toBe(9);
  });

  it("takes nothing at the WIP limit", () => {
    expect(pickNext(rows, WIP_LIMIT - 1)).toBe(9);
    expect(pickNext(rows, WIP_LIMIT)).toBeNull();
  });

  it("takes nothing when nothing is ready", () => {
    expect(pickNext(rows.filter((row) => row.state !== "READY"), 0)).toBeNull();
  });
});

describe("parseArgs", () => {
  it("defaults to text output and a 24-hour threshold", () => {
    expect(parseArgs([])).toEqual({ asJson: false, next: false, plan: false, staleHours: 24 });
  });

  it("reads --json and --stale-hours in either order", () => {
    expect(parseArgs(["--stale-hours", "6", "--json"])).toEqual({
      asJson: true,
      next: false,
      plan: false,
      staleHours: 6,
    });
  });

  it("reads --next, and refuses it together with --json", () => {
    expect(parseArgs(["--next"]).next).toBe(true);
    expect(() => parseArgs(["--next", "--json"])).toThrow(/pick one/);
  });

  it("reads --plan, and refuses it together with --json or --next", () => {
    expect(parseArgs(["--plan"]).plan).toBe(true);
    expect(() => parseArgs(["--plan", "--json"])).toThrow(/pick one/);
    expect(() => parseArgs(["--next", "--plan"])).toThrow(/pick one/);
  });

  it("rejects a stray positional instead of taking it as the threshold", () => {
    expect(() => parseArgs(["6"])).toThrow(/unknown argument 6/);
  });

  it.each([[[]], [["abc"]], [["0"]], [["-3"]], [["1.5"]], [["--json"]]])(
    "rejects a malformed --stale-hours value %j",
    (rest) => {
      expect(() => parseArgs(["--stale-hours", ...rest])).toThrow(/--stale-hours/);
    },
  );
});

describe("isAlive and runsByIssue", () => {
  it.each(["queued", "running", "waiting", "review"])("holds an issue while the run is %s", (status) => {
    expect(isAlive({ status })).toBe(true);
  });

  it("lets go of a finished, cancelled or failed run, but not a failed one that resumes by itself", () => {
    for (const status of ["done", "cancelled", "failed"]) expect(isAlive({ status })).toBe(false);
    expect(isAlive({ status: "failed", autoResumeAt: "2026-10-02T12:00:00Z" })).toBe(true);
  });

  it("keys the live runs by the issue they work on and skips the rest", () => {
    const runs = runsByIssue([
      { status: "running", workflow: "implement-ticket", issueNumber: 7 },
      { status: "done", workflow: "implement-ticket", issueNumber: 8 },
      { status: "waiting", workflow: "triage", issueNumber: "9" },
      { status: "running", workflow: "spec-to-tickets" },
    ]);
    expect([...runs.keys()]).toEqual([7, 9]);
    expect(runs.get(9)).toEqual({ status: "waiting", workflow: "triage" });
  });
});

describe("specStatus", () => {
  const table = (status) => `# Title\n\n| | |\n| --- | --- |\n| **Status** | ${status} |\n| **Issue** | none |\n`;

  it("reads the Status row of the metadata table", () => {
    expect(specStatus(table("ready"))).toBe("ready");
    expect(specStatus(table("draft"))).toBe("draft");
  });

  it("is null for a document without one", () => {
    expect(specStatus("# Title\n\nno table")).toBeNull();
  });
});

describe("unslicedSpecs", () => {
  const spec = (name, status) => ({
    path: `.ai/specs/${name}.md`,
    text: `| **Status** | ${status} |\n`,
  });

  it("takes the ready specs nobody sliced, oldest first by file name", () => {
    const specs = [spec("2026-09-20-b", "ready"), spec("2026-09-10-a", "ready"), spec("2026-09-01-c", "draft")];
    expect(unslicedSpecs(specs, []).map((s) => s.path)).toEqual([
      ".ai/specs/2026-09-10-a.md",
      ".ai/specs/2026-09-20-b.md",
    ]);
  });

  it("skips a spec whose parent issue exists, open or closed, and has no age window", () => {
    const specs = [spec("2026-01-01-old", "ready"), spec("2026-09-20-new", "ready")];
    const issues = [{ number: 1, body: "Spec: .ai/specs/2026-01-01-old.md\n\nTracking." }];
    expect(unslicedSpecs(specs, issues).map((s) => s.path)).toEqual([".ai/specs/2026-09-20-new.md"]);
  });

  it("does not read a mention in the middle of a body as the parent", () => {
    const specs = [spec("2026-09-20-new", "ready")];
    const issues = [{ number: 2, body: "See Spec: .ai/specs/2026-09-20-new.md for context" }];
    expect(unslicedSpecs(specs, issues)).toHaveLength(1);
  });
});

describe("planStages", () => {
  const plan = (name, ...ids) => ({
    name,
    text: ids.map((id) => `## Stage ${id} - something\n\nbody\n`).join("\n"),
  });

  it("lists the stages in file-name order, then document order", () => {
    const stages = planStages([
      plan("02-places.md", "02-S1", "02-S2"),
      plan("01-trips.md", "01-S1", "01-S9a"),
    ]);
    expect(stages.map((stage) => stage.id)).toEqual(["01-S1", "01-S9a", "02-S1", "02-S2"]);
    expect(stages[0].file).toBe("docs/plans/01-trips.md");
  });

  it("reads only NN-name.md files, and skips a heading inside a code sample", () => {
    const stages = planStages([
      { name: "README.md", text: "## Stage 00-S1 - not a plan\n" },
      { name: "TEMPLATE.md", text: "## Stage 00-S2\n" },
      { name: "03-x.md", text: "```md\n## Stage 03-S9 - a sample\n```\n\n## Stage 03-S1 - real\n" },
    ]);
    expect(stages.map((stage) => stage.id)).toEqual(["03-S1"]);
  });

  describe("a Delivered: line", () => {
    const withBody = (name, ...sections) => ({ name, text: sections.join("\n") });
    const stageText = (id, body) => `## Stage ${id} - something\n\n${body}\n`;
    const deliveredIds = (stages) => stages.filter((stage) => stage.delivered).map((stage) => stage.id);

    it("marks the stage whose own section has a line starting Delivered:", () => {
      const stages = planStages([
        withBody(
          "04-b.md",
          stageText("04-S1", "Delivered: 2026-10-03 - the column ships in 0042."),
          stageText("04-S2", "Owned paths, nothing delivered yet."),
        ),
      ]);
      expect(stages.map((stage) => [stage.id, stage.delivered])).toEqual([
        ["04-S1", true],
        ["04-S2", false],
      ]);
    });

    it("counts a line under a ### subheading, and ends the section at the next ## heading", () => {
      const stages = planStages([
        withBody(
          "04-b.md",
          stageText("04-S1", "### Verification\n\nDelivered: 2026-10-03 - done."),
          "## Appendix\n\nDelivered: not a stage\n",
          stageText("04-S2", "open"),
        ),
      ]);
      expect(deliveredIds(stages)).toEqual(["04-S1"]);
    });

    it("ignores the marker in another stage's section, in a code fence, mid-line and in an inline span", () => {
      const stages = planStages([
        withBody(
          "04-b.md",
          stageText("04-S1", "```md\nDelivered: 2026-10-03 - a sample\n```"),
          stageText("04-S2", "The line `Delivered: x` and then Delivered: mid-line text"),
          stageText("04-S3", "open"),
        ),
      ]);
      expect(deliveredIds(stages)).toEqual([]);
    });

    it("is per plan file: the same id in another file is not delivered with it", () => {
      const stages = planStages([
        withBody("13-a.md", stageText("13-S1", "Delivered: 2026-10-03 - done.")),
        withBody("13-b.md", stageText("13-S1", "open")),
      ]);
      expect(stages.map((stage) => [stage.file, stage.delivered])).toEqual([
        ["docs/plans/13-a.md", true],
        ["docs/plans/13-b.md", false],
      ]);
    });
  });

  describe("frozen plans", () => {
    const readme = {
      name: "README.md",
      text: [
        "| File | Scope |",
        "| --- | --- |",
        "| `01-a.md` | **Migrated -> PRD #104; frozen.** Trips. |",
        "| `02-b.md` | Places and maps. |",
        "| `03-c.md` | **Migrated → PRD #167; frozen.** Reservations. |",
        "```md",
        "| `04-d.md` | **Migrated -> PRD #1; frozen.** a sample |",
        "```",
      ].join("\n"),
    };

    it("marks every stage of a plan the README lists as migrated", () => {
      const stages = planStages([readme, plan("01-a.md", "01-S1"), plan("02-b.md", "02-S1"), plan("03-c.md", "03-S1"), plan("04-d.md", "04-S1")]);
      expect(stages.map((stage) => [stage.id, stage.frozen])).toEqual([
        ["01-S1", true],
        ["02-S1", false],
        ["03-S1", true],
        ["04-S1", false],
      ]);
    });

    it("freezes nothing when the README is absent or lists no migration", () => {
      expect(planStages([plan("01-a.md", "01-S1")])[0].frozen).toBe(false);
      expect(frozenPlans(undefined).size).toBe(0);
    });
  });

  it("marks an id two plan files both use as ambiguous", () => {
    const stages = planStages([plan("13-gallery.md", "13-S1", "13-S2"), plan("13-studio.md", "13-S1")]);
    expect(stages.map((stage) => [stage.id, stage.ambiguous])).toEqual([
      ["13-S1", true],
      ["13-S2", false],
      ["13-S1", true],
    ]);
  });
});

describe("coversStage", () => {
  const stage = { id: "02-S1", file: "docs/plans/02-places.md", ambiguous: false };

  it("covers a stage by its id, and a slice of it by the letter that follows", () => {
    expect(coversStage("Stage 02-S1 of the plan", stage)).toBe(true);
    expect(coversStage("`02-S1a` - the first slice", stage)).toBe(true);
  });

  it("does not take a longer number or a longer word for the id", () => {
    expect(coversStage("Stage 02-S10", stage)).toBe(false);
    expect(coversStage("a102-S1", stage)).toBe(false);
    expect(coversStage("nothing here", stage)).toBe(false);
  });

  it("needs the plan file as well for an ambiguous id", () => {
    const shared = { id: "13-S1", file: "docs/plans/13-gallery.md", ambiguous: true };
    expect(coversStage("Stage 13-S1", shared)).toBe(false);
    expect(coversStage("Stage 13-S1 of docs/plans/13-gallery.md", shared)).toBe(true);
    expect(coversStage("Stage 13-S1 of docs/plans/13-studio.md", shared)).toBe(false);
  });
});

describe("pickStage", () => {
  const stages = [
    { id: "01-S1", file: "docs/plans/01-a.md", ambiguous: false },
    { id: "01-S2", file: "docs/plans/01-a.md", ambiguous: false },
    { id: "02-S1", file: "docs/plans/02-b.md", ambiguous: false },
  ];

  it("takes the first stage nothing covers", () => {
    expect(pickStage({ stages, corpus: ["Stage 01-S1 spec"], activeTasks: [] })?.id).toBe("01-S2");
  });

  it("skips a stage a run is writing, whose task text names it", () => {
    const activeTasks = ["Write the spec for plan stage 01-S2 (docs/plans/01-a.md)."];
    expect(pickStage({ stages, corpus: ["01-S1"], activeTasks })?.id).toBe("02-S1");
  });

  it("is null once every stage is covered", () => {
    expect(pickStage({ stages, corpus: ["01-S1 01-S2 02-S1"], activeTasks: [] })).toBeNull();
  });

  it("skips a stage marked Delivered: and picks the next uncovered one", () => {
    const marked = stages.map((stage) => (stage.id === "01-S1" ? { ...stage, delivered: true } : stage));
    expect(pickStage({ stages: marked, corpus: [], activeTasks: [] })?.id).toBe("01-S2");
  });

  it("skips the stages of a frozen plan, and is null when only those are left", () => {
    const frozen = stages.map((stage) => (stage.file.includes("01-a") ? { ...stage, frozen: true } : stage));
    expect(pickStage({ stages: frozen, corpus: [], activeTasks: [] })?.id).toBe("02-S1");
    expect(pickStage({ stages: frozen, corpus: ["02-S1"], activeTasks: [] })).toBeNull();
  });

  it("still needs the plan file in a mention to cover an ambiguous id, whatever the other file marks", () => {
    const shared = [
      { id: "13-S1", file: "docs/plans/13-a.md", ambiguous: true, delivered: true },
      { id: "13-S1", file: "docs/plans/13-b.md", ambiguous: true, delivered: false },
    ];
    expect(pickStage({ stages: shared, corpus: ["Stage 13-S1"], activeTasks: [] })?.file).toBe("docs/plans/13-b.md");
    expect(pickStage({ stages: shared, corpus: ["13-S1 of docs/plans/13-b.md"], activeTasks: [] })).toBeNull();
  });

  it("is null for a repository without plans", () => {
    expect(pickStage({ stages: [], corpus: [], activeTasks: [] })).toBeNull();
  });
});

describe("addsSpec", () => {
  const pr = (...files) => ({ files });
  const file = (path, additions, deletions) => ({ path, additions, deletions });

  it("is true for a PR that adds a spec document", () => {
    expect(addsSpec(pr(file(".ai/specs/2026-10-02-x.md", 80, 0)))).toBe(true);
  });

  it("is false for a status flip or a move, which delete the line they replace", () => {
    expect(addsSpec(pr(file(".ai/specs/2026-10-02-x.md", 1, 1)))).toBe(false);
  });

  it("is false for the index, the agent rules and files outside .ai/specs", () => {
    expect(addsSpec(pr(file(".ai/specs/README.md", 3, 0), file(".ai/specs/AGENTS.md", 2, 0)))).toBe(false);
    expect(addsSpec(pr(file("docs/plans/01-x.md", 10, 0)))).toBe(false);
    expect(addsSpec({})).toBe(false);
  });
});

describe("buildPlan", () => {
  const row = (number, state, over = {}) => ({ number, state, labels: ["priority-medium"], canUnblock: false, ...over });
  const spec = (name) => ({ path: `.ai/specs/${name}.md`, text: "| **Status** | ready |\n" });
  const stage = { id: "04-S3", file: "docs/plans/04-budget.md", ambiguous: false };
  const base = {
    issues: [],
    wip: 0,
    runs: new Map(),
    activeTasks: [],
    specs: [],
    stages: [],
    allIssues: [],
    specCorpus: [],
    openPrs: [],
  };

  it("lists nothing, with the WIP state, when there is nothing to do", () => {
    expect(buildPlan(base)).toEqual({ wip: { waitingForPerson: 0, limit: WIP_LIMIT }, actions: [] });
  });

  it("names the five kinds in order, one action each, with the workflow and task text the Reconciler runs", () => {
    const plan = buildPlan({
      ...base,
      issues: sortIssues([
        row(7, "READY"),
        row(45, "BLOCKED", { canUnblock: true }),
        row(67, "NEEDS_TRIAGE"),
        row(68, "NEEDS_TRIAGE"),
      ]),
      specs: [],
      stages: [stage],
    });
    expect(plan.actions).toEqual([
      { kind: "implement", target: "#7", workflow: "implement-ticket", task: "Implement issue #7." },
      { kind: "unblock", target: "#45", workflow: "unblock", task: "Resolve the hold on issue #45." },
      { kind: "triage", target: "#67", workflow: "triage", task: "Triage issue #67." },
      {
        kind: "write-spec",
        target: "04-S3",
        workflow: "plan-to-spec",
        task: "Write the spec for plan stage 04-S3 (docs/plans/04-budget.md).",
      },
    ]);
    expect(Object.values(PLAN_WORKFLOWS)).toEqual([
      "implement-ticket",
      "unblock",
      "triage",
      "spec-to-tickets",
      "plan-to-spec",
    ]);
  });

  it("implements nothing at the WIP limit, but still triages and unblocks", () => {
    const plan = buildPlan({
      ...base,
      wip: WIP_LIMIT,
      issues: sortIssues([row(7, "READY"), row(67, "NEEDS_TRIAGE")]),
    });
    expect(plan.wip).toEqual({ waitingForPerson: WIP_LIMIT, limit: WIP_LIMIT });
    expect(plan.actions.map((a) => a.kind)).toEqual(["triage"]);
  });

  it("never starts a second run on an issue a run already holds", () => {
    const runs = new Map([[45, { status: "waiting", workflow: "unblock" }], [67, { status: "running", workflow: "triage" }]]);
    const plan = buildPlan({
      ...base,
      runs,
      issues: sortIssues([row(45, "BLOCKED", { canUnblock: true }), row(67, "NEEDS_TRIAGE"), row(68, "NEEDS_TRIAGE")]),
    });
    expect(plan.actions).toEqual([
      { kind: "triage", target: "#68", workflow: "triage", task: "Triage issue #68." },
    ]);
  });

  it("slices the oldest unsliced ready spec, and writes no spec while one waits", () => {
    const plan = buildPlan({
      ...base,
      specs: [spec("2026-09-20-b"), spec("2026-09-10-a")],
      stages: [stage],
    });
    expect(plan.actions).toEqual([
      {
        kind: "slice",
        target: ".ai/specs/2026-09-10-a.md",
        workflow: "spec-to-tickets",
        task: "Slice the spec .ai/specs/2026-09-10-a.md into tickets.",
      },
    ]);
  });

  it("skips a spec a run is slicing and offers the next one, without writing a spec meanwhile", () => {
    const plan = buildPlan({
      ...base,
      activeTasks: ["Slice the spec .ai/specs/2026-09-10-a.md into tickets."],
      specs: [spec("2026-09-20-b"), spec("2026-09-10-a")],
      stages: [stage],
    });
    expect(plan.actions.map((a) => a.target)).toEqual([".ai/specs/2026-09-20-b.md"]);
  });

  it("converges: a delivered first stage is not named again, the next uncovered stage is", () => {
    const delivered = { id: "00-S4", file: "docs/plans/00-f.md", ambiguous: false, delivered: true };
    const next = { id: "00-S5", file: "docs/plans/00-f.md", ambiguous: false, delivered: false };
    const plan = buildPlan({ ...base, stages: [delivered, next] });
    expect(plan.actions.map((a) => a.target)).toEqual(["00-S5"]);
    expect(buildPlan({ ...base, stages: [delivered] }).actions).toEqual([]);
  });

  it("writes the next spec while a run slices the only unsliced one, which is no longer a candidate", () => {
    const plan = buildPlan({
      ...base,
      activeTasks: ["Slice the spec .ai/specs/2026-09-10-a.md into tickets."],
      specs: [spec("2026-09-10-a")],
      stages: [stage],
    });
    expect(plan.actions.map((a) => a.kind)).toEqual(["write-spec"]);
  });

  it("writes no spec while an open PR adds one, and none while a run writes that stage", () => {
    const adding = { files: [{ path: ".ai/specs/2026-10-02-x.md", additions: 90, deletions: 0 }] };
    expect(buildPlan({ ...base, stages: [stage], openPrs: [adding] }).actions).toEqual([]);
    const writing = ["Write the spec for plan stage 04-S3 (docs/plans/04-budget.md)."];
    expect(buildPlan({ ...base, stages: [stage], activeTasks: writing }).actions).toEqual([]);
  });

  it("counts a spec or an issue that mentions the stage as covering it", () => {
    expect(buildPlan({ ...base, stages: [stage], specCorpus: ["covers 04-S3"] }).actions).toEqual([]);
    const issue = { number: 3, title: "04-S3 budget split", body: "" };
    expect(buildPlan({ ...base, stages: [stage], allIssues: [issue] }).actions).toEqual([]);
  });
});
