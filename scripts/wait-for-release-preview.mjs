import { readFile } from "node:fs/promises";

const DEFAULT_ATTEMPTS = 30;
const DEFAULT_DELAY_MS = 1000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPreviewLog(logPath) {
  try {
    return await readFile(logPath, "utf8");
  } catch {
    return "Preview log was not available.";
  }
}

export async function waitForPreview({
  pid,
  url,
  logPath,
  attempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  isAlive = processIsAlive,
  request = fetch,
  wait = sleep,
}) {
  const fail = async (reason) => ({
    ready: false,
    reason,
    log: await readPreviewLog(logPath),
  });

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!isAlive(pid)) {
      return fail("Release preview process exited before becoming ready.");
    }

    try {
      const response = await request(url);
      if (response.ok) {
        if (!isAlive(pid)) {
          return fail("Release preview process exited while reporting readiness.");
        }
        return { ready: true, reason: "Release preview is ready." };
      }
    } catch {
      // The preview may still be starting; continue polling while it is alive.
    }

    await wait(delayMs);
  }

  return fail(`Release preview did not become ready after ${attempts} attempts.`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pid = Number(argument("--pid"));
  const url = argument("--url");
  const logPath = argument("--log");

  if (!Number.isInteger(pid) || pid <= 0 || !url || !logPath) {
    console.error("Usage: node scripts/wait-for-release-preview.mjs --pid <pid> --url <url> --log <path>");
    process.exitCode = 2;
  } else {
    const result = await waitForPreview({ pid, url, logPath });
    if (!result.ready) {
      console.error(result.reason);
      console.error(result.log);
      process.exitCode = 1;
    }
  }
}
