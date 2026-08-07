import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateGitFlowPolicy } from "./check-git-flow-policy.mjs";

const cases = [
  ["feature to develop", { headRef: "feature/trips", baseRef: "develop" }, true],
  ["fix to develop", { headRef: "fix/auth", baseRef: "develop" }, true],
  ["docs to main is rejected", { headRef: "docs/runbook", baseRef: "main" }, false],
  ["feature to main is rejected", { headRef: "feature/trips", baseRef: "main" }, false],
  ["release to main", { headRef: "release/v1.2.3", baseRef: "main", developAncestor: true }, true],
  ["release without develop ancestry", { headRef: "release/v1.2.3", baseRef: "main", developAncestor: false }, false],
  ["release to develop is rejected", { headRef: "release/v1.2.3", baseRef: "develop" }, false],
  ["hotfix to main", { headRef: "hotfix/security", baseRef: "main", mainAncestor: true }, true],
  ["hotfix without main ancestry", { headRef: "hotfix/security", baseRef: "main", mainAncestor: false }, false],
  ["main backmerge", { headRef: "main", baseRef: "develop", headRepository: "design4pro/planned.travel", baseRepository: "design4pro/planned.travel", mainAncestor: true }, true],
  ["forked main is rejected", { headRef: "main", baseRef: "develop", headRepository: "attacker/planned.travel", baseRepository: "design4pro/planned.travel", mainAncestor: true }, false],
  ["main backmerge without ancestry is rejected", { headRef: "main", baseRef: "develop", headRepository: "design4pro/planned.travel", baseRepository: "design4pro/planned.travel", mainAncestor: false }, false],
  ["hostile feature ref remains data", { headRef: "feature/$(touch compromised)", baseRef: "develop", headRepository: "design4pro/planned.travel", baseRepository: "design4pro/planned.travel" }, true],
];

for (const [name, input, expected] of cases) {
  test(name, () => assert.equal(evaluateGitFlowPolicy(input).valid, expected));
}

test("hostile refs are passed as process data, not shell source", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./check-git-flow-policy.mjs", import.meta.url))], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_FLOW_HEAD_REF: "feature/$(printf hostile)",
      GIT_FLOW_BASE_REF: "develop",
      GIT_FLOW_HEAD_SHA: "HEAD",
      GIT_FLOW_HEAD_REPOSITORY: "design4pro/planned.travel",
      GIT_FLOW_BASE_REPOSITORY: "design4pro/planned.travel",
    },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /development branch targets develop/);
  assert.doesNotMatch(result.stdout, /hostile/);
});
