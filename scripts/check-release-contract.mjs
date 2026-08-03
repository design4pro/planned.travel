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

const packagePaths = [
  "package.json",
  "apps/web/package.json",
  "apps/mobile/package.json",
  "packages/api-client/package.json",
  "packages/db/package.json",
  "packages/server/package.json",
  "packages/shared/package.json",
  "packages/ui-tokens/package.json",
];
for (const path of packagePaths) {
  const packageJson = await read(path);
  if (/"(?:astro|hono)"\s*:/.test(packageJson)) {
    failures.push(`${path} still declares a superseded Astro/Hono dependency`);
  }
}

if (failures.length > 0) {
  console.error("Release contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Release contract passed: CI gates, rollback safety, migrations, and legacy dependencies are accounted for.");
}
