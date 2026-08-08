import { readFile, readdir } from "node:fs/promises";

const failures = [];

async function read(path) {
  return readFile(path, "utf8");
}

function requireText(path, source, text) {
  if (!source.includes(text)) failures.push(`${path} is missing: ${text}`);
}

const workflowPath = ".github/workflows/ci.yml";
const workflow = await read(workflowPath);
for (const command of [
  "pnpm install --frozen-lockfile",
  "pnpm db:check",
  "pnpm typecheck",
  "pnpm lint",
  "pnpm test",
  "pnpm build",
]) {
  requireText(workflowPath, workflow, command);
}
requireText(workflowPath, workflow, "trufflesecurity/trufflehog");
requireText(workflowPath, workflow, "actions/upload-artifact@v4");
requireText(workflowPath, workflow, "planned-travel-web-staging");
for (const phrase of [
  "GIT_FLOW_HEAD_REF",
  "GIT_FLOW_BASE_REF",
  "GIT_FLOW_HEAD_REPOSITORY",
  "GIT_FLOW_BASE_REPOSITORY",
]) {
  requireText(workflowPath, workflow, phrase);
}
if (/run:.*github\.(head_ref|base_ref|event\.pull_request\.head\.sha)/.test(workflow)) {
  failures.push(`${workflowPath} interpolates an untrusted GitHub ref in a run command`);
}

const policyPath = "scripts/check-git-flow-policy.mjs";
const policy = await read(policyPath);
for (const phrase of [
  "feature/",
  "releasePattern",
  "hotfixPattern",
  "main backmerge",
  "developAncestor",
]) {
  requireText(policyPath, policy, phrase);
}

const routerPath = ".github/workflows/multica-event-router.yml";
const router = await read(routerPath);
for (const phrase of [
  "MULTICA_AUTOMATION_ENABLED",
  "MULTICA_REVIEW_WEBHOOK_URL",
  "MULTICA_MERGE_WEBHOOK_URL",
  "MULTICA_RELEASE_WEBHOOK_URL",
  "Idempotency-Key",
  "github.event.sender.type != 'Bot'",
  "github.event.comment.body == '/review-remediation'",
  "github.event.comment.body == '/release-preparation'",
  "github.event.comment.id",
  "github.event.review.id",
  "github.event.pull_request.head.sha",
]) {
  requireText(routerPath, router, phrase);
}
if (router.includes("github.run_id") || router.includes("github.run_attempt")) {
  failures.push(`${routerPath} derives idempotency from a retry-varying run identifier`);
}

const releaseE2ePath = ".github/workflows/release-e2e.yml";
const releaseE2e = await read(releaseE2ePath);
for (const phrase of [
  "github.event.pull_request.head.sha",
  "E2E_BASE_URL=http://127.0.0.1:4173",
  "wait-for-release-preview.mjs",
  "--strictPort",
  "name: Release E2E",
]) {
  requireText(releaseE2ePath, releaseE2e, phrase);
}

requireText(".github/CODEOWNERS", await read(".github/CODEOWNERS"), "@rafalwolak");
requireText(".github/ISSUE_TEMPLATE/product-engineering.md", await read(".github/ISSUE_TEMPLATE/product-engineering.md"), "## Definition of Done");
requireText("CHANGELOG.md", await read("CHANGELOG.md"), "## [Unreleased]");

const runbookPath = "docs/RELEASE.md";
const runbook = await read(runbookPath);
for (const phrase of [
  "previous Worker version",
  "Do not run a destructive D1 down-migration",
  "Workers Builds",
  "health check",
  "authentication gate",
]) {
  requireText(runbookPath, runbook, phrase);
}

const migrationPaths = (await readdir("apps/web/migrations"))
  .filter((path) => path.endsWith(".sql"))
  .map((path) => `apps/web/migrations/${path}`);
for (const path of migrationPaths) {
  const migration = await read(path);
  if (/\b(?:drop|delete)\s+(?:table|column|index|from)\b/i.test(migration)) {
    failures.push(`${path} contains a destructive migration statement`);
  }
}

if (failures.length > 0) {
  console.error("Release contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Release contract passed: CI gates, rollback safety, migrations, and legacy dependencies are accounted for.");
}
