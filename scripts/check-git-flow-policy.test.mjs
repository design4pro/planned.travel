import assert from "node:assert/strict";
import test from "node:test";
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
  ["main backmerge", { headRef: "main", baseRef: "develop" }, true],
];

for (const [name, input, expected] of cases) {
  test(name, () => assert.equal(evaluateGitFlowPolicy(input).valid, expected));
}
