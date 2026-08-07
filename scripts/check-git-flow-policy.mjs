import { execFileSync } from "node:child_process";

const branchPatterns = ["feature/", "fix/", "chore/", "docs/", "refactor/", "test/"];
const releasePattern = /^release\/v\d+\.\d+\.\d+$/;
const hotfixPattern = /^hotfix\/.+/;

export function evaluateGitFlowPolicy({
  headRef,
  baseRef,
  headRepository,
  baseRepository,
  developAncestor = true,
  mainAncestor = true,
}) {
  if (headRef === "main" && baseRef === "develop") {
    if (headRepository !== baseRepository) {
      return { valid: false, reason: "main backmerges must come from the base repository" };
    }
    return mainAncestor
      ? { valid: true, reason: "main backmerge" }
      : { valid: false, reason: "main backmerges must contain the main branch" };
  }

  if (branchPatterns.some((prefix) => headRef.startsWith(prefix))) {
    return baseRef === "develop"
      ? { valid: true, reason: "development branch targets develop" }
      : { valid: false, reason: "feature, fix, chore, docs, refactor, and test branches must target develop" };
  }

  if (releasePattern.test(headRef)) {
    if (baseRef !== "main") return { valid: false, reason: "release branches must target main" };
    return developAncestor
      ? { valid: true, reason: "release branch is based on develop" }
      : { valid: false, reason: "release branches must contain the develop branch" };
  }

  if (hotfixPattern.test(headRef)) {
    if (baseRef !== "main") return { valid: false, reason: "hotfix branches must target main" };
    return mainAncestor
      ? { valid: true, reason: "hotfix branch is based on main" }
      : { valid: false, reason: "hotfix branches must contain the main branch" };
  }

  return { valid: false, reason: "branch does not match an allowed Git Flow pattern" };
}

function gitAncestor(ref, commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ref, commit], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function input(name) {
  return process.env[`GIT_FLOW_${name}`] ?? argument(`--${name.toLowerCase().replaceAll("_", "-")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const headRef = input("HEAD_REF");
  const baseRef = input("BASE_REF");
  const headSha = input("HEAD_SHA");
  const headRepository = input("HEAD_REPOSITORY");
  const baseRepository = input("BASE_REPOSITORY");
  if (!headRef || !baseRef || !headSha || !headRepository || !baseRepository) {
    console.error("Usage: node scripts/check-git-flow-policy.mjs --head-ref <branch> --base-ref <branch> --head-sha <sha> --head-repository <owner/repo> --base-repository <owner/repo>");
    process.exitCode = 2;
  } else {
    const result = evaluateGitFlowPolicy({
      headRef,
      baseRef,
      headRepository,
      baseRepository,
      developAncestor: gitAncestor("origin/develop", headSha),
      mainAncestor: gitAncestor("origin/main", headSha),
    });
    console.log(`${result.valid ? "Git Flow policy passed" : "Git Flow policy failed"}: ${result.reason}`);
    if (!result.valid) process.exitCode = 1;
  }
}
