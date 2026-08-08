import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { waitForPreview } from "./wait-for-release-preview.mjs";

async function logPathWith(contents) {
  const directory = await mkdtemp(join(tmpdir(), "planned-travel-preview-"));
  const path = join(directory, "preview.log");
  await writeFile(path, contents);
  return path;
}

test("does not accept an unrelated listener after the preview process exits", async () => {
  const logPath = await logPathWith("Port 4173 is already in use");
  let aliveChecks = 0;

  const result = await waitForPreview({
    pid: 4173,
    url: "http://127.0.0.1:4173/",
    logPath,
    attempts: 1,
    isAlive: () => aliveChecks++ === 0,
    request: async () => ({ ok: true }),
    wait: async () => {},
  });

  assert.equal(result.ready, false);
  assert.match(result.reason, /exited while reporting readiness/);
  assert.match(result.log, /Port 4173 is already in use/);
});

test("accepts HTTP readiness only while the preview process remains alive", async () => {
  const logPath = await logPathWith("");

  const result = await waitForPreview({
    pid: 4173,
    url: "http://127.0.0.1:4173/",
    logPath,
    attempts: 1,
    isAlive: () => true,
    request: async () => ({ ok: true }),
    wait: async () => {},
  });

  assert.deepEqual(result, { ready: true, reason: "Release preview is ready." });
  assert.equal(await readFile(logPath, "utf8"), "");
});
